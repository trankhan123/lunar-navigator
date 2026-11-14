// Plain-English formatting shared by the UI (countdowns, popups).

/** 0.5 → '30 min', 3.33 → '3 h 20 min', 76 → '3 d 4 h'. */
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
export function countdownText(body, event, isVisibleNow, hoursLeft) {
  throw new Error('Not implemented yet: W5 countdownText (see README)')
}
