// C5 — Optimizer: best nearby cells and landing times. Contract: README "C5 Optimizer".
/* eslint-disable no-unused-vars -- stub parameters; delete this line when you implement the module */
import { notImplemented } from './notImplemented.js'

export const LANDING_STEP_HOURS = 6
export const MARGINAL_BATTERY_FRACTION = 0.2
export const STATUS = { fail: 0, marginal: 1, pass: 2 }
export const FAIL_REASON_BITS = { dark: 1, commLoss: 2, battery: 4 }

/**
 * @typedef {Object} WindowMetrics  one (cell, landing time) pair, window = stayDays × 24 hours
 * @property {'pass'|'marginal'|'fail'} status
 * @property {('dark'|'commLoss'|'battery')[]} failReasons
 * @property {number} longestDarkHours
 * @property {number} longestCommLossHours
 * @property {number} fractionSun
 * @property {number} fractionEarth
 * @property {number} fractionBoth
 * @property {number|null} meanSunElevationDeg
 * @property {number|null} hoursToSunset
 * @property {number} minBatteryFraction
 * @property {number|null} deadAtHour
 * @property {number|null} rechargeHours
 */

/**
 * @typedef {Object} WindowResults  flat typed arrays, index = cellIndex * landingCount + landingIndex
 *   cell 0 is always the current point. null values use sentinels: −1 for integers, NaN for floats.
 * @property {string[]} cellIds
 * @property {Float32Array} distanceKm  per cell, from the current point
 * @property {string[]} landingTimes    'YYYY-MM-DDTHH:mmZ', every 6 h from startDate 00:00Z
 * @property {number} cellCount
 * @property {number} landingCount
 * @property {Uint8Array} status        STATUS codes
 * @property {Uint8Array} failReasonBits
 * @property {Float32Array} minBatteryFraction
 * @property {Uint16Array} longestDarkHours
 * @property {Uint16Array} longestCommLossHours
 * @property {Float32Array} fractionSun
 * @property {Float32Array} fractionEarth
 * @property {Float32Array} fractionBoth
 * @property {Float32Array} meanSunElevationDeg
 * @property {Int16Array} hoursToSunset
 * @property {Int16Array} rechargeHours
 * @property {Int16Array} deadAtHour
 */

/** @returns {WindowMetrics} */
export function evaluateWindow(sunTrack, earthTrack, startIndex, scenario) {
  throw notImplemented('C5', 'evaluateWindow')
}

/**
 * Feasible cells in the search scope, with the current point first and no duplicate ids.
 * @param {Object<string, import('./data.js').Cell[]>} cellsByRegion  e.g. { MAL: [...] }
 * @returns {import('./data.js').Cell[]}
 */
export function selectSearchCells(scenario, currentCell, cellsByRegion) {
  throw notImplemented('C5', 'selectSearchCells')
}

/**
 * Slides the stay window over every landing time for every cell (runs inside the Web Worker).
 * @param {(doneCells:number, totalCells:number) => void} [onProgress]
 * @returns {WindowResults}
 */
export function runWindowSearch(cells, ephemeris, scenario, onProgress) {
  throw notImplemented('C5', 'runWindowSearch')
}

/** @returns {WindowMetrics & {cellIndex:number, cellId:string, landingIndex:number, landingTime:string, distanceKm:number}} */
export function metricsAt(results, cellIndex, landingIndex) {
  throw notImplemented('C5', 'metricsAt')
}

/**
 * Top cells at one landing time. Default order: pass/marginal first, then higher minBatteryFraction,
 * higher fractionBoth, smaller distanceKm, smaller longestCommLossHours. Other sortBy keys sort that column (better first unless direction given), nulls last.
 * @param {{sortBy?:string, direction?:'asc'|'desc', limit?:number}} [options]
 * @returns {(ReturnType<typeof metricsAt> & {rank:number})[]}
 */
export function rankCells(results, landingIndex, options) {
  throw notImplemented('C5', 'rankCells')
}

/** Top (cell, landing time) pairs over the whole date range, default order. */
export function rankBestPairs(results, options) {
  throw notImplemented('C5', 'rankBestPairs')
}

/**
 * "Your current point" card.
 * @returns {{metrics:ReturnType<typeof metricsAt>,
 *            nearestPassingLanding:{landingIndex:number, landingTime:string, offsetHours:number}|null,
 *            nearestPassingCell:{cellIndex:number, cellId:string, distanceKm:number}|null}}
 */
export function summarizeCurrentPoint(results, landingIndex) {
  throw notImplemented('C5', 'summarizeCurrentPoint')
}
