import { useState } from 'react'
import { useI18n } from '../i18n/index.jsx'
import { MAP_LAYERS, MAP_OVERLAYS } from '../core/mapLayers.js'

const UNAVAILABLE_HINTS = { hour: 'map.hintHour', dates: 'map.hintDates', search: 'map.hintSearch' }

// availability: {hour, dates, search} booleans; a layer whose `needs` is unmet stays visible but disabled, with the reason.
// overlays: {[kind]: {enabled, opacity}}; overlayKinds: the image layers this data set has.
export default function MapLayersPanel({ layerId, onLayerChange, availability, overlays, overlayKinds, onOverlayChange }) {
  const { t } = useI18n()
  // Open beside the map on laptops, folded under it on phones (spec §5.1).
  const [open, setOpen] = useState(() => window.matchMedia('(min-width: 768px)').matches)
  const activeLabel = MAP_LAYERS.find((layer) => layer.id === layerId).label
  return (
    <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)} className="h-fit">
    <summary className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 text-sm">
      {t('map.layers')} <span className="text-slate-400">· {activeLabel}</span>
    </summary>
    <div className="mt-2 space-y-3">
    <fieldset className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm">
      <legend className="px-1 text-slate-300">{t('map.colourBy')}</legend>
      {MAP_LAYERS.map((layer) => {
        const isAvailable = !layer.needs || availability[layer.needs]
        return (
          <label key={layer.id} className={`flex items-start gap-2 py-1 ${isAvailable ? 'cursor-pointer' : 'text-slate-500'}`}>
            <input
              type="radio"
              name="map-layer"
              value={layer.id}
              checked={layerId === layer.id}
              disabled={!isAvailable}
              onChange={() => onLayerChange(layer.id)}
              className="mt-1 accent-amber-400"
            />
            <span>
              {layer.label}
              {!isAvailable && <span className="block text-xs">{t(UNAVAILABLE_HINTS[layer.needs])}</span>}
            </span>
          </label>
        )
      })}
    </fieldset>
    <fieldset className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm">
      <legend className="px-1 text-slate-300">{t('map.imageLayers')}</legend>
      {MAP_OVERLAYS.filter((overlay) => overlayKinds.includes(overlay.kind)).map((overlay) => {
        const state = overlays[overlay.kind]
        return (
          <div key={overlay.kind} className="py-1">
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={state.enabled}
                onChange={(event) => onOverlayChange(overlay.kind, { enabled: event.target.checked })}
                className="mt-1 accent-amber-400"
              />
              {overlay.label}
            </label>
            {state.enabled && overlay.defaultOpacity !== undefined && (
              <label className="ml-6 flex items-center gap-2 text-xs text-slate-400">
                {t('map.opacity')}
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={10}
                  value={Math.round(state.opacity * 100)}
                  aria-valuetext={`${Math.round(state.opacity * 100)} %`}
                  onChange={(event) => onOverlayChange(overlay.kind, { opacity: Number(event.target.value) / 100 })}
                  className="w-24 accent-amber-400"
                />
              </label>
            )}
          </div>
        )
      })}
    </fieldset>
    </div>
    </details>
  )
}
