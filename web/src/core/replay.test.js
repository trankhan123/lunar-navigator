// SYNTHETIC data, not a real mission: equator site, Sun sub-point moving 2.2 deg/h east from overhead, Earth fixed overhead.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { replaySummary } from './replay.js'
import { assertNear } from './testHelpers.js'

const hours = 100
const ephemeris = {
  startTime: '2028-01-01T00:00Z', stepHours: 1, hours,
  sunSubLonDeg: Array.from({ length: hours }, (_, hour) => Math.min(2.2 * hour, 180)),
  sunSubLatDeg: Array(hours).fill(0),
  sunDistanceAu: Array(hours).fill(1),
  earthSubLonDeg: Array(hours).fill(0),
  earthSubLatDeg: Array(hours).fill(0),
  earthDistanceKm: Array(hours).fill(384400),
}
const site = { id: 'synthetic', name: 'Synthetic', lat: 0, lon: 0, horizon: null }

test('sunset about 36 h after a landing at hour 5, Earth never sets, difference is signed', () => {
  const summary = replaySummary(site, ephemeris, { siteId: 'synthetic', landedUtc: '2028-01-01T05:30Z', endedUtc: '2028-01-03T17:00Z' })
  assertNear(summary.hoursFromLandingToSunset, 36, 1)
  assert.equal(summary.predictedEarthsetUtc, null)
  assert.equal(summary.reason, null)
  assertNear(summary.differenceHours, 65 - 41, 1) // ended at hour 65, sunset near hour 41
})

test('null end gives a null difference; Sun already down gives a reason', () => {
  assert.equal(replaySummary(site, ephemeris, { siteId: 'synthetic', landedUtc: '2028-01-01T05:00Z', endedUtc: null }).differenceHours, null)
  const night = replaySummary(site, ephemeris, { siteId: 'synthetic', landedUtc: '2028-01-03T12:00Z', endedUtc: '2028-01-04T00:00Z' })
  assert.equal(night.predictedSunsetUtc, null)
  assert.equal(night.differenceHours, null)
  assert.equal(night.reason, 'sun-down-at-landing')
})
