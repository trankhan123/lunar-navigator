import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_SCENARIO } from './scenario.js'
import { missionFieldStatus, prepareGuidedRequest, recordEnteredFields } from './missionGuide.js'

// Synthetic site and scenarios for guide validation only.
const sites = [{ id: 'test-site', name: 'Test site' }]
const ephemeris = { startTime: '2027-01-01T00:00Z', hours: 18288, stepHours: 1 }

test('blank guide keeps defaults and produces no message or invented input', () => {
  const result = prepareGuidedRequest({ batteryCapacityWh: '', maxDarkHours: ' ' }, {}, DEFAULT_SCENARIO, ephemeris, sites)
  assert.equal(result.message, '')
  assert.deepEqual(result.patch, {})
  assert.deepEqual(result.errors, [])
  assert.deepEqual(result.scenario, DEFAULT_SCENARIO)
})

test('guided values normalize units and include only supplied details in the prompt', () => {
  const result = prepareGuidedRequest({ currentPoint: 'test-site', batteryCapacityWh: '2,5', maxDarkHours: '2', stayDays: '48' },
    { batteryCapacityWh: 'kWh', maxDarkHours: 'days', stayDays: 'h' }, DEFAULT_SCENARIO, ephemeris, sites)
  assert.deepEqual(result.errors, [])
  assert.equal(result.scenario.batteryCapacityWh, 2500)
  assert.equal(result.scenario.maxDarkHours, 48)
  assert.equal(result.scenario.stayDays, 2)
  assert.match(result.message, /Battery capacity: 2.5 kWh/)
  assert.match(result.message, /Maximum night time: 2 days/)
  assert.doesNotMatch(result.message, /Solar panel power:|2028-01-01/)
})

test('guided input rejects malformed, impossible and incompatible values before sending', () => {
  for (const [values, units, field] of [
    [{ batteryCapacityWh: 'abc' }, {}, 'batteryCapacityWh'],
    [{ batteryCapacityWh: '0' }, {}, 'batteryCapacityWh'],
    [{ batteryCapacityWh: '10' }, { batteryCapacityWh: 'W' }, 'batteryCapacityWh'],
    [{ stayDays: '12' }, { stayDays: 'h' }, 'stayDays'],
    [{ currentPoint: 'invented' }, {}, 'currentPoint'],
    [{ startDate: '2028-02-30' }, {}, 'startDate'],
    [{ startDate: '2028-12-01' }, {}, 'endDate'],
  ]) {
    const result = prepareGuidedRequest(values, units, DEFAULT_SCENARIO, ephemeris, sites)
    assert.ok(result.errors.some((error) => error.field === field), field)
  }
})

test('status distinguishes defaults, explicit values equal to defaults and external form edits', () => {
  assert.equal(missionFieldStatus('batteryCapacityWh', DEFAULT_SCENARIO, {}, []).kind, 'default')
  const entered = recordEnteredFields({}, { batteryCapacityWh: DEFAULT_SCENARIO.batteryCapacityWh })
  assert.equal(missionFieldStatus('batteryCapacityWh', DEFAULT_SCENARIO, entered, []).kind, 'entered')
  const custom = { ...DEFAULT_SCENARIO, batteryCapacityWh: 1000 }
  assert.equal(missionFieldStatus('batteryCapacityWh', custom, entered, []).kind, 'current')
  assert.equal(missionFieldStatus('batteryCapacityWh', custom, entered, [{ field: 'batteryCapacityWh' }]).kind, 'invalid')
  assert.equal(missionFieldStatus('currentPoint', DEFAULT_SCENARIO, {}, [{ field: 'currentPoint' }]).kind, 'missing')
  const followup = recordEnteredFields(entered, { loadW: 150 })
  assert.equal(followup.batteryCapacityWh, entered.batteryCapacityWh)
  assert.equal(followup.loadW, '150')
})
