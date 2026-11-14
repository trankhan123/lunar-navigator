import {
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
 * Identifies the dominant horizon obstruction sector correlated with darkness difference.
 */
export function explainDifference(current, other, resultA, resultB) {
  const cur = resultA !== undefined ? { cell: current, metrics: resultA } : (current || {})
  const oth = resultB !== undefined ? { cell: other, metrics: resultB } : (other || {})

  const curCell = cur.cell || {}
  const othCell = oth.cell || {}
  const dist = fmt(curCell.lat != null && othCell.lat != null ? distanceKm(curCell, othCell) : 0, 1)
  const targetId = othCell.id || othCell.label || 'target'

  const rawCurDark = cur.metrics?.longestDarkHours ?? 0
  const rawOthDark = oth.metrics?.longestDarkHours ?? 0
  const curDark = fmt(rawCurDark, 1)
  const otherDark = fmt(rawOthDark, 1)
  const darkDiff = rawOthDark - rawCurDark

  let verbPhrase
  if (otherDark < curDark) {
    verbPhrase = `cuts the longest dark period from ${curDark} h to ${otherDark} h`
  } else if (otherDark > curDark) {
    verbPhrase = `increases the longest dark period from ${curDark} h to ${otherDark} h`
  } else {
    verbPhrase = `keeps the longest dark period at ${curDark} h`
  }

  const curHorizon = Array.isArray(curCell.horizon) && curCell.horizon.length ? curCell.horizon : null
  const othHorizon = Array.isArray(othCell.horizon) && othCell.horizon.length ? othCell.horizon : null

  let bestSector = null

  if (curHorizon || othHorizon) {
    let maxDiff = 0
    let bestAz = -1
    let bestType = null

    if (darkDiff < 0) {
      for (let i = 0; i < 360; i++) {
        const curH = horizonElevationAt(curHorizon, i)
        const othH = horizonElevationAt(othHorizon, i)
        const diff = curH - othH
        if (diff > maxDiff) {
          maxDiff = diff
          bestAz = i
          bestType = 'lower'
        }
      }
    } else if (darkDiff > 0) {
      for (let i = 0; i < 360; i++) {
        const curH = horizonElevationAt(curHorizon, i)
        const othH = horizonElevationAt(othHorizon, i)
        const diff = othH - curH
        if (diff > maxDiff) {
          maxDiff = diff
          bestAz = i
          bestType = 'higher'
        }
      }
    }

    if (bestAz === -1) {
      for (let i = 0; i < 360; i++) {
        const curH = horizonElevationAt(curHorizon, i)
        const othH = horizonElevationAt(othHorizon, i)
        const diff = curH - othH
        const absDiff = Math.abs(diff)
        if (absDiff > maxDiff) {
          maxDiff = absDiff
          bestAz = i
          bestType = diff >= 0 ? 'lower' : 'higher'
        }
      }
    }

    if (bestAz !== -1 && maxDiff >= 0.05) {
      bestSector = { az: bestAz, diff: maxDiff, type: bestType }
    }
  }

  let reason
  if (bestSector && bestSector.diff >= 0.05) {
    const dir = compassName(bestSector.az)
    const adj = COMPASS_ADJECTIVES[dir] || dir
    const diffDeg = fmt(bestSector.diff, 1)
    reason = `because the ${adj} ridge is ${diffDeg}° ${bestSector.type}.`
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
