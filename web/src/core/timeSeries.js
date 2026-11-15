// C0 — hourly series helpers. Contract: docs/technical-reference.md "C0 Shared geometry and time series".
// Every window function reads values[start] … values[start + length - 1]; one value = one hour.

function checkWindow(values, start, length) {
  if (start < 0 || length < 0 || start + length > values.length) {
    throw new RangeError(`Window ${start}…${start + length - 1} is outside the series (length ${values.length})`)
  }
}

/** Longest run of consecutive values below threshold. @returns {number} hours */
export function longestRunBelow(values, threshold, start, length) {
  checkWindow(values, start, length)
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
  checkWindow(values, start, length)
  if (length === 0) return 0
  let count = 0
  for (let i = start; i < start + length; i++) if (values[i] >= threshold) count++
  return count / length
}

/** Share of hours where a[i] ≥ threshold and b[i] ≥ threshold. @returns {number} 0..1 */
export function fractionBothAtLeast(a, b, threshold, start, length) {
  checkWindow(a, start, length)
  checkWindow(b, start, length)
  if (length === 0) return 0
  let count = 0
  for (let i = start; i < start + length; i++) if (a[i] >= threshold && b[i] >= threshold) count++
  return count / length
}

/** First offset (from start) whose value is below threshold. @returns {number|null} */
export function firstIndexBelow(values, threshold, start, length) {
  checkWindow(values, start, length)
  for (let i = start; i < start + length; i++) if (values[i] < threshold) return i - start
  return null
}

/** Mean of values[i] over hours where gate[i] ≥ threshold. @returns {number|null} null when no such hour */
export function meanWhereAtLeast(values, gate, threshold, start, length) {
  checkWindow(values, start, length)
  checkWindow(gate, start, length)
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
  if (lower < 0 || lower >= values.length - 1) return null
  const valueNow = values[lower] + (values[lower + 1] - values[lower]) * (atIndex - lower)
  let isAbove = valueNow >= threshold
  for (let i = lower; i < values.length - 1; i++) {
    const fromIndex = Math.max(i, atIndex)
    const fromValue = i === lower ? valueNow : values[i]
    const next = values[i + 1]
    if ((next >= threshold) === isAbove) continue
    const crossingIndex = fromIndex + ((threshold - fromValue) / (next - fromValue)) * (i + 1 - fromIndex)
    if (crossingIndex > atIndex) return { direction: isAbove ? 'down' : 'up', hoursFromNow: crossingIndex - atIndex }
    isAbove = !isAbove // exactly on the threshold now: just after atIndex the series is on the other side
  }
  return null
}
