// C5 — Web Worker entry. Protocol: README "C5 Optimizer → Worker protocol".
// in:  {type:'run', requestId, cells, ephemeris, scenario}
// out: {type:'progress', requestId, doneCells, totalCells} | {type:'done', requestId, results} | {type:'error', requestId, message}
import { runWindowSearch } from './optimizer.js'

self.onmessage = ({ data }) => {
  const { requestId, cells, ephemeris, scenario } = data
  try {
    const results = runWindowSearch(cells, ephemeris, scenario, (doneCells, totalCells) =>
      self.postMessage({ type: 'progress', requestId, doneCells, totalCells }),
    )
    const buffers = Object.values(results).filter(ArrayBuffer.isView).map((array) => array.buffer)
    self.postMessage({ type: 'done', requestId, results }, buffers)
  } catch (error) {
    self.postMessage({ type: 'error', requestId, message: error.message })
  }
}
