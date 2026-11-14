// W2 map v2 — the map's find box: regions, polar sites and cell IDs of this app (no named-feature search; spec §5.2).
import { toPolarXY } from './data.js'
import { distanceKm } from './geometry.js'
import { isOnPolarMap } from './mapView.js'

const MAX_MATCHES = 8
const CELL_ID_START = /^[a-z0-9]{3}-/i

const insideBounds = ({ xM, yM }, [xMin, yMin, xMax, yMax]) => xM >= xMin && xM <= xMax && yM >= yMin && yM <= yMax

/** Region code of the searched grid cell nearest the point, so the Results map can open it; null when no grid cell was searched. */
export function nearestRegionCode(point, cells, regions) {
  const codes = new Set(regions.map((region) => region.code))
  let nearest = null
  for (const cell of cells) {
    const code = cell.id.split('-')[0] // a region code, or SITE / CUSTOM for the current point's pseudo-cell
    if (!codes.has(code)) continue
    const distance = distanceKm(point, cell)
    if (!nearest || distance < nearest.distance) nearest = { code, distance }
  }
  return nearest?.code ?? null
}

/**
 * Matches for the typed text (trimmed, any case). "<CODE>-…" with a known region code lists that region's cells by ID prefix,
 * or asks for its file through regionCodeToLoad when it is not loaded yet; anything else matches region code or name and site name.
 * @returns {{matches: ({type: 'region', label, regionCode}|{type: 'site', label, site, regionCode}|{type: 'cell', label, regionCode, cell})[],
 *            regionCodeToLoad: string|null}}
 */
export function searchMap(query, regions, sites, cellsByRegion) {
  const text = query.trim()
  if (!text) return { matches: [], regionCodeToLoad: null }
  const code = text.slice(0, 3).toUpperCase()
  if (CELL_ID_START.test(text) && regions.some((region) => region.code === code)) {
    const cells = cellsByRegion[code]
    if (!cells) return { matches: [], regionCodeToLoad: code }
    const prefix = text.toUpperCase()
    const matches = cells.filter((cell) => cell.id.startsWith(prefix)).slice(0, MAX_MATCHES)
    return { matches: matches.map((cell) => ({ type: 'cell', label: cell.id, regionCode: code, cell })), regionCodeToLoad: null }
  }
  const words = text.toLowerCase()
  const regionMatches = regions
    .filter((region) => region.code.toLowerCase().includes(words) || region.name.toLowerCase().includes(words))
    .map((region) => ({ type: 'region', label: `${region.name} (${region.code})`, regionCode: region.code }))
  const siteMatches = sites
    .filter((site) => site.region === null && site.name.toLowerCase().includes(words))
    .map((site) => ({ site, position: toPolarXY(site.lat, site.lon) }))
    .filter(({ position }) => isOnPolarMap(position.xM, position.yM))
    .map(({ site, position }) => ({
      type: 'site',
      label: site.name,
      site,
      regionCode: regions.find((region) => insideBounds(position, region.boundsM))?.code ?? null,
    }))
  return { matches: [...regionMatches, ...siteMatches].slice(0, MAX_MATCHES), regionCodeToLoad: null }
}
