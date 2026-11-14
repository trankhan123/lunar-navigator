import { directionText } from '../core/mapSky.js'

const BODY_CLASSES = { sun: 'text-amber-200', earth: 'text-sky-300' }

// No aria-live: Play would announce every frame. The same numbers are in the cell popup.
export default function DirectionCard({ directions, placeLabel }) {
  return (
    <div className="pointer-events-none absolute top-2 left-2 max-w-[70%] rounded-lg border border-slate-700 bg-slate-950/85 px-2 py-1 text-xs">
      <p className="text-slate-300">{placeLabel}</p>
      {directions.map((direction) => (
        <p key={direction.body} className={BODY_CLASSES[direction.body]}>
          {directionText(direction)}
        </p>
      ))}
    </div>
  )
}
