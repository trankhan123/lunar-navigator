import { test } from 'node:test'
import assert from 'node:assert/strict'
import { attachDsn, detailCellFor, hourIndexOf, resolveCurrentCell, timeAtHour, toPolarXY } from './data.js'
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

test('resolveCurrentCell: CAP cell id, and a point on the cap takes the horizon of its 2 km CAP cell (synthetic cells)', () => {
  const capCell = { id: 'CAP-r076c076', lat: -89.95, lon: 45, xM: 1000, yM: 1000, horizon: [7, 8] }
  assert.equal(resolveCurrentCell({ type: 'cell', cellId: 'CAP-r076c076' }, {}, [], [capCell]), capCell)
  const typed = resolveCurrentCell({ type: 'coordinates', lat: -89.97, lon: 45 }, {}, [], [capCell])
  assert.deepEqual([typed.id, typed.horizon, typed.horizonSource], ['CUSTOM', [7, 8], 'cap'])
  assert.equal(resolveCurrentCell({ type: 'coordinates', lat: -80, lon: 45 }, {}, [], [capCell]).horizon, null) // off the cap
  const lgrsCell = { id: 'MAL-x', xM: 1400, yM: 1000 } // within 1 km: the LGRS rule comes first
  assert.equal(resolveCurrentCell({ type: 'coordinates', lat: -89.97, lon: 45 }, { MAL: [lgrsCell] }, [], [capCell]).horizon, null)
  const site = { id: 's', name: 'S', lat: -89.97, lon: 45, horizon: [1] }
  assert.deepEqual(resolveCurrentCell({ type: 'site', siteId: 's' }, {}, [site], [capCell]).horizon, [1]) // a site's own horizon stays
})

test('attachDsn: attached only when startTime and hours match, else null with a warning', (t) => {
  const warn = t.mock.method(console, 'warn', () => {})
  const ephemeris = { startTime: '2027-01-01T00:00Z', hours: 10 }
  const dsn = { startTime: '2027-01-01T00:00Z', hours: 10 }
  assert.equal(attachDsn(ephemeris, dsn).dsn, dsn)
  assert.equal(warn.mock.callCount(), 0)
  assert.equal(attachDsn(ephemeris, { ...dsn, hours: 9 }).dsn, null)
  assert.equal(attachDsn(ephemeris, { ...dsn, startTime: '2027-01-02T00:00Z' }).dsn, null)
  assert.equal(warn.mock.callCount(), 2)
  assert.equal(attachDsn(ephemeris, null).dsn, null)
  assert.equal(warn.mock.callCount(), 2)
})

test('detailCellFor: the searched point is found by its id, the form point is never used', () => {
  const grid = new Map([['MAL-a', { id: 'MAL-a' }]])
  const searched = { id: 'SITE-x' }
  assert.equal(detailCellFor(grid, 'MAL-a', searched).id, 'MAL-a')
  assert.equal(detailCellFor(grid, 'SITE-x', searched), searched)
  assert.equal(detailCellFor(grid, 'CUSTOM', searched), null)
  assert.equal(detailCellFor(grid, 'SITE-x', null), null)
})
