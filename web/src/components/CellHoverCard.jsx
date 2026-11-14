import { useMemo } from 'react'
import { INFEASIBLE_REASON_TEXT, formatDuration } from '../core/format.js'
import { stayPreview } from '../core/mapSky.js'
import { sparklinePath } from '../core/mapView.js'

const SPARK_WIDTH = 200
const SPARK_HEIGHT = 20

// Mouse-only preview (aria-hidden): keyboard users reach the same cell through the Cell list and the popup.
export default function CellHoverCard({ cell, ephemeris, hour, stayDays }) {
  const preview = useMemo(() => stayPreview(cell, ephemeris, hour, stayDays), [cell, ephemeris, hour, stayDays])
  return (
    <div aria-hidden="true" className="pointer-events-none absolute top-2 right-2 w-56 rounded-lg border border-slate-700 bg-slate-950/90 p-2 text-xs text-slate-200">
      <p className="font-mono text-sm">{cell.id}</p>
      <p className={cell.feasible ? 'text-sky-300' : 'text-slate-400'}>
        {cell.feasible ? 'Feasible' : `Not feasible: ${INFEASIBLE_REASON_TEXT[cell.infeasibleReason]}`}
      </p>
      {preview && (
        <>
          {[['Sun', '#f0e442', preview.sunDiskFraction], ['Earth', '#56b4e9', preview.earthDiskFraction]].map(([name, color, values]) => (
            <div key={name} className="mt-1 flex items-center gap-2">
              <span className="w-10 text-slate-400">{name}</span>
              <svg viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`} preserveAspectRatio="none" className="h-5 flex-1">
                <path d={sparklinePath(values, SPARK_WIDTH, SPARK_HEIGHT)} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
              </svg>
            </div>
          ))}
          <p className="mt-1">
            Next {formatDuration(preview.hourCount)}: Sun in view {Math.round(preview.fractionSun * 100)} %, Earth in view {Math.round(preview.fractionEarth * 100)} %
          </p>
        </>
      )}
      <p className="mt-1 text-slate-400">Slope {cell.slopeDeg.toFixed(1)}°</p>
    </div>
  )
}
