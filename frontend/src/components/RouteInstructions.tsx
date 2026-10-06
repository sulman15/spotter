import { ChevronDown, CornerUpRight } from 'lucide-react'
import { formatDistance, formatDuration, formatMiles } from '../lib/format'
import { LEG_COLORS } from '../lib/meta'
import type { TripPlan } from '../types'

export default function RouteInstructions({ plan }: { plan: TripPlan }) {
  const { places } = plan
  const endpoints = [
    [places.current.short_label, places.pickup.short_label],
    [places.pickup.short_label, places.dropoff.short_label],
  ]

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="font-semibold text-slate-900">Route instructions</h3>
        <p className="text-xs text-slate-500">Turn-by-turn directions for each leg (OSRM / OpenStreetMap)</p>
      </div>
      <div className="divide-y divide-slate-100">
        {plan.route.legs.map((leg, index) => (
          <details key={leg.name} className="group" open={index === 1 && leg.instructions.length <= 25}>
            <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 hover:bg-slate-50">
              <span className="h-8 w-1.5 rounded-full" style={{ background: LEG_COLORS[index] }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {leg.name}: {endpoints[index][0]} → {endpoints[index][1]}
                </p>
                <p className="text-xs text-slate-500">
                  {leg.distance_miles > 0
                    ? `${formatMiles(leg.distance_miles)} · ${formatDuration(leg.duration_hours)} driving · ${leg.instructions.length} steps`
                    : 'Already at this location'}
                </p>
              </div>
              <ChevronDown className="size-4 text-slate-400 transition group-open:rotate-180" />
            </summary>
            {leg.instructions.length > 0 && (
              <ol className="max-h-96 overflow-y-auto px-5 pb-4">
                {leg.instructions.map((step, stepIndex) => (
                  <li key={stepIndex} className="flex items-start gap-3 border-b border-slate-50 py-2 last:border-0">
                    <CornerUpRight className="mt-0.5 size-4 shrink-0 text-slate-400" />
                    <span className="flex-1 text-sm text-slate-700">{step.text}</span>
                    <span className="shrink-0 font-mono text-xs text-slate-400">{formatDistance(step.distance_miles)}</span>
                  </li>
                ))}
              </ol>
            )}
          </details>
        ))}
      </div>
    </section>
  )
}
