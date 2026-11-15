// W5 — data for the detail screen of one cell. Contract: docs/technical-reference.md "W5 Detail".
import { simulateBattery } from './charging.js'
import { computeEarthTrack, nextEarthEvent, summarizeEarthWindow } from './communication.js'
import { hourIndexOf, timeAtHour } from './data.js'
import { summarizeEnergyNeed } from './energyNeed.js'
import { countdownText } from './format.js'
import { VISIBLE_THRESHOLD } from './geometry.js'
import { computeSunTrack, nextSunEvent, summarizeSunWindow } from './sunlight.js'

export const DETAIL_LOOKAHEAD_HOURS = 30 * 24
const CSV_HEADER = 'time,sunAzimuthDeg,sunElevationDeg,sunDiskFraction,earthAzimuthDeg,earthElevationDeg,earthDiskFraction,batteryWh'

/**
 * Everything the detail screen shows for one cell and one landing time, computed with C1–C4.
 * Tracks cover the stay plus up to 30 days more (so countdowns near the end of the stay still work);
 * both are cut at the end of the ephemeris. C1–C4 are all implemented, so every part is filled; module errors are thrown.
 * @param {import('./data.js').Cell} cell
 * @param {import('./data.js').Ephemeris} ephemeris
 * @param {Object} scenario  uses stayDays, panelMode, panelMaxW, loadW, batteryCapacityWh
 * @param {string} landingTime  'YYYY-MM-DDTHH:mmZ' inside the ephemeris (hourIndexOf throws otherwise)
 * @returns {{
 *   landingHour: number,        ephemeris hour index of the landing
 *   stayHours: number,          min(stayDays × 24, hours left in the ephemeris)
 *   trackHours: number,         min(stayHours + DETAIL_LOOKAHEAD_HOURS, hours left in the ephemeris)
 *   sun: Object,                SunTrack (C1) with trackHours values; required, errors are thrown
 *   earth: Object,              EarthTrack (C2) with trackHours values
 *   sunSummary: Object,         summarizeSunWindow(sun, 0, stayHours)
 *   earthSummary: Object,       summarizeEarthWindow(earth, 0, stayHours)
 *   battery: Object,            simulateBattery(sun.powerFactor, 0, stayHours, scenario) (C4)
 *   energy: Object              summarizeEnergyNeed(sun, 0, stayHours, scenario) (C3)
 * }}
 */
export function buildDetail(cell, ephemeris, scenario, landingTime) {
  const landingHour = hourIndexOf(ephemeris, landingTime)
  const hoursLeft = ephemeris.hours - landingHour
  const stayHours = Math.min(scenario.stayDays * 24, hoursLeft)
  const trackHours = Math.min(stayHours + DETAIL_LOOKAHEAD_HOURS, hoursLeft)
  const sun = computeSunTrack(cell, ephemeris, landingHour, trackHours, scenario.panelMode)
  const earth = computeEarthTrack(cell, ephemeris, landingHour, trackHours, scenario.requireDsn)
  return {
    landingHour,
    stayHours,
    trackHours,
    sun,
    earth,
    sunSummary: summarizeSunWindow(sun, 0, stayHours),
    earthSummary: summarizeEarthWindow(earth, 0, stayHours),
    battery: simulateBattery(sun.powerFactor, 0, stayHours, scenario),
    energy: summarizeEnergyNeed(sun, 0, stayHours, scenario),
  }
}

/**
 * [azimuthDeg, elevationDeg] points of track indices start … start+length−1 for an ECharts line, with a null
 * between two consecutive hours whose azimuths are more than 180° apart (the path crossed north, 0°/360°),
 * so the line does not cut across the whole chart.
 * @returns {([number, number]|null)[]}
 */
export function pathForChart(azimuthDeg, elevationDeg, start, length) {
  const points = []
  for (let i = start; i < start + length; i++) {
    if (i > start && Math.abs(azimuthDeg[i] - azimuthDeg[i - 1]) > 180) points.push(null)
    points.push([azimuthDeg[i], elevationDeg[i]])
  }
  return points
}

const rounded = (value, digits) => Number(value.toFixed(digits))

/**
 * CSV of the stay, one row per hour i = 0 … stayHours−1, header first, lines joined with '\n':
 * time,sunAzimuthDeg,sunElevationDeg,sunDiskFraction,earthAzimuthDeg,earthElevationDeg,earthDiskFraction,batteryWh
 * time = timeAtHour(ephemeris, landingHour + i). Angles and fractions rounded to 3 decimals, batteryWh (value at the
 * start of hour i) to 1 decimal. Parts that are null in the detail give empty fields.
 * @returns {string}
 */
export function toCsv(detail, ephemeris) {
  const { sun, earth, battery } = detail
  const bodyFields = (track, i) => (track ? [track.azimuthDeg[i], track.elevationDeg[i], track.diskFraction[i]].map((value) => rounded(value, 3)) : ['', '', ''])
  const lines = [CSV_HEADER]
  for (let i = 0; i < detail.stayHours; i++) {
    const batteryField = battery ? rounded(battery.batteryWh[i], 1) : ''
    lines.push([timeAtHour(ephemeris, detail.landingHour + i), ...bodyFields(sun, i), ...bodyFields(earth, i), batteryField].join(','))
  }
  return lines.join('\n')
}

/**
 * Plain-English headline at track index atIndex (Simple mode), built from countdownText:
 *   Sun visible (diskFraction ≥ 0.5): 'Day at <label>: Sun <elevation, 1 decimal>° high. <sun countdown>.'
 *   otherwise:                         'Night at <label>. <sun countdown>.'
 *   then, only when earth is not null: ' <earth countdown>.'
 * e.g. 'Night at MAL-r5c4. Sunlight returns in 3 d 12 h. Earth sets in 18 h.'
 * @returns {string}
 */
export function summarySentence(detail, cellLabel, atIndex) {
  const { sun, earth } = detail
  const hoursLeft = detail.trackHours - 1 - atIndex // up to the last sample of the track
  const sunVisible = sun.diskFraction[atIndex] >= VISIBLE_THRESHOLD
  const opening = sunVisible ? `Day at ${cellLabel}: Sun ${sun.elevationDeg[atIndex].toFixed(1)}° high.` : `Night at ${cellLabel}.`
  let sentence = `${opening} ${countdownText('sun', nextSunEvent(sun, atIndex), sunVisible, hoursLeft)}.`
  if (earth) {
    const earthVisible = earth.diskFraction[atIndex] >= VISIBLE_THRESHOLD
    sentence += ` ${countdownText('earth', nextEarthEvent(earth, atIndex), earthVisible, hoursLeft)}.`
  }
  return sentence
}
