import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CAP_GRID_SIZE, capCellCenterFromId, capCellContaining, capPixelIndex, capPixelLookup, capPixelsRgba, capTileIdsInBounds, capTileIdsInCircle } from './capGrid.js'

// Tile squares are synthetic; the id → centre check reads the real committed tile.
const capIndex = { tiles: [{ id: 'a', boundsM: [0, 0, 40000, 40000] }, { id: 'b', boundsM: [40000, 0, 80000, 40000] }, { id: 'c', boundsM: [0, 40000, 40000, 80000] }] }

test('capCellCenterFromId: ids give the cell centre, other ids give null', () => {
  assert.deepEqual(capCellCenterFromId('CAP-r076c076'), { xM: 1000, yM: 1000 })
  assert.deepEqual(capCellCenterFromId('cap-r075c112'), { xM: 73000, yM: -1000 })
  assert.equal(capCellCenterFromId('MAL-AZSPK'), null)
  const tile = JSON.parse(readFileSync(new URL('../../public/data/cap/cap_0_0.json', import.meta.url)))
  for (const cell of tile.cells.slice(0, 20)) assert.deepEqual(capCellCenterFromId(cell.id), { xM: cell.xM, yM: cell.yM })
})

test('tiles touching a circle or a view box', () => {
  assert.deepEqual(capTileIdsInCircle(capIndex, 10000, 10000, 0), ['a'])
  assert.deepEqual(capTileIdsInCircle(capIndex, 45000, 35000, 6000), ['a', 'b'])
  assert.deepEqual(capTileIdsInCircle(capIndex, 45000, 35000, 10000), ['a', 'b', 'c'])
  assert.deepEqual(capTileIdsInCircle(capIndex, 200000, 0, 1000), [])
  assert.deepEqual(capTileIdsInBounds(capIndex, [50000, 10000, 60000, 20000]), ['b'])
  assert.deepEqual(capTileIdsInBounds(capIndex, [-5000, -5000, 5000, 5000]), ['a'])
})

test('capCellContaining finds the 2 km square, or null', () => {
  const cells = [{ id: 'x', xM: 1000, yM: 1000 }, { id: 'y', xM: 3000, yM: 1000 }]
  assert.equal(capCellContaining(cells, 1999, 1)?.id, 'x')
  assert.equal(capCellContaining(cells, 2500, 900)?.id, 'y')
  assert.equal(capCellContaining(cells, 5000, 1000), null)
})

test('raster: one pixel per cell, north at the top, transparent where nothing is loaded', () => {
  const north = { xM: 1000, yM: 151000 }
  const south = { xM: -151000, yM: -151000 }
  assert.equal(capPixelIndex(north), 76)
  assert.equal(capPixelIndex(south), (CAP_GRID_SIZE - 1) * CAP_GRID_SIZE)
  const rgba = capPixelsRgba([north, south], ['#ff0000', '#0000ff'])
  assert.deepEqual([...rgba.subarray(76 * 4, 76 * 4 + 4)], [255, 0, 0, 255])
  assert.deepEqual([...rgba.subarray(0, 4)], [0, 0, 0, 0])
  const lookup = capPixelLookup([north, south])
  assert.deepEqual([lookup[76], lookup[(CAP_GRID_SIZE - 1) * CAP_GRID_SIZE], lookup[5]], [0, 1, -1])
})

test('raster: a pointer exactly on the right or bottom edge stays in the last column or row', () => {
  assert.equal(capPixelIndex({ xM: 152000, yM: 0 }) % CAP_GRID_SIZE, CAP_GRID_SIZE - 1)
  assert.equal(Math.floor(capPixelIndex({ xM: 0, yM: -152000 }) / CAP_GRID_SIZE), CAP_GRID_SIZE - 1)
  assert.equal(capPixelIndex({ xM: -152000, yM: 152000 }), 0)
})
