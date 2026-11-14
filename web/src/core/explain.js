import {
  VISIBLE_THRESHOLD,
  distanceKm,
  horizonElevationAt,
} from './geometry.js'

const COMPASS_DIRECTIONS = [
  'north',
  'north-east',
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
]

const COMPASS_ADJECTIVES = {
  north: 'northern',
  'north-east': 'north-eastern',
  east: 'eastern',
  'south-east': 'south-eastern',
  south: 'southern',
  'south-west': 'south-western',
  west: 'western',
  'north-west': 'north-western',
}

// Precision formatter eliminating floating-point binary representation artifacts.
const fmt = (n, d = 1) => Number(Number(n).toFixed(d))

/** Resolves an azimuth to the nearest 45° cardinal or intercardinal compass direction. */
export function compassName(azimuthDeg) {
  const normalized = ((azimuthDeg % 360) + 360) % 360
  const index = Math.round(normalized / 45) % 8
  return COMPASS_DIRECTIONS[index]
}

/**
 * Generates concise telemetry explaining the solar access differential between two landing cells.
 * Evaluates horizon blockage along the solar vector during divergent illumination periods.
 */
export function explainDifference(current, other, resultA, resultB) {
  const cur = resultA !== undefined ? { cell: current, metrics: resultA } : (current || {})
  const oth = resultB !== undefined ? { cell: other, metrics: resultB } : (other || {})

  const curCell = cur.cell || {}
  const othCell = oth.cell || {}
  const dist = fmt(curCell.lat != null && othCell.lat != null ? distanceKm(curCell, othCell) : 0, 1)
  const targetId = othCell.id || othCell.label || 'target'

  const curDark = fmt(cur.metrics?.longestDarkHours ?? 0, 1)
  const otherDark = fmt(oth.metrics?.longestDarkHours ?? 0, 1)

  let verbPhrase
  if (otherDark < curDark) {
    verbPhrase = `cuts the longest dark period from ${curDark} h to ${otherDark} h`
  } else if (otherDark > curDark) {
    verbPhrase = `increases the longest dark period from ${curDark} h to ${otherDark} h`
  } else {
    verbPhrase = `keeps the longest dark period at ${curDark} h`
  }

  const lengthHours = cur.lengthHours || oth.lengthHours || 0
  let bestHour = null
  let maxDiff = -Infinity

  const curTrack = cur.sunTrack
  const othTrack = oth.sunTrack
  const curStart = cur.startIndex || 0
  const othStart = oth.startIndex || 0

  if (curTrack?.diskFraction && othTrack?.diskFraction && lengthHours > 0) {
    const curHorizon = Array.isArray(curCell.horizon) && curCell.horizon.length ? curCell.horizon : null
    const othHorizon = Array.isArray(othCell.horizon) && othCell.horizon.length ? othCell.horizon : null

    // Target gained illumination where baseline was shadowed
    for (let h = 0; h < lengthHours; h++) {
      const curIdx = curStart + h
      const othIdx = othStart + h
      const curSun = (curTrack.diskFraction[curIdx] ?? 0) >= VISIBLE_THRESHOLD
      const othSun = (othTrack.diskFraction[othIdx] ?? 0) >= VISIBLE_THRESHOLD

      if (!curSun && othSun) {
        const az = curTrack.azimuthDeg ? curTrack.azimuthDeg[curIdx] : 0
        const curH = curHorizon ? horizonElevationAt(curHorizon, az) : 0
        const othH = othHorizon ? horizonElevationAt(othHorizon, az) : 0
        const diff = curH - othH
        if (diff > maxDiff) {
          maxDiff = diff
          bestHour = { az, diff, type: 'lower' }
        }
      }
    }

    // Baseline had illumination where target was shadowed
    if (!bestHour) {
      for (let h = 0; h < lengthHours; h++) {
        const curIdx = curStart + h
        const othIdx = othStart + h
        const curSun = (curTrack.diskFraction[curIdx] ?? 0) >= VISIBLE_THRESHOLD
        const othSun = (othTrack.diskFraction[othIdx] ?? 0) >= VISIBLE_THRESHOLD

        if (curSun && !othSun) {
          const az = othTrack.azimuthDeg ? othTrack.azimuthDeg[othIdx] : 0
          const curH = curHorizon ? horizonElevationAt(curHorizon, az) : 0
          const othH = othHorizon ? horizonElevationAt(othHorizon, az) : 0
          const diff = othH - curH
          if (diff > maxDiff) {
            maxDiff = diff
            bestHour = { az, diff, type: 'higher' }
          }
        }
      }
    }

    // Fallback: maximum horizon deviation along the active solar path
    if (!bestHour) {
      for (let h = 0; h < lengthHours; h++) {
        const curIdx = curStart + h
        const az = curTrack.azimuthDeg ? curTrack.azimuthDeg[curIdx] : 0
        const curH = curHorizon ? horizonElevationAt(curHorizon, az) : 0
        const othH = othHorizon ? horizonElevationAt(othHorizon, az) : 0
        const diff = curH - othH
        if (Math.abs(diff) > maxDiff) {
          maxDiff = Math.abs(diff)
          bestHour = { az, diff, type: diff >= 0 ? 'lower' : 'higher' }
        }
      }
    }
  }

  let reason
  if (bestHour && Math.abs(bestHour.diff) >= 0.05) {
    const dir = compassName(bestHour.az)
    const adj = COMPASS_ADJECTIVES[dir] || dir
    const diffDeg = fmt(Math.abs(bestHour.diff), 1)
    reason = `because the ${adj} ridge is ${diffDeg}° ${bestHour.type}.`
  } else {
    reason = 'with negligible difference in terrain obstruction.'
  }

  return `Moving ${dist} km to ${targetId} ${verbPhrase} ${reason}`
}

/**
 * Identifies the adjacent cell pair within maximum range exhibiting the steepest
 * terrain-driven darkness gradient at the specified landing epoch.
 */
export function findMostDifferentNeighbors(results, cellsById, landingIndex, maxDistanceKm = 1.5) {
  const { cellCount = 0, landingCount = 0 } = results || {}
  if (cellCount < 2 || landingIndex < 0 || landingIndex >= landingCount) {
    return null
  }

  const getCell = (id) => (cellsById instanceof Map ? cellsById.get(id) : cellsById?.[id])

  let bestPair = null
  let maxDarkDiff = -1

  for (let i = 0; i < cellCount; i++) {
    const idA = results.cellIds[i]
    const cellA = getCell(idA)
    if (!cellA || cellA.lat == null || cellA.lon == null) continue

    const darkA = results.longestDarkHours[i * landingCount + landingIndex]

    for (let j = i + 1; j < cellCount; j++) {
      const idB = results.cellIds[j]
      const cellB = getCell(idB)
      if (!cellB || cellB.lat == null || cellB.lon == null) continue

      const darkB = results.longestDarkHours[j * landingCount + landingIndex]

      const dist = distanceKm(cellA, cellB)
      if (dist <= maxDistanceKm) {
        const diff = Math.abs(darkA - darkB)
        if (diff > maxDarkDiff) {
          maxDarkDiff = diff
          bestPair = {
            cellIdA: idA,
            cellIdB: idB,
            distanceKm: dist,
            longestDarkHoursA: darkA,
            longestDarkHoursB: darkB,
          }
        }
      }
    }
  }

  return bestPair
}
