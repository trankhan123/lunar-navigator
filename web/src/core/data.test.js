import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hourIndexOf, resolveCurrentCell, timeAtHour, toPolarXY } from './data.js'
import { assertNear } from './testHelpers.js'

const ephemeris = { startTime: '2028-01-01T00:00Z', hours: 48 }

test('hour index ↔ ISO time', () => {
  assert.equal(hourIndexOf(ephemeris, '2028-01-02T06:00Z'), 30)
  assert.equal(timeAtHour(ephemeris, 30), '2028-01-02T06:00Z')
  assert.throws(() => hourIndexOf(ephemeris, '2028-01-03T00:00Z'))
  assert.throws(() => hourIndexOf(ephemeris, '2028-01-01T00:30Z'))
  assert.throws(() => hourIndexOf(ephemeris, '2028-01-01T06:00'))
})

test('toPolarXY matches the PGDA projection (pyproj: lat −85, lon 0 → y 151713 m)', () => {
  const { xM, yM } = toPolarXY(-85, 0)
  assertNear(xM, 0, 1e-6)
  assertNear(yM, 151713, 1)
  assertNear(toPolarXY(-85, 90).xM, 151713, 1)
  assert.deepEqual(toPolarXY(10, 0), { xM: null, yM: null })
})

test('resolveCurrentCell: grid cell, site and typed coordinates', () => {
  const cell = { id: 'MAL-r1c1', lat: -85.9, lon: -1.2 }
  assert.equal(resolveCurrentCell({ type: 'cell', cellId: 'MAL-r1c1' }, { MAL: [cell] }, []), cell)
  assert.throws(() => resolveCurrentCell({ type: 'cell', cellId: 'MAL-r9c9' }, { MAL: [cell] }, []))
  const site = { id: 'apollo-11', name: 'Apollo 11', lat: 0.67, lon: 23.47, horizon: null }
  const siteCell = resolveCurrentCell({ type: 'site', siteId: 'apollo-11' }, {}, [site])
  assert.equal(siteCell.id, 'SITE-apollo-11')
  assert.equal(siteCell.xM, null)
  assert.equal(resolveCurrentCell({ type: 'site', siteId: 'x' }, {}, [{ id: 'x', name: 'X', lat: 0, lon: 0 }]).horizon, null)
  assert.throws(() => resolveCurrentCell({ type: 'bogus' }, {}, []))
  const custom = resolveCurrentCell({ type: 'coordinates', lat: -85, lon: 0 }, {}, [])
  assert.equal(custom.id, 'CUSTOM')
  assert.equal(custom.horizon, null)
  assertNear(custom.yM, 151713, 1)
})
