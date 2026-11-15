import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cellDisplayName, countdownText, currentPointSentence, formatDuration, formatUtc, hasNoTerrain, rowCellName } from './format.js'
import { DEFAULT_SCENARIO } from './scenario.js'

test('formatDuration', () => {
  assert.equal(formatDuration(0.5), '30 min')
  assert.equal(formatDuration(3 + 1 / 3), '3 h 20 min')
  assert.equal(formatDuration(2.999), '3 h')
  assert.equal(formatDuration(76), '3 d 4 h')
  assert.equal(formatDuration(72), '3 d')
  assert.equal(formatDuration(47.995), '2 d')
  assert.equal(formatDuration(Infinity), '—')
  assert.equal(formatDuration(-0.25), '—')
})

test('formatUtc', () => {
  assert.equal(formatUtc('2028-01-15T06:00Z'), '2028-01-15 06:00 UTC')
})

test('countdownText: the four Sun wordings', () => {
  assert.equal(countdownText('sun', { event: 'sunset', hoursFromNow: 3 + 1 / 3 }, true, 500), 'Sun sets in 3 h 20 min')
  assert.equal(countdownText('sun', { event: 'sunrise', hoursFromNow: 52 }, false, 500), 'Sunlight returns in 2 d 4 h')
  assert.equal(countdownText('sun', null, true, 216), 'Sun stays up for at least 9 d')
  assert.equal(countdownText('sun', null, false, 216), 'Sun stays down for at least 9 d')
})

test('countdownText: the four Earth wordings', () => {
  assert.equal(countdownText('earth', { event: 'earthset', hoursFromNow: 18 }, true, 500), 'Earth sets in 18 h')
  assert.equal(countdownText('earth', { event: 'earthrise', hoursFromNow: 5 }, false, 500), 'Earth rises in 5 h')
  assert.equal(countdownText('earth', null, true, 216), 'Earth stays in view for at least 9 d')
  assert.equal(countdownText('earth', null, false, 216), 'Earth stays hidden for at least 9 d')
})

test('countdownText: durations go through formatDuration (event time, else hoursLeft)', () => {
  for (const hours of [0.25, 1.5, 47.9, 76.2]) {
    const text = formatDuration(hours)
    assert.equal(countdownText('sun', { event: 'sunset', hoursFromNow: hours }, true, 999), `Sun sets in ${text}`)
    assert.equal(countdownText('sun', { event: 'sunrise', hoursFromNow: hours }, false, 999), `Sunlight returns in ${text}`)
    assert.equal(countdownText('earth', { event: 'earthset', hoursFromNow: hours }, true, 999), `Earth sets in ${text}`)
    assert.equal(countdownText('earth', { event: 'earthrise', hoursFromNow: hours }, false, 999), `Earth rises in ${text}`)
    assert.equal(countdownText('sun', null, true, hours), `Sun stays up for at least ${text}`)
    assert.equal(countdownText('earth', null, false, hours), `Earth stays hidden for at least ${text}`)
  }
})

// Hand-made summaries in the shape summarizeCurrentPoint returns (docs/technical-reference.md C5). Synthetic numbers, not real results.
function currentPointSummary({ metrics = {}, nearestPassingLanding = null, nearestPassingCell = null } = {}) {
  return {
    metrics: {
      status: 'pass', failReasons: [],
      longestDarkHours: 10, longestCommLossHours: 4,
      fractionSun: 0.8, fractionEarth: 0.9, fractionBoth: 0.75,
      meanSunElevationDeg: 2.5, hoursToSunset: null,
      minBatteryFraction: 0.6, deadAtHour: null, rechargeHours: 3,
      cellIndex: 0, cellId: 'MAL-r5c4', landingIndex: 5, landingTime: '2028-01-02T06:00Z', distanceKm: 0,
      ...metrics,
    },
    nearestPassingLanding,
    nearestPassingCell,
  }
}
const itself = { landingIndex: 5, landingTime: '2028-01-02T06:00Z', offsetHours: 0 }
const neighbour = { cellIndex: 3, cellId: 'MAL-r4c4', distanceKm: 3.14159 }

test('currentPointSentence: pass is one sentence', () => {
  const summary = currentPointSummary({ nearestPassingLanding: itself, nearestPassingCell: neighbour })
  assert.equal(currentPointSentence(summary, DEFAULT_SCENARIO), 'MAL-r5c4 meets all limits for a landing at 2028-01-02 06:00 UTC.')
})

