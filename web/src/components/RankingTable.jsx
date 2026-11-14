import { useI18n } from '../i18n/index.jsx'

const percent = (fraction) => `${Math.round(fraction * 100)}`
const STATUS_CLASS = { pass: 'text-emerald-300', marginal: 'text-amber-300', fail: 'text-red-300' }

export default function RankingTable({ rows, sortBy, direction, onSort, onSelectRow, currentCellId, mode }) {
  const { t } = useI18n()

  const statusText = {
    pass: t('status.passBadge'),
    marginal: t('status.marginalBadge'),
    fail: t('status.failBadge'),
  }

  const columnsDef = [
    { key: 'distanceKm', label: t('columns.distance'), show: (row) => row.distanceKm.toFixed(1) },
    { key: 'minBatteryFraction', label: t('columns.minBattery'), show: (row) => percent(row.minBatteryFraction) },
    { key: 'longestDarkHours', label: t('columns.longestDark'), show: (row) => row.longestDarkHours },
    { key: 'longestCommLossHours', label: t('columns.longestCommLoss'), show: (row) => row.longestCommLossHours },
    { key: 'fractionSun', label: t('columns.fractionSun'), show: (row) => percent(row.fractionSun), expert: true },
    { key: 'fractionEarth', label: t('columns.fractionEarth'), show: (row) => percent(row.fractionEarth), expert: true },
    { key: 'meanSunElevationDeg', label: t('columns.meanSunElevation'), show: (row) => row.meanSunElevationDeg?.toFixed(2) ?? '—', expert: true },
    { key: 'rechargeHours', label: t('columns.recharge'), show: (row) => row.rechargeHours ?? '—', expert: true },
  ]
  const columns = columnsDef.filter((column) => mode === 'expert' || !column.expert)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm tabular-nums">
        <caption className="mb-2 text-left text-xs text-slate-400">
          {t('results.rankingCaption', { count: rows.length })}{' '}
          {sortBy ? t('results.rankingReversePrompt') : t('results.rankingDefaultOrder')}
        </caption>
        <thead className="text-xs text-slate-400">
          <tr>
            <th scope="col" className="py-1 pr-2 font-normal">{t('columns.rank')}</th>
            <th scope="col" className="py-1 pr-2 font-normal">{t('columns.cell')}</th>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                aria-sort={sortBy === column.key ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                className="py-1 pr-2 font-normal"
              >
                <button type="button" onClick={() => onSort(column.key)} className="rounded px-1 text-left hover:bg-slate-800 hover:text-slate-100">
                  {column.label}
                  {sortBy === column.key ? (direction === 'asc' ? ' ▲' : ' ▼') : ''}
                </button>
              </th>
            ))}
            <th scope="col" className="py-1 font-normal">{t('columns.status')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.cellId} className={`border-t border-slate-800 ${row.cellId === currentCellId ? 'bg-amber-400/10' : ''}`}>
              <td className="py-1.5 pr-2 text-slate-400">{row.rank}</td>
              <td className="py-1.5 pr-2">
                <button type="button" onClick={() => onSelectRow(row)} className="font-mono text-sky-300 underline-offset-2 hover:underline">
                  {row.cellId}
                </button>
                {row.cellId === currentCellId && <span className="ml-1 text-xs text-amber-300">(you)</span>}
              </td>
              {columns.map((column) => (
                <td key={column.key} className="py-1.5 pr-2">{column.show(row)}</td>
              ))}
              <td className={`py-1.5 ${STATUS_CLASS[row.status]}`}>{statusText[row.status]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
