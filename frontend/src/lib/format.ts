/** API timestamps are naive home-terminal times, so parse them as local wall-clock values. */
export const parseLocal = (iso: string) => new Date(iso)

export function formatDuration(hours: number) {
  const totalMinutes = Math.round(hours * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

/** "8:30" style hours used in the log sheet totals column. */
export function formatClockHours(hours: number) {
  const totalMinutes = Math.round(hours * 60)
  return `${Math.floor(totalMinutes / 60)}:${String(totalMinutes % 60).padStart(2, '0')}`
}

export function formatMiles(miles: number) {
  return `${Math.round(miles).toLocaleString()} mi`
}

export function formatDistance(miles: number) {
  return miles < 0.2 ? `${Math.round(miles * 5280).toLocaleString()} ft` : `${miles.toFixed(1)} mi`
}

export function formatDateTime(iso: string) {
  return parseLocal(iso).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function formatTime(iso: string) {
  return parseLocal(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function formatLongDate(isoDate: string) {
  return new Date(`${isoDate}T00:00`).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

/** Value for a `datetime-local` input: today at the given hour. */
export function todayAt(hour: number) {
  const date = new Date()
  date.setHours(hour, 0, 0, 0)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(hour)}:00`
}
