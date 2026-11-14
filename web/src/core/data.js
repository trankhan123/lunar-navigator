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
