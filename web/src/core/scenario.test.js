import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_SCENARIO, countDays, validateScenario } from './scenario.js'

const ephemeris = { startTime: '2027-01-01T00:00Z', stepHours: 1, hours: 762 * 24 }
const valid = { ...DEFAULT_SCENARIO, currentPoint: { type: 'cell', cellId: 'MAL-r1c1' } }
const fieldsWithErrors = (scenario) => validateScenario(scenario, ephemeris).map((error) => error.field)

test('countDays includes both ends', () => {
  assert.equal(countDays('2028-01-01', '2028-01-01'), 1)
  assert.equal(countDays('2028-01-01', '2028-06-30'), 182)
})

test('validateScenario', () => {
  assert.deepEqual(validateScenario(valid, ephemeris), [])
  assert.deepEqual(fieldsWithErrors({ ...valid, currentPoint: null }), ['currentPoint'])
  assert.deepEqual(fieldsWithErrors({ ...valid, endDate: '2027-12-31' }), ['endDate'])
  assert.deepEqual(fieldsWithErrors({ ...valid, endDate: '2028-08-01' }), ['endDate'])
  assert.deepEqual(fieldsWithErrors({ ...valid, stayDays: 0 }), ['stayDays'])
  assert.deepEqual(fieldsWithErrors({ ...valid, searchScope: 'radius', searchRadiusKm: 0 }), ['searchRadiusKm'])
  assert.deepEqual(fieldsWithErrors({ ...valid, currentPoint: { type: 'coordinates', lat: -200, lon: 0 } }), ['currentPoint'])
  assert.deepEqual(fieldsWithErrors({ ...valid, startDate: '2028-02-30' }), ['startDate'])
  assert.deepEqual(fieldsWithErrors({ ...valid, panelMode: 'sideways' }), ['panelMode'])
})
