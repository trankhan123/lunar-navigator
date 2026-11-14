// C1 — Sunlight. Contract: README "C1 Sunlight".
/* eslint-disable no-unused-vars -- stub parameters; delete this line when you implement the module */
import { notImplemented } from './notImplemented.js'

/**
 * @typedef {Object} SunTrack  one value per hour; index i ↔ ephemeris hour firstHour + i
 * @property {number} firstHour
 * @property {'vertical'|'horizontal'} panelType
 * @property {Float32Array} azimuthDeg
 * @property {Float32Array} elevationDeg
 * @property {Float32Array} diskFraction  0..1 of the Sun disk above the terrain horizon
 * @property {Float32Array} powerFactor   (1 AU / D)² × diskFraction × panelFactor, 0..~1.04
 */

/** 'auto' → 'vertical' when |lat| ≥ 60°, else 'horizontal'. @returns {'vertical'|'horizontal'} */
export function resolvePanelType(panelMode, latDeg) {
  throw notImplemented('C1', 'resolvePanelType')
}

/** vertical: cos(el); horizontal: max(sin(el), 0). @returns {number} */
export function panelFactor(elevationDeg, panelType) {
  throw notImplemented('C1', 'panelFactor')
}

/**
 * @param {import('./data.js').Cell} cell
 * @param {import('./data.js').Ephemeris} ephemeris
 * @param {number} firstHour  ephemeris hour index of track index 0
 * @param {number} hourCount
 * @param {'auto'|'vertical'|'horizontal'} panelMode
 * @returns {SunTrack}
 */
export function computeSunTrack(cell, ephemeris, firstHour, hourCount, panelMode) {
  throw notImplemented('C1', 'computeSunTrack')
}

/**
 * Dark hour = diskFraction < 0.5. Sunlit hour = diskFraction ≥ 0.5.
 * @returns {{longestDarkHours:number, fractionSun:number, meanSunElevationDeg:number|null, hoursToSunset:number|null}}
 *   meanSunElevationDeg: mean over sunlit hours (null if none); hoursToSunset: offset of the first dark hour (0 if dark at start, null if never)
 */
export function summarizeSunWindow(sunTrack, startIndex, lengthHours) {
  throw notImplemented('C1', 'summarizeSunWindow')
}

/** Countdown: @returns {{event:'sunset'|'sunrise', hoursFromNow:number}|null} */
export function nextSunEvent(sunTrack, atIndex) {
  throw notImplemented('C1', 'nextSunEvent')
}
