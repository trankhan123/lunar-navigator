import { LANDING_STEP_HOURS, STATUS, summarizeCurrentPoint } from './optimizer.js'

/** How far the landing can slip at the current point (cell 0). Returns data only; the card words it. */
export function slipOutlook(results, landingIndex) {
  const { status, landingCount, landingTimes } = results
  const passesAt = (k) => status[k] !== STATUS.fail
  if (passesAt(landingIndex)) {
    let endIndex = landingIndex
    while (endIndex + 1 < landingCount && passesAt(endIndex + 1)) endIndex++
    return {
      kind: 'canSlip',
      slipHours: LANDING_STEP_HOURS * (endIndex - landingIndex),
      untilTime: landingTimes[endIndex],
      reachesSearchEnd: endIndex === landingCount - 1,
    }
  }
  let nextIndex = landingIndex + 1
  while (nextIndex < landingCount && !passesAt(nextIndex)) nextIndex++
  const hasNext = nextIndex < landingCount
  const { nearestPassingCell } = summarizeCurrentPoint(results, landingIndex)
  return {
    kind: 'blocked',
    nextLandingTime: hasNext ? landingTimes[nextIndex] : null,
    hoursUntilNext: hasNext ? LANDING_STEP_HOURS * (nextIndex - landingIndex) : null,
    nearestCellId: nearestPassingCell?.cellId ?? null,
    nearestCellDistanceKm: nearestPassingCell?.distanceKm ?? null,
  }
}
