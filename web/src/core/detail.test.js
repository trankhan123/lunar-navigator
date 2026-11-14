import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertNear, constantEphemeris, equatorCell } from './testHelpers.js'
import { DETAIL_LOOKAHEAD_HOURS, buildDetail, pathForChart, summarySentence, toCsv } from './detail.js'
import { timeAtHour } from './data.js'
import { DEFAULT_SCENARIO } from './scenario.js'
import { summarizeSunWindow } from './sunlight.js'
import { summarizeEarthWindow } from './communication.js'
import { simulateBattery } from './charging.js'
import { summarizeEnergyNeed } from './energyNeed.js'

// Example lander numbers (1000 W panel, 300 W load, 10 kWh battery), one-day stay.
const oneDayStay = { ...DEFAULT_SCENARIO, stayDays: 1 }
const LANDING = '2028-01-02T00:00Z' // hour 24 of every constantEphemeris below

test('buildDetail: landing hour, stay and track lengths', () => {
  assert.equal(DETAIL_LOOKAHEAD_HOURS, 30 * 24)
  const detail = buildDetail(equatorCell, constantEphemeris({ hours: 1000 }), oneDayStay, LANDING)
  assert.equal(detail.landingHour, 24)
  assert.equal(detail.stayHours, 24)
  assert.equal(detail.trackHours, 24 + DETAIL_LOOKAHEAD_HOURS)
  assert.equal(detail.sun.firstHour, 24)
  assert.notEqual(detail.earth, null)
  assert.equal(detail.earth.firstHour, 24)
  for (const key of ['azimuthDeg', 'elevationDeg', 'diskFraction', 'powerFactor']) assert.equal(detail.sun[key].length, detail.trackHours, key)
  for (const key of ['azimuthDeg', 'elevationDeg', 'diskFraction']) assert.equal(detail.earth[key].length, detail.trackHours, key)
})

test('buildDetail: the track, then the stay, are cut at the end of the ephemeris', () => {
  // 76 h left after landing: the full 24 h stay, but less than stay + 30 days.
  const cutTrack = buildDetail(equatorCell, constantEphemeris({ hours: 100 }), oneDayStay, LANDING)
  assert.equal(cutTrack.stayHours, 24)
  assert.equal(cutTrack.trackHours, 76)
  assert.equal(cutTrack.sun.diskFraction.length, 76)
  assert.equal(cutTrack.earth.diskFraction.length, 76)

  // 6 h left: the stay itself is cut.
  const cutStay = buildDetail(equatorCell, constantEphemeris({ hours: 30 }), oneDayStay, LANDING)
  assert.equal(cutStay.landingHour, 24)
  assert.equal(cutStay.stayHours, 6)
  assert.equal(cutStay.trackHours, 6)
  assert.equal(cutStay.battery.batteryWh.length, 7)
  assert.deepEqual(cutStay.sunSummary, summarizeSunWindow(cutStay.sun, 0, 6))
})

test('buildDetail: a landing time outside the ephemeris throws (the hourIndexOf error)', () => {
  const ephemeris = constantEphemeris({ hours: 48 })
  const hourIndexOfError = { message: /inside the ephemeris/ }
  assert.throws(() => buildDetail(equatorCell, ephemeris, oneDayStay, '2027-12-31T23:00Z'), hourIndexOfError)
  assert.throws(() => buildDetail(equatorCell, ephemeris, oneDayStay, '2028-01-03T00:00Z'), hourIndexOfError) // hour 48, one past the end
  assert.throws(() => buildDetail(equatorCell, ephemeris, oneDayStay, '2028-01-01T00:30Z'), hourIndexOfError) // not a whole hour
})

// Synthetic ephemeris (test data, not real geometry): Sun and Earth straight overhead the equator cell, except the
// Sun on the far side for stay hours 10–13 and for everything after the stay, and the Earth for stay hours 5–7.
function stayEphemeris() {
  const ephemeris = constantEphemeris({ hours: 1000 })
  for (let hour = 24 + 10; hour < 24 + 14; hour++) ephemeris.sunSubLonDeg[hour] = 180
  for (let hour = 24 + 24; hour < 1000; hour++) ephemeris.sunSubLonDeg[hour] = 180
  for (let hour = 24 + 5; hour < 24 + 8; hour++) ephemeris.earthSubLonDeg[hour] = 180
  return ephemeris
}

test('buildDetail: Sun and Earth summaries cover the stay only', () => {
  const detail = buildDetail(equatorCell, stayEphemeris(), oneDayStay, LANDING)
  assert.equal(detail.sun.diskFraction[30], 0) // the track goes on into the dark lookahead…
  assert.equal(detail.sunSummary.longestDarkHours, 4) // …but the summary stops at the end of the stay
  assertNear(detail.sunSummary.fractionSun, 20 / 24)
  assert.equal(detail.sunSummary.hoursToSunset, 10)
  assertNear(detail.sunSummary.meanSunElevationDeg, 90, 1e-3)
  assert.deepEqual(detail.sunSummary, summarizeSunWindow(detail.sun, 0, 24))

  assert.equal(detail.earthSummary.longestCommLossHours, 3)
  assertNear(detail.earthSummary.fractionEarth, 21 / 24)
  assert.deepEqual(detail.earthSummary, summarizeEarthWindow(detail.earth, 0, 24))
})

