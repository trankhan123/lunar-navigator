import { useEffect, useMemo, useState } from 'react'
import { searchMap } from '../core/mapSearch.js'

// Enter picks the first match, Escape clears. A typed cell ID asks App to load its region's file (onNeedRegionCells).
export default function MapSearch({ regions, sites, cellsByRegion, capCells = null, onNeedRegionCells, onNeedCapPoint, onPick }) {
  const [text, setText] = useState('')
  const { matches, regionCodeToLoad, capPointToLoad } = useMemo(() => searchMap(text, regions, sites, cellsByRegion, capCells), [text, regions, sites, cellsByRegion, capCells])
  useEffect(() => {
    if (regionCodeToLoad) onNeedRegionCells(regionCodeToLoad)
  }, [regionCodeToLoad, onNeedRegionCells])
  useEffect(() => {
    if (capPointToLoad) onNeedCapPoint(capPointToLoad)
  }, [capPointToLoad]) // eslint-disable-line react-hooks/exhaustive-deps -- once per typed point; the callback is a fresh closure each render

  function pick(match) {
    onPick(match)
    setText('')
  }
  const typed = text.trim()
  const loadingRegion = regionCodeToLoad && regions.find((region) => region.code === regionCodeToLoad)
  const status = !typed ? '' : loadingRegion ? `Loading ${loadingRegion.name} cells…` : capPointToLoad ? 'Loading the cap grid cell…' : matches.length === 0 ? `No region, site or cell matches “${typed}”.` : ''

  return (
    <form
      role="search"
      className="relative"
      onSubmit={(event) => {
        event.preventDefault()
        if (matches[0]) pick(matches[0])
      }}
    >
      <input
        type="search"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => event.key === 'Escape' && setText('')}
        aria-label="Find a region, site or cell ID"
        placeholder="Find…"
        className="w-40 rounded border border-slate-600 bg-slate-950 px-2 py-1 text-sm"
      />
      {typed && (matches.length > 0 || status) && (
        <div className="absolute z-10 mt-1 w-64 rounded border border-slate-700 bg-slate-950 py-1 text-sm">
          {matches.length > 0 && (
            <ul>
              {matches.map((match) => (
                <li key={`${match.type}:${match.label}`}>
                  <button type="button" onClick={() => pick(match)} className="w-full px-2 py-1 text-left transition-colors hover:bg-slate-800">
                    <span className="text-xs text-slate-400">{match.type}</span> {match.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p aria-live="polite" className="px-2 text-xs text-slate-400 empty:hidden">
            {status}
          </p>
        </div>
      )}
    </form>
  )
}
