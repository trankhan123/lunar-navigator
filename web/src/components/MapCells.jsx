import { memo } from 'react'

const CELL_DRAW_SIZE_M = 940 // a 1 km square with a 60 m gap

// colors[i] / symbols[i] belong to cells[i]. One delegated click handler; d3-zoom's clickDistance drops clicks that end a drag.
function MapCells({ cells, colors, symbols, onSelectCell, onHoverCell }) {
  function cellFromEvent(event) {
    const target = event.target.closest('[data-cell-index]')
    return target ? cells[Number(target.dataset.cellIndex)] : null
  }
  function selectFromEvent(event) {
    const cell = cellFromEvent(event)
    if (cell) onSelectCell(cell)
  }
  // Hover is for mice only: on touch the tap opens the popup instead.
  return (
    <g
      onClick={selectFromEvent}
      onPointerOver={(event) => event.pointerType === 'mouse' && onHoverCell?.(cellFromEvent(event))}
      onPointerLeave={(event) => event.pointerType === 'mouse' && onHoverCell?.(null)}
      className="cursor-pointer"
    >
      {cells.map((cell, index) => {
        const x = cell.xM - CELL_DRAW_SIZE_M / 2
        const y = -cell.yM - CELL_DRAW_SIZE_M / 2
        return (
          <g key={cell.id}>
            <rect x={x} y={y} width={CELL_DRAW_SIZE_M} height={CELL_DRAW_SIZE_M} fill={colors[index]} fillOpacity={0.8} data-cell-index={index}>
              <title>{cell.feasible ? cell.id : `${cell.id} (not feasible: ${cell.infeasibleReason})`}</title>
            </rect>
            {!cell.feasible && (
              <rect x={x} y={y} width={CELL_DRAW_SIZE_M} height={CELL_DRAW_SIZE_M} fill="url(#infeasible-hatch)" pointerEvents="none" />
            )}
            {symbols?.[index] && (
              <text x={cell.xM} y={-cell.yM} textAnchor="middle" dominantBaseline="central" fontSize={420} fontWeight="700" fill="#020617" pointerEvents="none">
                {symbols[index]}
              </text>
            )}
          </g>
        )
      })}
    </g>
  )
}

export default memo(MapCells)
