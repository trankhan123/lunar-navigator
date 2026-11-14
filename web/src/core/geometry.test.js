import { test } from 'node:test'
import { existsSync, readFileSync } from 'node:fs'
import { assertNear } from './testHelpers.js'
import { bodyAzimuthElevation, distanceKm, horizonElevationAt, visibleDiskFraction } from './geometry.js'

test('visibleDiskFraction is linear across the disk and clamped', () => {
  assertNear(visibleDiskFraction(1, 1, 0.27), 0.5)
  assertNear(visibleDiskFraction(1.135, 1, 0.27), 0.75)
  assertNear(visibleDiskFraction(1.5, 1, 0.27), 1)
  assertNear(visibleDiskFraction(0.5, 1, 0.27), 0)
})

test('horizonElevationAt reads 0.1° integers, interpolates and wraps', () => {
  const horizon = Array(360).fill(0)
  horizon[10] = 25
  horizon[11] = 35
  horizon[359] = 10
  horizon[0] = 30
  assertNear(horizonElevationAt(horizon, 10), 2.5)
  assertNear(horizonElevationAt(horizon, 10.5), 3.0)
  assertNear(horizonElevationAt(horizon, 359.5), 2.0)
  assertNear(horizonElevationAt(null, 123), 0)
})

test('distanceKm is great-circle on the 1737.4 km sphere', () => {
  assertNear(distanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 90 }), (Math.PI / 2) * 1737.4, 1e-6)
})

test('bodyAzimuthElevation: azimuth clockwise from North, elevation above the local horizontal', () => {
  const equator = { lat: 0, lon: 0, heightM: 0 }
  assertNear(bodyAzimuthElevation(equator, 0, 0, 1.5e8).elevationDeg, 90, 1e-3)
  const towardsEast = bodyAzimuthElevation(equator, 90, 0, 1.5e8)
  assertNear(towardsEast.azimuthDeg, 90, 1e-3)
  assertNear(towardsEast.elevationDeg, 0, 1e-3)
  // Near the south pole, a Sun above the equator at lon 0 is due "north" and 1° high.
  const nearPole = bodyAzimuthElevation({ lat: -89, lon: 0, heightM: 0 }, 0, 0, 1.5e8)
  assertNear(Math.min(nearPole.azimuthDeg, 360 - nearPole.azimuthDeg), 0, 1e-3)
  assertNear(nearPole.elevationDeg, 1, 1e-3)
})

// Written by module D1 (fetch_horizons.py); skipped until it exists.
const fixtureUrl = new URL('./fixtures/horizons_check.json', import.meta.url)
test('bodyAzimuthElevation matches JPL Horizons within 0.1°', { skip: !existsSync(fixtureUrl) }, () => {
  const { points } = JSON.parse(readFileSync(fixtureUrl, 'utf8'))
  for (const point of points) {
    const { azimuthDeg, elevationDeg } = bodyAzimuthElevation(point, point.subLonDeg, point.subLatDeg, point.distanceKm)
    const azimuthError = Math.abs(((azimuthDeg - point.azimuthDeg + 540) % 360) - 180)
    assertNear(azimuthError, 0, 0.1)
    assertNear(elevationDeg, point.elevationDeg, 0.1)
  }
})
