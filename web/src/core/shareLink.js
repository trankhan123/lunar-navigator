// W1 — shareable link. Contract: README "W1 → Share link".
/* eslint-disable no-unused-vars -- stub parameters; delete this line when you implement the module */
import { notImplemented } from './notImplemented.js'

/**
 * @param {{scenario:Object, landingTime:string|null, selectedCellId:string|null, mode:'simple'|'expert', screen:string}} state
 * @returns {string} query string without '?', e.g. 'point=cell:MAL-r3c4&start=2028-01-01&…'
 */
export function encodeShareQuery(state) {
  throw notImplemented('W1', 'encodeShareQuery')
}

/** Inverse of encodeShareQuery; missing keys take DEFAULT_SCENARIO values. */
export function decodeShareQuery(queryString) {
  throw notImplemented('W1', 'decodeShareQuery')
}
