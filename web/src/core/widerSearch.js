import { STATUS } from './optimizer.js'

export const WIDER_SEARCH_PASS_FRACTION = 0.2

// True when a region-only search found few passing slots, so searching around the point may help.
export function suggestWiderSearch(scenario, results) {
  if (scenario.searchScope !== 'region') return false
  const slotCount = results.cellCount * results.landingCount
  if (slotCount === 0) return false
  let passingSlots = 0
  for (let slot = 0; slot < slotCount; slot++) if (results.status[slot] !== STATUS.fail) passingSlots++
  return passingSlots / slotCount < WIDER_SEARCH_PASS_FRACTION
}
