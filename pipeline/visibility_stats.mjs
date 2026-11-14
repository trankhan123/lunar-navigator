#!/usr/bin/env node
/**
 * D7 helper — compute sun/earth fractions from our browser model (C1 + C2).
 * Reads:  web/public/data/cells_*.json (real D5 output)
 *         web/public/data/ephemeris.json (real D1 output)
 * Writes: pipeline/out/our_visibility.json
 *
 * Run:    node pipeline/visibility_stats.mjs
 *
 * BLOCKED when:
 *   - C1 (sunlight.js) is not implemented (throws notImplemented)
 *   - C2 (communication.js) is not implemented
 *   - No real cells_*.json files exist (D5 not done)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { fileURLToPath, pathToFileURL } from 'url'
import { dirname, join, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const WEB_DATA = join(ROOT, 'web', 'public', 'data')
const OUT_DIR = join(ROOT, 'pipeline', 'out')
const REGION_CODES = ['CAB', 'HAW', 'MAL', 'MMP', 'MMO', 'NR1', 'NR2', 'DGR', 'SLP']
const VISIBLE_THRESHOLD = 0.5

function loadJson(path) {
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf-8'))
}

// --- Load ephemeris ---
const ephemeris = loadJson(join(WEB_DATA, 'ephemeris.json'))
if (!ephemeris) {
  console.error('BLOCKED: web/public/data/ephemeris.json not found (run D1 first)')
  process.exit(1)
}

// --- Import C1 + C2 ---
let computeSunTrack, computeEarthTrack, fractionAtLeast

try {
  const sunlightUrl = pathToFileURL(join(ROOT, 'web', 'src', 'core', 'sunlight.js')).href
  const sunlight = await import(sunlightUrl)
  computeSunTrack = sunlight.computeSunTrack
} catch (e) {
  console.error('BLOCKED: could not import sunlight.js:', e.message)
  process.exit(2)
}

try {
  const commUrl = pathToFileURL(join(ROOT, 'web', 'src', 'core', 'communication.js')).href
  const comm = await import(commUrl)
  computeEarthTrack = comm.computeEarthTrack
} catch (e) {
  console.error('BLOCKED: could not import communication.js:', e.message)
  process.exit(2)
}

try {
  const tsUrl = pathToFileURL(join(ROOT, 'web', 'src', 'core', 'timeSeries.js')).href
  const ts = await import(tsUrl)
  fractionAtLeast = ts.fractionAtLeast
} catch (e) {
  console.error('BLOCKED: could not import timeSeries.js:', e.message)
  process.exit(2)
}

// --- Probe C1 for NotImplemented stub ---
const probeCell = { lat: -85.925, lon: -1.205, heightM: 0, horizon: null }
try {
  computeSunTrack(probeCell, ephemeris, 0, 1, 'auto')
} catch (e) {
  const msg = (e && e.message) ? e.message : String(e)
  if (msg.includes('notImplemented') || msg.includes('Not implemented') || msg.includes('C1')) {
    console.error('BLOCKED: C1 sunlight.js is not implemented yet (throws notImplemented).')
    console.error('validate.py will write null for ourSunFraction/ourEarthFraction.')
    process.exit(2)
  }
  throw e
}

// --- Collect real cells ---
const allCells = []
for (const code of REGION_CODES) {
  const data = loadJson(join(WEB_DATA, `cells_${code}.json`))
  if (!data || data.mock) continue  // skip mock data
  for (const cell of (data.cells || [])) allCells.push(cell)
}

if (allCells.length === 0) {
  console.error('BLOCKED: No real cells_*.json files found in web/public/data/.')
  console.error('Run D5 (build_site_data.py) first.')
  process.exit(3)
}

console.log(`Computing visibility for ${allCells.length} cells over ${ephemeris.hours} hours...`)

const firstHour = 0
const hourCount = ephemeris.hours
const result = {}

for (let i = 0; i < allCells.length; i++) {
  const cell = allCells[i]
  try {
    const sunTrack = computeSunTrack(cell, ephemeris, firstHour, hourCount, 'auto')
    const earthTrack = computeEarthTrack(cell, ephemeris, firstHour, hourCount)
    const sunFraction = fractionAtLeast(sunTrack.diskFraction, VISIBLE_THRESHOLD, 0, hourCount)
    const earthFraction = fractionAtLeast(earthTrack.diskFraction, VISIBLE_THRESHOLD, 0, hourCount)
    result[cell.id] = {
      sunFraction: Math.round(sunFraction * 10000) / 10000,
      earthFraction: Math.round(earthFraction * 10000) / 10000,
    }
  } catch (e) {
    console.warn(`  skip ${cell.id}: ${e.message}`)
    result[cell.id] = { sunFraction: null, earthFraction: null }
  }
  if ((i + 1) % 100 === 0) console.log(`  ${i + 1}/${allCells.length}`)
}

mkdirSync(OUT_DIR, { recursive: true })
const outPath = join(OUT_DIR, 'our_visibility.json')
writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8')
const sizeMB = (Buffer.byteLength(JSON.stringify(result)) / 1e6).toFixed(3)
console.log(`wrote ${outPath}  (${Object.keys(result).length} cells, ${sizeMB} MB)`)
