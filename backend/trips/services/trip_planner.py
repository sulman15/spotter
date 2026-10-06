"""Orchestrates geocoding, routing, HOS simulation and log generation into a single trip plan."""

from concurrent.futures import ThreadPoolExecutor

from trips.services.daily_logs import build_daily_logs
from trips.services.geocoding import Place, coordinate_label, geocode, reverse_geocode_many
from trips.services.hos import DRIVING, ON_DUTY, HosTripPlanner
from trips.services.routing import get_route, haversine_miles

KNOWN_PLACE_RADIUS_MILES = 1.0
STOP_TYPE_PRIORITY = ("dropoff", "pickup", "restart", "rest", "fuel", "break")
LOCATION_KEYS = ("current_location", "pickup_location", "dropoff_location")


def _resolve_place(location):
    """Use coordinates picked from autocomplete when present; otherwise geocode the typed text."""
    if location.get("lat") is not None and location.get("lon") is not None:
        lat, lon = location["lat"], location["lon"]
        label = location.get("label") or coordinate_label(lat, lon)
        return Place(lat=lat, lon=lon, label=label, short_label=location.get("short_label") or label)
    return geocode(location["label"])


def _label_events(events, places):
    """Name the place of every duty change: trip endpoints by their input names, other stops by reverse geocoding."""
    unknown = []
    for event in events:
        known = next(
            (place for place in places if haversine_miles((event.lat, event.lon), (place.lat, place.lon)) <= KNOWN_PLACE_RADIUS_MILES),
            None,
        )
        if known:
            event.location = known.short_label
        else:
            unknown.append(event)

    for event, label in zip(unknown, reverse_geocode_many([(event.lat, event.lon) for event in unknown])):
        event.location = label


def _build_stops(events, route):
    """
    Group consecutive non-driving events at one place into a map stop (e.g. post-trip + 10-hour break + pre-trip).
    The opening group (pre-trip inspection) is kept as the "start" stop unless it is already the pickup.
    """
    groups, current = [], []
    for event in events:
        if event.status == DRIVING:
            if current:
                groups.append(current)
            current = []
        else:
            current.append(event)
    if current:
        groups.append(current)

    stops = []
    for index, group in enumerate(groups):
        types = {event.stop_type for event in group if event.stop_type}
        if not types and index > 0:
            continue
        first, last = group[0], group[-1]
        stops.append({
            "type": next((kind for kind in STOP_TYPE_PRIORITY if kind in types), "start"),
            "lat": first.lat,
            "lon": first.lon,
            "location": first.location,
            "arrival": first.start.isoformat(),
            "departure": last.end.isoformat(),
            "duration_hours": round((last.end - first.start).total_seconds() / 3600, 2),
            "miles_from_start": round(route.miles_at(first.route_hours_start), 1),
            "activities": [
                {"status": event.status, "note": event.note, "start": event.start.isoformat(), "end": event.end.isoformat()}
                for event in group
            ],
        })
    return stops


def _summary(events, stops, route):
    def total_hours(*statuses):
        return round(sum((e.end - e.start).total_seconds() for e in events if e.status in statuses) / 3600, 2)

    def arrival_of(stop_type):
        return next((stop["arrival"] for stop in stops if stop["type"] == stop_type), None)

    return {
        "total_miles": round(route.distance_miles, 1),
        "driving_hours": total_hours(DRIVING),
        "on_duty_hours": total_hours(DRIVING, ON_DUTY),
        "trip_start": events[0].start.isoformat(),
        "trip_end": events[-1].end.isoformat(),
        "elapsed_hours": round((events[-1].end - events[0].start).total_seconds() / 3600, 2),
        "pickup_arrival": arrival_of("pickup"),
        "dropoff_arrival": arrival_of("dropoff"),
        "cycle_hours_used_at_end": round(events[-1].cycle_minutes_end / 60, 2),
        "stop_counts": {kind: sum(1 for stop in stops if stop["type"] == kind) for kind in STOP_TYPE_PRIORITY},
    }


def plan_trip(data):
    with ThreadPoolExecutor(max_workers=len(LOCATION_KEYS)) as pool:
        places = list(pool.map(_resolve_place, (data[key] for key in LOCATION_KEYS)))

    route = get_route(places)
    events = HosTripPlanner(route, data["start_time"], data["current_cycle_used"]).plan()
    _label_events(events, places)
    stops = _build_stops(events, route)

    return {
        "places": dict(zip(("current", "pickup", "dropoff"), (place.as_dict() for place in places))),
        "route": {
            "distance_miles": round(route.distance_miles, 1),
            "duration_hours": round(route.duration_hours, 2),
            "legs": [
                {
                    "name": name,
                    "distance_miles": round(leg.distance_miles, 1),
                    "duration_hours": round(leg.duration_hours, 2),
                    "geometry": leg.geometry,
                    "instructions": leg.instructions,
                }
                for name, leg in zip(("To pickup", "To drop-off"), route.legs)
            ],
        },
        "stops": stops,
        "summary": _summary(events, stops, route),
        "daily_logs": build_daily_logs(events, route),
    }
