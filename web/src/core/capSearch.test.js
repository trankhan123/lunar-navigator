import { test } from 'node:test'
import assert from 'node:assert/strict'
import { capTileIdsForSearch, regionCodesForSearch, searchAnchor } from './capSearch.js'
import { selectSearchCells } from './optimizer.js'
import { toPolarXY } from './data.js'

// Synthetic regions, tiles and cells (not real data); the point (-87.5, 45) is between regions.
const regions = [{ code: 'AAA', boundsM: [0, 0, 10000, 10000] }, { code: 'BBB', boundsM: [100000, 0, 110000, 10000] }]
const capIndex = { tiles: [{ id: 't0', boundsM: [0, -40000, 40000, 0] }, { id: 't1', boundsM: [40000, -40000, 80000, 0] }, { id: 't2', boundsM: [120000, 0, 160000, 40000] }] }
const radiusScenario = (searchRadiusKm) => ({ searchScope: 'radius', searchRadiusKm })

test('searchAnchor: site, coordinates, CAP cell id, loaded LGRS cell, point off the map', () => {
  const sites = [{ id: 's', lat: -87.5, lon: 45 }]
  const expected = toPolarXY(-87.5, 45)
  assert.deepEqual(searchAnchor({ type: 'site', siteId: 's' }, sites, {}), expected)
  assert.deepEqual(searchAnchor({ type: 'coordinates', lat: -87.5, lon: 45 }, [], {}), expected)
  assert.deepEqual(searchAnchor({ type: 'cell', cellId: 'CAP-r076c076' }, [], {}), { xM: 1000, yM: 1000 })
  assert.deepEqual(searchAnchor({ type: 'cell', cellId: 'AAA-x' }, [], { AAA: [{ id: 'AAA-x', xM: 5, yM: 6 }] }), { xM: 5, yM: 6 })
  assert.equal(searchAnchor({ type: 'cell', cellId: 'AAA-x' }, [], {}), null)
  assert.equal(searchAnchor({ type: 'coordinates', lat: 10, lon: 0 }, [], {}), null)
})

test('regionCodesForSearch: radius loads only regions touching the circle', () => {
  const point = { type: 'coordinates', lat: -87.5, lon: 45 }
  const scenario = (extra) => ({ currentPoint: point, ...extra })
  assert.deepEqual(regionCodesForSearch(scenario(radiusScenario(9)), regions, [], { xM: 20000, yM: 5000 }), [])
  assert.deepEqual(regionCodesForSearch(scenario(radiusScenario(15)), regions, [], { xM: 20000, yM: 5000 }), ['AAA'])
  assert.deepEqual(regionCodesForSearch(scenario(radiusScenario(10)), regions, [], null), ['AAA', 'BBB']) // position unknown: all
  assert.deepEqual(regionCodesForSearch(scenario({ searchScope: 'all' }), regions, [], null), ['AAA', 'BBB'])
  assert.deepEqual(regionCodesForSearch(scenario({ searchScope: 'region' }), regions, [], { xM: 5000, yM: 5000 }), ['AAA'])
  assert.deepEqual(regionCodesForSearch(scenario({ searchScope: 'region' }), regions, [], { xM: 50000, yM: 5000 }), [])
})

test('capTileIdsForSearch: radius circle, 15 km for "same region" outside the regions, own tile for "all"', () => {
  const anchor = { xM: 39000, yM: -1000 }
  assert.deepEqual(capTileIdsForSearch(radiusScenario(0.5), capIndex, anchor, false), ['t0'])
  assert.deepEqual(capTileIdsForSearch(radiusScenario(20), capIndex, anchor, false), ['t0', 't1'])
  assert.deepEqual(capTileIdsForSearch({ searchScope: 'region' }, capIndex, anchor, false), ['t0', 't1']) // 15 km reaches t1 at 1 km
  assert.deepEqual(capTileIdsForSearch({ searchScope: 'region' }, capIndex, anchor, true), [])
  assert.deepEqual(capTileIdsForSearch({ searchScope: 'all' }, capIndex, anchor, false), ['t0'])
  assert.deepEqual(capTileIdsForSearch(radiusScenario(20), null, anchor, false), []) // no CAP grid (mock data)
  assert.deepEqual(capTileIdsForSearch(radiusScenario(20), capIndex, null, false), []) // off the map
})

test('selectSearchCells: CAP cells join a radius search; "same region" off the regions searches CAP within 15 km; "all" ignores CAP', () => {
  const point = { id: 'CUSTOM', lat: -87.5, lon: 45 }
  const around = (id, offsetDeg, feasible = true) => ({ id, lat: -87.5 - offsetDeg, lon: 45, feasible })
  const lgrs = { AAA: [around('AAA-a', 0.1)] }
  const cap = [around('CAP-near', 0.2), around('CAP-bad', 0.2, false), around('CAP-far', 2)]
  const ids = (scope, extra) => selectSearchCells({ searchScope: scope, ...extra }, point, lgrs, cap).map((cell) => cell.id)
  assert.deepEqual(ids('radius', { searchRadiusKm: 20 }), ['CUSTOM', 'AAA-a', 'CAP-near']) // 0.1° is about 3 km, 0.2° about 6 km
  assert.deepEqual(ids('region'), ['CUSTOM', 'CAP-near'])
  assert.deepEqual(ids('all'), ['CUSTOM', 'AAA-a'])
  assert.deepEqual(selectSearchCells({ searchScope: 'region' }, point, lgrs), [point]) // no CAP loaded: as before
})
