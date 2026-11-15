import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AboutView from './components/AboutView.jsx'
import BestWindowsTable from './components/BestWindowsTable.jsx'
import CellPopup from './components/CellPopup.jsx'
import CurrentPointCard from './components/CurrentPointCard.jsx'
import CurrentPointStrip from './components/CurrentPointStrip.jsx'
import WiderSearchButton from './components/WiderSearchButton.jsx'
import LandingTimeSlider from './components/LandingTimeSlider.jsx'
import LanguageSwitcher from './components/LanguageSwitcher.jsx'
import MapTimeBar from './components/MapTimeBar.jsx'
import MissionChat from './components/MissionChat.jsx'
import RankingTable from './components/RankingTable.jsx'
import ScenarioForm from './components/ScenarioForm.jsx'
import ScreenErrorBoundary from './components/ScreenErrorBoundary.jsx'
import SouthPoleMap from './components/SouthPoleMap.jsx'
import ValidationBadge from './components/ValidationBadge.jsx'
import { capTileIdsInBounds, capTileIdsInCircle } from './core/capGrid.js'
import { capTileIdsForSearch, pointRegionCode, regionCodesForSearch, searchAnchor } from './core/capSearch.js'
import { detailCellFor, hourIndexOf, loadCapIndex, loadCapTiles, loadCells, loadEphemeris, loadMaps, loadRegions, loadSites, resolveCurrentCell, toPolarXY } from './core/data.js'
import { cellDisplayName } from './core/format.js'
import { nearestRegionCode } from './core/mapSearch.js'
import { clampHour, mapHourRange } from './core/mapSky.js'
import { isCellOnPolarMap } from './core/mapView.js'
import { CAP_REGION_SEARCH_KM, rankBestWindows, rankCells, selectSearchCells, summarizeCurrentPoint } from './core/optimizer.js'
import { isPointComplete, validateScenario } from './core/scenario.js'
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
const SMALLER_IS_BETTER = new Set(['distanceKm', 'psrDistanceKm', 'longestDarkHours', 'longestCommLossHours', 'rechargeHours']) // docs/technical-reference.md C5 rule

async function loadAllData() {
  // Real data is used once module D5 publishes regions.json; until then cells and sites come from the mock folder.
  let regionsFile = forceMock ? null : await loadRegions(false).catch(() => null)
  const useMock = regionsFile === null
  if (useMock) regionsFile = await loadRegions(true)
  // The real ephemeris (D1) exists already, so even mock cells get real Sun and Earth positions.
  const [ephemeris, sitesFile, maps, capIndex] = await Promise.all([
    useMock ? loadEphemeris(false).catch(() => loadEphemeris(true)) : loadEphemeris(false), // real cells never get mock skies
    loadSites(useMock),
    useMock ? [] : loadMaps(),
    useMock ? null : loadCapIndex(), // docs/technical-reference.md D9; null = no cap grid, everything works as before
  ])
  return { useMock, ephemeris, regions: regionsFile.regions, sites: sitesFile.sites, maps, capIndex }
}

const CAP_BATCH_SIZE = 10 // tiles per batch of the background load, so the map fills in steps

