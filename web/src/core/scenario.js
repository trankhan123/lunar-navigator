// W3 — scenario (form output). Contract: docs/technical-reference.md "Scenario".

export const PANEL_MODES = ['auto', 'vertical', 'horizontal']
export const SEARCH_SCOPES = ['region', 'radius', 'all']
export const MAX_RANGE_DAYS = 183
export const MAX_STAY_DAYS = 30
export const MAX_SEARCH_RADIUS_KM = 50 // keeps a radius search on the 2 km cap grid small enough for the worker (cap grid: ~71k cells to 80°S)

// Example values only (window-finder.md §3.2), not the specification of any real lander.
export const DEFAULT_SCENARIO = {
  currentPoint: null, // {type:'cell', cellId} | {type:'site', siteId} | {type:'coordinates', lat, lon}
  startDate: '2028-01-01',
  endDate: '2028-06-30',
  stayDays: 6,
  maxDarkHours: 24,
  maxCommLossHours: 12,
  panelMaxW: 1000,
  batteryCapacityWh: 10000,
  loadW: 300,
  panelMode: 'auto',
  searchScope: 'region',
  searchRadiusKm: 10,
  requireDsn: false, // opt-in: Earth also needs a DSN station that sees the Moon (docs/technical-reference.md C2)
}

// Simple mode fills these fields from a preset and asks only point, dates and stay length.
export const LANDER_PRESETS = [
  {
    id: 'example-lander',
    label: 'Example lander (illustrative numbers)',
    maxDarkHours: 24,
    maxCommLossHours: 12,
    panelMaxW: 1000,
    batteryCapacityWh: 10000,
    loadW: 300,
    panelMode: 'auto',
    stayDays: DEFAULT_SCENARIO.stayDays,
  },
  // Sources opened 2026-11-15. Estimates: load = ~25% of panel power (VIPER: 110/450), battery = ~14 h of that load (Nova-C: 25 Ah x 28 V = 700 Wh = 50 W x 14 h).
  // Dark/comm-loss limits are the example lander's limits unless a source says otherwise.
  {
    id: 'viper',
    label: 'VIPER (rover)',
    source: 'NASA VIPER Rover Overview (NTRS 20240013903)',
    sourceUrl: 'https://ntrs.nasa.gov/api/citations/20240013903/downloads/LSIC_2024-Tech%20Infusion_Panel-VIPER_Mob-HW.pdf',
    basis: { panelMaxW: 'published', batteryCapacityWh: 'published', loadW: 'estimate' },
    note: 'Panel: 450 W is the corner figure. Load = 5,420 Wh / 50 h low-power survival. Max dark = that 50 h. Stay set to this tool\'s 30-day maximum.',
    maxDarkHours: 50,
    maxCommLossHours: 12,
    panelMaxW: 450,
    batteryCapacityWh: 5420,
    loadW: 110,
    panelMode: 'auto',
    stayDays: 30,
  },
  {
    id: 'nova-c',
    label: 'Nova-C (IM-1)',
    source: 'Wikipedia: Intuitive Machines Nova-C',
    sourceUrl: 'https://en.wikipedia.org/wiki/Intuitive_Machines_Nova-C',
    basis: { panelMaxW: 'published', batteryCapacityWh: 'estimate', loadW: 'estimate' },
    note: 'Battery: 25 Ah x 28 V bus (published) = 700 Wh. Stay: 14-day design life. Dark/comm-loss limits are the example limits.',
    maxDarkHours: 24,
    maxCommLossHours: 12,
    panelMaxW: 200,
    batteryCapacityWh: 700,
    loadW: 50,
    panelMode: 'auto',
    stayDays: 14,
  },
  {
    id: 'blue-ghost-1',
    label: 'Blue Ghost Mission 1',
    source: 'Firefly: Blue Ghost Mission 1',
    sourceUrl: 'https://fireflyspace.com/missions/blue-ghost-mission-1/',
    basis: { panelMaxW: 'published', batteryCapacityWh: 'estimate', loadW: 'estimate' },
    note: 'Flew more than 14 days on the surface. Battery size is not published. Dark/comm-loss limits are the example limits.',
    maxDarkHours: 24,
    maxCommLossHours: 12,
    panelMaxW: 400,
    batteryCapacityWh: 1400,
    loadW: 100,
    panelMode: 'auto',
    stayDays: 14,
  },
  {
    id: 'vikram',
    label: 'Vikram (Chandrayaan-3)',
    source: 'eoportal: Chandrayaan-3 (ISRO data; the ISRO brochure link returns 404)',
    sourceUrl: 'https://www.eoportal.org/satellite-missions/chandrayaan-3',
    basis: { panelMaxW: 'published', batteryCapacityWh: 'estimate', loadW: 'estimate' },
    note: '738 W is the winter-solstice figure with bias. Stay: 1 lunar day (14 days). Battery size is not published. Dark/comm-loss limits are the example limits.',
    maxDarkHours: 24,
    maxCommLossHours: 12,
    panelMaxW: 738,
    batteryCapacityWh: 2600,
    loadW: 185,
    panelMode: 'auto',
    stayDays: 14,
  },
]

