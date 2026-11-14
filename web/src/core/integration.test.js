// The core modules must plug together: scenario → current cell → search → ranking → current-point card → detail.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { assertNear } from './testHelpers.js'
import { hourIndexOf, resolveCurrentCell, timeAtHour } from './data.js'
import { DEFAULT_SCENARIO, countDays, validateScenario } from './scenario.js'
import { STATUS, metricsAt, rankBestWindows, rankCells, runWindowSearch, selectSearchCells, summarizeCurrentPoint } from './optimizer.js'
import { buildDetail, pathForChart, summarySentence, toCsv } from './detail.js'
import { currentPointSentence, formatUtc } from './format.js'

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
// The real JPL Horizons ephemeris, and the MOCK Malapert grid (synthetic terrain, "mock": true).
const ephemeris = readJson('../../public/data/ephemeris.json')
const grid = readJson('../../public/data/mock/cells_MAL.json')
const cellsByRegion = { MAL: grid.cells }
// A short range keeps the test fast: 10 days × 4 landing times, 6-day stays, region scope.
const scenario = {
  ...DEFAULT_SCENARIO,
  currentPoint: { type: 'cell', cellId: 'MAL-r5c4' },
  startDate: '2028-01-01', endDate: '2028-01-10', stayDays: 6,
}

let search = null
function runSearch() {
  if (search) return search
  const currentCell = resolveCurrentCell(scenario.currentPoint, cellsByRegion, [])
  const cells = selectSearchCells(scenario, currentCell, cellsByRegion)
  const progress = []
  const results = runWindowSearch(cells, ephemeris, scenario, (doneCells, totalCells) => progress.push([doneCells, totalCells]))
  search = { currentCell, cells, results, progress }
  return search
}

// README C5 "Default ranking order", written out again so the test does not reuse the optimizer's comparator.
function compareDefault(a, b) {
  return (
    (a.status === 'fail') - (b.status === 'fail') ||
    b.minBatteryFraction - a.minBatteryFraction ||
    b.fractionBoth - a.fractionBoth ||
    a.distanceKm - b.distanceKm ||
    a.longestCommLossHours - b.longestCommLossHours
  )
}

function assertSorted(rows, label) {
  for (let i = 1; i < rows.length; i++) assert.ok(compareDefault(rows[i - 1], rows[i]) <= 0, `${label}: rank ${i} before rank ${i + 1}`)
  assert.deepEqual(rows.map((row) => row.rank), rows.map((_, i) => i + 1))
}

test('scenario → current cell → search cells', () => {
  assert.deepEqual(validateScenario(scenario, ephemeris), [])
  const { currentCell, cells } = runSearch()
  assert.equal(currentCell.id, 'MAL-r5c4')
  assert.equal(cells[0].id, 'MAL-r5c4')
  const ids = cells.map((cell) => cell.id)
  assert.equal(new Set(ids).size, ids.length, 'no duplicate ids')
  assert.ok(cells.slice(1).every((cell) => cell.feasible === true), 'only feasible cells besides cell 0')
  // MAL-r5c4 is feasible, so region scope is exactly the feasible MAL cells.
  assert.deepEqual([...ids].sort(), grid.cells.filter((cell) => cell.feasible).map((cell) => cell.id).sort())
})

