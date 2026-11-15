import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { loadReplay, loadReplayIndex, loadSites, resolveCurrentCell } from '../core/data.js'
import { formatDuration, formatUtc } from '../core/format.js'
import { replaySummary, toWholeHour } from '../core/replay.js'
import { DEFAULT_SCENARIO } from '../core/scenario.js'
import { useI18n } from '../i18n/index.jsx'

const DetailView = lazy(() => import('./DetailView.jsx'))
// Illustrative lander numbers (not the real spacecraft); the replay is about the Sun and Earth geometry.
const REPLAY_SCENARIO = { ...DEFAULT_SCENARIO, stayDays: 14 }

// README E6. One row per real mission: geometry-only sunset prediction next to the actual end of the mission.
export default function MissionReplayCard() {
  const { t } = useI18n()
  const [state, setState] = useState({ status: 'loading' })
  const [shownSiteId, setShownSiteId] = useState(null)

  useEffect(() => {
    Promise.all([loadReplayIndex(), loadSites(false)])
      .then(async ([index, sitesFile]) => {
        const ephemerides = await Promise.all(index.missions.map((mission) => loadReplay(mission.siteId)))
        const rows = index.missions.map((mission, position) => {
          const site = sitesFile.sites.find((candidate) => candidate.id === mission.siteId)
          return { mission, site, ephemeris: { ...ephemerides[position], dsn: null } }
        })
        setState({ status: 'ready', rows })
      })
      .catch((error) => setState({ status: 'error', message: error.message }))
  }, [])

  const rows = useMemo(
    () => (state.status === 'ready' ? state.rows.map((row) => ({ ...row, summary: replaySummary(row.site, row.ephemeris, row.mission) })) : []),
    [state],
  )
  const shown = rows.find((row) => row.mission.siteId === shownSiteId)

  const differenceText = (hours) => {
    const duration = formatDuration(Math.abs(hours))
    return hours < 0 ? t('learn.replayBefore', { duration }) : t('learn.replayAfter', { duration })
  }

  return (
    <section aria-labelledby="learn-replay" className="min-w-0 break-words rounded-lg border border-slate-800 bg-slate-900 p-4 lg:col-span-2">
      <h2 id="learn-replay" className="mb-1 text-lg font-semibold">{t('learn.replayTitle')}</h2>
      <p className="mb-3 text-sm text-slate-300">{t('learn.replayIntro')}</p>
      {state.status === 'loading' && <p className="text-sm text-slate-400">{t('learn.replayLoading')}</p>}
      {state.status === 'error' && <p role="alert" className="text-sm text-red-300">{t('learn.replayError', { message: state.message })}</p>}
      {shown ? (
        <>
          <button type="button" onClick={() => setShownSiteId(null)} className="mb-3 rounded border border-slate-500 px-3 py-1.5 text-sm transition-colors hover:bg-slate-800">
            {t('learn.replayBack')}
          </button>
          <Suspense fallback={<p className="text-slate-400">{t('learn.replayLoading')}</p>}>
            <DetailView
              key={shown.mission.siteId}
              cell={resolveCurrentCell({ type: 'site', siteId: shown.site.id }, {}, [shown.site])}
              currentCell={null}
              ephemeris={shown.ephemeris}
              scenario={REPLAY_SCENARIO}
              landingTime={toWholeHour(shown.mission.landedUtc)}
              mode="simple"
              onLandingTimeChange={() => {}}
              onBack={() => setShownSiteId(null)}
            />
          </Suspense>
        </>
      ) : (
        <ul className="space-y-4">
          {rows.map(({ mission, summary }) => (
            <li key={mission.siteId} className="border-t border-slate-800 pt-3 first:border-t-0 first:pt-0">
              <p className="font-medium">{mission.name}</p>
              <dl className="mt-1 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                <dt className="text-slate-400">{t('learn.replayLanded')}</dt>
                <dd>{mission.landedPrecision === 'day' ? `${mission.landedUtc.slice(0, 10)} ${t('learn.replayDateOnly')}` : formatUtc(mission.landedUtc)}</dd>
                <dt className="text-slate-400">{t('learn.replayPredicted')}</dt>
                <dd className="tabular-nums">
                  {summary.predictedSunsetUtc ? formatUtc(summary.predictedSunsetUtc) : t(summary.reason === 'sun-down-at-landing' ? 'learn.replaySunDown' : 'learn.replayNoSunset')}
                </dd>
                <dt className="text-slate-400">{t('learn.replayEnded')}</dt>
                <dd>
                  {mission.endedUtc ? `${mission.endedPrecision === 'day' ? `${mission.endedUtc.slice(0, 10)} ${t('learn.replayDateOnly')}` : formatUtc(mission.endedUtc)} — ` : `${t('learn.replayNotConfirmed')} — `}
                  {mission.endedReason}
                </dd>
                <dt className="text-slate-400">{t('learn.replayDifference')}</dt>
                <dd className="text-amber-300">
                  {summary.differenceHours === null ? t('learn.replayNotConfirmed') : differenceText(summary.differenceHours)}
                </dd>
              </dl>
              <p className="mt-1 text-xs text-slate-400">
                {t('learn.replaySources')}{' '}
                {mission.sourceUrls.map((url, position) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" className="mr-2 text-sky-300 underline underline-offset-2 hover:text-sky-200">
                    [{position + 1}]
                  </a>
                ))}
              </p>
              <button type="button" onClick={() => setShownSiteId(mission.siteId)} className="mt-2 rounded border border-slate-500 px-3 py-1.5 text-sm transition-colors hover:bg-slate-800">
                {t('learn.replayShow')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
