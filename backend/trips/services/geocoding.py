"""Forward and reverse geocoding backed by Photon (free, OpenStreetMap data)."""

import logging
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass

from django.conf import settings

from trips.exceptions import ExternalServiceError, TripPlanningError
from trips.services.http import get_json

logger = logging.getLogger(__name__)

US_STATE_ABBREVIATIONS = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR", "California": "CA",
    "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE", "District of Columbia": "DC",
    "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL",
    "Indiana": "IN", "Iowa": "IA", "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA",
    "Maine": "ME", "Maryland": "MD", "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN",
    "Mississippi": "MS", "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV",
    "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
    "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK", "Oregon": "OR",
    "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD",
    "Tennessee": "TN", "Texas": "TX", "Utah": "UT", "Vermont": "VT", "Virginia": "VA",
    "Washington": "WA", "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY",
}

# Biases free-text search towards the continental US without excluding other results.
US_CENTER = {"lat": 39.8, "lon": -98.6}
REVERSE_GEOCODE_WORKERS = 8


@dataclass(frozen=True)
class Place:
    lat: float
    lon: float
    label: str
    short_label: str

    def as_dict(self):
        return {"lat": self.lat, "lon": self.lon, "label": self.label, "short_label": self.short_label}


def coordinate_label(lat, lon):
    return f"{abs(lat):.3f}°{'N' if lat >= 0 else 'S'}, {abs(lon):.3f}°{'E' if lon >= 0 else 'W'}"


def _region(properties):
    state = properties.get("state")
    if properties.get("countrycode") == "US":
        return US_STATE_ABBREVIATIONS.get(state, state)
    return state or properties.get("country")


def _short_label(properties):
    locality = properties.get("city") or properties.get("town") or properties.get("village")
    if not locality and properties.get("type") in {"city", "town", "village", "locality"}:
        locality = properties.get("name")
    locality = locality or properties.get("county") or properties.get("name")
    return ", ".join(part for part in (locality, _region(properties)) if part)


def _full_label(properties):
    name = properties.get("name")
    street = " ".join(part for part in (properties.get("housenumber"), properties.get("street")) if part)
    parts = list(dict.fromkeys(part for part in (name, street, _short_label(properties)) if part))
    # Drop parts already contained in another, e.g. "Chicago" within "Chicago, IL".
    return ", ".join(part for part in parts if not any(part != other and part in other for other in parts))


def _place_from_feature(feature):
    lon, lat = feature["geometry"]["coordinates"]
    properties = feature.get("properties", {})
    short = _short_label(properties) or coordinate_label(lat, lon)
    return Place(lat=lat, lon=lon, label=_full_label(properties) or short, short_label=short)


def search_places(query, limit=5):
    data = get_json(f"{settings.PHOTON_BASE_URL}/api/", params={"q": query, "limit": limit, "lang": "en", **US_CENTER})
    return [_place_from_feature(feature) for feature in data.get("features") or []]


def geocode(query):
    places = search_places(query, limit=1)
    if not places:
        raise TripPlanningError(f'We couldn\'t find "{query}". Try a more specific address or city.')
    return places[0]


def reverse_geocode(lat, lon):
    """Best-effort "City, ST" label; falls back to coordinates so a slow lookup never fails the trip."""
    try:
        data = get_json(f"{settings.PHOTON_BASE_URL}/reverse", params={"lat": lat, "lon": lon, "lang": "en"}, timeout=8)
        features = data.get("features") or []
        if features:
            return _short_label(features[0].get("properties", {})) or coordinate_label(lat, lon)
    except ExternalServiceError:
        logger.info("Reverse geocode failed for %s,%s", lat, lon)
    return coordinate_label(lat, lon)


def reverse_geocode_many(points):
    """Label many (lat, lon) points concurrently; returns labels in the same order."""
    unique = list(dict.fromkeys((round(lat, 4), round(lon, 4)) for lat, lon in points))
    with ThreadPoolExecutor(max_workers=REVERSE_GEOCODE_WORKERS) as pool:
        labels = dict(zip(unique, pool.map(lambda point: reverse_geocode(*point), unique)))
    return [labels[(round(lat, 4), round(lon, 4))] for lat, lon in points]
