// W2 map — which relief tiles (web/public/maps/relief, pipeline/export_relief_tiles.py) to draw for a zoom transform.
import { VIEW_SIZE_M, viewBoundsM } from './mapView.js'

export const MAX_TILES = 30
const PREFETCH_FRACTION = 0.1 // load a little beyond the view so a small pan shows no gaps

/** The coarsest level at least as sharp as the screen (metres per screen pixel), else the finest. */
export const reliefLevelFor = (index, screenMetersPerPixel) =>
  index.levels.find((level) => level.metersPerPixel <= screenMetersPerPixel) ?? index.levels.at(-1)

const clamp = (value, high) => Math.min(high, Math.max(0, value))

/** Existing tiles of one level that touch viewBounds, nearest to the view centre first. */
function levelTiles(index, level, [xMin, yMin, xMax, yMax]) {
  const [boundsXMin, , , boundsYMax] = index.boundsM
  const last = 2 ** level.z - 1
  const firstColumn = clamp(Math.floor((xMin - boundsXMin) / level.tileSizeM), last)
  const lastColumn = clamp(Math.floor((xMax - boundsXMin) / level.tileSizeM), last)
  const firstRow = clamp(Math.floor((boundsYMax - yMax) / level.tileSizeM), last) // row 0 is the north edge
  const lastRow = clamp(Math.floor((boundsYMax - yMin) / level.tileSizeM), last)
  const centre = [(xMin + xMax) / 2, (yMin + yMax) / 2]
  const tiles = []
  for (let row = firstRow; row <= lastRow; row++) {
    for (let column = firstColumn; column <= lastColumn; column++) {
      if (!level.tiles.includes(`${column}_${row}`)) continue
      const xM = boundsXMin + column * level.tileSizeM
      const yM = boundsYMax - row * level.tileSizeM // top edge
      tiles.push({ key: `${level.z}/${column}_${row}`, url: `/maps/relief/${level.z}/${column}_${row}.jpg`, level: level.z, xM, yM, sizeM: level.tileSizeM })
    }
  }
  const distance = (tile) => Math.hypot(tile.xM + tile.sizeM / 2 - centre[0], tile.yM - tile.sizeM / 2 - centre[1])
  return tiles.sort((a, b) => distance(a) - distance(b))
}

/**
 * Tiles to draw for a d3-zoom transform: the level that matches the screen sharpness, with the next coarser level (always complete)
 * underneath it so no hole shows while finer tiles load. Coarser first = drawing order; at most MAX_TILES.
 * @param {{k: number, x: number, y: number}} transform
 * @param {number} viewportPx  drawn width of the square map in screen pixels
 * @param {{boundsM: number[], levels: {z: number, tileSizeM: number, metersPerPixel: number, tiles: string[]}[]}} index
 * @returns {{key: string, url: string, level: number, xM: number, yM: number, sizeM: number}[]} yM is the tile's top edge (PGDA metres)
 */
export function visibleReliefTiles(transform, viewportPx, index, devicePixelRatio = 1) {
  const [xMin, yMin, xMax, yMax] = viewBoundsM(transform)
  const margin = (xMax - xMin) * PREFETCH_FRACTION
  const viewBounds = [xMin - margin, yMin - margin, xMax + margin, yMax + margin]
  const chosen = reliefLevelFor(index, VIEW_SIZE_M / transform.k / viewportPx / Math.min(devicePixelRatio, 2))
  const under = index.levels.find((level) => level.z === chosen.z - 1)
  const chosenTiles = levelTiles(index, chosen, viewBounds).slice(0, MAX_TILES) // the sharp level first; the coarser one fills what is left
  const underTiles = under ? levelTiles(index, under, viewBounds).slice(0, MAX_TILES - chosenTiles.length) : []
  return [...underTiles, ...chosenTiles]
}
