// W2 map v2 — Sun and Earth numbers for the map (plan Tasks 3, 8, 9, 10). Synthetic ephemerides, not real geometry.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertNear, constantEphemeris, equatorCell } from './testHelpers.js'
import { clampHour, computeSkyAtHour, mapHourRange, nextPlayHour, regionCentreCells } from './mapSky.js'

test('computeSkyAtHour: one Sun and Earth value per cell at that hour', () => {
  const ephemeris = { ...constantEphemeris({ hours: 3 }), sunSubLonDeg: [0, 180, 0] }
  const farCell = { ...equatorCell, id: 'TEST-b', lon: 180 }
  const sky = computeSkyAtHour([equatorCell, farCell], ephemeris, 1)
  assert.ok(sky.sunDiskFraction instanceof Float32Array && sky.sunDiskFraction.length === 2)
  assertNear(sky.sunDiskFraction[0], 0)
  assertNear(sky.sunDiskFraction[1], 1)
  assertNear(sky.sunElevationDeg[1], 90, 1e-3)
  assertNear(sky.earthDiskFraction[0], 1)
})

test('mapHourRange: the scenario dates in hours, cut at the ephemeris end; null when the dates do not work', () => {
  const ephemeris = constantEphemeris({ hours: 72 })
  assert.deepEqual(mapHourRange(ephemeris, '2028-01-01', '2028-01-02'), { firstHour: 0, lastHour: 47 })
  assert.deepEqual(mapHourRange(ephemeris, '2028-01-02', '2028-01-31'), { firstHour: 24, lastHour: 71 })
  assert.equal(mapHourRange(ephemeris, '2028-01-02', '2028-01-01'), null)
  assert.equal(mapHourRange(ephemeris, '', '2028-01-02'), null)
  assert.equal(mapHourRange(ephemeris, '2028-01-01', ''), null)
  assert.equal(mapHourRange(ephemeris, '2027-12-31', '2028-01-02'), null)
})

test('clampHour and nextPlayHour keep the map hour inside the range', () => {
  const range = { firstHour: 24, lastHour: 71 }
  assert.equal(clampHour(null, range), 24)
  assert.equal(clampHour(10, range), 24)
  assert.equal(clampHour(80, range), 71)
  assert.equal(clampHour(30, range), 30)
  assert.equal(nextPlayHour(30, 6, range), 36)
  assert.equal(nextPlayHour(65, 6, range), 71)
  assert.equal(nextPlayHour(66, 6, range), 24)
})

test('regionCentreCells: a pseudo-cell for each region whose centre site exists', () => {
  const sites = [{ id: 'malapert-massif', name: 'Malapert Massif', lat: -85.925, lon: -1.205, region: 'MAL', horizon: null }]
  const centres = regionCentreCells([{ code: 'MAL', siteId: 'malapert-massif' }, { code: 'XXX', siteId: 'missing' }], sites)
  assert.equal(centres.length, 1)
  assert.equal(centres[0].regionCode, 'MAL')
  assert.equal(centres[0].cell.id, 'SITE-malapert-massif')
  assert.equal(centres[0].cell.heightM, 0)
})
