import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertNear, constantEphemeris, equatorCell } from './testHelpers.js'
import { computeEarthTrack, nextEarthEvent, summarizeEarthWindow } from './communication.js'

test('computeEarthTrack: sub-Earth point overhead means Earth fully in view', () => {
  const track = computeEarthTrack(equatorCell, constantEphemeris({ hours: 4 }), 0, 4)
  assert.equal(track.firstHour, 0)
  assert.ok(track.diskFraction instanceof Float32Array && track.diskFraction.length === 4)
  assertNear(track.elevationDeg[0], 90, 1e-3)
  assertNear(track.diskFraction[0], 1)
})

test('computeEarthTrack with DSN: elevation < 10 deg loses comm, >= 10 deg preserves comm', () => {
  const ephemeris = constantEphemeris({ hours: 4 })
  // Unit is 0.1 deg: 100 = 10.0 deg, 99 = 9.9 deg (< 10 deg)
  ephemeris.dsn = {
    elevationUnitDeg: 0.1,
    goldstone: [150, -500, 99, -100],
    madrid: [-200, 100, 50, -200],
    canberra: [-100, -100, -50, -300],
  }

  const track = computeEarthTrack(equatorCell, ephemeris, 0, 4)

  // h0: Goldstone >= 10 deg -> comm preserved
  assertNear(track.diskFraction[0], 1)
  // h1: Madrid == 10 deg -> comm preserved
  assertNear(track.diskFraction[1], 1)
  // h2: all stations < 10 deg (max 9.9 deg) -> comm loss
  assert.equal(track.diskFraction[2], 0)
  // h3: all stations < 10 deg (negative) -> comm loss
  assert.equal(track.diskFraction[3], 0)
})

const earthTrack = { firstHour: 0, diskFraction: [1, 0, 0, 1], azimuthDeg: [0, 0, 0, 0], elevationDeg: [1, -1, -1, 1] }

test('summarizeEarthWindow', () => {
  assert.deepEqual(summarizeEarthWindow(earthTrack, 0, 4), { longestCommLossHours: 2, fractionEarth: 0.5 })
})

test('nextEarthEvent', () => {
  assert.deepEqual(nextEarthEvent(earthTrack, 0), { event: 'earthset', hoursFromNow: 0.5 })
  assert.deepEqual(nextEarthEvent(earthTrack, 1), { event: 'earthrise', hoursFromNow: 1.5 })
})
