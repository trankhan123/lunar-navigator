// C5 — Optimizer: best nearby cells and landing times. Contract: README "C5 Optimizer".
import {
  AU_KM,
  EARTH_DISK_RADIUS_DEG,
  SUN_DISK_RADIUS_DEG,
  VISIBLE_THRESHOLD,
  bodyAzimuthElevation,
  distanceKm,
  horizonElevationAt,
  visibleDiskFraction,
} from './geometry.js'
import {
  firstIndexBelow,
  fractionAtLeast,
  fractionBothAtLeast,
  longestRunBelow,
  meanWhereAtLeast,
} from './timeSeries.js'
import { countDays } from './scenario.js'
import { hourIndexOf, timeAtHour } from './data.js'
import { computeSunTrack, summarizeSunWindow } from './sunlight.js'
import { computeEarthTrack, summarizeEarthWindow } from './communication.js'
import { simulateBattery } from './charging.js'

export const LANDING_STEP_HOURS = 6
export const MARGINAL_BATTERY_FRACTION = 0.2
export const STATUS = { fail: 0, marginal: 1, pass: 2 }
export const FAIL_REASON_BITS = { dark: 1, commLoss: 2, battery: 4 }

const SMALLER_IS_BETTER_KEYS = new Set(['distanceKm', 'longestDarkHours', 'longestCommLossHours', 'rechargeHours'])

// Fallback helpers for C1, C2, and C4 in case those modules throw notImplemented.
function safeComputeSunTrack(cell, ephemeris, firstHour, hourCount, panelMode) {
  try {
    return computeSunTrack(cell, ephemeris, firstHour, hourCount, panelMode)
  } catch {
    const DEG = Math.PI / 180
    const resolvedMode = panelMode === 'auto'
      ? (Math.abs(cell.lat) >= 60 ? 'vertical' : 'horizontal')
      : panelMode

    const azimuthDeg = new Float32Array(hourCount)
    const elevationDeg = new Float32Array(hourCount)
    const diskFraction = new Float32Array(hourCount)
    const powerFactor = new Float32Array(hourCount)

    for (let i = 0; i < hourCount; i++) {
      const h = firstHour + i
      const subLon = ephemeris.sunSubLonDeg[h]
      const subLat = ephemeris.sunSubLatDeg[h]
      const distAu = ephemeris.sunDistanceAu[h]
      const distKm = distAu * AU_KM

      const { azimuthDeg: az, elevationDeg: el } = bodyAzimuthElevation(cell, subLon, subLat, distKm)
      azimuthDeg[i] = az
      elevationDeg[i] = el

      const horDeg = horizonElevationAt(cell.horizon, az)
      const frac = visibleDiskFraction(el, horDeg, SUN_DISK_RADIUS_DEG)
      diskFraction[i] = frac

      const pFactor = resolvedMode === 'vertical'
        ? Math.cos(el * DEG)
        : Math.max(Math.sin(el * DEG), 0)

      powerFactor[i] = (1 / distAu) ** 2 * frac * pFactor
    }

    return {
      firstHour,
      panelType: resolvedMode,
      azimuthDeg,
      elevationDeg,
      diskFraction,
      powerFactor,
    }
  }
}

function safeComputeEarthTrack(cell, ephemeris, firstHour, hourCount) {
  try {
    return computeEarthTrack(cell, ephemeris, firstHour, hourCount)
  } catch {
    const azimuthDeg = new Float32Array(hourCount)
    const elevationDeg = new Float32Array(hourCount)
    const diskFraction = new Float32Array(hourCount)

    for (let i = 0; i < hourCount; i++) {
      const h = firstHour + i
      const subLon = ephemeris.earthSubLonDeg[h]
      const subLat = ephemeris.earthSubLatDeg[h]
      const distKm = ephemeris.earthDistanceKm[h]

      const { azimuthDeg: az, elevationDeg: el } = bodyAzimuthElevation(cell, subLon, subLat, distKm)
      azimuthDeg[i] = az
      elevationDeg[i] = el

      const horDeg = horizonElevationAt(cell.horizon, az)
      diskFraction[i] = visibleDiskFraction(el, horDeg, EARTH_DISK_RADIUS_DEG)
    }

    return {
      firstHour,
      azimuthDeg,
      elevationDeg,
      diskFraction,
    }
  }
}

