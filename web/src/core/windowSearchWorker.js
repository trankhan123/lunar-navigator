// C5 — Web Worker entry. Protocol: README "C5 Optimizer → Worker protocol".
// in:  {type:'run', requestId, cells, ephemeris, scenario}
//      {type:'fractions', requestId, cells, ephemeris, firstHour, hourCount}   (W2 map % layers)
// out: {type:'progress', requestId, doneCells, totalCells} (run only) | {type:'done', requestId, results} | {type:'error', requestId, message}
import { computeVisibilityFractions } from './mapSky.js'
import { runWindowSearch } from './optimizer.js'

self.onmessage = ({ data }) => {
  const { type, requestId, cells, ephemeris } = data
  try {
    const results =
      type === 'fractions'
        ? computeVisibilityFractions(cells, ephemeris, data.firstHour, data.hourCount)
        : runWindowSearch(cells, ephemeris, data.scenario, (doneCells, totalCells) =>
            self.postMessage({ type: 'progress', requestId, doneCells, totalCells }),
          )
    const buffers = Object.values(results).filter(ArrayBuffer.isView).map((array) => array.buffer)
    self.postMessage({ type: 'done', requestId, results }, [...new Set(buffers)]) // a buffer may back several arrays
  } catch (error) {
    self.postMessage({ type: 'error', requestId, message: error.message })
  }
}
