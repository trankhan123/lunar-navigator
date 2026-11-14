import { useMemo } from 'react'
import { formatUtc } from '../core/format.js'
import { metricSentences, moonFacts, neighborLesson } from '../core/learn.js'
import { metricsAt } from '../core/optimizer.js'
import { useI18n } from '../i18n/index.jsx'
import HorizonChart from './HorizonChart.jsx'

const cardClass = 'rounded-lg border border-slate-800 bg-slate-900 p-4'
const toDegrees = (horizon) => horizon.map((tenths) => tenths / 10)

// README W7. Before a search only the Moon facts are shown; onStartSearch opens the Map & scenario screen.
export default function LearnView({ results, cellsById, landingIndex, onStartSearch }) {
  const { t } = useI18n()
  const metrics = useMemo(() => (results ? metricsAt(results, 0, landingIndex) : null), [results, landingIndex])
  // O(cells²) neighbour scan (WF3): fine for one region, so compute it once per landing time.
  const lesson = useMemo(() => (results ? neighborLesson(results, cellsById, landingIndex) : null), [results, cellsById, landingIndex])

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section aria-labelledby="learn-metrics" className={`${cardClass} lg:row-span-2`}>
        <h2 id="learn-metrics" className="mb-1 text-lg font-semibold">{t('learn.metricsTitle')}</h2>
        {metrics ? (
          <>
            <p className="mb-3 text-sm text-slate-400">
              {t('learn.metricsSubtitle', { cellId: metrics.cellId, time: formatUtc(metrics.landingTime) })}
            </p>
            <dl className="space-y-3">
              {metricSentences(metrics).map(({ label, value, sentence }) => (
                <div key={label}>
                  <dt className="flex justify-between gap-3 font-medium">
                    {label} <span className="tabular-nums text-amber-300">{value}</span>
                  </dt>
                  <dd className="text-sm text-slate-300">{sentence}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <p className="text-sm text-slate-300">
            {t('learn.metricsPrompt')}{' '}
            <button type="button" onClick={onStartSearch} className="text-sky-300 underline underline-offset-2 hover:text-sky-200">
              {t('learn.goToMap')}
            </button>
          </p>
        )}
      </section>

      <section aria-labelledby="learn-neighbours" className={cardClass}>
        <h2 id="learn-neighbours" className="mb-1 text-lg font-semibold">{t('learn.neighborTitle')}</h2>
        {lesson ? (
          <>
            <p className="mb-2 text-sm text-slate-300">{lesson.sentence}</p>
            <HorizonChart
              horizonDeg={toDegrees(lesson.darkerCell.horizon)}
              horizonLabel={`${lesson.darkerCell.id}: dark ${lesson.darkerHours} h`}
              compareHorizonDeg={toDegrees(lesson.lighterCell.horizon)}
              compareLabel={`${lesson.lighterCell.id}: dark ${lesson.lighterHours} h`}
              caption="The terrain horizons of two neighbouring cells, all around (N E S W). A ridge a degree higher can hide the low polar Sun for days."
              description={`Horizons of ${lesson.darkerCell.id} and ${lesson.lighterCell.id}, ${lesson.distanceKm.toFixed(1)} km apart. ${lesson.sentence}`}
            />
          </>
        ) : (
          <p className="text-sm text-slate-300">
            {results
              ? t('learn.neighborNoDiff')
              : t('learn.neighborPrompt')}
          </p>
        )}
      </section>

      <section aria-labelledby="learn-moon" className={cardClass}>
        <h2 id="learn-moon" className="mb-2 text-lg font-semibold">{t('learn.moonTitle')}</h2>
        <ul className="space-y-2">
          {moonFacts(metrics).map(({ title, text }) => (
            <li key={title}>
              <p className="font-medium">{title}</p>
              <p className="text-sm text-slate-300">{text}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
