// C3 — Energy need. Contract: README "C3 Energy need".
/* eslint-disable no-unused-vars -- stub parameters; delete this line when you implement the module */
import { notImplemented } from './notImplemented.js'

/**
 * Dark periods (diskFraction < 0.5) inside the window, in time order.
 * @returns {{startOffset:number, lengthHours:number}[]}  startOffset counted from startIndex
 */
export function findDarkPeriods(diskFraction, startIndex, lengthHours) {
  throw notImplemented('C3', 'findDarkPeriods')
}

/**
 * @param {import('./sunlight.js').SunTrack} sunTrack
 * @param {{panelMaxW:number, loadW:number}} lander
 * @returns {{totalLoadWh:number, totalGeneratedWh:number, energyBalanceWh:number,
 *            minimumCapacityWh:number, longestDarkEnergyWh:number,
 *            darkPeriods:{startOffset:number, lengthHours:number, energyWh:number}[]}}
 *   minimumCapacityWh: a battery that starts full and is larger than this never runs empty in the window
 */
export function summarizeEnergyNeed(sunTrack, startIndex, lengthHours, lander) {
  throw notImplemented('C3', 'summarizeEnergyNeed')
}
