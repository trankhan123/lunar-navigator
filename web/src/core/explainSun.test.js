// explainDifference looks at the Sun's azimuth (WF3 step 3). Every cell and track here is SYNTHETIC, not real lunar data.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { explainDifference } from './explain.js'

const ridgeAt = (azimuth, tenths) => Object.assign(new Array(360).fill(0), { [azimuth]: tenths })
const track = (azimuths, fractions) => ({ azimuthDeg: new Float32Array(azimuths), diskFraction: new Float32Array(fractions) })
const windowOf = (id, horizon, longestDarkHours, sunTrack) => ({
  cell: { id, lat: -85.9, lon: 0, horizon }, metrics: { longestDarkHours }, sunTrack, startIndex: 0, lengthHours: sunTrack.azimuthDeg.length,
})

test('explainDifference: names the ridge in the direction the Sun is in during the hours only one cell is lit', () => {
  // The Sun is in the south-east for 3 hours; the darker cell has a 2.0° ridge there, the brighter one 0.5°.
  const darker = windowOf('A', ridgeAt(135, 20), 80, track([135, 135, 135], [0, 0.2, 0]))
  const brighter = windowOf('B', ridgeAt(135, 5), 20, track([135, 135, 135], [1, 1, 1]))
  assert.match(explainDifference(brighter, darker), /because the south-eastern ridge is 1\.5° higher there, right where the Sun is in those hours\.$/)
})

test('explainDifference: a bigger horizon difference where the Sun never goes is not named', () => {
  // 8° ridge difference in the north, but the Sun is only in the south during the hours that matter.
  const darker = windowOf('A', Object.assign(ridgeAt(0, 80), { 180: 10 }), 80, track([180, 180], [0, 0]))
  const brighter = windowOf('B', ridgeAt(180, 4), 20, track([180, 180], [1, 1]))
  const text = explainDifference(brighter, darker)
  assert.match(text, /southern ridge is 0\.6° higher/)
  assert.ok(!text.includes('northern'), text)
})

test('explainDifference: no hours with one dark and one lit cell means no ridge sentence', () => {
  const same = track([90, 90], [1, 1])
  const text = explainDifference(windowOf('A', ridgeAt(90, 50), 12, same), windowOf('B', ridgeAt(90, 0), 12, same))
  assert.ok(!text.includes('ridge'), text)
  assert.match(text, /both cells see the Sun at the same hours/)
  assert.match(text, /Earth visibility or the battery/)
})

test('explainDifference: without Sun tracks it states the numbers only', () => {
  const text = explainDifference(windowOf('A', ridgeAt(0, 50), 20, track([0], [1])), { cell: { id: 'B', lat: -85.9, lon: 0 }, metrics: { longestDarkHours: 80 } })
  assert.equal(text, 'Moving 0 km to B increases the longest dark period from 20 h to 80 h.')
})
