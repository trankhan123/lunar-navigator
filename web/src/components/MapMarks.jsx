import { VIEW_SIZE_M } from '../core/mapView.js'

const LABEL_STYLE = { fill: '#f8fafc', stroke: '#020617', paintOrder: 'stroke', pointerEvents: 'none' }
// MMO label goes under its frame: the label above it would sit on the NR1 label.
const LABEL_BELOW_FRAME = new Set(['MMO'])

// Region frames, their labels and site pins, sized by 1 / zoomScale so they keep their screen size at every zoom.
// centres: [{regionCode, xM, yM, color, title}] — region-centre dots coloured by the Sun/Earth at the map hour.
export default function MapMarks({ regions, activeRegionCode, pinSites, centres = [], zoomScale, onOpenRegion }) {
  const labelSize = VIEW_SIZE_M / 55 / zoomScale
  const pinRadius = VIEW_SIZE_M / 150 / zoomScale
  const centreRadius = VIEW_SIZE_M / 120 / zoomScale
  const isOverview = activeRegionCode === null
  return (
    <g>
      {regions.map((region) => {
        const [xMin, yMin, xMax, yMax] = region.boundsM
        const isActive = region.code === activeRegionCode
        return (
          <g key={region.code}>
            {/* Frames take clicks at the overview only: an open frame covers its own cells, and frames overlap. */}
            <rect
              x={xMin}
              y={-yMax}
              width={xMax - xMin}
              height={yMax - yMin}
              fill="transparent"
              stroke={isActive ? '#fbbf24' : '#e2e8f0'}
              strokeWidth={isActive ? 2.5 : 1.5}
              vectorEffect="non-scaling-stroke"
              pointerEvents={isOverview ? 'all' : 'none'}
              className={isOverview ? 'cursor-pointer' : undefined}
              onClick={isOverview ? () => onOpenRegion(region.code) : undefined}
            >
              <title>{region.name}</title>
            </rect>
            <text x={(xMin + xMax) / 2} y={LABEL_BELOW_FRAME.has(region.code) ? -yMin + labelSize * 1.1 : -yMax - labelSize * 0.4} textAnchor="middle" fontSize={labelSize} strokeWidth={labelSize * 0.25} style={LABEL_STYLE}>
              {zoomScale < 3 ? region.code : region.name}
            </text>
          </g>
        )
      })}
      {/* A dot sits on its frame, so at the overview it opens the region too; inside a region it must not cover cells. */}
      {centres.map((centre) => (
        <circle
          key={centre.regionCode}
          cx={centre.xM}
          cy={-centre.yM}
          r={centreRadius}
          fill={centre.color}
          stroke="#020617"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          pointerEvents={isOverview ? 'all' : 'none'}
          className={isOverview ? 'cursor-pointer' : undefined}
          onClick={isOverview ? () => onOpenRegion(centre.regionCode) : undefined}
        >
          <title>{centre.title}</title>
        </circle>
      ))}
      {pinSites.map((site) => (
        <g key={site.id} pointerEvents="none">
          <circle cx={site.xM} cy={-site.yM} r={pinRadius} fill="#f8fafc" stroke="#020617" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          {zoomScale >= 3 && (
            <text x={site.xM + pinRadius * 1.6} y={-site.yM + pinRadius * 0.6} fontSize={labelSize * 0.9} strokeWidth={labelSize * 0.22} style={LABEL_STYLE}>
              {site.name}
            </text>
          )}
        </g>
      ))}
    </g>
  )
}
