import { useLayoutEffect, useState } from 'react'
import { visibleReliefTiles } from '../core/mapTiles.js'

/**
 * Relief tiles for the current zoom, drawn inside the zoomed SVG group (so the group's transform places them).
 * Needs the map's drawn width in px to choose the level; reads it from the owner <svg> and follows resizes.
 * Tile <image>s are keyed, so a pan or zoom only adds or removes the tiles whose set changed.
 */
export default function MapReliefTiles({ index, transform, opacity = 1 }) {
  const [anchor, setAnchor] = useState(null) // the <g> itself, to find the owner svg
  const [viewportPx, setViewportPx] = useState(0)
  useLayoutEffect(() => {
    const svg = anchor?.ownerSVGElement
    if (!svg) return
    const measure = () => setViewportPx(Math.min(svg.clientWidth, svg.clientHeight))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(svg)
    return () => observer.disconnect()
  }, [anchor])

  const tiles = viewportPx ? visibleReliefTiles(transform, viewportPx, index, window.devicePixelRatio) : []
  return (
    <g ref={setAnchor} opacity={opacity} pointerEvents="none">
      {tiles.map((tile) => (
        // one tile pixel of overlap hides hairline seams between neighbouring tiles
        <image key={tile.key} href={tile.url} x={tile.xM} y={-tile.yM} width={tile.sizeM * (1 + 1 / 512)} height={tile.sizeM * (1 + 1 / 512)} preserveAspectRatio="none" />
      ))}
    </g>
  )
}