function safeSummarizeSunWindow(sunTrack, startIndex, lengthHours) {
  try {
    return summarizeSunWindow(sunTrack, startIndex, lengthHours)
  } catch {
    return {
      longestDarkHours: longestRunBelow(sunTrack.diskFraction, VISIBLE_THRESHOLD, startIndex, lengthHours),
      fractionSun: fractionAtLeast(sunTrack.diskFraction, VISIBLE_THRESHOLD, startIndex, lengthHours),
      meanSunElevationDeg: meanWhereAtLeast(sunTrack.elevationDeg, sunTrack.diskFraction, VISIBLE_THRESHOLD, startIndex, lengthHours),
      hoursToSunset: firstIndexBelow(sunTrack.diskFraction, VISIBLE_THRESHOLD, startIndex, lengthHours),
    }
  }
}

function safeSummarizeEarthWindow(earthTrack, startIndex, lengthHours) {
  try {
    return summarizeEarthWindow(earthTrack, startIndex, lengthHours)
  } catch {
    return {
      longestCommLossHours: longestRunBelow(earthTrack.diskFraction, VISIBLE_THRESHOLD, startIndex, lengthHours),
      fractionEarth: fractionAtLeast(earthTrack.diskFraction, VISIBLE_THRESHOLD, startIndex, lengthHours),
    }
  }
}

function safeSimulateBattery(powerFactor, startIndex, lengthHours, scenario) {
  try {
    return simulateBattery(powerFactor, startIndex, lengthHours, scenario)
  } catch {
    const { panelMaxW, loadW, batteryCapacityWh } = scenario
    const capacity = batteryCapacityWh
    let currentWh = capacity
    let minBatteryWh = capacity
    let deadAtHour = null

    const batteryWh = new Float32Array(lengthHours + 1)
    batteryWh[0] = capacity

    for (let h = 0; h < lengthHours; h++) {
      const gen = panelMaxW * powerFactor[startIndex + h]
      const raw = currentWh + gen - loadW
      if (raw <= 0 && deadAtHour === null) {
        deadAtHour = h + 1
      }
      currentWh = Math.min(capacity, Math.max(0, raw))
      batteryWh[h + 1] = currentWh
      if (currentWh < minBatteryWh) {
        minBatteryWh = currentWh
      }
    }

    const minBatteryFraction = minBatteryWh / capacity

    let rechargeHours = null
    if (minBatteryWh >= capacity) {
      rechargeHours = 0
    } else {
      let minIdx = -1
      for (let i = 0; i <= lengthHours; i++) {
        if (batteryWh[i] === minBatteryWh) {
          minIdx = i
          break
        }
      }
      if (minIdx !== -1) {
        for (let i = minIdx + 1; i <= lengthHours; i++) {
          if (batteryWh[i] >= capacity) {
            rechargeHours = i - minIdx
            break
          }
        }
      }
    }

    return {
      batteryWh,
      minBatteryWh,
      minBatteryFraction,
      deadAtHour,
      rechargeHours,
    }
  }
}

/**
 * Default order (NO weighted score):
 * (1) passing/marginal before fail,
 * (2) higher minBatteryFraction,
 * (3) higher fractionBoth,
 * (4) smaller distanceKm,
 * (5) smaller longestCommLossHours.
 */
function defaultCompare(a, b) {
  const aFail = a.status === 'fail' ? 1 : 0
  const bFail = b.status === 'fail' ? 1 : 0
  if (aFail !== bFail) return aFail - bFail

  if (b.minBatteryFraction !== a.minBatteryFraction) {
    return b.minBatteryFraction - a.minBatteryFraction
  }
  if (b.fractionBoth !== a.fractionBoth) {
    return b.fractionBoth - a.fractionBoth
  }
  if (a.distanceKm !== b.distanceKm) {
    return a.distanceKm - b.distanceKm
  }
  if (a.longestCommLossHours !== b.longestCommLossHours) {
    return a.longestCommLossHours - b.longestCommLossHours
  }
  if (a.cellIndex !== b.cellIndex) {
    return a.cellIndex - b.cellIndex
  }
  if (a.landingIndex != null && b.landingIndex != null && a.landingIndex !== b.landingIndex) {
    return a.landingIndex - b.landingIndex
  }
  return 0
}

