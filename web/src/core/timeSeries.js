// C0 — hourly series helpers. Contract: README "C0 Shared geometry and time series".
/* eslint-disable no-unused-vars -- stub parameters; delete this line when you implement the module */
// Every function reads values[start] … values[start + length - 1]; one value = one hour.
import { notImplemented } from './notImplemented.js'

/** Longest run of consecutive values below threshold. @returns {number} hours */
export function longestRunBelow(values, threshold, start, length) {
  let longest = 0
  let current = 0
  for (let i = start; i < start + length; i++) {
    current = values[i] < threshold ? current + 1 : 0
    if (current > longest) longest = current
  }
  return longest
}

/** Share of values ≥ threshold. @returns {number} 0..1 (0 when length is 0) */
export function fractionAtLeast(values, threshold, start, length) {
  if (length === 0) return 0
  let count = 0
  for (let i = start; i < start + length; i++) if (values[i] >= threshold) count++
  return count / length
}

/** Share of hours where a[i] ≥ threshold and b[i] ≥ threshold. @returns {number} 0..1 */
export function fractionBothAtLeast(a, b, threshold, start, length) {
  if (length === 0) return 0
  let count = 0
  for (let i = start; i < start + length; i++) if (a[i] >= threshold && b[i] >= threshold) count++
  return count / length
}

/** First offset (from start) whose value is below threshold. @returns {number|null} */
export function firstIndexBelow(values, threshold, start, length) {
  for (let i = start; i < start + length; i++) if (values[i] < threshold) return i - start
  return null
}

/** Mean of values[i] over hours where gate[i] ≥ threshold. @returns {number|null} null when no such hour */
export function meanWhereAtLeast(values, gate, threshold, start, length) {
  let sum = 0
  let count = 0
  for (let i = start; i < start + length; i++) {
    if (gate[i] >= threshold) {
      sum += values[i]
      count++
    }
  }
  return count === 0 ? null : sum / count
}

/**
 * Next time the series crosses threshold after atIndex (atIndex may be fractional), with linear
 * interpolation between hourly samples. 'down' = goes from ≥ threshold to < threshold.
 * @returns {{direction:'down'|'up', hoursFromNow:number}|null} null when no crossing before the series ends
 */
export function nextCrossing(values, threshold, atIndex) {
  const lower = Math.floor(atIndex)
  if (lower >= values.length - 1) return null
  const valueNow = values[lower] + (values[lower + 1] - values[lower]) * (atIndex - lower)
  const isAbove = valueNow >= threshold
  // Walk the hourly segments after atIndex until the series lands on the other side of threshold.
  for (let i = lower; i < values.length - 1; i++) {
    const next = values[i + 1]
    if ((next >= threshold) === isAbove) continue
    const crossingIndex = i + (threshold - values[i]) / (next - values[i])
    if (crossingIndex <= atIndex) continue
    return { direction: isAbove ? 'down' : 'up', hoursFromNow: crossingIndex - atIndex }
  }
  return null
}
