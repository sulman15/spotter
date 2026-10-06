export type DutyStatus = 'off_duty' | 'sleeper_berth' | 'driving' | 'on_duty'
export type StopType = 'start' | 'pickup' | 'dropoff' | 'fuel' | 'break' | 'rest' | 'restart'

export interface Place {
  lat: number
  lon: number
  label: string
  short_label: string
}

/** A location field: free text until the user picks a suggestion, which adds coordinates. */
export interface LocationValue {
  label: string
  short_label?: string
  lat?: number
  lon?: number
}

export interface TripRequest {
  current_location: LocationValue
  pickup_location: LocationValue
  dropoff_location: LocationValue
  current_cycle_used: number
  start_time: string
}

export interface Instruction {
  text: string
  distance_miles: number
  duration_hours: number
}

export interface RouteLeg {
  name: string
  distance_miles: number
  duration_hours: number
  geometry: [number, number][]
  instructions: Instruction[]
}

export interface Stop {
  type: StopType
  lat: number
  lon: number
  location: string
  arrival: string
  departure: string
  duration_hours: number
  miles_from_start: number
  activities: { status: DutyStatus; note: string; start: string; end: string }[]
}

export interface LogSegment {
  status: DutyStatus
  start_minute: number
  end_minute: number
}

export interface LogRemark {
  minute: number
  time: string
  status: DutyStatus
  location: string
  note: string
}

export interface DailyLog {
  date: string
  from_location: string
  to_location: string
  segments: LogSegment[]
  remarks: LogRemark[]
  totals_hours: Record<DutyStatus, number>
  miles_driven: number
  on_duty_today_hours: number
  cycle_hours_used: number
  cycle_hours_available: number
}

export interface TripSummary {
  total_miles: number
  driving_hours: number
  on_duty_hours: number
  trip_start: string
  trip_end: string
  elapsed_hours: number
  pickup_arrival: string | null
  dropoff_arrival: string | null
  cycle_hours_used_at_end: number
  stop_counts: Record<StopType, number>
}

export interface TripPlan {
  places: { current: Place; pickup: Place; dropoff: Place }
  route: { distance_miles: number; duration_hours: number; legs: RouteLeg[] }
  stops: Stop[]
  summary: TripSummary
  daily_logs: DailyLog[]
}

/** Optional details printed on every log sheet header; never sent to the API. */
export interface LogSheetDetails {
  driverName: string
  carrierName: string
  mainOfficeAddress: string
  homeTerminalAddress: string
  vehicleNumbers: string
  shippingDocument: string
  shipperCommodity: string
}
