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

const earthTrack = { firstHour: 0, diskFraction: [1, 0, 0, 1], azimuthDeg: [0, 0, 0, 0], elevationDeg: [1, -1, -1, 1] }

test('summarizeEarthWindow', () => {
  assert.deepEqual(summarizeEarthWindow(earthTrack, 0, 4), { longestCommLossHours: 2, fractionEarth: 0.5 })
})

test('nextEarthEvent', () => {
  assert.deepEqual(nextEarthEvent(earthTrack, 0), { event: 'earthset', hoursFromNow: 0.5 })
  assert.deepEqual(nextEarthEvent(earthTrack, 1), { event: 'earthrise', hoursFromNow: 1.5 })
})
