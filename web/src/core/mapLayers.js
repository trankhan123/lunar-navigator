// W2 map v2 — what colour a cell gets on each map layer. Colours: Okabe–Ito plus viridis, readable for colour-blind users on the dark map.
import { VISIBLE_THRESHOLD } from './geometry.js'

export const NO_VALUE_COLOR = '#475569'
export const INFEASIBLE_COLOR = '#334155'
export const NOT_SEARCHED_COLOR = '#64748b'
export const STATUS_SYMBOLS = ['✕', '!', '✓'] // index = STATUS code (fail, marginal, pass)

const entries = (pairs) => pairs.map(([color, label]) => ({ color, label }))

/** Map layers in panel order; legend[level] is the swatch of that level. needs: what the layer waits for. */
export const MAP_LAYERS = [
  { id: 'sunNow', label: 'Sunlight now', needs: 'hour', legend: entries([['#1f2937', 'In shadow'], ['#e69f00', 'Partial Sun (half the disk or more, counts as sunlit)'], ['#f0e442', 'Full Sun']]) },
  { id: 'earthNow', label: 'Earth in view now', needs: 'hour', legend: entries([['#1f2937', 'Earth hidden'], ['#56b4e9', 'Earth in view']]) },
  { id: 'sunEarthNow', label: 'Sun and Earth now', needs: 'hour', legend: entries([['#1f2937', 'Neither'], ['#56b4e9', 'Earth only'], ['#f0e442', 'Sun only'], ['#009e73', 'Sun and Earth']]) },
  {
    id: 'searchResult', label: 'Search result', needs: 'search',
    legend: entries([['#ef4444', 'Fails a limit'], ['#f59e0b', 'Meets limits, battery below 20 %'], ['#10b981', 'Meets all limits']]),
    extraLegend: entries([[NOT_SEARCHED_COLOR, 'Not in this search']]),
  },
  { id: 'feasibility', label: 'Feasibility', needs: null, legend: entries([[INFEASIBLE_COLOR, 'Too steep or in permanent shadow'], ['#0ea5e9', 'Feasible cell']]) },
]
const layersById = new Map(MAP_LAYERS.map((layer) => [layer.id, layer]))

/** 0 shadow (< half the disk), 1 partial (half or more: counts as sunlit, as in the ranking), 2 full disk. */
export const sunLevel = (diskFraction) => (diskFraction >= 1 ? 2 : diskFraction >= VISIBLE_THRESHOLD ? 1 : 0)
export const earthLevel = (diskFraction) => (diskFraction >= VISIBLE_THRESHOLD ? 1 : 0)
/** 0 neither, 1 Earth only, 2 Sun only, 3 both. */
export const sunEarthLevel = (sunDiskFraction, earthDiskFraction) =>
  (sunDiskFraction >= VISIBLE_THRESHOLD ? 2 : 0) + (earthDiskFraction >= VISIBLE_THRESHOLD ? 1 : 0)

/**
 * Level of a cell on a layer, or null when the value is missing.
 * @param {string} layerId
 * @param {{feasible?: boolean, status?: number, sunDiskFraction?: number, earthDiskFraction?: number}} sample
 */
export function cellLevel(layerId, sample) {
  const { sunDiskFraction: sun, earthDiskFraction: earth } = sample
  if (layerId === 'sunNow') return Number.isFinite(sun) ? sunLevel(sun) : null
  if (layerId === 'earthNow') return Number.isFinite(earth) ? earthLevel(earth) : null
  if (layerId === 'sunEarthNow') return Number.isFinite(sun) && Number.isFinite(earth) ? sunEarthLevel(sun, earth) : null
  if (layerId === 'searchResult') return sample.feasible && sample.status !== undefined ? sample.status : null
  if (layerId === 'feasibility') return sample.feasible ? 1 : 0
  return null
}

/** Fill colour of a cell on a layer; always a colour. */
export function cellColor(layerId, sample) {
  const layer = layersById.get(layerId)
  if (layerId === 'searchResult') {
    if (!sample.feasible) return INFEASIBLE_COLOR
    if (sample.status === undefined) return NOT_SEARCHED_COLOR
  }
  const level = cellLevel(layerId, sample)
  return level === null ? NO_VALUE_COLOR : layer.legend[level].color
}