test('runWindowSearch on the real ephemeris: landing times and result arrays', () => {
  const { cells, results, progress } = runSearch()
  const days = countDays(scenario.startDate, scenario.endDate)
  assert.equal(days, 10)
  assert.equal(results.cellCount, cells.length)
  assert.deepEqual(results.cellIds, cells.map((cell) => cell.id))
  assert.equal(results.landingCount, days * 4)
  const firstHour = hourIndexOf(ephemeris, '2028-01-01T00:00Z')
  assert.deepEqual(results.landingTimes, Array.from({ length: days * 4 }, (_, k) => timeAtHour(ephemeris, firstHour + 6 * k)))
  assert.equal(results.landingTimes[0], '2028-01-01T00:00Z')
  assert.equal(results.landingTimes.at(-1), '2028-01-10T18:00Z')

  const pairCount = results.cellCount * results.landingCount
  const pairKeys = ['status', 'failReasonBits', 'minBatteryFraction', 'longestDarkHours', 'longestCommLossHours', 'fractionSun',
    'fractionEarth', 'fractionBoth', 'meanSunElevationDeg', 'hoursToSunset', 'rechargeHours', 'deadAtHour']
  for (const key of pairKeys) assert.equal(results[key].length, pairCount, key)
  assert.equal(results.distanceKm.length, results.cellCount)
  assert.equal(results.distanceKm[0], 0)

  assert.deepEqual(STATUS, { fail: 0, marginal: 1, pass: 2 })
  results.status.forEach((code, i) => {
    assert.ok(code === 0 || code === 1 || code === 2, `status code ${code}`)
    assert.equal(code === STATUS.fail, results.failReasonBits[i] !== 0, 'fail exactly when there is a fail reason')
  })
  assert.ok(progress.every(([, totalCells]) => totalCells === cells.length))
  assert.deepEqual(progress.at(-1), [cells.length, cells.length])
})

test('rankCells and rankBestWindows follow the README default order', () => {
  const { results } = runSearch()
  for (let k = 0; k < results.landingCount; k++) {
    const rows = rankCells(results, k)
    assert.equal(rows.length, Math.min(10, results.cellCount))
    assertSorted(rows, `landing ${k}`)
    assert.deepEqual(rows[0], { ...metricsAt(results, rows[0].cellIndex, k), rank: 1 })
    // Nothing left out of the top 10 beats the last row shown.
    const shown = new Set(rows.map((row) => row.cellIndex))
    for (let c = 0; c < results.cellCount; c++) {
      if (!shown.has(c)) assert.ok(compareDefault(rows.at(-1), metricsAt(results, c, k)) <= 0, `landing ${k}, cell ${c} left out`)
    }
  }
  const windows = rankBestWindows(results)
  assert.equal(windows.length, 10)
  assertSorted(windows, 'best windows')
  assert.equal(new Set(windows.map((row) => row.cellId)).size, 10, 'one window per cell')
  for (let k = 0; k < results.landingCount; k++) {
    assert.ok(compareDefault(windows[0], rankCells(results, k, { limit: 1 })[0]) <= 0, `best window vs best cell at landing ${k}`)
  }
})

test('summarizeCurrentPoint → currentPointSentence at every landing time', () => {
  const { results } = runSearch()
  for (let k = 0; k < results.landingCount; k++) {
    const summary = summarizeCurrentPoint(results, k)
    assert.equal(summary.metrics.cellId, 'MAL-r5c4')
    assert.equal(summary.metrics.landingIndex, k)
    const sentence = currentPointSentence(summary, scenario)
    const time = formatUtc(results.landingTimes[k])
    assert.ok(sentence.startsWith('MAL-r5c4 '), sentence)
    if (summary.metrics.status === 'pass') {
      assert.equal(sentence, `MAL-r5c4 meets all limits for a landing at ${time}.`)
    } else if (summary.metrics.status === 'marginal') {
      assert.ok(sentence.startsWith(`MAL-r5c4 meets the limits for a landing at ${time}, but the battery drops to `), sentence)
    } else {
      assert.ok(sentence.startsWith(`MAL-r5c4 fails for a landing at ${time}: `), sentence)
      assert.match(
        sentence,
        /\.( Nearest passing landing time: .+ (later|earlier) \(.+ UTC\)\.| No passing landing time in this date range\.)( Nearest passing cell: MAL-\S+, \d+(\.\d)? km away\.| No passing cell at this landing time\.)$/,
      )
    }
  }
})

