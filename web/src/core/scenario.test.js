import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_SCENARIO, LANDER_PRESETS, MAX_SEARCH_RADIUS_KM, countDays, validateScenario } from './scenario.js'

const ephemeris = { startTime: '2027-01-01T00:00Z', stepHours: 1, hours: 762 * 24 }
const valid = { ...DEFAULT_SCENARIO, currentPoint: { type: 'cell', cellId: 'MAL-r1c1' } }
const fieldsWithErrors = (scenario) => validateScenario(scenario, ephemeris).map((error) => error.field)

test('countDays includes both ends', () => {
  assert.equal(countDays('2028-01-01', '2028-01-01'), 1)
  assert.equal(countDays('2028-01-01', '2028-06-30'), 182)
})

test('validateScenario caps the search radius', () => {
  const radius = (searchRadiusKm) => ({ ...valid, searchScope: 'radius', searchRadiusKm })
  assert.equal(MAX_SEARCH_RADIUS_KM, 50)
  assert.deepEqual(validateScenario(radius(50), ephemeris), [])
  assert.deepEqual(fieldsWithErrors(radius(51)), ['searchRadiusKm'])
  assert.match(validateScenario(radius(51), ephemeris)[0].message, /at most 50 km/)
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
  assert.deepEqual(fieldsWithErrors({ ...valid, requireDsn: 'yes' }), ['requireDsn'])
})

test('every lander preset is a valid scenario and real presets cite sources', () => {
  for (const { id, source, sourceUrl, basis, note, ...fields } of LANDER_PRESETS) {
    assert.deepEqual(fieldsWithErrors({ ...valid, ...fields }), [], id)
    if (id === 'example-lander') continue
    assert.ok(sourceUrl.startsWith('https://') && source && note, id)
    for (const name of ['panelMaxW', 'batteryCapacityWh', 'loadW']) assert.match(basis[name], /^(published|estimate)$/, `${id} ${name}`)
  }
})
