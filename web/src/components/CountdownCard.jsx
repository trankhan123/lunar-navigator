import { nextEarthEvent } from '../core/communication.js'
import { countdownText } from '../core/format.js'
import { VISIBLE_THRESHOLD } from '../core/geometry.js'
import { nextSunEvent } from '../core/sunlight.js'

const BODIES = [
  { body: 'sun', name: 'Sun', nextEvent: nextSunEvent, box: 'border-amber-500/40 bg-amber-500/10', accent: 'text-amber-200' },
  { body: 'earth', name: 'Earth', nextEvent: nextEarthEvent, box: 'border-sky-500/40 bg-sky-500/10', accent: 'text-sky-200' },
]

export default function CountdownCard({ sunTrack, earthTrack, atIndex, trackHours }) {
  const hoursLeft = trackHours - 1 - atIndex
  return (
    <section aria-label="Countdown to the next sunset and Earthset" className="grid gap-3 sm:grid-cols-2">
      {BODIES.map(({ body, name, nextEvent, box, accent }) => {
        const track = body === 'sun' ? sunTrack : earthTrack
        const isVisible = track.diskFraction[atIndex] >= VISIBLE_THRESHOLD
        return (
          <div key={body} className={`rounded-lg border p-4 ${box}`}>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-300">
              {name} · {isVisible ? (body === 'sun' ? 'shining' : 'in view') : body === 'sun' ? 'below the horizon' : 'hidden'}
            </p>
            <p className={`mt-1 text-2xl font-semibold ${accent}`}>{countdownText(body, nextEvent(track, atIndex), isVisible, hoursLeft)}</p>
            <p className="mt-2 text-sm text-slate-300">
              Elevation <span className="text-3xl font-bold tabular-nums text-slate-50">{track.elevationDeg[atIndex].toFixed(1)}°</span>
            </p>
          </div>
        )
      })}
    </section>
  )
}
