import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertNear, constantEphemeris, equatorCell } from './testHelpers.js'
import { evaluateWindow, rankCells, runWindowSearch, summarizeCurrentPoint } from './optimizer.js'
import { DEFAULT_SCENARIO } from './scenario.js'

const fill = (value, length = 24) => new Float32Array(length).fill(value)
const sunny = { firstHour: 0, panelType: 'vertical', diskFraction: fill(1), powerFactor: fill(1), elevationDeg: fill(2), azimuthDeg: fill(0) }
const dark = { ...sunny, diskFraction: fill(0), powerFactor: fill(0) }
const earthUp = { firstHour: 0, diskFraction: fill(1), elevationDeg: fill(5), azimuthDeg: fill(0) }
const earthDown = { ...earthUp, diskFraction: fill(0) }
const oneDay = { ...DEFAULT_SCENARIO, stayDays: 1 }

test('evaluateWindow pass / fail / marginal', () => {
  const pass = evaluateWindow(sunny, earthUp, 0, oneDay)
  assert.equal(pass.status, 'pass')
  assert.deepEqual(pass.failReasons, [])
  assert.equal(pass.fractionBoth, 1)

  const noEarth = evaluateWindow(sunny, earthDown, 0, oneDay)
  assert.equal(noEarth.status, 'fail')
  assert.deepEqual(noEarth.failReasons, ['commLoss'])

  // 24 dark hours is allowed (≤ 24) but 300 W × 24 h leaves 800 of 8000 Wh = 10 % → marginal.
  const lowBattery = evaluateWindow(dark, earthUp, 0, { ...oneDay, batteryCapacityWh: 8000 })
  assert.equal(lowBattery.status, 'marginal')
  assertNear(lowBattery.minBatteryFraction, 0.1, 1e-6)
})

test('runWindowSearch: shape of WindowResults', () => {
  const scenario = { ...DEFAULT_SCENARIO, startDate: '2028-01-01', endDate: '2028-01-01', stayDays: 1 }
  const cells = [equatorCell, { ...equatorCell, id: 'TEST-b', lon: 1 }]
  const results = runWindowSearch(cells, constantEphemeris({ hours: 48 }), scenario)
  assert.deepEqual(results.cellIds, ['TEST-a', 'TEST-b'])
  assert.equal(results.cellCount, 2)
  assert.equal(results.landingCount, 4)
  assert.deepEqual(results.landingTimes, ['2028-01-01T00:00Z', '2028-01-01T06:00Z', '2028-01-01T12:00Z', '2028-01-01T18:00Z'])
  assert.ok(results.status instanceof Uint8Array && results.status.length === 8)
  assertNear(results.distanceKm[1], (Math.PI / 180) * 1737.4, 1e-3)
})

function makeResults({ status, minBatteryFraction, distanceKm, landingCount }) {
  const size = status.length
  return {
    cellIds: distanceKm.map((_, index) => `TEST-${index}`),
    distanceKm: Float32Array.from(distanceKm),
    landingTimes: Array.from({ length: landingCount }, (_, index) => `2028-01-01T${String(index * 6).padStart(2, '0')}:00Z`),
    cellCount: distanceKm.length,
    landingCount,
    status: Uint8Array.from(status),
    failReasonBits: Uint8Array.from(status, (code) => (code === 0 ? 1 : 0)),
    minBatteryFraction: Float32Array.from(minBatteryFraction),
    longestDarkHours: new Uint16Array(size),
    longestCommLossHours: new Uint16Array(size),
    fractionSun: new Float32Array(size).fill(0.5),
    fractionEarth: new Float32Array(size).fill(0.5),
    fractionBoth: new Float32Array(size).fill(0.5),
    meanSunElevationDeg: new Float32Array(size).fill(1),
    hoursToSunset: new Int16Array(size).fill(-1),
    rechargeHours: new Int16Array(size).fill(-1),
    deadAtHour: new Int16Array(size).fill(-1),
  }
}

test('rankCells default order and sortBy', () => {
  const results = makeResults({ status: [0, 2, 2], minBatteryFraction: [0.1, 0.5, 0.9], distanceKm: [0, 2, 5], landingCount: 1 })
  const rows = rankCells(results, 0)
  assert.deepEqual(rows.map((row) => [row.rank, row.cellId]), [[1, 'TEST-2'], [2, 'TEST-1'], [3, 'TEST-0']])
  assert.equal(rows[0].status, 'pass')
  assert.equal(rows[0].hoursToSunset, null)
  assert.deepEqual(rankCells(results, 0, { sortBy: 'distanceKm' }).map((row) => row.cellId), ['TEST-0', 'TEST-1', 'TEST-2'])
})

test('summarizeCurrentPoint finds the nearest passing time and cell', () => {
  // cell 0 (current): fail, fail, pass — cell 1: pass, fail, fail
  const results = makeResults({ status: [0, 0, 2, 2, 0, 0], minBatteryFraction: [0, 0, 1, 1, 0, 0], distanceKm: [0, 3], landingCount: 3 })
  const summary = summarizeCurrentPoint(results, 0)
  assert.equal(summary.metrics.status, 'fail')
  assert.deepEqual(summary.nearestPassingLanding, { landingIndex: 2, landingTime: '2028-01-01T12:00Z', offsetHours: 12 })
  assert.deepEqual(summary.nearestPassingCell, { cellIndex: 1, cellId: 'TEST-1', distanceKm: 3 })
})
