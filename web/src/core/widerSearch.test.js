import test from 'node:test'
import assert from 'node:assert/strict'
import { suggestWiderSearch } from './widerSearch.js'
import { STATUS } from './optimizer.js'

// Synthetic results: 2 cells x 5 landing times.
const makeResults = (passingSlots) => ({
  cellCount: 2,
  landingCount: 5,
  status: Uint8Array.from({ length: 10 }, (_, slot) => (slot < passingSlots ? STATUS.pass : STATUS.fail)),
})

test('suggests a wider search when few slots pass in region scope', () => {
  assert.equal(suggestWiderSearch({ searchScope: 'region' }, makeResults(1)), true)
})

test('does not suggest it when enough slots pass', () => {
  assert.equal(suggestWiderSearch({ searchScope: 'region' }, makeResults(2)), false)
})

test('marginal slots count as passing', () => {
  const results = makeResults(0)
  results.status[0] = results.status[1] = STATUS.marginal
  assert.equal(suggestWiderSearch({ searchScope: 'region' }, results), false)
})

test('never suggests it outside region scope', () => {
  assert.equal(suggestWiderSearch({ searchScope: 'radius' }, makeResults(0)), false)
})
