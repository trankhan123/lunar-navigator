// W3 — scenario (form output). Contract: README "Scenario".
/* eslint-disable no-unused-vars -- stub parameters; delete this line when you implement the module */
import { notImplemented } from './notImplemented.js'

export const PANEL_MODES = ['auto', 'vertical', 'horizontal']
export const SEARCH_SCOPES = ['region', 'radius', 'all']
export const MAX_RANGE_DAYS = 183
export const MAX_STAY_DAYS = 30

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
  },
]

/** Days from startDate to endDate, both included ('2028-01-01'..'2028-01-01' → 1). */
export function countDays(startDate, endDate) {
  return Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86400000) + 1
}

/**
 * Rules: README "Scenario". Messages are English UI text.
 * @param {typeof DEFAULT_SCENARIO} scenario
 * @param {import('./data.js').Ephemeris} ephemeris
 * @returns {{field:string, message:string}[]} empty when valid
 */
export function validateScenario(scenario, ephemeris) {
  throw notImplemented('W3', 'validateScenario')
}
