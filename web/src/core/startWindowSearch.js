// C5 — main-thread client for the worker. Call: const { promise, cancel } = startWindowSearch({...})
let nextRequestId = 1

export function startWindowSearch({ cells, ephemeris, scenario, onProgress }) {
  const worker = new Worker(new URL('./windowSearchWorker.js', import.meta.url), { type: 'module' })
  const requestId = nextRequestId++
  let rejectSearch
  const promise = new Promise((resolve, reject) => {
    rejectSearch = reject
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') onProgress?.(data.doneCells, data.totalCells)
      if (data.type === 'done') resolve(data.results)
      if (data.type === 'error') reject(new Error(data.message))
      if (data.type !== 'progress') worker.terminate()
    }
    worker.onerror = (event) => {
      reject(new Error(event.message || 'The search worker failed to start'))
      worker.terminate()
    }
  })
  worker.postMessage({ type: 'run', requestId, cells, ephemeris, scenario })
  const cancel = () => {
    worker.terminate()
    rejectSearch(new Error('Search cancelled'))
  }
  return { promise, cancel }
}
