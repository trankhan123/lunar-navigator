import { memo } from 'react'
import { toPolarXY } from '../core/data.js'

const CELL_SIZE_M = 1000
const CELL_GAP_M = 60
// Index = STATUS code from core/optimizer.js: fail, marginal, pass. Symbols keep the status readable without colour.
const STATUS_COLORS = ['#ef4444', '#f59e0b', '#10b981']
const STATUS_SYMBOLS = ['✕', '!', '✓']
const STATUS_WORDS = ['fails a limit', 'meets limits, battery below 20 %', 'meets all limits']
const FEASIBLE_COLOR = '#0ea5e9'
const INFEASIBLE_COLOR = '#334155'
const NOT_SEARCHED_COLOR = '#64748b'

function cellTitle(cell, status) {
  if (!cell.feasible) return `${cell.id} (not feasible: ${cell.infeasibleReason})`
  return status === undefined ? cell.id : `${cell.id}: ${STATUS_WORDS[status]}`
}

function legendItem(color, label, symbol = '') {
  return (
    <span key={label} className="inline-flex items-center gap-1.5">
      <span className="inline-grid size-3.5 place-items-center rounded-sm text-[9px] font-bold text-slate-950" style={{ backgroundColor: color }} aria-hidden="true">
        {symbol}
      </span>
      {label}
    </span>
  )
}

// background: optional README D8 map entry {image, boundsM} drawn under the cells.
function SouthPoleMap({ region, background, cells, sites, statusByCellId, currentCellId, selectedCellId, onSelectCell }) {
  const [xMin, yMin, xMax, yMax] = region.boundsM
  const widthM = xMax - xMin
  const heightM = yMax - yMin
  // Map y grows north (towards lon 0°); SVG y grows down.
  const toSvg = (xM, yM) => [xM - xMin, yMax - yM]
  const sitesInView = sites
    .map((site) => ({ ...site, ...toPolarXY(site.lat, site.lon) }))
    .filter((site) => site.xM !== null && site.xM >= xMin && site.xM <= xMax && site.yM >= yMin && site.yM <= yMax)
  const pinRadiusM = widthM / 140
  const feasibleCount = cells.filter((cell) => cell.feasible).length

  return (
    <figure>
      <svg
        viewBox={`0 0 ${widthM} ${heightM}`}
        className="max-h-[70vh] w-full rounded-lg bg-slate-900"
        role="img"
        aria-label={`Map of ${region.name}: ${cells.length} cells of 1 km, ${feasibleCount} feasible. Use the Cell list above the map to select one with the keyboard.`}
      >
        {background && (
          <image
            href={background.image}
            x={background.boundsM[0] - xMin}
            y={yMax - background.boundsM[3]}
            width={background.boundsM[2] - background.boundsM[0]}
            height={background.boundsM[3] - background.boundsM[1]}
            preserveAspectRatio="none"
          />
        )}
        {cells.map((cell) => {
          const [x, y] = toSvg(cell.xM, cell.yM)
          const status = statusByCellId?.get(cell.id)
          const fill = !cell.feasible ? INFEASIBLE_COLOR : !statusByCellId ? FEASIBLE_COLOR : (STATUS_COLORS[status] ?? NOT_SEARCHED_COLOR)
          const isCurrent = cell.id === currentCellId
          const isSelected = cell.id === selectedCellId
          return (
            <g key={cell.id} className="cursor-pointer" onClick={() => onSelectCell(cell)}>
              <rect
                x={x - CELL_SIZE_M / 2 + CELL_GAP_M / 2}
                y={y - CELL_SIZE_M / 2 + CELL_GAP_M / 2}
                width={CELL_SIZE_M - CELL_GAP_M}
                height={CELL_SIZE_M - CELL_GAP_M}
                fill={fill}
                fillOpacity={(cell.feasible ? 0.75 : 1) * (background ? 0.7 : 1)}
                stroke={isCurrent ? '#fbbf24' : isSelected ? '#f8fafc' : 'none'}
                strokeWidth={isCurrent ? 3 : 2}
                vectorEffect="non-scaling-stroke"
                className="transition-[fill-opacity] hover:[fill-opacity:1]"
              >
                <title>{cellTitle(cell, status)}</title>
              </rect>
              {cell.feasible && status !== undefined && (
                <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={420} fontWeight="700" fill="#020617" pointerEvents="none">
                  {STATUS_SYMBOLS[status]}
                </text>
              )}
            </g>
          )
        })}
        {sitesInView.map((site) => {
          const [x, y] = toSvg(site.xM, site.yM)
          return (
            <g key={site.id} pointerEvents="none">
              <circle cx={x} cy={y} r={pinRadiusM} fill="#f8fafc" stroke="#020617" strokeWidth={2} vectorEffect="non-scaling-stroke" />
              <text x={x + pinRadiusM * 1.6} y={y + pinRadiusM * 0.6} fontSize={pinRadiusM * 2.6} fill="#f8fafc" stroke="#020617" strokeWidth={pinRadiusM * 0.6} paintOrder="stroke">
                {site.name}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
        {statusByCellId
          ? STATUS_WORDS.map((word, status) => legendItem(STATUS_COLORS[status], word[0].toUpperCase() + word.slice(1), STATUS_SYMBOLS[status])).reverse()
          : legendItem(FEASIBLE_COLOR, 'Feasible cell')}
        {legendItem(INFEASIBLE_COLOR, 'Too steep or in permanent shadow')}
        <span>Amber outline: current point · white: selected</span>
        <span>1 square = 1 km · up = towards 0° longitude (Earth-facing side)</span>
      </figcaption>
    </figure>
  )
}

// Memo: the form re-renders App on every keystroke; ~2,000 cells should not re-render with it.
export default memo(SouthPoleMap)
