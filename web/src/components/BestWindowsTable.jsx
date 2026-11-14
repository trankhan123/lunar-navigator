import { formatDuration, formatUtc } from '../core/format.js'
import { useI18n } from '../i18n/index.jsx'

export default function BestWindowsTable({ rows, onSelectRow }) {
  const { t } = useI18n()

  const statusText = {
    pass: t('status.passBadge'),
    marginal: t('status.marginalBadge'),
    fail: t('status.failBadge'),
  }

  const headers = [
    t('columns.rank'),
    t('columns.cell'),
    t('columns.windowUtc'),
    t('columns.canSlip'),
    t('columns.bestLanding'),
    t('columns.minBattery'),
    t('columns.longestDark'),
    t('columns.status'),
  ]

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm tabular-nums">
        <caption className="mb-2 text-left text-xs text-slate-400">{t('results.bestWindowsCaption')}</caption>
        <thead className="text-xs text-slate-400">
          <tr>
            {headers.map((label) => (
              <th key={label} scope="col" className="py-1 pr-2 font-normal">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.cellId} className="border-t border-slate-800">
              <td className="py-1.5 pr-2 text-slate-400">{row.rank}</td>
              <td className="py-1.5 pr-2">
                <button type="button" onClick={() => onSelectRow(row)} className="font-mono text-sky-300 underline-offset-2 hover:underline">
                  {row.cellId}
                </button>
              </td>
              <td className="py-1.5 pr-2">{formatUtc(row.windowStartTime)} → {formatUtc(row.windowEndTime)}</td>
              <td className="py-1.5 pr-2">{row.slipHours === 0 ? t('results.noSlack') : formatDuration(row.slipHours)}</td>
              <td className="py-1.5 pr-2">{formatUtc(row.landingTime)}</td>
              <td className="py-1.5 pr-2">{Math.round(row.minBatteryFraction * 100)}</td>
              <td className="py-1.5 pr-2">{row.longestDarkHours}</td>
              <td className="py-1.5">{statusText[row.status] ?? row.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
