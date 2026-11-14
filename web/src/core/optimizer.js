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

// Landing opportunity epoch step (6 hours matches orbital ground-track repetition).
export const LANDING_STEP_HOURS = 6

// Minimum battery state-of-charge below which a window is flagged marginal.
export const MARGINAL_BATTERY_FRACTION = 0.2

export const STATUS = { fail: 0, marginal: 1, pass: 2 }
export const FAIL_REASON_BITS = { dark: 1, commLoss: 2, battery: 4 }

const SMALLER_IS_BETTER_KEYS = new Set(['distanceKm', 'longestDarkHours', 'longestCommLossHours', 'rechargeHours'])

/**
 * Topocentric solar track fallback computing illumination and panel incidence
 * when upstream solar telemetry modules are pending integration.
 */
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

/**
 * Topocentric Earth track fallback computing line-of-sight and apparent disk visibility.
 */
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
 * Flat typed-array slot comparator for high-throughput candidate selection.
 */
function compareResultSlots(results, c1, k1, c2, k2) {
  const lc = results.landingCount
  const idx1 = c1 * lc + k1
  const idx2 = c2 * lc + k2

  const s1 = results.status?.[idx1] ?? 0
  const s2 = results.status?.[idx2] ?? 0
  if (s1 !== s2) return s2 - s1

  const bat1 = results.minBatteryFraction?.[idx1] ?? 0
  const bat2 = results.minBatteryFraction?.[idx2] ?? 0
  if (bat1 !== bat2) return bat2 - bat1

  const sun1 = results.fractionBoth?.[idx1] ?? results.fractionSun?.[idx1] ?? 0
  const sun2 = results.fractionBoth?.[idx2] ?? results.fractionSun?.[idx2] ?? 0
  if (sun1 !== sun2) return sun2 - sun1

  const d1 = results.distanceKm?.[c1] ?? 0
  const d2 = results.distanceKm?.[c2] ?? 0
  if (d1 !== d2) return d1 - d2

  const comm1 = results.longestCommLossHours?.[idx1] ?? 0
  const comm2 = results.longestCommLossHours?.[idx2] ?? 0
  if (comm1 !== comm2) return comm1 - comm2

  const dark1 = results.longestDarkHours?.[idx1] ?? 0
  const dark2 = results.longestDarkHours?.[idx2] ?? 0
  if (dark1 !== dark2) return dark1 - dark2

  const id1 = results.cellIds?.[c1] ?? ''
  const id2 = results.cellIds?.[c2] ?? ''
  if (id1 !== id2) return String(id1).localeCompare(String(id2))

  if (c1 !== c2) return c1 - c2
  if (k1 !== k2) return k1 - k2
  return 0
}

/**
 * Deterministic multi-tier landing candidate comparator:
 * 1. Feasibility status (pass > marginal > fail)
 * 2. Minimum battery state-of-charge margin (descending)
 * 3. Simultaneous Sun + Earth line-of-sight availability (descending)
 * 4. Surface distance from nominal landing target (ascending)
 * 5. Direct-to-Earth communication continuity (ascending longest blackout)
 * 6. Solar outage duration (ascending longest shadow)
 * 7. Lexicographical cell identifier tie-breaker
 */
function defaultCompare(a, b) {
  const statusDiff = (STATUS[b.status] ?? 0) - (STATUS[a.status] ?? 0)
  if (statusDiff !== 0) return statusDiff

  const batA = a.minBatteryFraction ?? a.minBatteryWh ?? 0
  const batB = b.minBatteryFraction ?? b.minBatteryWh ?? 0
  if (batB !== batA) return batB - batA

  const sunA = a.fractionBoth ?? a.totalSunHours ?? a.fractionSun ?? 0
  const sunB = b.fractionBoth ?? b.totalSunHours ?? b.fractionSun ?? 0
  if (sunB !== sunA) return sunB - sunA

  if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm

  if (a.longestCommLossHours !== b.longestCommLossHours) {
    return a.longestCommLossHours - b.longestCommLossHours
  }

  if (a.longestDarkHours !== b.longestDarkHours) {
    return a.longestDarkHours - b.longestDarkHours
  }

  const idDiff = String(a.cellId ?? '').localeCompare(String(b.cellId ?? ''))
  if (idDiff !== 0) return idDiff

  if (a.cellIndex !== b.cellIndex) return a.cellIndex - b.cellIndex
  if (a.landingIndex != null && b.landingIndex != null && a.landingIndex !== b.landingIndex) {
    return a.landingIndex - b.landingIndex
  }
  return 0
}

/**
 * Evaluates lander survival and mission operations during a stay window
 * anchored at track index startIndex.
 */
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
 * Filters feasible lunar surface cells within target search boundary,
 * ensuring the nominal landing target resides at index 0.
 */