export default function App() {
  const { t } = useI18n()
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [cellsByRegion, setCellsByRegion] = useState({})
  const [capTiles, setCapTiles] = useState({}) // docs/technical-reference.md D9: tile id → cells, filled as tiles load
  const [regionCode, setRegionCode] = useState(initialCellId?.split('-')[0] ?? null)
  const [screen, setScreen] = useState(SCREENS.some(([id]) => id === initialState.screen) ? initialState.screen : 'map')
  const [mode, setMode] = useState(initialState.mode)
  const [scenario, setScenario] = useState(initialState.scenario)
  const [chatOpen, setChatOpen] = useState(true)
  const [chatEnteredFields, setChatEnteredFields] = useState({})
  const [selectedCellId, setSelectedCellId] = useState(initialState.selectedCellId)
  const [landingTime, setLandingTime] = useState(initialState.landingTime)
  const [mapHour, setMapHour] = useState(null) // the Map screen's own hour (time bar); null = follow the landing time
  const [mapFocus, setMapFocus] = useState(null) // {boundsM, requestId} after a find-box pick of a site or cell
  const focusRequests = useRef(0)
  const [search, setSearch] = useState({ status: 'idle' })
  const [ranking, setRanking] = useState({ sortBy: undefined, direction: undefined })
  const requestedCapTiles = useRef(new Set())
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

  const capCells = useMemo(() => Object.values(capTiles).flat(), [capTiles])
  // Loads CAP tiles not requested yet; resolves with the cells of all the asked tiles.
  const needCapTiles = useCallback(async (tileIds, { failLoudly = false } = {}) => {
    const fresh = tileIds.filter((tileId) => !requestedCapTiles.current.has(tileId))
    fresh.forEach((tileId) => requestedCapTiles.current.add(tileId))
    try {
      const lists = await loadCapTiles(tileIds)
      if (fresh.length > 0) setCapTiles((loaded) => ({ ...loaded, ...Object.fromEntries(tileIds.map((tileId, index) => [tileId, lists[index]])) }))
      return lists.flat()
    } catch (error) {
      fresh.forEach((tileId) => requestedCapTiles.current.delete(tileId)) // allow a retry
      if (failLoudly) throw error // a search must not run on a partial cap
      setLoadError(error.message)
      return []
    }
  }, [])
  // Wide screens preload the cap tiles inside the 85°S circle after the first paint; the 80-85°S ring and phones load tiles on demand (MapCapLayer, search, point).
  useEffect(() => {
    if (!data?.capIndex || !window.matchMedia('(min-width: 768px)').matches) return
    const tileIds = capTileIdsInCircle(data.capIndex, 0, 0, Math.hypot(...Object.values(toPolarXY(-85, 0))))
    let isStopped = false
    const timer = setTimeout(async () => {
      for (let first = 0; first < tileIds.length && !isStopped; first += CAP_BATCH_SIZE) await needCapTiles(tileIds.slice(first, first + CAP_BATCH_SIZE))
    }, 300)
    return () => {
      isStopped = true
      clearTimeout(timer)
    }
  }, [data, needCapTiles])
  // A form point on the cap needs its own tile (a CAP cell id, or the real horizon of a typed point).
  useEffect(() => {
    const point = scenario.currentPoint
    if (!data?.capIndex || !point) return
    const anchor = searchAnchor(point, data.sites, {})
    // Loads a file for the form's point: syncing with an external resource, setState happens when it arrives.
    // eslint-disable-next-line react/set-state-in-effect
    if (anchor) needCapTiles(capTileIdsInBounds(data.capIndex, [anchor.xM, anchor.yM, anchor.xM, anchor.yM]))
  }, [data, scenario.currentPoint, needCapTiles])

  // null = the south-pole overview (docs/technical-reference.md W2); a link with a cell opens that cell's region.
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
      const point = searchScenario.currentPoint
      // An LGRS cell point is read first: a radius search needs to know where it is.
      const pointRegion = point.type === 'cell' ? data.regions.find((region) => region.code === point.cellId.split('-')[0]) : null
      const pointLoaded = pointRegion ? { [pointRegion.code]: await loadRegionCells(pointRegion) } : {}
      const anchor = searchAnchor(point, data.sites, { ...cellsByRegion, ...pointLoaded })
      // The point's own region, from the point and region bounds: loaded before anything is resolved, so loading order never changes a search.
      const ownRegionCode = pointRegionCode(point, data.regions, data.sites, anchor)
      const codes = regionCodesForSearch(searchScenario, data.regions, data.sites, anchor)
      const neededRegions = data.regions.filter((region) => codes.includes(region.code))
      const loadedLists = await Promise.all(neededRegions.map(async (region) => [region.code, await loadRegionCells(region)]))
      const ownRegionCells = Object.fromEntries(loadedLists)[ownRegionCode] ?? pointLoaded[ownRegionCode] ?? []
      const isOnRegionCell = !!anchor && ownRegionCells.some((cell) => Math.hypot(cell.xM - anchor.xM, cell.yM - anchor.yM) <= 1000)
      const searchCapCells = await needCapTiles(
        [...new Set([...capTileIdsForSearch(searchScenario, data.capIndex, anchor, isOnRegionCell), ...(anchor && data.capIndex ? capTileIdsInBounds(data.capIndex, [anchor.xM, anchor.yM, anchor.xM, anchor.yM]) : [])])],
        { failLoudly: true },
      )
      if (!isLatest()) return
      const loaded = { ...cellsByRegion, ...pointLoaded, ...Object.fromEntries(loadedLists) }
      const ordered = { ...(ownRegionCode && { [ownRegionCode]: loaded[ownRegionCode] }), ...loaded } // the point's region first: it wins duplicate positions
      const currentCell = resolveCurrentCell(point, loaded, data.sites, searchCapCells)
      const cells = selectSearchCells(searchScenario, currentCell, ordered, searchCapCells, ownRegionCode)
      // Open the searched region so the Results map shows its ✓ ! ✕ colours: the current point's own region, else the region of the
      // nearest searched grid cell (a site with no region, coordinates outside every frame); otherwise keep the open one.
      const searchedRegion = ownRegionCode ?? nearestRegionCode(currentCell, cells, data.regions)
      if (searchedRegion) {
        setRegionCode(searchedRegion)
        setMapFocus(null)
      } else if (anchor && cells.some((cell) => cell.id.startsWith('CAP-'))) {
        // Only CAP cells were searched: show the overview, zoomed to the searched area.
        const halfM = Math.max(searchScenario.searchScope === 'radius' ? searchScenario.searchRadiusKm : CAP_REGION_SEARCH_KM, 4) * 1200
        setRegionCode(null)
        setMapFocus({ boundsM: [anchor.xM - halfM, anchor.yM - halfM, anchor.xM + halfM, anchor.yM + halfM], requestId: ++focusRequests.current })
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

  // docs/technical-reference.md W1: a link opened on the Results screen with a valid scenario runs its search once the data is in.
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
  const bestWindows = useMemo(() => results && rankBestWindows(results, { limit: 10 }), [results])
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
        <p className="mt-2 text-sm text-slate-400">{t('app.pickDatesHint')}</p>
      ),
    [data, mapRange, shownMapHour, t],
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
      return search.status === 'done' ? resolveCurrentCell(search.scenario.currentPoint, cellsByRegion, data.sites, capCells) : null
    } catch {
      return null
    }
  }, [data, search, cellsByRegion, capCells])
  const cellsById = useMemo(() => new Map([...Object.values(cellsByRegion).flat(), ...capCells].map((cell) => [cell.id, cell])), [cellsByRegion, capCells])
  const currentCell = useMemo(() => {
    try {
      return data ? resolveCurrentCell(scenario.currentPoint, cellsByRegion, data.sites, capCells) : null
    } catch {
      return null // no current point chosen yet, or its region is not loaded yet
    }
  }, [data, scenario.currentPoint, cellsByRegion, capCells])

  // First click sorts a column better-first (docs/technical-reference.md C5 "Sorting by column"), the next click reverses it.
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
  const selectedCell = cells?.find((cell) => cell.id === selectedCellId) ?? (selectedCellId?.startsWith('CAP-') ? (cellsById.get(selectedCellId) ?? null) : null)
  const detailCell = detailCellFor(cellsById, selectedCellId, searchedPoint)
  const detailScenario = search.status === 'done' ? search.scenario : scenario
  const detailLandingTime = landingTime ?? `${detailScenario.startDate}T00:00Z`
  const currentCellId = scenario.currentPoint?.type === 'cell' ? scenario.currentPoint.cellId : null

  const regionPicker = data && (
    <label className="text-sm text-slate-300">
      {t('picker.region')}{' '}
      <select value={activeRegion?.code ?? ''} onChange={(event) => openRegion(event.target.value || null)} className={selectClass}>
        <option value="">{t('picker.allRegions')}</option>
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
    capIndex: data.capIndex,
    capCells,
    onNeedCapTiles: needCapTiles,
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
          {import.meta.env.VITE_CHAT_UI === 'true' && data && !data.useMock && screen === 'map' && <button type="button" className="rounded-lg border border-sky-400 bg-sky-900 px-3 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-800" onClick={() => {
            setChatOpen(true)
            // The section is rendered by the time the timeout fires.
            setTimeout(() => {
              document.getElementById('mission-assistant')?.scrollIntoView({ block: 'start' })
              document.getElementById('mission-message')?.focus({ preventScroll: true })
            }, 0)
          }}>{t('chat.plan')}</button>}
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
        <nav className="mx-auto mt-2 flex max-w-7xl gap-1 overflow-x-auto" aria-label={t('app.screensNav')}>
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

      <main className={`mx-auto w-full flex-1 p-4 ${screen === 'map' ? 'max-w-[1920px]' : 'max-w-7xl'}`}>
        {loadError && <p role="alert" className="mb-4 text-red-400">{t('app.loadError', { error: loadError })}</p>}
        {!data && !loadError && <p className="text-slate-400">{t('picker.loadingData')}</p>}

        <ScreenErrorBoundary key={screen}>
          {data && screen === 'map' && (
            <div className="space-y-5">
              <section aria-labelledby="map-title" className="min-w-0">
                <h2 id="map-title" className="sr-only">{t('app.mapTitle')}</h2>
                <SouthPoleMap workspaceLayout rightPanel={import.meta.env.VITE_CHAT_UI === 'true' ? (
                  <details open={chatOpen} onToggle={(event) => setChatOpen(event.currentTarget.open)} className="rounded-xl border border-sky-500 bg-sky-950">
                    <summary className="cursor-pointer px-4 py-3 font-semibold text-sky-100">{t('chat.assistant')}</summary>
                    <MissionChat
                      value={scenario}
                      sites={data.sites}
                      ephemeris={data.ephemeris}
                      busy={search.status === 'running'}
                      useMock={data.useMock}
                      enteredFields={chatEnteredFields}
                      onApply={(next, enteredFields) => { setScenario(next); setMode('expert'); setChatEnteredFields(enteredFields) }}
                    />
                  </details>
                ) : null} {...mapProps} hour={shownMapHour} hourRange={mapRange} stayDays={scenario.stayDays} defaultLayerId="sunNow" timeBar={mapTimeBar} toolbarSlot={<>{regionPicker}
                  <button type="submit" form="scenario-form" disabled={search.status === 'running' || errors.length > 0 || !isPointComplete(scenario.currentPoint)} className="order-last ml-auto h-9 rounded bg-amber-400 px-3 font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40">{search.status === 'running' ? t('scenario.searching') : t('scenario.findWindowsShort')}</button>
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
</>} />
              </section>
              <div className="grid items-start gap-5 lg:grid-cols-2" data-layout="mission-and-cell">
                <ScenarioForm
                  mode={mode}
                  value={scenario}
                  errors={errors}
                  sites={data.sites}
                  busy={search.status === 'running'}
                  onChange={setScenario}
                  onSubmit={runSearch}
                />

                {selectedCell ? (
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
                ) : (
                  <section className="min-h-48 rounded-lg border border-dashed border-slate-700 bg-slate-900 p-5" aria-labelledby="landing-cell-title">
                    <h2 id="landing-cell-title" className="font-medium">{t('layout.landingCell')}</h2>
                    <p className="mt-2 text-sm text-slate-400">{t('layout.selectCell')}</p>
                  </section>
                )}
              </div>
            </div>
          )}

          {data && screen === 'results' && (
            <section aria-labelledby="results-title" aria-busy={search.status === 'running'} className="space-y-4 text-sm">
              <h2 id="results-title" ref={resultsHeading} tabIndex={-1} className="text-base font-medium focus:outline-none">
                {t('results.title')}
              </h2>
              <ValidationBadge onOpenAbout={() => setScreen('about')} />
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
                    {t(results.cellCount === 1 ? 'results.summaryOne' : 'results.summary', { count: results.cellCount, steps: results.landingCount, days: search.scenario.stayDays })}
                  </p>
                  <CurrentPointCard
                    summary={currentPointSummary}
                    scenario={search.scenario}
                    point={searchedPoint}
                    onSelectLanding={selectLanding}
                    onOpenCell={(cellId) => openDetail(cellId, results.landingTimes[landingIndex])}
                    results={results}
                    landingIndex={landingIndex}
                  />
                  <LandingTimeSlider landingTimes={results.landingTimes} value={landingIndex} onChange={selectLanding} />
                  <CurrentPointStrip statuses={results.status.subarray(0, results.landingCount)} value={landingIndex} onSelectLanding={selectLanding} />
                  <WiderSearchButton scenario={search.scenario} results={results} onSearch={(wider) => { setScenario(wider); runSearch(wider) }} />
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
                      {search.scenario?.requireDsn && <p className="text-xs text-amber-300">{t('scenario.dsnActiveNote')}</p>}
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
                  <BestWindowsTable rows={bestWindows} currentCell={searchedPoint} onSelectRow={(row) => openDetail(row.cellId, row.landingTime)} />
                </>
              )}
            </section>
          )}

          {data && screen === 'detail' &&
            (detailCell ? (
              <Suspense fallback={<p className="text-slate-400">{t('app.loadingDetail')}</p>}>
              <DetailView
                key={`${detailCell.id}|${detailLandingTime}`}
                cell={detailCell}
                currentCell={search.status === 'done' ? searchedPoint : currentCell}
                ephemeris={data.ephemeris}
                scenario={detailScenario}
                landingTime={detailLandingTime}
                mode={mode}
                onLandingTimeChange={setLandingTime}
                onBack={() => setScreen(results ? 'results' : 'map')}
                onOpenAbout={() => setScreen('about')}
              />
              </Suspense>
            ) : (
              <p className="text-slate-400">{t('app.selectCellHint')}</p>
            ))}

          {data && screen === 'globe' && (
            <section className="space-y-2">
              <Suspense fallback={<p className="text-slate-400">{t('globe.loading')}</p>}>
                <MoonGlobe
                  sites={data.sites}
                  regions={data.regions}
                  ephemeris={data.ephemeris}
                  hour={shownMapHour ?? 0}
                  selectedSiteId={scenario.currentPoint?.type === 'site' ? scenario.currentPoint.siteId : null}
                  onSelectSite={selectSite}
                  onOpenRegion={(code) => {
                    openRegion(code)
                    setScreen('map')
                  }}
                />
              </Suspense>
            </section>
          )}

          {data && screen === 'learn' && (
            <Suspense fallback={<p className="text-slate-400">{t('app.loadingLearn')}</p>}>
              <LearnView results={results} cellsById={searchedPoint ? new Map(cellsById).set(searchedPoint.id, searchedPoint) : cellsById} ephemeris={data.ephemeris} scenario={search.scenario} landingIndex={landingIndex} onStartSearch={() => setScreen('map')} />
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
