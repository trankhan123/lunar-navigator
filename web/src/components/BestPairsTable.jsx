import { formatUtc } from '../core/format.js'

const STATUS_TEXT = { pass: '✓ Pass', marginal: '! Low battery', fail: '✕ Fail' }

export default function BestPairsTable({ rows, onSelectRow }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm tabular-nums">
        <caption className="mb-2 text-left text-xs text-slate-400">Best cell and landing time pairs over the whole date range.</caption>
        <thead className="text-xs text-slate-400">
          <tr>
            {['#', 'Cell', 'Landing (UTC)', 'Lowest battery (%)', 'Longest dark (h)', 'Status'].map((label) => (
              <th key={label} scope="col" className="py-1 pr-2 font-normal">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.cellId}-${row.landingIndex}`} className="border-t border-slate-800">
              <td className="py-1.5 pr-2 text-slate-400">{row.rank}</td>
              <td className="py-1.5 pr-2">
                <button type="button" onClick={() => onSelectRow(row)} className="font-mono text-sky-300 underline-offset-2 hover:underline">
                  {row.cellId}
                </button>
              </td>
              <td className="py-1.5 pr-2">{formatUtc(row.landingTime)}</td>
              <td className="py-1.5 pr-2">{Math.round(row.minBatteryFraction * 100)}</td>
              <td className="py-1.5 pr-2">{row.longestDarkHours}</td>
              <td className="py-1.5">{STATUS_TEXT[row.status]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
