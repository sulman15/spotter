import L from 'leaflet'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import { formatDateTime, formatDuration, formatMiles } from '../lib/format'
import { LEG_COLORS, STOP_META } from '../lib/meta'
import type { Stop, StopType, TripPlan } from '../types'

const US_CENTER: [number, number] = [39.5, -98.35]
const MARKER_SIZE = 34

function StopMarker({ stop }: { stop: Stop }) {
  const meta = STOP_META[stop.type]
  // Leaflet accepts a DOM node as divIcon content, so the badge is rendered into it through a portal.
  const [container] = useState(() => document.createElement('div'))
  const icon = useMemo(
    () =>
      L.divIcon({
        html: container,
        className: 'stop-marker',
        iconSize: [MARKER_SIZE, MARKER_SIZE],
        iconAnchor: [MARKER_SIZE / 2, MARKER_SIZE / 2],
        popupAnchor: [0, -MARKER_SIZE / 2],
      }),
    [container],
  )

  return (
    <>
      {createPortal(
        <div
          style={{ background: meta.color, width: MARKER_SIZE, height: MARKER_SIZE }}
          className="flex items-center justify-center rounded-full border-[3px] border-white text-white shadow-lg"
        >
          <meta.icon size={16} strokeWidth={2.5} />
        </div>,
        container,
      )}
      <Marker position={[stop.lat, stop.lon]} icon={icon}>
        <Popup>
          <p className="text-xs font-semibold uppercase" style={{ color: meta.color }}>
            {meta.label} · {formatDuration(stop.duration_hours)}
          </p>
          <p className="font-semibold text-slate-900">{stop.location}</p>
          <p className="text-xs text-slate-500">
            {formatDateTime(stop.arrival)} → {formatDateTime(stop.departure)}
          </p>
          <p className="mt-1 text-xs text-slate-500">{formatMiles(stop.miles_from_start)} from start</p>
          <ul className="mt-1.5 list-disc pl-4 text-xs text-slate-600">
            {stop.activities.map((activity) => (
              <li key={activity.start}>{activity.note}</li>
            ))}
          </ul>
        </Popup>
      </Marker>
    </>
  )
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    // The map's container resizes when results appear, so Leaflet must re-measure before fitting.
    map.invalidateSize()
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [40, 40] })
  }, [map, points])
  return null
}

export default function RouteMap({ plan }: { plan: TripPlan | null }) {
  const allPoints = useMemo(() => plan?.route.legs.flatMap((leg) => leg.geometry) ?? [], [plan])

  return (
    <div className="relative h-full min-h-[420px] overflow-hidden rounded-2xl">
      <MapContainer center={US_CENTER} zoom={4} scrollWheelZoom className="h-full min-h-[420px] w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        {plan && (
          <>
            <FitBounds points={allPoints} />
            {plan.route.legs.map((leg, index) => (
              <Polyline
                key={leg.name}
                positions={leg.geometry}
                pathOptions={{ color: LEG_COLORS[index], weight: 5, opacity: 0.9, dashArray: index === 0 ? '8 8' : undefined }}
              />
            ))}
            {plan.stops.map((stop) => (
              <StopMarker key={`${stop.type}-${stop.arrival}`} stop={stop} />
            ))}
          </>
        )}
      </MapContainer>

      {plan && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-[500] flex flex-wrap gap-x-3 gap-y-1 rounded-xl bg-white/95 px-3 py-2 text-[11px] font-medium text-slate-600 shadow-md backdrop-blur">
          {plan.route.legs.map((leg, index) => (
            <span key={leg.name} className="flex items-center gap-1.5">
              <span className="h-1 w-4 rounded" style={{ background: LEG_COLORS[index] }} /> {leg.name}
            </span>
          ))}
          {(Object.keys(STOP_META) as StopType[])
            .filter((type) => plan.stops.some((stop) => stop.type === type))
            .map((type) => (
              <span key={type} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ background: STOP_META[type].color }} />
                {STOP_META[type].label}
              </span>
            ))}
        </div>
      )}
    </div>
  )
}
