import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findDarkPeriods, summarizeEnergyNeed } from './energyNeed.js'

test('findDarkPeriods', () => {
  assert.deepEqual(findDarkPeriods([1, 0, 0, 1, 0], 0, 5), [
    { startOffset: 1, lengthHours: 2 },
    { startOffset: 4, lengthHours: 1 },
  ])
})

test('summarizeEnergyNeed: 3 dark hours at 100 W need more than 300 Wh of battery', () => {
  const sunTrack = { diskFraction: [0, 0, 0, 1, 1], powerFactor: [0, 0, 0, 1, 1] }
  assert.deepEqual(summarizeEnergyNeed(sunTrack, 0, 5, { panelMaxW: 300, loadW: 100 }), {
    totalLoadWh: 500,
    totalGeneratedWh: 600,
    energyBalanceWh: 100,
    minimumCapacityWh: 300,
    longestDarkEnergyWh: 300,
    darkPeriods: [{ startOffset: 0, lengthHours: 3, energyWh: 300 }],
  })
})
