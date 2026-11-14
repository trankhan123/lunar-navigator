// C5 — main-thread client for the worker. Call: const { promise, cancel } = startWindowSearch({...})
let nextRequestId = 1

export function startWindowSearch({ cells, ephemeris, scenario, onProgress }) {
  const worker = new Worker(new URL('./windowSearchWorker.js', import.meta.url), { type: 'module' })
  const requestId = nextRequestId++
  const promise = new Promise((resolve, reject) => {
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') onProgress?.(data.doneCells, data.totalCells)
      if (data.type === 'done') resolve(data.results)
      if (data.type === 'error') reject(new Error(data.message))
      if (data.type !== 'progress') worker.terminate()
    }
    worker.onerror = (event) => {
      reject(new Error(event.message))
      worker.terminate()
    }
  })
  worker.postMessage({ type: 'run', requestId, cells, ephemeris, scenario })
  return { promise, cancel: () => worker.terminate() }
}
