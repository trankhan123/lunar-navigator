// W1 — data loading and hour ↔ time helpers. Contract: README "Data files" and "W1".
import { capCellContaining } from './capGrid.js'

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

/** Attaches DSN data only when it covers exactly the same hours; otherwise null with a warning. */
export function attachDsn(ephemeris, dsn) {
  const aligned = dsn && dsn.startTime === ephemeris.startTime && dsn.hours === ephemeris.hours
  if (dsn && !aligned) console.warn('dsn.json does not match ephemeris.json (startTime/hours); DSN ignored.')
  return { ...ephemeris, dsn: aligned ? dsn : null }
}

export async function loadEphemeris(useMock) {
  const ephemeris = await loadJson(`${dataFolder(useMock)}/ephemeris.json`)
  const dsn = await loadDsn(useMock).catch(() => null)
  return attachDsn(ephemeris, dsn)
}
export const loadDsn = (useMock) => loadJson(`${dataFolder(useMock)}/dsn.json`)
export const loadRegions = (useMock) => loadJson(`${dataFolder(useMock)}/regions.json`)
export const loadCells = (useMock, cellsFile) => loadJson(`${dataFolder(useMock)}/${cellsFile}`)
export const loadSites = (useMock) => loadJson(`${dataFolder(useMock)}/sites.json`)
export const loadValidation = (useMock) => loadJson(`${dataFolder(useMock)}/validation.json`)
/** README "replay/" files (E6): index of replayed missions, and one short ephemeris per mission. */
export const loadReplayIndex = () => loadJson('/data/replay/index.json')
export const loadReplay = (siteId) => loadJson(`/data/replay/${siteId}.json`)
/** README D9 index of the whole-cap 2 km grid; null when the data set has none (mock data, older deploys). */
export const loadCapIndex = () => loadJson('/data/cap/index.json').catch(() => null)

const capTileRequests = new Map() // tile id → promise, so each file is fetched once
/** Cells of the given CAP tiles (README D9), loaded in parallel and cached; a failed tile can be retried. */
export function loadCapTiles(tileIds) {
  return Promise.all(
    tileIds.map((tileId) => {
      if (!capTileRequests.has(tileId)) {
        capTileRequests.set(tileId, loadJson(`/data/cap/${tileId}.json`).then((file) => file.cells).catch((error) => {
          capTileRequests.delete(tileId)
          throw error
        }))
      }
      return capTileRequests.get(tileId)
    }),
  )
}
/** README D8 map backgrounds; the map works without them. */
export const loadMaps = () => loadJson('/maps/maps.json').then((file) => file.maps).catch(() => [])
/** Relief tile pyramid index (pipeline/export_relief_tiles.py); null when the tiles are missing. Fetched once. */
let reliefIndexPromise
export const loadReliefIndex = () => (reliefIndexPromise ??= loadJson('/maps/relief/index.json').catch(() => null))

let terrainIndexPromise = null
/** README D10 terrain height map of one region: {entry, heights} (Int16 metres, row 0 = north); the 3D view only. */
export async function loadTerrain(regionCode) {
  terrainIndexPromise ??= loadJson('/terrain/index.json').catch((error) => {
    terrainIndexPromise = null
    throw error
  })
  const entry = (await terrainIndexPromise).regions.find((region) => region.code === regionCode)
  if (!entry) throw new Error(`No terrain for ${regionCode}`)
  const response = await fetch(entry.file)
  if (!response.ok) throw new Error(`Could not load ${entry.file} (${response.status})`)
  return { entry, heights: new Int16Array(await response.arrayBuffer()) }
}

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
export function resolveCurrentCell(currentPoint, cellsByRegion, sites, capCells = []) {
  if (!currentPoint) throw new Error('Pick a current landing point first')
  if (currentPoint.type === 'cell') {
    const cell = [...Object.values(cellsByRegion).flat(), ...capCells].find((candidate) => candidate.id === currentPoint.cellId)
    if (!cell) throw new Error(`Cell ${currentPoint.cellId} is not in the loaded grid`)
    return cell
  }
  const unknownTerrain = { heightM: 0, slopeDeg: null, psrFraction: null, feasible: null, infeasibleReason: null }
  if (currentPoint.type === 'site') {
    const site = sites.find((candidate) => candidate.id === currentPoint.siteId)
    if (!site) throw new Error(`Unknown site ${currentPoint.siteId}`)
    const position = toPolarXY(site.lat, site.lon)
    return withCapHorizon({ id: `SITE-${site.id}`, label: site.name, lat: site.lat, lon: site.lon, ...position, ...unknownTerrain, horizon: site.horizon ?? null }, cellsByRegion, capCells)
  }
  if (currentPoint.type !== 'coordinates') throw new Error(`Unknown point type ${currentPoint.type}`)
  const { lat, lon } = currentPoint
  return withCapHorizon({ id: 'CUSTOM', label: 'Custom point', lat, lon, ...toPolarXY(lat, lon), ...unknownTerrain, horizon: null }, cellsByRegion, capCells)
}

const LGRS_SNAP_M = 1000 // a point this close to an LGRS cell keeps the 1 km grid (README C5 "region" scope)

/** A point with no horizon of its own, outside the 9 regions but on the cap, takes the horizon of the 2 km CAP cell that contains it. */
function withCapHorizon(point, cellsByRegion, capCells) {
  if (point.horizon || point.xM === null || capCells.length === 0) return point
  const nearLgrsCell = Object.values(cellsByRegion).flat().some((cell) => Math.hypot(cell.xM - point.xM, cell.yM - point.yM) <= LGRS_SNAP_M)
  const capCell = nearLgrsCell ? null : capCellContaining(capCells, point.xM, point.yM)
  return capCell ? { ...point, horizon: capCell.horizon, horizonSource: 'cap' } : point
}

/** The cell the Detail screen shows: a grid cell by id, else the point that was searched (never the form's live point). */
export const detailCellFor = (cellsById, selectedCellId, searchedPoint) =>
  cellsById.get(selectedCellId) ?? (searchedPoint?.id === selectedCellId ? searchedPoint : null)
