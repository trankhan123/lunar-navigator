import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_SCENARIO } from './scenario.js'
import { normalizeChatPatch, prepareChatDraft } from './missionChat.js'

// Synthetic IDs and dates for validation tests only.
const catalog = {
  sites: [{ id: 'test-site', name: 'Test site' }],
  cellIds: new Set(['TEST-1']),
  ephemeris: { startTime: '2027-01-01T00:00Z', stepHours: 1, hours: 18288 },
}
const reply = (patch, questions = []) => ({ message: 'Review your mission.', patch, questions })

test('normalizes quantities deterministically and preserves unspecified scenario fields', () => {
  const draft = prepareChatDraft(reply({
    batteryCapacityWh: { value: 2.5, unit: 'kWh' },
    panelMaxW: { value: 1.2, unit: 'kW' },
    stayDays: { value: 48, unit: 'h' },
    maxCommLossHours: { value: 30, unit: 'min' },
    searchRadiusKm: { value: 500, unit: 'm' },
  }), DEFAULT_SCENARIO, catalog)
  assert.equal(draft.scenario.batteryCapacityWh, 2500)
  assert.equal(draft.scenario.panelMaxW, 1200)
  assert.equal(draft.scenario.stayDays, 2)
  assert.equal(draft.scenario.maxCommLossHours, 0.5)
  assert.equal(draft.scenario.searchRadiusKm, 0.5)
  assert.equal(draft.scenario.loadW, DEFAULT_SCENARIO.loadW)
  assert.equal(DEFAULT_SCENARIO.batteryCapacityWh, 10000)
  assert.equal(draft.canApply, false)
  assert.equal(draft.errors[0].field, 'currentPoint')
})

test('rejects unknown fields, IDs, units and non-finite values', () => {
  for (const patch of [
    { tool: 'run_shell' },
    { currentPoint: { type: 'site', siteId: 'invented' } },
    { currentPoint: { type: 'cell', cellId: 'TEST-2' } },
    { currentPoint: { type: 'coordinates', lat: -91, lon: 0 } },
    { panelMaxW: { value: 10, unit: 'Wh' } },
    { loadW: { value: Infinity, unit: 'W' } },
    JSON.parse('{"__proto__":{"polluted":true}}'),
  ]) assert.throws(() => normalizeChatPatch(patch, catalog))
})

test('validates dates, whole stay days and unresolved questions before apply', () => {
  const point = { currentPoint: { type: 'site', siteId: 'test-site' } }
  assert.equal(prepareChatDraft(reply(point), DEFAULT_SCENARIO, catalog).canApply, true)
  assert.equal(prepareChatDraft(reply(point, ['Which year?']), DEFAULT_SCENARIO, catalog).canApply, false)
  for (const patch of [
    { startDate: '2028-02-30' }, { startDate: '2026-01-01' },
    { endDate: '2030-01-01' }, { stayDays: { value: 12, unit: 'h' } },
  ]) {
    const draft = prepareChatDraft(reply({ ...point, ...patch }), DEFAULT_SCENARIO, catalog)
    assert.equal(draft.canApply, false)
    assert.ok(draft.errors.length)
  }
})

test('validates preserved IDs and rejects malformed provider replies', () => {
  const badScenario = { ...DEFAULT_SCENARIO, currentPoint: { type: 'site', siteId: 'unknown' } }
  assert.equal(prepareChatDraft(reply({}), badScenario, catalog).canApply, false)
  for (const output of [null, { message: 'ok', patch: {} }, reply({}, ['a', 'b', 'c']), { ...reply({}), execute: true }]) {
    assert.throws(() => prepareChatDraft(output, DEFAULT_SCENARIO, catalog))
  }
})

test('nullable extraction fields preserve current values without accepting unknown fields', () => {
  const patch = Object.fromEntries(Object.keys(DEFAULT_SCENARIO).map((key) => [key, null]))
  patch.currentPoint = { type: 'site', siteId: 'test-site' }
  patch.batteryCapacityWh = { value: 2.5, unit: 'kWh' }
  const draft = prepareChatDraft(reply(patch), DEFAULT_SCENARIO, catalog)
  assert.equal(draft.canApply, true)
  assert.equal(draft.scenario.batteryCapacityWh, 2500)
  assert.equal(draft.scenario.loadW, DEFAULT_SCENARIO.loadW)
  assert.equal(draft.scenario.endDate, DEFAULT_SCENARIO.endDate)
  assert.deepEqual(Object.keys(draft.patch).sort(), ['batteryCapacityWh', 'currentPoint'])
  assert.throws(() => normalizeChatPatch({ unknown: null }, catalog))
})
