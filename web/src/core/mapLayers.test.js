// W2 map v2 — layers, levels and colours (plan Task 2). Synthetic samples, not real data.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { INFEASIBLE_COLOR, MAP_LAYERS, NOT_SEARCHED_COLOR, NO_VALUE_COLOR, cellColor, cellLevel, earthLevel, sunEarthLevel, sunLevel } from './mapLayers.js'

const legend = (layerId) => MAP_LAYERS.find((layer) => layer.id === layerId).legend

test('levels follow the 50 % disk rule; a whole disk is full Sun', () => {
  assert.deepEqual([0, 0.49, 0.5, 0.99, 1].map((f) => sunLevel(f)), [0, 0, 1, 1, 2])
  assert.deepEqual([0, 0.49, 0.5, 1].map((f) => earthLevel(f)), [0, 0, 1, 1])
  assert.equal(sunEarthLevel(0, 0), 0)
  assert.equal(sunEarthLevel(0.2, 0.7), 1)
  assert.equal(sunEarthLevel(1, 0.3), 2)
  assert.equal(sunEarthLevel(0.5, 0.5), 3)
})

test('cellLevel and cellColor per layer', () => {
  assert.equal(cellLevel('sunNow', { sunDiskFraction: 0.7 }), 1)
  assert.equal(cellLevel('sunNow', {}), null)
  assert.equal(cellLevel('searchResult', { feasible: true, status: 1 }), 1)
  assert.equal(cellLevel('searchResult', { feasible: false, status: 1 }), null)
  assert.equal(cellColor('sunNow', { sunDiskFraction: 1 }), legend('sunNow')[2].color)
  assert.equal(cellColor('earthNow', { earthDiskFraction: 0.2 }), legend('earthNow')[0].color)
  assert.equal(cellColor('sunEarthNow', { sunDiskFraction: 1, earthDiskFraction: 1 }), legend('sunEarthNow')[3].color)
  assert.equal(cellColor('sunNow', {}), NO_VALUE_COLOR)
  assert.equal(cellColor('feasibility', { feasible: true }), '#0ea5e9')
  assert.equal(cellColor('feasibility', { feasible: false }), INFEASIBLE_COLOR)
  assert.equal(cellColor('searchResult', { feasible: true, status: 2 }), '#10b981')
  assert.equal(cellColor('searchResult', { feasible: true }), NOT_SEARCHED_COLOR)
  assert.equal(cellColor('searchResult', { feasible: false, status: 2 }), INFEASIBLE_COLOR)
})

test('every layer has a label, every legend colour has text', () => {
  assert.deepEqual(MAP_LAYERS.map((layer) => layer.id), ['sunNow', 'earthNow', 'sunEarthNow', 'searchResult', 'feasibility'])
  for (const layer of MAP_LAYERS) {
    assert.ok(layer.label, layer.id)
    for (const entry of layer.legend) assert.ok(entry.label && /^#[0-9a-f]{6}$/.test(entry.color), layer.id)
  }
})
