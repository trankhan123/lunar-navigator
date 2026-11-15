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

test('computeEarthTrack with DSN: only when requireDsn is true, a hidden-station hour counts as comm loss', () => {
  const ephemeris = constantEphemeris({ hours: 4 })
  // Unit is 0.1 deg: 100 = 10.0 deg, 99 = 9.9 deg (< 10 deg)
  ephemeris.dsn = {
    elevationUnitDeg: 0.1,
    goldstone: [150, -500, 99, -100],
    madrid: [-200, 100, 50, -200],
    canberra: [-100, -100, -50, -300],
  }

  // Default is the docs/technical-reference.md rule: line of sight only, DSN data is ignored.
  const lineOfSight = computeEarthTrack(equatorCell, ephemeris, 0, 4)
  assert.deepEqual([...lineOfSight.diskFraction], [1, 1, 1, 1])
  assert.deepEqual([...computeEarthTrack(equatorCell, ephemeris, 0, 4, false).diskFraction], [1, 1, 1, 1])

  const withDsn = computeEarthTrack(equatorCell, ephemeris, 0, 4, true)
  assert.deepEqual([...withDsn.diskFraction], [1, 1, 0, 0]) // h2: best station 9.9 deg; h3: all negative

  // requireDsn without loaded DSN data changes nothing.
  assert.deepEqual([...computeEarthTrack(equatorCell, constantEphemeris({ hours: 4 }), 0, 4, true).diskFraction], [1, 1, 1, 1])
})

const earthTrack = { firstHour: 0, diskFraction: [1, 0, 0, 1], azimuthDeg: [0, 0, 0, 0], elevationDeg: [1, -1, -1, 1] }

test('summarizeEarthWindow', () => {
  assert.deepEqual(summarizeEarthWindow(earthTrack, 0, 4), { longestCommLossHours: 2, fractionEarth: 0.5 })
})

test('nextEarthEvent', () => {
  assert.deepEqual(nextEarthEvent(earthTrack, 0), { event: 'earthset', hoursFromNow: 0.5 })
  assert.deepEqual(nextEarthEvent(earthTrack, 1), { event: 'earthrise', hoursFromNow: 1.5 })
})
