import type { ReactNode } from 'react'
import { formatClockHours } from '../lib/format'
import { CYCLE_LIMIT_HOURS, DUTY_META, DUTY_STATUSES } from '../lib/meta'
import type { DailyLog, LogRemark, LogSheetDetails } from '../types'

const WIDTH = 1100
const HEIGHT = 790
const LEFT = 24
const RIGHT = WIDTH - 24
const GRID_X = 150
const HOUR_WIDTH = 36
const GRID_END_X = GRID_X + 24 * HOUR_WIDTH
const TOTALS_X = (GRID_END_X + RIGHT) / 2
const GRID_TOP = 250
const GRID_HEADER_HEIGHT = 28
const ROW_HEIGHT = 34
const ROWS_TOP = GRID_TOP + GRID_HEADER_HEIGHT
const GRID_BOTTOM = ROWS_TOP + DUTY_STATUSES.length * ROW_HEIGHT
const REMARKS_TOP = GRID_BOTTOM + 34
const REMARKS_BOTTOM = REMARKS_TOP + 190
const RECAP_TOP = REMARKS_BOTTOM + 100

const INK = '#1d4ed8'
const RULE = '#0f172a'
const MUTED = '#475569'
const PEN_FONT = "'JetBrains Mono', ui-monospace, monospace"
const REMARK_GROUP_WINDOW_MINUTES = 60

const minuteX = (minute: number) => GRID_X + (minute / 60) * HOUR_WIDTH
const rowCenterY = (line: number) => ROWS_TOP + (line - 1) * ROW_HEIGHT + ROW_HEIGHT / 2

function hourLabel(hour: number) {
  if (hour === 0 || hour === 24) return ['Mid-', 'night']
  if (hour === 12) return ['Noon']
  return [String(hour % 12)]
}

interface RemarkFlag {
  minute: number
  location: string
  notes: string[]
}

/**
 * Keeps the drawn flags readable: remarks at one place within an hour share a flag, and driving starts from the
 * previous flag's place are left to the grid line. The full list is shown in the table below each sheet.
 */
function remarkFlags(remarks: LogRemark[]): RemarkFlag[] {
  const flags: RemarkFlag[] = []
  for (const remark of remarks) {
    const last = flags.at(-1)
    const samePlace = last?.location === remark.location
    if (samePlace && remark.status === 'driving') continue
    if (last && samePlace && remark.minute - last.minute <= REMARK_GROUP_WINDOW_MINUTES) {
      last.notes.push(remark.note)
    } else {
      flags.push({ minute: remark.minute, location: remark.location, notes: [remark.note] })
    }
  }
  return flags
}

const FLAG_ANGLE_DEGREES = 52
const MAX_FLAG_ANGLE_DEGREES = 80
const FLAG_CHAR_WIDTH = 6
const FLAG_TEXT_OFFSET = 13

/** Flags lean at a fixed angle, steepening only when their text would otherwise run off the right edge. */
function flagAngle(x: number, flag: RemarkFlag) {
  const textLength = FLAG_TEXT_OFFSET + FLAG_CHAR_WIDTH * Math.max(flag.location.length, ...flag.notes.map((note) => note.length))
  const room = WIDTH - 8 - x
  if (textLength * Math.cos((FLAG_ANGLE_DEGREES * Math.PI) / 180) <= room) return FLAG_ANGLE_DEGREES
  return Math.min((Math.acos(Math.min(room / textLength, 1)) * 180) / Math.PI, MAX_FLAG_ANGLE_DEGREES)
}

function Field({ x, y, width, label, value, align = 'middle' }: { x: number; y: number; width: number; label: string; value?: string; align?: 'start' | 'middle' }) {
  const textX = align === 'middle' ? x + width / 2 : x + 4
  return (
    <g>
      <line x1={x} y1={y} x2={x + width} y2={y} stroke={RULE} strokeWidth={1} />
      {value && (
        <text x={textX} y={y - 5} textAnchor={align} fontFamily={PEN_FONT} fontSize={13} fill={INK}>
          {value}
        </text>
      )}
      <text x={x + width / 2} y={y + 12} textAnchor="middle" fontSize={9.5} fill={MUTED}>
        {label}
      </text>
    </g>
  )
}

