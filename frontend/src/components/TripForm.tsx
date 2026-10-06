import { ChevronDown, Circle, Clock, Flag, Loader2, Navigation, Package, Sparkles } from 'lucide-react'
import type { FormEvent, ReactNode } from 'react'
import { CYCLE_LIMIT_HOURS } from '../lib/meta'
import type { LocationValue, LogSheetDetails, TripRequest } from '../types'
import LocationInput from './LocationInput'

type LocationKey = 'current_location' | 'pickup_location' | 'dropoff_location'

const LOCATION_FIELDS: { key: LocationKey; label: string; placeholder: string; icon: ReactNode }[] = [
  { key: 'current_location', label: 'Current location', placeholder: 'Where is the truck now?', icon: <Circle className="size-4" /> },
  { key: 'pickup_location', label: 'Pickup location', placeholder: 'Shipper city or address', icon: <Package className="size-4" /> },
  { key: 'dropoff_location', label: 'Drop-off location', placeholder: 'Receiver city or address', icon: <Flag className="size-4" /> },
]

const DETAIL_FIELDS: { key: keyof LogSheetDetails; label: string; placeholder: string }[] = [
  { key: 'driverName', label: 'Driver name', placeholder: 'John Doe' },
  { key: 'carrierName', label: 'Carrier', placeholder: 'Spotter Freight LLC' },
  { key: 'mainOfficeAddress', label: 'Main office address', placeholder: '123 Main St, Dallas, TX' },
  { key: 'homeTerminalAddress', label: 'Home terminal address', placeholder: '456 Depot Rd, Dallas, TX' },
  { key: 'vehicleNumbers', label: 'Truck / trailer numbers', placeholder: 'Tractor 1042 / Trailer 5521' },
  { key: 'shippingDocument', label: 'BOL / manifest no.', placeholder: 'BOL-778812' },
  { key: 'shipperCommodity', label: 'Shipper & commodity', placeholder: "Don's Paper Co. - paper products" },
]

const SAMPLE_TRIP: Pick<TripRequest, LocationKey | 'current_cycle_used'> = {
  current_location: { label: 'Green Bay, WI' },
  pickup_location: { label: 'Chicago, IL' },
  dropoff_location: { label: 'Los Angeles, CA' },
  current_cycle_used: 20,
}

interface Props {
  trip: TripRequest
  details: LogSheetDetails
  loading: boolean
  fieldErrors: Record<string, unknown>
  onTripChange: (trip: TripRequest) => void
  onDetailsChange: (details: LogSheetDetails) => void
  onSubmit: () => void
}

function firstError(errors: unknown): string | undefined {
  if (typeof errors === 'string') return errors
  if (Array.isArray(errors)) return firstError(errors[0])
  if (errors && typeof errors === 'object') return firstError(Object.values(errors)[0])
  return undefined
}

export default function TripForm({ trip, details, loading, fieldErrors, onTripChange, onDetailsChange, onSubmit }: Props) {
  const update = (changes: Partial<TripRequest>) => onTripChange({ ...trip, ...changes })
  const cycleRemaining = Math.max(CYCLE_LIMIT_HOURS - trip.current_cycle_used, 0)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-5 p-5 sm:p-6" noValidate>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Plan a trip</h2>
          <p className="mt-0.5 text-sm text-slate-500">Property-carrying driver · 70 hr / 8 day cycle</p>
        </div>
        <button
          type="button"
          onClick={() => onTripChange({ ...trip, ...SAMPLE_TRIP })}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-navy-700 transition hover:bg-slate-100"
        >
          <Sparkles className="size-3.5" /> Try a sample
        </button>
      </div>

      <div className="relative space-y-4">
        <span className="absolute top-9 bottom-9 left-[1.4rem] w-px border-l border-dashed border-slate-300" aria-hidden />
        {LOCATION_FIELDS.map(({ key, label, placeholder, icon }) => (
          <LocationInput
            key={key}
            label={label}
            placeholder={placeholder}
            icon={icon}
            value={trip[key]}
            error={firstError(fieldErrors[key])}
            onChange={(value: LocationValue) => update({ [key]: value })}
          />
        ))}
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="cycle-used" className="field-label">
            Current cycle used
          </label>
          <span className="text-xs text-slate-500">{cycleRemaining.toFixed(1)} hrs available</span>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={CYCLE_LIMIT_HOURS}
            step={0.5}
            value={trip.current_cycle_used}
            onChange={(event) => update({ current_cycle_used: Number(event.target.value) })}
            className="h-2 flex-1 cursor-pointer accent-navy-800"
            aria-label="Current cycle used slider"
          />
          <div className="relative w-24">
            <input
              id="cycle-used"
              type="number"
              min={0}
              max={CYCLE_LIMIT_HOURS}
              step={0.25}
              value={trip.current_cycle_used}
              aria-invalid={Boolean(fieldErrors.current_cycle_used)}
              onChange={(event) =>
                update({ current_cycle_used: Math.min(Math.max(Number(event.target.value) || 0, 0), CYCLE_LIMIT_HOURS) })
              }
              className="field-input pr-9 text-right"
            />
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-slate-400">hrs</span>
          </div>
        </div>
        {firstError(fieldErrors.current_cycle_used) && (
          <p className="mt-1 text-xs text-red-600">{firstError(fieldErrors.current_cycle_used)}</p>
        )}
      </div>

      <div>
        <label htmlFor="start-time" className="field-label">
          Trip start (home terminal time)
        </label>
        <div className="relative">
          <Clock className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
          <input
            id="start-time"
            type="datetime-local"
            value={trip.start_time}
            onChange={(event) => update({ start_time: event.target.value })}
            className="field-input pl-10"
            aria-invalid={Boolean(fieldErrors.start_time)}
          />
        </div>
      </div>

      <details className="group rounded-xl border border-slate-200 bg-slate-50/60">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-slate-700">
          Log sheet details <span className="text-xs font-normal text-slate-400">optional</span>
          <ChevronDown className="size-4 text-slate-400 transition group-open:rotate-180" />
        </summary>
        <div className="grid gap-3 border-t border-slate-200 p-4">
          {DETAIL_FIELDS.map(({ key, label, placeholder }) => (
            <div key={key}>
              <label htmlFor={`detail-${key}`} className="field-label">
                {label}
              </label>
              <input
                id={`detail-${key}`}
                value={details[key]}
                placeholder={placeholder}
                onChange={(event) => onDetailsChange({ ...details, [key]: event.target.value })}
                className="field-input"
              />
            </div>
          ))}
        </div>
      </details>

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-navy-900/20 transition hover:bg-navy-800 disabled:cursor-wait disabled:opacity-80"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Navigation className="size-4" />}
        {loading ? 'Planning route & logs…' : 'Generate route & ELD logs'}
      </button>
    </form>
  )
}
