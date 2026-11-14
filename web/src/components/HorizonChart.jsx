import ReactECharts from 'echarts-for-react'

export default function HorizonChart({ site, timeIndex }) {
  const option = {
    backgroundColor: 'transparent',
    legend: { textStyle: { color: '#e2e8f0' } },
    tooltip: { trigger: 'item' },
    xAxis: { type: 'value', min: 0, max: 360, interval: 45, name: 'Azimuth (°)' },
    yAxis: { type: 'value', name: 'Elevation (°)' },
    series: [
      {
        name: 'Terrain',
        type: 'line',
        data: site.horizon.map((elevation, azimuth) => [azimuth, elevation]),
        showSymbol: false,
        areaStyle: { opacity: 0.6 },
        color: '#64748b',
      },
      { name: 'Sun', type: 'scatter', data: [site.sun[timeIndex]], symbolSize: 16, color: '#facc15' },
      { name: 'Earth', type: 'scatter', data: [site.earth[timeIndex]], symbolSize: 16, color: '#38bdf8' },
    ],
  }
  return <ReactECharts option={option} theme="dark" style={{ height: 320 }} />
}
