import type { Place, TripPlan, TripRequest } from '../types'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export class ApiError extends Error {
  fieldErrors: Record<string, unknown>

  constructor(message: string, fieldErrors: Record<string, unknown> = {}) {
    super(message)
    this.fieldErrors = fieldErrors
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error
    throw new ApiError("Can't reach the trip planning service. Check your connection and try again.")
  }

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ApiError(body.detail ?? 'Something went wrong. Please try again.', body.errors)
  }
  return body as T
}

export function planTrip(trip: TripRequest) {
  return request<TripPlan>('/api/trips/plan/', { method: 'POST', body: JSON.stringify(trip) })
}

export async function searchPlaces(query: string, signal: AbortSignal) {
  const { results } = await request<{ results: Place[] }>(
    `/api/places/search/?q=${encodeURIComponent(query)}`,
    { signal },
  )
  return results
}
