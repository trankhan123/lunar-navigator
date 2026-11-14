const percent = (fraction) => `${Math.round(fraction * 100)}`
const STATUS_TEXT = { pass: '✓ Pass', marginal: '! Low battery', fail: '✕ Fail' }
const STATUS_CLASS = { pass: 'text-emerald-300', marginal: 'text-amber-300', fail: 'text-red-300' }
const COLUMNS = [
  { key: 'distanceKm', label: 'Distance (km)', show: (row) => row.distanceKm.toFixed(1) },
  { key: 'minBatteryFraction', label: 'Lowest battery (%)', show: (row) => percent(row.minBatteryFraction) },
  { key: 'longestDarkHours', label: 'Longest dark (h)', show: (row) => row.longestDarkHours },
  { key: 'longestCommLossHours', label: 'Longest comm loss (h)', show: (row) => row.longestCommLossHours },
  { key: 'fractionSun', label: 'Sun (%)', show: (row) => percent(row.fractionSun), expert: true },
  { key: 'fractionEarth', label: 'Earth (%)', show: (row) => percent(row.fractionEarth), expert: true },
  { key: 'meanSunElevationDeg', label: 'Mean Sun elevation (°)', show: (row) => row.meanSunElevationDeg?.toFixed(2) ?? '—', expert: true },
  { key: 'rechargeHours', label: 'Recharge (h)', show: (row) => row.rechargeHours ?? '—', expert: true },
]

export default function RankingTable({ rows, sortBy, direction, onSort, onSelectRow, currentCellId, currentPointName, mode }) {
  const columns = COLUMNS.filter((column) => mode === 'expert' || !column.expert)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm tabular-nums">
        <caption className="mb-2 text-left text-xs text-slate-400">
          Top {rows.length} cells at this landing time. {sortBy ? 'Click a heading again to reverse.' : 'Default order: pass first, then higher lowest battery, more Sun + Earth together, nearer, shorter comm loss.'}
        </caption>
        <thead className="text-xs text-slate-400">
          <tr>
            <th scope="col" className="py-1 pr-2 font-normal">#</th>
            <th scope="col" className="py-1 pr-2 font-normal">Cell</th>
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
            <th scope="col" className="py-1 font-normal">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.cellId} className={`border-t border-slate-800 ${row.cellId === currentCellId ? 'bg-amber-400/10' : ''}`}>
              <td className="py-1.5 pr-2 text-slate-400">{row.rank}</td>
              <td className="py-1.5 pr-2">
                <button type="button" onClick={() => onSelectRow(row)} className="font-mono text-sky-300 underline-offset-2 hover:underline">
                  {row.cellId === currentCellId && currentPointName ? currentPointName : row.cellId}
                </button>
                {row.cellId === currentCellId && <span className="ml-1 text-xs text-amber-300">(you)</span>}
              </td>
              {columns.map((column) => (
                <td key={column.key} className="py-1.5 pr-2">{column.show(row)}</td>
              ))}
              <td className={`py-1.5 ${STATUS_CLASS[row.status]}`}>{STATUS_TEXT[row.status]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
