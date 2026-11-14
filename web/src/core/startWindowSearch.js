// C5 — main-thread client for the worker. Call: const { promise, cancel } = startWindowSearch({...})
let nextRequestId = 1

// One worker per job, terminated after 'done' or 'error'; cancel() terminates it and rejects with cancelMessage.
function runWorkerJob(message, onProgress, cancelMessage) {
  const worker = new Worker(new URL('./windowSearchWorker.js', import.meta.url), { type: 'module' })
  const requestId = nextRequestId++
  let rejectJob
  const promise = new Promise((resolve, reject) => {
    rejectJob = reject
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
  worker.postMessage({ ...message, requestId })
  const cancel = () => {
    worker.terminate()
    rejectJob(new Error(cancelMessage))
  }
  return { promise, cancel }
}

export function startWindowSearch({ cells, ephemeris, scenario, onProgress }) {
  return runWorkerJob({ type: 'run', cells, ephemeris, scenario }, onProgress, 'Search cancelled')
}

/** W2 map % layers: share of hours with the Sun / Earth in view per cell, in the same worker. Rejects with 'cancelled' on cancel(). */
export function startVisibilityFractions({ cells, ephemeris, firstHour, hourCount }) {
  return runWorkerJob({ type: 'fractions', cells, ephemeris, firstHour, hourCount }, null, 'cancelled')
}
