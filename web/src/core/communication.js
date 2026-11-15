// C2 — Communication (direct-to-Earth). Contract: README "C2 Communication".
import {
  EARTH_DISK_RADIUS_DEG,
  VISIBLE_THRESHOLD,
  bodyAzimuthElevation,
  horizonElevationAt,
  visibleDiskFraction,
} from './geometry.js'
import { fractionAtLeast, longestRunBelow, nextCrossing } from './timeSeries.js'

/**
 * @typedef {Object} EarthTrack  one value per hour; index i ↔ ephemeris hour firstHour + i
 * @property {number} firstHour
 * @property {Float32Array} azimuthDeg
 * @property {Float32Array} elevationDeg
 * @property {Float32Array} diskFraction  0..1 of the Earth disk above the terrain horizon
 */

/** @returns {EarthTrack} */
export function computeEarthTrack(cell, ephemeris, firstHour, hourCount) {
  const azimuthDeg = new Float32Array(hourCount)
  const elevationDeg = new Float32Array(hourCount)
  const diskFraction = new Float32Array(hourCount)

  const dsn = ephemeris?.dsn
  const minDsnElev = dsn ? (dsn.elevationUnitDeg != null ? 10 / dsn.elevationUnitDeg : 100) : 0

  for (let i = 0; i < hourCount; i++) {
    const ephHour = firstHour + i
    const subLon = ephemeris.earthSubLonDeg[ephHour]
    const subLat = ephemeris.earthSubLatDeg[ephHour]
    const distKm = ephemeris.earthDistanceKm[ephHour]

    const { azimuthDeg: az, elevationDeg: el } = bodyAzimuthElevation(cell, subLon, subLat, distKm)
    azimuthDeg[i] = az
    elevationDeg[i] = el

    const horizonDeg = horizonElevationAt(cell.horizon, az)
    let fraction = visibleDiskFraction(el, horizonDeg, EARTH_DISK_RADIUS_DEG)

    if (dsn) {
      const g = dsn.goldstone?.[ephHour] ?? dsn.stations?.goldstone?.elevation?.[ephHour] ?? -Infinity
      const m = dsn.madrid?.[ephHour] ?? dsn.stations?.madrid?.elevation?.[ephHour] ?? -Infinity
      const c = dsn.canberra?.[ephHour] ?? dsn.stations?.canberra?.elevation?.[ephHour] ?? -Infinity
      const dsnAvailable = g >= minDsnElev || m >= minDsnElev || c >= minDsnElev
      if (!dsnAvailable) {
        fraction = 0
      }
    }

    diskFraction[i] = fraction
  }

  return {
    firstHour,
    azimuthDeg,
    elevationDeg,
    diskFraction,
  }
}

/**
 * Comm-loss hour = diskFraction < 0.5.
 * @returns {{longestCommLossHours:number, fractionEarth:number}}
 */
export function summarizeEarthWindow(earthTrack, startIndex, lengthHours) {
  return {
    longestCommLossHours: longestRunBelow(earthTrack.diskFraction, VISIBLE_THRESHOLD, startIndex, lengthHours),
    fractionEarth: fractionAtLeast(earthTrack.diskFraction, VISIBLE_THRESHOLD, startIndex, lengthHours),
  }
}

/** Countdown: @returns {{event:'earthset'|'earthrise', hoursFromNow:number}|null} */
export function nextEarthEvent(earthTrack, atIndex) {
  const crossing = nextCrossing(earthTrack.diskFraction, VISIBLE_THRESHOLD, atIndex)
  if (!crossing) return null
  return {
    event: crossing.direction === 'down' ? 'earthset' : 'earthrise',
    hoursFromNow: crossing.hoursFromNow,
  }
}
