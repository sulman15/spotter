"""
Hours-of-Service trip simulation for a property-carrying driver on the 70-hour/8-day cycle (49 CFR Part 395).

Time is tracked in whole minutes so daily totals add up exactly and limits are never overshot by rounding.
Assumes the driver starts the trip after a full 10-hour break, and (with no per-day history available) that
cycle hours only reset through a 34-hour restart.
"""

import math
from dataclasses import dataclass
from datetime import timedelta

OFF_DUTY = "off_duty"
SLEEPER_BERTH = "sleeper_berth"
DRIVING = "driving"
ON_DUTY = "on_duty"
DUTY_STATUSES = (OFF_DUTY, SLEEPER_BERTH, DRIVING, ON_DUTY)

MAX_DRIVING_MINUTES = 11 * 60
DUTY_WINDOW_MINUTES = 14 * 60
BREAK_REQUIRED_AFTER_DRIVING_MINUTES = 8 * 60
BREAK_MINUTES = 30
SHIFT_RESET_MINUTES = 10 * 60
CYCLE_LIMIT_MINUTES = 70 * 60
CYCLE_RESTART_MINUTES = 34 * 60
FUEL_INTERVAL_MILES = 1000
FUELING_MINUTES = 30
PICKUP_MINUTES = 60
DROPOFF_MINUTES = 60
INSPECTION_MINUTES = 15

# Remaining drive time shorter than this is treated as arrived (avoids 1-minute slivers from float noise).
ARRIVAL_TOLERANCE_HOURS = 0.5 / 60


@dataclass
class DutyEvent:
    status: str
    start: object  # datetime
    end: object  # datetime
    lat: float
    lon: float
    note: str
    stop_type: str | None = None
    route_hours_start: float = 0.0
    route_hours_end: float = 0.0
    cycle_minutes_start: int = 0
    cycle_minutes_end: int = 0
    location: str = ""


