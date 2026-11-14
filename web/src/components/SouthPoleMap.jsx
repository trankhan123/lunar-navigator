import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { select } from 'd3-selection'
import { zoom, zoomIdentity } from 'd3-zoom'
import { toPolarXY } from '../core/data.js'
import { MAP_LAYERS, STATUS_SYMBOLS, cellColor, cellLevel } from '../core/mapLayers.js'
import { computeSkyAtHour, regionCentreCells } from '../core/mapSky.js'
import { MAX_ZOOM_SCALE, VIEW_BOX, VIEW_HALF_WIDTH_M, WHOLE_MAP_BOUNDS_M, fitTransform, isOnPolarMap } from '../core/mapView.js'
import MapCells from './MapCells.jsx'
import MapLayersPanel from './MapLayersPanel.jsx'
import MapLegend from './MapLegend.jsx'
import MapMarks from './MapMarks.jsx'

const ZOOM_STEP = 1.6
const OUTLINE_SIZE_M = 940
const toolbarButton = 'grid size-9 place-items-center rounded border border-slate-600 text-lg leading-none transition-colors hover:bg-slate-800'

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const layerById = (layerId) => MAP_LAYERS.find((layer) => layer.id === layerId)
const skySample = (sky, index) => ({ sunDiskFraction: sky?.sunDiskFraction[index], earthDiskFraction: sky?.earthDiskFraction[index] })

function MapImage({ entry }) {
  const [xMin, yMin, xMax, yMax] = entry.boundsM
  return <image href={entry.image} x={xMin} y={-yMax} width={xMax - xMin} height={yMax - yMin} preserveAspectRatio="none" pointerEvents="none" />
}

/**
 * README W2: one SVG of the whole south pole in PGDA metres (SVG y = −yM), panned and zoomed by d3-zoom.
 * activeRegion null = the overview; otherwise that region's cells are drawn.
 */
