import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { select } from 'd3-selection'
import { zoom, zoomIdentity } from 'd3-zoom'
import { timeAtHour, toPolarXY } from '../core/data.js'
import { MAP_LAYERS, MAP_OVERLAYS, STATUS_SYMBOLS, cellColor, cellLevel, nasaCoverageNote } from '../core/mapLayers.js'
import { bodyDirections, computeSkyAtHour, regionCentreCells } from '../core/mapSky.js'
import {
  MAX_ZOOM_SCALE, VIEW_BOX, VIEW_HALF_WIDTH_M, VIEW_SIZE_M, WHOLE_MAP_BOUNDS_M, cellLabelsVisible, fitTransform, isOnPolarMap, mapAngleDeg, viewBoundsM,
} from '../core/mapView.js'
import { startVisibilityFractions } from '../core/startWindowSearch.js'
import CellHoverCard from './CellHoverCard.jsx'
import DirectionCard from './DirectionCard.jsx'
import MapCells from './MapCells.jsx'
import MapLayersPanel from './MapLayersPanel.jsx'
import MapLegend from './MapLegend.jsx'
import MapMarks from './MapMarks.jsx'
import MapMinimap from './MapMinimap.jsx'
import MapSearch from './MapSearch.jsx'

const SITE_FOCUS_HALF_M = 5000
const CELL_FOCUS_HALF_M = 3000
const boundsAround = ({ xM, yM }, halfM) => [xM - halfM, yM - halfM, xM + halfM, yM + halfM]

const MINIMAP_MIN_ZOOM = 1.5
const ARROW_LENGTH = 0.09 * VIEW_SIZE_M // in viewBox units, drawn outside the zoom group so it keeps its size
const ARROW_COLORS = { sun: '#f0e442', earth: '#56b4e9' }
const FRACTIONS_WAIT_MS = 400 // typing a date must not start one worker job per keystroke
// "% over your dates" results, keyed `${code}|${firstHour}|${lastHour}`; kept for the session so going back is instant.
const fractionsCache = new Map()

const ZOOM_STEP = 1.6
const OUTLINE_SIZE_M = 940
const toolbarButton = 'grid size-9 place-items-center rounded border border-slate-600 text-lg leading-none transition-colors hover:bg-slate-800'

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const layerById = (layerId) => MAP_LAYERS.find((layer) => layer.id === layerId)
const skySample = (sky, index) => ({ sunDiskFraction: sky?.sunDiskFraction[index], earthDiskFraction: sky?.earthDiskFraction[index] })

const NASA_KINDS = ['sun-visibility', 'earth-visibility', 'psr'] // drawn over the cells, in this order
const initialOverlays = () => Object.fromEntries(MAP_OVERLAYS.map((overlay) => [overlay.kind, { enabled: overlay.defaultEnabled, opacity: overlay.defaultOpacity }]))

function MapImage({ entry, opacity = 1 }) {
  const [xMin, yMin, xMax, yMax] = entry.boundsM
  return (
    <image href={entry.image} x={xMin} y={-yMax} width={xMax - xMin} height={yMax - yMin} preserveAspectRatio="none" opacity={opacity} pointerEvents="none" />
  )
}

/**
 * README W2: one SVG of the whole south pole in PGDA metres (SVG y = −yM), panned and zoomed by d3-zoom.
 * activeRegion null = the overview; otherwise that region's cells are drawn.
 */
