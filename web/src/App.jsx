import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AboutView from './components/AboutView.jsx'
import BestPairsTable from './components/BestPairsTable.jsx'
import CellPopup from './components/CellPopup.jsx'
import CurrentPointCard from './components/CurrentPointCard.jsx'
import CurrentPointStrip from './components/CurrentPointStrip.jsx'
import LandingTimeSlider from './components/LandingTimeSlider.jsx'
import MapTimeBar from './components/MapTimeBar.jsx'
import LanguageSwitcher from './components/LanguageSwitcher.jsx'
import RankingTable from './components/RankingTable.jsx'
import ScenarioForm from './components/ScenarioForm.jsx'
import ScreenErrorBoundary from './components/ScreenErrorBoundary.jsx'
import SouthPoleMap from './components/SouthPoleMap.jsx'
import { hourIndexOf, loadCells, loadEphemeris, loadMaps, loadRegions, loadSites, resolveCurrentCell, toPolarXY } from './core/data.js'
import { cellDisplayName } from './core/format.js'
import { nearestRegionCode } from './core/mapSearch.js'
import { clampHour, mapHourRange } from './core/mapSky.js'
import { isCellOnPolarMap } from './core/mapView.js'
import { rankBestPairs, rankCells, selectSearchCells, summarizeCurrentPoint } from './core/optimizer.js'
import { validateScenario } from './core/scenario.js'
import { decodeShareQuery, encodeShareQuery } from './core/shareLink.js'
import { startWindowSearch } from './core/startWindowSearch.js'
import { useI18n } from './i18n/index.jsx'

// The globe pulls in three.js and the detail screen pulls in ECharts (most of the bundle): load each when first opened.
const MoonGlobe = lazy(() => import('./components/MoonGlobe.jsx'))
const DetailView = lazy(() => import('./components/DetailView.jsx'))
const LearnView = lazy(() => import('./components/LearnView.jsx'))

const SCREENS = [
  ['map', 'nav.map', 'Map & scenario'],
  ['results', 'nav.results', 'Results'],
  ['detail', 'nav.detail', 'Cell detail'],
  ['globe', 'nav.globe', 'Globe'],
  ['learn', 'nav.learn', 'Learn'],
  ['about', 'nav.about', 'About'],
]
const forceMock = new URLSearchParams(window.location.search).get('mock') === '1'
const initialState = decodeShareQuery(window.location.search.slice(1))
const initialCellId = initialState.selectedCellId ?? initialState.scenario.currentPoint?.cellId ?? null
const selectClass = 'rounded border border-slate-500 bg-slate-950 px-2 py-1'
const SMALLER_IS_BETTER = new Set(['distanceKm', 'longestDarkHours', 'longestCommLossHours', 'rechargeHours']) // README C5 rule

async function loadAllData() {
  // Real data is used once module D5 publishes regions.json; until then cells and sites come from the mock folder.
  let regionsFile = forceMock ? null : await loadRegions(false).catch(() => null)
  const useMock = regionsFile === null
  if (useMock) regionsFile = await loadRegions(true)
  // The real ephemeris (D1) exists already, so even mock cells get real Sun and Earth positions.
  const [ephemeris, sitesFile, maps] = await Promise.all([
    loadEphemeris(false).catch(() => loadEphemeris(true)),
    loadSites(useMock),
    useMock ? [] : loadMaps(),
  ])
  return { useMock, ephemeris, regions: regionsFile.regions, sites: sitesFile.sites, maps }
}

/** Regions whose cells the search needs: all of them for radius/all scopes, else the current point's region. */
function regionCodesForSearch(scenario, regions, sites) {
  if (scenario.searchScope !== 'region') return regions.map((region) => region.code)
  const point = scenario.currentPoint
  if (point.type === 'cell') return [point.cellId.split('-')[0]]
  if (point.type === 'site') return [sites.find((site) => site.id === point.siteId)?.region].filter(Boolean)
  const { xM, yM } = toPolarXY(point.lat, point.lon)
  return regions
    .filter(({ boundsM: [x0, y0, x1, y1] }) => xM !== null && xM >= x0 && xM <= x1 && yM >= y0 && yM <= y1)
    .map((region) => region.code)
}

