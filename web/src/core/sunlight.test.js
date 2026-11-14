import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertNear, equatorCell } from './testHelpers.js'
import { computeSunTrack, nextSunEvent, panelFactor, resolvePanelType, summarizeSunWindow } from './sunlight.js'

test('panel type and factor', () => {
  assert.equal(resolvePanelType('auto', -85), 'vertical')
  assert.equal(resolvePanelType('auto', 20), 'horizontal')
  assert.equal(resolvePanelType('horizontal', -85), 'horizontal')
  assertNear(panelFactor(0, 'vertical'), 1)
  assertNear(panelFactor(60, 'vertical'), 0.5)
  assertNear(panelFactor(90, 'horizontal'), 1)
  assertNear(panelFactor(-5, 'horizontal'), 0)
})

test('computeSunTrack: overhead Sun at 1 AU gives full power, far-side Sun gives none', () => {
  const ephemeris = {
    startTime: '2028-01-01T00:00Z', stepHours: 1, hours: 3,
    sunSubLonDeg: [0, 0, 180], sunSubLatDeg: [0, 0, 0], sunDistanceAu: [1, 1, 1],
    earthSubLonDeg: [0, 0, 0], earthSubLatDeg: [0, 0, 0], earthDistanceKm: [384400, 384400, 384400],
  }
  const track = computeSunTrack(equatorCell, ephemeris, 1, 2, 'horizontal')
  assert.equal(track.firstHour, 1)
  assert.equal(track.panelType, 'horizontal')
  for (const key of ['azimuthDeg', 'elevationDeg', 'diskFraction', 'powerFactor']) {
    assert.ok(track[key] instanceof Float32Array && track[key].length === 2, key)
  }
  assertNear(track.elevationDeg[0], 90, 1e-3)
  assertNear(track.diskFraction[0], 1)
  assertNear(track.powerFactor[0], 1, 1e-4)
  assertNear(track.diskFraction[1], 0)
  assertNear(track.powerFactor[1], 0)
})

const sunTrack = {
  firstHour: 0, panelType: 'vertical',
  diskFraction: [1, 1, 0, 0, 0, 1], elevationDeg: [2, 4, 0, 0, 0, 6],
  azimuthDeg: [0, 0, 0, 0, 0, 0], powerFactor: [1, 1, 0, 0, 0, 1],
}

test('summarizeSunWindow', () => {
  assert.deepEqual(summarizeSunWindow(sunTrack, 0, 6), {
    longestDarkHours: 3, fractionSun: 0.5, meanSunElevationDeg: 4, hoursToSunset: 2,
  })
  assert.equal(summarizeSunWindow(sunTrack, 0, 2).hoursToSunset, null)
})

test('nextSunEvent', () => {
  assert.deepEqual(nextSunEvent(sunTrack, 0), { event: 'sunset', hoursFromNow: 1.5 })
  assert.deepEqual(nextSunEvent(sunTrack, 3), { event: 'sunrise', hoursFromNow: 1.5 })
})
