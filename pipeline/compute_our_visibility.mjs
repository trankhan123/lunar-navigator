// D7: our Sun/Earth visibility over the WHOLE ephemeris for ~30 evenly spaced cells per region, inside the PGDA 69 square.
// Run: node pipeline/compute_our_visibility.mjs   -> pipeline/out/our_visibility.json (read by validate.py)
import { readFileSync, writeFileSync } from 'node:fs'
import { computeEarthTrack } from '../web/src/core/communication.js'
import { VISIBLE_THRESHOLD } from '../web/src/core/geometry.js'
import { computeSunTrack } from '../web/src/core/sunlight.js'
import { fractionAtLeast } from '../web/src/core/timeSeries.js'

const DATA = new URL('../web/public/data/', import.meta.url)
const REGIONS = ['MAL', 'HAW', 'MMO', 'NR1', 'DGR', 'SLP', 'NR2', 'MMP'] // CAB lies outside 85-90 S
const CELLS_PER_REGION = 30
const PGDA_HALF_SIDE_M = 151740
const CELL_HALF_SIDE_M = 500 // the 1 km cell square must lie inside the PGDA 69 raster

const readJson = (name) => JSON.parse(readFileSync(new URL(name, DATA), 'utf8'))
const ephemeris = readJson('ephemeris.json')
const round4 = (value) => Math.round(value * 1e4) / 1e4
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length

// Three readings of "how visible": share of hours >= half disk (the app's rule), share with any part of the disk, mean disk fraction.
function summarize(diskFraction) {
  const hourCount = diskFraction.length
  return {
    halfDisk: round4(fractionAtLeast(diskFraction, VISIBLE_THRESHOLD, 0, hourCount)),
    anyPart: round4(diskFraction.filter((value) => value > 0).length / hourCount),
    meanDisk: round4(mean(diskFraction)),
  }
}

const result = {}
const started = Date.now()
for (const region of REGIONS) {
  const { cells } = readJson(`cells_${region}.json`)
  const inside = cells.filter((cell) => Math.max(Math.abs(cell.xM), Math.abs(cell.yM)) + CELL_HALF_SIDE_M <= PGDA_HALF_SIDE_M)
  const step = inside.length / CELLS_PER_REGION
  const sample = inside.length <= CELLS_PER_REGION ? inside : Array.from({ length: CELLS_PER_REGION }, (_, i) => inside[Math.floor(i * step)])
  for (const cell of sample) {
    const sun = summarize(computeSunTrack(cell, ephemeris, 0, ephemeris.hours).diskFraction)
    const earth = summarize(computeEarthTrack(cell, ephemeris, 0, ephemeris.hours).diskFraction)
    result[cell.id] = { region, xM: cell.xM, yM: cell.yM, sun, earth }
  }
  console.log(`${region}: ${sample.length} of ${inside.length} cells inside the PGDA square`)
}
writeFileSync(new URL('./out/our_visibility.json', import.meta.url), JSON.stringify(result))
console.log(`wrote pipeline/out/our_visibility.json, ${Object.keys(result).length} cells, ${((Date.now() - started) / 1000).toFixed(1)} s`)
