import { cellDisplayName, currentPointSentence, formatDuration, formatUtc, hasNoTerrain, usesCapGrid } from '../core/format.js'
import { slipOutlook } from '../core/slip.js'
import { useI18n } from '../i18n/index.jsx'

const BORDER = { pass: 'border-emerald-500/60', marginal: 'border-amber-500/60', fail: 'border-red-500/60' }
const buttonClass = 'rounded border border-slate-500 px-3 py-1.5 text-sm transition-colors hover:bg-slate-800'

export default function CurrentPointCard({ summary, scenario, point, onSelectLanding, onOpenCell, results, landingIndex }) {
  const { t } = useI18n()
  const { metrics, nearestPassingLanding, nearestPassingCell } = summary
  const pointName = point ? cellDisplayName(point) : metrics.cellId
  const statusWord = {
    pass: t('status.pass'),
    marginal: t('status.marginal'),
    fail: t('status.fail'),
  }

  const bold = (value) => `**${value}**`
  const slip = slipOutlook(results, landingIndex)
  const slipText = slip.kind === 'canSlip'
    ? (slip.slipHours === 0
      ? t('slip.noSlack')
      : t('slip.canSlip', { duration: bold(formatDuration(slip.slipHours)), time: bold(formatUtc(slip.untilTime)) }) +
        (slip.reachesSearchEnd ? t('slip.orLonger') : ''))
    : (slip.nextLandingTime || slip.nearestCellId
      ? (slip.nextLandingTime ? t('slip.nextWindow', { time: bold(formatUtc(slip.nextLandingTime)), duration: bold(formatDuration(slip.hoursUntilNext)) }) : '') +
        (slip.nearestCellId ? t('slip.nearestCell', { cell: slip.nearestCellId, km: bold(slip.nearestCellDistanceKm.toFixed(1)) }) : '')
      : t('slip.none'))

  return (
    <section aria-labelledby="current-point-title" className={`rounded-lg border-2 bg-slate-900 p-4 ${BORDER[metrics.status]}`}>
      <h3 id="current-point-title" className="flex flex-wrap items-baseline gap-x-3 font-medium">
        {t('currentPoint.title')} <span className="font-mono">{pointName}</span>
        <span className="text-sm text-slate-300">{statusWord[metrics.status]}</span>
      </h3>
      <p className="mt-2 text-lg font-semibold text-slate-50">
        {slipText.trim().split('**').map((part, i) => (i % 2 ? <strong key={i} className="text-amber-300">{part}</strong> : part))}
      </p>
      <p className="mt-1 text-slate-100">{currentPointSentence(summary, scenario, pointName)}</p>
      {point && hasNoTerrain(point) && <p className="mt-1 text-xs text-slate-400">{t('currentPoint.noTerrain')}</p>}
      {point && usesCapGrid(point) && <p className="mt-1 text-xs text-slate-400">{t('currentPoint.capGrid')}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => onOpenCell(metrics.cellId)} className={buttonClass}>
          {t('currentPoint.detailsBtn')}
        </button>
        {metrics.status === 'fail' && nearestPassingLanding && (
          <button type="button" onClick={() => onSelectLanding(nearestPassingLanding.landingIndex)} className={buttonClass}>
            {t('currentPoint.goToTime', { time: formatUtc(nearestPassingLanding.landingTime) })}
          </button>
        )}
        {metrics.status === 'fail' && nearestPassingCell && (
          <button type="button" onClick={() => onOpenCell(nearestPassingCell.cellId)} className={buttonClass}>
            {t('currentPoint.openCell', { cellId: nearestPassingCell.cellId })}
          </button>
        )}
      </div>
    </section>
  )
}
