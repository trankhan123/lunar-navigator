// W7 learn mode (README "W7 Learn mode"): plain-English explanations for teachers and the public.
import { explainDifference, findMostDifferentNeighbors } from './explain.js'
import { formatDuration } from './format.js'

const percent = (fraction) => `${Math.round(fraction * 100)} %`
const RESULT_WORDS = { pass: 'Meets all limits', marginal: 'Meets limits, battery low', fail: 'Fails a limit' }
const REASON_WORDS = { dark: 'the dark period is too long', commLoss: 'Earth is out of sight too long', battery: 'the battery runs out' }
const listWords = new Intl.ListFormat('en', { type: 'conjunction' })

function resultSentence({ status, failReasons }) {
  if (status === 'pass') return 'Every limit you set holds for the whole stay.'
  if (status === 'marginal') return 'Every limit holds, but the battery drops below 20 %, so there is little margin.'
  return `At least one limit is broken: ${listWords.format(failReasons.map((reason) => REASON_WORDS[reason]))}.`
}

function sunHeightSentence(sunHeight) {
  if (sunHeight === null) return 'The Sun stays behind the terrain for the whole stay.'
  const average = 'How high the Sun stands on average while it shines. Near the pole it skims the horizon, so distant hills can hide it.'
  if (sunHeight >= 0) return average
  return `${average} It is below zero here because this cell sits high and sees over the curve of the Moon, so the Sun still shows a little below the flat horizon line.`
}

/**
 * One row per metric of a (cell, landing time) window: {label, value, sentence}.
 * @param {object} metrics  C5 metricsAt() output
 */
export function metricSentences(metrics) {
  const { longestDarkHours: dark, longestCommLossHours: commLoss, meanSunElevationDeg: sunHeight } = metrics
  const { deadAtHour, rechargeHours, hoursToSunset } = metrics
  return [
    { label: 'Result', value: RESULT_WORDS[metrics.status], sentence: resultSentence(metrics) },
    {
      label: 'Longest dark period',
      value: dark === 0 ? 'None' : formatDuration(dark),
      sentence: dark === 0
        ? 'The Sun never sets during the stay, so the solar panels work the whole time.'
        : 'The longest stretch with less than half of the Sun above the horizon. The panels make no power then, so the battery alone keeps the lander alive.',
    },
    {
      label: 'Longest time without Earth',
      value: commLoss === 0 ? 'None' : formatDuration(commLoss),
      sentence: commLoss === 0
        ? 'Earth never drops below the horizon, so the lander can always radio Earth directly.'
        : 'The longest stretch with Earth below the horizon. Direct radio contact with Earth is cut for that long.',
    },
    { label: 'Time in sunlight', value: percent(metrics.fractionSun), sentence: 'The share of the stay with at least half of the Sun above the horizon.' },
    { label: 'Earth in view', value: percent(metrics.fractionEarth), sentence: 'The share of the stay with at least half of Earth above the horizon.' },
    {
      label: 'Sun and Earth together',
      value: percent(metrics.fractionBoth),
      sentence: 'The share of the stay when the lander can charge and talk to Earth at the same time.',
    },
    {
      label: 'Average Sun height',
      value: sunHeight === null ? 'Never up' : `${sunHeight.toFixed(1)}°`,
      sentence: sunHeightSentence(sunHeight),
    },
    {
      label: 'Lowest battery',
      value: percent(metrics.minBatteryFraction),
      sentence: 'The lowest charge during the stay. Under 20 % the result is marginal, and at 0 % the lander shuts down.',
    },
    {
      label: 'Battery runs out',
      value: deadAtHour === null ? 'Never' : `after ${formatDuration(deadAtHour)}`,
      sentence: deadAtHour === null ? 'The battery never empties during the stay.' : 'How long after landing the battery is empty and the lander shuts down.',
    },
    {
      label: 'Time to recharge',
      value: rechargeHours === null ? 'Not in this stay' : rechargeHours === 0 ? 'Not needed' : formatDuration(rechargeHours),
      sentence: rechargeHours === null
        ? 'The battery is not full again before the stay ends.'
        : rechargeHours === 0 ? 'The battery never drains, so it never needs to recharge.' : 'How long the panels take to refill the battery after its lowest point.',
    },
    {
      label: 'First sunset',
      value: hoursToSunset === null ? 'None' : hoursToSunset === 0 ? 'At landing' : `after ${formatDuration(hoursToSunset)}`,
      sentence: hoursToSunset === null
        ? 'The Sun does not set during the stay.'
        : hoursToSunset === 0 ? 'It is already dark when the lander arrives.' : 'The first time the Sun sets after landing.',
    },
  ]
}

/**
 * "Why moving 1 km matters": the neighbouring pair whose longest dark period differs most, darker cell first.
 * @returns {{darkerCell, lighterCell, darkerHours, lighterHours, distanceKm, sentence}|null}
 */
export function neighborLesson(results, cellsById, landingIndex) {
  const pair = findMostDifferentNeighbors(results, cellsById, landingIndex)
  if (!pair || pair.longestDarkHoursA === pair.longestDarkHoursB) return null
  const cellOf = (id) => (cellsById instanceof Map ? cellsById.get(id) : cellsById[id])
  const aIsDarker = pair.longestDarkHoursA > pair.longestDarkHoursB
  const [darkerCell, lighterCell] = aIsDarker ? [cellOf(pair.cellIdA), cellOf(pair.cellIdB)] : [cellOf(pair.cellIdB), cellOf(pair.cellIdA)]
  const [darkerHours, lighterHours] = aIsDarker
    ? [pair.longestDarkHoursA, pair.longestDarkHoursB]
    : [pair.longestDarkHoursB, pair.longestDarkHoursA]
  return {
    darkerCell, lighterCell, darkerHours, lighterHours, distanceKm: pair.distanceKm,
    sentence: explainDifference(darkerCell, lighterCell, { longestDarkHours: darkerHours }, { longestDarkHours: lighterHours }),
  }
}

const sunHeightWords = (sunHeight) => (sunHeight >= 0
  ? `only ${sunHeight.toFixed(1)}° above the horizon`
  : `${Math.abs(sunHeight).toFixed(1)}° below the flat horizon line, because this high cell sees over the curve of the Moon,`)

const LOW_SUN_REASON ="Near the south pole the Sun never climbs more than a few degrees, because the Moon's axis is tilted only about 1.5° to its path around the Sun."

/**
 * "How the Moon differs from Earth": {title, text} facts. With metrics, the Sun fact quotes the current point.
 * @param {object|null} metrics  C5 metricsAt() output of the current point, or null before a search
 */
export function moonFacts(metrics) {
  const sunHeight = metrics?.meanSunElevationDeg ?? null
  return [
    {
      title: 'No air, black sky',
      text: 'The Moon has no atmosphere, so the sky is black even in daytime and sunlight is not bent around the horizon. The Sun counts as up only once its disk clears the terrain.',
    },
    {
      title: 'A low Sun',
      text: sunHeight === null
        ? LOW_SUN_REASON
        : `At ${metrics.cellId}, the Sun stands on average ${sunHeightWords(sunHeight)} while it shines during your stay. ${LOW_SUN_REASON}`,
    },
    {
      title: 'A month-long day',
      text: 'One day on the Moon lasts about 29.5 Earth days, so the Sun circles the whole horizon about once a month and shadows creep slowly across the ground.',
    },
    {
      title: 'Earth barely moves',
      text: 'Earth stays in nearly the same spot in the lunar sky and only wobbles by a few degrees. Near the pole it sits low on the horizon, so a small ridge can hide it for days and cut radio contact.',
    },
  ]
}
