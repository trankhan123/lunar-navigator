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

// Rounds to d decimals and drops float noise (3.2000000000000006 -> 3.2).
const fmt = (n, d = 1) => Number(Number(n).toFixed(d))

/** Nearest of the 8 compass directions for an azimuth. */
export function compassName(azimuthDeg) {
  const normalized = ((azimuthDeg % 360) + 360) % 360
  const index = Math.round(normalized / 45) % 8
  return COMPASS_DIRECTIONS[index]
}

const middleValue = (sortedValues) => sortedValues[Math.floor(sortedValues.length / 2)]

/**
 * Hours of the stay when the darker cell has less than half of the Sun up and the brighter cell has at least half,
 * as {azimuthDeg, darkerMinusBrighterHorizonDeg} (the horizons are read at the Sun's azimuth).
 */
function sunHoursOnlyOneCellSees(darker, brighter) {
  const hours = []
  for (let i = 0; i < darker.lengthHours; i++) {
    const darkerHour = darker.startIndex + i
    const brighterHour = brighter.startIndex + i
    if (darker.sunTrack.diskFraction[darkerHour] >= 0.5 || brighter.sunTrack.diskFraction[brighterHour] < 0.5) continue
    const azimuthDeg = darker.sunTrack.azimuthDeg[darkerHour]
    hours.push({
      azimuthDeg,
      darkerMinusBrighterHorizonDeg: horizonElevationAt(darker.cell.horizon, azimuthDeg) - horizonElevationAt(brighter.cell.horizon, azimuthDeg),
    })
  }
  return hours
}

/**
 * Ending of the sentence that explains why `other` has a different longest dark period than `current`: looks only at
 * the hours when exactly one of the two cells has the Sun up, and compares the two horizons at the Sun's azimuth then.
 * @param {{cell, metrics: {longestDarkHours}, sunTrack?: {azimuthDeg, diskFraction}, startIndex?: number, lengthHours?: number}} current
 * @param {object} other  same shape; both Sun tracks must cover the same hours
 * @param {string} where  how the sentence names the cell whose ridge differs, when that is `other`
 */
export function differenceReason(current, other, where = 'there') {
  if (!current.sunTrack || !other.sunTrack) return '.'
  const currentIsDarker = (current.metrics?.longestDarkHours ?? 0) >= (other.metrics?.longestDarkHours ?? 0)
  const [darker, brighter] = currentIsDarker ? [current, other] : [other, current]
  const hours = sunHoursOnlyOneCellSees(darker, brighter)
  if (hours.length === 0) {
    return ', because both cells see the Sun at the same hours; the difference comes from something else (for example Earth visibility or the battery).'
  }
  hours.sort((a, b) => a.darkerMinusBrighterHorizonDeg - b.darkerMinusBrighterHorizonDeg)
  const typical = middleValue(hours)
  if (typical.darkerMinusBrighterHorizonDeg < 0.05) {
    return ', with no real difference in the terrain where the Sun is in those hours.'
  }
  const adjective = COMPASS_ADJECTIVES[compassName(typical.azimuthDeg)]
  const place = currentIsDarker ? 'there' : where
  return `, because the ${adjective} ridge is ${fmt(typical.darkerMinusBrighterHorizonDeg, 1)}° ${currentIsDarker ? 'lower' : 'higher'} ${place}, right where the Sun is in those hours.`
}

/** "Moving D km to X cuts/increases/keeps the longest dark period ..., because ..." for two cells with the same Sun-track hours. */
export function explainDifference(current, other) {
  const curDark = fmt(current.metrics?.longestDarkHours ?? 0, 1)
  const otherDark = fmt(other.metrics?.longestDarkHours ?? 0, 1)
  const distKm = fmt(current.cell.lat != null && other.cell.lat != null ? distanceKm(current.cell, other.cell) : 0, 1)
  let verbPhrase
  if (otherDark < curDark) verbPhrase = `cuts the longest dark period from ${curDark} h to ${otherDark} h`
  else if (otherDark > curDark) verbPhrase = `increases the longest dark period from ${curDark} h to ${otherDark} h`
  else verbPhrase = `keeps the longest dark period at ${curDark} h`
  return `Moving ${distKm} km to ${other.cell.id || other.cell.label || 'target'} ${verbPhrase}${differenceReason(current, other)}`
}

/**
 * The pair of cells within maxDistanceKm whose longest dark periods differ most at one landing time.
 * With onlyWithCellId, only pairs that contain that cell are considered.
 */
export function findMostDifferentNeighbors(results, cellsById, landingIndex, maxDistanceKm = 1.5, onlyWithCellId = null) {
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
      if (onlyWithCellId && idA !== onlyWithCellId && idB !== onlyWithCellId) continue

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