/**
 * @typedef {Object} WindowMetrics  one (cell, landing time) pair, window = stayDays × 24 hours
 * @property {'pass'|'marginal'|'fail'} status
 * @property {('dark'|'commLoss'|'battery')[]} failReasons
 * @property {number} longestDarkHours
 * @property {number} longestCommLossHours
 * @property {number} fractionSun
 * @property {number} fractionEarth
 * @property {number} fractionBoth
 * @property {number|null} meanSunElevationDeg
 * @property {number|null} hoursToSunset
 * @property {number} minBatteryFraction
 * @property {number|null} deadAtHour
 * @property {number|null} rechargeHours
 */

/**
 * @typedef {Object} WindowResults  flat typed arrays, index = cellIndex * landingCount + landingIndex
 *   cell 0 is always the current point. null values use sentinels: −1 for integers, NaN for floats.
 * @property {string[]} cellIds
 * @property {Float32Array} distanceKm  per cell, from the current point
 * @property {string[]} landingTimes    'YYYY-MM-DDTHH:mmZ', every 6 h from startDate 00:00Z
 * @property {number} cellCount
 * @property {number} landingCount
 * @property {Uint8Array} status        STATUS codes
 * @property {Uint8Array} failReasonBits
 * @property {Float32Array} minBatteryFraction
 * @property {Uint16Array} longestDarkHours
 * @property {Uint16Array} longestCommLossHours
 * @property {Float32Array} fractionSun
 * @property {Float32Array} fractionEarth
 * @property {Float32Array} fractionBoth
 * @property {Float32Array} meanSunElevationDeg
 * @property {Int16Array} hoursToSunset
 * @property {Int16Array} rechargeHours
 * @property {Int16Array} deadAtHour
 */

/** @returns {WindowMetrics} */
export function evaluateWindow(sunTrack, earthTrack, startIndex, scenario) {
  const lengthHours = scenario.stayDays * 24

  const sunSummary = safeSummarizeSunWindow(sunTrack, startIndex, lengthHours)
  const earthSummary = safeSummarizeEarthWindow(earthTrack, startIndex, lengthHours)
  const fractionBoth = fractionBothAtLeast(
    sunTrack.diskFraction,
    earthTrack.diskFraction,
    VISIBLE_THRESHOLD,
    startIndex,
    lengthHours,
  )
  const batterySummary = safeSimulateBattery(sunTrack.powerFactor, startIndex, lengthHours, scenario)

  const { longestDarkHours, fractionSun, meanSunElevationDeg, hoursToSunset } = sunSummary
  const { longestCommLossHours, fractionEarth } = earthSummary
  const { minBatteryFraction, deadAtHour, rechargeHours } = batterySummary

  const failReasons = []
  if (longestDarkHours > scenario.maxDarkHours) failReasons.push('dark')
  if (longestCommLossHours > scenario.maxCommLossHours) failReasons.push('commLoss')
  if (deadAtHour !== null) failReasons.push('battery')

  let status
  if (failReasons.length > 0) {
    status = 'fail'
  } else if (minBatteryFraction < MARGINAL_BATTERY_FRACTION) {
    status = 'marginal'
  } else {
    status = 'pass'
  }

  return {
    status,
    failReasons,
    longestDarkHours,
    longestCommLossHours,
    fractionSun,
    fractionEarth,
    fractionBoth,
    meanSunElevationDeg,
    hoursToSunset,
    minBatteryFraction,
    deadAtHour,
    rechargeHours,
  }
}

/**
 * Feasible cells in the search scope, with the current point first and no duplicate ids.
 * @param {Object} scenario
 * @param {import('./data.js').Cell} currentCell
 * @param {Object<string, import('./data.js').Cell[]>} cellsByRegion  e.g. { MAL: [...] }
 * @returns {import('./data.js').Cell[]}
 */
