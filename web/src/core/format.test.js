import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatDuration, formatUtc } from './format.js'

test('formatDuration', () => {
  assert.equal(formatDuration(0.5), '30 min')
  assert.equal(formatDuration(3 + 1 / 3), '3 h 20 min')
  assert.equal(formatDuration(2.999), '3 h')
  assert.equal(formatDuration(76), '3 d 4 h')
  assert.equal(formatDuration(72), '3 d')
})

test('formatUtc', () => {
  assert.equal(formatUtc('2028-01-15T06:00Z'), '2028-01-15 06:00 UTC')
})
