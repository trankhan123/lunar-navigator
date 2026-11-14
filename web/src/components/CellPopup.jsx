import { useMemo } from 'react'
import { computeEarthTrack, nextEarthEvent } from '../core/communication.js'
import { timeAtHour } from '../core/data.js'
import { formatDuration, formatUtc } from '../core/format.js'
import { computeSunTrack, nextSunEvent } from '../core/sunlight.js'

const LOOK_AHEAD_HOURS = 30 * 24
const EVENT_WORDS = { sunset: 'sets', sunrise: 'rises', earthset: 'sets', earthrise: 'rises' }
const REASON_TEXT = { slope: 'slope above the limit', psr: 'mostly in permanent shadow' }

function skyAt(cell, ephemeris, hour) {
  if (hour === null) return null
  try {
    const hourCount = Math.min(LOOK_AHEAD_HOURS, ephemeris.hours - hour)
    const sun = computeSunTrack(cell, ephemeris, hour, hourCount, 'auto')
    const earth = computeEarthTrack(cell, ephemeris, hour, hourCount)
    return {
      sun: { elevationDeg: sun.elevationDeg[0], event: nextSunEvent(sun, 0) },
      earth: { elevationDeg: earth.elevationDeg[0], event: nextEarthEvent(earth, 0) },
    }
  } catch {
    return null // shortcut: C1/C2 are still stubs; the sky lines appear once they are implemented
  }
}

function skyLine(name, body) {
  const event = body.event ? `${EVENT_WORDS[body.event.event]} in ${formatDuration(body.event.hoursFromNow)}` : 'no change in the next 30 days'
  return `${name} ${body.elevationDeg.toFixed(1)}° high, ${event}`
}

export default function CellPopup({ cell, ephemeris, hour, onUseAsCurrent, onClose }) {
  const sky = useMemo(() => skyAt(cell, ephemeris, hour), [cell, ephemeris, hour])
  const rows = [
    ['Latitude, longitude', `${cell.lat.toFixed(4)}°, ${cell.lon.toFixed(4)}°`],
    ['Height', `${Math.round(cell.heightM)} m`],
    ['Slope', `${cell.slopeDeg.toFixed(1)}°`],
    ['Permanent shadow', `${Math.round(cell.psrFraction * 100)} % of the cell`],
  ]
  return (
    <section aria-labelledby="cell-title" className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h2 id="cell-title" className="font-mono text-base font-semibold">{cell.id}</h2>
          <p className={cell.feasible ? 'text-sky-300' : 'text-slate-400'}>
            {cell.feasible ? 'Feasible landing cell' : `Not feasible: ${REASON_TEXT[cell.infeasibleReason]}`}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close cell details" className="rounded px-2 text-lg text-slate-400 hover:text-slate-100">
          ×
        </button>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-slate-400">{label}</dt>
            <dd className="tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 border-t border-slate-800 pt-3">
        {sky ? (
          <>
            <p className="text-xs text-slate-400">At {formatUtc(timeAtHour(ephemeris, hour))}</p>
            <p className="text-amber-300">{skyLine('Sun', sky.sun)}</p>
            <p className="text-sky-300">{skyLine('Earth', sky.earth)}</p>
          </>
        ) : (
          <p className="text-xs text-slate-400">Sun and Earth times for this cell appear once the sunlight and communication modules are ready.</p>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => navigator.clipboard?.writeText(cell.id)} className="rounded border border-slate-700 px-3 py-1.5 hover:bg-slate-800">
          Copy ID
        </button>
        <button
          type="button"
          onClick={onUseAsCurrent}
          disabled={!cell.feasible}
          className="rounded bg-sky-600 px-3 py-1.5 font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Use as current point
        </button>
      </div>
    </section>
  )
}
