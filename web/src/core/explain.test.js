import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compassName } from './explain.js'

test('compassName', () => {
  assert.equal(compassName(0), 'north')
  assert.equal(compassName(90), 'east')
  assert.equal(compassName(225), 'south-west')
  assert.equal(compassName(350), 'north')
})