export function selectSearchCells(scenario, currentCell, cellsByRegion) {
  if (!currentCell || currentCell.lat == null || currentCell.lon == null) {
    return []
  }

  const scope = scenario?.searchScope || 'region'
  const allCells = Array.isArray(cellsByRegion)
    ? cellsByRegion
    : Object.values(cellsByRegion || {}).flat()

  let candidates = []

  if (scope === 'region') {
    let closestCell = null
    let minDist = Infinity
    let closestRegionKey = null

    if (cellsByRegion && !Array.isArray(cellsByRegion)) {
      for (const [code, rCells] of Object.entries(cellsByRegion)) {
        for (const c of rCells) {
          if (c.lat != null && c.lon != null) {
            const d = distanceKm(currentCell, c)
            if (d < minDist) {
              minDist = d
              closestCell = c
              closestRegionKey = code
            }
          }
        }
      }
    } else {
      for (const c of allCells) {
        if (c.lat != null && c.lon != null) {
          const d = distanceKm(currentCell, c)
          if (d < minDist) {
            minDist = d
            closestCell = c
          }
        }
      }
    }

    if (!closestCell || minDist > 1) {
      candidates = []
    } else {
      const targetRegion =
        closestCell.region ||
        closestCell.regionId ||
        closestRegionKey ||
        (closestCell.id ? closestCell.id.split('-')[0] : null)
      if (
        cellsByRegion &&
        !Array.isArray(cellsByRegion) &&
        targetRegion &&
        cellsByRegion[targetRegion]
      ) {
        candidates = cellsByRegion[targetRegion]
      } else {
        candidates = allCells.filter(
          (c) =>
            (c.region && c.region === targetRegion) ||
            (c.regionId && c.regionId === targetRegion) ||
            (targetRegion && c.id?.startsWith(targetRegion + '-')),
        )
      }
    }
  } else if (scope === 'radius') {
    const radius = scenario?.searchRadiusKm ?? 10
    candidates = allCells.filter((cell) => {
      if (cell.feasible !== true) return false
      return distanceKm(currentCell, cell) <= radius
    })
  } else if (scope === 'all') {
    candidates = allCells
  }

  const result = [currentCell]
  const seen = new Set()
  if (currentCell && currentCell.id) {
    seen.add(currentCell.id)
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
 * Executes high-performance sliding window mission simulation over all candidate cells
 * across the specified mission timeframe.
 */
export function runWindowSearch(cells, ephemeris, scenario, onProgress) {
  const cellCount = cells?.length ?? 0
  if (cellCount === 0) {
    onProgress?.(0, 0)
    return {
      cellIds: [],
      distanceKm: new Float32Array(0),
      landingTimes: [],
      cellCount: 0,
      landingCount: 0,
      status: new Uint8Array(0),
      failReasonBits: new Uint8Array(0),
      minBatteryFraction: new Float32Array(0),
      longestDarkHours: new Uint16Array(0),
      longestCommLossHours: new Uint16Array(0),
      fractionSun: new Float32Array(0),
      fractionEarth: new Float32Array(0),
      fractionBoth: new Float32Array(0),
      meanSunElevationDeg: new Float32Array(0),
      hoursToSunset: new Int16Array(0),
      rechargeHours: new Int16Array(0),
      deadAtHour: new Int16Array(0),
    }
  }

  const days = Math.max(1, countDays(scenario.startDate, scenario.endDate))
  const landingCount = days * 4
  const stayHours = (scenario.stayDays ?? 1) * 24
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

  let reportedDone = 0

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

    if (onProgress && c + 1 >= reportedDone) {
      reportedDone = c + 1
      onProgress(reportedDone, cellCount)
    }
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

/**
 * Extracts and decodes flat typed telemetry results for a single cell and landing epoch.
 */
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
 * Ranks candidate surface cells for a given landing epoch according to mission constraints
 * or specified metric sorting preference with deterministic tie-breaking.
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

function createWindow(results, c, startStep, endStep, stepHours, statusStr) {
  const landingCount = results.landingCount
  const windowSteps = endStep - startStep + 1
  const windowHours = windowSteps * stepHours
  const slipHours = (endStep - startStep) * stepHours

  let bestStep = startStep
  let minBatteryFraction = 1
  let longestDarkHours = 0
  let longestCommLossHours = 0
  let fractionSun = 1
  let fractionEarth = 1
  let fractionBoth = 1
  let minMeanSun = Infinity
  let maxRechargeHours = -1
  let minHoursToSunset = Infinity

  for (let k = startStep; k <= endStep; k++) {
    const idx = c * landingCount + k

    if (k !== bestStep && compareResultSlots(results, c, k, c, bestStep) < 0) {
      bestStep = k
    }

    const bat = results.minBatteryFraction[idx]
    if (bat < minBatteryFraction) minBatteryFraction = bat

    const dark = results.longestDarkHours[idx]
    if (dark > longestDarkHours) longestDarkHours = dark

    const comm = results.longestCommLossHours[idx]
    if (comm > longestCommLossHours) longestCommLossHours = comm

    const sun = results.fractionSun[idx]
    if (sun < fractionSun) fractionSun = sun

    const earth = results.fractionEarth[idx]
    if (earth < fractionEarth) fractionEarth = earth

    const both = results.fractionBoth[idx]
    if (both < fractionBoth) fractionBoth = both

    const meanSun = results.meanSunElevationDeg[idx]
    if (!Number.isNaN(meanSun) && meanSun !== -1) {
      if (meanSun < minMeanSun) minMeanSun = meanSun
    }

    const rh = results.rechargeHours[idx]
    if (!Number.isNaN(rh) && rh !== -1) {
      if (rh > maxRechargeHours) maxRechargeHours = rh
    }

    const hts = results.hoursToSunset[idx]
    if (!Number.isNaN(hts) && hts !== -1) {
      if (hts < minHoursToSunset) minHoursToSunset = hts
    }
  }

  const bestIdx = c * landingCount + bestStep
  const bits = results.failReasonBits[bestIdx]
  const failReasons = []
  if (statusStr === 'fail') {
    if (bits & FAIL_REASON_BITS.dark) failReasons.push('dark')
    if (bits & FAIL_REASON_BITS.commLoss) failReasons.push('commLoss')
    if (bits & FAIL_REASON_BITS.battery) failReasons.push('battery')
  }

  const cellId = results.cellIds[c]
  const dist = results.distanceKm[c]
  const startTime = results.landingTimes[startStep]
  const endTime = results.landingTimes[endStep]
  const bestTime = results.landingTimes[bestStep]

  return {
    cellIndex: c,
    cellId,
    startStep,
    endStep,
    stepIndex: bestStep,
    landingStep: bestStep,
    landingIndex: bestStep,
    landingTime: bestTime,
    startTime,
    endTime,
    windowSteps,
    windowHours,
    slipHours,
    bestStep,
    status: statusStr,
    failReasons,
    minBatteryFraction,
    minBatteryPct: minBatteryFraction * 100,
    longestDarkHours,
    longestCommLossHours,
    fractionSun,
    fractionEarth,
    fractionBoth,
    sunPct: fractionSun * 100,
    earthPct: fractionEarth * 100,
    meanSunElevationDeg: minMeanSun !== Infinity ? minMeanSun : null,
    rechargeHours: maxRechargeHours !== -1 ? maxRechargeHours : null,
    hoursToSunset: minHoursToSunset !== Infinity ? minHoursToSunset : null,
    deadAtHour: results.deadAtHour?.[bestIdx] !== -1 ? (results.deadAtHour?.[bestIdx] ?? null) : null,
    distanceKm: dist,
  }
}

function compareCellWindows(w1, w2) {
  const sDiff = (STATUS[w2.status] ?? 0) - (STATUS[w1.status] ?? 0)
  if (sDiff !== 0) return sDiff

  if (w2.windowSteps !== w1.windowSteps) return w2.windowSteps - w1.windowSteps

  const batDiff = (w2.minBatteryFraction ?? 0) - (w1.minBatteryFraction ?? 0)
  if (batDiff !== 0) return batDiff

  const darkDiff = (w1.longestDarkHours ?? 0) - (w2.longestDarkHours ?? 0)
  if (darkDiff !== 0) return darkDiff

  const commDiff = (w1.longestCommLossHours ?? 0) - (w2.longestCommLossHours ?? 0)
  if (commDiff !== 0) return commDiff

  const se1 = (w1.fractionSun ?? 0) + (w1.fractionEarth ?? 0)
  const se2 = (w2.fractionSun ?? 0) + (w2.fractionEarth ?? 0)
  if (se2 !== se1) return se2 - se1

  const m1 = w1.meanSunElevationDeg ?? -999
  const m2 = w2.meanSunElevationDeg ?? -999
  if (m2 !== m1) return m2 - m1

  return w1.startStep - w2.startStep
}

function compareCrossCellWindows(w1, w2) {
  const sDiff = (STATUS[w2.status] ?? 0) - (STATUS[w1.status] ?? 0)
  if (sDiff !== 0) return sDiff

  if (w2.windowSteps !== w1.windowSteps) return w2.windowSteps - w1.windowSteps

  const batDiff = (w2.minBatteryFraction ?? 0) - (w1.minBatteryFraction ?? 0)
  if (batDiff !== 0) return batDiff

  const darkDiff = (w1.longestDarkHours ?? 0) - (w2.longestDarkHours ?? 0)
  if (darkDiff !== 0) return darkDiff

  const commDiff = (w1.longestCommLossHours ?? 0) - (w2.longestCommLossHours ?? 0)
  if (commDiff !== 0) return commDiff

  const se1 = (w1.fractionSun ?? 0) + (w1.fractionEarth ?? 0)
  const se2 = (w2.fractionSun ?? 0) + (w2.fractionEarth ?? 0)
  if (se2 !== se1) return se2 - se1

  const distDiff = (w1.distanceKm ?? 0) - (w2.distanceKm ?? 0)
  if (distDiff !== 0) return distDiff

  if (w1.startStep !== w2.startStep) return w1.startStep - w2.startStep

  return String(w1.cellId ?? '').localeCompare(String(w2.cellId ?? ''))
}

function rankLegacyBestPairs(results, options = {}) {
  const { limit = 10 } = options
  const cellCount = results?.cellCount ?? 0
  const landingCount = results?.landingCount ?? 0
  const totalSlots = cellCount * landingCount
  if (totalSlots === 0) return []

  const effectiveLimit = limit != null && limit > 0 ? limit : totalSlots
  const top = []

  for (let c = 0; c < cellCount; c++) {
    for (let k = 0; k < landingCount; k++) {
      if (top.length === effectiveLimit) {
        const worst = top[effectiveLimit - 1]
        if (compareResultSlots(results, c, k, worst.cellIndex, worst.landingIndex) >= 0) {
          continue
        }
      }

      let low = 0
      let high = top.length
      while (low < high) {
        const mid = (low + high) >> 1
        if (compareResultSlots(results, c, k, top[mid].cellIndex, top[mid].landingIndex) < 0) {
          high = mid
        } else {
          low = mid + 1
        }
      }

      top.splice(low, 0, { cellIndex: c, landingIndex: k })
      if (top.length > effectiveLimit) {
        top.pop()
      }
    }
  }

  return top.map((entry, i) => ({
    ...metricsAt(results, entry.cellIndex, entry.landingIndex),
    rank: i + 1,
  }))
}

/**
 * Identifies optimal landing windows across the entire search horizon,
 * grouping contiguous time steps per cell into landing windows and enforcing
 * "one row per cell".
 */
export function rankBestPairs(results, options) {
  if (options === undefined || options?.legacy === true) {
    return rankLegacyBestPairs(results, { limit: 10 })
  }

  const { limit = 10 } = options ?? {}
  const cellCount = results?.cellCount ?? 0
  const landingCount = results?.landingCount ?? 0
  if (cellCount === 0 || landingCount === 0) return []

  const stepHours = LANDING_STEP_HOURS
  const bestWindowPerCell = []

  for (let c = 0; c < cellCount; c++) {
    let hasPass = false
    let hasMarginal = false
    let bestFailStep = 0
    let bestFailIdx = -1

    for (let k = 0; k < landingCount; k++) {
      const idx = c * landingCount + k
      const s = results.status[idx]
      if (s === STATUS.pass) {
        hasPass = true
        break
      } else if (s === STATUS.marginal) {
        hasMarginal = true
      } else {
        if (bestFailIdx === -1 || compareResultSlots(results, c, k, c, bestFailStep) < 0) {
          bestFailStep = k
          bestFailIdx = idx
        }
      }
    }

    const targetStatus = hasPass ? STATUS.pass : (hasMarginal ? STATUS.marginal : STATUS.fail)
    const targetStatusStr = hasPass ? 'pass' : (hasMarginal ? 'marginal' : 'fail')

    const candidateWindows = []

    if (targetStatus === STATUS.fail) {
      candidateWindows.push(createWindow(results, c, bestFailStep, bestFailStep, stepHours, targetStatusStr))
    } else {
      let inWindow = false
      let startK = 0
      for (let k = 0; k < landingCount; k++) {
        const idx = c * landingCount + k
        const s = results.status[idx]
        if (s === targetStatus) {
          if (!inWindow) {
            inWindow = true
            startK = k
          }
        } else {
          if (inWindow) {
            candidateWindows.push(createWindow(results, c, startK, k - 1, stepHours, targetStatusStr))
            inWindow = false
          }
        }
      }
      if (inWindow) {
        candidateWindows.push(createWindow(results, c, startK, landingCount - 1, stepHours, targetStatusStr))
      }
    }

    if (candidateWindows.length === 0) continue

    candidateWindows.sort(compareCellWindows)
    bestWindowPerCell.push(candidateWindows[0])
  }

  bestWindowPerCell.sort(compareCrossCellWindows)

  const effectiveLimit = limit != null && limit > 0 ? limit : bestWindowPerCell.length
  return bestWindowPerCell.slice(0, effectiveLimit).map((row, i) => ({
    ...row,
    rank: i + 1,
  }))
}

/**
 * Summarizes performance at the nominal target location and identifies nearest feasible
 * fallback options across temporal and spatial domains.
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
