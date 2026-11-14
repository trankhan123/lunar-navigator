import { useEffect, useState } from 'react'
import { formatUtc } from '../core/format.js'

const PLAY_STEP_MS = 300

export default function LandingTimeSlider({ landingTimes, value, onChange }) {
  const [playing, setPlaying] = useState(false)
  useEffect(() => {
    if (!playing) return
    const timer = setTimeout(() => onChange((value + 1) % landingTimes.length), PLAY_STEP_MS)
    return () => clearTimeout(timer)
  }, [playing, value, landingTimes.length, onChange])

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        aria-pressed={playing}
        onClick={() => setPlaying(!playing)}
        className="w-20 rounded bg-amber-400 px-3 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-300"
      >
        {playing ? 'Pause' : 'Play'}
      </button>
      <label className="flex-1 text-sm text-slate-300">
        Landing time <span className="font-semibold tabular-nums text-slate-50">{formatUtc(landingTimes[value])}</span>{' '}
        <span className="tabular-nums text-slate-400">
          ({value + 1} of {landingTimes.length}, every 6 h)
        </span>
        <input
          type="range"
          min={0}
          max={landingTimes.length - 1}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="block w-full accent-amber-400"
        />
      </label>
    </div>
  )
}
