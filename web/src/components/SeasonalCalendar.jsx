import { useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { computeSeasonalCalendar } from '../core/seasonalCalendar.js'

export default function SeasonalCalendar({ cell, ephemeris }) {
  const [mode, setMode] = useState('sun')

  const calendarData = useMemo(() => {
    return computeSeasonalCalendar(cell, ephemeris)
  }, [cell, ephemeris])

  const isSun = mode === 'sun'
  const data2027 = isSun ? calendarData.sun2027 : calendarData.earth2027
  const data2028 = isSun ? calendarData.sun2028 : calendarData.earth2028

  const option = useMemo(() => {
    const label = isSun ? 'Sunlight' : 'Earth in view'
    const colorRange = isSun
      ? ['#0f172a', '#78350f', '#ca8a04', '#facc15', '#fef08a']
      : ['#0f172a', '#0c4a6e', '#0284c7', '#38bdf8', '#bae6fd']

    return {
      backgroundColor: 'transparent',
      animation: false,
      tooltip: {
        trigger: 'item',
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#f8fafc', fontSize: 12 },
        formatter: (params) => {
          if (!params.value || !params.value[0]) return ''
          const [date, pct] = params.value
          const hours = Math.round((pct * 24) / 100)
          return `<div style="font-weight:600;margin-bottom:2px">${date}</div><div>${label}: <b>${pct}%</b> (${hours}/24 h)</div>`
        },
      },
      visualMap: {
        min: 0,
        max: 100,
        calculable: false,
        orient: 'horizontal',
        left: 'center',
        top: 0,
        itemWidth: 10,
        itemHeight: 60,
        text: ['100%', '0%'],
        textStyle: { color: '#94a3b8', fontSize: 10 },
        inRange: { color: colorRange },
      },
      calendar: [
        {
          range: '2027',
          top: 38,
          left: 42,
          right: 12,
          cellSize: ['auto', 11],
          splitLine: { show: true, lineStyle: { color: '#334155', width: 1 } },
          itemStyle: { borderWidth: 1, borderColor: '#0f172a' },
          yearLabel: { show: true, color: '#cbd5e1', fontSize: 11, margin: 24 },
          dayLabel: { firstDay: 1, color: '#64748b', fontSize: 10, nameMap: 'en' },
          monthLabel: { color: '#94a3b8', fontSize: 10, nameMap: 'en' },
        },
        {
          range: '2028',
          top: 158,
          left: 42,
          right: 12,
          cellSize: ['auto', 11],
          splitLine: { show: true, lineStyle: { color: '#334155', width: 1 } },
          itemStyle: { borderWidth: 1, borderColor: '#0f172a' },
          yearLabel: { show: true, color: '#cbd5e1', fontSize: 11, margin: 24 },
          dayLabel: { firstDay: 1, color: '#64748b', fontSize: 10, nameMap: 'en' },
          monthLabel: { color: '#94a3b8', fontSize: 10, nameMap: 'en' },
        },
      ],
      series: [
        {
          type: 'heatmap',
          coordinateSystem: 'calendar',
          calendarIndex: 0,
          data: data2027,
        },
        {
          type: 'heatmap',
          coordinateSystem: 'calendar',
          calendarIndex: 1,
          data: data2028,
        },
      ],
    }
  }, [isSun, data2027, data2028])

  if (!cell || !ephemeris) return null

  return (
    <figure className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <figcaption className="text-xs font-semibold text-slate-300">Seasonal Calendar (2027–2028)</figcaption>
        <div className="inline-flex rounded-md bg-slate-800 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMode('sun')}
            className={`rounded px-2.5 py-1 font-medium transition-colors ${
              isSun
                ? 'bg-amber-400 font-semibold text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            % Sunlight
          </button>
          <button
            type="button"
            onClick={() => setMode('earth')}
            className={`rounded px-2.5 py-1 font-medium transition-colors ${
              !isSun
                ? 'bg-sky-400 font-semibold text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            % Earth in view
          </button>
        </div>
      </div>
      <div className="overflow-x-auto rounded border border-slate-800/80 bg-slate-950/40 p-1">
        <div style={{ minWidth: 480 }}>
          <ReactECharts option={option} notMerge theme="dark" style={{ height: 260 }} />
        </div>
      </div>
    </figure>
  )
}
