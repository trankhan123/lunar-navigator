import { suggestWiderSearch } from '../core/widerSearch.js'
import { useI18n } from '../i18n/index.jsx'

export default function WiderSearchButton({ scenario, results, onSearch }) {
  const { t } = useI18n()
  if (scenario.searchScope !== 'region') return null
  const style = suggestWiderSearch(scenario, results)
    ? 'bg-amber-400 font-semibold text-slate-950 hover:bg-amber-300'
    : 'border border-slate-600 text-slate-200 hover:bg-slate-800'
  return (
    <button type="button" onClick={() => onSearch({ ...scenario, searchScope: 'radius', searchRadiusKm: 15 })} className={`rounded px-3 py-1.5 text-sm transition ${style}`}>
      {t('results.widerSearch')}
    </button>
  )
}
