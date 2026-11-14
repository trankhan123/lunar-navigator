import { useEffect, useMemo, useRef, useState } from 'react'
import { timeAtHour } from '../core/data.js'
import { buildDetail, pathForChart, summarySentence, toCsv } from '../core/detail.js'
import { cellDisplayName, formatUtc, hasNoTerrain } from '../core/format.js'
import { useI18n } from '../i18n/index.jsx'
import BatteryChart from './BatteryChart.jsx'
import CompareView from './CompareView.jsx'
import CountdownCard from './CountdownCard.jsx'
import HorizonChart from './HorizonChart.jsx'

const PLAY_STEP_MS = 250
const horizonDegrees = (horizon) => (horizon ? horizon.map((tenths) => tenths / 10) : Array(360).fill(0))
const percent = (fraction) => `${Math.round(fraction * 100)} %`

function downloadCsv(text, fileName) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }))
  const link = Object.assign(document.createElement('a'), { href: url, download: fileName })
  link.click()
  URL.revokeObjectURL(url)
}

// App renders this with key = cell id + landing time, so the hour cursor starts at 0 for every new detail.
export default function DetailView({ cell, currentCell, ephemeris, scenario, landingTime, mode, onLandingTimeChange, onBack }) {
  const { t } = useI18n()
  const [cursor, setCursor] = useState(0)
  const [playing, setPlaying] = useState(false)
  const headingRef = useRef(null)
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const built = useMemo(() => {
    try {
      return { detail: buildDetail(cell, ephemeris, scenario, landingTime) }
    } catch (error) {
      return { error } // a landing time outside the ephemeris is a user input problem, shown next to the input
    }
  }, [cell, ephemeris, scenario, landingTime])
  const detail = built.detail
  const compareDetail = useMemo(
    () => (detail && currentCell && currentCell.id !== cell.id ? buildDetail(currentCell, ephemeris, scenario, landingTime) : null),
    [detail, currentCell, cell.id, ephemeris, scenario, landingTime],
  )

  useEffect(() => {
    if (!playing || !detail) return
    const timer = setTimeout(() => setCursor((hour) => (hour + 1) % detail.stayHours), PLAY_STEP_MS)
    return () => clearTimeout(timer)
  }, [playing, cursor, detail])

  const firstTime = timeAtHour(ephemeris, 0)
  const lastTime = timeAtHour(ephemeris, ephemeris.hours - 1)
  const header = (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={onBack} className="rounded border border-slate-500 px-3 py-1.5 text-sm transition-colors hover:bg-slate-800">
        {t('detail.back')}
      </button>
      <h2 ref={headingRef} tabIndex={-1} className="font-mono text-lg font-semibold focus:outline-none">
        {cellDisplayName(cell)}
      </h2>
      {hasNoTerrain(cell) && <p className="text-xs text-slate-400">{t('currentPoint.noTerrain')}</p>}
      <label className="text-sm text-slate-300">
        {t('detail.landingUtc')}{' '}
        <input
          type="datetime-local"
          step={3600}
          min={firstTime.slice(0, 16)}
          max={lastTime.slice(0, 16)}
          value={landingTime.slice(0, 16)}
          onChange={(event) => event.target.value && onLandingTimeChange(`${event.target.value.slice(0, 13)}:00Z`)}
          className="rounded border border-slate-500 bg-slate-950 px-2 py-1 tabular-nums"
        />
      </label>
      <span className="text-sm text-slate-400">{t('detail.stayDays', { days: scenario.stayDays })}</span>
    </div>
  )
  if (!detail) {
    return (
      <section className="space-y-3">
        {header}
        <p role="alert" className="text-red-400">
          No data for this landing time ({built.error.message}). Pick a time between {formatUtc(firstTime)} and {formatUtc(lastTime)}.
        </p>
      </section>
    )
  }

  const { sun, earth, battery, energy, sunSummary, earthSummary } = detail
  const cursorTime = timeAtHour(ephemeris, detail.landingHour + cursor)
  const sentence = summarySentence(detail, cellDisplayName(cell), cursor)
  const metrics = [
    [t('detail.longestDark'), `${sunSummary.longestDarkHours} h`],
    [t('detail.timeSunlight'), percent(sunSummary.fractionSun)],
    [t('detail.meanSunElevation'), sunSummary.meanSunElevationDeg === null ? '—' : `${sunSummary.meanSunElevationDeg.toFixed(2)}°`],
    [t('detail.longestCommLoss'), `${earthSummary.longestCommLossHours} h`],
    [t('detail.earthInView'), percent(earthSummary.fractionEarth)],
    [t('detail.lowestBattery'), percent(battery.minBatteryFraction)],
    [t('detail.batteryEmptyAfter'), battery.deadAtHour === null ? t('detail.never') : `${battery.deadAtHour} h`],
    [t('detail.rechargedAfter'), battery.rechargeHours === null ? t('detail.notWithinStay') : `${battery.rechargeHours} h`],
    [t('detail.batteryNeeded'), `${(energy.minimumCapacityWh / 1000).toFixed(1)} kWh`],
  ]

  return (
    <section className="space-y-4">
      {header}
      <p className="text-base text-slate-100">{sentence}</p>
      {detail.stayHours < scenario.stayDays * 24 && (
        <p className="text-sm text-amber-300">
          {t('detail.stayTruncated', { lastTime: formatUtc(lastTime), hours: detail.stayHours })}
        </p>
      )}
      <CountdownCard sunTrack={sun} earthTrack={earth} atIndex={cursor} trackHours={detail.trackHours} />

      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-pressed={playing}
          onClick={() => setPlaying(!playing)}
          className="w-20 rounded bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-900 transition-colors hover:bg-white"
        >
          {playing ? t('detail.pause') : t('detail.play')}
        </button>
        <label className="flex-1 text-sm text-slate-300">
          {t('detail.hourOfStay', { hour: cursor })} <span className="tabular-nums text-slate-100">{formatUtc(cursorTime)}</span>
          <input
            type="range"
            min={0}
            max={detail.stayHours - 1}
            value={cursor}
            onChange={(event) => setCursor(Number(event.target.value))}
            className="block w-full accent-amber-400"
          />
        </label>
      </div>

      <HorizonChart
        horizonDeg={horizonDegrees(cell.horizon)}
        compareHorizonDeg={compareDetail ? horizonDegrees(currentCell.horizon) : null}
        compareLabel={compareDetail ? `${cellDisplayName(currentCell)} terrain (current point)` : null}
        sunPath={pathForChart(sun.azimuthDeg, sun.elevationDeg, 0, detail.stayHours)}
        earthPath={pathForChart(earth.azimuthDeg, earth.elevationDeg, 0, detail.stayHours)}
        sunNow={[sun.azimuthDeg[cursor], sun.elevationDeg[cursor]]}
        earthNow={[earth.azimuthDeg[cursor], earth.elevationDeg[cursor]]}
        description={`Horizon chart for ${cellDisplayName(cell)}. ${sentence}`}
      />
      <BatteryChart
        landingTime={landingTime}
        stayHours={detail.stayHours}
        sunDiskFraction={sun.diskFraction}
        earthDiskFraction={earth.diskFraction}
        batteryWh={battery.batteryWh}
        capacityWh={scenario.batteryCapacityWh}
        deadAtHour={battery.deadAtHour}
        cursorIndex={cursor}
        description={`Sun, Earth and battery over the stay. Lowest battery ${percent(battery.minBatteryFraction)}, longest dark period ${sunSummary.longestDarkHours} h.`}
      />

      {compareDetail && <CompareView current={{ cell: currentCell, detail: compareDetail }} other={{ cell, detail }} />}

      {mode === 'expert' && (
        <section aria-labelledby="metrics-title" className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 id="metrics-title" className="font-medium">{t('detail.numbersTitle')}</h3>
            <button
              type="button"
              onClick={() => downloadCsv(toCsv(detail, ephemeris), `${cell.id}_${landingTime.replace(/:/g, '')}.csv`)}
              className="rounded border border-slate-500 px-3 py-1.5 transition-colors hover:bg-slate-800"
            >
              {t('detail.downloadCsv')}
            </button>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            {metrics.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-slate-400">{label}</dt>
                <dd className="tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </section>
  )
}
