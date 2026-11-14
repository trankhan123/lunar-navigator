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

test('nextCrossing interpolates between hourly samples', () => {
  assert.deepEqual(nextCrossing([1, 1, 0, 0], 0.5, 0), { direction: 'down', hoursFromNow: 1.5 })
  assert.deepEqual(nextCrossing([0, 0, 1], 0.5, 0.5), { direction: 'up', hoursFromNow: 1 })
  assert.equal(nextCrossing([1, 1, 1], 0.5, 0), null)
})
