import { readFileSync } from 'node:fs'

let cached
export function getChatCatalog() {
  if (cached) return cached
  const read = (name) => JSON.parse(readFileSync(new URL(`../public/data/${name}.json`, import.meta.url), 'utf8'))
  const { startTime, stepHours, hours } = read('ephemeris')
  const { regions } = read('regions')
  cached = {
    sites: read('sites').sites.filter(({ lat, lon }) => Number.isFinite(lat) && Number.isFinite(lon)).map(({ id, name }) => ({ id, name })),
    cellIds: new Set(regions.flatMap(({ code }) => read(`cells_${code}`).cells.map(({ id }) => id))),
    ephemeris: { startTime, stepHours, hours },
  }
  return cached
}
