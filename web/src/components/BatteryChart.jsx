import ReactECharts from 'echarts-for-react'

const HOUR_MS = 3600 * 1000

export default function BatteryChart({ landingTime, stayHours, sunDiskFraction, earthDiskFraction, batteryWh, capacityWh, deadAtHour, cursorIndex, description }) {
  const startMs = Date.parse(landingTime)
  const timeOf = (hour) => startMs + hour * HOUR_MS
  const percentPoints = (values, count, scale) => Array.from({ length: count }, (_, hour) => [timeOf(hour), Math.round(values[hour] * scale * 10) / 10])
  const option = {
    backgroundColor: 'transparent',
    animation: false,
    grid: { left: 44, right: 16, top: 40, bottom: 36 },
    legend: { top: 0, textStyle: { color: '#cbd5e1' } },
    tooltip: { trigger: 'axis', valueFormatter: (value) => `${value} %` },
    xAxis: { type: 'time' },
    yAxis: { type: 'value', min: 0, max: 100, name: '%' },
    series: [
      {
        name: 'Sun disk visible',
        type: 'line',
        step: 'start',
        data: percentPoints(sunDiskFraction, stayHours, 100),
        showSymbol: false,
        color: '#fbbf24',
        areaStyle: { opacity: 0.2 },
        markLine: { symbol: 'none', silent: true, label: { show: false }, lineStyle: { color: '#f8fafc', type: 'solid' }, data: [{ xAxis: timeOf(cursorIndex) }] },
      },
      { name: 'Earth disk visible', type: 'line', step: 'start', data: percentPoints(earthDiskFraction, stayHours, 100), showSymbol: false, color: '#38bdf8' },
      {
        name: 'Battery charge',
        type: 'line',
        data: percentPoints(batteryWh, stayHours + 1, 100 / capacityWh),
        showSymbol: false,
        color: '#34d399',
        lineStyle: { width: 2.5 },
        markLine:
          deadAtHour === null
            ? undefined
            : { symbol: 'none', silent: true, lineStyle: { color: '#ef4444' }, label: { formatter: 'Battery empty', color: '#fca5a5' }, data: [{ xAxis: timeOf(deadAtHour) }] },
      },
    ],
  }
  return (
    <figure>
      <div role="img" aria-label={description}>
        <ReactECharts option={option} notMerge theme="dark" style={{ height: 280 }} />
      </div>
      <figcaption className="mt-1 text-xs text-slate-400">
        Hour by hour during the stay (UTC). Panels assumed to track the Sun; illustrative lander numbers.
      </figcaption>
    </figure>
  )
}
