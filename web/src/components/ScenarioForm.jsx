import { cloneElement } from 'react'
import { LANDER_PRESETS, PANEL_MODES, SEARCH_SCOPES } from '../core/scenario.js'

const PRESET_FIELDS = ['maxDarkHours', 'maxCommLossHours', 'panelMaxW', 'batteryCapacityWh', 'loadW', 'panelMode']
const POINT_TYPES = [
  ['cell', 'Grid cell'],
  ['site', 'Famous site'],
  ['coordinates', 'Coordinates'],
]
const SCOPE_LABELS = { region: 'Same region', radius: 'Within a radius', all: 'All 9 regions' }
const PANEL_LABELS = { auto: 'Automatic', vertical: 'Vertical, Sun-tracking', horizontal: 'Horizontal' }
// Fields Simple mode shows; errors on any other field are listed above the Submit button there.
const SIMPLE_MODE_FIELDS = new Set(['currentPoint', 'startDate', 'endDate', 'stayDays'])
const FIELD_LABELS = {
  maxDarkHours: 'Longest dark period allowed',
  maxCommLossHours: 'Longest comm loss allowed',
  panelMaxW: 'Panel power',
  batteryCapacityWh: 'Battery capacity',
  loadW: 'Average load',
  panelMode: 'Solar panel',
  searchScope: 'Search',
  searchRadiusKm: 'Search radius',
}
const inputClass = 'w-full rounded border border-slate-500 bg-slate-950 px-2 py-1.5 tabular-nums aria-invalid:border-red-400'

function toNumberOrNull(text) {
  return text === '' ? null : Number(text)
}

function isPointComplete(point) {
  if (!point) return false
  if (point.type === 'cell') return Boolean(point.cellId)
  if (point.type === 'site') return Boolean(point.siteId)
  return Number.isFinite(point.lat) && Number.isFinite(point.lon)
}

