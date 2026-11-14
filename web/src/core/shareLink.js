// W1 — shareable link. Contract: README "W1 → Share link".
import { DEFAULT_SCENARIO, PANEL_MODES, SEARCH_SCOPES } from './scenario.js'

const TEXT_KEYS = { start: 'startDate', end: 'endDate', panelMode: 'panelMode', scope: 'searchScope' }
const NUMBER_KEYS = {
  stay: 'stayDays',
  dark: 'maxDarkHours',
  comm: 'maxCommLossHours',
  panel: 'panelMaxW',
  battery: 'batteryCapacityWh',
  load: 'loadW',
  radius: 'searchRadiusKm',
}

function encodePoint(point) {
  if (point.type === 'cell') return `cell:${point.cellId}`
  if (point.type === 'site') return `site:${point.siteId}`
  return `coords:${point.lat},${point.lon}`
}

function toFiniteNumber(text) {
  const number = Number(text)
  return text?.trim() && Number.isFinite(number) ? number : null
}

// The link is untrusted input: anything malformed decodes to null (no current point).
function decodePoint(text) {
  const colon = text.indexOf(':')
  if (colon < 1 || colon === text.length - 1) return null
  const type = text.slice(0, colon)
  const value = text.slice(colon + 1)
  if (type === 'cell') return { type: 'cell', cellId: value }
  if (type === 'site') return { type: 'site', siteId: value }
  const parts = value.split(',')
  const [lat, lon] = parts.map(toFiniteNumber)
  if (type === 'coords' && parts.length === 2 && lat !== null && lon !== null) return { type: 'coordinates', lat, lon }
  return null
}

/**
 * @param {{scenario:Object, landingTime:string|null, selectedCellId:string|null, mode:'simple'|'expert', screen:string}} state
 * @returns {string} query string without '?', e.g. 'point=cell:MAL-r3c4&start=2028-01-01&…'
 */
export function encodeShareQuery({ scenario, landingTime, selectedCellId, mode, screen }) {
  const query = new URLSearchParams()
  if (scenario.currentPoint) query.set('point', encodePoint(scenario.currentPoint))
  for (const [key, field] of Object.entries({ ...TEXT_KEYS, ...NUMBER_KEYS })) {
    if (scenario[field] !== null && scenario[field] !== undefined) query.set(key, scenario[field])
  }
  if (landingTime) query.set('landing', landingTime)
  if (selectedCellId) query.set('cell', selectedCellId)
  query.set('mode', mode)
  query.set('screen', screen)
  return query.toString()
}

/** Inverse of encodeShareQuery; missing keys take DEFAULT_SCENARIO values. */
export function decodeShareQuery(queryString) {
  const query = new URLSearchParams(queryString)
  const scenario = { ...DEFAULT_SCENARIO }
  for (const [key, field] of Object.entries(TEXT_KEYS)) if (query.get(key)) scenario[field] = query.get(key)
  for (const [key, field] of Object.entries(NUMBER_KEYS)) scenario[field] = toFiniteNumber(query.get(key)) ?? scenario[field]
  if (!PANEL_MODES.includes(scenario.panelMode)) scenario.panelMode = DEFAULT_SCENARIO.panelMode
  if (!SEARCH_SCOPES.includes(scenario.searchScope)) scenario.searchScope = DEFAULT_SCENARIO.searchScope
  if (query.has('point')) scenario.currentPoint = decodePoint(query.get('point'))
  return {
    scenario,
    landingTime: query.get('landing'),
    selectedCellId: query.get('cell'),
    mode: query.get('mode') === 'expert' ? 'expert' : 'simple',
    screen: query.get('screen') ?? 'map',
  }
}