function Box({ x, y, width, height, label, children }: { x: number; y: number; width: number; height: number; label: string; children?: ReactNode }) {
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill="none" stroke={RULE} strokeWidth={1.2} />
      <text x={x + width / 2} y={y + height / 2 + 5} textAnchor="middle" fontFamily={PEN_FONT} fontSize={15} fill={INK}>
        {children}
      </text>
      <text x={x + width / 2} y={y + height + 13} textAnchor="middle" fontSize={9.5} fill={MUTED}>
        {label}
      </text>
    </g>
  )
}

function GridLines() {
  const ticks = []
  for (let quarter = 0; quarter <= 96; quarter++) {
    const x = GRID_X + (quarter / 4) * HOUR_WIDTH
    if (quarter % 4 === 0) {
      ticks.push(<line key={quarter} x1={x} y1={ROWS_TOP} x2={x} y2={GRID_BOTTOM} stroke={RULE} strokeWidth={quarter % 12 === 0 ? 1.2 : 0.8} />)
      continue
    }
    const length = quarter % 2 === 0 ? ROW_HEIGHT * 0.45 : ROW_HEIGHT * 0.25
    DUTY_STATUSES.forEach((_, row) => {
      const top = ROWS_TOP + row * ROW_HEIGHT
      ticks.push(<line key={`${quarter}-${row}`} x1={x} y1={top} x2={x} y2={top + length} stroke={RULE} strokeWidth={0.6} />)
    })
  }
  return <g>{ticks}</g>
}

interface Props {
  log: DailyLog
  details: LogSheetDetails
}

