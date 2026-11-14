import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decodeShareQuery, encodeShareQuery } from './shareLink.js'
import { DEFAULT_SCENARIO } from './scenario.js'

test('share link round trip', () => {
  const state = {
    scenario: { ...DEFAULT_SCENARIO, currentPoint: { type: 'cell', cellId: 'MAL-r3c4' }, stayDays: 7 },
    landingTime: '2028-01-15T06:00Z',
    selectedCellId: 'MAL-r4c4',
    mode: 'simple',
    screen: 'results',
  }
  assert.deepEqual(decodeShareQuery(encodeShareQuery(state)), state)
})

test('share link: malformed values fall back to defaults', () => {
  const { scenario } = decodeShareQuery('stay=&dark=abc&battery=1e999&panelMode=x&scope=y&point=cellX')
  assert.equal(scenario.stayDays, DEFAULT_SCENARIO.stayDays)
  assert.equal(scenario.maxDarkHours, DEFAULT_SCENARIO.maxDarkHours)
  assert.equal(scenario.batteryCapacityWh, DEFAULT_SCENARIO.batteryCapacityWh)
  assert.equal(scenario.panelMode, 'auto')
  assert.equal(scenario.searchScope, 'region')
  assert.equal(scenario.currentPoint, null)
  assert.equal(decodeShareQuery('point=coords:,').scenario.currentPoint, null)
  assert.equal(decodeShareQuery('point=cell:').scenario.currentPoint, null)
  assert.deepEqual(decodeShareQuery('point=coords:-85.9,-1.2').scenario.currentPoint, { type: 'coordinates', lat: -85.9, lon: -1.2 })
})
