import assert from 'node:assert/strict'

export function assertNear(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${expected} ± ${tolerance}, got ${actual}`)
}

// Ephemeris with the same synthetic values every hour (test data, not real geometry).
export function constantEphemeris({ hours, sun = [0, 0, 1], earth = [0, 0, 384400], startTime = '2028-01-01T00:00Z' }) {
  const repeat = (value) => Array(hours).fill(value)
  return {
    startTime,
    stepHours: 1,
    hours,
    sunSubLonDeg: repeat(sun[0]),
    sunSubLatDeg: repeat(sun[1]),
    sunDistanceAu: repeat(sun[2]),
    earthSubLonDeg: repeat(earth[0]),
    earthSubLatDeg: repeat(earth[1]),
    earthDistanceKm: repeat(earth[2]),
  }
}

export const equatorCell = { id: 'TEST-a', label: 'a', lat: 0, lon: 0, heightM: 0, horizon: null, feasible: true }