export default function LogSheet({ log, details }: Props) {
  const [year, month, day] = log.date.split('-')
  const flags = remarkFlags(log.remarks)

  const dutyPath = log.segments
    .map((segment, index) => {
      const y = rowCenterY(DUTY_META[segment.status].line)
      const start = index === 0 ? `M ${minuteX(segment.start_minute)} ${y}` : `V ${y}`
      return `${start} H ${minuteX(segment.end_minute)}`
    })
    .join(' ')

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full bg-white" role="img" aria-label={`Driver's daily log for ${log.date}`} fontFamily="Inter, sans-serif">
      {/* Header */}
      <text x={LEFT} y={44} fontSize={28} fontWeight={700} fill={RULE}>Drivers Daily Log</text>
      <text x={LEFT + 50} y={62} fontSize={10} fill={MUTED}>(24 hours)</text>
      {[['month', month], ['day', day], ['year', year]].map(([label, value], index) => (
        <g key={label}>
          <Field x={330 + index * 92} y={44} width={74} label={`(${label})`} value={value} />
          {index < 2 && <text x={330 + index * 92 + 83} y={42} fontSize={18} textAnchor="middle" fill={RULE}>/</text>}
        </g>
      ))}
      <text x={640} y={30} fontSize={10} fill={MUTED}>Original - File at home terminal.</text>
      <text x={640} y={44} fontSize={10} fill={MUTED}>Duplicate - Driver retains in his/her possession for 8 days.</text>

      <text x={LEFT + 60} y={92} fontSize={12} fontWeight={600} fill={RULE}>From:</text>
      <Field x={LEFT + 100} y={96} width={340} label="" value={log.from_location} align="start" />
      <text x={540} y={92} fontSize={12} fontWeight={600} fill={RULE}>To:</text>
      <Field x={565} y={96} width={340} label="" value={log.to_location} align="start" />

      <Box x={LEFT + 90} y={118} width={150} height={40} label="Total Miles Driving Today">{Math.round(log.miles_driven)}</Box>
      <Box x={LEFT + 250} y={118} width={150} height={40} label="Total Mileage Today">{Math.round(log.miles_driven)}</Box>
      <Box x={LEFT + 90} y={178} width={310} height={36} label="Truck/Tractor and Trailer Numbers or License Plate(s)/State (show each unit)">
        {details.vehicleNumbers}
      </Box>
      <Field x={450} y={140} width={RIGHT - 450} label="Name of Carrier or Carriers" value={details.carrierName} />
      <Field x={450} y={176} width={RIGHT - 450} label="Main Office Address" value={details.mainOfficeAddress} />
      <Field x={450} y={212} width={RIGHT - 450} label="Home Terminal Address" value={details.homeTerminalAddress} />

      {/* Grid header */}
      <rect x={GRID_X - 10} y={GRID_TOP} width={RIGHT - GRID_X + 10} height={GRID_HEADER_HEIGHT} fill={RULE} />
      {Array.from({ length: 25 }, (_, hour) => {
        const lines = hourLabel(hour)
        return (
          <text key={hour} x={GRID_X + hour * HOUR_WIDTH} y={lines.length > 1 ? GRID_TOP + 12 : GRID_TOP + 18} textAnchor="middle" fontSize={hour % 12 === 0 ? 8.5 : 10} fontWeight={600} fill="white">
            {lines.map((line, index) => (
              <tspan key={line} x={GRID_X + hour * HOUR_WIDTH} dy={index === 0 ? 0 : 10}>{line}</tspan>
            ))}
          </text>
        )
      })}
      <text x={TOTALS_X} y={GRID_TOP + 12} textAnchor="middle" fontSize={8.5} fontWeight={600} fill="white">
        <tspan x={TOTALS_X}>Total</tspan>
        <tspan x={TOTALS_X} dy={10}>Hours</tspan>
      </text>

      {/* Grid rows */}
      {DUTY_STATUSES.map((status, row) => {
        const top = ROWS_TOP + row * ROW_HEIGHT
        const { line, label } = DUTY_META[status]
        const [first, ...rest] = label.split(' (')
        return (
          <g key={status}>
            <rect x={GRID_X} y={top} width={GRID_END_X - GRID_X} height={ROW_HEIGHT} fill={row % 2 ? '#f8fafc' : 'white'} stroke={RULE} strokeWidth={1} />
            <text x={LEFT} y={top + (rest.length ? 15 : 21)} fontSize={11} fontWeight={600} fill={RULE}>
              {line}. {first}
              {rest.length > 0 && <tspan x={LEFT + 14} dy={12} fontSize={9.5} fontWeight={400}>({rest.join(' (')}</tspan>}
            </text>
            <line x1={GRID_END_X + 12} y1={top + ROW_HEIGHT - 6} x2={RIGHT - 4} y2={top + ROW_HEIGHT - 6} stroke={RULE} strokeWidth={0.8} />
            <text x={TOTALS_X} y={top + ROW_HEIGHT - 10} textAnchor="middle" fontFamily={PEN_FONT} fontSize={13} fill={INK}>
              {formatClockHours(log.totals_hours[status])}
            </text>
          </g>
        )
      })}
      <GridLines />
      <line x1={GRID_END_X + 12} y1={GRID_BOTTOM + 18} x2={RIGHT - 4} y2={GRID_BOTTOM + 18} stroke={RULE} strokeWidth={0.8} />
      <line x1={GRID_END_X + 12} y1={GRID_BOTTOM + 21} x2={RIGHT - 4} y2={GRID_BOTTOM + 21} stroke={RULE} strokeWidth={0.8} />
      <text x={TOTALS_X} y={GRID_BOTTOM + 14} textAnchor="middle" fontFamily={PEN_FONT} fontSize={13} fontWeight={600} fill={INK}>
        {formatClockHours(Object.values(log.totals_hours).reduce((sum, hours) => sum + hours, 0))}
      </text>

      {/* Duty status line, on-duty brackets and remark flags */}
      <path d={dutyPath} fill="none" stroke={INK} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />
      {log.segments
        .filter((segment) => segment.status === 'on_duty')
        .map((segment) => (
          <path
            key={segment.start_minute}
            d={`M ${minuteX(segment.start_minute)} ${GRID_BOTTOM + 3} v 7 H ${minuteX(segment.end_minute)} v -7`}
            fill="none"
            stroke={INK}
            strokeWidth={1.4}
          />
        ))}
      <text x={LEFT} y={REMARKS_TOP - 6} fontSize={14} fontWeight={700} fill={RULE}>Remarks</text>
      <line x1={LEFT} y1={REMARKS_TOP} x2={LEFT} y2={REMARKS_BOTTOM + 70} stroke={RULE} strokeWidth={3} />
      {flags.map((flag) => {
        const x = minuteX(flag.minute)
        return (
          <g key={flag.minute}>
            <line x1={x} y1={GRID_BOTTOM + 12} x2={x} y2={REMARKS_TOP + 6} stroke={INK} strokeWidth={1.2} />
            <g transform={`translate(${x}, ${REMARKS_TOP + 6}) rotate(${flagAngle(x, flag)})`}>
              <line x1={0} y1={0} x2={10} y2={0} stroke={INK} strokeWidth={1.2} />
              <text x={FLAG_TEXT_OFFSET} y={4} fontFamily={PEN_FONT} fontSize={10.5} fontWeight={600} fill={INK}>{flag.location}</text>
              {flag.notes.map((note, index) => (
                <text key={index} x={FLAG_TEXT_OFFSET} y={16 + index * 11} fontFamily={PEN_FONT} fontSize={9.5} fill={INK}>{note}</text>
              ))}
            </g>
          </g>
        )
      })}

      {/* Shipping documents */}
      <text x={LEFT + 12} y={REMARKS_BOTTOM + 8} fontSize={12} fontWeight={700} fill={RULE}>Shipping Documents:</text>
      <Field x={LEFT + 12} y={REMARKS_BOTTOM + 34} width={220} label="DVL or Manifest No. or" value={details.shippingDocument} align="start" />
      <Field x={LEFT + 12} y={REMARKS_BOTTOM + 64} width={220} label="Shipper & Commodity" value={details.shipperCommodity} align="start" />
      <text x={(GRID_X + RIGHT) / 2 + 60} y={REMARKS_BOTTOM + 40} textAnchor="middle" fontSize={10.5} fill={MUTED}>
        Enter name of place you reported and where released from work and when and where each change of duty occurred.
      </text>
      <text x={(GRID_X + RIGHT) / 2 + 60} y={REMARKS_BOTTOM + 54} textAnchor="middle" fontSize={10.5} fill={MUTED}>
        Use time standard of home terminal.
      </text>

      {/* Recap */}
      <line x1={LEFT} y1={RECAP_TOP - 18} x2={RIGHT} y2={RECAP_TOP - 18} stroke={RULE} strokeWidth={2} />
      <text x={LEFT} y={RECAP_TOP} fontSize={11} fontWeight={700} fill={RULE}>Recap:</text>
      <text x={LEFT} y={RECAP_TOP + 13} fontSize={9.5} fill={MUTED}>Complete at end of day</text>
      {[
        { x: 190, label: ['On duty hours today,', 'Total lines 3 & 4'], value: formatClockHours(log.on_duty_today_hours) },
        { x: 380, label: ['A. Total hours on duty', 'in current 70 hr / 8 day cycle'], value: formatClockHours(log.cycle_hours_used) },
        { x: 570, label: [`B. Total hours available`, `tomorrow (${CYCLE_LIMIT_HOURS} hr minus A)`], value: formatClockHours(log.cycle_hours_available) },
      ].map(({ x, label, value }) => (
        <g key={x}>
          <line x1={x} y1={RECAP_TOP + 4} x2={x + 150} y2={RECAP_TOP + 4} stroke={RULE} strokeWidth={0.8} />
          <text x={x + 75} y={RECAP_TOP} textAnchor="middle" fontFamily={PEN_FONT} fontSize={13} fill={INK}>{value}</text>
          {label.map((text, index) => (
            <text key={text} x={x + 75} y={RECAP_TOP + 18 + index * 12} textAnchor="middle" fontSize={9.5} fill={MUTED}>{text}</text>
          ))}
        </g>
      ))}
      <text x={780} y={RECAP_TOP} fontSize={9.5} fill={MUTED}>Driver signature</text>
      <line x1={780} y1={RECAP_TOP + 26} x2={RIGHT} y2={RECAP_TOP + 26} stroke={RULE} strokeWidth={0.8} />
      {details.driverName && (
        <text x={790} y={RECAP_TOP + 22} fontFamily={PEN_FONT} fontSize={14} fontStyle="italic" fill={INK}>{details.driverName}</text>
      )}
    </svg>
  )
}
