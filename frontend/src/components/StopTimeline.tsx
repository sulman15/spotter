import { Truck } from 'lucide-react'
import { Fragment } from 'react'
import { formatDateTime, formatDuration, formatMiles, parseLocal } from '../lib/format'
import { STOP_META } from '../lib/meta'
import type { TripPlan } from '../types'

const hoursBetween = (from: string, to: string) => (parseLocal(to).getTime() - parseLocal(from).getTime()) / 3_600_000

export default function StopTimeline({ plan }: { plan: TripPlan }) {
  return (
    <div className="card flex h-full flex-col overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="font-semibold text-slate-900">Itinerary</h3>
        <p className="text-xs text-slate-500">Every stop required by HOS rules, in order</p>
      </div>
      <ol className="flex-1 overflow-y-auto px-5 py-4">
        {plan.stops.map((stop, index) => {
          const meta = STOP_META[stop.type]
          const previous = plan.stops[index - 1]
          return (
            <Fragment key={`${stop.type}-${stop.arrival}`}>
              {previous && (
                <li className="flex gap-3">
                  <div className="flex w-8 justify-center">
                    <span className="w-px bg-slate-200" />
                  </div>
                  <p className="flex items-center gap-1.5 py-2.5 text-xs text-slate-400">
                    <Truck className="size-3.5" />
                    Drive {formatDuration(hoursBetween(previous.departure, stop.arrival))} ·{' '}
                    {formatMiles(stop.miles_from_start - previous.miles_from_start)}
                  </p>
                </li>
              )}
              <li className="flex gap-3">
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
                  style={{ background: meta.color }}
                >
                  <meta.icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{meta.label}</p>
                    <span className="shrink-0 text-xs font-medium text-slate-500">{formatDuration(stop.duration_hours)}</span>
                  </div>
                  <p className="truncate text-sm text-slate-600">{stop.location}</p>
                  <p className="text-xs text-slate-400">
                    {formatDateTime(stop.arrival)} → {formatDateTime(stop.departure)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{stop.activities.map((activity) => activity.note).join(' · ')}</p>
                </div>
              </li>
            </Fragment>
          )
        })}
      </ol>
    </div>
  )
}