test('currentPointSentence: marginal names the rounded battery minimum', () => {
  const summary = currentPointSummary({ metrics: { status: 'marginal', minBatteryFraction: 0.157 }, nearestPassingLanding: itself, nearestPassingCell: neighbour })
  assert.equal(
    currentPointSentence(summary, DEFAULT_SCENARIO),
    'MAL-r5c4 meets the limits for a landing at 2028-01-02 06:00 UTC, but the battery drops to 16 %.',
  )
})

test('currentPointSentence: fail with one reason, a later passing time and a passing cell', () => {
  const summary = currentPointSummary({
    metrics: { status: 'fail', failReasons: ['commLoss'], longestCommLossHours: 20, minBatteryFraction: 0.7 },
    nearestPassingLanding: { landingIndex: 8, landingTime: '2028-01-03T00:00Z', offsetHours: 18 },
    nearestPassingCell: neighbour,
  })
  assert.equal(
    currentPointSentence(summary, { ...DEFAULT_SCENARIO, maxCommLossHours: 12 }),
    'MAL-r5c4 fails for a landing at 2028-01-02 06:00 UTC: longest comm loss 20 h (limit 12 h).' +
      ' Nearest passing landing time: 18 h later (2028-01-03 00:00 UTC).' +
      ' Nearest passing cell: MAL-r4c4, 3.1 km away.',
  )
})

test('currentPointSentence: fail with every reason in failReasons order, an earlier passing time', () => {
  const summary = currentPointSummary({
    metrics: {
      status: 'fail', failReasons: ['dark', 'commLoss', 'battery'],
      longestDarkHours: 30, longestCommLossHours: 20, deadAtHour: 100, minBatteryFraction: 0,
      landingIndex: 20, landingTime: '2028-01-06T00:00Z',
    },
    nearestPassingLanding: { landingIndex: 11, landingTime: '2028-01-03T18:00Z', offsetHours: -54 },
    nearestPassingCell: { cellIndex: 7, cellId: 'MAL-r6c2', distanceKm: 12.34 },
  })
  assert.equal(
    currentPointSentence(summary, { ...DEFAULT_SCENARIO, maxDarkHours: 20, maxCommLossHours: 8 }),
    'MAL-r5c4 fails for a landing at 2028-01-06 00:00 UTC: longest dark period 30 h (limit 20 h);' +
      ' longest comm loss 20 h (limit 8 h); battery runs out after 100 h.' +
      ' Nearest passing landing time: 2 d 6 h earlier (2028-01-03 18:00 UTC).' +
      ' Nearest passing cell: MAL-r6c2, 12.3 km away.',
  )
})

test('currentPointSentence: fail with no passing landing time and no passing cell', () => {
  const summary = currentPointSummary({
    metrics: { status: 'fail', failReasons: ['dark', 'battery'], longestDarkHours: 30, deadAtHour: 34, minBatteryFraction: 0 },
  })
  assert.equal(
    currentPointSentence(summary, { ...DEFAULT_SCENARIO, maxDarkHours: 24 }),
    'MAL-r5c4 fails for a landing at 2028-01-02 06:00 UTC: longest dark period 30 h (limit 24 h); battery runs out after 34 h.' +
      ' No passing landing time in this date range. No passing cell at this landing time.',
  )
})

test('cellDisplayName: site and custom points show their label, grid cells their id', () => {
  assert.equal(cellDisplayName({ id: 'SITE-apollo-11', label: 'Apollo 11' }), 'Apollo 11')
  assert.equal(cellDisplayName({ id: 'CUSTOM', label: 'Custom point' }), 'Custom point')
  assert.equal(cellDisplayName({ id: 'MAL-r5c4', label: 'r5c4' }), 'MAL-r5c4')
})

test('hasNoTerrain: true only without a horizon', () => {
  assert.equal(hasNoTerrain({ horizon: null }), true)
  assert.equal(hasNoTerrain({ horizon: [0, 1] }), false)
})

test('currentPointSentence: uses the given point name', () => {
  const summary = { metrics: { status: 'pass', cellId: 'SITE-apollo-11', landingTime: '2028-01-02T06:00Z' } }
  assert.equal(currentPointSentence(summary, DEFAULT_SCENARIO, 'Apollo 11'), 'Apollo 11 meets all limits for a landing at 2028-01-02 06:00 UTC.')
})

test('rowCellName: the searched famous site shows its name, grid cells keep their id', () => {
  const site = { id: 'SITE-apollo-11', label: 'Apollo 11' }
  assert.equal(rowCellName({ cellId: 'SITE-apollo-11' }, site), 'Apollo 11')
  assert.equal(rowCellName({ cellId: 'MAL-r1c1' }, site), 'MAL-r1c1')
  assert.equal(rowCellName({ cellId: 'CAP-x1y2' }, null), 'CAP-x1y2')
})
