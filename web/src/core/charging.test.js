import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertNear } from './testHelpers.js'
import { findFullChargeWindows, simulateBattery } from './charging.js'

const lander = { panelMaxW: 300, loadW: 100, batteryCapacityWh: 1000 }

test('no sunlight: 1000 Wh at 100 W runs out at hour 10', () => {
  const result = simulateBattery(new Float32Array(12), 0, 12, lander)
  assert.ok(result.batteryWh instanceof Float32Array && result.batteryWh.length === 13)
  assert.ok(result.chargingMask instanceof Uint8Array && result.chargingMask.length === 12)
  assert.equal(result.deadAtHour, 10)
  assert.equal(result.minBatteryWh, 0)
  assert.equal(result.rechargeHours, null)
})

test('dip then recharge', () => {
  const result = simulateBattery([0, 0, 1, 1], 0, 4, lander)
  assert.deepEqual(Array.from(result.batteryWh), [1000, 900, 800, 1000, 1000])
  assert.equal(result.minBatteryWh, 800)
  assertNear(result.minBatteryFraction, 0.8)
  assert.equal(result.deadAtHour, null)
  assert.equal(result.rechargeHours, 1)
  assert.deepEqual(Array.from(result.chargingMask), [0, 0, 1, 1])
})

test('always sunny stays full', () => {
  const result = simulateBattery([1, 1, 1], 0, 3, lander)
  assert.equal(result.minBatteryFraction, 1)
  assert.equal(result.rechargeHours, 0)
})

test('findFullChargeWindows reports the battery at each sunset', () => {
  const battery = new Float32Array([1000, 1000, 900, 800])
  assert.deepEqual(findFullChargeWindows(battery, [1, 0, 0], 0, 1000), [
    { sunsetOffset: 1, batteryAtSunsetFraction: 1, fullBeforeSunset: true },
  ])
})
