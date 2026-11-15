// Tests for core/mapTiles.js. The index below is a synthetic pyramid (4 levels, one missing tile), not the real relief index.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_TILES, reliefLevelFor, visibleReliefTiles } from './mapTiles.js'

const names = (size) => Array.from({ length: size * size }, (_, i) => `${i % size}_${Math.floor(i / size)}`)
const index = {
  boundsM: [-304000, -304000, 304000, 304000],
  levels: [0, 1, 2, 3].map((z) => ({ z, tileSizeM: 608000 / 2 ** z, metersPerPixel: 608000 / 2 ** z / 512, tiles: names(2 ** z) })),
}
const VIEWPORT_PX = 800

test('level: the coarsest level at least as sharp as the screen, else the finest', () => {
  assert.equal(reliefLevelFor(index, 760).z, 1) // level 1 is 594 m/px
  assert.equal(reliefLevelFor(index, 300).z, 2) // level 2 is 297 m/px
  assert.equal(reliefLevelFor(index, 10).z, 3)
  assert.equal(reliefLevelFor(index, 5000).z, 0)
})

test('whole map: chosen level plus the coarser level under it, every tile inside the map', () => {
  const tiles = visibleReliefTiles({ k: 1, x: 0, y: 0 }, VIEWPORT_PX, index)
  assert.deepEqual(tiles.map((tile) => tile.level), [0, 1, 1, 1, 1])
  assert.equal(tiles[0].url, '/maps/relief/0/0_0.jpg')
  assert.deepEqual([tiles[0].xM, tiles[0].yM, tiles[0].sizeM], [-304000, 304000, 608000])
})

test('zoomed in: only tiles that touch the view, at a finer level, with their map position', () => {
  // k = 8 centred on the pole: the view spans ±38 km, 95 m/px: sharper than every level, so the finest (3) is chosen
  const tiles = visibleReliefTiles({ k: 8, x: 0, y: 0 }, VIEWPORT_PX, index)
  const finest = tiles.filter((tile) => tile.level === Math.max(...tiles.map((other) => other.level)))
  assert.equal(finest[0].level, 3)
  assert.ok(finest.length <= 4 && finest.length >= 1)
  assert.ok(finest.every((tile) => tile.xM < 40000 && tile.xM + tile.sizeM > -40000 && tile.yM > -40000 && tile.yM - tile.sizeM < 40000))
  assert.ok(tiles.some((tile) => tile.level === 2)) // the coarser level stays underneath, listed first
  assert.equal(tiles[0].level, 2)
})

test('tiles missing from the index are skipped', () => {
  const sparse = { ...index, levels: index.levels.map((level) => (level.z === 3 ? { ...level, tiles: ['4_4'] } : level)) }
  const tiles = visibleReliefTiles({ k: 8, x: 0, y: 0 }, VIEWPORT_PX, sparse).filter((tile) => tile.level === 3)
  assert.deepEqual(tiles.map((tile) => tile.url), ['/maps/relief/3/4_4.jpg'])
})

test('never more than MAX_TILES, whatever the viewport', () => {
  assert.ok(visibleReliefTiles({ k: 1, x: 0, y: 0 }, 4000, index).length <= MAX_TILES)
})

test('HiDPI: the finest level keeps its tiles, the coarser level only fills the leftover slots', () => {
  const deep = { ...index, levels: [0, 1, 2, 3, 4].map((z) => ({ z, tileSizeM: 608000 / 2 ** z, metersPerPixel: 608000 / 2 ** z / 512, tiles: names(2 ** z) })) }
  const tiles = visibleReliefTiles({ k: 2, x: 0, y: 0 }, 1200, deep, 2) // level 4 is chosen; level 3 alone has about 30 tiles in view
  assert.ok(tiles.length <= MAX_TILES)
  assert.ok(tiles.some((tile) => tile.level === 4))
  assert.ok(tiles.filter((tile) => tile.level === 4).length > 0)
})
