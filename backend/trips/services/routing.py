"""Driving routes from the public OSRM server, indexed so positions can be looked up by drive time or distance."""

import math
from bisect import bisect_left, bisect_right
from dataclasses import dataclass, field

from django.conf import settings

from trips.exceptions import TripPlanningError
from trips.services.http import get_json

METERS_PER_MILE = 1609.344
SECONDS_PER_HOUR = 3600
EARTH_RADIUS_MILES = 3958.8
MAX_MAP_POINTS_PER_LEG = 1500


def haversine_miles(a, b):
    lat1, lon1, lat2, lon2 = map(math.radians, (*a, *b))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 2 * EARTH_RADIUS_MILES * math.asin(math.sqrt(h))


def _interpolate(xs, ys, x):
    """Linear interpolation of y at x over ascending xs."""
    if x <= xs[0]:
        return ys[0]
    if x >= xs[-1]:
        return ys[-1]
    i = bisect_right(xs, x)
    x0, x1 = xs[i - 1], xs[i]
    ratio = 0 if x1 == x0 else (x - x0) / (x1 - x0)
    return ys[i - 1] + (ys[i] - ys[i - 1]) * ratio


def _downsample(points, limit):
    if len(points) <= limit:
        return points
    step = (len(points) - 1) / (limit - 1)
    return [points[round(i * step)] for i in range(limit)]


# --- Turn-by-turn text ------------------------------------------------------------------------------------------

def _road(step):
    name, ref = step.get("name"), step.get("ref")
    if name and ref and ref not in name:
        return f"{ref} ({name})"
    return ref or name or ""


def _onto(step):
    road = _road(step)
    return f" onto {road}" if road else ""


def instruction_text(step):
    maneuver = step.get("maneuver", {})
    kind, modifier = maneuver.get("type"), maneuver.get("modifier", "")
    road = _road(step)
    toward = f" toward {step['destinations']}" if step.get("destinations") else ""

    match kind:
        case "depart":
            return f"Depart{' on ' + road if road else ''}"
        case "turn" | "end of road":
            prefix = "At the end of the road, turn" if kind == "end of road" else "Turn"
            return f"{prefix} {modifier}{_onto(step)}".replace("turn straight", "continue straight")
        case "new name":
            return f"Continue{_onto(step)}"
        case "merge":
            return f"Merge{' ' + modifier if modifier else ''}{_onto(step)}"
        case "on ramp":
            return f"Take the ramp{_onto(step)}{toward}"
        case "off ramp":
            exit_ref = f" {step['exits']}" if step.get("exits") else ""
            return f"Take exit{exit_ref}{_onto(step)}{toward}"
        case "fork":
            return f"Keep {modifier or 'straight'} at the fork{_onto(step)}{toward}"
        case "roundabout" | "rotary" | "roundabout turn":
            exit_number = maneuver.get("exit")
            exit_text = f" and take exit {exit_number}" if exit_number else ""
            return f"Enter the roundabout{exit_text}{_onto(step)}"
        case _:
            return f"Continue{' ' + modifier if modifier and modifier != 'straight' else ''}{' on ' + road if road else ''}"


# --- Route model ------------------------------------------------------------------------------------------------

@dataclass
class RouteLeg:
    distance_miles: float
    duration_hours: float
    start_time: float  # cumulative route drive-hours at the leg start
    geometry: list = field(default_factory=list)  # [lat, lon] pairs
    instructions: list = field(default_factory=list)

    @property
    def end_time(self):
        return self.start_time + self.duration_hours


@dataclass
class Route:
    legs: list
    points: list  # (lat, lon) for the full route
    cumulative_miles: list
    cumulative_hours: list

    @property
    def distance_miles(self):
        return self.cumulative_miles[-1]

    @property
    def duration_hours(self):
        return self.cumulative_hours[-1]

    def miles_at(self, drive_hours):
        return _interpolate(self.cumulative_hours, self.cumulative_miles, drive_hours)

    def hours_at(self, miles):
        return _interpolate(self.cumulative_miles, self.cumulative_hours, miles)

    def position_at(self, drive_hours):
        hours = self.cumulative_hours
        if drive_hours <= hours[0]:
            return self.points[0]
        if drive_hours >= hours[-1]:
            return self.points[-1]
        i = max(1, bisect_left(hours, drive_hours))
        span = hours[i] - hours[i - 1]
        ratio = 0 if span == 0 else (drive_hours - hours[i - 1]) / span
        (lat0, lon0), (lat1, lon1) = self.points[i - 1], self.points[i]
        return (lat0 + (lat1 - lat0) * ratio, lon0 + (lon1 - lon0) * ratio)


def _append_step(step, points, miles, hours):
    """Append a step's polyline, spreading its OSRM distance and duration across the vertices by length."""
    coords = [(lat, lon) for lon, lat in step.get("geometry", {}).get("coordinates", [])]
    if not points and coords:
        points.append(coords[0])
        miles.append(0.0)
        hours.append(0.0)
    if len(coords) < 2:
        return

    lengths = [haversine_miles(coords[i - 1], coords[i]) for i in range(1, len(coords))]
    total_length = sum(lengths) or 1
    step_miles = step["distance"] / METERS_PER_MILE
    step_hours = step["duration"] / SECONDS_PER_HOUR
    for coord, length in zip(coords[1:], lengths):
        share = length / total_length
        points.append(coord)
        miles.append(miles[-1] + step_miles * share)
        hours.append(hours[-1] + step_hours * share)


def get_route(places):
    coordinates = ";".join(f"{place.lon},{place.lat}" for place in places)
    data = get_json(
        f"{settings.OSRM_BASE_URL}/route/v1/driving/{coordinates}",
        params={"overview": "false", "steps": "true", "geometries": "geojson"},
        accept_client_errors=True,
    )
    if data.get("code") != "Ok" or not data.get("routes"):
        raise TripPlanningError("No drivable route was found between these locations.")

    points, miles, hours, legs = [], [], [], []
    for osrm_leg in data["routes"][0]["legs"]:
        leg_start_index = max(len(points) - 1, 0)
        leg = RouteLeg(
            distance_miles=osrm_leg["distance"] / METERS_PER_MILE,
            duration_hours=osrm_leg["duration"] / SECONDS_PER_HOUR,
            start_time=hours[-1] if hours else 0.0,
        )
        for step in osrm_leg["steps"]:
            _append_step(step, points, miles, hours)
            if step["maneuver"]["type"] != "arrive" and step["distance"] > 0:
                leg.instructions.append({
                    "text": instruction_text(step),
                    "distance_miles": round(step["distance"] / METERS_PER_MILE, 2),
                    "duration_hours": round(step["duration"] / SECONDS_PER_HOUR, 3),
                })
        leg.geometry = [[round(lat, 5), round(lon, 5)] for lat, lon in _downsample(points[leg_start_index:], MAX_MAP_POINTS_PER_LEG)]
        legs.append(leg)

    if not points:
        points, miles, hours = [(places[0].lat, places[0].lon)], [0.0], [0.0]
    return Route(legs=legs, points=points, cumulative_miles=miles, cumulative_hours=hours)
