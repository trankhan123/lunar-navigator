import { toPolarXY } from '../core/data.js'

const CELL_SIZE_M = 1000
const CELL_GAP_M = 60
// Index = STATUS code from core/optimizer.js: fail, marginal, pass.
const STATUS_COLORS = ['#ef4444', '#f59e0b', '#10b981']
const FEASIBLE_COLOR = '#0ea5e9'
const INFEASIBLE_COLOR = '#334155'

function cellFill(cell, statusByCellId) {
  if (!cell.feasible) return INFEASIBLE_COLOR
  if (!statusByCellId) return FEASIBLE_COLOR
  const status = statusByCellId.get(cell.id)
  return status === undefined ? '#64748b' : STATUS_COLORS[status]
}

export default function SouthPoleMap({ region, cells, sites, statusByCellId, currentCellId, selectedCellId, onSelectCell }) {
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
        aria-label={`Map of ${region.name}: ${cells.length} cells of 1 km, ${feasibleCount} feasible. Select a cell for details.`}
      >
        {cells.map((cell) => {
          const [x, y] = toSvg(cell.xM, cell.yM)
          const isCurrent = cell.id === currentCellId
          const isSelected = cell.id === selectedCellId
          return (
            <rect
              key={cell.id}
              x={x - CELL_SIZE_M / 2 + CELL_GAP_M / 2}
              y={y - CELL_SIZE_M / 2 + CELL_GAP_M / 2}
              width={CELL_SIZE_M - CELL_GAP_M}
              height={CELL_SIZE_M - CELL_GAP_M}
              fill={cellFill(cell, statusByCellId)}
              fillOpacity={cell.feasible ? 0.75 : 1}
              stroke={isCurrent ? '#fbbf24' : isSelected ? '#f8fafc' : 'none'}
              strokeWidth={isCurrent ? 3 : 2}
              vectorEffect="non-scaling-stroke"
              className="cursor-pointer hover:fill-opacity-100"
              onClick={() => onSelectCell(cell)}
            >
              <title>{`${cell.id}${cell.feasible ? '' : ` (not feasible: ${cell.infeasibleReason})`}`}</title>
            </rect>
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
          ? [
              legendItem(STATUS_COLORS[2], 'Meets all limits'),
              legendItem(STATUS_COLORS[1], 'Meets limits, battery below 20 %'),
              legendItem(STATUS_COLORS[0], 'Fails a limit'),
            ]
          : legendItem(FEASIBLE_COLOR, 'Feasible cell')}
        {legendItem(INFEASIBLE_COLOR, 'Too steep or in permanent shadow')}
        <span>1 square = 1 km · up = towards 0° longitude (Earth-facing side)</span>
      </figcaption>
    </figure>
  )
}

function legendItem(color, label) {
  return (
    <span key={label} className="inline-flex items-center gap-1.5">
      <span className="inline-block size-3 rounded-sm" style={{ backgroundColor: color }} aria-hidden="true" />
      {label}
    </span>
  )
}
