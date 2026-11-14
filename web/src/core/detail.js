// W5 — data for the detail screen of one cell. Contract: README "W5 Detail".
/* eslint-disable no-unused-vars -- stub parameters; delete this line when you implement the module */
import { notImplemented } from './notImplemented.js'

export const DETAIL_LOOKAHEAD_HOURS = 30 * 24

/**
 * Everything the detail screen shows for one cell and one landing time, computed with C1–C4.
 * Tracks cover the stay plus up to 30 days more (so countdowns near the end of the stay still work);
 * both are cut at the end of the ephemeris. Parts whose module is still a stub are null.
 * @param {import('./data.js').Cell} cell
 * @param {import('./data.js').Ephemeris} ephemeris
 * @param {Object} scenario  uses stayDays, panelMode, panelMaxW, loadW, batteryCapacityWh
 * @param {string} landingTime  'YYYY-MM-DDTHH:mmZ' inside the ephemeris (hourIndexOf throws otherwise)
 * @returns {{
 *   landingHour: number,        ephemeris hour index of the landing
 *   stayHours: number,          min(stayDays × 24, hours left in the ephemeris)
 *   trackHours: number,         min(stayHours + DETAIL_LOOKAHEAD_HOURS, hours left in the ephemeris)
 *   sun: Object,                SunTrack (C1) with trackHours values; required, errors are thrown
 *   earth: Object|null,         EarthTrack (C2) with trackHours values, null while C2 is a stub
 *   sunSummary: Object,         summarizeSunWindow(sun, 0, stayHours)
 *   earthSummary: Object|null,  summarizeEarthWindow(earth, 0, stayHours), null without earth
 *   battery: Object|null,       simulateBattery(sun.powerFactor, 0, stayHours, scenario) (C4), null while C4 is a stub
 *   energy: Object|null         summarizeEnergyNeed(sun, 0, stayHours, scenario) (C3), null while C3 is a stub
 * }}
 */
export function buildDetail(cell, ephemeris, scenario, landingTime) {
  throw notImplemented('W5', 'buildDetail')
}

/**
 * [azimuthDeg, elevationDeg] points of track indices start … start+length−1 for an ECharts line, with a null
 * between two consecutive hours whose azimuths are more than 180° apart (the path crossed north, 0°/360°),
 * so the line does not cut across the whole chart.
 * @returns {([number, number]|null)[]}
 */
export function pathForChart(azimuthDeg, elevationDeg, start, length) {
  throw notImplemented('W5', 'pathForChart')
}

/**
 * CSV of the stay, one row per hour i = 0 … stayHours−1, header first, lines joined with '\n':
 * time,sunAzimuthDeg,sunElevationDeg,sunDiskFraction,earthAzimuthDeg,earthElevationDeg,earthDiskFraction,batteryWh
 * time = timeAtHour(ephemeris, landingHour + i). Angles and fractions rounded to 3 decimals, batteryWh (value at the
 * start of hour i) to 1 decimal. Parts that are null in the detail give empty fields.
 * @returns {string}
 */
export function toCsv(detail, ephemeris) {
  throw notImplemented('W5', 'toCsv')
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
  throw notImplemented('W5', 'summarySentence')
}