/** Days from startDate to endDate, both included ('2028-01-01'..'2028-01-01' → 1). */
export function isPointComplete(point) {
  if (!point) return false
  if (point.type === 'cell') return Boolean(point.cellId)
  if (point.type === 'site') return Boolean(point.siteId)
  return Number.isFinite(point.lat) && Number.isFinite(point.lon)
}

export function countDays(startDate, endDate) {
  return Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86400000) + 1
}

const DAY_MS = 86400000
const HOUR_MS = 3600000

/** Milliseconds of 'YYYY-MM-DD' at 00:00Z, or null when the text is not a real date. */
function parseDay(text) {
  if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null
  const ms = Date.parse(`${text}T00:00:00Z`)
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== text) return null
  return ms
}

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value)

/**
 * Rules: docs/technical-reference.md "Scenario". Messages are English UI text.
 * @param {typeof DEFAULT_SCENARIO} scenario
 * @param {import('./data.js').Ephemeris} ephemeris
 * @returns {{field:string, message:string}[]} empty when valid
 */
export function validateScenario(scenario, ephemeris) {
  const errors = []
  const fail = (field, message) => {
    if (!errors.some((error) => error.field === field)) errors.push({ field, message })
  }

  const point = scenario.currentPoint
  if (!point) {
    fail('currentPoint', 'Choose a current point: a cell, a famous site or coordinates.')
  } else if (point.type === 'cell') {
    if (!point.cellId) fail('currentPoint', 'Enter a cell ID.')
  } else if (point.type === 'site') {
    if (!point.siteId) fail('currentPoint', 'Choose a site.')
  } else if (point.type === 'coordinates') {
    if (!isNumber(point.lat) || point.lat < -90 || point.lat > 90) {
      fail('currentPoint', 'Latitude must be between -90 and 90.')
    } else if (!isNumber(point.lon) || point.lon < -180 || point.lon > 180) {
      fail('currentPoint', 'Longitude must be between -180 and 180.')
    }
  } else {
    fail('currentPoint', 'Choose a current point: a cell, a famous site or coordinates.')
  }

  const stayOk = Number.isInteger(scenario.stayDays) && scenario.stayDays >= 1 && scenario.stayDays <= MAX_STAY_DAYS
  if (!stayOk) fail('stayDays', `Stay length must be a whole number from 1 to ${MAX_STAY_DAYS} days.`)

  const startMs = parseDay(scenario.startDate)
  const endMs = parseDay(scenario.endDate)
  if (startMs === null) {
    fail('startDate', 'Enter a valid start date.')
  } else if (ephemeris && startMs < Date.parse(ephemeris.startTime)) {
    fail('startDate', 'Start date is before the available ephemeris data.')
  }
  if (endMs === null) {
    fail('endDate', 'Enter a valid end date.')
  } else if (startMs !== null) {
    const days = countDays(scenario.startDate, scenario.endDate)
    if (endMs < startMs) {
      fail('endDate', 'End date must be on or after the start date.')
    } else if (days > MAX_RANGE_DAYS) {
      fail('endDate', `The date range can be at most ${MAX_RANGE_DAYS} days.`)
    } else if (stayOk && ephemeris) {
      const ephEnd = Date.parse(ephemeris.startTime) + ephemeris.hours * ephemeris.stepHours * HOUR_MS
      if (startMs + (days + scenario.stayDays) * DAY_MS > ephEnd) {
        fail('endDate', 'End date plus the stay length goes past the available ephemeris data.')
      }
    }
  }

  if (!isNumber(scenario.maxDarkHours) || scenario.maxDarkHours < 0) {
    fail('maxDarkHours', 'Longest dark period must be 0 or more hours.')
  }
  if (!isNumber(scenario.maxCommLossHours) || scenario.maxCommLossHours < 0) {
    fail('maxCommLossHours', 'Longest comm loss must be 0 or more hours.')
  }
  if (!isNumber(scenario.panelMaxW) || scenario.panelMaxW <= 0) {
    fail('panelMaxW', 'Panel power must be greater than 0 W.')
  }
  if (!isNumber(scenario.batteryCapacityWh) || scenario.batteryCapacityWh <= 0) {
    fail('batteryCapacityWh', 'Battery capacity must be greater than 0.')
  }
  if (!isNumber(scenario.loadW) || scenario.loadW < 0) {
    fail('loadW', 'Load must be 0 W or more.')
  }
  if (!PANEL_MODES.includes(scenario.panelMode)) {
    fail('panelMode', 'Choose auto, vertical or horizontal.')
  }
  if (typeof scenario.requireDsn !== 'boolean') {
    fail('requireDsn', 'DSN requirement must be on or off.')
  }
  if (!SEARCH_SCOPES.includes(scenario.searchScope)) {
    fail('searchScope', 'Choose region, radius or all.')
  } else if (scenario.searchScope === 'radius' && (!isNumber(scenario.searchRadiusKm) || scenario.searchRadiusKm <= 0)) {
    fail('searchRadiusKm', 'Search radius must be greater than 0 km.')
  } else if (scenario.searchScope === 'radius' && scenario.searchRadiusKm > MAX_SEARCH_RADIUS_KM) {
    fail('searchRadiusKm', `Search radius can be at most ${MAX_SEARCH_RADIUS_KM} km.`)
  }

  return errors
}