export default function ScenarioForm({ mode, value, errors, sites, busy, onChange, onSubmit }) {
  const point = value.currentPoint
  const pointType = point?.type ?? 'cell'
  const update = (changes) => onChange({ ...value, ...changes })
  const errorFor = (field) => errors.find((error) => error.field === field)?.message
  const matchingPreset = LANDER_PRESETS.find((preset) => PRESET_FIELDS.every((field) => preset[field] === value[field]))
  const pointReady = isPointComplete(point)
  const canSubmit = !busy && errors.length === 0 && pointReady

  // The error sits inside the <label>, so screen readers read it with the field; aria-invalid marks the field itself.
  function field(label, name, input, hint) {
    const error = errorFor(name)
    return (
      <label className="block text-sm">
        <span className="mb-1 block text-slate-300">{label}</span>
        {cloneElement(input, { 'aria-invalid': error ? true : undefined })}
        {hint && <span className="mt-0.5 block text-xs text-slate-400">{hint}</span>}
        {error && <span className="mt-0.5 block text-xs text-red-400">{error}</span>}
      </label>
    )
  }

  function numberField(label, name, unit, { scale = 1, step = 'any' } = {}) {
    const shown = value[name] === null ? '' : value[name] / scale
    return field(
      `${label} (${unit})`,
      name,
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={Number.isFinite(shown) ? shown : ''}
        onChange={(event) => {
          const number = toNumberOrNull(event.target.value)
          update({ [name]: number === null ? null : number * scale })
        }}
        className={inputClass}
      />,
    )
  }

  function coordinateInput(axis) {
    return (
      <input
        type="number"
        step="any"
        value={point?.[axis] ?? ''}
        onChange={(event) => update({ currentPoint: { ...point, type: 'coordinates', [axis]: toNumberOrNull(event.target.value) } })}
        className={inputClass}
      />
    )
  }

  function changePointType(type) {
    if (type === pointType) return
    if (type === 'cell') update({ currentPoint: { type: 'cell', cellId: '' } })
    if (type === 'site') update({ currentPoint: { type: 'site', siteId: sites[0]?.id ?? '' } })
    if (type === 'coordinates') update({ currentPoint: { type: 'coordinates', lat: null, lon: null } })
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (canSubmit) onSubmit(value)
      }}
      className="space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-4"
      aria-labelledby="scenario-title"
    >
      <h2 id="scenario-title" className="font-medium">Mission scenario</h2>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm text-slate-300">Current landing point</legend>
        <div className="flex flex-wrap gap-1" role="group" aria-label="How to give the point">
          {POINT_TYPES.map(([type, label]) => (
            <button
              key={type}
              type="button"
              aria-pressed={pointType === type}
              onClick={() => changePointType(type)}
              className={`rounded px-3 py-2 text-sm transition-colors ${pointType === type ? 'bg-slate-100 text-slate-900' : 'border border-slate-500 text-slate-300 hover:bg-slate-800'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {pointType === 'cell' &&
          field(
            'Cell ID',
            'currentPoint',
            <input
              value={point?.cellId ?? ''}
              onChange={(event) => update({ currentPoint: { type: 'cell', cellId: event.target.value.trim() } })}
              placeholder="e.g. MAL-r5c4"
              className={`${inputClass} font-mono`}
            />,
            'Select a cell on the map, or type its ID.',
          )}
        {pointType === 'site' &&
          field(
            'Site',
            'currentPoint',
            <select value={point?.siteId ?? ''} onChange={(event) => update({ currentPoint: { type: 'site', siteId: event.target.value } })} className={inputClass}>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>,
            'Sites without terrain data use a smooth-sphere horizon.',
          )}
        {pointType === 'coordinates' && (
          <div className="grid grid-cols-2 gap-2">
            {field('Latitude (°N)', 'currentPoint', coordinateInput('lat'))}
            {field('Longitude (°E)', 'currentPoint', coordinateInput('lon'))}
          </div>
        )}
      </fieldset>

      <div className="grid grid-cols-2 items-end gap-2">
        {field('First landing date (UTC)', 'startDate', <input type="date" value={value.startDate} onChange={(event) => update({ startDate: event.target.value })} className={inputClass} />)}
        {field('Last landing date (UTC)', 'endDate', <input type="date" value={value.endDate} onChange={(event) => update({ endDate: event.target.value })} className={inputClass} />)}
      </div>
      {numberField('Stay on the surface', 'stayDays', 'days', { step: 1 })}

      {mode === 'simple' ? (
        field(
          'Lander',
          'preset',
          <select
            value={matchingPreset?.id ?? 'custom'}
            onChange={(event) => {
              const preset = LANDER_PRESETS.find((candidate) => candidate.id === event.target.value)
              if (preset) update(Object.fromEntries(PRESET_FIELDS.map((name) => [name, preset[name]])))
            }}
            className={inputClass}
          >
            {LANDER_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>{preset.label}</option>
            ))}
            {!matchingPreset && <option value="custom">Custom (set in Expert mode)</option>}
          </select>,
          'Switch to Expert mode to set every limit.',
        )
      ) : (
        <div className="grid grid-cols-2 items-end gap-2">
          {numberField('Longest dark period allowed', 'maxDarkHours', 'h')}
          {numberField('Longest comm loss allowed', 'maxCommLossHours', 'h')}
          {numberField('Panel power at full Sun', 'panelMaxW', 'W')}
          {numberField('Battery capacity', 'batteryCapacityWh', 'kWh', { scale: 1000 })}
          {numberField('Average load', 'loadW', 'W')}
          {field(
            'Solar panel',
            'panelMode',
            <select value={value.panelMode} onChange={(event) => update({ panelMode: event.target.value })} className={inputClass}>
              {PANEL_MODES.map((panelMode) => (
                <option key={panelMode} value={panelMode}>{PANEL_LABELS[panelMode]}</option>
              ))}
            </select>,
          )}
          {field(
            'Search',
            'searchScope',
            <select value={value.searchScope} onChange={(event) => update({ searchScope: event.target.value })} className={inputClass}>
              {SEARCH_SCOPES.map((scope) => (
                <option key={scope} value={scope}>{SCOPE_LABELS[scope]}</option>
              ))}
            </select>,
          )}
          {value.searchScope === 'radius' && numberField('Search radius', 'searchRadiusKm', 'km')}
        </div>
      )}

      <p className="text-xs text-slate-400">Example values are illustrative, not the specification of any real lander.</p>
      {mode === 'simple' && errors.some((error) => !SIMPLE_MODE_FIELDS.has(error.field)) && (
        <ul className="space-y-0.5 text-xs text-red-400">
          {errors
            .filter((error) => !SIMPLE_MODE_FIELDS.has(error.field))
            .map((error) => (
              <li key={error.field}>
                {FIELD_LABELS[error.field] ?? error.field}: {error.message} (change it in Expert mode)
              </li>
            ))}
        </ul>
      )}
      {!pointReady && <p className="text-xs text-slate-300">Choose a cell, a site or coordinates first.</p>}
      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded bg-amber-400 px-3 py-2.5 font-semibold text-slate-950 transition hover:bg-amber-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? 'Searching…' : 'Find landing windows'}
      </button>
    </form>
  )
}
