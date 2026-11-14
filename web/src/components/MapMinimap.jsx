import { VIEW_BOX } from '../core/mapView.js'

// Overview inset: the whole pole, the region frames and the area the big map shows. Decorative (the breadcrumb says where you are).
export default function MapMinimap({ regions, activeRegionCode, background, viewBoundsM }) {
  const [xMin, yMin, xMax, yMax] = viewBoundsM
  return (
    <svg viewBox={VIEW_BOX} aria-hidden="true" className="pointer-events-none absolute right-2 bottom-2 size-28 rounded border border-slate-600 bg-slate-950">
      {background && (
        <image
          href={background.image}
          x={background.boundsM[0]}
          y={-background.boundsM[3]}
          width={background.boundsM[2] - background.boundsM[0]}
          height={background.boundsM[3] - background.boundsM[1]}
          preserveAspectRatio="none"
        />
      )}
      {regions.map(({ code, boundsM: [x0, y0, x1, y1] }) => (
        <rect key={code} x={x0} y={-y1} width={x1 - x0} height={y1 - y0} fill="none" stroke={code === activeRegionCode ? '#fbbf24' : '#94a3b8'} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      ))}
      <rect x={xMin} y={-yMax} width={xMax - xMin} height={yMax - yMin} fill="none" stroke="#f8fafc" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
