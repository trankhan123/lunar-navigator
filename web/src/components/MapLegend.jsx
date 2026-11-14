import { INFEASIBLE_COLOR, MAP_LAYERS, STATUS_SYMBOLS } from '../core/mapLayers.js'

function Swatch({ color, symbol = '', label }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-grid size-3.5 place-items-center rounded-sm text-[9px] font-bold text-slate-950" style={{ backgroundColor: color }} aria-hidden="true">
        {symbol}
      </span>
      {label}
    </span>
  )
}

// Colour never stands alone: every swatch has its text, search results keep ✕ ! ✓, infeasible cells are hatched.
export default function MapLegend({ layerId, showsCentreDots = false }) {
  const layer = MAP_LAYERS.find((candidate) => candidate.id === layerId)
  const levelSwatches = layer.legend.map((entry, level) => ({ ...entry, symbol: layerId === 'searchResult' ? STATUS_SYMBOLS[level] : '' })).reverse()
  return (
    <div className="mt-2 space-y-1 text-xs text-slate-400">
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {[...levelSwatches, ...(layer.extraLegend ?? [])].map((entry) => (
          <Swatch key={entry.label} {...entry} />
        ))}
        <span className="inline-flex items-center gap-1.5">
          <svg className="size-3.5 rounded-sm" viewBox="0 0 14 14" aria-hidden="true">
            <rect width="14" height="14" fill={INFEASIBLE_COLOR} />
            <path d="M0 14 L14 0 M-4 4 L4 -4 M10 18 L18 10" stroke="#94a3b8" strokeWidth="2" />
          </svg>
          Hatched: not feasible (too steep or in permanent shadow)
        </span>
      </p>
      {showsCentreDots && <p>Dots: region centres (terrain horizon of the centre point)</p>}
      <p>Amber outline: current point · white: selected</p>
      <p>1 square = 1 km · up = towards 0° longitude (Earth-facing side)</p>
      <p>Sources: LOLA PGDA 90 (80 m), USGS LGRS, JPL Horizons.</p>
    </div>
  )
}