function SouthPoleMap({
  regions, activeRegion, maps, cells, sites, ephemeris, hour, hourRange = null, stayDays = null, defaultLayerId, timeBar = null, statusByCellId, currentCellId,
  selectedCellId, onSelectCell, onOpenRegion, focus = null, cellsByRegion = {}, onNeedRegionCells,
}) {
  const svgRef = useRef(null)
  const behaviorRef = useRef(null)
  const isFirstFit = useRef(true)
  const [transform, setTransform] = useState(zoomIdentity)
  const [chosenLayerId, setChosenLayerId] = useState(defaultLayerId)
  const [, setFractionsDone] = useState(0) // bumped when a worker result lands in fractionsCache
  const [fractionsError, setFractionsError] = useState(null)
  const [hoveredCell, setHoveredCell] = useState(null)
  const [overlays, setOverlays] = useState(initialOverlays)
  const [labelsFit, setLabelsFit] = useState(false) // a 1 km cell is wide enough on screen for its LGRS label
  const regionCode = activeRegion?.code ?? null
  const changeOverlay = (kind, changes) => setOverlays((current) => ({ ...current, [kind]: { ...current[kind], ...changes } }))

  useEffect(() => {
    if (!hoveredCell) return
    // WCAG 1.4.13: content shown on hover can be dismissed without moving the pointer.
    const dismissOnEscape = (event) => event.key === 'Escape' && setHoveredCell(null)
    window.addEventListener('keydown', dismissOnEscape)
    return () => window.removeEventListener('keydown', dismissOnEscape)
  }, [hoveredCell])

  useEffect(() => {
    const svg = svgRef.current
    const behavior = zoom()
      .scaleExtent([1, MAX_ZOOM_SCALE])
      .translateExtent([[-VIEW_HALF_WIDTH_M, -VIEW_HALF_WIDTH_M], [VIEW_HALF_WIDTH_M, VIEW_HALF_WIDTH_M]])
      .clickDistance(4)
      // The wheel zooms only once the map has focus (or with Ctrl/⌘ and trackpad pinch), so page scrolling is never caught.
      .filter((event) => !event.button && (event.type !== 'wheel' || event.ctrlKey || event.metaKey || document.activeElement === svg))
      .on('zoom', (event) => {
        setTransform(event.transform)
        setLabelsFit(cellLabelsVisible(event.transform.k, Math.min(svg.clientWidth, svg.clientHeight)))
      })
    behaviorRef.current = behavior
    select(svg).call(behavior)
    return () => select(svg).on('.zoom', null)
  }, [])

  // A find-box pick focuses a site or cell; picking the same one again zooms back to it (a new requestId).
  const fitKey = focus ? `focus:${focus.requestId}` : (regionCode ?? 'pole')
  useEffect(() => {
    const { k, x, y } = fitTransform(focus?.boundsM ?? activeRegion?.boundsM ?? WHOLE_MAP_BOUNDS_M, 0.08)
    const target = zoomIdentity.translate(x, y).scale(k)
    const svg = select(svgRef.current)
    if (isFirstFit.current || prefersReducedMotion()) svg.call(behaviorRef.current.transform, target)
    else svg.transition().duration(600).call(behaviorRef.current.transform, target)
    isFirstFit.current = false
  }, [fitKey]) // eslint-disable-line react-hooks/exhaustive-deps -- refit only when the region or the focus request changes

  function pickSearchMatch(match) {
    if (match.type === 'region') onOpenRegion(match.regionCode)
    if (match.type === 'site') onOpenRegion(match.regionCode, { focusBoundsM: boundsAround(toPolarXY(match.site.lat, match.site.lon), SITE_FOCUS_HALF_M) })
    if (match.type === 'cell') onOpenRegion(match.regionCode, { cellId: match.cell.id, focusBoundsM: boundsAround(match.cell, CELL_FOCUS_HALF_M) })
  }

  function zoomBy(factor) {
    behaviorRef.current.scaleBy(select(svgRef.current).transition().duration(prefersReducedMotion() ? 0 : 250), factor)
  }

  // A chosen layer that cannot draw yet (no valid hour, no search) draws as Feasibility; the radio keeps the choice.
  const availability = { hour: hour !== null && hour !== undefined, dates: Boolean(hourRange), search: Boolean(statusByCellId) }
  const chosenLayer = layerById(chosenLayerId)
  const layerId = !chosenLayer.needs || availability[chosenLayer.needs] ? chosenLayerId : 'feasibility'
  const layerNeedsHour = layerById(layerId).needs === 'hour'
  const layerNeedsDates = layerById(layerId).needs === 'dates'
  const sky = useMemo(
    () => (layerNeedsHour && cells && availability.hour ? computeSkyAtHour(cells, ephemeris, hour) : null),
    [layerNeedsHour, cells, ephemeris, hour, availability.hour],
  )

  const fractionsKey = layerNeedsDates && regionCode && cells ? `${regionCode}|${hourRange.firstHour}|${hourRange.lastHour}` : null
  const fractions = fractionsKey ? fractionsCache.get(fractionsKey) : undefined
  useEffect(() => {
    if (!fractionsKey || fractionsCache.has(fractionsKey)) return
    const [, firstHour, lastHour] = fractionsKey.split('|').map(Number)
    let job = null
    const timer = setTimeout(() => {
      setFractionsError(null)
      job = startVisibilityFractions({ cells, ephemeris, firstHour, hourCount: lastHour - firstHour + 1 })
      job.promise
        .then((result) => {
          fractionsCache.set(fractionsKey, result)
          setFractionsDone((count) => count + 1)
        })
        .catch((error) => error.message !== 'cancelled' && setFractionsError(error.message))
    }, FRACTIONS_WAIT_MS)
    return () => {
      clearTimeout(timer)
      job?.cancel() // a newer date range always wins
    }
  }, [fractionsKey]) // eslint-disable-line react-hooks/exhaustive-deps -- keyed on the string key: a region's cells and the ephemeris are fixed for a key

  const colors = useMemo(
    () =>
      (cells ?? []).map((cell, index) =>
        cellColor(layerId, {
          feasible: cell.feasible,
          status: statusByCellId?.get(cell.id),
          ...skySample(sky, index),
          fractionSun: fractions?.fractionSun[index],
          fractionEarth: fractions?.fractionEarth[index],
        }),
      ),
    [cells, layerId, statusByCellId, sky, fractions],
  )
  // Paint fills straight into the cell rects (before the browser paints), touching only the cells whose colour changed.
  const cellsGroupRef = useRef(null)
  useLayoutEffect(() => {
    cellsGroupRef.current?.querySelectorAll('rect[data-cell-index]').forEach((rect, index) => {
      if (rect.getAttribute('fill') !== colors[index]) rect.setAttribute('fill', colors[index])
    })
  }, [colors])

  const dateRangeText = hourRange ? `${timeAtHour(ephemeris, hourRange.firstHour).slice(0, 10)} to ${timeAtHour(ephemeris, hourRange.lastHour).slice(0, 10)}` : ''
  const statusText = !activeRegion
    ? ''
    : !cells
      ? `Loading ${activeRegion.name} cells…`
      : layerNeedsDates && fractionsError
        ? `Could not compute the % layer: ${fractionsError}`
        : layerNeedsDates && !fractions
          ? 'Computing the % of hours for your dates…'
          : ''
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

  // Sun/Earth directions at the selected cell of this region, else at the region centre (spec §5.6); only inside a region.
  const selectedInRegion = cells?.find((cell) => cell.id === selectedCellId)
  const measuredCell = activeRegion && availability.hour ? (selectedInRegion ?? centreCells.find((centre) => centre.regionCode === regionCode)?.cell) : null
  const directions = useMemo(() => (measuredCell ? bodyDirections(measuredCell, ephemeris, hour) : null), [measuredCell, ephemeris, hour])
  const placeLabel = selectedInRegion ? `At ${selectedInRegion.id}` : `At the centre of ${activeRegion?.name}`
  const arrowStart = measuredCell && transform.apply([measuredCell.xM, -measuredCell.yM])

  const southPoleImage = maps.find((entry) => entry.id === 'south_pole' && entry.kind === 'hillshade')
  const regionImage = activeRegion && maps.find((entry) => entry.id === activeRegion.code && entry.kind === 'hillshade')
  // The panel lists relief always and each NASA kind only when this data set has it (mock mode has none).
  const overlayKinds = ['relief', ...NASA_KINDS.filter((kind) => maps.some((entry) => entry.kind === kind)), 'labels']
  const enabledNasaKinds = NASA_KINDS.filter((kind) => overlayKinds.includes(kind) && overlays[kind].enabled)
  const nasaImages = activeRegion
    ? enabledNasaKinds.map((kind) => ({ kind, entry: maps.find((entry) => entry.id === activeRegion.code && entry.kind === kind) })).filter(({ entry }) => entry)
    : []
  const coverageNotes = enabledNasaKinds
    .filter((kind) => kind !== 'psr')
    .map((kind) =>
      activeRegion
        ? cells && nasaCoverageNote(activeRegion.name, cells, maps.find((entry) => entry.id === activeRegion.code && entry.kind === kind))
        : 'Open a region to see the NASA layers.',
    )
  const coverageNote = [...new Set(coverageNotes.filter(Boolean))].join(' ')
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
        <MapSearch regions={regions} sites={sites} cellsByRegion={cellsByRegion} onNeedRegionCells={onNeedRegionCells} onPick={pickSearchMatch} />
        <span className="ml-auto text-xs text-slate-400">Click the map, then scroll to zoom</span>
        <button type="button" aria-label="Zoom in" onClick={() => zoomBy(ZOOM_STEP)} className={toolbarButton}>+</button>
        <button type="button" aria-label="Zoom out" onClick={() => zoomBy(1 / ZOOM_STEP)} className={toolbarButton}>−</button>
      </div>
      <div className="grid gap-3 @2xl:grid-cols-[minmax(0,1fr)_13rem]">
      <div>
      <div className="relative mx-auto w-full max-w-[75vh]">
      <svg
        ref={svgRef}
        viewBox={VIEW_BOX}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        className="block aspect-square w-full touch-none select-none rounded-lg bg-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      >
        <defs>
          <pattern id="infeasible-hatch" patternUnits="userSpaceOnUse" width={200} height={200} patternTransform="rotate(45)">
            <line x1={0} y1={0} x2={0} y2={200} stroke="#94a3b8" strokeWidth={40} />
          </pattern>
        </defs>
        <g transform={transform.toString()}>
          {overlays.relief.enabled && southPoleImage && <MapImage entry={southPoleImage} opacity={overlays.relief.opacity} />}
          {overlays.relief.enabled && regionImage && <MapImage entry={regionImage} opacity={overlays.relief.opacity} />}
          {activeRegion && cells && (
            <MapCells
              cells={cells}
              groupRef={cellsGroupRef}
              symbols={symbols}
              onSelectCell={onSelectCell}
              onHoverCell={setHoveredCell}
              showLabels={overlays.labels.enabled && labelsFit}
            />
          )}
          {nasaImages.map(({ kind, entry }) => (
            <MapImage key={kind} entry={entry} opacity={overlays[kind].opacity} />
          ))}
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
        {directions && (
          <g pointerEvents="none">
            {directions.map((direction) => (
              <g
                key={direction.body}
                transform={`translate(${arrowStart[0]} ${arrowStart[1]}) rotate(${mapAngleDeg(direction.azimuthDeg, measuredCell.lon)})`}
                stroke={ARROW_COLORS[direction.body]}
                strokeWidth={2.5}
                strokeDasharray={direction.isVisible ? undefined : '6 4'}
                fill="none"
              >
                <line x1={0} y1={0} x2={0} y2={-ARROW_LENGTH} vectorEffect="non-scaling-stroke" />
                <polyline
                  points={`${-ARROW_LENGTH * 0.15},${-ARROW_LENGTH * 0.85} 0,${-ARROW_LENGTH} ${ARROW_LENGTH * 0.15},${-ARROW_LENGTH * 0.85}`}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            ))}
          </g>
        )}
      </svg>
      {directions && <DirectionCard directions={directions} placeLabel={placeLabel} />}
      {hoveredCell && cells?.includes(hoveredCell) && <CellHoverCard cell={hoveredCell} ephemeris={ephemeris} hour={hour} stayDays={stayDays} />}
      {transform.k >= MINIMAP_MIN_ZOOM && (
        <MapMinimap regions={regions} activeRegionCode={regionCode} background={southPoleImage} viewBoundsM={viewBoundsM(transform)} />
      )}
      </div>
      <p aria-live="polite" className="mt-1 min-h-4 text-xs text-slate-400">
        {statusText}
      </p>
      {coverageNote && <p className="text-xs text-amber-200">{coverageNote}</p>}
      </div>
      <MapLayersPanel
        layerId={chosenLayerId}
        onLayerChange={setChosenLayerId}
        availability={availability}
        overlays={overlays}
        overlayKinds={overlayKinds}
        onOverlayChange={changeOverlay}
      />
      </div>
      {timeBar}
      {activeRegion ? (
        <MapLegend layerId={layerId} dateRangeText={dateRangeText} enabledOverlayKinds={enabledNasaKinds} />
      ) : (
        <MapLegend layerId={dotLayerId} showsCentreDots enabledOverlayKinds={enabledNasaKinds} />
      )}
    </figure>
  )
}

// Memo: the form re-renders App on every keystroke; the map should not re-render with it.
export default memo(SouthPoleMap)
