import { test } from 'node:test'
import assert from 'node:assert/strict'
import { STATUS } from './optimizer.js'
import { slipOutlook } from './slip.js'

// Synthetic results (not real data): 2 cells x 6 landing times; only the fields metricsAt reads.
const P = STATUS.pass
const M = STATUS.marginal
const F = STATUS.fail
function makeResults(cell0, cell1) {
  const status = Uint8Array.from([...cell0, ...cell1])
  const zeros = () => new Float32Array(status.length)
  return {
    cellCount: 2, landingCount: 6, status,
    cellIds: ['HERE', 'NEAR'], distanceKm: new Float32Array([0, 3]),
    landingTimes: [0, 1, 2, 3, 4, 5].map((k) => `2028-01-01T${String(k * 6).padStart(2, '0')}:00Z`),
    failReasonBits: zeros(), longestDarkHours: zeros(), longestCommLossHours: zeros(), fractionSun: zeros(),
    fractionEarth: zeros(), fractionBoth: zeros(), meanSunElevationDeg: zeros(), hoursToSunset: zeros(),
    minBatteryFraction: zeros(), deadAtHour: zeros(), rechargeHours: zeros(),
  }
}

test('pass with slack: slip until the last passing landing time', () => {
  const r = slipOutlook(makeResults([F, P, P, P, F, P], [F, F, F, F, F, F]), 1)
  assert.deepEqual(r, { kind: 'canSlip', slipHours: 12, untilTime: '2028-01-01T18:00Z', reachesSearchEnd: false })
})

test('pass at the last landing time: no slack, reaches the search end', () => {
  const r = slipOutlook(makeResults([F, F, F, F, F, P], [F, F, F, F, F, F]), 5)
  assert.equal(r.slipHours, 0)
  assert.equal(r.reachesSearchEnd, true)
})

test('marginal counts as pass', () => {
  const r = slipOutlook(makeResults([M, M, P, F, F, F], [F, F, F, F, F, F]), 0)
  assert.equal(r.slipHours, 12)
})

test('fail with a later window and a nearby cell', () => {
  const r = slipOutlook(makeResults([F, F, F, P, P, F], [F, F, P, F, F, F]), 2)
  assert.deepEqual(r, { kind: 'blocked', nextLandingTime: '2028-01-01T18:00Z', hoursUntilNext: 6, nearestCellId: 'NEAR', nearestCellDistanceKm: 3 })
})

test('fail with nothing', () => {
  const r = slipOutlook(makeResults([F, F, F, F, F, F], [F, F, F, F, F, F]), 2)
  assert.deepEqual(r, { kind: 'blocked', nextLandingTime: null, hoursUntilNext: null, nearestCellId: null, nearestCellDistanceKm: null })
})
