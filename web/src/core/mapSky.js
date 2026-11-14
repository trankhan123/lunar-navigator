// W2 map v2 — Sun and Earth numbers for the map, built on C1 (sunlight.js) and C2 (communication.js).
import { computeEarthTrack } from './communication.js'
import { hourIndexOf, resolveCurrentCell } from './data.js'
import { VISIBLE_THRESHOLD } from './geometry.js'
import { countDays } from './scenario.js'
import { computeSunTrack } from './sunlight.js'
import { fractionAtLeast } from './timeSeries.js'

const SKY_FIELDS = ['sunAzimuthDeg', 'sunElevationDeg', 'sunDiskFraction', 'earthAzimuthDeg', 'earthElevationDeg', 'earthDiskFraction']

/**
 * Sun and Earth seen from each cell at one ephemeris hour (spec §5.9: C1/C2 with hourCount = 1).
 * @returns {{sunAzimuthDeg: Float32Array, sunElevationDeg: Float32Array, sunDiskFraction: Float32Array,
 *            earthAzimuthDeg: Float32Array, earthElevationDeg: Float32Array, earthDiskFraction: Float32Array}}
 */
export function computeSkyAtHour(cells, ephemeris, hour) {
  const sky = Object.fromEntries(SKY_FIELDS.map((field) => [field, new Float32Array(cells.length)]))
  cells.forEach((cell, index) => {
    const sun = computeSunTrack(cell, ephemeris, hour, 1)
    const earth = computeEarthTrack(cell, ephemeris, hour, 1)
    sky.sunAzimuthDeg[index] = sun.azimuthDeg[0]
    sky.sunElevationDeg[index] = sun.elevationDeg[0]
    sky.sunDiskFraction[index] = sun.diskFraction[0]
    sky.earthAzimuthDeg[index] = earth.azimuthDeg[0]
    sky.earthElevationDeg[index] = earth.elevationDeg[0]
    sky.earthDiskFraction[index] = earth.diskFraction[0]
  })
  return sky
}

/**
 * Ephemeris hours of the scenario dates: startDate 00:00 to endDate 23:00, cut at the last ephemeris hour.
 * @returns {{firstHour: number, lastHour: number}|null}  null for a missing, reversed or out-of-ephemeris start
 */
export function mapHourRange(ephemeris, startDate, endDate) {
  const dayCount = countDays(startDate, endDate)
  if (!Number.isFinite(dayCount) || dayCount < 1) return null
  let firstHour
  try {
    firstHour = hourIndexOf(ephemeris, `${startDate}T00:00Z`)
  } catch {
    return null
  }
  return { firstHour, lastHour: Math.min(firstHour + dayCount * 24 - 1, ephemeris.hours - 1) }
}

/** The map hour kept inside the range; null gives the first hour. */
export function clampHour(hour, { firstHour, lastHour }) {
  return hour === null || hour === undefined ? firstHour : Math.min(lastHour, Math.max(firstHour, hour))
}

/** Next Play hour; past the last hour it wraps to the first. */
export function nextPlayHour(hour, stepHours, { firstHour, lastHour }) {
  const next = hour + stepHours
  return next > lastHour ? firstHour : next
}

/**
 * Share of hours with half the disk or more in view (the ranking's rule), per cell, over firstHour … firstHour + hourCount − 1.
 * @returns {{fractionSun: Float32Array, fractionEarth: Float32Array}}
 */
export function computeVisibilityFractions(cells, ephemeris, firstHour, hourCount) {
  const fractionSun = new Float32Array(cells.length)
  const fractionEarth = new Float32Array(cells.length)
  cells.forEach((cell, index) => {
    fractionSun[index] = fractionAtLeast(computeSunTrack(cell, ephemeris, firstHour, hourCount).diskFraction, VISIBLE_THRESHOLD, 0, hourCount)
    fractionEarth[index] = fractionAtLeast(computeEarthTrack(cell, ephemeris, firstHour, hourCount).diskFraction, VISIBLE_THRESHOLD, 0, hourCount)
  })
  return { fractionSun, fractionEarth }
}

/**
 * Sun and Earth over a stay starting at the map hour, for the hover card: min(stayDays × 24, hours left) hours.
 * @returns {{hourCount: number, sunDiskFraction: Float32Array, earthDiskFraction: Float32Array, fractionSun: number, fractionEarth: number}|null}
 */
export function stayPreview(cell, ephemeris, hour, stayDays) {
  if (hour === null || hour === undefined || !(stayDays > 0)) return null
  const hourCount = Math.min(stayDays * 24, ephemeris.hours - hour)
  const sunDiskFraction = computeSunTrack(cell, ephemeris, hour, hourCount).diskFraction
  const earthDiskFraction = computeEarthTrack(cell, ephemeris, hour, hourCount).diskFraction
  return {
    hourCount,
    sunDiskFraction,
    earthDiskFraction,
    fractionSun: fractionAtLeast(sunDiskFraction, VISIBLE_THRESHOLD, 0, hourCount),
    fractionEarth: fractionAtLeast(earthDiskFraction, VISIBLE_THRESHOLD, 0, hourCount),
  }
}

/** One pseudo-cell per region whose centre site exists (the 9 centre sites carry D4 horizons). */
export function regionCentreCells(regions, sites) {
  return regions
    .filter((region) => sites.some((site) => site.id === region.siteId))
    .map((region) => ({ regionCode: region.code, cell: resolveCurrentCell({ type: 'site', siteId: region.siteId }, {}, sites) }))
}
