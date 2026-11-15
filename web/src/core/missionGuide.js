import { CHAT_FIELDS } from './missionChat.js'
import { DEFAULT_SCENARIO, validateScenario } from './scenario.js'

export const GUIDE_FIELDS = {
  stayDays: ['Surface stay', 'How long will the mission stay?'],
  maxDarkHours: ['Maximum night time', 'Longest continuous period without sunlight.'],
  maxCommLossHours: ['Maximum time without contact', 'Longest continuous period without a direct Earth link.'],
  batteryCapacityWh: ['Battery capacity', 'Stored energy available when landing.'],
  panelMaxW: ['Solar panel power', 'Power produced at full sunlight.'],
  loadW: ['Power consumption', 'Average power your equipment uses.'],
  searchRadiusKm: ['Search radius', 'Used only when searching within a radius.'],
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// Store the value as well as the source so later manual edits cannot inherit a chat badge.
export function recordEnteredFields(previous, patch) {
  return { ...previous, ...Object.fromEntries(Object.entries(patch).map(([field, value]) => [field, JSON.stringify(value)])) }
}

export function missionFieldStatus(field, scenario, entered, errors) {
  if (scenario[field] === null || scenario[field] === '') return { kind: 'missing', label: 'Needed' }
  if (errors.some((error) => error.field === field)) return { kind: 'invalid', label: 'Invalid' }
  if (entered[field] === JSON.stringify(scenario[field])) return { kind: 'entered', label: 'Entered · valid' }
  if (same(scenario[field], DEFAULT_SCENARIO[field])) return { kind: 'default', label: 'Default' }
  return { kind: 'current', label: 'From form' }
}

// Blank guided inputs preserve the form; only explicitly entered details become chat text.
export function prepareGuidedRequest(values, units, scenario, ephemeris, sites) {
  const patch = {}
  const errors = []
  const lines = []
  for (const [field, raw] of Object.entries(values)) {
    const text = raw.trim()
    if (!text) continue
    if (Object.hasOwn(CHAT_FIELDS, field)) {
      const unit = units[field] ?? CHAT_FIELDS[field].unit
      const number = /^\d+(?:[.,]\d+)?$/.test(text) ? Number(text.replace(',', '.')) : NaN
      if (!Number.isFinite(number) || !Object.hasOwn(CHAT_FIELDS[field].units, unit)) {
        errors.push({ field, message: 'Enter a number and choose its unit.' })
        continue
      }
      patch[field] = number * CHAT_FIELDS[field].units[unit]
      lines.push(`${GUIDE_FIELDS[field][0]}: ${number} ${unit}.`)
    } else if (field === 'currentPoint') {
      const site = sites.find(({ id }) => id === text)
      if (!site) { errors.push({ field, message: 'Choose a site from the list.' }); continue }
      patch.currentPoint = { type: 'site', siteId: site.id }
      lines.push(`Landing site: ${site.name}.`)
    } else if (['startDate', 'endDate', 'panelMode', 'searchScope'].includes(field)) {
      patch[field] = text
      const label = { startDate: 'First landing date (UTC)', endDate: 'Last landing date (UTC)', panelMode: 'Solar panel mode', searchScope: 'Search scope' }[field]
      lines.push(`${label}: ${text}.`)
    }
  }
  const next = { ...scenario, ...patch }
  const validation = validateScenario(next, ephemeris)
  const submitted = new Set(Object.keys(values).filter((field) => values[field].trim()))
  errors.push(...validation.filter(({ field }) => (submitted.has(field) ||
    (field === 'endDate' && ['startDate', 'stayDays'].some((key) => submitted.has(key)))) &&
    !errors.some((error) => error.field === field)))
  return { patch, scenario: next, errors, validation, message: lines.length ? `Help me prepare a landing search with these details. Keep other current settings.\n${lines.join('\n')}` : '' }
}
