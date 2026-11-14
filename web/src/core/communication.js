// C2 — Communication (direct-to-Earth). Contract: README "C2 Communication".
/* eslint-disable no-unused-vars -- stub parameters; delete this line when you implement the module */
import { notImplemented } from './notImplemented.js'

/**
 * @typedef {Object} EarthTrack  one value per hour; index i ↔ ephemeris hour firstHour + i
 * @property {number} firstHour
 * @property {Float32Array} azimuthDeg
 * @property {Float32Array} elevationDeg
 * @property {Float32Array} diskFraction  0..1 of the Earth disk above the terrain horizon
 */

/** @returns {EarthTrack} */
export function computeEarthTrack(cell, ephemeris, firstHour, hourCount) {
  throw notImplemented('C2', 'computeEarthTrack')
}

/**
 * Comm-loss hour = diskFraction < 0.5.
 * @returns {{longestCommLossHours:number, fractionEarth:number}}
 */
export function summarizeEarthWindow(earthTrack, startIndex, lengthHours) {
  throw notImplemented('C2', 'summarizeEarthWindow')
}

/** Countdown: @returns {{event:'earthset'|'earthrise', hoursFromNow:number}|null} */
export function nextEarthEvent(earthTrack, atIndex) {
  throw notImplemented('C2', 'nextEarthEvent')
}