test('buildDetail: battery (C4) and energy need (C3) over the stay', () => {
  const detail = buildDetail(equatorCell, stayEphemeris(), oneDayStay, LANDING)
  // Full at landing, 4 dark hours × 300 W = 1200 Wh used, full again 2 h after sunrise (+700 W net).
  assert.equal(detail.battery.batteryWh.length, detail.stayHours + 1)
  assert.equal(detail.battery.batteryWh[0], 10000)
  assertNear(detail.battery.minBatteryFraction, 0.88)
  assert.equal(detail.battery.deadAtHour, null)
  assert.equal(detail.battery.rechargeHours, 2)
  assert.deepEqual(detail.battery, simulateBattery(detail.sun.powerFactor, 0, 24, oneDayStay))

  assert.notEqual(detail.energy, null)
  assert.equal(detail.energy.minimumCapacityWh, 1200)
  assert.deepEqual(detail.energy.darkPeriods, [{ startOffset: 10, lengthHours: 4, energyWh: 1200 }])
  assert.deepEqual(detail.energy, summarizeEnergyNeed(detail.sun, 0, 24, oneDayStay))
})

test('pathForChart: a null where the path crosses north (0°/360°)', () => {
  const elevation = Float32Array.from([1, 2, 3, 4])
  assert.deepEqual(pathForChart(Float32Array.from([358, 359, 1, 2]), elevation, 0, 4), [[358, 1], [359, 2], null, [1, 3], [2, 4]])
  assert.deepEqual(pathForChart(Float32Array.from([2, 1, 359, 358]), elevation, 0, 4), [[2, 1], [1, 2], null, [359, 3], [358, 4]])
})

test('pathForChart: steps of at most 180° stay one line', () => {
  assert.deepEqual(pathForChart([0, 179, 358], [5, 6, 7], 0, 3), [[0, 5], [179, 6], [358, 7]])
  assert.deepEqual(pathForChart([0, 181], [5, 6], 0, 2), [[0, 5], null, [181, 6]])
})

test('pathForChart: start and length select track indices start … start+length−1', () => {
  const azimuth = [350, 355, 5, 10, 15, 20]
  const elevation = [0, 1, 2, 3, 4, 5]
  assert.deepEqual(pathForChart(azimuth, elevation, 2, 3), [[5, 2], [10, 3], [15, 4]]) // the wrap at 1→2 is outside
  assert.deepEqual(pathForChart(azimuth, elevation, 1, 2), [[355, 1], null, [5, 2]])
  assert.deepEqual(pathForChart(azimuth, elevation, 3, 0), [])
})

const CSV_HEADER = 'time,sunAzimuthDeg,sunElevationDeg,sunDiskFraction,earthAzimuthDeg,earthElevationDeg,earthDiskFraction,batteryWh'

// A rounded field has at most `decimals` decimals and is within half a unit of the value.
function assertRounded(field, value, decimals) {
  assert.match(field, new RegExp(`^-?\\d+(\\.\\d{1,${decimals}})?$`))
  assertNear(Number(field), value, 0.5 * 10 ** -decimals + 1e-9)
}

test('toCsv: header and one row per stay hour from buildDetail', () => {
  // Synthetic geometry (test data): fixed sub-points away from the zenith, so the angles have decimals.
  const ephemeris = constantEphemeris({ hours: 200, sun: [30, 10, 1], earth: [20, -5, 384400] })
  const detail = buildDetail(equatorCell, ephemeris, oneDayStay, LANDING)
  const lines = toCsv(detail, ephemeris).split('\n')
  assert.equal(lines[0], CSV_HEADER)
  assert.equal(lines.length, 1 + detail.stayHours) // the stay, not the 30-day lookahead
  lines.slice(1).forEach((line, i) => {
    const fields = line.split(',')
    assert.equal(fields.length, 8)
    assert.equal(fields[0], timeAtHour(ephemeris, detail.landingHour + i))
    const { sun, earth, battery } = detail
    const angles = [sun.azimuthDeg, sun.elevationDeg, sun.diskFraction, earth.azimuthDeg, earth.elevationDeg, earth.diskFraction]
    angles.forEach((values, column) => assertRounded(fields[column + 1], values[i], 3))
    assertRounded(fields[7], battery.batteryWh[i], 1)
  })
})

// Hand-made detail (synthetic numbers): a 2 h stay inside a 3 h track, landing at hour 2.
function handMadeDetail() {
  return {
    landingHour: 2, stayHours: 2, trackHours: 3,
    sun: {
      firstHour: 2, panelType: 'vertical',
      azimuthDeg: [123.45678, 359.99949, 7], elevationDeg: [-1.23456, 0.12345, 7],
      diskFraction: [0.12345, 1, 7], powerFactor: [0.1, 1, 7],
    },
    earth: { firstHour: 2, azimuthDeg: [10.00049, 20.5, 7], elevationDeg: [5.6789, -12.3456, 7], diskFraction: [1, 0.66666, 7] },
    sunSummary: null, earthSummary: null,
    battery: { batteryWh: [10000, 9876.54, 1234.56], minBatteryWh: 1234.56, minBatteryFraction: 0.123456, deadAtHour: null, rechargeHours: null, chargingMask: [0, 0] },
    energy: null,
  }
}

