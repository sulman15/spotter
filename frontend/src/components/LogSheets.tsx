import { Printer } from 'lucide-react'
import { useState } from 'react'
import { formatClockHours, formatLongDate } from '../lib/format'
import { DUTY_META, DUTY_STATUSES } from '../lib/meta'
import type { DailyLog, LogSheetDetails } from '../types'
import LogSheet from './LogSheet'

interface Props {
  logs: DailyLog[]
  details: LogSheetDetails
}

export default function LogSheets({ logs, details }: Props) {
  const [selected, setSelected] = useState(0)
  const active = Math.min(selected, logs.length - 1)

  return (
    <section className="space-y-4">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Daily log sheets</h2>
          <p className="text-sm text-slate-500">
            {logs.length} {logs.length === 1 ? 'sheet' : 'sheets'} · each covers midnight to midnight in home-terminal time
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <Printer className="size-4" /> Print / save PDF
        </button>
      </div>

      <div className="no-print flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Log sheet day">
        {logs.map((log, index) => (
          <button
            key={log.date}
            type="button"
            role="tab"
            aria-selected={index === active}
            onClick={() => setSelected(index)}
            className={`shrink-0 rounded-xl border px-4 py-2 text-left transition ${
              index === active ? 'border-navy-900 bg-navy-900 text-white shadow-md' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            }`}
          >
            <span className="block text-xs font-semibold uppercase opacity-70">Day {index + 1}</span>
            <span className="block text-sm font-medium">
              {new Date(`${log.date}T00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </button>
        ))}
      </div>

      {logs.map((log, index) => (
        <article key={log.date} className={`print-sheet card overflow-hidden ${index === active ? '' : 'hidden print:block'}`}>
          <header className="no-print flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
            <p className="font-semibold text-slate-900">
              Day {index + 1} of {logs.length} · <span className="font-normal text-slate-600">{formatLongDate(log.date)}</span>
            </p>
            <p className="text-sm text-slate-500">{Math.round(log.miles_driven).toLocaleString()} miles driven</p>
          </header>

          <div className="overflow-x-auto p-3 sm:p-5">
            <div className="min-w-[760px]">
              <LogSheet log={log} details={details} />
            </div>
          </div>

          <div className="no-print grid gap-5 border-t border-slate-100 p-5 lg:grid-cols-[260px_1fr]">
            <ul className="space-y-2">
              {DUTY_STATUSES.map((status) => (
                <li key={status} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-600">
                    <span className="size-2.5 rounded-full" style={{ background: DUTY_META[status].color }} />
                    {DUTY_META[status].line}. {DUTY_META[status].label}
                  </span>
                  <span className="font-mono font-medium text-slate-900">{formatClockHours(log.totals_hours[status])}</span>
                </li>
              ))}
            </ul>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-slate-400 uppercase">
                  <tr>
                    <th className="pb-2 font-semibold">Time</th>
                    <th className="pb-2 font-semibold">Status</th>
                    <th className="pb-2 font-semibold">Location</th>
                    <th className="pb-2 font-semibold">Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {log.remarks.map((remark) => (
                    <tr key={`${remark.minute}-${remark.status}`}>
                      <td className="py-1.5 pr-3 font-mono text-slate-700">{remark.time}</td>
                      <td className="py-1.5 pr-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-slate-600">
                          <span className="size-2 rounded-full" style={{ background: DUTY_META[remark.status].color }} />
                          {DUTY_META[remark.status].label}
                        </span>
                      </td>
                      <td className="py-1.5 pr-3 text-slate-700">{remark.location}</td>
                      <td className="py-1.5 text-slate-500">{remark.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </article>
      ))}
    </section>
  )
}