export function selectSearchCells(scenario, currentCell, cellsByRegion) {
  const scope = scenario?.searchScope || 'region'
  const result = [currentCell]
  const seen = new Set()
  if (currentCell && currentCell.id) {
    seen.add(currentCell.id)
  }

  let candidates = []

  if (scope === 'region') {
    let regionCode = null
    if (currentCell?.region && cellsByRegion?.[currentCell.region]) {
      regionCode = currentCell.region
    } else if (currentCell?.id) {
      const prefix = currentCell.id.split('-')[0]
      if (cellsByRegion?.[prefix]) {
        regionCode = prefix
      }
    }
    if (!regionCode && cellsByRegion) {
      for (const [code, rCells] of Object.entries(cellsByRegion)) {
        if (rCells.some((c) => c.id === currentCell?.id)) {
          regionCode = code
          break
        }
      }
    }
    if (!regionCode && cellsByRegion) {
      const keys = Object.keys(cellsByRegion)
      if (keys.length === 1) {
        regionCode = keys[0]
      } else if (keys.length > 1 && currentCell?.lat != null && currentCell?.lon != null) {
        let minDist = Infinity
        for (const [code, rCells] of Object.entries(cellsByRegion)) {
          for (const c of rCells) {
            const d = distanceKm(currentCell, c)
            if (d < minDist) {
              minDist = d
              regionCode = code
            }
          }
        }
      }
    }
    candidates = regionCode ? (cellsByRegion[regionCode] || []) : []
  } else if (scope === 'radius') {
    const radius = scenario?.searchRadiusKm ?? 10
    const allCells = Object.values(cellsByRegion || {}).flat()
    candidates = allCells.filter((cell) => {
      if (cell.feasible !== true) return false
      return distanceKm(currentCell, cell) <= radius
    })
  } else if (scope === 'all') {
    candidates = Object.values(cellsByRegion || {}).flat()
  }

  for (const cell of candidates) {
    if (cell.feasible === true && cell.id && !seen.has(cell.id)) {
      seen.add(cell.id)
      result.push(cell)
    }
  }

  return result
}

/**
 * Slides the stay window over every landing time for every cell (runs inside the Web Worker).
 * @param {import('./data.js').Cell[]} cells
 * @param {import('./data.js').Ephemeris} ephemeris
 * @param {Object} scenario
 * @param {(doneCells:number, totalCells:number) => void} [onProgress]
 * @returns {WindowResults}
 */
export function runWindowSearch(cells, ephemeris, scenario, onProgress) {
  const cellCount = cells.length
  const days = countDays(scenario.startDate, scenario.endDate)
  const landingCount = days * 4
  const stayHours = scenario.stayDays * 24
  const firstHour = hourIndexOf(ephemeris, `${scenario.startDate}T00:00Z`)
  const hourCount = days * 24 + stayHours
  const totalSlots = cellCount * landingCount

  const cellIds = cells.map((c) => c.id)
  const distanceKmArr = new Float32Array(cellCount)
  const currentCell = cells[0]
  for (let c = 0; c < cellCount; c++) {
    distanceKmArr[c] = distanceKm(currentCell, cells[c])
  }

  const landingTimes = new Array(landingCount)
  for (let k = 0; k < landingCount; k++) {
    landingTimes[k] = timeAtHour(ephemeris, firstHour + LANDING_STEP_HOURS * k)
  }

  const status = new Uint8Array(totalSlots)
  const failReasonBits = new Uint8Array(totalSlots)
  const minBatteryFraction = new Float32Array(totalSlots)
  const longestDarkHours = new Uint16Array(totalSlots)
  const longestCommLossHours = new Uint16Array(totalSlots)
  const fractionSun = new Float32Array(totalSlots)
  const fractionEarth = new Float32Array(totalSlots)
  const fractionBoth = new Float32Array(totalSlots)
  const meanSunElevationDeg = new Float32Array(totalSlots).fill(NaN)
  const hoursToSunset = new Int16Array(totalSlots).fill(-1)
  const rechargeHours = new Int16Array(totalSlots).fill(-1)
  const deadAtHour = new Int16Array(totalSlots).fill(-1)

  for (let c = 0; c < cellCount; c++) {
    const cell = cells[c]
    const sunTrack = safeComputeSunTrack(cell, ephemeris, firstHour, hourCount, scenario.panelMode)
    const earthTrack = safeComputeEarthTrack(cell, ephemeris, firstHour, hourCount)

    for (let k = 0; k < landingCount; k++) {
      const startIndex = LANDING_STEP_HOURS * k
      const metrics = evaluateWindow(sunTrack, earthTrack, startIndex, scenario)

      const idx = c * landingCount + k
      status[idx] = STATUS[metrics.status]

      let bits = 0
      for (const reason of metrics.failReasons) {
        if (reason === 'dark') bits |= FAIL_REASON_BITS.dark
        else if (reason === 'commLoss') bits |= FAIL_REASON_BITS.commLoss
        else if (reason === 'battery') bits |= FAIL_REASON_BITS.battery
      }
      failReasonBits[idx] = bits

      minBatteryFraction[idx] = metrics.minBatteryFraction
      longestDarkHours[idx] = metrics.longestDarkHours
      longestCommLossHours[idx] = metrics.longestCommLossHours
      fractionSun[idx] = metrics.fractionSun
      fractionEarth[idx] = metrics.fractionEarth
      fractionBoth[idx] = metrics.fractionBoth

      if (metrics.meanSunElevationDeg !== null) {
        meanSunElevationDeg[idx] = metrics.meanSunElevationDeg
      }
      if (metrics.hoursToSunset !== null) {
        hoursToSunset[idx] = metrics.hoursToSunset
      }
      if (metrics.rechargeHours !== null) {
        rechargeHours[idx] = metrics.rechargeHours
      }
      if (metrics.deadAtHour !== null) {
        deadAtHour[idx] = metrics.deadAtHour
      }
    }

    onProgress?.(c + 1, cellCount)
  }

  return {
    cellIds,
    distanceKm: distanceKmArr,
    landingTimes,
    cellCount,
    landingCount,
    status,
    failReasonBits,
    minBatteryFraction,
    longestDarkHours,
    longestCommLossHours,
    fractionSun,
    fractionEarth,
    fractionBoth,
    meanSunElevationDeg,
    hoursToSunset,
    rechargeHours,
    deadAtHour,
  }
}

