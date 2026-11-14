// C4 — Charging (battery simulation). Contract: README "C4 Charging".
/* eslint-disable no-unused-vars -- stub parameters; delete this line when you implement the module */
import { notImplemented } from './notImplemented.js'

/**
 * Hourly battery: starts full, battery[h+1] = clamp(battery[h] + panelMaxW × powerFactor − loadW, 0, capacity).
 * @param {Float32Array|number[]} powerFactor  SunTrack.powerFactor
 * @param {{panelMaxW:number, loadW:number, batteryCapacityWh:number}} lander
 * @returns {{batteryWh:Float32Array, minBatteryWh:number, minBatteryFraction:number,
 *            deadAtHour:number|null, rechargeHours:number|null, chargingMask:Uint8Array}}
 *   batteryWh has lengthHours + 1 values; chargingMask has lengthHours values (1 = generation > load)
 */
export function simulateBattery(powerFactor, startIndex, lengthHours, lander) {
  throw notImplemented('C4', 'simulateBattery')
}

/**
 * One entry per sunset (sunlit → dark) inside the window.
 * @returns {{sunsetOffset:number, batteryAtSunsetFraction:number, fullBeforeSunset:boolean}[]}
 */
export function findFullChargeWindows(batteryWh, sunDiskFraction, startIndex, batteryCapacityWh) {
  throw notImplemented('C4', 'findFullChargeWindows')
}
