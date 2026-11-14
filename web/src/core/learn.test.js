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

// SYNTHETIC lesson data. The Sun is fixed on the equator at longitude 0, so a cell at -85.9° sees it due north,
// 4.1° high: a 1° north ridge leaves it lit, a 5° north ridge hides it. Cells are 1 km apart unless noted.
const KM_IN_LATITUDE_DEG = 180 / (Math.PI * 1737.4)
const northRidge = (tenths) => Array.from({ length: 360 }, (_, azimuth) => (azimuth >= 350 || azimuth <= 10 ? tenths : 0))
const makeCell = (id, kmNorth, ridgeTenths) => ({ id, lat: -85.9 + kmNorth * KM_IN_LATITUDE_DEG, lon: 0, heightM: 0, horizon: northRidge(ridgeTenths) })
const lightCell = makeCell('MAL-light', 0, 10)
const darkCell = makeCell('MAL-dark', 1, 50)
const farCell = makeCell('MAL-far', 6, 0)
const farLight = makeCell('MAL-farlight', 12, 10)
const farDark = makeCell('MAL-fardark', 13, 50)
const cellsById = new Map([lightCell, darkCell, farCell, farLight, farDark].map((cell) => [cell.id, cell]))
const hours = 48
const ephemeris = {
  startTime: '2028-01-01T00:00Z', hours, sunDistanceAu: new Float64Array(hours).fill(1),
  sunSubLonDeg: new Float64Array(hours), sunSubLatDeg: new Float64Array(hours),
}
const context = { ephemeris, scenario: { stayDays: 1, panelMode: 'auto' } }
const lessonResults = (cellIds, darkHours) => ({
  cellCount: cellIds.length, landingCount: 1, cellIds, landingTimes: ['2028-01-01T00:00Z'], longestDarkHours: new Float32Array(darkHours),
})

test('neighborLesson: prefers a pair with the current point, names both cells and the ridge where the Sun is', () => {
  // Cell 0 is the current point. The far pair differs more (200 h vs 0 h) but does not contain it.
  const results = lessonResults(['MAL-light', 'MAL-dark', 'MAL-farlight', 'MAL-fardark'], [12, 90, 0, 200])
  const lesson = neighborLesson(results, cellsById, 0, context)
  assert.equal(lesson.scope, 'current')
  assert.equal(lesson.darkerCell, darkCell)
  assert.equal(lesson.lighterCell, lightCell)
  assert.deepEqual([lesson.darkerHours, lesson.lighterHours], [90, 12])
  assert.ok(Math.abs(lesson.distanceKm - 1) < 0.01)
  assert.equal(
    lesson.sentence,
    'From your current point MAL-light: moving 1 km to MAL-dark increases the longest dark period from 12 h to 90 h, because the northern ridge is 4° higher there, right where the Sun is in those hours.',
  )
})

test('neighborLesson: of a worse and a better neighbour of the current point, the better one wins', () => {
  const betterCell = makeCell('MAL-better', -1, 10)
  const withBetter = new Map([...cellsById, [betterCell.id, betterCell]])
  const results = lessonResults(['MAL-light', 'MAL-dark', 'MAL-better'], [50, 90, 0])
  const lesson = neighborLesson(results, withBetter, 0, context)
  assert.equal(lesson.scope, 'current')
  assert.match(lesson.sentence, /^From your current point MAL-light: moving 1 km to MAL-better cuts the longest dark period from 50 h to 0 h/)
})

test('neighborLesson: says "Elsewhere in this region" when the current point has no different neighbour', () => {
  const results = lessonResults(['MAL-far', 'MAL-light', 'MAL-dark'], [0, 12, 90])
  const lesson = neighborLesson(results, cellsById, 0, context)
  assert.equal(lesson.scope, 'elsewhere')
  assert.match(lesson.sentence, /^Elsewhere in this region, MAL-dark and MAL-light are 1\.0 km apart, yet MAL-dark has a 90 h dark period and MAL-light has a 12 h dark period, because the northern ridge is 4° higher at MAL-dark/)
})

test('neighborLesson: a zero dark period reads "no dark period", and nothing to explain gives null', () => {
  const lesson = neighborLesson(lessonResults(['MAL-far', 'MAL-light', 'MAL-dark'], [0, 0, 90]), cellsById, 0, context)
  assert.match(lesson.sentence, /MAL-light has no dark period/)
  assert.equal(neighborLesson(lessonResults(['MAL-far', 'MAL-light', 'MAL-dark'], [0, 40, 40]), cellsById, 0, context), null)
  assert.equal(neighborLesson({ ...lessonResults(['MAL-light'], [12]) }, cellsById, 0, context), null)
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