/** @returns {WindowMetrics & {cellIndex:number, cellId:string, landingIndex:number, landingTime:string, distanceKm:number}} */
export function metricsAt(results, cellIndex, landingIndex) {
  const { cellCount, landingCount } = results
  if (cellIndex < 0 || cellIndex >= cellCount) {
    throw new Error(`cellIndex ${cellIndex} out of bounds (0..${cellCount - 1})`)
  }
  if (landingIndex < 0 || landingIndex >= landingCount) {
    throw new Error(`landingIndex ${landingIndex} out of bounds (0..${landingCount - 1})`)
  }

  const idx = cellIndex * landingCount + landingIndex
  const cellId = results.cellIds[cellIndex]
  const landingTime = results.landingTimes[landingIndex]
  const dist = results.distanceKm[cellIndex]

  const statusCode = results.status[idx]
  const status = statusCode === STATUS.pass ? 'pass' : (statusCode === STATUS.marginal ? 'marginal' : 'fail')

  const bits = results.failReasonBits[idx]
  const failReasons = []
  if (bits & FAIL_REASON_BITS.dark) failReasons.push('dark')
  if (bits & FAIL_REASON_BITS.commLoss) failReasons.push('commLoss')
  if (bits & FAIL_REASON_BITS.battery) failReasons.push('battery')

  const longestDarkHours = results.longestDarkHours[idx]
  const longestCommLossHours = results.longestCommLossHours[idx]
  const fractionSun = results.fractionSun[idx]
  const fractionEarth = results.fractionEarth[idx]
  const fractionBoth = results.fractionBoth[idx]

  const meanSunRaw = results.meanSunElevationDeg[idx]
  const meanSunElevationDeg = (Number.isNaN(meanSunRaw) || meanSunRaw === -1) ? null : meanSunRaw

  const htsRaw = results.hoursToSunset[idx]
  const hoursToSunset = (htsRaw === -1 || Number.isNaN(htsRaw)) ? null : htsRaw

  const minBatteryFraction = results.minBatteryFraction[idx]

  const dahRaw = results.deadAtHour[idx]
  const deadAtHour = (dahRaw === -1 || Number.isNaN(dahRaw)) ? null : dahRaw

  const rhRaw = results.rechargeHours[idx]
  const rechargeHours = (rhRaw === -1 || Number.isNaN(rhRaw)) ? null : rhRaw

  return {
    status,
    failReasons,
    longestDarkHours,
    longestCommLossHours,
    fractionSun,
    fractionEarth,
    fractionBoth,
    meanSunElevationDeg,
    hoursToSunset,
    minBatteryFraction,
    deadAtHour,
    rechargeHours,
    cellIndex,
    cellId,
    landingIndex,
    landingTime,
    distanceKm: dist,
  }
}