export default function App() {
  const { t } = useI18n()
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [cellsByRegion, setCellsByRegion] = useState({})
  const [regionCode, setRegionCode] = useState(initialCellId?.split('-')[0] ?? null)
  const [screen, setScreen] = useState(SCREENS.some(([id]) => id === initialState.screen) ? initialState.screen : 'map')
  const [mode, setMode] = useState(initialState.mode)
  const [scenario, setScenario] = useState(initialState.scenario)
  const [selectedCellId, setSelectedCellId] = useState(initialState.selectedCellId)
  const [landingTime, setLandingTime] = useState(initialState.landingTime)
  const [mapHour, setMapHour] = useState(null) // the Map screen's own hour (time bar); null = follow the landing time
  const [mapFocus, setMapFocus] = useState(null) // {boundsM, requestId} after a find-box pick of a site or cell
  const focusRequests = useRef(0)
  const [search, setSearch] = useState({ status: 'idle' })
  const [ranking, setRanking] = useState({ sortBy: undefined, direction: undefined })
  const cellRequests = useRef(new Map()) // region code → pending or finished request, so each file is fetched once
  const latestSearch = useRef(0)
  const cancelSearch = useRef(null)
  const resultsHeading = useRef(null)
  const autoRunPending = useRef(initialState.screen === 'results' && Boolean(initialState.scenario.currentPoint))

  useEffect(() => {
    loadAllData().then(setData).catch((error) => setLoadError(error.message))
  }, [])

  const loadRegionCells = useCallback(
    (region) => {
      if (!cellRequests.current.has(region.code)) {
        const request = loadCells(data.useMock, region.cellsFile)
          .then((file) => {
            setCellsByRegion((loaded) => ({ ...loaded, [region.code]: file.cells }))
            return file.cells
          })
          .catch((error) => {
            cellRequests.current.delete(region.code) // allow a retry
            throw error
          })
        cellRequests.current.set(region.code, request)
      }
      return cellRequests.current.get(region.code)
    },
    [data],
  )

  // null = the south-pole overview (README W2); a link with a cell opens that cell's region.
  const activeRegion = data?.regions.find((region) => region.code === regionCode) ?? null
  useEffect(() => {
    if (activeRegion) loadRegionCells(activeRegion).catch((error) => setLoadError(error.message))
  }, [activeRegion, loadRegionCells])

  useEffect(() => {
    // Debounced: browsers throttle history updates (Safari throws after ~100 per 10 s), e.g. while dragging a slider.
    const timer = setTimeout(() => {
      try {
        window.history.replaceState(null, '', `?${encodeShareQuery({ scenario, landingTime, selectedCellId, mode, screen })}${forceMock ? '&mock=1' : ''}`)
      } catch {
        // rate-limited; the next change writes the URL again
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [scenario, landingTime, selectedCellId, mode, screen])

  useEffect(() => {
    if (screen === 'results') resultsHeading.current?.focus()
  }, [screen])

  function rejectSharedScenario(linkErrors) {
    const reasons = linkErrors.map((error) => `${error.field}: ${error.message}`).join('; ')
    setSearch({ status: 'error', message: `the scenario in this link is not valid (${reasons}). Fix it on the Map & scenario screen.` })
  }

  async function runSearch(searchScenario) {
    cancelSearch.current?.()
    const searchId = ++latestSearch.current
    const isLatest = () => searchId === latestSearch.current
    setScreen('results')
    setSearch({ status: 'running', doneCells: 0, totalCells: 0 })
    try {
      const codes = regionCodesForSearch(searchScenario, data.regions, data.sites)
      const neededRegions = data.regions.filter((region) => codes.includes(region.code))
      const loadedLists = await Promise.all(neededRegions.map(async (region) => [region.code, await loadRegionCells(region)]))
      if (!isLatest()) return
      const loaded = { ...cellsByRegion, ...Object.fromEntries(loadedLists) }
      const currentCell = resolveCurrentCell(searchScenario.currentPoint, loaded, data.sites)
      const cells = selectSearchCells(searchScenario, currentCell, loaded)
      // Open the searched region so the Results map shows its ✓ ! ✕ colours: the current point's own region, else the region of the
      // nearest searched grid cell (a site with no region, coordinates outside every frame); otherwise keep the open one.
      const ownRegion = regionCodesForSearch({ ...searchScenario, searchScope: 'region' }, data.regions, data.sites)[0]
      const searchedRegion = ownRegion ?? nearestRegionCode(currentCell, cells, data.regions)
      if (searchedRegion) {
        setRegionCode(searchedRegion)
        setMapFocus(null)
      }
      const { promise, cancel } = startWindowSearch({
        cells,
        ephemeris: data.ephemeris,
        scenario: searchScenario,
        onProgress: (doneCells, totalCells) => isLatest() && setSearch({ status: 'running', doneCells, totalCells }),
      })
      cancelSearch.current = cancel
      const results = await promise
      if (!isLatest()) return
      setSearch({ status: 'done', results, scenario: searchScenario })
      setLandingTime((time) => (results.landingTimes.includes(time) ? time : results.landingTimes[0]))
    } catch (error) {
      if (isLatest()) setSearch({ status: 'error', message: error.message })
    }
  }

  // README W1: a link opened on the Results screen with a valid scenario runs its search once the data is in.
  useEffect(() => {
    if (!data || !autoRunPending.current) return
    autoRunPending.current = false
    const linkErrors = validateScenario(initialState.scenario, data.ephemeris)
    // One-time reaction to the async data load (not a render-derived value), so setState here is intended.
    // eslint-disable-next-line react/set-state-in-effect
    if (linkErrors.length === 0) runSearch(initialState.scenario)
    // eslint-disable-next-line react/set-state-in-effect
    else rejectSharedScenario(linkErrors)
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps -- runs once, with the scenario from the link

  const results = search.status === 'done' ? search.results : null
  const landingIndex = results ? Math.max(0, results.landingTimes.indexOf(landingTime)) : 0
  const selectLanding = useCallback((index) => setLandingTime(results.landingTimes[index]), [results])
  const statusByCellId = useMemo(
    () => results && new Map(results.cellIds.map((cellId, cellIndex) => [cellId, results.status[cellIndex * results.landingCount + landingIndex]])),
    [results, landingIndex],
  )
  const rankedRows = useMemo(() => results && rankCells(results, landingIndex, { ...ranking, limit: 10 }), [results, landingIndex, ranking])
  const bestPairs = useMemo(() => results && rankBestPairs(results, { limit: 10 }), [results])
  const currentPointSummary = useMemo(() => results && summarizeCurrentPoint(results, landingIndex), [results, landingIndex])

  const selectCell = useCallback((cell) => setSelectedCellId(cell.id), [])
  const openRegion = useCallback((code, { cellId = null, focusBoundsM = null } = {}) => {
    setRegionCode(code)
    setSelectedCellId(cellId)
    setMapFocus(focusBoundsM ? { boundsM: focusBoundsM, requestId: ++focusRequests.current } : null)
  }, [])
  const needRegionCells = useCallback(
    (code) => {
      const region = data?.regions.find((candidate) => candidate.code === code)
      if (region) loadRegionCells(region).catch((error) => setLoadError(error.message))
    },
    [data, loadRegionCells],
  )
  const selectSite = useCallback((site) => setScenario((current) => ({ ...current, currentPoint: { type: 'site', siteId: site.id } })), [])
  const errors = useMemo(() => (data ? validateScenario(scenario, data.ephemeris) : []), [data, scenario])
  const viewHour = useMemo(() => {
    try {
      return data ? hourIndexOf(data.ephemeris, landingTime ?? `${scenario.startDate}T00:00Z`) : null
    } catch {
      return null // date outside the ephemeris; the form reports it
    }
  }, [data, landingTime, scenario.startDate])
  // Map screen time (spec §5.3): starts at the landing time, else startDate 00:00, and stays inside the form's dates.
  const mapRange = useMemo(() => data && mapHourRange(data.ephemeris, scenario.startDate, scenario.endDate), [data, scenario.startDate, scenario.endDate])
  const shownMapHour = mapRange ? clampHour(mapHour ?? viewHour, mapRange) : viewHour
  const mapTimeBar = useMemo(
    () =>
      mapRange ? (
        <MapTimeBar ephemeris={data.ephemeris} range={mapRange} hour={shownMapHour} onChange={setMapHour} />
      ) : (
        <p className="mt-2 text-sm text-slate-400">Pick valid dates in the form to move the map through time.</p>
      ),
    [data, mapRange, shownMapHour],
  )
  // The Results map's hour is the landing time its ✓ ! ✕ colours describe; an off-grid time set in Detail makes landingIndex fall back to 0.
  const resultsHour = useMemo(() => (results ? hourIndexOf(data.ephemeris, results.landingTimes[landingIndex]) : null), [data, results, landingIndex])
  // Memoised: a fresh object on every render would restart the % layer's 400 ms wait each time Play re-renders the app.
  const resultsRange = useMemo(
    () => (search.status === 'done' ? mapHourRange(data.ephemeris, search.scenario.startDate, search.scenario.endDate) : null),
    [data, search],
  )
  // The point that was searched (not the form's live one), to name it and to decide whether the polar map and cell table apply.
  const searchedPoint = useMemo(() => {
    try {
      return search.status === 'done' ? resolveCurrentCell(search.scenario.currentPoint, cellsByRegion, data.sites) : null
    } catch {
      return null
    }
  }, [data, search, cellsByRegion])
  const cellsById = useMemo(() => new Map(Object.values(cellsByRegion).flat().map((cell) => [cell.id, cell])), [cellsByRegion])
  const currentCell = useMemo(() => {
    try {
      return data ? resolveCurrentCell(scenario.currentPoint, cellsByRegion, data.sites) : null
    } catch {
      return null // no current point chosen yet, or its region is not loaded yet
    }
  }, [data, scenario.currentPoint, cellsByRegion])

  // First click sorts a column better-first (README C5 "Sorting by column"), the next click reverses it.
  function sortRanking(key) {
    const betterFirst = SMALLER_IS_BETTER.has(key) ? 'asc' : 'desc'
    const reversed = betterFirst === 'asc' ? 'desc' : 'asc'
    setRanking((current) => ({ sortBy: key, direction: current.sortBy === key && current.direction === betterFirst ? reversed : betterFirst }))
  }

  function openDetail(cellId, time) {
    setSelectedCellId(cellId)
    if (time) setLandingTime(time)
    setScreen('detail')
  }

  const cells = activeRegion ? (cellsByRegion[activeRegion.code] ?? null) : null
  const selectedCell = cells?.find((cell) => cell.id === selectedCellId) ?? null
  const detailCell = cellsById.get(selectedCellId) ?? (currentCell?.id === selectedCellId ? currentCell : null)
  const detailScenario = search.status === 'done' ? search.scenario : scenario
  const detailLandingTime = landingTime ?? `${detailScenario.startDate}T00:00Z`
  const currentCellId = scenario.currentPoint?.type === 'cell' ? scenario.currentPoint.cellId : null

  const regionPicker = data && (
    <label className="text-sm text-slate-300">
      {t('picker.region')}{' '}
      <select value={activeRegion?.code ?? ''} onChange={(event) => openRegion(event.target.value || null)} className={selectClass}>
        <option value="">South pole (all regions)</option>
        {data.regions.map((region) => (
          <option key={region.code} value={region.code}>{region.name}</option>
        ))}
      </select>
    </label>
  )
  const mapProps = data && {
    regions: data.regions,
    activeRegion,
    maps: data.maps,
    cells,
    sites: data.sites,
    ephemeris: data.ephemeris,
    statusByCellId,
    currentCellId,
    selectedCellId,
    onSelectCell: selectCell,
    onOpenRegion: openRegion,
    focus: mapFocus,
    cellsByRegion,
    onNeedRegionCells: needRegionCells,
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-4 pt-3">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2">
          <div className="mr-auto">
            <h1 className="text-lg font-semibold">{t('header.title')}</h1>
            <p className="text-xs text-slate-400">{t('header.subtitle')}</p>
          </div>
          {data?.useMock && <span className="rounded bg-amber-500 px-2 py-0.5 text-xs font-bold text-slate-950">{t('header.mockBadge')}</span>}
          <div className="flex flex-wrap items-center gap-2">
            <LanguageSwitcher />
            <div className="flex rounded-md border border-slate-500 p-0.5 text-sm" role="group" aria-label={t('header.detailLevel')}>
              {[
                ['simple', t('header.simple')],
                ['expert', t('header.expert')],
              ].map(([option, label]) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={mode === option}
                  onClick={() => setMode(option)}
                  className={`rounded px-3 py-1.5 transition-colors ${mode === option ? 'bg-slate-100 text-slate-900' : 'text-slate-300 hover:bg-slate-800'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <nav className="mx-auto mt-2 flex max-w-7xl gap-1 overflow-x-auto" aria-label="Screens">
          {SCREENS.map(([id, labelKey, defaultLabel]) => (
            <button
              key={id}
              type="button"
              aria-current={screen === id ? 'page' : undefined}
              onClick={() => setScreen(id)}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors ${screen === id ? 'border-amber-400 text-slate-100' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              {t(labelKey) || defaultLabel}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 p-4">
        {loadError && <p role="alert" className="mb-4 text-red-400">Could not load data: {loadError}</p>}
        {!data && !loadError && <p className="text-slate-400">{t('picker.loadingData')}</p>}

        <ScreenErrorBoundary key={screen}>
          {data && screen === 'map' && (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
              <section aria-labelledby="map-title">
                <div className="mb-2 flex flex-wrap items-center gap-3">
                  <h2 id="map-title" className="font-medium">South pole landing cells</h2>
                  {regionPicker}
                  {activeRegion && (
                    <label className="text-sm text-slate-300">
                      {t('picker.cell')}{' '}
                      <select value={selectedCell ? selectedCellId : ''} onChange={(event) => setSelectedCellId(event.target.value || null)} className={`${selectClass} font-mono`}>
                        <option value="">{t('picker.choose')}</option>
                        {cells?.map((cell) => (
                          <option key={cell.id} value={cell.id}>
                            {cell.id}
                            {cell.feasible ? '' : ` ${t('picker.notFeasible')}`}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                <SouthPoleMap {...mapProps} hour={shownMapHour} hourRange={mapRange} stayDays={scenario.stayDays} defaultLayerId="sunNow" timeBar={mapTimeBar} />
              </section>
              <aside className="space-y-4">
                {selectedCell && (
                  <CellPopup
                    key={selectedCell.id}
                    cell={selectedCell}
                    ephemeris={data.ephemeris}
                    hour={shownMapHour}
                    isCurrent={selectedCell.id === currentCellId}
                    onUseAsCurrent={() => setScenario((current) => ({ ...current, currentPoint: { type: 'cell', cellId: selectedCell.id } }))}
                    onOpenDetail={() => openDetail(selectedCell.id)}
                    onClose={() => setSelectedCellId(null)}
                  />
                )}
                <ScenarioForm
                  mode={mode}
                  value={scenario}
                  errors={errors}
                  sites={data.sites}
                  busy={search.status === 'running'}
                  onChange={setScenario}
                  onSubmit={runSearch}
                />
              </aside>
            </div>
          )}

          {data && screen === 'results' && (
            <section aria-labelledby="results-title" aria-busy={search.status === 'running'} className="space-y-4 text-sm">
              <h2 id="results-title" ref={resultsHeading} tabIndex={-1} className="text-base font-medium focus:outline-none">
                {t('results.title')}
              </h2>
              {search.status === 'idle' && <p className="text-slate-400">{t('results.idlePrompt')}</p>}
              {search.status === 'running' && (
                <label className="block max-w-md tabular-nums">
                  {search.totalCells ? t('results.evaluating', { done: search.doneCells, total: search.totalCells }) : t('results.loadingCells')}
                  <progress value={search.doneCells} max={search.totalCells || 1} className="mt-1 block w-full" />
                </label>
              )}
              {search.status === 'error' && <p role="alert" className="text-red-400">{t('results.errorPrefix', { message: search.message })}</p>}
              {results && (
                <>
                  <p className="text-slate-400">
                    {t('results.summary', { count: results.cellCount, steps: results.landingCount, days: search.scenario.stayDays })}
                  </p>
                  <CurrentPointCard
                    summary={currentPointSummary}
                    scenario={search.scenario}
                    point={searchedPoint}
                    onSelectLanding={selectLanding}
                    onOpenCell={(cellId) => openDetail(cellId, results.landingTimes[landingIndex])}
                  />
                  <LandingTimeSlider landingTimes={results.landingTimes} value={landingIndex} onChange={selectLanding} />
                  <CurrentPointStrip statuses={results.status.subarray(0, results.landingCount)} value={landingIndex} onSelectLanding={selectLanding} />
                  {searchedPoint && !isCellOnPolarMap(searchedPoint) ? (
                    <p className="rounded border border-slate-700 p-3 text-slate-300">
                      {t('currentPoint.searchedOnly')}
                    </p>
                  ) : (
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
                    <div className="space-y-2">
                      {regionPicker}
                      <SouthPoleMap {...mapProps} hour={resultsHour} hourRange={resultsRange} stayDays={search.scenario?.stayDays} defaultLayerId="searchResult" />
                    </div>
                    <div className="space-y-2">
                      {ranking.sortBy && (
                        <button type="button" onClick={() => setRanking({ sortBy: undefined, direction: undefined })} className="text-xs text-sky-300 hover:underline">
                          {t('results.defaultOrderReset')}
                        </button>
                      )}
                      <RankingTable
                        rows={rankedRows}
                        sortBy={ranking.sortBy}
                        direction={ranking.direction}
                        onSort={sortRanking}
                        onSelectRow={(row) => openDetail(row.cellId, row.landingTime)}
                        currentCellId={results.cellIds[0]}
                        currentPointName={searchedPoint && cellDisplayName(searchedPoint)}
                        mode={mode}
                      />
                    </div>
                  </div>
                  )}
                  <BestPairsTable rows={bestPairs} onSelectRow={(row) => openDetail(row.cellId, row.landingTime)} />
                </>
              )}
            </section>
          )}

          {data && screen === 'detail' &&
            (detailCell ? (
              <Suspense fallback={<p className="text-slate-400">Loading cell detail…</p>}>
              <DetailView
                key={`${detailCell.id}|${detailLandingTime}`}
                cell={detailCell}
                currentCell={currentCell}
                ephemeris={data.ephemeris}
                scenario={detailScenario}
                landingTime={detailLandingTime}
                mode={mode}
                onLandingTimeChange={setLandingTime}
                onBack={() => setScreen(results ? 'results' : 'map')}
              />
              </Suspense>
            ) : (
              <p className="text-slate-400">Select a cell on the Map screen, or a row in the Results, to see its details.</p>
            ))}

          {data && screen === 'globe' && (
            <section className="space-y-2">
              <Suspense fallback={<p className="text-slate-400">Loading globe…</p>}>
                <MoonGlobe sites={data.sites} onSelectSite={selectSite} />
              </Suspense>
              <p className="text-xs text-slate-400">Click a site to use it as the current point.</p>
            </section>
          )}

          {data && screen === 'learn' && (
            <Suspense fallback={<p className="text-slate-400">Loading learn mode…</p>}>
              <LearnView results={results} cellsById={cellsById} landingIndex={landingIndex} onStartSearch={() => setScreen('map')} />
            </Suspense>
          )}

          {screen === 'about' && <AboutView />}
        </ScreenErrorBoundary>
      </main>

      <footer className="border-t border-slate-800 px-4 py-3 text-xs text-slate-400">
        <p className="mx-auto max-w-7xl">
          Terrain: LOLA 80 m (NASA PGDA 90). Ephemeris: JPL Horizons. Grid: USGS LGRS. Not an official NASA tool.
        </p>
      </footer>
    </div>
  )
}
