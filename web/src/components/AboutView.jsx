import { useEffect, useState } from 'react'
import { loadValidation } from '../core/data.js'
import { useI18n } from '../i18n/index.jsx'

const LIMITATIONS = [
  'Ephemeris and simulation run in 1-hour steps; countdowns interpolate between hours, so they can be off by minutes up to about an hour.',
  'The visible part of the Sun or Earth disk is a linear approximation.',
  'The terrain horizon is computed at the centre of each 1 km cell from 80 m LOLA terrain, so boulders and small ridges are not seen.',
  'Sites outside the terrain model use a smooth-sphere horizon ("terrain not included").',
  'The battery model is simple: constant load, no temperature effects, no panel or battery ageing.',
  '"Earth visible" does not check whether a ground station on Earth can see the Moon at that time.',
  'This is a hackathon project, not an official NASA tool.',
]

const SOURCES = [
  ['JPL Horizons API', 'Sub-solar and sub-Earth points on the Moon, every hour 2027–2029 (DE441).'],
  ['NASA GSFC PGDA 90 (LOLA)', 'South-pole terrain, slope, permanent shadow and hillshade.'],
  ['NASA GSFC PGDA 69', 'Average Sun and Earth visibility, used to validate our results.'],
  ['USGS LGRS grid', '1 km Artemis III region grids (McClernan 2024) following USGS Techniques and Methods 11-E1.'],
  ['NASA SVS 4720', 'Moon colour texture for the globe.'],
]

const percent = (fraction) => (fraction * 100).toFixed(1)
const signedPoints = (fraction) => `${fraction >= 0 ? '+' : '−'}${Math.abs(fraction * 100).toFixed(1)}`

// Horizons check and the PGDA 69 comparison from validation.json (written by pipeline/validate.py).
function ValidationDetails({ validation, t }) {
  const { horizons, pgda69Stats: stats = [] } = validation
  const overall = stats.find((entry) => entry.region === 'ALL')
  const headerCell = 'px-2 py-1 text-right font-medium text-slate-100'
  return (
    <div className="space-y-3">
      <p>{t('about.horizonsCheck', { azimuth: horizons.maxAzimuthErrorDeg, elevation: horizons.maxElevationErrorDeg, count: horizons.pointCount })}</p>
      {overall && (
        <>
          <p>{t('about.pgdaMethod', { cells: overall.sun.halfDisk.n })}</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-xs tabular-nums">
              <thead>
                <tr className="border-b border-slate-700">
                  <th rowSpan={2} className="px-2 py-1 text-left font-medium text-slate-100">{t('about.tableRegion')}</th>
                  <th rowSpan={2} className={headerCell}>{t('about.tableCells')}</th>
                  <th colSpan={4} className={headerCell}>{t('about.tableSun')}</th>
                  <th colSpan={4} className={headerCell}>{t('about.tableEarth')}</th>
                </tr>
                <tr className="border-b border-slate-700">
                  {['Sun', 'Earth'].flatMap((body) => [t('about.tableOurs'), t('about.tableNasa'), t('about.tableRmse'), 'r'].map((label) => (
                    <th key={body + label} className={headerCell}>{label}</th>
                  )))}
                </tr>
              </thead>
              <tbody>
                {[...stats.slice(-1), ...stats.slice(0, -1)].map(({ region, sun, earth }) => (
                  <tr key={region} className={`border-b border-slate-800 ${region === 'ALL' ? 'font-semibold text-slate-100' : ''}`}>
                    <td className="px-2 py-1">{region === 'ALL' ? t('about.tableAll') : region}</td>
                    <td className="px-2 py-1 text-right">{sun.halfDisk.n}</td>
                    {[sun.halfDisk, earth.halfDisk].flatMap((row, index) => [
                      percent(row.meanOurs), percent(row.meanPgda), percent(row.rmse), row.pearsonR.toFixed(3),
                    ].map((value, column) => <td key={`${index}-${column}`} className="px-2 py-1 text-right">{value}</td>))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            {t('about.pgdaReading', {
              sunR: overall.sun.halfDisk.pearsonR.toFixed(2),
              earthR: overall.earth.halfDisk.pearsonR.toFixed(2),
              sunDiff: signedPoints(overall.sun.halfDisk.meanDifference),
              earthDiff: signedPoints(overall.earth.halfDisk.meanDifference),
              sunAny: percent(overall.sun.anyPart.meanOurs),
              earthAny: percent(overall.earth.anyPart.meanOurs),
            })}
          </p>
        </>
      )}
      <p>{t('about.libration')}</p>
    </div>
  )
}

export default function AboutView() {
  const { t } = useI18n()
  const [validation, setValidation] = useState(null)
  useEffect(() => {
    loadValidation(false).then(setValidation).catch(() => setValidation(null))
  }, [])
  return (
    <article className="max-w-3xl space-y-6 text-sm leading-relaxed text-slate-300">
      <section>
        <h2 className="mb-2 text-base font-semibold text-slate-100">{t('about.whatTitle')}</h2>
        <p>
          Enter your planned landing point at the lunar south pole and your mission limits. The tool simulates the Sun, the
          Earth and your battery hour by hour for every nearby 1 km cell and every landing time, then ranks the best cells and
          dates. It answers the two questions a slipped launch raises: another site in the same region, or another date at the
          same site?
        </p>
      </section>
      <section>
        <h2 className="mb-2 text-base font-semibold text-slate-100">{t('about.dataTitle')}</h2>
        <dl className="space-y-1">
          {SOURCES.map(([name, use]) => (
            <div key={name}>
              <dt className="inline font-medium text-slate-100">{name}: </dt>
              <dd className="inline">{use}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section>
        <h2 className="mb-2 text-base font-semibold text-slate-100">{t('about.validationTitle')}</h2>
        {validation ? <ValidationDetails validation={validation} t={t} /> : <p>{t('about.pgdaUnavailable')}</p>}
      </section>
      <section>
        <h2 className="mb-2 text-base font-semibold text-slate-100">{t('about.limitationsTitle')}</h2>
        <ul className="list-disc space-y-1 pl-5">
          {LIMITATIONS.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
          <li>{t('about.limitationQuickmap')}</li>
        </ul>
      </section>
      <section>
        <h2 className="mb-2 text-base font-semibold text-slate-100">AI usage</h2>
        <p>Parts of this project were built with Claude Code (Anthropic). The repository file AI_USAGE.md lists where.</p>
      </section>
    </article>
  )
}
