// W7 learn mode logic (README "W7 Learn mode"). Every number here is SYNTHETIC test data, not real lunar data.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { metricSentences, moonFacts, neighborLesson } from './learn.js'

const failingMetrics = {
  status: 'fail', failReasons: ['dark', 'battery'], cellId: 'MAL-test',
  longestDarkHours: 90, longestCommLossHours: 0, fractionSun: 0.729, fractionEarth: 1, fractionBoth: 0.729,
  meanSunElevationDeg: 1.43, hoursToSunset: 20, minBatteryFraction: 0, deadAtHour: 34, rechargeHours: null,
}

const valuesOf = (rows) => Object.fromEntries(rows.map((row) => [row.label, row.value]))

test('metricSentences: one labelled value per metric, in reading order', () => {
  assert.deepEqual(valuesOf(metricSentences(failingMetrics)), {
    'Result': 'Fails a limit',
    'Longest dark period': '3 d 18 h',
    'Longest time without Earth': 'None',
    'Time in sunlight': '73 %',
    'Earth in view': '100 %',
    'Sun and Earth together': '73 %',
    'Average Sun height': '1.4°',
    'Lowest battery': '0 %',
    'Battery runs out': 'after 34 h',
    'Time to recharge': 'Not in this stay',
    'First sunset': 'after 20 h',
  })
})

test('metricSentences: every sentence is plain prose, and a failure names its reasons', () => {
  const rows = metricSentences(failingMetrics)
  for (const row of rows) assert.match(row.sentence, /^[A-Z][^]*\.$/, row.label)
  const result = rows.find((row) => row.label === 'Result').sentence
  assert.match(result, /the dark period is too long/)
  assert.match(result, /the battery runs out/)
})

test('metricSentences: zero and missing values get their own wording', () => {
  const quiet = {
    ...failingMetrics, status: 'pass', failReasons: [], longestDarkHours: 0, meanSunElevationDeg: null,
    deadAtHour: null, rechargeHours: 0, hoursToSunset: null, minBatteryFraction: 1,
  }
  const values = valuesOf(metricSentences(quiet))
  assert.equal(values['Result'], 'Meets all limits')
  assert.equal(values['Longest dark period'], 'None')
  assert.equal(values['Average Sun height'], 'Never up')
  assert.equal(values['Battery runs out'], 'Never')
  assert.equal(values['Time to recharge'], 'Not needed')
  assert.equal(values['First sunset'], 'None')
  assert.equal(valuesOf(metricSentences({ ...quiet, status: 'marginal', hoursToSunset: 0 }))['First sunset'], 'At landing')
  assert.equal(valuesOf(metricSentences({ ...quiet, status: 'marginal' }))['Result'], 'Meets limits, battery low')
})

// Two cells 1 km apart; the darker one has a ridge 2° higher to the south. A third cell is 6 km away.
const KM_IN_LATITUDE_DEG = 180 / (Math.PI * 1737.4)
const ridge = (tenths) => Array.from({ length: 360 }, (_, azimuth) => (azimuth >= 170 && azimuth <= 190 ? tenths : 0))
const lightCell = { id: 'MAL-light', lat: -85.9, lon: 0, horizon: ridge(10) }
const darkCell = { id: 'MAL-dark', lat: -85.9 + KM_IN_LATITUDE_DEG, lon: 0, horizon: ridge(30) }
const farCell = { id: 'MAL-far', lat: -85.9 + 6 * KM_IN_LATITUDE_DEG, lon: 0, horizon: ridge(0) }
const cellsById = new Map([lightCell, darkCell, farCell].map((cell) => [cell.id, cell]))
const neighbourResults = (darkHours) => ({ cellCount: 3, landingCount: 1, cellIds: ['MAL-light', 'MAL-dark', 'MAL-far'], longestDarkHours: new Float32Array(darkHours) })

test('neighborLesson: the darker neighbour comes first, with the ridge that explains it', () => {
  const lesson = neighborLesson(neighbourResults([12, 90, 0]), cellsById, 0)
  assert.equal(lesson.darkerCell, darkCell)
  assert.equal(lesson.lighterCell, lightCell)
  assert.deepEqual([lesson.darkerHours, lesson.lighterHours], [90, 12])
  assert.ok(Math.abs(lesson.distanceKm - 1) < 0.01)
  assert.equal(lesson.sentence, 'Moving 1 km to MAL-light cuts the longest dark period from 90 h to 12 h because the southern ridge is 2° lower.')
})

test('neighborLesson: nothing to explain without a pair or without a difference', () => {
  assert.equal(neighborLesson({ ...neighbourResults([12]), cellCount: 1, cellIds: ['MAL-light'] }, cellsById, 0), null)
  assert.equal(neighborLesson(neighbourResults([40, 40, 0]), cellsById, 0), null)
})

test('moonFacts: four facts, and the Sun fact uses the current point when it has a mean Sun height', () => {
  const general = moonFacts(null)
  assert.equal(general.length, 4)
  for (const fact of general) assert.match(fact.text, /^[A-Z][^]*\.$/, fact.title)
  assert.match(general.map((fact) => fact.text).join(' '), /29\.5 Earth days/)
  const sunFact = moonFacts(failingMetrics).find((fact) => fact.title === general[1].title)
  assert.match(sunFact.text, /MAL-test/)
  assert.match(sunFact.text, /1\.4°/)
  assert.deepEqual(moonFacts({ ...failingMetrics, meanSunElevationDeg: null }), general)
})

test('metricSentences: a Sun height below zero explains the high vantage point', () => {
  const row = metricSentences({ ...failingMetrics, meanSunElevationDeg: -1.43 }).find((item) => item.label === 'Average Sun height')
  assert.equal(row.value, '-1.4°')
  assert.match(row.sentence, /sees over the curve of the Moon/)
})

test('metricSentences: three failure reasons read as one list', () => {
  const result = metricSentences({ ...failingMetrics, failReasons: ['dark', 'commLoss', 'battery'] })[0].sentence
  assert.equal(result, 'At least one limit is broken: the dark period is too long, Earth is out of sight too long, and the battery runs out.')
})

test('moonFacts: a Sun below the flat horizon line is described as below, never as a negative height above', () => {
  const general = moonFacts(null)
  const sunFact = moonFacts({ ...failingMetrics, meanSunElevationDeg: -1.43 }).find((fact) => fact.title === general[1].title)
  assert.match(sunFact.text, /1\.4° below the flat horizon line/)
  assert.doesNotMatch(sunFact.text, /-1\.4/)
})