test('toCsv: angles and fractions to 3 decimals, batteryWh at the start of the hour to 1 decimal', () => {
  const lines = toCsv(handMadeDetail(), constantEphemeris({ hours: 10 })).split('\n')
  assert.equal(lines.length, 3)
  const rows = lines.slice(1).map((line) => line.split(','))
  assert.deepEqual(rows.map((fields) => fields[0]), ['2028-01-01T02:00Z', '2028-01-01T03:00Z'])
  assert.deepEqual(rows[0].slice(1).map(Number), [123.457, -1.235, 0.123, 10, 5.679, 1, 10000])
  assert.deepEqual(rows[1].slice(1).map(Number), [359.999, 0.123, 1, 20.5, -12.346, 0.667, 9876.5])
})

test('toCsv: empty fields when earth and battery are null', () => {
  const detail = { ...handMadeDetail(), earth: null, earthSummary: null, battery: null }
  const lines = toCsv(detail, constantEphemeris({ hours: 10 })).split('\n')
  assert.equal(lines[0], CSV_HEADER)
  assert.equal(lines.length, 3)
  for (const line of lines.slice(1)) {
    const fields = line.split(',')
    assert.equal(fields.length, 8)
    assert.deepEqual(fields.slice(4), ['', '', '', ''])
  }
  assert.deepEqual(lines[1].split(',').slice(1, 4).map(Number), [123.457, -1.235, 0.123])
})

// Hand-made 48 h track (synthetic): Sun up at 0–4 and 31–47 (12.34° high), Earth in view at 0–20 and 40–47.
// With linear interpolation the Sun sets at 4.5 and rises at 30.5; the Earth sets at 20.5 and rises at 39.5.
function sentenceDetail({ withEarth = true } = {}) {
  const hours = Array.from({ length: 48 }, (_, i) => i)
  const sunUp = hours.map((i) => (i <= 4 || i >= 31 ? 1 : 0))
  const earthUp = hours.map((i) => (i <= 20 || i >= 40 ? 1 : 0))
  const sun = {
    firstHour: 0, panelType: 'vertical',
    azimuthDeg: Float32Array.from(hours, () => 90),
    elevationDeg: Float32Array.from(sunUp, (up) => (up ? 12.34 : -3)),
    diskFraction: Float32Array.from(sunUp),
    powerFactor: Float32Array.from(sunUp),
  }
  const earth = {
    firstHour: 0,
    azimuthDeg: Float32Array.from(hours, () => 0),
    elevationDeg: Float32Array.from(earthUp, (up) => (up ? 5 : -2)),
    diskFraction: Float32Array.from(earthUp),
  }
  return {
    landingHour: 0, stayHours: 24, trackHours: 48,
    sun, earth: withEarth ? earth : null,
    sunSummary: summarizeSunWindow(sun, 0, 24), earthSummary: withEarth ? summarizeEarthWindow(earth, 0, 24) : null,
    battery: null, energy: null,
  }
}

test('summarySentence: day with the Sun elevation, then the Earth countdown', () => {
  assert.equal(
    summarySentence(sentenceDetail(), 'MAL-r5c4', 2),
    'Day at MAL-r5c4: Sun 12.3° high. Sun sets in 2 h 30 min. Earth sets in 18 h 30 min.',
  )
})

test('summarySentence: night', () => {
  assert.equal(
    summarySentence(sentenceDetail(), 'MAL-r5c4', 6),
    'Night at MAL-r5c4. Sunlight returns in 24 h 30 min. Earth sets in 14 h 30 min.',
  )
  assert.equal(
    summarySentence(sentenceDetail(), 'MAL-r5c4', 22),
    'Night at MAL-r5c4. Sunlight returns in 8 h 30 min. Earth rises in 17 h 30 min.',
  )
})

test('summarySentence: no Earth sentence when earth is null', () => {
  const detail = sentenceDetail({ withEarth: false })
  assert.equal(summarySentence(detail, 'MAL-r5c4', 2), 'Day at MAL-r5c4: Sun 12.3° high. Sun sets in 2 h 30 min.')
  assert.equal(summarySentence(detail, 'MAL-r5c4', 6), 'Night at MAL-r5c4. Sunlight returns in 24 h 30 min.')
})

test('summarySentence: no event left before the end of the track', () => {
  // 6 or 7 h left at index 41 of a 48 h track, depending on where "the end of the track" is counted.
  assert.match(
    summarySentence(sentenceDetail(), 'MAL-r5c4', 41),
    /^Day at MAL-r5c4: Sun 12\.3° high\. Sun stays up for at least [67] h\. Earth stays in view for at least [67] h\.$/,
  )
})
