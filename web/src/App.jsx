import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AboutView from './components/AboutView.jsx'
import CellPopup from './components/CellPopup.jsx'
import ScenarioForm from './components/ScenarioForm.jsx'
import ScreenErrorBoundary from './components/ScreenErrorBoundary.jsx'
import SouthPoleMap from './components/SouthPoleMap.jsx'
import { hourIndexOf, loadCells, loadEphemeris, loadRegions, loadSites, resolveCurrentCell, toPolarXY } from './core/data.js'
import { selectSearchCells } from './core/optimizer.js'
import { validateScenario } from './core/scenario.js'
import { decodeShareQuery, encodeShareQuery } from './core/shareLink.js'
import { startWindowSearch } from './core/startWindowSearch.js'

// The globe pulls in three.js (most of the bundle); load it only when its tab opens.
const MoonGlobe = lazy(() => import('./components/MoonGlobe.jsx'))

const SCREENS = [
  ['map', 'Map & scenario'],
  ['results', 'Results'],
  ['globe', 'Globe'],
  ['about', 'About'],
]
const forceMock = new URLSearchParams(window.location.search).get('mock') === '1'
const initialState = decodeShareQuery(window.location.search.slice(1))
const initialCellId = initialState.selectedCellId ?? initialState.scenario.currentPoint?.cellId ?? null
const selectClass = 'rounded border border-slate-500 bg-slate-950 px-2 py-1'

async function loadAllData() {
  // Real data is used once module D5 publishes regions.json; until then everything comes from the mock folder.
  let regionsFile = forceMock ? null : await loadRegions(false).catch(() => null)
  const useMock = regionsFile === null
  if (useMock) regionsFile = await loadRegions(true)
  const [ephemeris, sitesFile] = await Promise.all([loadEphemeris(useMock), loadSites(useMock)])
  return { useMock, ephemeris, regions: regionsFile.regions, sites: sitesFile.sites }
}

