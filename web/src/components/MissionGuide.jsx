import { useState } from 'react'
import { CHAT_FIELDS } from '../core/missionChat.js'
import { GUIDE_FIELDS, missionFieldStatus, prepareGuidedRequest, recordEnteredFields } from '../core/missionGuide.js'

const inputClass = 'w-full min-w-0 rounded border border-slate-500 bg-slate-950 px-2 py-2 text-sm aria-invalid:border-red-400'
const statusClass = {
  default: 'border-slate-600 bg-slate-800 text-slate-300',
  current: 'border-sky-800 bg-sky-950 text-sky-200',
  entered: 'border-emerald-700 bg-emerald-950 text-emerald-200',
  invalid: 'border-red-700 bg-red-950 text-red-200',
  missing: 'border-amber-700 bg-amber-950 text-amber-200',
}

export function ParameterStatus({ status }) {
  return <span className={`inline-block rounded border px-1.5 py-0.5 text-[11px] ${statusClass[status.kind]}`}>{status.label}</span>
}

export default function MissionGuide({ scenario, sites, ephemeris, entered, disabled, onUse }) {
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState({})
  const [units, setUnits] = useState({})
  const result = prepareGuidedRequest(values, units, scenario, ephemeris, sites)
  const sources = recordEnteredFields(entered, result.patch)
  const set = (field, value) => setValues((current) => ({ ...current, [field]: value }))

  function field(name, label, control, hint) {
    const error = result.errors.find((error) => error.field === name)?.message
    const status = missionFieldStatus(name, result.scenario, sources, [...result.validation, ...result.errors])
    return <div key={name} className="space-y-1 rounded-lg border border-slate-700 bg-slate-900/80 p-3" data-guide-field={name}>
      <div className="flex flex-wrap items-center justify-between gap-1">
        <label htmlFor={`guide-${name}`} className="text-sm font-medium">{label}</label>
        <ParameterStatus status={status} />
      </div>
      {control(error)}
      <p className="text-xs text-slate-400">{hint}</p>
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  }

  return <div className="rounded-xl border border-sky-700 bg-sky-950/30 p-3">
    <button type="button" disabled={disabled} aria-expanded={open} aria-controls="mission-guide" onClick={() => setOpen(!open)}
      className="flex w-full items-center justify-between gap-2 text-left text-sm font-semibold text-sky-100 disabled:opacity-40">
      <span>Help me get started <span className="block text-xs font-normal text-sky-200">Fill in a few details — no prompt needed</span></span><span aria-hidden="true">{open ? '−' : '+'}</span>
    </button>
    {open && <form id="mission-guide" className="mt-3 space-y-3" onSubmit={(event) => {
      event.preventDefault()
      if (!disabled && result.message && result.errors.length === 0) {
        onUse(result.message)
        setOpen(false)
      }
    }}>
      <p className="text-xs text-slate-300">Fill only what you know. Blank fields keep the values shown. These are examples, not spacecraft recommendations.</p>
      <fieldset disabled={disabled} className="space-y-2">
        {field('currentPoint', 'Where would you like to land?', (error) => <select id="guide-currentPoint" value={values.currentPoint ?? ''} onChange={(event) => set('currentPoint', event.target.value)} className={inputClass} aria-invalid={!!error}>
          <option value="">{scenario.currentPoint ? 'Keep the point from my form' : 'Choose a landing site…'}</option>
          {sites.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
        </select>, 'You can also choose a point on the map or ask the assistant.')}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {['startDate', 'endDate'].map((name) => field(name, name === 'startDate' ? 'Earliest landing (UTC)' : 'Latest landing (UTC)', (error) => <input id={`guide-${name}`} type="date" value={values[name] ?? ''} onChange={(event) => set(name, event.target.value)} className={inputClass} aria-invalid={!!error} />, `Current: ${scenario[name]}. Include the year.`))}
        </div>
        {Object.entries(GUIDE_FIELDS).map(([name, [label, hint]]) => {
          const unit = units[name] ?? CHAT_FIELDS[name].unit
          const current = scenario[name] === null ? 'not set' : `${Number((scenario[name] / CHAT_FIELDS[name].units[unit]).toFixed(6))} ${unit}`
          return field(name, label, (error) => <div className="flex gap-2">
            <input id={`guide-${name}`} type="text" inputMode="decimal" value={values[name] ?? ''} placeholder={current} onChange={(event) => set(name, event.target.value)} className={inputClass} aria-invalid={!!error} />
            <select aria-label={`${label} unit`} value={unit} onChange={(event) => setUnits((current) => ({ ...current, [name]: event.target.value }))} className="rounded border border-slate-500 bg-slate-950 px-2 text-sm">
              {Object.keys(CHAT_FIELDS[name].units).map((unit) => <option key={unit}>{unit}</option>)}
            </select>
          </div>, `${hint} Current: ${current}${name === 'searchRadiusKm' && result.scenario.searchScope !== 'radius' ? ' (inactive for this search scope)' : ''}.`)
        })}
        {[
          ['panelMode', 'Solar panel orientation', [['auto', 'Automatic'], ['vertical', 'Vertical, Sun-tracking'], ['horizontal', 'Horizontal']]],
          ['searchScope', 'Where should we search?', [['region', 'Same region'], ['radius', 'Within a radius'], ['all', 'All 9 regions']]],
        ].map(([name, label, options]) => field(name, label, () => <select id={`guide-${name}`} value={values[name] ?? ''} onChange={(event) => set(name, event.target.value)} className={inputClass}>
          <option value="">Keep current: {options.find(([value]) => value === scenario[name])?.[1]}</option>
          {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
        </select>, 'Leave unchanged if you are unsure.'))}
      </fieldset>
      <button type="submit" disabled={disabled || !result.message || result.errors.length > 0} className="w-full rounded-lg bg-sky-300 px-3 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-40">Use these details in chat</button>
      <p className="text-xs text-slate-400">This prepares a message below. You review it and choose Send message.</p>
    </form>}
  </div>
}