class HosTripPlanner:
    def __init__(self, route, start_time, cycle_used_hours):
        self.route = route
        self.clock = start_time
        self.route_hours = 0.0
        self.cycle_minutes = round(cycle_used_hours * 60)
        self.shift_start = None
        self.shift_driving_minutes = 0
        self.driving_since_break_minutes = 0
        self.non_driving_streak_minutes = 0
        self.rest_streak_minutes = 0
        self.last_fuel_miles = 0.0
        self.events = []

    def plan(self):
        pickup_leg, dropoff_leg = self.route.legs
        self._drive_until(pickup_leg.end_time, "En route to pickup")
        self._work(PICKUP_MINUTES, "Pickup - loading", "pickup")
        self._drive_until(dropoff_leg.end_time, "En route to drop-off")
        self._work(DROPOFF_MINUTES, "Drop-off - unloading", "dropoff")
        self._end_shift()
        return self.events

    # --- Limits -------------------------------------------------------------------------------------------------

    @property
    def _shift_active(self):
        return self.shift_start is not None

    @property
    def _window_used_minutes(self):
        return int((self.clock - self.shift_start).total_seconds() // 60) if self._shift_active else 0

    @property
    def _cycle_left_minutes(self):
        return CYCLE_LIMIT_MINUTES - self.cycle_minutes

    @property
    def _next_fuel_miles(self):
        return self.last_fuel_miles + FUEL_INTERVAL_MILES

    def _minutes_until_fuel(self):
        if self._next_fuel_miles > self.route.distance_miles:
            return math.inf
        return (self.route.hours_at(self._next_fuel_miles) - self.route_hours) * 60

    def _driving_minutes_available(self):
        minutes_until_fuel = self._minutes_until_fuel()
        return min(
            MAX_DRIVING_MINUTES - self.shift_driving_minutes,
            DUTY_WINDOW_MINUTES - self._window_used_minutes,
            BREAK_REQUIRED_AFTER_DRIVING_MINUTES - self.driving_since_break_minutes,
            self._cycle_left_minutes,
            math.floor(minutes_until_fuel) if math.isfinite(minutes_until_fuel) else math.inf,
        )

    # --- Activities ---------------------------------------------------------------------------------------------

    def _drive_until(self, target_route_hours, note):
        while target_route_hours - self.route_hours > ARRIVAL_TOLERANCE_HOURS:
            self._prepare_to_drive()
            remaining_minutes = max(1, round((target_route_hours - self.route_hours) * 60))
            minutes = min(self._driving_minutes_available(), remaining_minutes)
            route_hours_end = min(target_route_hours, self.route_hours + minutes / 60)
            self._record(DRIVING, minutes, note, route_hours_end=route_hours_end)
        self.route_hours = max(self.route_hours, target_route_hours)

    def _prepare_to_drive(self):
        """Take whatever rest, inspection, fuel or break is legally required before the next minute of driving."""
        while True:
            if self._cycle_left_minutes < 1 or (not self._shift_active and self._cycle_left_minutes <= INSPECTION_MINUTES):
                self._rest(CYCLE_RESTART_MINUTES, OFF_DUTY, "34-hour restart (70-hour cycle reached)", "restart")
            elif self._shift_active and (
                self.shift_driving_minutes >= MAX_DRIVING_MINUTES or self._window_used_minutes >= DUTY_WINDOW_MINUTES
            ):
                self._rest(SHIFT_RESET_MINUTES, SLEEPER_BERTH, "10-hour break", "rest")
            elif not self._shift_active:
                self._record(ON_DUTY, INSPECTION_MINUTES, "Pre-trip inspection")
            elif self._minutes_until_fuel() < 1:
                self._record(ON_DUTY, FUELING_MINUTES, "Fueling", "fuel")
                self.last_fuel_miles = self.route.miles_at(self.route_hours)
            elif self.driving_since_break_minutes >= BREAK_REQUIRED_AFTER_DRIVING_MINUTES:
                self._record(OFF_DUTY, BREAK_MINUTES, "30-minute break", "break")
            else:
                return

    def _work(self, minutes, note, stop_type):
        if not self._shift_active:
            self._record(ON_DUTY, INSPECTION_MINUTES, "Pre-trip inspection")
        self._record(ON_DUTY, minutes, note, stop_type)

    def _end_shift(self):
        if self._shift_active:
            self._record(ON_DUTY, INSPECTION_MINUTES, "Post-trip inspection")

    def _rest(self, minutes, status, note, stop_type):
        self._end_shift()
        self._record(status, minutes, note, stop_type)

    # --- Bookkeeping --------------------------------------------------------------------------------------------

    def _record(self, status, minutes, note, stop_type=None, route_hours_end=None):
        lat, lon = self.route.position_at(self.route_hours)
        event = DutyEvent(
            status=status,
            start=self.clock,
            end=self.clock + timedelta(minutes=minutes),
            lat=lat,
            lon=lon,
            note=note,
            stop_type=stop_type,
            route_hours_start=self.route_hours,
            route_hours_end=self.route_hours if route_hours_end is None else route_hours_end,
            cycle_minutes_start=self.cycle_minutes,
        )
        self._apply_counters(status, minutes, event.start)
        self.clock = event.end
        self.route_hours = event.route_hours_end
        event.cycle_minutes_end = self.cycle_minutes
        self.events.append(event)

    def _apply_counters(self, status, minutes, started_at):
        if status in (DRIVING, ON_DUTY):
            self.cycle_minutes += minutes
            self.rest_streak_minutes = 0
            if not self._shift_active:
                self.shift_start = started_at

        if status == DRIVING:
            self.shift_driving_minutes += minutes
            self.driving_since_break_minutes += minutes
            self.non_driving_streak_minutes = 0
        else:
            self.non_driving_streak_minutes += minutes
            if self.non_driving_streak_minutes >= BREAK_MINUTES:
                self.driving_since_break_minutes = 0

        if status in (OFF_DUTY, SLEEPER_BERTH):
            self.rest_streak_minutes += minutes
            if self.rest_streak_minutes >= SHIFT_RESET_MINUTES:
                self.shift_start = None
                self.shift_driving_minutes = 0
            if self.rest_streak_minutes >= CYCLE_RESTART_MINUTES:
                self.cycle_minutes = 0
