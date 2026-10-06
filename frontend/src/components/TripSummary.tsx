import { CalendarDays, Clock3, Gauge, Route, Timer, Truck } from 'lucide-react'
import { formatDateTime, formatDuration, formatMiles } from '../lib/format'
import { CYCLE_LIMIT_HOURS, STOP_META } from '../lib/meta'
import type { StopType, TripPlan } from '../types'

export default function TripSummary({ plan }: { plan: TripPlan }) {
  const { summary, daily_logs: logs } = plan
  const stats = [
    { icon: Route, label: 'Total distance', value: formatMiles(summary.total_miles), hint: `${plan.route.legs.length} legs` },
    { icon: Truck, label: 'Driving time', value: formatDuration(summary.driving_hours), hint: `${formatDuration(summary.on_duty_hours)} on duty` },
    { icon: Timer, label: 'Total trip time', value: formatDuration(summary.elapsed_hours), hint: 'incl. rests & breaks' },
    { icon: CalendarDays, label: 'Log sheets', value: `${logs.length} ${logs.length === 1 ? 'day' : 'days'}`, hint: 'midnight to midnight' },
    { icon: Clock3, label: 'Drop-off arrival', value: summary.dropoff_arrival ? formatDateTime(summary.dropoff_arrival) : '—', hint: summary.pickup_arrival ? `Pickup ${formatDateTime(summary.pickup_arrival)}` : '' },
    { icon: Gauge, label: 'Cycle used at end', value: `${summary.cycle_hours_used_at_end.toFixed(1)} / ${CYCLE_LIMIT_HOURS} h`, hint: `${Math.max(CYCLE_LIMIT_HOURS - summary.cycle_hours_used_at_end, 0).toFixed(1)} h remaining` },
  ]
  const stopCounts = (Object.entries(summary.stop_counts) as [StopType, number][]).filter(
    ([type, count]) => count > 0 && type !== 'pickup' && type !== 'dropoff',
  )

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
        {stats.map(({ icon: Icon, label, value, hint }) => (
          <div key={label} className="card p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <Icon className="size-4 text-slate-400" /> {label}
            </div>
            <p className="mt-2 text-lg leading-tight font-semibold text-slate-900">{value}</p>
            {hint && <p className="mt-0.5 truncate text-xs text-slate-400">{hint}</p>}
          </div>
        ))}
      </div>
      {stopCounts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {stopCounts.map(([type, count]) => {
            const { label, color, icon: Icon } = STOP_META[type]
            return (
              <span key={type} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                <Icon className="size-3.5" style={{ color }} /> {count} × {label}
              </span>
            )
          })}
        </div>
      )}
    </section>
  )
}
