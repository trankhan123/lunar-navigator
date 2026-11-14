import { currentPointSentence, formatUtc } from '../core/format.js'

const BORDER = { pass: 'border-emerald-500/60', marginal: 'border-amber-500/60', fail: 'border-red-500/60' }
const WORD = { pass: '✓ Meets all limits', marginal: '! Meets limits, low battery', fail: '✕ Fails a limit' }
const buttonClass = 'rounded border border-slate-500 px-3 py-1.5 text-sm transition-colors hover:bg-slate-800'

export default function CurrentPointCard({ summary, scenario, onSelectLanding, onOpenCell }) {
  const { metrics, nearestPassingLanding, nearestPassingCell } = summary
  return (
    <section aria-labelledby="current-point-title" className={`rounded-lg border-2 bg-slate-900 p-4 ${BORDER[metrics.status]}`}>
      <h3 id="current-point-title" className="flex flex-wrap items-baseline gap-x-3 font-medium">
        Your current point <span className="font-mono">{metrics.cellId}</span>
        <span className="text-sm text-slate-300">{WORD[metrics.status]}</span>
      </h3>
      <p className="mt-1 text-slate-100">{currentPointSentence(summary, scenario)}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => onOpenCell(metrics.cellId)} className={buttonClass}>
          Details of my point
        </button>
        {metrics.status === 'fail' && nearestPassingLanding && (
          <button type="button" onClick={() => onSelectLanding(nearestPassingLanding.landingIndex)} className={buttonClass}>
            Go to {formatUtc(nearestPassingLanding.landingTime)}
          </button>
        )}
        {metrics.status === 'fail' && nearestPassingCell && (
          <button type="button" onClick={() => onOpenCell(nearestPassingCell.cellId)} className={buttonClass}>
            Open {nearestPassingCell.cellId}
          </button>
        )}
      </div>
    </section>
  )
}
