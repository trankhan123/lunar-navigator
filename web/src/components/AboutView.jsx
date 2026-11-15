const LIMITATIONS = [
  'Ephemeris and simulation run in 1-hour steps; countdowns interpolate between hours, so they can be off by minutes up to about an hour.',
  'The visible part of the Sun or Earth disk is a linear approximation.',
  'The terrain horizon is computed at the centre of each 1 km cell from 80 m LOLA terrain, so boulders and small ridges are not seen.',
  'Sites outside the terrain model use a smooth-sphere horizon ("terrain not included").',
  'The battery model is simple: constant load, no temperature effects, no panel or battery ageing.',
  'This is a hackathon project, not an official NASA tool.',
]

const SOURCES = [
  [
    'JPL Horizons API',
    'Sub-solar and sub-Earth points on the Moon, and topocentric Moon elevation at 3 NASA DSN ground stations (Goldstone DSS-14, Madrid DSS-63, Canberra DSS-43; requiring elevation ≥ 10° for communication), every hour 2027–2029 (DE441).',
  ],
  ['NASA GSFC PGDA 90 (LOLA)', 'South-pole terrain, slope, permanent shadow and hillshade.'],
  ['NASA GSFC PGDA 69', 'Average Sun and Earth visibility, used to validate our results.'],
  ['USGS LGRS grid', '1 km Artemis III region grids (McClernan 2024) following USGS Techniques and Methods 11-E1.'],
  ['NASA SVS 4720', 'Moon colour texture for the globe.'],
]

export default function AboutView() {
  return (
    <article className="max-w-3xl space-y-6 text-sm leading-relaxed text-slate-300">
      <section>
        <h2 className="mb-2 text-base font-semibold text-slate-100">What this tool does</h2>
        <p>
          Enter your planned landing point at the lunar south pole and your mission limits. The tool simulates the Sun, the
          Earth and your battery hour by hour for every nearby 1 km cell and every landing time, then ranks the best cells and
          dates. It answers the two questions a slipped launch raises: another site in the same region, or another date at the
          same site?
        </p>
      </section>
      <section>
        <h2 className="mb-2 text-base font-semibold text-slate-100">Data</h2>
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
        <h2 className="mb-2 text-base font-semibold text-slate-100">Validation</h2>
        <p>
          Sun and Earth directions computed in your browser match JPL Horizons topocentric positions within 0.015° in azimuth
          and 0.010° in elevation (30 checks at Malapert Massif, Haworth and Apollo 11). Comparison with NASA PGDA average
          visibility maps will be added here.
        </p>
      </section>
      <section>
        <h2 className="mb-2 text-base font-semibold text-slate-100">Known limitations</h2>
        <ul className="list-disc space-y-1 pl-5">
          {LIMITATIONS.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 text-base font-semibold text-slate-100">AI usage</h2>
        <p>Parts of this project were built with Claude Code (Anthropic). The repository file AI_USAGE.md lists where.</p>
      </section>
    </article>
  )
}
