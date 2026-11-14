import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AboutView from './components/AboutView.jsx'
import CellPopup from './components/CellPopup.jsx'
import MoonGlobe from './components/MoonGlobe.jsx'
import ScenarioForm from './components/ScenarioForm.jsx'
import SouthPoleMap from './components/SouthPoleMap.jsx'
import { hourIndexOf, loadCells, loadEphemeris, loadRegions, loadSites, resolveCurrentCell } from './core/data.js'
import { selectSearchCells } from './core/optimizer.js'
import { validateScenario } from './core/scenario.js'
import { decodeShareQuery, encodeShareQuery } from './core/shareLink.js'
import { startWindowSearch } from './core/startWindowSearch.js'

const SCREENS = [
  ['map', 'Map & scenario'],
  ['results', 'Results'],
  ['globe', 'Globe'],
  ['about', 'About'],
]
const forceMock = new URLSearchParams(window.location.search).get('mock') === '1'
const initialState = decodeShareQuery(window.location.search.slice(1))
const initialCellId = initialState.selectedCellId ?? initialState.scenario.currentPoint?.cellId ?? null

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
  const cancelSearch = useRef(null)

  useEffect(() => {
    loadAllData().then(setData).catch((error) => setLoadError(error.message))
  }, [])

  const activeRegion = data?.regions.find((region) => region.code === regionCode) ?? data?.regions[0] ?? null
  useEffect(() => {
    if (!data || !activeRegion || cellsByRegion[activeRegion.code]) return
    loadCells(data.useMock, activeRegion.cellsFile)
      .then((file) => setCellsByRegion((loaded) => ({ ...loaded, [activeRegion.code]: file.cells })))
      .catch((error) => setLoadError(error.message))
  }, [data, activeRegion, cellsByRegion])

  useEffect(() => {
    const query = encodeShareQuery({ scenario, landingTime, selectedCellId, mode, screen })
    window.history.replaceState(null, '', `?${query}${forceMock ? '&mock=1' : ''}`)
  }, [scenario, landingTime, selectedCellId, mode, screen])

  const selectSite = useCallback((site) => setScenario((current) => ({ ...current, currentPoint: { type: 'site', siteId: site.id } })), [])
  const errors = useMemo(() => (data ? checkScenario(scenario, data.ephemeris) : []), [data, scenario])
  const viewHour = useMemo(() => {
    try {
      return data ? hourIndexOf(data.ephemeris, `${scenario.startDate}T00:00Z`) : null
    } catch {
      return null // start date outside the ephemeris; the form reports it
    }
  }, [data, scenario.startDate])

  function runSearch() {
    cancelSearch.current?.()
    setScreen('results')
    try {
      const currentCell = resolveCurrentCell(scenario.currentPoint, cellsByRegion, data.sites)
      const cells = selectSearchCells(scenario, currentCell, cellsByRegion)
      setSearch({ status: 'running', doneCells: 0, totalCells: cells.length })
      const { promise, cancel } = startWindowSearch({
        cells,
        ephemeris: data.ephemeris,
        scenario,
        onProgress: (doneCells, totalCells) => setSearch({ status: 'running', doneCells, totalCells }),
      })
      cancelSearch.current = cancel
      promise.then((results) => setSearch({ status: 'done', results })).catch((error) => setSearch({ status: 'error', message: error.message }))
    } catch (error) {
      setSearch({ status: 'error', message: error.message })
    }
  }

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
          <div className="flex rounded border border-slate-700 p-0.5 text-sm" role="radiogroup" aria-label="Detail level">
            {['simple', 'expert'].map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={mode === option}
                onClick={() => setMode(option)}
                className={`rounded px-2.5 py-1 capitalize ${mode === option ? 'bg-slate-100 text-slate-900' : 'text-slate-300 hover:bg-slate-800'}`}
              >
                {option}
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
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${screen === id ? 'border-amber-400 text-slate-100' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 p-4">
        {loadError && <p role="alert" className="mb-4 text-red-400">Could not load data: {loadError}</p>}
        {!data && !loadError && <p className="text-slate-400">Loading data…</p>}

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
                    className="rounded border border-slate-700 bg-slate-950 px-2 py-1"
                  >
                    {data.regions.map((region) => (
                      <option key={region.code} value={region.code}>{region.name}</option>
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
                  onSelectCell={(cell) => setSelectedCellId(cell.id)}
                />
              ) : (
                <p className="text-slate-400">Loading cells…</p>
              )}
            </section>
            <aside className="space-y-4">
              {selectedCell && (
                <CellPopup
                  cell={selectedCell}
                  ephemeris={data.ephemeris}
                  hour={viewHour}
                  onUseAsCurrent={() => setScenario({ ...scenario, currentPoint: { type: 'cell', cellId: selectedCell.id } })}
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
          <section aria-live="polite" className="text-sm">
            {search.status === 'idle' && <p className="text-slate-400">Choose a current point and press "Find landing windows" on the Map screen.</p>}
            {search.status === 'running' && (
              <label className="block max-w-md">
                Evaluating cells {search.doneCells} / {search.totalCells}
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
            <MoonGlobe sites={data.sites} onSelectSite={selectSite} />
            <p className="text-xs text-slate-400">Click a site to use it as the current point.</p>
          </section>
        )}

        {screen === 'about' && <AboutView />}
      </main>

      <footer className="border-t border-slate-800 px-4 py-3 text-xs text-slate-400">
        <p className="mx-auto max-w-7xl">
          Terrain: LOLA 80 m (NASA PGDA 90). Ephemeris: JPL Horizons. Grid: USGS LGRS. Not an official NASA tool.
        </p>
      </footer>
    </div>
  )
}
