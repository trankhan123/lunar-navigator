import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertNear } from './testHelpers.js'
import { firstIndexBelow, fractionAtLeast, fractionBothAtLeast, longestRunBelow, meanWhereAtLeast, nextCrossing } from './timeSeries.js'

const values = [1, 0.2, 0.3, 1, 0.1, 0.4, 0.2]

test('longestRunBelow counts consecutive hours inside the window only', () => {
  assert.equal(longestRunBelow(values, 0.5, 0, 7), 3)
  assert.equal(longestRunBelow(values, 0.5, 1, 3), 2)
})

test('fractions', () => {
  assertNear(fractionAtLeast(values, 0.5, 0, 4), 0.5)
  assertNear(fractionBothAtLeast([1, 1, 0, 1], [1, 0, 1, 1], 0.5, 0, 4), 0.5)
})

test('firstIndexBelow returns an offset from start, or null', () => {
  assert.equal(firstIndexBelow(values, 0.5, 0, 7), 1)
  assert.equal(firstIndexBelow(values, 0.5, 3, 4), 1)
  assert.equal(firstIndexBelow([1, 1], 0.5, 0, 2), null)
})

test('meanWhereAtLeast', () => {
  assertNear(meanWhereAtLeast([10, 20, 30], [1, 0, 1], 0.5, 0, 3), 20)
  assert.equal(meanWhereAtLeast([10, 20], [0, 0], 0.5, 0, 2), null)
})

test('window functions refuse windows outside the series', () => {
  assert.throws(() => longestRunBelow([1, 0, 0, 1], 0.5, 2, 5), RangeError)
  assert.throws(() => firstIndexBelow([1, 1], 0.5, -1, 1), RangeError)
})

test('nextCrossing when the value sits exactly on the threshold, and chained countdowns', () => {
  assertNear(nextCrossing([0.5, 0.2, 0.1, 0.8], 0.5, 0).hoursFromNow, 2 + 0.4 / 0.7)
  assert.equal(nextCrossing([0.5, 0.2, 0.1, 0.8], 0.5, 0).direction, 'up')
  const series = [1, 1, 0.8, 0.3, 0, 0, 0, 0.2, 0.7, 1, 1, 0.6, 0.1, 0, 0]
  const sunset = nextCrossing(series, 0.5, 0)
  assert.equal(sunset.direction, 'down')
  assertNear(sunset.hoursFromNow, 2.6)
  const sunrise = nextCrossing(series, 0.5, sunset.hoursFromNow)
  assert.equal(sunrise.direction, 'up')
  assertNear(sunrise.hoursFromNow, 5)
  assert.equal(nextCrossing(series, 0.5, -1), null)
})

test('nextCrossing interpolates between hourly samples', () => {
  assert.deepEqual(nextCrossing([1, 1, 0, 0], 0.5, 0), { direction: 'down', hoursFromNow: 1.5 })
  assert.deepEqual(nextCrossing([0, 0, 1], 0.5, 0.5), { direction: 'up', hoursFromNow: 1 })
  assert.equal(nextCrossing([1, 1, 1], 0.5, 0), null)
})
