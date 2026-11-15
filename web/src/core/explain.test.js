import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertNear } from './testHelpers.js'
import { compassName, explainDifference, findMostDifferentNeighbors } from './explain.js'

test('explainDifference: a site or custom point is named by its label, a grid cell by its id', () => {
  const cell = (id, label, lat) => ({ cell: { id, label, lat, lon: 0 }, metrics: { longestDarkHours: 5 } })
  assert.match(explainDifference(cell('MAL-a', 'MAL-a', -85), cell('SITE-apollo-11', 'Apollo 11', -85.01)), /^Moving [\d.]+ km to Apollo 11 /)
  assert.match(explainDifference(cell('MAL-a', 'MAL-a', -85), cell('CUSTOM', 'Custom point', -85.01)), /to Custom point /)
  assert.match(explainDifference(cell('SITE-x', 'X', -85), cell('MAL-b', 'MAL-b', -85.01)), /to MAL-b /)
})

test('compassName', () => {
  assert.equal(compassName(0), 'north')
  assert.equal(compassName(45), 'north-east')
  assert.equal(compassName(90), 'east')
  assert.equal(compassName(135), 'south-east')
  assert.equal(compassName(180), 'south')
  assert.equal(compassName(225), 'south-west')
  assert.equal(compassName(270), 'west')
  assert.equal(compassName(315), 'north-west')
  assert.equal(compassName(350), 'north')
  assert.equal(compassName(360), 'north')
  assert.equal(compassName(-90), 'west')
})

test('explainDifference: cuts longest dark period when ridge is lower', () => {
  // Current cell has high northern ridge (20 in units of 0.1° = 2.0°)
  const currentHorizon = new Array(360).fill(0)
  currentHorizon[0] = 20 // 2.0° at north

  // Other cell has lower northern ridge (5 in units of 0.1° = 0.5°)
  const otherHorizon = new Array(360).fill(0)
  otherHorizon[0] = 5 // 0.5° at north

  // Cell coordinates with distance 2.3 km:
  // on Moon (R = 1737.4 km), deltaLat = (2.3 / 1737.4) * (180 / Math.PI) ~ 0.07583°
  const currentCell = { id: 'MAL-r4c4', lat: -85.925, lon: -1.205, heightM: 4600, horizon: currentHorizon }
  const otherCell = {
    id: 'MAL-r4c5',
    lat: -85.925 + (2.3 / 1737.4) * (180 / Math.PI),
    lon: -1.205,
    heightM: 4980,
    horizon: otherHorizon,
  }

  // 1-hour window at startIndex 0:
  // Sun is at elevation 1.0° (above other's 0.5° horizon, below current's 2.0° horizon)
  const currentSunTrack = {
    azimuthDeg: new Float32Array([0]),
    elevationDeg: new Float32Array([1.0]),
    diskFraction: new Float32Array([0.0]), // dark
  }
  const otherSunTrack = {
    azimuthDeg: new Float32Array([0]),
    elevationDeg: new Float32Array([1.0]),
    diskFraction: new Float32Array([1.0]), // sunlit
  }

  const current = {
    cell: currentCell,
    metrics: { longestDarkHours: 72 },
    sunTrack: currentSunTrack,
    startIndex: 0,
    lengthHours: 1,
  }
  const other = {
    cell: otherCell,
    metrics: { longestDarkHours: 10 },
    sunTrack: otherSunTrack,
    startIndex: 0,
    lengthHours: 1,
  }

  const explanation = explainDifference(current, other)
  assert.equal(
    explanation,
    'Moving 2.3 km to MAL-r4c5 cuts the longest dark period from 72 h to 10 h, because the northern ridge is 1.5° lower there, right where the Sun is in those hours.',
  )
})

test('explainDifference: increases dark period when ridge is higher', () => {
  const currentHorizon = new Array(360).fill(0)
  currentHorizon[0] = 5

  const otherHorizon = new Array(360).fill(0)
  otherHorizon[0] = 20

  const currentCell = {
    id: 'MAL-r4c5',
    lat: -85.925 + (2.3 / 1737.4) * (180 / Math.PI),
    lon: -1.205,
    heightM: 4980,
    horizon: currentHorizon,
  }
  const otherCell = { id: 'MAL-r4c4', lat: -85.925, lon: -1.205, heightM: 4600, horizon: otherHorizon }

  const currentSunTrack = {
    azimuthDeg: new Float32Array([0]),
    elevationDeg: new Float32Array([1.0]),
    diskFraction: new Float32Array([1.0]), // sunlit
  }
  const otherSunTrack = {
    azimuthDeg: new Float32Array([0]),
    elevationDeg: new Float32Array([1.0]),
    diskFraction: new Float32Array([0.0]), // dark
  }

  const current = {
    cell: currentCell,
    metrics: { longestDarkHours: 10 },
    sunTrack: currentSunTrack,
    startIndex: 0,
    lengthHours: 1,
  }
  const other = {
    cell: otherCell,
    metrics: { longestDarkHours: 72 },
    sunTrack: otherSunTrack,
    startIndex: 0,
    lengthHours: 1,
  }

  const explanation = explainDifference(current, other)
  assert.equal(
    explanation,
    'Moving 2.3 km to MAL-r4c4 increases the longest dark period from 10 h to 72 h, because the northern ridge is 1.5° higher there, right where the Sun is in those hours.',
  )
})

