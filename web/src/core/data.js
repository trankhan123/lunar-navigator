// W1 — data loading and hour ↔ time helpers. Contract: README "Data files" and "W1".

/**
 * @typedef {Object} Ephemeris  web/public/data/ephemeris.json; hour i = startTime + i h
 * @property {string} startTime  'YYYY-MM-DDTHH:mmZ'
 * @property {number} stepHours  always 1
 * @property {number} hours      length of every array below
 * @property {number[]} sunSubLonDeg
 * @property {number[]} sunSubLatDeg
 * @property {number[]} sunDistanceAu
 * @property {number[]} earthSubLonDeg
 * @property {number[]} earthSubLatDeg
 * @property {number[]} earthDistanceKm
 */

/**
 * @typedef {Object} Cell  one entry of cells_<CODE>.json (or a pseudo-cell for a site / custom point)
 * @property {string} id  '<CODE>-<label>', 'SITE-<siteId>' or 'CUSTOM'
 * @property {string} label
 * @property {number} lat
 * @property {number} lon
 * @property {number|null} xM  polar stereographic x (PGDA CRS), null for points outside the map
 * @property {number|null} yM
 * @property {number} heightM
 * @property {number|null} slopeDeg
 * @property {number|null} psrFraction
 * @property {boolean|null} feasible  null = unknown (custom point)
 * @property {null|'slope'|'psr'} infeasibleReason
 * @property {number[]|null} horizon  360 integers, 0.1° units; null = smooth sphere
 */

export function dataFolder(useMock) {
  return useMock ? '/data/mock' : '/data'
}

async function loadJson(path) {
  const response = await fetch(path)
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status})`)
  return response.json()
}

export const loadEphemeris = (useMock) => loadJson(`${dataFolder(useMock)}/ephemeris.json`)
export const loadRegions = (useMock) => loadJson(`${dataFolder(useMock)}/regions.json`)
export const loadCells = (useMock, cellsFile) => loadJson(`${dataFolder(useMock)}/${cellsFile}`)
export const loadSites = (useMock) => loadJson(`${dataFolder(useMock)}/sites.json`)
export const loadValidation = (useMock) => loadJson(`${dataFolder(useMock)}/validation.json`)

const HOUR_MS = 3600 * 1000

/** Ephemeris hour index of an ISO time on a whole hour. Throws outside the ephemeris. */
export function hourIndexOf(ephemeris, isoTime) {
  // Only explicit UTC: a time without 'Z' would be read in the viewer's time zone.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/.test(isoTime)) throw new Error(`${isoTime} is not a UTC time like 2028-01-01T06:00Z`)
  const hour = (Date.parse(isoTime) - Date.parse(ephemeris.startTime)) / HOUR_MS
  if (!Number.isInteger(hour) || hour < 0 || hour >= ephemeris.hours) {
    throw new Error(`${isoTime} is not a whole hour inside the ephemeris`)
  }
  return hour
}

/** ISO time 'YYYY-MM-DDTHH:mmZ' of an ephemeris hour index. */
export function timeAtHour(ephemeris, hour) {
  return new Date(Date.parse(ephemeris.startTime) + hour * HOUR_MS).toISOString().slice(0, 16) + 'Z'
}

const MOON_RADIUS_M = 1737400
const DEG = Math.PI / 180

/** Polar stereographic x/y in metres (PGDA CRS, +y = lon 0°) for lat ≤ −60°; null outside the south polar maps. */
export function toPolarXY(latDeg, lonDeg) {
  if (latDeg > -60) return { xM: null, yM: null }
  const radiusM = 2 * MOON_RADIUS_M * Math.tan(((90 + latDeg) * DEG) / 2)
  return { xM: radiusM * Math.sin(lonDeg * DEG), yM: radiusM * Math.cos(lonDeg * DEG) }
}

/**
 * Scenario.currentPoint → Cell: a grid cell, or a pseudo-cell for a famous site / typed coordinates (README "Shared objects").
 * @param {Object<string, Cell[]>} cellsByRegion  regions loaded so far
 * @returns {Cell}
 */
export function resolveCurrentCell(currentPoint, cellsByRegion, sites) {
  if (!currentPoint) throw new Error('Pick a current landing point first')
  if (currentPoint.type === 'cell') {
    const cell = Object.values(cellsByRegion).flat().find((candidate) => candidate.id === currentPoint.cellId)
    if (!cell) throw new Error(`Cell ${currentPoint.cellId} is not in the loaded grid`)
    return cell
  }
  const unknownTerrain = { heightM: 0, slopeDeg: null, psrFraction: null, feasible: null, infeasibleReason: null }
  if (currentPoint.type === 'site') {
    const site = sites.find((candidate) => candidate.id === currentPoint.siteId)
    if (!site) throw new Error(`Unknown site ${currentPoint.siteId}`)
    const position = toPolarXY(site.lat, site.lon)
    return { id: `SITE-${site.id}`, label: site.name, lat: site.lat, lon: site.lon, ...position, ...unknownTerrain, horizon: site.horizon ?? null }
  }
  if (currentPoint.type !== 'coordinates') throw new Error(`Unknown point type ${currentPoint.type}`)
  const { lat, lon } = currentPoint
  return { id: 'CUSTOM', label: 'Custom point', lat, lon, ...toPolarXY(lat, lon), ...unknownTerrain, horizon: null }
}
