import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertNear, constantEphemeris, equatorCell } from './testHelpers.js'
import { evaluateWindow, rankBestPairs, rankCells, runWindowSearch, selectSearchCells, summarizeCurrentPoint } from './optimizer.js'
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

test('selectSearchCells: scope region with Apollo 11 returns [] when beyond 1 km', () => {
  const scenario = { searchScope: 'region' }
  const apollo11 = { id: 'SITE-apollo-11', lat: 0.674, lon: 23.473 }
  const cellsByRegion = {
    MAL: [
      { id: 'MAL-r1c1', lat: -85.82302, lon: -2.53277, feasible: true, region: 'MAL' },
      { id: 'MAL-r1c2', lat: -85.82434, lon: -2.0809, feasible: false, region: 'MAL' },
    ],
  }

  // Apollo 11 is ~2636 km from Malapert (> 1 km) -> []
  const distant = selectSearchCells(scenario, apollo11, cellsByRegion)
  assert.deepEqual(distant, [])

  // Point within 1 km matches region and puts currentPoint at index 0
  const nearbySite = { id: 'SITE-malapert', lat: -85.82302, lon: -2.53277 }
  const nearby = selectSearchCells(scenario, nearbySite, cellsByRegion)
  assert.equal(nearby.length, 2)
  assert.equal(nearby[0], nearbySite)
  assert.equal(nearby[1].id, 'MAL-r1c1')
})

test('rankBestPairs: 225 cells completes in < 200 ms returning top 10', () => {
  const cellCount = 225
  const landingCount = 20
  const size = cellCount * landingCount

  const status = new Uint8Array(size).fill(0)
  const minBatteryFraction = new Float32Array(size).fill(0)
  const distanceKm = new Float32Array(cellCount)
  for (let c = 0; c < cellCount; c++) {
    distanceKm[c] = c * 0.1
  }

  // Seed top candidates with status = 2 (pass) and distinct battery fractions
  for (let i = 0; i < 15; i++) {
    const idx = i * landingCount + (i % landingCount)
    status[idx] = 2
    minBatteryFraction[idx] = 0.5 + (15 - i) * 0.03
  }

  const results = {
    cellCount,
    landingCount,
    cellIds: Array.from({ length: cellCount }, (_, i) => `CELL-${i}`),
    distanceKm,
    landingTimes: Array.from({ length: landingCount }, (_, k) => `2028-01-01T${String((k * 6) % 24).padStart(2, '0')}:00Z`),
    status,
    failReasonBits: new Uint8Array(size),
    minBatteryFraction,
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

  const t0 = performance.now()
  const top10 = rankBestPairs(results, { limit: 10 })
  const elapsed = performance.now() - t0

  assert.equal(top10.length, 10)
  assert.equal(top10[0].rank, 1)
  assert.equal(top10[0].cellId, 'CELL-0')
  assert.equal(top10[0].status, 'pass')
  assert.ok(top10[0].minBatteryFraction > top10[1].minBatteryFraction)
  assert.ok(elapsed < 200, `Expected rankBestPairs to complete in < 200 ms, took ${elapsed.toFixed(2)} ms`)
})
