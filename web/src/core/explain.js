// W5 / W7 — plain-English explanations. Contract: README "W5" and "W7".
/* eslint-disable no-unused-vars -- stub parameters; delete this line when you implement the module */
import { notImplemented } from './notImplemented.js'

/** 0° → 'north', 45° → 'north-east', … (8 directions). */
export function compassName(azimuthDeg) {
  throw notImplemented('W5', 'compassName')
}

/**
 * One English sentence on why two cells differ, e.g.
 * "Moving 2.3 km to MAL-r4c5 cuts the longest dark period from 72 h to 10 h because the northern ridge is 1.5° lower."
 * @param {{cell:Object, metrics:Object, sunTrack:Object, startIndex:number, lengthHours:number}} current
 * @param {{cell:Object, metrics:Object, sunTrack:Object, startIndex:number, lengthHours:number}} other
 * @returns {string}
 */
export function explainDifference(current, other) {
  throw notImplemented('W5', 'explainDifference')
}

/**
 * Learn mode card "Why 1 km matters": the pair of neighbouring cells (≤ maxDistanceKm apart)
 * with the largest difference in longestDarkHours at one landing time.
 * @returns {{cellIdA:string, cellIdB:string, distanceKm:number, longestDarkHoursA:number, longestDarkHoursB:number}|null}
 */
export function findMostDifferentNeighbors(results, cellsById, landingIndex, maxDistanceKm = 1.5) {
  throw notImplemented('W7', 'findMostDifferentNeighbors')
}
