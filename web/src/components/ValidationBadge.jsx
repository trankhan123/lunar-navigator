import { useEffect, useState } from 'react'
import { loadValidation } from '../core/data.js'
import { validationSummary } from '../core/validationStats.js'
import { useI18n } from '../i18n/index.jsx'

// Small chip linking to the About validation section; renders nothing while loading or when data is missing.
export default function ValidationBadge({ onOpenAbout }) {
  const { t } = useI18n()
  const [summary, setSummary] = useState(null)
  useEffect(() => {
    loadValidation(false)
      .then((validation) => setSummary(validationSummary(validation)))
      .catch(() => setSummary(null))
  }, [])
  if (!summary || summary.sunR === null || summary.earthR === null || summary.horizonsMaxDeg === null) return null
  return (
    <button
      type="button"
      onClick={onOpenAbout}
      className="rounded-full border border-emerald-700 bg-emerald-950/40 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-900/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
    >
      {t('validation.badge', { r: Math.min(summary.sunR, summary.earthR).toFixed(2), cells: summary.cellCount, deg: summary.horizonsMaxDeg.toFixed(3) })}
    </button>
  )
}
