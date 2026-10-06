# Spotter ELD · Trip Planner

Full-stack app (Django + React) that takes trip details and outputs a route map with every HOS-required stop,
plus filled-out, drawn Driver's Daily Log sheets — one per calendar day of the trip.

**Inputs:** current location, pickup location, drop-off location, current cycle used (hrs), trip start time.
**Outputs:** route map with stops & rests, turn-by-turn instructions, itinerary, and daily log sheets (printable).

## How it works

```
frontend (React + Vite + Tailwind + Leaflet)
   │  POST /api/trips/plan/      GET /api/places/search/?q=
   ▼
backend (Django + DRF)          trips/services/
   ├── geocoding.py    Photon (OpenStreetMap) search & reverse geocoding → "City, ST" labels
   ├── routing.py      OSRM route; indexes drive-time ↔ distance ↔ position along the polyline
   ├── hos.py          minute-by-minute HOS simulation → duty-status events
   ├── daily_logs.py   splits events at midnight → log sheet grid, totals, remarks, recap
   └── trip_planner.py orchestrates the above and groups events into map stops
```

All map services are free and keyless: [OSRM](https://project-osrm.org/) for routing,
[Photon](https://photon.komoot.io/) for geocoding and OpenStreetMap tiles.

### HOS rules applied (property-carrying, 70 hr / 8 day)

- 11 hours driving max after 10 consecutive hours off duty (10-hour breaks are logged in the sleeper berth).
- No driving after the 14th hour since coming on duty.
- 30-minute break after 8 cumulative hours of driving (any 30 consecutive non-driving minutes count).
- 70 on-duty hours in 8 days; when exhausted, a 34-hour restart resets the cycle.
- Fuel at least every 1,000 miles (30 min on duty), 1 hour on duty each for pickup and drop-off.
- 15-minute pre-trip and post-trip inspections per shift (on duty), as on a real log.

Assumptions: the driver starts after a full 10-hour break, there are no adverse conditions, drive time follows
OSRM's estimates, and — with no per-day history provided — cycle hours only reset via a 34-hour restart. Times are
in home-terminal time.

## Local development

```bash
# Backend (http://127.0.0.1:8000)
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py runserver

# Frontend (http://localhost:5173, proxies /api to the backend)
cd frontend
npm install
npm run dev
```

## Deploying to Vercel

Create two Vercel projects from this repository:

| Project  | Root directory | Environment variables |
| -------- | -------------- | --------------------- |
| API      | `backend`      | `DJANGO_SECRET_KEY`, `CORS_ALLOWED_ORIGINS=https://<frontend>.vercel.app` (see `backend/.env.example`) |
| Frontend | `frontend`     | `VITE_API_BASE_URL=https://<api>.vercel.app` |

The backend uses Vercel's zero-config Django support (`manage.py` → `config.wsgi.application`); `backend/vercel.json`
only raises the function timeout to 60 s. The frontend is auto-detected as a Vite app.
