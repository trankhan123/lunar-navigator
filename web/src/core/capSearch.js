// Which files a search needs: LGRS regions and CAP tiles (README C5 "Search scope", D9).
import { capCellCenterFromId, capTileIdsInCircle } from './capGrid.js'
import { toPolarXY } from './data.js'
import { CAP_REGION_SEARCH_KM } from './optimizer.js'

/** Where the current point is on the polar map {xM, yM}; null when unknown yet (an LGRS cell whose region is not loaded) or off the map. */
export function searchAnchor(point, sites, cellsByRegion) {
  if (point.type === 'cell') {
    const lgrsCell = Object.values(cellsByRegion).flat().find((cell) => cell.id === point.cellId)
    return lgrsCell ? { xM: lgrsCell.xM, yM: lgrsCell.yM } : capCellCenterFromId(point.cellId)
  }
  const { lat, lon } = point.type === 'site' ? (sites.find((site) => site.id === point.siteId) ?? {}) : point
  const { xM, yM } = toPolarXY(lat, lon)
  return Number.isFinite(xM) ? { xM, yM } : null
}

const intersectsCircle = ([xMin, yMin, xMax, yMax], { xM, yM }, radiusM) =>
  Math.hypot(xM - Math.min(xMax, Math.max(xMin, xM)), yM - Math.min(yMax, Math.max(yMin, yM))) <= radiusM

/**
 * Region codes whose cells the search needs: "region" = the one holding the point, "radius" = regions touching the circle
 * (all of them while the point's position is unknown), "all" = every region.
 */
export function regionCodesForSearch(scenario, regions, sites, anchor) {
  const point = scenario.currentPoint
  if (scenario.searchScope === 'all' || (scenario.searchScope === 'radius' && !anchor)) return regions.map((region) => region.code)
  if (scenario.searchScope === 'radius') return regions.filter((region) => intersectsCircle(region.boundsM, anchor, scenario.searchRadiusKm * 1000)).map((region) => region.code)
  if (point.type === 'cell') return [point.cellId.split('-')[0]]
  if (point.type === 'site') return [sites.find((site) => site.id === point.siteId)?.region].filter(Boolean)
  return regions.filter((region) => anchor && intersectsCircle(region.boundsM, anchor, 0)).map((region) => region.code)
}

/**
 * CAP tiles the search needs; none without a CAP grid, off the cap, or for "same region" of a point inside a region.
 * "All 9 regions" searches no CAP cell, but still loads the point's own tile so a typed point gets its real horizon.
 */
export function capTileIdsForSearch(scenario, capIndex, anchor, isPointInRegion) {
  if (!capIndex || !anchor || (scenario.searchScope === 'region' && isPointInRegion)) return []
  const radiusKm = { radius: scenario.searchRadiusKm, region: CAP_REGION_SEARCH_KM, all: 0 }[scenario.searchScope]
  return capTileIdsInCircle(capIndex, anchor.xM, anchor.yM, radiusKm * 1000)
}
