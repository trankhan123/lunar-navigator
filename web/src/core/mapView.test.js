// W2 map v2 — view geometry (plan Task 1). Synthetic bounds, not real data.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertNear } from './testHelpers.js'
import { MAX_ZOOM_SCALE, cellLabelsVisible, fitTransform, isCellOnPolarMap, isOnPolarMap, mapAngleDeg, sparklinePath, viewBoundsM } from './mapView.js'

function assertTransform(actual, expected) {
  for (const key of ['k', 'x', 'y']) assertNear(actual[key], expected[key], 1e-6)
}

test('fitTransform centres and scales bounds into the ±304 km view (SVG y = −yM)', () => {
  assertTransform(fitTransform([-304000, -304000, 304000, 304000], 0), { k: 1, x: 0, y: 0 })
  assertTransform(fitTransform([-304000, -304000, 304000, 304000], 0.08), { k: 1, x: 0, y: 0 }) // never below 1
  assertTransform(fitTransform([-10000, 110000, 10000, 130000], 0), { k: 30.4, x: 0, y: 3648000 })
  assertTransform(fitTransform([-10000, 110000, 10000, 130000], 0.1), { k: 27.36, x: 0, y: 3283200 })
  assertTransform(fitTransform([0, 0, 40000, 20000], 0), { k: 15.2, x: -304000, y: 152000 }) // the wider side fits
  assertTransform(fitTransform([0, 0, 100, 100], 0), { k: MAX_ZOOM_SCALE, x: -15000, y: 15000 })
})

test('viewBoundsM is the map area a transform shows', () => {
  assert.deepEqual(viewBoundsM({ k: 1, x: 0, y: 0 }), [-304000, -304000, 304000, 304000])
  const bounds = viewBoundsM(fitTransform([-10000, 110000, 10000, 130000], 0))
  ;[-10000, 110000, 10000, 130000].forEach((value, index) => assertNear(bounds[index], value, 1e-6))
})

test('isOnPolarMap: inside the ±304 km square only', () => {
  assert.equal(isOnPolarMap(0, 0), true)
  assert.equal(isOnPolarMap(304000, -304000), true)
  assert.equal(isOnPolarMap(304001, 0), false)
  assert.equal(isOnPolarMap(null, null), false)
})

test('sparklinePath: 0…1 values to an SVG path, 1 at the top', () => {
  assert.equal(sparklinePath([1, 0, 0.5], 10, 4), 'M0,0 L5,4 L10,2')
  assert.equal(sparklinePath(new Float32Array([0.25]), 10, 4), 'M0,3')
  assert.equal(sparklinePath([], 10, 4), '')
})

test('mapAngleDeg: azimuth + longitude, clockwise from map up', () => {
  assert.equal(mapAngleDeg(0, 0), 0)
  assert.equal(mapAngleDeg(90, 0), 90)
  assert.equal(mapAngleDeg(350, 20), 10)
  assert.equal(mapAngleDeg(10, -30), 340)
  assert.equal(mapAngleDeg(180, -90), 90) // at lon −90° the pole lies towards +x
})

test('cellLabelsVisible once a 1 km cell is at least 40 px wide', () => {
  assert.equal(cellLabelsVisible(1, 600), false)
  assert.equal(cellLabelsVisible(40, 600), false) // 39.5 px
  assert.equal(cellLabelsVisible(41, 600), true) // 40.5 px
  assert.equal(cellLabelsVisible(300, 0), false) // map not laid out yet
})

test('isCellOnPolarMap: a point outside the polar map (null or far xM/yM) is not on it', () => {
  assert.equal(isCellOnPolarMap({ xM: 1000, yM: -2000 }), true)
  assert.equal(isCellOnPolarMap({ xM: null, yM: null }), false)
  assert.equal(isCellOnPolarMap({ xM: 900000, yM: 0 }), false)
})
