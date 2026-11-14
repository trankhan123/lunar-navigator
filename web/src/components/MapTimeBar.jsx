import { useEffect, useState } from 'react'
import { timeAtHour } from '../core/data.js'
import { formatUtc } from '../core/format.js'
import { nextPlayHour } from '../core/mapSky.js'

const PLAY_FRAME_MS = 200
const STEP_OPTIONS = [1, 6]
const stepButton = 'rounded px-2 py-1 text-xs transition-colors aria-pressed:bg-slate-700 aria-pressed:text-slate-50 hover:bg-slate-800'

// range: {firstHour, lastHour} ephemeris hours of the scenario dates; the step only changes Play, not dragging.
export default function MapTimeBar({ ephemeris, range, hour, onChange }) {
  const [playing, setPlaying] = useState(false)
  const [stepHours, setStepHours] = useState(1)
  useEffect(() => {
    if (!playing) return
    const timer = setTimeout(() => onChange(nextPlayHour(hour, stepHours, range)), PLAY_FRAME_MS)
    return () => clearTimeout(timer)
  }, [playing, hour, stepHours, range, onChange])

  const timeText = formatUtc(timeAtHour(ephemeris, hour))
  return (
    <div className="mt-2 flex flex-wrap items-center gap-3">
      <button
        type="button"
        aria-pressed={playing}
        onClick={() => setPlaying(!playing)}
        className="w-20 rounded bg-amber-400 px-3 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-300"
      >
        {playing ? 'Pause' : 'Play'}
      </button>
      <label className="min-w-48 flex-1 text-sm text-slate-300">
        Map time <span className="font-semibold tabular-nums text-slate-50">{timeText}</span>
        <input
          type="range"
          min={range.firstHour}
          max={range.lastHour}
          step={1}
          value={hour}
          aria-valuetext={timeText}
          onChange={(event) => onChange(Number(event.target.value))}
          className="block w-full accent-amber-400"
        />
      </label>
      <div role="group" aria-label="Play step" className="flex gap-1 rounded border border-slate-700 p-0.5">
        {STEP_OPTIONS.map((step) => (
          <button key={step} type="button" aria-pressed={stepHours === step} onClick={() => setStepHours(step)} className={stepButton}>
            {step} h
          </button>
        ))}
      </div>
    </div>
  )
}