test('findMostDifferentNeighbors: finds the pair with largest dark hours difference within radius', () => {
  // Cells at equator for simple distance: 1 deg lon = ~30.3 km, 0.03 deg lon = ~0.91 km
  const cellA = { id: 'TEST-A', lat: 0, lon: 0, horizon: [0] }
  const cellB = { id: 'TEST-B', lat: 0, lon: 0.03, horizon: [0] } // ~0.91 km from A
  const cellC = { id: 'TEST-C', lat: 0, lon: 0.2, horizon: [0] } // ~6.06 km from A and B

  const cellsById = {
    'TEST-A': cellA,
    'TEST-B': cellB,
    'TEST-C': cellC,
  }

  const results = {
    cellCount: 3,
    landingCount: 2,
    cellIds: ['TEST-A', 'TEST-B', 'TEST-C'],
    // At landingIndex 0:
    // TEST-A has 10 h, TEST-B has 40 h (diff 30 h, dist ~0.91 km)
    // TEST-C has 100 h (diff with A is 90 h, but dist > 1.5 km)
    longestDarkHours: new Uint16Array([
      10, 0, // A
      40, 0, // B
      100, 0, // C
    ]),
  }

  const neighborPair = findMostDifferentNeighbors(results, cellsById, 0, 1.5)
  assert.ok(neighborPair !== null)
  assert.equal(neighborPair.cellIdA, 'TEST-A')
  assert.equal(neighborPair.cellIdB, 'TEST-B')
  assert.equal(neighborPair.longestDarkHoursA, 10)
  assert.equal(neighborPair.longestDarkHoursB, 40)
  assertNear(neighborPair.distanceKm, 0.91, 0.05)

  // Works with Map as well
  const cellsMap = new Map(Object.entries(cellsById))
  const neighborPairFromMap = findMostDifferentNeighbors(results, cellsMap, 0, 1.5)
  assert.deepEqual(neighborPairFromMap, neighborPair)

  // Max distance too small returns null
  const none = findMostDifferentNeighbors(results, cellsById, 0, 0.5)
  assert.equal(none, null)
})

test('explainDifference: formats floating-point inputs cleanly without decimal tail artifacts', () => {
  // Input values with binary floating-point representation quirks:
  // 1.8 - 0.3 = 1.5000000000000002
  // 5.3 - 2.1 = 3.2000000000000006
  // 2.4 - 1.2 = 1.2000000000000002
  const currentHorizon = new Array(360).fill(0)
  currentHorizon[0] = 18 // 1.8°

  const otherHorizon = new Array(360).fill(0)
  otherHorizon[0] = 3 // 0.3° (ridge diff: 1.8 - 0.3 = 1.5°)

  const currentCell = { id: 'MAL-r4c4', lat: -85.925, lon: -1.205, horizon: currentHorizon }
  const otherCell = {
    id: 'MAL-r4c5',
    lat: -85.925 + (2.3 / 1737.4) * (180 / Math.PI),
    lon: -1.205,
    horizon: otherHorizon,
  }

  const current = {
    cell: currentCell,
    metrics: { longestDarkHours: 5.3 - 2.1 }, // 3.2000000000000006
    sunTrack: {
      azimuthDeg: new Float32Array([0]),
      diskFraction: new Float32Array([0.0]),
    },
    startIndex: 0,
    lengthHours: 1,
  }
  const other = {
    cell: otherCell,
    metrics: { longestDarkHours: 2.4 - 1.2 }, // 1.2000000000000002
    sunTrack: {
      azimuthDeg: new Float32Array([0]),
      diskFraction: new Float32Array([1.0]),
    },
    startIndex: 0,
    lengthHours: 1,
  }

  const text = explainDifference(current, other)
  assert.equal(
    text,
    'Moving 2.3 km to MAL-r4c5 cuts the longest dark period from 3.2 h to 1.2 h, because the northern ridge is 1.5° lower there, right where the Sun is in those hours.',
  )
  assert.ok(!text.includes('.00000'))
  assert.ok(!text.includes('.20000'))
})
