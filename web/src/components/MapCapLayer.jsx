import { memo, useEffect, useMemo, useState } from 'react'
import { CAP_BOUNDS_M, CAP_GRID_SIZE, capPixelLookup, capPixelsRgba, capTileIdsInBounds } from '../core/capGrid.js'
import { MAP_LAYERS, cellColor } from '../core/mapLayers.js'
import { computeSkyAtHour } from '../core/mapSky.js'
import { viewBoundsM } from '../core/mapView.js'
import { startVisibilityFractions } from '../core/startWindowSearch.js'

const FRACTIONS_WAIT_MS = 400 // typing a date must not start one worker job per keystroke
const PHONE_MIN_ZOOM_SCALE = 4 // on phones the CAP tiles in view load only from this zoom on
const TILE_WAIT_MS = 250
const fractionsCache = new Map() // `${first}|${last}|${cellCount}` → {fractionSun, fractionEarth}, kept for the session
const [xMin, yMin, xMax, yMax] = CAP_BOUNDS_M

function rasterUrl(capCells, colors) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = CAP_GRID_SIZE
  canvas.getContext('2d').putImageData(new ImageData(capPixelsRgba(capCells, colors), CAP_GRID_SIZE, CAP_GRID_SIZE), 0, 0)
  return canvas.toDataURL()
}

/**
 * README W2: the whole-cap 2 km grid as ONE raster (a pixel per cell, same colours as the region cells on the active layer).
 * Sky and search colours are computed here from the loaded CAP cells; layerId is the layer SouthPoleMap actually draws.
 */
function MapCapLayer({ capCells, capIndex, layerId, ephemeris, hour, hourRange, statusByCellId, transform, onSelectCell, onHoverCell, onNeedCapTiles, onStatusChange }) {
  const [, setFractionsDone] = useState(0)
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
        status: statusByCellId?.get(cell.id),
        sunDiskFraction: sky?.sunDiskFraction[index],
        earthDiskFraction: sky?.earthDiskFraction[index],
        fractionSun: fractions?.fractionSun[index],
        fractionEarth: fractions?.fractionEarth[index],
      }),
    )
    return rasterUrl(capCells, colors)
  }, [capCells, layerId, statusByCellId, sky, fractions])
  const pixelLookup = useMemo(() => capPixelLookup(capCells), [capCells])

  // Phones load only the tiles in view, once zoomed in; wider screens load everything in the background (App).
  useEffect(() => {
    if (!capIndex || transform.k < PHONE_MIN_ZOOM_SCALE || window.matchMedia('(min-width: 768px)').matches) return
    const timer = setTimeout(() => onNeedCapTiles(capTileIdsInBounds(capIndex, viewBoundsM(transform))), TILE_WAIT_MS)
    return () => clearTimeout(timer)
  }, [capIndex, transform, onNeedCapTiles])

  function cellFromEvent(event) {
    const box = event.currentTarget.getBoundingClientRect()
    const column = Math.floor(((event.clientX - box.left) / box.width) * CAP_GRID_SIZE)
    const row = Math.floor(((event.clientY - box.top) / box.height) * CAP_GRID_SIZE)
    return capCells[pixelLookup[row * CAP_GRID_SIZE + column]] ?? null
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
      opacity={0.8}
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
