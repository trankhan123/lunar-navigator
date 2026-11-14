// C0 — hourly series helpers. Contract: README "C0 Shared geometry and time series".
/* eslint-disable no-unused-vars -- stub parameters; delete this line when you implement the module */
// Every function reads values[start] … values[start + length - 1]; one value = one hour.
import { notImplemented } from './notImplemented.js'

/** Longest run of consecutive values below threshold. @returns {number} hours */
export function longestRunBelow(values, threshold, start, length) {
  throw notImplemented('C0', 'longestRunBelow')
}

/** Share of values ≥ threshold. @returns {number} 0..1 (0 when length is 0) */
export function fractionAtLeast(values, threshold, start, length) {
  throw notImplemented('C0', 'fractionAtLeast')
}

/** Share of hours where a[i] ≥ threshold and b[i] ≥ threshold. @returns {number} 0..1 */
export function fractionBothAtLeast(a, b, threshold, start, length) {
  throw notImplemented('C0', 'fractionBothAtLeast')
}

/** First offset (from start) whose value is below threshold. @returns {number|null} */
export function firstIndexBelow(values, threshold, start, length) {
  throw notImplemented('C0', 'firstIndexBelow')
}

/** Mean of values[i] over hours where gate[i] ≥ threshold. @returns {number|null} null when no such hour */
export function meanWhereAtLeast(values, gate, threshold, start, length) {
  throw notImplemented('C0', 'meanWhereAtLeast')
}

/**
 * Next time the series crosses threshold after atIndex (atIndex may be fractional), with linear
 * interpolation between hourly samples. 'down' = goes from ≥ threshold to < threshold.
 * @returns {{direction:'down'|'up', hoursFromNow:number}|null} null when no crossing before the series ends
 */
export function nextCrossing(values, threshold, atIndex) {
  throw notImplemented('C0', 'nextCrossing')
}
