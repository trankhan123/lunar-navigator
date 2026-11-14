// W2 map v2 — Sun and Earth numbers for the map (plan Tasks 3, 8, 9, 10). Synthetic ephemerides, not real geometry.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertNear, constantEphemeris, equatorCell } from './testHelpers.js'
import { bodyDirections, clampHour, computeSkyAtHour, computeVisibilityFractions, directionText, mapHourRange, nextPlayHour, regionCentreCells, stayPreview } from './mapSky.js'

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

test('computeVisibilityFractions: share of hours with half the disk or more in view', () => {
  const ephemeris = { ...constantEphemeris({ hours: 6 }), sunSubLonDeg: [0, 0, 180, 180, 180, 0] }
  const result = computeVisibilityFractions([equatorCell], ephemeris, 1, 4)
  assert.ok(result.fractionSun instanceof Float32Array && result.fractionEarth instanceof Float32Array)
  assertNear(result.fractionSun[0], 0.25)
  assertNear(result.fractionEarth[0], 1)
})

test('stayPreview: stay-long tracks from the map hour, cut at the ephemeris end', () => {
  const ephemeris = constantEphemeris({ hours: 30 })
  const preview = stayPreview(equatorCell, ephemeris, 20, 1)
  assert.equal(preview.hourCount, 10)
  assert.equal(preview.sunDiskFraction.length, 10)
  assertNear(preview.fractionSun, 1)
  assertNear(preview.fractionEarth, 1)
  assert.equal(stayPreview(equatorCell, ephemeris, 0, 1).hourCount, 24)
  assert.equal(stayPreview(equatorCell, ephemeris, 20, null), null)
  assert.equal(stayPreview(equatorCell, ephemeris, null, 1), null)
})

test('bodyDirections: azimuth, elevation, terrain and visibility', () => {
  const ephemeris = constantEphemeris({ hours: 2, sun: [90, 0, 1] })
  const [sun, earth] = bodyDirections({ ...equatorCell, horizon: Array(360).fill(-10) }, ephemeris, 1)
  assert.equal(sun.body, 'sun')
  assertNear(sun.azimuthDeg, 90, 1e-3)
  assertNear(sun.elevationDeg, 0, 1e-2)
  assertNear(sun.terrainDeg, -1)
  assert.equal(sun.isVisible, true)
  assert.equal(earth.body, 'earth')
  assertNear(earth.elevationDeg, 90, 1e-3)
  assert.equal(bodyDirections({ ...equatorCell, horizon: Array(360).fill(20) }, ephemeris, 1)[0].isVisible, false)
  assert.equal(bodyDirections(equatorCell, ephemeris, 1)[0].terrainDeg, null)
})

test('directionText: one plain line per body', () => {
  assert.equal(directionText({ body: 'sun', azimuthDeg: 112.4, elevationDeg: 1.44, terrainDeg: 2.3, isVisible: false }), 'Sun 112° · 1.4° high · terrain 2.3° · hidden')
  assert.equal(directionText({ body: 'earth', azimuthDeg: 359.7, elevationDeg: 4.06, terrainDeg: null, isVisible: true }), 'Earth 0° · 4.1° high · terrain not included · in view')
})
