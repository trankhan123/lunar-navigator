// W2 map v2 — find box (plan Task 11). Region bounds are rounded real values; the cells are synthetic.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nearestRegionCode, searchMap } from './mapSearch.js'

const regions = [
  { code: 'MAL', name: 'Malapert Massif', boundsM: [-11063.4, 110667.0, 10057.3, 132793.8] },
  { code: 'HAW', name: 'Haworth', boundsM: [-53316.9, 75455.7, -22135.8, 105630.8] },
  { code: 'MMP', name: 'Mons Mouton Plateau', boundsM: [62377.3, 136823.9, 96576.5, 171023.1] },
]
const sites = [
  { id: 'malapert-massif', name: 'Malapert Massif', lat: -85.925, lon: -1.205, region: 'MAL' },
  { id: 'im-2', name: 'IM-2', lat: -84.7906, lon: 29.1957, region: null },
  { id: 'apollo-11', name: 'Apollo 11', lat: 0.67416, lon: 23.47314, region: null },
]
const cellsByRegion = { HAW: [{ id: 'HAW-AYR--' }, { id: 'HAW-AYRA-' }, { id: 'HAW-AZSBD' }] }

test('searchMap: regions and polar sites by name, ignoring case and spaces', () => {
  const { matches, regionCodeToLoad } = searchMap('  mal ', regions, sites, {})
  assert.deepEqual(matches.map((match) => [match.type, match.label]), [['region', 'Malapert Massif (MAL)']])
  assert.equal(regionCodeToLoad, null)
  const [site] = searchMap('im-', regions, sites, {}).matches
  assert.deepEqual([site.type, site.label, site.regionCode], ['site', 'IM-2', 'MMP'])
  assert.deepEqual(searchMap('apollo', regions, sites, {}).matches, []) // not on the polar map
  assert.deepEqual(searchMap('', regions, sites, {}), { matches: [], regionCodeToLoad: null })
})

test('searchMap: cell IDs by prefix, dashes included; asks for the region file first', () => {
  assert.deepEqual(searchMap('haw-ayr', regions, sites, cellsByRegion).matches.map((match) => match.label), ['HAW-AYR--', 'HAW-AYRA-'])
  assert.deepEqual(searchMap(' HAW-AYR-- ', regions, sites, cellsByRegion).matches.map((match) => match.cell.id), ['HAW-AYR--'])
  assert.deepEqual(searchMap('mal-az', regions, sites, cellsByRegion), { matches: [], regionCodeToLoad: 'MAL' })
  assert.deepEqual(searchMap('xyz-ab', regions, sites, cellsByRegion), { matches: [], regionCodeToLoad: null })
})

test('nearestRegionCode: the region of the searched grid cell nearest the point (review finding 3)', () => {
  const im2 = { lat: -84.7906, lon: 29.1957 }
  const cells = [
    { id: 'SITE-im-2', lat: -84.7906, lon: 29.1957 }, // the current point's pseudo-cell: not a region
    { id: 'MAL-AZSPK', lat: -86.3187, lon: -5.4281 },
    { id: 'MMP-BCS-T', lat: -84.79, lon: 29.3 },
  ]
  assert.equal(nearestRegionCode(im2, cells, regions), 'MMP')
  assert.equal(nearestRegionCode(im2, [cells[0]], regions), null)
})
