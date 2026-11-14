// Plain-English formatting shared by the UI (countdowns, popups).

/** 0.5 → '30 min', 3.33 → '3 h 20 min', 76 → '3 d 4 h'. */
/** Name shown for a point: a site's or custom point's label, a grid cell's id ('MAL-r5c4'; its label is the same text). */
export const cellDisplayName = (cell) => (cell.id.startsWith('SITE-') || cell.id === 'CUSTOM' ? cell.label : cell.id)

/** True when the point's terrain is the smooth sphere (no horizon data): sites outside the terrain model and custom points. */
export const hasNoTerrain = (cell) => !cell.horizon

/** Why a cell is not feasible, in the UI's words (cell popup and map hover card). */
export const INFEASIBLE_REASON_TEXT = { slope: 'slope above the limit', psr: 'mostly in permanent shadow' }

export function formatDuration(hours) {
  if (!Number.isFinite(hours) || hours < 0) return '—'
  const minutes = Math.round(hours * 60)
  if (minutes < 48 * 60) {
    const wholeHours = Math.floor(minutes / 60)
    const restMinutes = minutes % 60
    if (wholeHours === 0) return `${restMinutes} min`
    return restMinutes === 0 ? `${wholeHours} h` : `${wholeHours} h ${restMinutes} min`
  }
  const totalHours = Math.round(hours)
  const days = Math.floor(totalHours / 24)
  const restHours = totalHours % 24
  return restHours === 0 ? `${days} d` : `${days} d ${restHours} h`
}

/** '2028-01-15T06:00Z' → '2028-01-15 06:00 UTC' */
export function formatUtc(isoTime) {
  return `${isoTime.slice(0, 10)} ${isoTime.slice(11, 16)} UTC`
}

/**
 * Countdown sentence for one body at the cursor (W5).
 * @param {'sun'|'earth'} body
 * @param {{event:string, hoursFromNow:number}|null} event  from nextSunEvent / nextEarthEvent
 * @param {boolean} isVisibleNow  disk fraction ≥ 0.5 at the cursor
 * @param {number} hoursLeft  hours from the cursor to the end of the track (used when event is null)
 * @returns {string} sun:   'Sun sets in 3 h 20 min' | 'Sunlight returns in 2 d 4 h' |
 *                          'Sun stays up for at least 9 d' | 'Sun stays down for at least 9 d'
 *                   earth: 'Earth sets in 18 h' | 'Earth rises in 5 h' |
 *                          'Earth stays in view for at least 9 d' | 'Earth stays hidden for at least 9 d'
 */
const EVENT_WORDS = { sunset: 'Sun sets in', sunrise: 'Sunlight returns in', earthset: 'Earth sets in', earthrise: 'Earth rises in' }
const STEADY_WORDS = { sun: ['Sun stays down', 'Sun stays up'], earth: ['Earth stays hidden', 'Earth stays in view'] }

export function countdownText(body, event, isVisibleNow, hoursLeft) {
  if (event) return `${EVENT_WORDS[event.event]} ${formatDuration(event.hoursFromNow)}`
  return `${STEADY_WORDS[body][isVisibleNow ? 1 : 0]} for at least ${formatDuration(hoursLeft)}`
}

/**
 * Plain-English verdict for the "Your current point" card (W4, Simple mode).
 * @param {Object} summary  summarizeCurrentPoint(results, landingIndex) from C5
 * @param {Object} scenario  uses maxDarkHours, maxCommLossHours
 * @returns {string} first sentence by summary.metrics.status (time = formatUtc(metrics.landingTime)):
 *   pass:     '<cellId> meets all limits for a landing at <time>.'
 *   marginal: '<cellId> meets the limits for a landing at <time>, but the battery drops to <round(minBatteryFraction × 100)> %.'
 *   fail:     '<cellId> fails for a landing at <time>: <reasons joined with "; ">.' with, in failReasons order,
 *             dark → 'longest dark period <h> h (limit <maxDarkHours> h)',
 *             commLoss → 'longest comm loss <h> h (limit <maxCommLossHours> h)',
 *             battery → 'battery runs out after <deadAtHour> h'
 *   only when fail, two more sentences:
 *     ' Nearest passing landing time: <formatDuration(|offsetHours|)> later|earlier (<time>).' or ' No passing landing time in this date range.'
 *     ' Nearest passing cell: <cellId>, <distanceKm, 1 decimal> km away.' or ' No passing cell at this landing time.'
 */
export function currentPointSentence(summary, scenario, pointName = summary.metrics.cellId) {
  const { metrics, nearestPassingLanding, nearestPassingCell } = summary
  const landing = `a landing at ${formatUtc(metrics.landingTime)}`
  if (metrics.status === 'pass') return `${pointName} meets all limits for ${landing}.`
  if (metrics.status === 'marginal') {
    return `${pointName} meets the limits for ${landing}, but the battery drops to ${Math.round(metrics.minBatteryFraction * 100)} %.`
  }
  const reasonWords = {
    dark: `longest dark period ${metrics.longestDarkHours} h (limit ${scenario.maxDarkHours} h)`,
    commLoss: `longest comm loss ${metrics.longestCommLossHours} h (limit ${scenario.maxCommLossHours} h)`,
    battery: `battery runs out after ${metrics.deadAtHour} h`,
  }
  const verdict = `${pointName} fails for ${landing}: ${metrics.failReasons.map((reason) => reasonWords[reason]).join('; ')}.`
  const nextTime = nearestPassingLanding
    ? ` Nearest passing landing time: ${formatDuration(Math.abs(nearestPassingLanding.offsetHours))} ${nearestPassingLanding.offsetHours > 0 ? 'later' : 'earlier'} (${formatUtc(nearestPassingLanding.landingTime)}).`
    : ' No passing landing time in this date range.'
  const nextCell = nearestPassingCell
    ? ` Nearest passing cell: ${nearestPassingCell.cellId}, ${nearestPassingCell.distanceKm.toFixed(1)} km away.`
    : ' No passing cell at this landing time.'
  return verdict + nextTime + nextCell
}
