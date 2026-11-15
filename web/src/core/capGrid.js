// D9 whole-cap 2 km grid (CAP): pure helpers for tiles, ids and the one-pixel-per-cell raster. Contract: README "D9".
export const CAP_CELL_SIZE_M = 2000
// Cells per side of the shipped grid (index.json `gridSize`; centres run from -301 km to +301 km, built to 80°S). Ids only
// carry row/col from the corner, so reading an id needs this; the raster functions take the index value as gridSize.
export const CAP_GRID_SIZE = 302
/** Square [xMin, yMin, xMax, yMax] (PGDA metres) covered by a gridSize x gridSize raster. */
export const capBoundsM = (gridSize) => [-gridSize / 2, -gridSize / 2, gridSize / 2, gridSize / 2].map((cells) => cells * CAP_CELL_SIZE_M)
export const CAP_ID_PATTERN = /^CAP-r(\d{3})c(\d{3})$/i

/** Centre of a CAP cell read from its id (`CAP-r150c187`); null for any other id. */
export function capCellCenterFromId(cellId, gridSize = CAP_GRID_SIZE) {
  const match = CAP_ID_PATTERN.exec(cellId ?? '')
  if (!match) return null
  return { xM: (Number(match[2]) - gridSize / 2 + 0.5) * CAP_CELL_SIZE_M, yM: (Number(match[1]) - gridSize / 2 + 0.5) * CAP_CELL_SIZE_M }
}

const overlaps = ([xMin, yMin, xMax, yMax], [otherXMin, otherYMin, otherXMax, otherYMax]) =>
  xMin <= otherXMax && xMax >= otherXMin && yMin <= otherYMax && yMax >= otherYMin

/** Ids of the tiles whose square touches the view box [xMin, yMin, xMax, yMax] (PGDA metres). */
export const capTileIdsInBounds = (capIndex, boundsM) => capIndex.tiles.filter((tile) => overlaps(tile.boundsM, boundsM)).map((tile) => tile.id)

/** Ids of the tiles whose square touches the circle (centre xM/yM, radius in metres). */
export function capTileIdsInCircle(capIndex, xM, yM, radiusM) {
  return capIndex.tiles
    .filter(({ boundsM: [xMin, yMin, xMax, yMax] }) => Math.hypot(xM - Math.min(xMax, Math.max(xMin, xM)), yM - Math.min(yMax, Math.max(yMin, yM))) <= radiusM)
    .map((tile) => tile.id)
}

/** The loaded CAP cell whose 2 km square contains the point, or null (point in a region, off the cap, or its tile not loaded). */
export function capCellContaining(capCells, xM, yM) {
  const half = CAP_CELL_SIZE_M / 2
  return capCells.find((cell) => Math.abs(cell.xM - xM) <= half && Math.abs(cell.yM - yM) <= half) ?? null
}

/** Pixel of a cell in the raster: one pixel per cell, north (+y) at the top. */
export const capPixelIndex = ({ xM, yM }, gridSize = CAP_GRID_SIZE) => {
  const clampToGrid = (index) => Math.min(gridSize - 1, Math.max(0, index)) // a pointer exactly on the far edge stays inside
  return clampToGrid(gridSize - 1 - (Math.floor(yM / CAP_CELL_SIZE_M) + gridSize / 2)) * gridSize + clampToGrid(Math.floor(xM / CAP_CELL_SIZE_M) + gridSize / 2)
}

/** Cell index (into capCells) of every pixel, -1 where no loaded cell: used to find the cell under the pointer. */
export function capPixelLookup(capCells, gridSize = CAP_GRID_SIZE) {
  const lookup = new Int32Array(gridSize * gridSize).fill(-1)
  capCells.forEach((cell, index) => {
    lookup[capPixelIndex(cell, gridSize)] = index
  })
  return lookup
}

const rgbCache = new Map()
function hexToRgb(hex) {
  if (!rgbCache.has(hex)) rgbCache.set(hex, [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16)))
  return rgbCache.get(hex)
}

/** RGBA bytes of the raster (alpha 255 where a cell is loaded, 0 elsewhere); colors[i] is the '#rrggbb' of capCells[i]. */
export function capPixelsRgba(capCells, colors, gridSize = CAP_GRID_SIZE) {
  const rgba = new Uint8ClampedArray(gridSize * gridSize * 4)
  capCells.forEach((cell, index) => {
    const offset = capPixelIndex(cell, gridSize) * 4
    rgba.set(hexToRgb(colors[index]), offset)
    rgba[offset + 3] = 255
  })
  return rgba
}
