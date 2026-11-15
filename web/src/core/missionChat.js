import { DEFAULT_SCENARIO, PANEL_MODES, SEARCH_SCOPES, validateScenario } from './scenario.js'

export const CHAT_FIELDS = {
  stayDays: { label: 'Stay', unit: 'days', units: { days: 1, h: 1 / 24 } },
  maxDarkHours: { label: 'Maximum darkness', unit: 'h', units: { h: 1, days: 24, min: 1 / 60 } },
  maxCommLossHours: { label: 'Maximum comm loss', unit: 'h', units: { h: 1, days: 24, min: 1 / 60 } },
  panelMaxW: { label: 'Panel power', unit: 'W', units: { W: 1, kW: 1000 } },
  batteryCapacityWh: { label: 'Battery', unit: 'Wh', units: { Wh: 1, kWh: 1000 } },
  loadW: { label: 'Load', unit: 'W', units: { W: 1, kW: 1000 } },
  searchRadiusKm: { label: 'Search radius', unit: 'km', units: { km: 1, m: 0.001 } },
}

export function assertObject(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some((key) => !keys.includes(key))) throw new Error('Unexpected response fields.')
}

function checkPoint(point, catalog) {
  if (!point) throw new Error('Choose a current landing point.')
  const keys = { cell: ['type', 'cellId'], site: ['type', 'siteId'], coordinates: ['type', 'lat', 'lon'] }[point.type]
  if (!keys) throw new Error('Choose a cell, a site or explicit coordinates.')
  assertObject(point, keys)
  if (point.type === 'site' && !catalog.sites.some((site) => site.id === point.siteId)) throw new Error('Choose a site from the available list.')
  if (point.type === 'cell' && !catalog.cellIds.has(point.cellId)) throw new Error('Choose a cell from the available grid.')
  if (point.type === 'coordinates' && (!Number.isFinite(point.lat) || Math.abs(point.lat) > 90 ||
      !Number.isFinite(point.lon) || Math.abs(point.lon) > 180)) throw new Error('Enter latitude −90…90 and longitude −180…180.')
}

export function normalizeChatPatch(patch, catalog) {
  assertObject(patch, Object.keys(DEFAULT_SCENARIO))
  const result = {}
  for (const [field, value] of Object.entries(patch)) {
    if (value === null) continue // Nullable extraction means the user did not specify this field.
    if (Object.hasOwn(CHAT_FIELDS, field)) {
      assertObject(value, ['value', 'unit'])
      const units = CHAT_FIELDS[field].units
      if (!Number.isFinite(value.value) || !Object.hasOwn(units, value.unit)) throw new Error('Invalid quantity or unit.')
      result[field] = value.value * units[value.unit]
      if (!Number.isFinite(result[field])) throw new Error('Quantity is too large.')
    } else if (field === 'currentPoint') {
      checkPoint(value, catalog)
      result[field] = { ...value }
    } else {
      if (typeof value !== 'string' || value.length > 32) throw new Error('Invalid scenario value.')
      if (field === 'panelMode' && !PANEL_MODES.includes(value)) throw new Error('Invalid panel mode.')
      if (field === 'searchScope' && !SEARCH_SCOPES.includes(value)) throw new Error('Invalid search scope.')
      result[field] = value
    }
  }
  return result
}

export function prepareChatDraft(reply, scenario, catalog) {
  assertObject(reply, ['message', 'questions', 'patch'])
  if (typeof reply.message !== 'string' || !reply.message.trim() || reply.message.length > 1200 ||
      !Array.isArray(reply.questions) || reply.questions.length > 2 ||
      reply.questions.some((question) => typeof question !== 'string' || !question.trim() || question.length > 240)) {
    throw new Error('Invalid assistant response.')
  }
  const patch = normalizeChatPatch(reply.patch, catalog)
  const next = { ...scenario, ...patch }
  const errors = validateScenario(next, catalog.ephemeris)
  try { checkPoint(next.currentPoint, catalog) } catch (error) {
    if (!errors.some(({ field }) => field === 'currentPoint')) errors.push({ field: 'currentPoint', message: error.message })
  }
  return { message: reply.message, questions: reply.questions, patch, scenario: next, errors,
    canApply: Object.keys(patch).length > 0 && errors.length === 0 && reply.questions.length === 0 }
}

export function describeChatScenario(scenario, sites) {
  const point = scenario.currentPoint
  const location = !point ? 'Not selected' : point.type === 'site'
    ? sites.find((site) => site.id === point.siteId)?.name ?? point.siteId
    : point.type === 'cell' ? point.cellId : `${point.lat}° N, ${point.lon}° E`
  return [
    ['Landing point', location, 'currentPoint'],
    ['Earliest landing (UTC)', scenario.startDate, 'startDate'],
    ['Latest landing (UTC)', scenario.endDate, 'endDate'],
    ...Object.entries(CHAT_FIELDS).filter(([field]) => field !== 'searchRadiusKm' || scenario.searchScope === 'radius')
      .map(([field, { label, unit }]) => [label, `${scenario[field] ?? '—'} ${unit}`, field]),
    ['Panel mode', scenario.panelMode, 'panelMode'], ['Search scope', scenario.searchScope, 'searchScope'],
    ['Require DSN station', scenario.requireDsn ? 'Required' : 'Not required', 'requireDsn'],
  ]
}