function SouthPoleMap({
  regions, activeRegion, maps, cells, sites, ephemeris, hour, defaultLayerId, statusByCellId, currentCellId, selectedCellId, onSelectCell, onOpenRegion,
}) {
  const svgRef = useRef(null)
  const behaviorRef = useRef(null)
  const isFirstFit = useRef(true)
  const [transform, setTransform] = useState(zoomIdentity)
  const [chosenLayerId, setChosenLayerId] = useState(defaultLayerId)
  const regionCode = activeRegion?.code ?? null

  useEffect(() => {
    const svg = svgRef.current
    const behavior = zoom()
      .scaleExtent([1, MAX_ZOOM_SCALE])
      .translateExtent([[-VIEW_HALF_WIDTH_M, -VIEW_HALF_WIDTH_M], [VIEW_HALF_WIDTH_M, VIEW_HALF_WIDTH_M]])
      .clickDistance(4)
      // The wheel zooms only once the map has focus (or with Ctrl/⌘ and trackpad pinch), so page scrolling is never caught.
      .filter((event) => !event.button && (event.type !== 'wheel' || event.ctrlKey || event.metaKey || document.activeElement === svg))
      .on('zoom', (event) => setTransform(event.transform))
    behaviorRef.current = behavior
    select(svg).call(behavior)
    return () => select(svg).on('.zoom', null)
  }, [])

  useEffect(() => {
    const { k, x, y } = fitTransform(activeRegion?.boundsM ?? WHOLE_MAP_BOUNDS_M, 0.08)
    const target = zoomIdentity.translate(x, y).scale(k)
    const svg = select(svgRef.current)
    if (isFirstFit.current || prefersReducedMotion()) svg.call(behaviorRef.current.transform, target)
    else svg.transition().duration(600).call(behaviorRef.current.transform, target)
    isFirstFit.current = false
  }, [regionCode]) // eslint-disable-line react-hooks/exhaustive-deps -- refit only when the region changes, not on every new regions array

  function zoomBy(factor) {
    behaviorRef.current.scaleBy(select(svgRef.current).transition().duration(prefersReducedMotion() ? 0 : 250), factor)
  }

  // A chosen layer that cannot draw yet (no valid hour, no search) draws as Feasibility; the radio keeps the choice.
  const availability = { hour: hour !== null && hour !== undefined, search: Boolean(statusByCellId) }
  const chosenLayer = layerById(chosenLayerId)
  const layerId = !chosenLayer.needs || availability[chosenLayer.needs] ? chosenLayerId : 'feasibility'
  const layerNeedsHour = layerById(layerId).needs === 'hour'
  const sky = useMemo(
    () => (layerNeedsHour && cells && availability.hour ? computeSkyAtHour(cells, ephemeris, hour) : null),
    [layerNeedsHour, cells, ephemeris, hour, availability.hour],
  )
  const colors = useMemo(
    () => (cells ?? []).map((cell, index) => cellColor(layerId, { feasible: cell.feasible, status: statusByCellId?.get(cell.id), ...skySample(sky, index) })),
    [cells, layerId, statusByCellId, sky],
  )
  // Region-centre dots (their sites carry D4 horizons) show the Sun/Earth at the map hour at every zoom.
  const dotLayerId = layerNeedsHour ? layerId : 'sunEarthNow'
  const centreCells = useMemo(() => regionCentreCells(regions, sites), [regions, sites])
  const centreSky = useMemo(
    () => (availability.hour ? computeSkyAtHour(centreCells.map((centre) => centre.cell), ephemeris, hour) : null),
    [centreCells, ephemeris, hour, availability.hour],
  )
  const centres = centreCells
    .map((centre, index) => {
      const sample = skySample(centreSky, index)
      const level = cellLevel(dotLayerId, sample)
      const regionName = regions.find((region) => region.code === centre.regionCode).name
      const levelText = level === null ? 'no value for this hour' : layerById(dotLayerId).legend[level].label
      return { regionCode: centre.regionCode, xM: centre.cell.xM, yM: centre.cell.yM, color: cellColor(dotLayerId, sample), title: `${regionName} centre: ${levelText}` }
    })
    .filter((centre) => centre.regionCode !== regionCode)
  const symbols = useMemo(() => {
    if (!cells || layerId !== 'searchResult') return null
    return cells.map((cell) => {
      const status = statusByCellId.get(cell.id)
      return cell.feasible && status !== undefined ? STATUS_SYMBOLS[status] : null
    })
  }, [cells, layerId, statusByCellId])
  const pinSites = useMemo(
    () => sites.filter((site) => site.region === null).map((site) => ({ ...site, ...toPolarXY(site.lat, site.lon) })).filter((site) => isOnPolarMap(site.xM, site.yM)),
    [sites],
  )

  const southPoleImage = maps.find((entry) => entry.id === 'south_pole' && entry.kind === 'hillshade')
  const regionImage = activeRegion && maps.find((entry) => entry.id === activeRegion.code && entry.kind === 'hillshade')
  const outlines = [[currentCellId, '#fbbf24', 3], [selectedCellId, '#f8fafc', 2]]
    .map(([cellId, color, width]) => ({ cell: cells?.find((cell) => cell.id === cellId), color, width }))
    .filter(({ cell }) => cell)
  const ariaLabel = activeRegion
    ? `Map of ${activeRegion.name}: ${cells?.length ?? 0} cells of 1 km, ${cells?.filter((cell) => cell.feasible).length ?? 0} feasible. Use the Cell list above the map to select a cell with the keyboard.`
    : 'Map of the lunar south pole with the Artemis III regions. Use the Region list to open one.'

  return (
    <figure className="@container">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <nav aria-label="Map level" className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onOpenRegion(null)}
            aria-current={activeRegion ? undefined : 'page'}
            className="rounded px-2 py-1 text-sky-300 transition-colors hover:bg-slate-800 aria-[current=page]:text-slate-200"
          >
            South pole
          </button>
          {activeRegion && (
            <>
              <span aria-hidden="true" className="text-slate-500">›</span>
              <span className="font-medium">{activeRegion.name}</span>
            </>
          )}
        </nav>
        <span className="ml-auto text-xs text-slate-400">Click the map, then scroll to zoom</span>
        <button type="button" aria-label="Zoom in" onClick={() => zoomBy(ZOOM_STEP)} className={toolbarButton}>+</button>
        <button type="button" aria-label="Zoom out" onClick={() => zoomBy(1 / ZOOM_STEP)} className={toolbarButton}>−</button>
      </div>
      <div className="grid gap-3 @2xl:grid-cols-[minmax(0,1fr)_13rem]">
      <div>
      <svg
        ref={svgRef}
        viewBox={VIEW_BOX}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        className="mx-auto block aspect-square w-full max-w-[75vh] touch-none select-none rounded-lg bg-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      >
        <defs>
          <pattern id="infeasible-hatch" patternUnits="userSpaceOnUse" width={200} height={200} patternTransform="rotate(45)">
            <line x1={0} y1={0} x2={0} y2={200} stroke="#94a3b8" strokeWidth={40} />
          </pattern>
        </defs>
        <g transform={transform.toString()}>
          {southPoleImage && <MapImage entry={southPoleImage} />}
          {regionImage && <MapImage entry={regionImage} />}
          {activeRegion && cells && <MapCells cells={cells} colors={colors} symbols={symbols} onSelectCell={onSelectCell} />}
          <MapMarks regions={regions} activeRegionCode={regionCode} pinSites={pinSites} centres={centres} zoomScale={transform.k} onOpenRegion={onOpenRegion} />
          <g pointerEvents="none">
            {outlines.map(({ cell, color, width }) => (
              <rect
                key={color}
                x={cell.xM - OUTLINE_SIZE_M / 2}
                y={-cell.yM - OUTLINE_SIZE_M / 2}
                width={OUTLINE_SIZE_M}
                height={OUTLINE_SIZE_M}
                fill="none"
                stroke={color}
                strokeWidth={width}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        </g>
      </svg>
      <p aria-live="polite" className="mt-1 min-h-4 text-xs text-slate-400">
        {activeRegion && !cells ? `Loading ${activeRegion.name} cells…` : ''}
      </p>
      </div>
      <MapLayersPanel layerId={chosenLayerId} onLayerChange={setChosenLayerId} availability={availability} />
      </div>
      {activeRegion ? <MapLegend layerId={layerId} /> : <MapLegend layerId={dotLayerId} showsCentreDots />}
    </figure>
  )
}

// Memo: the form re-renders App on every keystroke; the map should not re-render with it.
export default memo(SouthPoleMap)
