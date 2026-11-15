import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validationSummary } from './validationStats.js'

// All values below are SYNTHETIC test data, not real PGDA or Horizons results.
const row = (ourSun, pgdaSun, ourEarth, pgdaEarth) => ({
  ourSunHalfDiskFraction: ourSun, pgdaSunFraction: pgdaSun, ourEarthHalfDiskFraction: ourEarth, pgdaEarthFraction: pgdaEarth,
})
const horizons = { pointCount: 3, maxAzimuthErrorDeg: 0.01, maxElevationErrorDeg: 0.02 }

test('uses the ALL entry of pgda69Stats for r and the array for MAE', () => {
  const summary = validationSummary({
    pgda69: [row(0.5, 0.4, 0.2, 0.2), row(0.3, 0.4, 0.6, 0.5)],
    pgda69Stats: [
      { region: 'MAL', sun: { halfDisk: { pearsonR: 0.1 } } },
      { region: 'ALL', sun: { halfDisk: { pearsonR: 0.98 } }, earth: { halfDisk: { pearsonR: 0.95 } } },
    ],
    horizons,
  })
  assert.equal(summary.sunR, 0.98)
  assert.equal(summary.earthR, 0.95)
  assert.ok(Math.abs(summary.sunMae - 0.1) < 1e-12)
  assert.ok(Math.abs(summary.earthMae - 0.05) < 1e-12)
  assert.equal(summary.cellCount, 2)
  assert.equal(summary.horizonsMaxDeg, 0.02)
})

test('computes Pearson r from the array when there are no stats', () => {
  const summary = validationSummary({ pgda69: [row(0.1, 0.2, 0.9, 0.5), row(0.2, 0.4, 0.5, 0.9), row(0.3, 0.6, 0.1, 0.7)], horizons })
  assert.ok(Math.abs(summary.sunR - 1) < 1e-12) // perfectly linear
  assert.ok(summary.earthR < 1)
})

test('returns nulls for missing parts', () => {
  const summary = validationSummary({ pgda69: [{ cellId: 'x' }], horizons: { pointCount: 0, maxAzimuthErrorDeg: null, maxElevationErrorDeg: null } })
  assert.deepEqual(summary, { sunR: null, earthR: null, sunMae: null, earthMae: null, cellCount: 1, horizonsMaxDeg: null })
  assert.equal(validationSummary(null).cellCount, null)
})
