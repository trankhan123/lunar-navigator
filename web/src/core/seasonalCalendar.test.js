import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  computeSeasonalCalendar,
  SEASONAL_DAYS_2027,
  SEASONAL_DAYS_2028,
  TOTAL_SEASONAL_DAYS,
  TOTAL_SEASONAL_HOURS,
} from './seasonalCalendar.js'

const here = dirname(fileURLToPath(import.meta.url))
const ephemeris = JSON.parse(readFileSync(resolve(here, '../../public/data/ephemeris.json'), 'utf8'))
const cellsMal = JSON.parse(readFileSync(resolve(here, '../../public/data/cells_MAL.json'), 'utf8'))

test('seasonalCalendar: constants match 2-year calendar', () => {
  assert.equal(SEASONAL_DAYS_2027, 365)
  assert.equal(SEASONAL_DAYS_2028, 366)
  assert.equal(TOTAL_SEASONAL_DAYS, 731)
  assert.equal(TOTAL_SEASONAL_HOURS, 17544)
})

test('seasonalCalendar: handles null or undefined inputs gracefully', () => {
  const empty = computeSeasonalCalendar(null, null)
  assert.deepEqual(empty.sun2027, [])
  assert.deepEqual(empty.sun2028, [])
  assert.deepEqual(empty.earth2027, [])
  assert.deepEqual(empty.earth2028, [])
  assert.deepEqual(empty.sun['2027'], [])
})

test('seasonalCalendar: generates 731 days of 2027-2028 data ', () => {
  const cell = cellsMal.cells[0]
  const result = computeSeasonalCalendar(cell, ephemeris)

  assert.equal(result.sun2027.length, 365)
  assert.equal(result.sun2028.length, 366)
  assert.equal(result.earth2027.length, 365)
  assert.equal(result.earth2028.length, 366)

  // Verify date boundaries
  assert.equal(result.sun2027[0][0], '2027-01-01')
  assert.equal(result.sun2027[364][0], '2027-12-31')
  assert.equal(result.sun2028[0][0], '2028-01-01')
  assert.equal(result.sun2028[365][0], '2028-12-31')

  // Verify percentage values are in [0, 100]
  for (const [, pct] of [...result.sun2027, ...result.sun2028, ...result.earth2027, ...result.earth2028]) {
    assert.ok(pct >= 0 && pct <= 100, `Percentage ${pct} out of range [0, 100]`)
  }

  // Also check nested sun['2027'] matches sun2027
  assert.equal(result.sun['2027'], result.sun2027)
  assert.equal(result.sun['2028'], result.sun2028)
  assert.equal(result.earth['2027'], result.earth2027)
  assert.equal(result.earth['2028'], result.earth2028)
})
