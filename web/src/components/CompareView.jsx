import { explainDifference } from '../core/explain.js'
import { cellDisplayName } from '../core/format.js'

const percent = (fraction) => `${Math.round(fraction * 100)} %`
const ROWS = [
  ['Longest dark period', (detail) => `${detail.sunSummary.longestDarkHours} h`],
  ['Time in sunlight', (detail) => percent(detail.sunSummary.fractionSun)],
  ['Longest comm loss', (detail) => `${detail.earthSummary.longestCommLossHours} h`],
  ['Earth in view', (detail) => percent(detail.earthSummary.fractionEarth)],
  ['Lowest battery', (detail) => percent(detail.battery.minBatteryFraction)],
  ['Battery needed for the stay', (detail) => `${(detail.energy.minimumCapacityWh / 1000).toFixed(1)} kWh`],
]

const explainInput = ({ cell, detail }) => ({ cell, metrics: detail.sunSummary, sunTrack: detail.sun, startIndex: 0, lengthHours: detail.stayHours })

// current / other: {cell, detail} for the planner's current point and the cell on screen.
export default function CompareView({ current, other }) {
  return (
    <section aria-labelledby="compare-title" className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm">
      <h3 id="compare-title" className="mb-1 font-medium">Compared with your current point</h3>
      <p className="mb-3 text-slate-200">{explainDifference(explainInput(current), explainInput(other))}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left tabular-nums">
          <thead className="text-slate-400">
            <tr>
              <th scope="col" className="py-1 pr-3 font-normal">Over the stay</th>
              <th scope="col" className="py-1 pr-3 font-normal">{cellDisplayName(current.cell)} (current)</th>
              <th scope="col" className="py-1 font-normal">{cellDisplayName(other.cell)}</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([label, value]) => (
              <tr key={label} className="border-t border-slate-800">
                <th scope="row" className="py-1 pr-3 font-normal text-slate-300">{label}</th>
                <td className="py-1 pr-3">{value(current.detail)}</td>
                <td className="py-1">{value(other.detail)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
