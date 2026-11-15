import { memo, useEffect, useMemo, useState } from 'react'
import { CAP_GRID_SIZE, capBoundsM, capPixelLookup, capPixelsRgba, capTileIdsInBounds } from '../core/capGrid.js'
import { CELL_FILL_OPACITY, MAP_LAYERS, cellColor } from '../core/mapLayers.js'
import { computeSkyAtHour } from '../core/mapSky.js'
import { viewBoundsM } from '../core/mapView.js'
import { startVisibilityFractions } from '../core/startWindowSearch.js'

const FRACTIONS_WAIT_MS = 400 // typing a date must not start one worker job per keystroke
const PHONE_MIN_ZOOM_SCALE = 4 // CAP tiles in view load from this zoom on (all screens; wide ones preload the 85°S circle in App)
const TILE_WAIT_MS = 250
const fractionsCache = new Map() // `${first}|${last}|${cellCount}` → {fractionSun, fractionEarth}, kept for the session

function rasterUrl(capCells, colors, gridSize) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = gridSize
  canvas.getContext('2d').putImageData(new ImageData(capPixelsRgba(capCells, colors, gridSize), gridSize, gridSize), 0, 0)
  return canvas.toDataURL()
}

// shortcut: past this many loaded cap cells, panning loads no more tiles (phone memory); evicting old tiles would be the real fix.
const MAX_CAP_CELLS_ON_MAP = 30000

/**
 * docs/technical-reference.md W2: the whole-cap 2 km grid as ONE raster (a pixel per cell, same colours as the region cells on the active layer).
 * Sky and search colours are computed here from the loaded CAP cells; layerId is the layer SouthPoleMap actually draws.
 */
function MapCapLayer({ capCells, capIndex, layerId, ephemeris, hour, hourRange, statusByCellId, transform, onSelectCell, onHoverCell, onNeedCapTiles, onStatusChange }) {
  const [, setFractionsDone] = useState(0)
  const gridSize = capIndex?.gridSize ?? CAP_GRID_SIZE // cells per side of the raster, from the data
  const [xMin, yMin, xMax, yMax] = capBoundsM(gridSize)
  const needs = MAP_LAYERS.find((layer) => layer.id === layerId).needs
  const sky = useMemo(
    () => (needs === 'hour' && capCells.length > 0 ? computeSkyAtHour(capCells, ephemeris, hour) : null),
    [needs, capCells, ephemeris, hour],
  )

  const fractionsKey = needs === 'dates' && capCells.length > 0 ? `${hourRange.firstHour}|${hourRange.lastHour}|${capCells.length}` : null
  const fractions = fractionsKey ? fractionsCache.get(fractionsKey) : undefined
  const [fractionsError, setFractionsError] = useState(null)
  useEffect(() => {
    if (!fractionsKey || fractionsCache.has(fractionsKey)) return
    const [firstHour, lastHour] = fractionsKey.split('|').map(Number)
    let job = null
    const timer = setTimeout(() => {
      setFractionsError(null)
      job = startVisibilityFractions({ cells: capCells, ephemeris, firstHour, hourCount: lastHour - firstHour + 1 })
      job.promise
        .then((result) => {
          fractionsCache.set(fractionsKey, result)
          setFractionsDone((count) => count + 1)
        })
        .catch((error) => error.message !== 'cancelled' && setFractionsError(error.message))
    }, FRACTIONS_WAIT_MS)
    return () => {
      clearTimeout(timer)
      job?.cancel() // a newer range or more loaded tiles always win
    }
  }, [fractionsKey]) // eslint-disable-line react-hooks/exhaustive-deps -- keyed on the string: the cells of a key are fixed
  useEffect(() => {
    onStatusChange(fractionsError ? `Could not compute the % layer for the cap grid: ${fractionsError}` : fractionsKey && !fractions ? 'Computing the % of hours for the cap grid…' : '')
  }, [fractionsKey, fractions, fractionsError, onStatusChange])

  const url = useMemo(() => {
    if (capCells.length === 0) return null
    const colors = capCells.map((cell, index) =>
      cellColor(layerId, {
        feasible: cell.feasible,
        psrDistanceKm: cell.psrDistanceKm,
        status: statusByCellId?.get(cell.id),
        sunDiskFraction: sky?.sunDiskFraction[index],
        earthDiskFraction: sky?.earthDiskFraction[index],
        fractionSun: fractions?.fractionSun[index],
        fractionEarth: fractions?.fractionEarth[index],
      }),
    )
    return rasterUrl(capCells, colors, gridSize)
  }, [capCells, layerId, statusByCellId, sky, fractions, gridSize])
  const pixelLookup = useMemo(() => capPixelLookup(capCells, gridSize), [capCells, gridSize])

  // Tiles in view load once zoomed in; wide screens already preloaded the 85°S circle (App).
  useEffect(() => {
    if (!capIndex || transform.k < PHONE_MIN_ZOOM_SCALE || capCells.length >= MAX_CAP_CELLS_ON_MAP) return
    const timer = setTimeout(() => onNeedCapTiles(capTileIdsInBounds(capIndex, viewBoundsM(transform))), TILE_WAIT_MS)
    return () => clearTimeout(timer)
  }, [capIndex, transform, onNeedCapTiles, capCells.length])

  function cellFromEvent(event) {
    const box = event.currentTarget.getBoundingClientRect()
    const column = Math.floor(((event.clientX - box.left) / box.width) * gridSize)
    const row = Math.floor(((event.clientY - box.top) / box.height) * gridSize)
    return capCells[pixelLookup[row * gridSize + column]] ?? null
  }

  if (!url) return null
  return (
    <image
      href={url}
      x={xMin}
      y={-yMax}
      width={xMax - xMin}
      height={yMax - yMin}
      preserveAspectRatio="none"
      opacity={CELL_FILL_OPACITY}
      style={{ imageRendering: 'pixelated', cursor: 'pointer' }}
      onClick={(event) => {
        const cell = cellFromEvent(event)
        if (cell) onSelectCell(cell)
      }}
      onPointerMove={(event) => event.pointerType === 'mouse' && onHoverCell(cellFromEvent(event))}
      onPointerLeave={(event) => event.pointerType === 'mouse' && onHoverCell(null)}
    />
  )
}

export default memo(MapCapLayer)