test('buildDetail agrees with the search results (detail screen vs ranking)', async (t) => {
  const { cells, results } = runSearch()
  const all = []
  for (let c = 0; c < results.cellCount; c++) for (let k = 0; k < results.landingCount; k++) all.push(metricsAt(results, c, k))
  // Fixed corners plus, when the data has them, a pass, a marginal, a comm-loss fail, a dead battery and a window without sunset.
  const picks = [
    all[0], all[Math.floor(all.length / 2)], all.at(-1),
    all.find((m) => m.status === 'pass'), all.find((m) => m.status === 'marginal'),
    all.find((m) => m.failReasons.includes('commLoss')), all.find((m) => m.deadAtHour !== null),
    all.find((m) => m.hoursToSunset === null),
  ].filter(Boolean)
  const pairs = [...new Map(picks.map((m) => [`${m.cellIndex}/${m.landingIndex}`, m])).values()]
  assert.ok(pairs.length >= 3)

  for (const expected of pairs) {
    await t.test(`${expected.cellId} at ${expected.landingTime}`, () => {
      const detail = buildDetail(cells[expected.cellIndex], ephemeris, scenario, expected.landingTime)
      const { sunSummary, earthSummary, battery } = detail
      assert.equal(detail.stayHours, scenario.stayDays * 24)
      assert.equal(sunSummary.longestDarkHours, expected.longestDarkHours)
      assertNear(sunSummary.fractionSun, expected.fractionSun)
      assert.equal(sunSummary.hoursToSunset, expected.hoursToSunset)
      if (expected.meanSunElevationDeg === null) assert.equal(sunSummary.meanSunElevationDeg, null)
      else assertNear(sunSummary.meanSunElevationDeg, expected.meanSunElevationDeg, 1e-4)
      assert.equal(earthSummary.longestCommLossHours, expected.longestCommLossHours)
      assertNear(earthSummary.fractionEarth, expected.fractionEarth)
      assertNear(battery.minBatteryFraction, expected.minBatteryFraction, 1e-6)
      assert.equal(battery.deadAtHour, expected.deadAtHour)
      assert.equal(battery.rechargeHours, expected.rechargeHours)
      // The README C5 status rules, applied to the detail, give the status the ranking shows.
      const failReasons = []
      if (sunSummary.longestDarkHours > scenario.maxDarkHours) failReasons.push('dark')
      if (earthSummary.longestCommLossHours > scenario.maxCommLossHours) failReasons.push('commLoss')
      if (battery.deadAtHour !== null) failReasons.push('battery')
      assert.deepEqual(failReasons, expected.failReasons)
      const status = failReasons.length > 0 ? 'fail' : battery.minBatteryFraction < 0.2 ? 'marginal' : 'pass'
      assert.equal(status, expected.status)
    })
  }
})

test('detail helpers run on a real detail', () => {
  const { currentCell, results } = runSearch()
  const detail = buildDetail(currentCell, ephemeris, scenario, results.landingTimes[0])
  assert.match(summarySentence(detail, currentCell.id, 0), /^(Day at MAL-r5c4: Sun -?\d+(\.\d)?° high\.|Night at MAL-r5c4\.) Sun.+\. Earth .+\.$/)
  const lines = toCsv(detail, ephemeris).split('\n')
  assert.equal(lines.length, 1 + scenario.stayDays * 24)
  assert.ok(lines[1].startsWith('2028-01-01T00:00Z,'))
  const sunPath = pathForChart(detail.sun.azimuthDeg, detail.sun.elevationDeg, 0, detail.stayHours)
  assert.equal(sunPath.filter((point) => point !== null).length, detail.stayHours)
})

test('learn mode (W7) explains a real search: one row per metric, and a darker-first neighbour pair within 1.5 km', async () => {
  const { metricSentences, neighborLesson } = await import('./learn.js')
  const { results } = runSearch()
  const cellsById = new Map(grid.cells.map((cell) => [cell.id, cell]))
  assert.equal(metricSentences(metricsAt(results, 0, 0)).length, 11)
  const lessons = results.landingTimes.map((_, landingIndex) => neighborLesson(results, cellsById, landingIndex)).filter(Boolean)
  assert.ok(lessons.length > 0, 'some landing time has two neighbours with different dark periods')
  for (const lesson of lessons) {
    assert.ok(lesson.darkerHours > lesson.lighterHours && lesson.distanceKm <= 1.5)
    assert.match(lesson.sentence, /^Moving .* km to .* cuts the longest dark period/)
  }
})
