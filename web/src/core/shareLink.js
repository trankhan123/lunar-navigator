// W1 — shareable link. Contract: README "W1 → Share link".
import { DEFAULT_SCENARIO } from './scenario.js'

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

function decodePoint(text) {
  const [type, value = ''] = [text.slice(0, text.indexOf(':')), text.slice(text.indexOf(':') + 1)]
  if (type === 'cell') return { type: 'cell', cellId: value }
  if (type === 'site') return { type: 'site', siteId: value }
  if (type === 'coords') {
    const [lat, lon] = value.split(',').map(Number)
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { type: 'coordinates', lat, lon }
  }
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
  for (const [key, field] of Object.entries(TEXT_KEYS)) if (query.has(key)) scenario[field] = query.get(key)
  for (const [key, field] of Object.entries(NUMBER_KEYS)) if (query.has(key)) scenario[field] = Number(query.get(key))
  if (query.has('point')) scenario.currentPoint = decodePoint(query.get('point'))
  return {
    scenario,
    landingTime: query.get('landing'),
    selectedCellId: query.get('cell'),
    mode: query.get('mode') === 'expert' ? 'expert' : 'simple',
    screen: query.get('screen') ?? 'map',
  }
}
