import { useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { pgdaPairs } from '../core/validationStats.js'
import { useI18n } from '../i18n/index.jsx'

/** Scatter series data: [NASA %, ours %] per cell. */
const scatterPoints = (validation, body) => pgdaPairs(validation, body).map(([ours, nasa]) => [nasa * 100, ours * 100])

export default function ValidationScatter({ validation }) {
  const { t } = useI18n()
  const [body, setBody] = useState('Sun')
  const option = useMemo(() => {
    const axis = (name, nameGap) => ({
      type: 'value', min: 0, max: 100, name, nameLocation: 'middle', nameGap,
      axisLabel: { color: '#94a3b8' }, nameTextStyle: { color: '#cbd5e1' }, splitLine: { lineStyle: { color: '#1e293b' } },
    })
    return {
      grid: { left: 48, right: 16, top: 12, bottom: 44 },
      xAxis: axis(t('validation.axisNasa'), 28),
      yAxis: axis(t('validation.axisOurs'), 34),
      tooltip: { formatter: ({ value }) => `${value[0].toFixed(1)} % / ${value[1].toFixed(1)} %` },
      series: [
        { type: 'scatter', symbolSize: 5, itemStyle: { color: '#38bdf8', opacity: 0.7 }, data: scatterPoints(validation, body) },
        { type: 'line', data: [[0, 0], [100, 100]], symbol: 'none', silent: true, lineStyle: { type: 'dashed', color: '#94a3b8' } },
      ],
    }
  }, [validation, body, t])
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <h3 className="mr-auto font-medium text-slate-100">{t('validation.scatterTitle')}</h3>
        {['Sun', 'Earth'].map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={body === name}
            onClick={() => setBody(name)}
            className={`rounded border px-2 py-0.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${body === name ? 'border-sky-400 text-sky-200' : 'border-slate-700 text-slate-400'}`}
          >
            {t(`validation.tab${name}`)}
          </button>
        ))}
      </div>
      <ReactECharts option={option} style={{ height: 300 }} />
    </div>
  )
}
