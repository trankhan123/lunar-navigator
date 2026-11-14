import { memo } from 'react'

const CELL_DRAW_SIZE_M = 940 // a 1 km square with a 60 m gap
const CELL_FILL_OPACITY = 0.65 // lets the relief (craters, ridges) show through while the colours stay readable

const LABEL_STYLE = { fill: '#f8fafc', stroke: '#020617', strokeWidth: 40, paintOrder: 'stroke', pointerEvents: 'none' }

// symbols[i] belongs to cells[i]. Fills are not rendered here: SouthPoleMap paints them through groupRef, so an hour change does
// not re-render ~930 cells (Task 16 timing fallback). One delegated click handler; d3-zoom's clickDistance drops drag-end clicks.
function MapCells({ cells, symbols, onSelectCell, onHoverCell, showLabels = false, groupRef }) {
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
      ref={groupRef}
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
            <rect x={x} y={y} width={CELL_DRAW_SIZE_M} height={CELL_DRAW_SIZE_M} fillOpacity={CELL_FILL_OPACITY} data-cell-index={index}>
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
            {showLabels && (
              <text x={cell.xM} y={-cell.yM - 280} textAnchor="middle" fontSize={190} style={LABEL_STYLE}>
                {cell.label}
              </text>
            )}
          </g>
        )
      })}
    </g>
  )
}

export default memo(MapCells)