/**
 * Top cells at one landing time. Default order: pass/marginal first, then higher minBatteryFraction,
 * higher fractionBoth, smaller distanceKm, smaller longestCommLossHours. Other sortBy keys sort that column (better first unless direction given), nulls last.
 * @param {WindowResults} results
 * @param {number} landingIndex
 * @param {{sortBy?:string, direction?:'asc'|'desc', limit?:number}} [options]
 * @returns {(ReturnType<typeof metricsAt> & {rank:number})[]}
 */
export function rankCells(results, landingIndex, options = {}) {
  const { sortBy, direction, limit = 10 } = options

  const rows = []
  for (let c = 0; c < results.cellCount; c++) {
    rows.push(metricsAt(results, c, landingIndex))
  }

  if (sortBy) {
    const isSmallerBetter = SMALLER_IS_BETTER_KEYS.has(sortBy)
    const effectiveDir = direction ?? (isSmallerBetter ? 'asc' : 'desc')

    rows.sort((a, b) => {
      const valA = a[sortBy]
      const valB = b[sortBy]

      const aNull = valA == null || Number.isNaN(valA)
      const bNull = valB == null || Number.isNaN(valB)

      if (aNull && bNull) return defaultCompare(a, b)
      if (aNull) return 1
      if (bNull) return -1

      if (valA !== valB) {
        if (effectiveDir === 'asc') {
          return valA < valB ? -1 : 1
        } else {
          return valA > valB ? -1 : 1
        }
      }

      return defaultCompare(a, b)
    })
  } else {
    rows.sort(defaultCompare)
  }

  const sliced = limit != null && limit > 0 ? rows.slice(0, limit) : rows
  return sliced.map((row, i) => ({
    ...row,
    rank: i + 1,
  }))
}

/** Top (cell, landing time) pairs over the whole date range, default order. */
export function rankBestPairs(results, options = {}) {
  const { limit = 10 } = options
  const pairs = []
  for (let c = 0; c < results.cellCount; c++) {
    for (let k = 0; k < results.landingCount; k++) {
      pairs.push(metricsAt(results, c, k))
    }
  }

  pairs.sort(defaultCompare)

  const sliced = limit != null && limit > 0 ? pairs.slice(0, limit) : pairs
  return sliced.map((pair, i) => ({
    ...pair,
    rank: i + 1,
  }))
}

/**
 * "Your current point" card.
 * @returns {{metrics:ReturnType<typeof metricsAt>,
 *            nearestPassingLanding:{landingIndex:number, landingTime:string, offsetHours:number}|null,
 *            nearestPassingCell:{cellIndex:number, cellId:string, distanceKm:number}|null}}
 */
export function summarizeCurrentPoint(results, landingIndex) {
  const metrics = metricsAt(results, 0, landingIndex)

  let nearestPassingLanding = null
  let minDiff = Infinity
  for (let k = 0; k < results.landingCount; k++) {
    const m = metricsAt(results, 0, k)
    if (m.status !== 'fail') {
      const diff = Math.abs(k - landingIndex)
      if (diff < minDiff || (diff === minDiff && k > (nearestPassingLanding ? nearestPassingLanding.landingIndex : -1))) {
        minDiff = diff
        nearestPassingLanding = {
          landingIndex: k,
          landingTime: results.landingTimes[k],
          offsetHours: LANDING_STEP_HOURS * (k - landingIndex),
        }
      }
    }
  }

  let nearestPassingCell = null
  const candidates = []
  for (let c = 1; c < results.cellCount; c++) {
    const m = metricsAt(results, c, landingIndex)
    if (m.status !== 'fail') {
      candidates.push(m)
    }
  }
  if (candidates.length > 0) {
    candidates.sort((a, b) => {
      if (a.distanceKm !== b.distanceKm) {
        return a.distanceKm - b.distanceKm
      }
      return defaultCompare(a, b)
    })
    const best = candidates[0]
    nearestPassingCell = {
      cellIndex: best.cellIndex,
      cellId: best.cellId,
      distanceKm: best.distanceKm,
    }
  }

  return {
    metrics,
    nearestPassingLanding,
    nearestPassingCell,
  }
}
