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
