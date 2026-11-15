// W2 map v2 — layers, levels and colours (plan Task 2). Synthetic samples, not real data.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { INFEASIBLE_COLOR, MAP_LAYERS, NOT_SEARCHED_COLOR, NO_VALUE_COLOR, cellColor, cellLevel, earthLevel, fractionColor, nasaCoverageNote, overlayEntry, sunEarthLevel, sunLevel } from './mapLayers.js'

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
  assert.deepEqual(MAP_LAYERS.map((layer) => layer.id), ['sunNow', 'earthNow', 'sunEarthNow', 'sunPercent', 'earthPercent', 'searchResult', 'psrDistance', 'feasibility'])
  for (const layer of MAP_LAYERS) {
    assert.ok(layer.label, layer.id)
    for (const entry of layer.legend) assert.ok(entry.label && /^#[0-9a-f]{6}$/.test(entry.color), layer.id)
  }
})

test('fractionColor interpolates the colour-blind-safe ramp', () => {
  assert.equal(fractionColor(0), '#440154')
  assert.equal(fractionColor(0.5), '#21918c')
  assert.equal(fractionColor(1), '#fde725')
  assert.equal(fractionColor(0.125), '#402a70')
  assert.equal(fractionColor(-0.2), '#440154')
  assert.equal(fractionColor(1.5), '#fde725')
  assert.equal(fractionColor(Number.NaN), null)
  assert.equal(cellColor('sunPercent', { fractionSun: 1 }), '#fde725')
  assert.equal(cellColor('earthPercent', {}), NO_VALUE_COLOR)
})

test('nasaCoverageNote: whole 1 km squares inside the NASA image', () => {
  const overlay = { boundsM: [0, 0, 10000, 10000] }
  const inside = { xM: 5000, yM: 5000 }
  const edge = { xM: 9500, yM: 5000 } // square reaches x = 10000 exactly: still covered
  const outside = { xM: 9501, yM: 5000 }
  assert.equal(nasaCoverageNote('Malapert Massif', [inside, edge], overlay), null)
  assert.equal(nasaCoverageNote('Nobile Rim 2', [inside, outside], overlay), 'NASA data covers only part of Nobile Rim 2.')
  assert.equal(nasaCoverageNote('Peak near Cabeus B', [inside], undefined), 'NASA data covers about 85°S to the pole; not available for Peak near Cabeus B.')
})

test('overlayEntry: a region uses its own image, the overview and slope use the whole-pole one', () => {
  const maps = [
    { id: 'south_pole', kind: 'psr', image: '/maps/pole_psr.png' },
    { id: 'south_pole', kind: 'slope', image: '/maps/pole_slope.png' },
    { id: 'MAL', kind: 'psr', image: '/maps/MAL_psr.png' },
  ]
  assert.equal(overlayEntry(maps, 'psr', null).image, '/maps/pole_psr.png')
  assert.equal(overlayEntry(maps, 'psr', 'MAL').image, '/maps/MAL_psr.png')
  assert.equal(overlayEntry(maps, 'psr', 'HAW'), undefined) // not the pole image: it would hide the region's missing data
  assert.equal(overlayEntry(maps, 'slope', 'HAW').image, '/maps/pole_slope.png')
  assert.equal(overlayEntry(maps, 'sun-visibility', null), undefined)
})

test('psrDistance layer: bands by km (synthetic values), no value gets the neutral colour', () => {
  assert.deepEqual([0, 1.9, 2, 7, 12].map((km) => cellLevel('psrDistance', { psrDistanceKm: km })), [4, 3, 2, 1, 0])
  assert.equal(cellLevel('psrDistance', {}), null)
  assert.equal(cellColor('psrDistance', { psrDistanceKm: null }), NO_VALUE_COLOR)
})
