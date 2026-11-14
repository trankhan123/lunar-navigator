// W5 / W7 — plain-English explanations. Contract: README "W5" and "W7".
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

/** 0° → 'north', 45° → 'north-east', … (8 directions). */
export function compassName(azimuthDeg) {
  const normalized = ((azimuthDeg % 360) + 360) % 360
  const index = Math.round(normalized / 45) % 8
  return COMPASS_DIRECTIONS[index]
}

/**
 * One English sentence on why two cells differ, e.g.
 * "Moving 2.3 km to MAL-r4c5 cuts the longest dark period from 72 h to 10 h because the northern ridge is 1.5° lower."
 * @param {{cell:Object, metrics:Object, sunTrack:Object, startIndex:number, lengthHours:number}} current
 * @param {{cell:Object, metrics:Object, sunTrack:Object, startIndex:number, lengthHours:number}} other
 * @returns {string}
 */
export function explainDifference(current, other) {
  const dist = distanceKm(current.cell, other.cell).toFixed(1)
  const targetId = other.cell.id || other.cell.label || 'target'
  const curDark = current.metrics.longestDarkHours
  const otherDark = other.metrics.longestDarkHours

  let verbPhrase
  if (otherDark < curDark) {
    verbPhrase = `cuts the longest dark period from ${curDark} h to ${otherDark} h`
  } else if (otherDark > curDark) {
    verbPhrase = `increases the longest dark period from ${curDark} h to ${otherDark} h`
  } else {
    verbPhrase = `keeps the longest dark period at ${curDark} h`
  }

  // Find critical hours where sunlight status differs due to terrain
  const lengthHours = current.lengthHours || other.lengthHours || 0
  let bestHour = null
  let maxDiff = -Infinity

  for (let h = 0; h < lengthHours; h++) {
    const curIdx = current.startIndex + h
    const otherIdx = other.startIndex + h
    const curSun = current.sunTrack.diskFraction[curIdx] >= VISIBLE_THRESHOLD
    const otherSun = other.sunTrack.diskFraction[otherIdx] >= VISIBLE_THRESHOLD

    // When dark period is cut, look for hours dark at current but sunlit at other
    if (!curSun && otherSun) {
      const az = current.sunTrack.azimuthDeg[curIdx]
      const curH = horizonElevationAt(current.cell.horizon, az)
      const otherH = horizonElevationAt(other.cell.horizon, az)
      const diff = curH - otherH
      if (diff > maxDiff) {
        maxDiff = diff
        bestHour = { az, diff, type: 'lower' }
      }
    }
  }

  // If no hours where current is dark & other is sunlit, check reverse
  if (!bestHour) {
    for (let h = 0; h < lengthHours; h++) {
      const curIdx = current.startIndex + h
      const otherIdx = other.startIndex + h
      const curSun = current.sunTrack.diskFraction[curIdx] >= VISIBLE_THRESHOLD
      const otherSun = other.sunTrack.diskFraction[otherIdx] >= VISIBLE_THRESHOLD

      if (curSun && !otherSun) {
        const az = other.sunTrack.azimuthDeg[otherIdx]
        const curH = horizonElevationAt(current.cell.horizon, az)
        const otherH = horizonElevationAt(other.cell.horizon, az)
        const diff = otherH - curH
        if (diff > maxDiff) {
          maxDiff = diff
          bestHour = { az, diff, type: 'higher' }
        }
      }
    }
  }

  // If still no direct sunlit/dark difference, compare horizon along track
  if (!bestHour) {
    for (let h = 0; h < lengthHours; h++) {
      const curIdx = current.startIndex + h
      const az = current.sunTrack.azimuthDeg[curIdx]
      const curH = horizonElevationAt(current.cell.horizon, az)
      const otherH = horizonElevationAt(other.cell.horizon, az)
      const diff = curH - otherH
      if (Math.abs(diff) > maxDiff) {
        maxDiff = Math.abs(diff)
        bestHour = { az, diff, type: diff >= 0 ? 'lower' : 'higher' }
      }
    }
  }

  let reason
  if (bestHour && Math.abs(bestHour.diff) >= 0.05) {
    const dir = compassName(bestHour.az)
    const adj = COMPASS_ADJECTIVES[dir] || dir
    const diffDeg = Math.abs(bestHour.diff).toFixed(1)
    reason = `because the ${adj} ridge is ${diffDeg}° ${bestHour.type}.`
  } else {
    reason = 'with negligible difference in terrain obstruction.'
  }

  return `Moving ${dist} km to ${targetId} ${verbPhrase} ${reason}`
}

/**
 * Learn mode card "Why 1 km matters": the pair of neighbouring cells (≤ maxDistanceKm apart)
 * with the largest difference in longestDarkHours at one landing time.
 * @param {import('./optimizer.js').WindowResults} results
 * @param {Object<string, import('./data.js').Cell>|Map<string, import('./data.js').Cell>} cellsById
 * @param {number} landingIndex
 * @param {number} [maxDistanceKm=1.5]
 * @returns {{cellIdA:string, cellIdB:string, distanceKm:number, longestDarkHoursA:number, longestDarkHoursB:number}|null}
 */
export function findMostDifferentNeighbors(results, cellsById, landingIndex, maxDistanceKm = 1.5) {
  const { cellCount, landingCount } = results
  if (!cellCount || cellCount < 2 || landingIndex < 0 || landingIndex >= landingCount) {
    return null
  }

  function getCell(id) {
    if (!cellsById) return null
    if (cellsById instanceof Map) return cellsById.get(id)
    return cellsById[id]
  }

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
