import { useEffect, useMemo, useRef, useState } from 'react'
import { computeEarthTrack, nextEarthEvent } from '../core/communication.js'
import { timeAtHour } from '../core/data.js'
import { INFEASIBLE_REASON_TEXT, formatDuration, formatUtc } from '../core/format.js'
import { computeSunTrack, nextSunEvent } from '../core/sunlight.js'

const LOOK_AHEAD_HOURS = 30 * 24
const EVENT_WORDS = { sunset: 'sets', sunrise: 'rises', earthset: 'sets', earthrise: 'rises' }

function skyAt(cell, ephemeris, hour) {
  if (hour === null) return null
  const lookAheadHours = Math.min(LOOK_AHEAD_HOURS, ephemeris.hours - hour)
  const sun = computeSunTrack(cell, ephemeris, hour, lookAheadHours, 'auto')
  const earth = computeEarthTrack(cell, ephemeris, hour, lookAheadHours)
  return {
    lookAheadHours,
    sun: { elevationDeg: sun.elevationDeg[0], event: nextSunEvent(sun, 0) },
    earth: { elevationDeg: earth.elevationDeg[0], event: nextEarthEvent(earth, 0) },
  }
}

function skyLine(name, body, lookAheadHours) {
  const event = body.event
    ? `${EVENT_WORDS[body.event.event]} in ${formatDuration(body.event.hoursFromNow)}`
    : `no change in the next ${formatDuration(lookAheadHours)}`
  return `${name} ${body.elevationDeg.toFixed(1)}° high, ${event}`
}

// App renders this with key={cell.id}, so the "Copied" state resets and the popup scrolls into view per cell.
export default function CellPopup({ cell, ephemeris, hour, isCurrent, onUseAsCurrent, onOpenDetail, onClose }) {
  const sky = useMemo(() => skyAt(cell, ephemeris, hour), [cell, ephemeris, hour])
  const [copyMessage, setCopyMessage] = useState('')
  const sectionRef = useRef(null)
  useEffect(() => {
    sectionRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) // returns a Promise in new Chrome: never return it
  }, [])

  function copyId() {
    const copying = navigator.clipboard?.writeText(cell.id) ?? Promise.reject(new Error('no clipboard'))
    copying.then(() => setCopyMessage('Copied')).catch(() => setCopyMessage('Copy failed: select the ID above'))
  }

  const rows = [
    ['Latitude, longitude', `${cell.lat.toFixed(4)}°, ${cell.lon.toFixed(4)}°`],
    ['Height', `${Math.round(cell.heightM)} m`],
    ['Slope', `${cell.slopeDeg.toFixed(1)}°`],
    ['Permanent shadow', `${Math.round(cell.psrFraction * 100)} % of the cell`],
  ]
  return (
    <section ref={sectionRef} aria-labelledby="cell-title" className="scroll-mt-4 rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h2 id="cell-title" className="font-mono text-base font-semibold">{cell.id}</h2>
          <p className={cell.feasible ? 'text-sky-300' : 'text-slate-300'}>
            {cell.feasible ? 'Feasible landing cell' : `Not feasible: ${INFEASIBLE_REASON_TEXT[cell.infeasibleReason]}`}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close cell details" className="-mr-2 -mt-2 grid size-10 place-items-center rounded text-xl text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100">
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
            <p className="text-amber-300">{skyLine('Sun', sky.sun, sky.lookAheadHours)}</p>
            <p className="text-sky-300">{skyLine('Earth', sky.earth, sky.lookAheadHours)}</p>
          </>
        ) : (
          <p className="text-xs text-slate-400">
            Pick a landing date between {formatUtc(timeAtHour(ephemeris, 0)).slice(0, 10)} and {formatUtc(timeAtHour(ephemeris, ephemeris.hours - 1)).slice(0, 10)} to
            see the Sun and Earth from this cell.
          </p>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2" aria-live="polite">
        <button type="button" onClick={copyId} className="rounded border border-slate-500 px-3 py-2 transition-colors hover:bg-slate-800">
          Copy ID
        </button>
        <button
          type="button"
          onClick={onUseAsCurrent}
          disabled={isCurrent}
          className="rounded bg-sky-700 px-3 py-2 font-medium text-white transition-colors hover:bg-sky-800 disabled:cursor-default disabled:opacity-60"
        >
          {isCurrent ? 'This is your current point' : 'Use as current point'}
        </button>
        <button type="button" onClick={onOpenDetail} className="rounded border border-slate-500 px-3 py-2 transition-colors hover:bg-slate-800">
          Open details
        </button>
        {copyMessage && <span className="text-xs text-slate-300">{copyMessage}</span>}
      </div>
      {!cell.feasible && <p className="mt-2 text-xs text-slate-400">You can still use it as your current point to find the nearest good cells.</p>}
    </section>
  )
}
