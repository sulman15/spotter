import { AlertCircle, Loader2, ShieldCheck, Truck, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { ApiError, planTrip } from './api/client'
import LogSheets from './components/LogSheets'
import RouteInstructions from './components/RouteInstructions'
import RouteMap from './components/RouteMap'
import StopTimeline from './components/StopTimeline'
import TripForm from './components/TripForm'
import TripSummary from './components/TripSummary'
import { todayAt } from './lib/format'
import type { LogSheetDetails, TripPlan, TripRequest } from './types'

const HOS_RULES = [
  '11 hrs driving max after 10 consecutive hrs off duty',
  'No driving beyond the 14th hour after coming on duty',
  '30-min break after 8 cumulative hrs of driving',
  '70 hrs on duty in 8 days; 34-hr restart resets the cycle',
  'Fuel at least every 1,000 miles (30 min on duty)',
  '1 hr on duty for pickup and for drop-off',
  '15-min pre-trip and post-trip inspections each shift',
]

const INITIAL_TRIP: TripRequest = {
  current_location: { label: '' },
  pickup_location: { label: '' },
  dropoff_location: { label: '' },
  current_cycle_used: 0,
  start_time: todayAt(8),
}

const EMPTY_DETAILS: LogSheetDetails = {
  driverName: '',
  carrierName: '',
  mainOfficeAddress: '',
  homeTerminalAddress: '',
  vehicleNumbers: '',
  shippingDocument: '',
  shipperCommodity: '',
}

export default function App() {
  const [trip, setTrip] = useState(INITIAL_TRIP)
  const [details, setDetails] = useState(EMPTY_DETAILS)
  const [plan, setPlan] = useState<TripPlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  const handleSubmit = async () => {
    const missing = (['current_location', 'pickup_location', 'dropoff_location'] as const).filter((key) => !trip[key].label.trim())
    if (missing.length > 0) {
      setError(new ApiError('Please enter all three locations.', Object.fromEntries(missing.map((key) => [key, ['This field is required.']]))))
      return
    }

    setLoading(true)
    setError(null)
    try {
      setPlan(await planTrip(trip))
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError('Something went wrong. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen">
      <header className="no-print bg-navy-900 text-white">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-amber-400 text-navy-900">
              <Truck className="size-5" />
            </span>
            <div>
              <p className="text-base leading-tight font-semibold">Spotter ELD</p>
              <p className="text-xs text-slate-300">Trip planner & daily log generator</p>
            </div>
          </div>
          <span className="hidden items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 sm:inline-flex">
            <ShieldCheck className="size-4 text-emerald-400" /> FMCSA Hours of Service · 49 CFR Part 395
          </span>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1600px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="no-print space-y-4 lg:sticky lg:top-6 lg:self-start">
          <TripForm
            trip={trip}
            details={details}
            loading={loading}
            fieldErrors={error?.fieldErrors ?? {}}
            onTripChange={setTrip}
            onDetailsChange={setDetails}
            onSubmit={handleSubmit}
          />
          <div className="card p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ShieldCheck className="size-4 text-emerald-600" /> Rules applied
            </h3>
            <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
              {HOS_RULES.map((rule) => (
                <li key={rule} className="flex gap-2">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-slate-400" /> {rule}
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <div ref={resultsRef} className="min-w-0 scroll-mt-6 space-y-6">
          {error && (
            <div role="alert" className="no-print flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <p className="flex-1">{error.message}</p>
              <button type="button" onClick={() => setError(null)} aria-label="Dismiss error" className="text-red-500 hover:text-red-700">
                <X className="size-4" />
              </button>
            </div>
          )}

          {plan && (
            <div className="no-print">
              <TripSummary plan={plan} />
            </div>
          )}

          <div className={`no-print grid gap-6 ${plan ? 'xl:grid-cols-[minmax(0,1fr)_360px]' : ''}`}>
            <div className="card relative h-[520px] p-1.5">
              <RouteMap plan={plan} />
              {!plan && !loading && (
                <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center p-6">
                  <div className="max-w-sm rounded-2xl bg-white/95 p-6 text-center shadow-xl backdrop-blur">
                    <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-navy-900 text-amber-400">
                      <Truck className="size-6" />
                    </span>
                    <h2 className="mt-4 text-lg font-semibold text-slate-900">Plan a compliant trip</h2>
                    <p className="mt-1.5 text-sm text-slate-500">
                      Enter where the truck is, the pickup and the drop-off. We&apos;ll route it, schedule every required break,
                      rest and fuel stop, and fill out your daily log sheets.
                    </p>
                  </div>
                </div>
              )}
              {loading && (
                <div className="absolute inset-0 z-[500] flex items-center justify-center rounded-2xl bg-white/60 backdrop-blur-sm">
                  <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-lg">
                    <Loader2 className="size-4 animate-spin text-navy-800" /> Routing & applying HOS rules…
                  </div>
                </div>
              )}
            </div>
            {plan && (
              <div className="h-[520px]">
                <StopTimeline plan={plan} />
              </div>
            )}
          </div>

          {plan && (
            <>
              <div className="no-print">
                <RouteInstructions plan={plan} />
              </div>
              <LogSheets logs={plan.daily_logs} details={details} />
            </>
          )}
        </div>
      </main>

      <footer className="no-print mx-auto max-w-[1600px] px-6 pb-8 text-center text-xs text-slate-400">
        Routing by OSRM · Geocoding by Photon · Map data © OpenStreetMap contributors. Planning aid only — always verify against
        your ELD.
      </footer>
    </div>
  )
}
