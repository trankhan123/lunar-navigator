import { MAP_LAYERS } from '../core/mapLayers.js'

const UNAVAILABLE_HINTS = { hour: 'needs dates inside the ephemeris', search: 'run a search first' }

// availability: {hour, search} booleans; a layer whose `needs` is unmet stays visible but disabled, with the reason.
export default function MapLayersPanel({ layerId, onLayerChange, availability }) {
  return (
    <fieldset className="h-fit rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm">
      <legend className="px-1 text-slate-300">Colour cells by</legend>
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
              {!isAvailable && <span className="block text-xs">{UNAVAILABLE_HINTS[layer.needs]}</span>}
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}
