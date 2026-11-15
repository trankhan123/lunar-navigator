import { useState } from 'react'
import { CHAT_FIELDS } from '../core/missionChat.js'
import { GUIDE_FIELDS, missionFieldStatus, prepareGuidedRequest, recordEnteredFields } from '../core/missionGuide.js'
import { useI18n } from '../i18n/index.jsx'

const inputClass = 'w-full min-w-0 rounded border border-slate-500 bg-slate-950 px-2 py-2 text-sm aria-invalid:border-red-400'
const statusClass = {
  default: 'border-slate-600 bg-slate-800 text-slate-300',
  current: 'border-sky-800 bg-sky-950 text-sky-200',
  entered: 'border-emerald-700 bg-emerald-950 text-emerald-200',
  invalid: 'border-red-700 bg-red-950 text-red-200',
  missing: 'border-amber-700 bg-amber-950 text-amber-200',
}

export function ParameterStatus({ status }) {
  const { t } = useI18n()
  return <span className={`inline-block rounded border px-1.5 py-0.5 text-[11px] ${statusClass[status.kind]}`}>{t(`chat.status.${status.kind}`)}</span>
}

export default function MissionGuide({ scenario, sites, ephemeris, entered, disabled, onUse }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState({})
  const [units, setUnits] = useState({})
  const result = prepareGuidedRequest(values, units, scenario, ephemeris, sites)
  const sources = recordEnteredFields(entered, result.patch)
  const set = (field, value) => setValues((current) => ({ ...current, [field]: value }))

  function field(name, _label, control, hint) {
    const error = result.errors.find((error) => error.field === name)?.message
    const status = missionFieldStatus(name, result.scenario, sources, [...result.validation, ...result.errors])
    return <div key={name} className="space-y-1 rounded-lg border border-slate-700 bg-slate-900/80 p-3" data-guide-field={name}>
      <div className="flex flex-wrap items-center justify-between gap-1">
        <label htmlFor={`guide-${name}`} className="text-sm font-medium">{t(`chat.field.${name}`)}</label>
        <ParameterStatus status={status} />
      </div>
      {control(error)}
      <p className="text-xs text-slate-400">{hint}</p>
      {error && <p className="text-xs text-red-300">{error === 'Enter a number and choose its unit.' ? t('chat.invalidNumber') : error === 'Choose a site from the list.' ? t('chat.invalidSite') : error}</p>}
    </div>
  }

  return <div className="rounded-xl border border-sky-700 bg-sky-950/30 p-3">
    <button type="button" disabled={disabled} aria-expanded={open} aria-controls="mission-guide" onClick={() => setOpen(!open)}
      className="flex w-full items-center justify-between gap-2 text-left text-sm font-semibold text-sky-100 disabled:opacity-40">
      <span>{t('chat.help')} <span className="block text-xs font-normal text-sky-200">{t('chat.helpHint')}</span></span><span aria-hidden="true">{open ? '−' : '+'}</span>
    </button>
    {open && <form id="mission-guide" className="mt-3 space-y-3" onSubmit={(event) => {
      event.preventDefault()
      if (!disabled && result.message && result.errors.length === 0) {
        onUse(result.message)
        setOpen(false)
      }
    }}>
      <p className="text-xs text-slate-300">{t('chat.guideIntro')}</p>
      <fieldset disabled={disabled} className="space-y-2">
        {field('currentPoint', 'Where would you like to land?', (error) => <select id="guide-currentPoint" value={values.currentPoint ?? ''} onChange={(event) => set('currentPoint', event.target.value)} className={inputClass} aria-invalid={!!error}>
          <option value="">{t(scenario.currentPoint ? 'chat.keepPoint' : 'chat.chooseSite')}</option>
          {sites.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
        </select>, t('chat.pointHint'))}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {['startDate', 'endDate'].map((name) => field(name, '', (error) => <input id={`guide-${name}`} type="date" value={values[name] ?? ''} onChange={(event) => set(name, event.target.value)} className={inputClass} aria-invalid={!!error} />, t('chat.dateHint', { value: scenario[name] })))}
        </div>
        {Object.entries(GUIDE_FIELDS).map(([name, [label]]) => {
          const unit = units[name] ?? CHAT_FIELDS[name].unit
          const current = scenario[name] === null ? t('chat.notSet') : `${Number((scenario[name] / CHAT_FIELDS[name].units[unit]).toFixed(6))} ${unit}`
          return field(name, label, (error) => <div className="flex gap-2">
            <input id={`guide-${name}`} type="text" inputMode="decimal" value={values[name] ?? ''} placeholder={current} onChange={(event) => set(name, event.target.value)} className={inputClass} aria-invalid={!!error} />
            <select aria-label={`${t(`chat.field.${name}`)} ${t('chat.unit')}`} value={unit} onChange={(event) => setUnits((current) => ({ ...current, [name]: event.target.value }))} className="rounded border border-slate-500 bg-slate-950 px-2 text-sm">
              {Object.keys(CHAT_FIELDS[name].units).map((unit) => <option key={unit}>{unit}</option>)}
            </select>
          </div>, `${t(`chat.hint.${name}`)} ${t('chat.current', { value: current })}${name === 'searchRadiusKm' && result.scenario.searchScope !== 'radius' ? t('chat.inactive') : ''}`)
        })}
        {[
          ['panelMode', 'Solar panel orientation', [['auto', 'Automatic'], ['vertical', 'Vertical, Sun-tracking'], ['horizontal', 'Horizontal']]],
          ['searchScope', 'Where should we search?', [['region', 'Same region'], ['radius', 'Within a radius'], ['all', 'All 9 regions']]],
        ].map(([name, label, options]) => field(name, label, () => <select id={`guide-${name}`} value={values[name] ?? ''} onChange={(event) => set(name, event.target.value)} className={inputClass}>
          <option value="">{t('chat.keep', { value: t(`chat.${name === 'panelMode' ? 'orientation' : 'scope'}.${scenario[name]}`) })}</option>
          {options.map(([value]) => <option key={value} value={value}>{t(`chat.${name === 'panelMode' ? 'orientation' : 'scope'}.${value}`)}</option>)}
        </select>, t('chat.unsure')))}
      </fieldset>
      <button type="submit" disabled={disabled || !result.message || result.errors.length > 0} className="w-full rounded-lg bg-sky-300 px-3 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-40">{t('chat.generate')}</button>
      <p className="text-xs text-slate-400">{t('chat.generateHint')}</p>
    </form>}
  </div>
}
