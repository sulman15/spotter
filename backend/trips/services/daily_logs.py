"""Splits a trip's duty timeline into 24-hour Driver's Daily Log sheets (midnight to midnight, home-terminal time)."""

from dataclasses import replace
from datetime import datetime, time, timedelta

from trips.services.hos import CYCLE_LIMIT_MINUTES, DRIVING, DUTY_STATUSES, OFF_DUTY, ON_DUTY

ONE_DAY = timedelta(days=1)


def _midnight(moment):
    return datetime.combine(moment.date(), time.min)


def _minutes(delta):
    return int(delta.total_seconds() // 60)


def _hours(minutes):
    return round(minutes / 60, 2)


def _padded_timeline(events):
    """Surround the trip with off-duty time so the first and last sheets cover the full 24 hours."""
    first, last = events[0], events[-1]
    first_day_start = _midnight(first.start)
    last_day_end = last.end if last.end == _midnight(last.end) else _midnight(last.end) + ONE_DAY

    timeline = list(events)
    if first.start > first_day_start:
        timeline.insert(0, replace(first, status=OFF_DUTY, start=first_day_start, end=first.start, note="", stop_type=None,
                                   route_hours_end=first.route_hours_start, cycle_minutes_end=first.cycle_minutes_start))
    if last.end < last_day_end:
        timeline.append(replace(last, status=OFF_DUTY, start=last.end, end=last_day_end, note="Off duty - trip complete",
                                stop_type=None, route_hours_start=last.route_hours_end,
                                cycle_minutes_start=last.cycle_minutes_end))
    return timeline


def _merge_segments(segments):
    merged = []
    for segment in segments:
        if merged and merged[-1]["status"] == segment["status"] and merged[-1]["end_minute"] == segment["start_minute"]:
            merged[-1]["end_minute"] = segment["end_minute"]
        else:
            merged.append(segment)
    return merged


def _cycle_minutes_at(event, moment):
    if moment >= event.end:
        return event.cycle_minutes_end
    elapsed = _minutes(moment - event.start) if event.status in (DRIVING, ON_DUTY) else 0
    return event.cycle_minutes_start + elapsed


def _driven_miles(event, start, end, route):
    def miles_at(moment):
        return route.miles_at(event.route_hours_start + (moment - event.start).total_seconds() / 3600)

    return miles_at(end) - miles_at(start)


def _build_sheet(day_start, events, route):
    day_end = day_start + ONE_DAY
    totals = dict.fromkeys(DUTY_STATUSES, 0)
    segments, remarks, miles = [], [], 0.0

    for event in events:
        start, end = max(event.start, day_start), min(event.end, day_end)
        start_minute, end_minute = _minutes(start - day_start), _minutes(end - day_start)
        segments.append({"status": event.status, "start_minute": start_minute, "end_minute": end_minute})
        totals[event.status] += end_minute - start_minute
        if event.status == DRIVING:
            miles += _driven_miles(event, start, end, route)
        if event.note and event.start >= day_start:
            remarks.append({
                "minute": start_minute,
                "time": event.start.strftime("%H:%M"),
                "status": event.status,
                "location": event.location,
                "note": event.note,
            })

    cycle_minutes = _cycle_minutes_at(events[-1], day_end)
    return {
        "date": day_start.date().isoformat(),
        "from_location": events[0].location,
        "to_location": events[-1].location,
        "segments": _merge_segments(segments),
        "remarks": remarks,
        "totals_hours": {status: _hours(minutes) for status, minutes in totals.items()},
        "miles_driven": round(miles, 1),
        "on_duty_today_hours": _hours(totals[DRIVING] + totals[ON_DUTY]),
        "cycle_hours_used": _hours(cycle_minutes),
        "cycle_hours_available": _hours(max(CYCLE_LIMIT_MINUTES - cycle_minutes, 0)),
    }


def build_daily_logs(events, route):
    timeline = _padded_timeline(events)
    sheets = []
    day_start = _midnight(timeline[0].start)
    while day_start < timeline[-1].end:
        day_end = day_start + ONE_DAY
        day_events = [event for event in timeline if event.start < day_end and event.end > day_start]
        sheets.append(_build_sheet(day_start, day_events, route))
        day_start = day_end
    return sheets
