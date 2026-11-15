import { computeEarthTrack } from './communication.js'
import { VISIBLE_THRESHOLD } from './geometry.js'
import { computeSunTrack } from './sunlight.js'

export const SEASONAL_DAYS_2027 = 365
export const SEASONAL_DAYS_2028 = 366
export const TOTAL_SEASONAL_DAYS = SEASONAL_DAYS_2027 + SEASONAL_DAYS_2028 // 731 days
export const TOTAL_SEASONAL_HOURS = TOTAL_SEASONAL_DAYS * 24 // 17,544 hours

const DAY_MS = 86400000

/**
 * Computes daily sunlight and Earth visibility percentages for the 2 years 2027-2028.
 *
 * @param {{lat: number, lon: number, heightM?: number, horizon?: number[]|null}} cell
 * @param {import('./data.js').Ephemeris} ephemeris
 * @returns {{
 *   sun: { '2027': [string, number][], '2028': [string, number][] },
 *   earth: { '2027': [string, number][], '2028': [string, number][] },
 *   sun2027: [string, number][],
 *   sun2028: [string, number][],
 *   earth2027: [string, number][],
 *   earth2028: [string, number][]
 * }}
 */
export function computeSeasonalCalendar(cell, ephemeris) {
  if (!cell || !ephemeris || !ephemeris.sunSubLonDeg || !ephemeris.earthSubLonDeg) {
    return {
      sun: { '2027': [], '2028': [] },
      earth: { '2027': [], '2028': [] },
      sun2027: [],
      sun2028: [],
      earth2027: [],
      earth2028: [],
    }
  }

  const safeCell = {
    lat: cell.lat,
    lon: cell.lon,
    heightM: cell.heightM ?? 0,
    horizon: cell.horizon ?? null,
  }

  const availableHours = Math.min(ephemeris.hours, TOTAL_SEASONAL_HOURS)
  const sunTrack = computeSunTrack(safeCell, ephemeris, 0, availableHours, 'auto')
  const earthTrack = computeEarthTrack(safeCell, ephemeris, 0, availableHours)

  const sun2027 = []
  const sun2028 = []
  const earth2027 = []
  const earth2028 = []

  const startMs = Date.parse(ephemeris.startTime)
  const dayCount = Math.min(TOTAL_SEASONAL_DAYS, Math.floor(availableHours / 24))

  for (let d = 0; d < dayCount; d++) {
    const dateStr = new Date(startMs + d * DAY_MS).toISOString().slice(0, 10)
    let sunHours = 0
    let earthHours = 0
    const baseHour = d * 24

    for (let h = 0; h < 24; h++) {
      if (sunTrack.diskFraction[baseHour + h] >= VISIBLE_THRESHOLD) sunHours++
      if (earthTrack.diskFraction[baseHour + h] >= VISIBLE_THRESHOLD) earthHours++
    }

    const sunPct = Math.round((sunHours / 24) * 1000) / 10
    const earthPct = Math.round((earthHours / 24) * 1000) / 10

    if (dateStr.startsWith('2027')) {
      sun2027.push([dateStr, sunPct])
      earth2027.push([dateStr, earthPct])
    } else if (dateStr.startsWith('2028')) {
      sun2028.push([dateStr, sunPct])
      earth2028.push([dateStr, earthPct])
    }
  }

  return {
    sun: { '2027': sun2027, '2028': sun2028 },
    earth: { '2027': earth2027, '2028': earth2028 },
    sun2027,
    sun2028,
    earth2027,
    earth2028,
  }
}
