import { cloneElement } from 'react'
import { isPointComplete, LANDER_PRESETS, MAX_SEARCH_RADIUS_KM, PANEL_MODES, SEARCH_SCOPES } from '../core/scenario.js'
import { useI18n } from '../i18n/index.jsx'

const PRESET_FIELDS = ['maxDarkHours', 'maxCommLossHours', 'panelMaxW', 'batteryCapacityWh', 'loadW', 'panelMode']
const SIMPLE_MODE_FIELDS = new Set(['currentPoint', 'startDate', 'endDate', 'stayDays'])
const inputClass = 'w-full rounded border border-slate-500 bg-slate-950 px-2 py-1.5 tabular-nums aria-invalid:border-red-400'

function toNumberOrNull(text) {
  return text === '' ? null : Number(text)
}

export default function ScenarioForm({ mode, value, errors, sites, busy, onChange, onSubmit }) {
  const { t } = useI18n()
  const point = value.currentPoint
  const pointType = point?.type ?? 'cell'
  const update = (changes) => onChange({ ...value, ...changes })
  const errorFor = (field) => errors.find((error) => error.field === field)?.message
  const matchingPreset = LANDER_PRESETS.find((preset) => PRESET_FIELDS.every((field) => preset[field] === value[field]))
  const pointReady = isPointComplete(point)
  const canSubmit = !busy && errors.length === 0 && pointReady

  const pointTypes = [
    ['cell', t('scenario.pointTypes.cell')],
    ['site', t('scenario.pointTypes.site')],
    ['coordinates', t('scenario.pointTypes.coordinates')],
  ]
  const scopeLabels = {
    region: `${t('scenario.scopes.region')} ${t('scenario.scopeTime', { seconds: 5 })}`,
    radius: t('scenario.scopes.radius'),
    all: `${t('scenario.scopes.all')} ${t('scenario.scopeTime', { seconds: 20 })}`,
  }
  const panelLabels = {
    auto: t('scenario.panels.auto'),
    vertical: t('scenario.panels.vertical'),
    horizontal: t('scenario.panels.horizontal'),
  }
  const fieldLabels = {
    maxDarkHours: t('scenario.maxDarkHours'),
    maxCommLossHours: t('scenario.maxCommLossHours'),
    panelMaxW: t('scenario.panelMaxW'),
    batteryCapacityWh: t('scenario.batteryCapacityWh'),
    loadW: t('scenario.loadW'),
    panelMode: t('scenario.panelMode'),
    searchScope: t('scenario.searchScope'),
    searchRadiusKm: t('scenario.searchRadius'),
  }

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
      id="scenario-form"
      onSubmit={(event) => {
        event.preventDefault()
        if (canSubmit) onSubmit(value)
      }}
      className="space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-4"
      aria-labelledby="scenario-title"
    >
      <h2 id="scenario-title" className="font-medium">{t('scenario.title')}</h2>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm text-slate-300">{t('scenario.currentPoint')}</legend>
        <div className="flex flex-wrap gap-1" role="group" aria-label="How to give the point">
          {pointTypes.map(([type, label]) => (
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
            t('scenario.cellId'),
            'currentPoint',
            <input
              value={point?.cellId ?? ''}
              onChange={(event) => update({ currentPoint: { type: 'cell', cellId: event.target.value.trim() } })}
              placeholder={t('scenario.cellPlaceholder')}
              className={`${inputClass} font-mono`}
            />,
            t('scenario.cellHint'),
          )}
        {pointType === 'site' &&
          field(
            t('scenario.site'),
            'currentPoint',
            <select value={point?.siteId ?? ''} onChange={(event) => update({ currentPoint: { type: 'site', siteId: event.target.value } })} className={inputClass}>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>,
            t('scenario.siteHint'),
          )}
        {pointType === 'coordinates' && (
          <div className="grid grid-cols-2 gap-2">
            {field(t('scenario.lat'), 'currentPoint', coordinateInput('lat'))}
            {field(t('scenario.lon'), 'currentPoint', coordinateInput('lon'))}
          </div>
        )}
      </fieldset>

      <div className="grid grid-cols-2 items-end gap-2">
        {field(t('scenario.startDate'), 'startDate', <input type="date" value={value.startDate} onChange={(event) => update({ startDate: event.target.value })} className={inputClass} />)}
        {field(t('scenario.endDate'), 'endDate', <input type="date" value={value.endDate} onChange={(event) => update({ endDate: event.target.value })} className={inputClass} />)}
      </div>
      {numberField(t('scenario.stayDays'), 'stayDays', t('scenario.days'), { step: 1 })}

      {mode === 'simple' ? (
        field(
          t('scenario.lander'),
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
            {!matchingPreset && <option value="custom">{t('scenario.customPreset')}</option>}
          </select>,
          t('scenario.landerHint'),
        )
      ) : (
        <div className="grid grid-cols-2 items-end gap-2">
          {numberField(t('scenario.maxDarkHours'), 'maxDarkHours', 'h')}
          {numberField(t('scenario.maxCommLossHours'), 'maxCommLossHours', 'h')}
          {numberField(t('scenario.panelMaxW'), 'panelMaxW', 'W')}
          {numberField(t('scenario.batteryCapacityWh'), 'batteryCapacityWh', 'kWh', { scale: 1000 })}
          {numberField(t('scenario.loadW'), 'loadW', 'W')}
          {field(
            t('scenario.panelMode'),
            'panelMode',
            <select value={value.panelMode} onChange={(event) => update({ panelMode: event.target.value })} className={inputClass}>
              {PANEL_MODES.map((panelMode) => (
                <option key={panelMode} value={panelMode}>{panelLabels[panelMode]}</option>
              ))}
            </select>,
          )}
          {field(
            t('scenario.searchScope'),
            'searchScope',
            <select value={value.searchScope} onChange={(event) => update({ searchScope: event.target.value })} className={inputClass}>
              {SEARCH_SCOPES.map((scope) => (
                <option key={scope} value={scope}>{scopeLabels[scope]}</option>
              ))}
            </select>,
          )}
          {value.searchScope === 'radius' && numberField(`${t('scenario.searchRadius')} (${t('scenario.searchRadiusMax', { km: MAX_SEARCH_RADIUS_KM })})`, 'searchRadiusKm', 'km')}
          <label className="col-span-2 flex items-start gap-2 text-xs text-slate-300">
            <input type="checkbox" checked={value.requireDsn} onChange={(event) => update({ requireDsn: event.target.checked })} className="mt-0.5 accent-amber-400" />
            {t('scenario.requireDsn')}
          </label>
          <p className="col-span-2 text-xs text-slate-400">{t('scenario.scopeTimeNote')} {t('scenario.scopeCapNote')}</p>
        </div>
      )}

      <p className="text-xs text-slate-400">{t('scenario.exampleNote')}</p>
      {mode === 'simple' && errors.some((error) => !SIMPLE_MODE_FIELDS.has(error.field)) && (
        <ul className="space-y-0.5 text-xs text-red-400">
          {errors
            .filter((error) => !SIMPLE_MODE_FIELDS.has(error.field))
            .map((error) => (
              <li key={error.field}>
                {fieldLabels[error.field] ?? error.field}: {error.message} (change it in Expert mode)
              </li>
            ))}
        </ul>
      )}
      {!pointReady && <p className="text-xs text-slate-300">{t('scenario.choosePointPrompt')}</p>}
      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded bg-amber-400 px-3 py-2.5 lg:sticky lg:bottom-0 lg:z-10 lg:shadow-[0_0_0_8px_#0f172a] font-semibold text-slate-950 transition hover:bg-amber-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? t('scenario.searching') : t('scenario.findWindows')}
      </button>
    </form>
  )
}
