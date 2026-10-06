import { BedDouble, Coffee, Flag, Fuel, MapPin, Moon, Package, type LucideIcon } from 'lucide-react'
import type { DutyStatus, StopType } from '../types'

export const CYCLE_LIMIT_HOURS = 70

interface DutyMeta {
  label: string
  line: number
  color: string
}

export const DUTY_STATUSES: DutyStatus[] = ['off_duty', 'sleeper_berth', 'driving', 'on_duty']

export const DUTY_META: Record<DutyStatus, DutyMeta> = {
  off_duty: { label: 'Off Duty', line: 1, color: '#64748b' },
  sleeper_berth: { label: 'Sleeper Berth', line: 2, color: '#6366f1' },
  driving: { label: 'Driving', line: 3, color: '#10b981' },
  on_duty: { label: 'On Duty (not driving)', line: 4, color: '#f59e0b' },
}

interface StopMeta {
  label: string
  color: string
  icon: LucideIcon
}

export const STOP_META: Record<StopType, StopMeta> = {
  start: { label: 'Start', color: '#0b1b33', icon: MapPin },
  pickup: { label: 'Pickup', color: '#2563eb', icon: Package },
  dropoff: { label: 'Drop-off', color: '#dc2626', icon: Flag },
  fuel: { label: 'Fuel stop', color: '#ea580c', icon: Fuel },
  break: { label: '30-min break', color: '#0891b2', icon: Coffee },
  rest: { label: '10-hr rest', color: '#6366f1', icon: BedDouble },
  restart: { label: '34-hr restart', color: '#7c3aed', icon: Moon },
}

export const LEG_COLORS = ['#94a3b8', '#2563eb']
