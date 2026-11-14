// Plain-English formatting shared by the UI (countdowns, popups).

/** 0.5 → '30 min', 3.33 → '3 h 20 min', 76 → '3 d 4 h'. */
export function formatDuration(hours) {
  if (hours < 48) {
    const minutes = Math.round(hours * 60)
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
