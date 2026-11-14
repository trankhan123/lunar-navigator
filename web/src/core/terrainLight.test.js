import assert from 'node:assert/strict'
import test from 'node:test'
import { sunLightDirection } from './terrainLight.js'

const close = (actual, expected) => expected.forEach((value, index) => assert.ok(Math.abs(actual[index] - value) < 1e-9, `${actual} vs ${expected}`))

test('azimuth 0 at longitude 0 points to map up (scene −z)', () => close(sunLightDirection(0, 0, 0), [0, 0, -1]))
test('azimuth 90 at longitude 0 points to scene +x', () => close(sunLightDirection(90, 0, 0), [1, 0, 0]))
test('the map angle is azimuth + longitude', () => close(sunLightDirection(0, 0, 90), [1, 0, 0]))
test('azimuth 90 at longitude −90 points to map up', () => close(sunLightDirection(90, 0, -90), [0, 0, -1]))
test('elevation 90 is straight up and 30 gives y = 0.5', () => {
  close(sunLightDirection(123, 90, 45), [0, 1, 0])
  assert.ok(Math.abs(sunLightDirection(10, 30, 5)[1] - 0.5) < 1e-9)
})
