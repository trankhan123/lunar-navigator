// W2 map v2 — view geometry (plan Task 1). Synthetic bounds, not real data.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertNear } from './testHelpers.js'
import { MAX_ZOOM_SCALE, fitTransform, isOnPolarMap, sparklinePath, viewBoundsM } from './mapView.js'

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