function checkScenario(scenario, ephemeris) {
  try {
    return validateScenario(scenario, ephemeris)
  } catch {
    return [] // shortcut: validateScenario (WF4) is still a stub; drop this try once it lands
  }
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
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [cellsByRegion, setCellsByRegion] = useState({})
  const [regionCode, setRegionCode] = useState(initialCellId?.split('-')[0] ?? null)
  const [screen, setScreen] = useState(SCREENS.some(([id]) => id === initialState.screen) ? initialState.screen : 'map')
  const [mode, setMode] = useState(initialState.mode)
  const [scenario, setScenario] = useState(initialState.scenario)
  const [selectedCellId, setSelectedCellId] = useState(initialState.selectedCellId)
  const [landingTime] = useState(initialState.landingTime) // set by the W4 slider
  const [search, setSearch] = useState({ status: 'idle' })
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

  const activeRegion = data?.regions.find((region) => region.code === regionCode) ?? data?.regions[0] ?? null
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
      const { promise, cancel } = startWindowSearch({
        cells,
        ephemeris: data.ephemeris,
        scenario: searchScenario,
        onProgress: (doneCells, totalCells) => isLatest() && setSearch({ status: 'running', doneCells, totalCells }),
      })
      cancelSearch.current = cancel
      const results = await promise
      if (isLatest()) setSearch({ status: 'done', results, scenario: searchScenario })
    } catch (error) {
      if (isLatest()) setSearch({ status: 'error', message: error.message })
    }
  }

  // README W1: a link opened on the Results screen with a current point runs its search once the data is in.
  useEffect(() => {
    if (!data || !autoRunPending.current) return
    autoRunPending.current = false
    runSearch(initialState.scenario)
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps -- runs once, with the scenario from the link

  const selectCell = useCallback((cell) => setSelectedCellId(cell.id), [])
  const selectSite = useCallback((site) => setScenario((current) => ({ ...current, currentPoint: { type: 'site', siteId: site.id } })), [])
  const errors = useMemo(() => (data ? checkScenario(scenario, data.ephemeris) : []), [data, scenario])
  const viewHour = useMemo(() => {
    try {
      return data ? hourIndexOf(data.ephemeris, `${scenario.startDate}T00:00Z`) : null
    } catch {
      return null // start date outside the ephemeris; the form reports it
    }
  }, [data, scenario.startDate])

  const cells = activeRegion ? cellsByRegion[activeRegion.code] : null
  const selectedCell = cells?.find((cell) => cell.id === selectedCellId) ?? null
  const currentCellId = scenario.currentPoint?.type === 'cell' ? scenario.currentPoint.cellId : null

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-4 pt-3">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2">
          <div className="mr-auto">
            <h1 className="text-lg font-semibold">Lunar Landing Site Navigator</h1>
            <p className="text-xs text-slate-400">Tell us your landing spot and your mission's limits. We find the best nearby sites and dates.</p>
          </div>
          {data?.useMock && <span className="rounded bg-amber-500 px-2 py-0.5 text-xs font-bold text-slate-950">MOCK DATA</span>}
          <div className="flex rounded-md border border-slate-500 p-0.5 text-sm" role="group" aria-label="Detail level">
            {[
              ['simple', 'Simple'],
              ['expert', 'Expert'],
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
        <nav className="mx-auto mt-2 flex max-w-7xl gap-1 overflow-x-auto" aria-label="Screens">
          {SCREENS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-current={screen === id ? 'page' : undefined}
              onClick={() => setScreen(id)}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors ${screen === id ? 'border-amber-400 text-slate-100' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 p-4">
        {loadError && <p role="alert" className="mb-4 text-red-400">Could not load data: {loadError}</p>}
        {!data && !loadError && <p className="text-slate-400">Loading data…</p>}

        <ScreenErrorBoundary key={screen}>
          {data && screen === 'map' && (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
              <section aria-labelledby="map-title">
                <div className="mb-2 flex flex-wrap items-center gap-3">
                  <h2 id="map-title" className="font-medium">South pole landing cells</h2>
                  <label className="text-sm text-slate-300">
                    Region{' '}
                    <select
                      value={activeRegion?.code ?? ''}
                      onChange={(event) => {
                        setRegionCode(event.target.value)
                        setSelectedCellId(null)
                      }}
                      className={selectClass}
                    >
                      {data.regions.map((region) => (
                        <option key={region.code} value={region.code}>{region.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm text-slate-300">
                    Cell{' '}
                    <select value={selectedCell ? selectedCellId : ''} onChange={(event) => setSelectedCellId(event.target.value || null)} className={`${selectClass} font-mono`}>
                      <option value="">Choose…</option>
                      {cells?.map((cell) => (
                        <option key={cell.id} value={cell.id}>
                          {cell.id}
                          {cell.feasible ? '' : ' (not feasible)'}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {cells ? (
                  <SouthPoleMap
                    region={activeRegion}
                    cells={cells}
                    sites={data.sites}
                    statusByCellId={null}
                    currentCellId={currentCellId}
                    selectedCellId={selectedCellId}
                    onSelectCell={selectCell}
                  />
                ) : (
                  <p className="text-slate-400">Loading cells…</p>
                )}
              </section>
              <aside className="space-y-4">
                {selectedCell && (
                  <CellPopup
                    key={selectedCell.id}
                    cell={selectedCell}
                    ephemeris={data.ephemeris}
                    hour={viewHour}
                    isCurrent={selectedCell.id === currentCellId}
                    onUseAsCurrent={() => setScenario((current) => ({ ...current, currentPoint: { type: 'cell', cellId: selectedCell.id } }))}
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
            <section aria-labelledby="results-title" aria-busy={search.status === 'running'} className="space-y-2 text-sm">
              <h2 id="results-title" ref={resultsHeading} tabIndex={-1} className="text-base font-medium">
                Results
              </h2>
              {search.status === 'idle' && <p className="text-slate-400">Choose a current point and press "Find landing windows" on the Map screen.</p>}
              {search.status === 'running' && (
                <label className="block max-w-md tabular-nums">
                  {search.totalCells ? `Evaluating cells ${search.doneCells} / ${search.totalCells}` : 'Loading cells…'}
                  <progress value={search.doneCells} max={search.totalCells || 1} className="mt-1 block w-full" />
                </label>
              )}
              {search.status === 'error' && <p role="alert" className="text-red-400">Search could not run: {search.message}</p>}
              {search.status === 'done' && (
                <p>
                  Evaluated {search.results.cellCount} cells × {search.results.landingCount} landing times.
                </p>
              )}
            </section>
          )}

          {data && screen === 'globe' && (
            <section className="space-y-2">
              <Suspense fallback={<p className="text-slate-400">Loading globe…</p>}>
                <MoonGlobe sites={data.sites} onSelectSite={selectSite} />
              </Suspense>
              <p className="text-xs text-slate-400">Click a site to use it as the current point.</p>
            </section>
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
