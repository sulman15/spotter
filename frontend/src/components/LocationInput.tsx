import { Loader2, MapPin } from 'lucide-react'
import { useEffect, useId, useState, type KeyboardEvent, type ReactNode } from 'react'
import { searchPlaces } from '../api/client'
import type { LocationValue, Place } from '../types'

const SEARCH_DEBOUNCE_MS = 300
const MIN_QUERY_LENGTH = 3

interface Props {
  label: string
  icon: ReactNode
  placeholder: string
  value: LocationValue
  error?: string
  onChange: (value: LocationValue) => void
}

export default function LocationInput({ label, icon, placeholder, value, error, onChange }: Props) {
  const inputId = useId()
  const listId = `${inputId}-suggestions`
  const [suggestions, setSuggestions] = useState<Place[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const hasCoordinates = value.lat !== undefined
  const query = value.label.trim()
  const searchable = !hasCoordinates && query.length >= MIN_QUERY_LENGTH

  useEffect(() => {
    if (!searchable) return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      try {
        setSuggestions(await searchPlaces(query, controller.signal))
        setActiveIndex(-1)
      } catch {
        // Suggestions are a convenience; typed text is still geocoded when the trip is planned.
        if (!controller.signal.aborted) setSuggestions([])
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query, searchable])

  const select = (place: Place) => {
    onChange({ label: place.label, short_label: place.short_label, lat: place.lat, lon: place.lon })
    setOpen(false)
  }

  const showList = open && searchable && suggestions.length > 0

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!showList) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((index) => (index + step + suggestions.length) % suggestions.length)
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault()
      select(suggestions[activeIndex])
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <label htmlFor={inputId} className="field-label">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400">{icon}</span>
        <input
          id={inputId}
          className="field-input pr-9 pl-10"
          placeholder={placeholder}
          value={value.label}
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-invalid={Boolean(error)}
          onChange={(event) => {
            onChange({ label: event.target.value })
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
        />
        {loading && searchable && <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-slate-400" />}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-[1000] mt-1.5 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
          // Keep focus in the input so choosing a suggestion doesn't blur and close the list first.
          onMouseDown={(event) => event.preventDefault()}
        >
          {suggestions.map((place, index) => (
            <li key={`${place.lat},${place.lon},${index}`} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                className={`flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition ${
                  index === activeIndex ? 'bg-slate-100' : 'hover:bg-slate-50'
                }`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => select(place)}
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-800">{place.label}</span>
                  {place.short_label !== place.label && (
                    <span className="block truncate text-xs text-slate-500">{place.short_label}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
