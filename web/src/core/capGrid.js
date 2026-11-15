// D9 whole-cap 2 km grid (CAP): pure helpers for tiles, ids and the one-pixel-per-cell raster. Contract: README "D9".
export const CAP_CELL_SIZE_M = 2000
export const CAP_GRID_SIZE = 152 // cells per side; centres run from -151 km to +151 km
const CAP_ORIGIN = CAP_GRID_SIZE / 2 // id row/col 076 is the cell whose centre is at 1 km
export const CAP_BOUNDS_M = [-CAP_ORIGIN * CAP_CELL_SIZE_M, -CAP_ORIGIN * CAP_CELL_SIZE_M, CAP_ORIGIN * CAP_CELL_SIZE_M, CAP_ORIGIN * CAP_CELL_SIZE_M]
export const CAP_ID_PATTERN = /^CAP-r(\d{3})c(\d{3})$/i

/** Centre of a CAP cell read from its id (`CAP-r075c112`); null for any other id. */
export function capCellCenterFromId(cellId) {
  const match = CAP_ID_PATTERN.exec(cellId ?? '')
  if (!match) return null
  return { xM: (Number(match[2]) - CAP_ORIGIN + 0.5) * CAP_CELL_SIZE_M, yM: (Number(match[1]) - CAP_ORIGIN + 0.5) * CAP_CELL_SIZE_M }
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
export const capPixelIndex = ({ xM, yM }) => {
  const clampToGrid = (index) => Math.min(CAP_GRID_SIZE - 1, Math.max(0, index)) // a pointer exactly on the far edge stays inside
  return clampToGrid(CAP_GRID_SIZE - 1 - (Math.floor(yM / CAP_CELL_SIZE_M) + CAP_ORIGIN)) * CAP_GRID_SIZE + clampToGrid(Math.floor(xM / CAP_CELL_SIZE_M) + CAP_ORIGIN)
}

/** Cell index (into capCells) of every pixel, -1 where no loaded cell: used to find the cell under the pointer. */
export function capPixelLookup(capCells) {
  const lookup = new Int32Array(CAP_GRID_SIZE * CAP_GRID_SIZE).fill(-1)
  capCells.forEach((cell, index) => {
    lookup[capPixelIndex(cell)] = index
  })
  return lookup
}

const rgbCache = new Map()
function hexToRgb(hex) {
  if (!rgbCache.has(hex)) rgbCache.set(hex, [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16)))
  return rgbCache.get(hex)
}

/** RGBA bytes of the raster (alpha 255 where a cell is loaded, 0 elsewhere); colors[i] is the '#rrggbb' of capCells[i]. */
export function capPixelsRgba(capCells, colors) {
  const rgba = new Uint8ClampedArray(CAP_GRID_SIZE * CAP_GRID_SIZE * 4)
  capCells.forEach((cell, index) => {
    const offset = capPixelIndex(cell) * 4
    rgba.set(hexToRgb(colors[index]), offset)
    rgba[offset + 3] = 255
  })
  return rgba
}
