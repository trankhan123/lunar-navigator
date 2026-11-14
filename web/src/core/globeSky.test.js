// W6 globe — sub-body points. Synthetic ephemeris values, not real geometry.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { angularDistanceDeg, rayPoints, regionAtPoint, subBodyPoints } from './globeSky.js'

const ephemeris = {
  hours: 3,
  sunSubLonDeg: [10, 20, 30],
  sunSubLatDeg: [-1, -2, -3],
  earthSubLonDeg: [0.5, 0.6, 0.7],
  earthSubLatDeg: [4, 5, 6],
}

test('subBodyPoints reads the Sun and Earth sub-points of that hour', () => {
  assert.deepEqual(subBodyPoints(ephemeris, 1), { sun: { latDeg: -2, lonDeg: 20 }, earth: { latDeg: 5, lonDeg: 0.6 } })
})

test('subBodyPoints gives null outside the ephemeris or for a missing hour', () => {
  for (const hour of [-1, 3, 1.5, null, undefined]) assert.equal(subBodyPoints(ephemeris, hour), null)
})

test('angularDistanceDeg: quarter turns and the pole', () => {
  assert.ok(Math.abs(angularDistanceDeg(0, 0, 0, 90) - 90) < 1e-9)
  assert.ok(Math.abs(angularDistanceDeg(-90, 0, -85, 123) - 5) < 1e-9)
  assert.ok(angularDistanceDeg(10, 20, 10, 20) < 1e-3) // acos is imprecise near 0
})

test('rayPoints: straight out for an overhead body, sideways for a body on the horizon', () => {
  const overhead = rayPoints(0, 0, 0, 0, 0.35, 2)
  assert.deepEqual(overhead.map(([lat, lng, altitude]) => [lat, lng, Math.round(altitude * 1e6) / 1e6]), [[0, 0, 0], [0, 0, 0.175], [0, 0, 0.35]])
  const [, tip] = rayPoints(0, 0, 0, 90, 0.35, 1)
  assert.ok(Math.abs(tip[1] - (Math.atan(0.35) * 180) / Math.PI) < 1e-9)
  assert.ok(Math.abs(tip[2] - (Math.hypot(1, 0.35) - 1)) < 1e-9)
})

test('regionAtPoint picks the nearest region inside the radius, else null', () => {
  const regions = [{ code: 'A', lat: -85, lon: 0 }, { code: 'B', lat: -85, lon: 5 }]
  assert.equal(regionAtPoint(regions, -85, 4, 3).code, 'B')
  assert.equal(regionAtPoint(regions, -85, 2, 3).code, 'A')
  assert.equal(regionAtPoint(regions, 0, 0, 3), null)
})
