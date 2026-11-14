import ReactECharts from 'echarts-for-react'

const COMPASS = { 0: 'N', 90: 'E', 180: 'S', 270: 'W', 360: 'N' }
// ECharts draws a gap at '-', which pathForChart marks with null where the path wraps across north.
const withGaps = (points) => points.map((point) => point ?? '-')

export default function HorizonChart({ horizonDeg, compareHorizonDeg, compareLabel, sunPath, earthPath, sunNow, earthNow, description }) {
  const pathElevations = [...sunPath, ...earthPath].filter(Boolean).map(([, elevation]) => elevation)
  const allElevations = [...horizonDeg, ...(compareHorizonDeg ?? []), ...pathElevations]
  const terrainLine = (values) => [...values.map((elevation, azimuth) => [azimuth, elevation]), [360, values[0]]]
  const option = {
    backgroundColor: 'transparent',
    animation: false,
    grid: { left: 52, right: 16, top: 40, bottom: 36 },
    legend: { top: 0, textStyle: { color: '#cbd5e1' } },
    tooltip: { trigger: 'item', valueFormatter: (value) => (typeof value === 'number' ? `${value.toFixed(2)}°` : value) },
    xAxis: { type: 'value', min: 0, max: 360, interval: 45, axisLabel: { formatter: (value) => COMPASS[value] ?? `${value}°` } },
    yAxis: {
      type: 'value',
      name: 'Elevation (°)',
      min: Math.floor(Math.min(...allElevations)) - 1,
      max: Math.ceil(Math.max(...allElevations)) + 1,
    },
    series: [
      { name: 'Terrain', type: 'line', data: terrainLine(horizonDeg), showSymbol: false, color: '#94a3b8', areaStyle: { origin: 'start', color: '#475569', opacity: 0.85 }, z: 1 },
      compareHorizonDeg && {
        name: compareLabel,
        type: 'line',
        data: terrainLine(compareHorizonDeg),
        showSymbol: false,
        color: '#f472b6',
        lineStyle: { type: 'dashed' },
        z: 2,
      },
      { name: 'Sun path', type: 'line', data: withGaps(sunPath), showSymbol: false, color: '#fbbf24', lineStyle: { width: 1.5 }, z: 3 },
      { name: 'Earth path', type: 'line', data: withGaps(earthPath), showSymbol: false, color: '#38bdf8', lineStyle: { width: 1.5 }, z: 3 },
      { name: 'Sun now', type: 'scatter', data: [sunNow], symbolSize: 18, color: '#fde047', z: 4 },
      { name: 'Earth now', type: 'scatter', data: [earthNow], symbolSize: 14, color: '#7dd3fc', z: 4 },
    ].filter(Boolean),
  }
  return (
    <figure>
      <div role="img" aria-label={description}>
        <ReactECharts option={option} notMerge theme="dark" style={{ height: 320 }} />
      </div>
      <figcaption className="mt-1 text-xs text-slate-400">
        Terrain horizon all around the cell (N E S W) with the Sun and Earth paths during the stay; dots show the selected hour. Vertical scale
        exaggerated: the horizon is only a few degrees high.
      </figcaption>
    </figure>
  )
}
