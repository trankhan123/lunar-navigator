// E6 — Mission Replay: predicted sunset/Earthset at a real landing site versus when the mission really ended.
import { computeEarthTrack, nextEarthEvent } from './communication.js'
import { hourIndexOf, resolveCurrentCell, timeAtHour } from './data.js'
import { computeSunTrack, nextSunEvent } from './sunlight.js'

const HOUR_MS = 3600 * 1000
/** '2025-03-06T17:30Z' → '2025-03-06T17:00Z' (ephemeris hours are whole hours) */
export const toWholeHour = (isoTime) => `${isoTime.slice(0, 13)}:00Z`

/**
 * @param {Object} site  entry of sites.json (lat, lon, horizon)
 * @param {import('./data.js').Ephemeris} replayEphemeris  web/public/data/replay/<siteId>.json
 * @param {{siteId:string, landedUtc:string, endedUtc:string|null}} mission  entry of replay/index.json
 * @returns {{predictedSunsetUtc:string|null, predictedEarthsetUtc:string|null, hoursFromLandingToSunset:number|null,
 *   endedUtc:string|null, differenceHours:number|null, reason:string|null}}  reason explains a null sunset
 */
export function replaySummary(site, replayEphemeris, mission) {
  const cell = resolveCurrentCell({ type: 'site', siteId: site.id }, {}, [site])
  const landingHour = hourIndexOf(replayEphemeris, toWholeHour(mission.landedUtc))
  const trackHours = replayEphemeris.hours - landingHour
  const sunTrack = computeSunTrack(cell, replayEphemeris, landingHour, trackHours)
  const earthTrack = computeEarthTrack(cell, replayEphemeris, landingHour, trackHours)
  const sunEvent = nextSunEvent(sunTrack, 0)
  const earthEvent = nextEarthEvent(earthTrack, 0)

  const sunset = sunEvent?.event === 'sunset' ? sunEvent.hoursFromNow : null
  const earthset = earthEvent?.event === 'earthset' ? earthEvent.hoursFromNow : null
  const reason = sunset !== null ? null : sunTrack.diskFraction[0] < 0.5 ? 'sun-down-at-landing' : 'no-sunset-in-window'
  const predictedSunsetUtc = sunset === null ? null : timeAtHour(replayEphemeris, landingHour + sunset)
  const endedUtc = mission.endedUtc ?? null
  return {
    predictedSunsetUtc,
    predictedEarthsetUtc: earthset === null ? null : timeAtHour(replayEphemeris, landingHour + earthset),
    hoursFromLandingToSunset: sunset,
    endedUtc,
    differenceHours: predictedSunsetUtc && endedUtc ? (Date.parse(endedUtc) - Date.parse(predictedSunsetUtc)) / HOUR_MS : null,
    reason,
  }
}
