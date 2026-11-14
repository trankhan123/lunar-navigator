import { formatUtc } from '../core/format.js'
import { useI18n } from '../i18n/index.jsx'

export default function BestPairsTable({ rows, onSelectRow }) {
  const { t } = useI18n()
  const hasWindowDuration = rows.some((row) => row.windowHours != null)

  const statusText = {
    pass: t('status.passBadge'),
    marginal: t('status.marginalBadge'),
    fail: t('status.failBadge'),
  }

  const headers = [
    t('columns.rank'),
    t('columns.cell'),
    hasWindowDuration ? (t('columns.windowSpan') || 'Window (UTC)') : t('columns.landing'),
    ...(hasWindowDuration ? [t('columns.window') || 'Window'] : []),
    t('columns.minBattery'),
    t('columns.longestDark'),
    t('columns.status'),
  ]

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm tabular-nums">
        <caption className="mb-2 text-left text-xs text-slate-400">
          {t('results.bestPairsCaption')}
        </caption>
        <thead className="text-xs text-slate-400">
          <tr>
            {headers.map((label) => (
              <th key={label} scope="col" className="py-1 pr-2 font-normal">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const windowSpan = row.startTime && row.endTime
              ? (row.startTime === row.endTime ? formatUtc(row.startTime) : `${formatUtc(row.startTime)} → ${formatUtc(row.endTime)}`)
              : formatUtc(row.landingTime)

            const formattedDuration = row.windowHours != null
              ? (row.windowHours >= 24 ? `${row.windowHours} h (${(row.windowHours / 24).toFixed(1)} d)` : `${row.windowHours} h`)
              : '—'

            return (
              <tr key={`${row.cellId}-${row.landingIndex ?? row.startStep ?? ''}`} className="border-t border-slate-800">
                <td className="py-1.5 pr-2 text-slate-400">{row.rank}</td>
                <td className="py-1.5 pr-2">
                  <button type="button" onClick={() => onSelectRow(row)} className="font-mono text-sky-300 underline-offset-2 hover:underline">
                    {row.cellId}
                  </button>
                </td>
                <td className="py-1.5 pr-2">{windowSpan}</td>
                {hasWindowDuration && (
                  <td className="py-1.5 pr-2">{formattedDuration}</td>
                )}
                <td className="py-1.5 pr-2">{Math.round(row.minBatteryFraction * 100)}</td>
                <td className="py-1.5 pr-2">{row.longestDarkHours}</td>
                <td className="py-1.5">{statusText[row.status] ?? row.status}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
