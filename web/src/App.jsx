import { useCallback, useEffect, useState } from 'react'
import MoonGlobe from './components/MoonGlobe.jsx'
import HorizonChart from './components/HorizonChart.jsx'

// Old per-site draft; W1 replaces this page with the Window Finder flow.
const DATA_FOLDER = '/data/mock/legacy'

export default function App() {
  const [sites, setSites] = useState([])
  const [selectedSite, setSelectedSite] = useState(null)
  const [timeIndex, setTimeIndex] = useState(0)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    fetch(`${DATA_FOLDER}/sites.json`)
      .then((response) => response.json())
      .then(setSites)
      .catch((error) => setLoadError(error.message))
  }, [])

  // Stable identity so the globe is not rebuilt on every render.
  const selectSite = useCallback((site) => {
    fetch(`${DATA_FOLDER}/${site.id}.json`)
      .then((response) => response.json())
      .then((siteData) => {
        setSelectedSite(siteData)
        setTimeIndex(0)
      })
      .catch((error) => setLoadError(error.message))
  }, [])

  useEffect(() => {
    if (sites.length > 0) selectSite(sites[0])
  }, [sites, selectSite])

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-slate-100">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Lunar Landing Site Navigator</h1>
        {selectedSite?.mock && (
          <span className="rounded bg-amber-500 px-2 py-0.5 text-xs font-bold text-slate-950">MOCK DATA</span>
        )}
      </header>
      {loadError && <p className="text-red-400">Could not load data: {loadError}</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        <MoonGlobe sites={sites} onSelectSite={selectSite} />
        {selectedSite && (
          <section>
            <h2 className="mb-2 font-medium">{selectedSite.name} — horizon view</h2>
            <HorizonChart site={selectedSite} timeIndex={timeIndex} />
            <label className="mt-2 block text-sm">
              Hour {timeIndex} of {selectedSite.sun.length - 1}
              <input
                type="range"
                className="w-full"
                min={0}
                max={selectedSite.sun.length - 1}
                value={timeIndex}
                onChange={(event) => setTimeIndex(Number(event.target.value))}
              />
            </label>
          </section>
        )}
      </div>
    </main>
  )
}
