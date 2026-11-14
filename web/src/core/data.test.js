import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hourIndexOf, timeAtHour } from './data.js'

const ephemeris = { startTime: '2028-01-01T00:00Z', hours: 48 }

test('hour index ↔ ISO time', () => {
  assert.equal(hourIndexOf(ephemeris, '2028-01-02T06:00Z'), 30)
  assert.equal(timeAtHour(ephemeris, 30), '2028-01-02T06:00Z')
  assert.throws(() => hourIndexOf(ephemeris, '2028-01-03T00:00Z'))
  assert.throws(() => hourIndexOf(ephemeris, '2028-01-01T00:30Z'))
})
