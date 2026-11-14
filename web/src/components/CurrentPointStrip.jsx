// Index = STATUS code from core/optimizer.js: fail, marginal, pass.
const STATUS_COLORS = ['#ef4444', '#f59e0b', '#10b981']

// Consecutive landing times with the same status become one rectangle.
function statusRuns(statuses) {
  const runs = []
  statuses.forEach((status, index) => {
    const last = runs[runs.length - 1]
    if (last && last.status === status) last.length++
    else runs.push({ status, start: index, length: 1 })
  })
  return runs
}

export default function CurrentPointStrip({ statuses, value, onSelectLanding }) {
  const count = statuses.length
  const passCount = statuses.reduce((total, status) => total + (status > 0 ? 1 : 0), 0)
  return (
    <figure>
      <figcaption className="mb-1 text-xs text-slate-400">
        Your current point over the whole date range: {passCount} of {count} landing times meet the limits. Click the strip to jump.
      </figcaption>
      <svg
        viewBox={`0 0 ${count} 10`}
        preserveAspectRatio="none"
        className="h-6 w-full cursor-pointer rounded"
        aria-hidden="true"
        onClick={(event) => {
          const box = event.currentTarget.getBoundingClientRect()
          onSelectLanding(Math.min(count - 1, Math.floor(((event.clientX - box.left) / box.width) * count)))
        }}
      >
        {statusRuns(statuses).map((run) => (
          <rect key={run.start} x={run.start} y={0} width={run.length} height={10} fill={STATUS_COLORS[run.status]} />
        ))}
        <rect x={value} y={0} width={Math.max(1, count / 200)} height={10} fill="#f8fafc" />
      </svg>
    </figure>
  )
}
