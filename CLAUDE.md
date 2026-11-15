# CLAUDE.md — Lunar Landing Site Navigator: Window Finder (NASA Space Apps 2026)

This file is fixed context for Claude Code. Read all of it before you do anything.
Also read these files:

- `README.md`: project introduction for the public (English).
- `docs/technical-reference.md`: the **module contract**. The official version has inputs/outputs, units, file formats and the work-split table (the README during NASA Space Apps Challenge 2026).
- `docs/window-finder.md`: the team's final idea.
- `docs/distribution.md`: assignment of work to 5 people. It has 5 workflows (WF1–WF5, grouping the related D + C modules) and WEB, plus the work order and the handoffs between workflows.
- `DATA_SOURCES.md`: every data file, URL and library.
- `docs/extra-prospect.md`: the extra modules built after the main version (evening of 15/11): E1–E8 merged, E9–E10 not built, the `extra/<code>` branch rule and the 22:30 merge cutoff.

## 1. Background

- **Competition:** NASA Space Apps Challenge 2026, challenge **Lunar Landing Site Navigator**.
- **Time:** 14–15/11/2026. Deadline **23:59 on 15/11, Vietnam time**. The goal is to submit a few hours early.
- **Target users in the challenge:** mission planners, educators, the public.
- **Core requirements of the challenge:**
  - show the Sun and Earth against the horizon at the landing point over time, to judge the power-generation window and the direct-to-Earth communication window;
  - quickly compare another site or another date when the mission schedule slips;
  - the challenge text twice asks to show **how long until sunset / Earthset**.
- **The Moon has no atmosphere**, so there is no refraction. The horizon is set by terrain and the curvature of the sphere.
- **The idea chosen on 14/11 is "Window Finder"** (`docs/window-finder.md`):
  - the user picks an intended landing point on the USGS 1 km LGRS grid, a date range and mission limits (maximum darkness, maximum loss of communication, solar panel, battery, power use);
  - the tool finds the best cells and landing times in the same region;
  - dragging the time slider (6-hour steps) shows the ranking change.

Tagline: *"Tell us your landing spot and your mission's limits. We find the best nearby sites and dates, ranked hour by hour."*

## 2. Tech stack (fixed, do not change)

| Part | Technology |
|---|---|
| Data preprocessing | Python 3.11+, `requests`, `numpy`, `rasterio`, `pyproj`, `geopandas` (reads the LGRS shapefile) |
| Web | Vite + React (**JavaScript, no TypeScript**) |
| Computation in the browser | Plain JS in `web/src/core/`, search runs in a **Web Worker** |
| Test | `node --test`, built into Node (no extra test library), and `pipeline/check_web_data.py` |
| 2D south pole map | SVG + d3-zoom 3.0.0 (drag/zoom; the whole d3 chain is pinned with overrides in web/package.json), hillshade PNG background |
| 3D globe | `globe.gl` (the W6 globe uses globe.gl) |
| 3D terrain | `three` 0.187.0, pinned exactly, lazy loaded (globe.gl uses the same version) |
| Charts | ECharts (`echarts` + `echarts-for-react`) |
| CSS | Tailwind |
| Deploy | Vercel, static web, no backend |

- Do not add a library outside this list without asking.
- Do not use React Router. Switch screens with state.

## 3. Architecture: precompute, serve static

Exception requested for the chat UX: `web/api/mission-chat.js` is a Node Vercel Function
that calls Gemini to prepare the form, with a Redis usage limit. All scientific computation still runs in the browser.
See `docs/mission-chat-setup.md`. No MCP server, local model or training is needed.

```
[Python, runs on the local machine, once]
  JPL Horizons ── D1 ─> ephemeris.json (sub-Sun / sub-Earth points by hour, 2027-01 → 2029-01)
  LGRS USGS ───── D2 ─> pipeline/out/grid_<CODE>.json ──┐
  PGDA 90 slope, PSR ─ D3 ─> feasibility_<CODE>.json ────┼─ D5 ─> cells_<CODE>.json, regions.json, sites.json
  PGDA 90 DEM ─── D4 ─> horizon_<CODE>.json ─────────────┘
  PGDA 69 ─────── D7 ─> validation.json        hillshade ─ D8 ─> maps/*.png
  PGDA 90 DEM ─── D8b ─> maps/relief/*.jpg     PGDA 90 DEM ─ D10 ─> terrain/*.bin
  D2–D4 + PGDA 90 ─ D9 ─> data/cap/*.json (2 km grid outside the 9 regions)
[Browser, Vercel]
  core/ C0 geometry · C1 sunlight · C2 communication · C3 energy needed · C4 battery charging · C5 optimizer (Worker)
  UI W1–W7: map, form, results, details, globe, learning mode
```

- **Sun/Earth position** at any cell or coordinate is computed from the sub-body point with one vector formula (`docs/technical-reference.md`, section C0). So any coordinate works, and there is no need to call Horizons for each cell.
- **Terrain horizon** exists only for grid cells and for sites with lat ≤ −60°. Other points use the spherical horizon (0°), and the interface says "terrain not included".
- **Folders:**
  - `pipeline/`: D1–D10 (including D8b), `common.py`, `check_web_data.py`, `make_mock_data.py`, `validate.py`, `fetch_dsn.py`, `fetch_replay.py` (E6), `compute_science_access.py` (E7), `out/` (intermediate files, committed), `raw/` (gitignored);
  - `web/src/core/`: plain JS modules with `*.test.js`;
  - `web/src/components/`: one component per file;
  - `web/public/data/` (`mock/` is fake data, `cap/` is the 2 km grid of the whole pole), `web/public/terrain/` (3D terrain blocks), `web/public/maps/relief/` (multi-level relief images).

## 4. Data contract and module contract

**The official version is in `docs/technical-reference.md`.** Only a summary is here. To change the contract, change that file, the `web/src/core/*.test.js` tests and `pipeline/check_web_data.py` at the same time, then tell the team.

- **Conventions:**
  - degrees everywhere; azimuth is clockwise from North (0–360); East longitude −180…180, ME frame;
  - UTC time as `YYYY-MM-DDTHH:mmZ`; ephemeris hour i = `startTime + i h`;
  - energy is in W/Wh;
  - "visible" = ≥ 50 % of the disk is above the horizon; disk radius: Sun 0.27°, Earth 0.95°.
- **`ephemeris.json`:** column format `sunSubLonDeg, sunSubLatDeg, sunDistanceAu, earthSubLonDeg, earthSubLatDeg, earthDistanceKm`, 1-hour step.
- **`cells_<CODE>.json`:**
  - each cell has `id` (`<CODE>-<ACC label>`), `label, lat, lon, xM, yM, heightM, slopeDeg, psrFraction, feasible, infeasibleReason`;
  - `horizon` is 360 integers, in units of 0.1°.
- **Region codes:** CAB HAW MAL MMP MMO NR1 NR2 DGR SLP.
- **Each JSON file** is one object, smaller than 2 MB. Fake data lives only in `web/public/data/mock/`, has `"mock": true`, and the interface shows a "MOCK DATA" label.

## 5. Data and sources

- **JPL Horizons:**
  - ephemeris: `COMMAND=301`, `CENTER=500@399`, `QUANTITIES=14,15,19,20`, 1h step, split by quarter, cached in `pipeline/raw/horizons/`;
  - validation: `COMMAND=10/399`, `CENTER=coord@301`, `SITE_COORD=lon,lat,alt_km`, `QUANTITIES=4`. The `1h` step was tried and works (14/11): 1 month = 745 rows.
- **PGDA 90 (LOLA, south pole):**
  - `LDEM_80S_80MPP_ADJ` (near DEM), `LDEM_60S_240MPP_ADJ` (far DEM and sites down to 60°S);
  - `LDSM_80S_80MPP_ADJ` (slope), `LPSR_80S_20MPP_ADJ` (permanently shadowed regions, 20 m), hillshade.
- **PGDA 69:** `AVGVISIB_85S_060M_201608` (+`_EARTH`), used for validation; covers only 85–90°S.
- **LGRS grid:**
  - 1 km ACC shapefile of the 9 regions: McClernan 2024, doi:10.5066/P1MEQ6UK. It must be downloaded with a browser because ScienceBase blocks scripts;
  - grid design: USGS Techniques & Methods 11-E1 (2025), doi:10.3133/tm11E1;
  - do not use the "Terrestrial Navigational Training Grids".
- **20° slope limit:** from the NASA HLS document for Space Apps 2025 (NTRS 20250009323).
- **Moon texture:** NASA SVS 4720.
- **Do NOT invent coordinates.** A site without a source gets `lat/lon: null` and `"source": "TODO"`; the code skips it and prints a warning (`common.load_sites()`). NASA does not publish numeric coordinates for the 9 regions: region center coordinates come from the USGS square cell and are marked `verified: false` (see `DATA_SOURCES.md` section 3).

## 6. Core algorithm (details: `docs/window-finder.md` §4–5 and `docs/technical-reference.md`)

- **Horizon:**
  - 360 rays, sampled from 100 m to 150 km;
  - angle = `atan2(h_sample − h_cell − mast − d²/(2R), d)`, default mast 2 m.
- **Visibility:**
  - `frac = clamp((el − H + ρ) / 2ρ, 0, 1)`;
  - dark hour when sunlight < 0.5; communication loss hour when Earth < 0.5.
- **Sunlight factor:**
  - `(1 AU / D)² × frac × panel factor`;
  - a vertical panel uses `cos(el)`, a horizontal panel uses `max(sin el, 0)`;
  - auto mode: |lat| ≥ 60° uses the vertical panel.
- **Battery:**
  - full at landing;
  - `battery = clamp(battery + Pmax × sunlight factor − load, 0, capacity)` each hour;
  - when the battery reaches 0, record it as depleted.
- **Sliding window:** for each feasible cell in the search range and each landing time (6-hour step), the window is `stayDays × 24` hours long.
- **Result for each window:**
  - **pass** when the longest dark period ≤ limit, the longest communication loss ≤ limit and the battery does not run out;
  - a pass with minimum battery < 20 % is **marginal**.
- **Ranking:** passes first, then higher minimum battery, then higher % with both Sun and Earth, then nearer, then more continuous communication (shorter longest communication loss). No weighted score.
- **Validation:**
  - compare the vector with Horizons (< 0.1°) through a fixture. **Passed on 14/11:** 30 points, maximum error 0.015° in azimuth and 0.010° in elevation;
  - compare the % of sunlight and % of Earth visibility with PGDA 69 (only the same trend is needed);
  - compare one cell with QuickMap.

## 7. Energy (modules C3, C4)

- The example in the form (1000 W, 10 kWh, 300 W) is only an illustration. The interface must state clearly that these are not real spacecraft specs.
- C3 "energy needed": finds the dark periods and computes the minimum battery capacity to survive the window, using the largest cumulative deficit.
- C4 "charging": simulates the battery hour by hour, the hours to recharge fully, and the battery level at each sunset.

## 8. Interface (details: `docs/window-finder.md` §3)

The interface text is in **English** by default; there is a selector for 7 languages (i18n, new text uses `t()`, see §9). It must work well on a laptop and be usable on a phone.

1. **2D south pole map** (W2): feasible cells are colored, infeasible cells stay gray. Clicking a cell opens a popup with ID, slope, Sun/Earth and a "Use as current point" button.
2. **Scenario form** (W3): has Simple and Expert modes.
3. **Results** (W4):
   - a landing-time slider with Play;
   - the map changes to green/yellow/red, and the top 10 table updates immediately;
   - a "current point" card, a status strip over time, the top 10 pairs.
4. **Details** (W5):
   - a horizon view with the path of the Sun **and** Earth;
   - a prominent **sunset/Earthset countdown clock**; the Sun elevation shown large;
   - a battery chart; a comparison of two horizons with one explanatory sentence; CSV export.
5. **3D globe** (W6) and **learning mode** (W7).
6. **Transparency and sharing:**
   - the footer lists data sources and resolution; the About page has a Known limitations section (`docs/window-finder.md` §7);
   - a share link stores the scenario in the query string; a static `og:image` tag.

If time runs short, drop in this order: 3D globe, learning mode, the "all 9 regions" scope.

## 9. Code rules

- Variable and function names **as clear as possible** (`sunElevation`, `findLongestDarkPeriod`), no hard-to-guess abbreviations. Names carry the unit (`…Deg`, `…Km`, `…Wh`, `…Hours`, `…Fraction`).
- Code **as short as possible**, no early optimization, no extra abstraction. One component per file, short.
- Plain JavaScript, no TypeScript. Short comments in English, only where the code is hard to understand.
- Modules in `web/src/core/` are pure functions: no React, no DOM, no fetch (except `data.js`).
- Every step must leave a **working** version (`npm run dev` without errors, `npm run lint && npm run build` pass). Suggest a commit after each step.
- Before editing many files, say briefly what you will do. When done, say how to try it.
- Do not invent scientific data. Values in tests are synthetic data and must be labeled as such.
- Whenever you add a library, data source or image: add a line to `REFERENCES.md` and `DATA_SOURCES.md`.
- Add one line to `AI_USAGE.md` for each major piece of work done by Claude Code (the competition rules require AI disclosure).
- Claiming a module: write your name in the module table in `docs/technical-reference.md`. Edit only your own module's files.
- New interface text uses a `t()` key and has both an `en` block and a `vi` block in `web/src/i18n/translations.js`. A missing key falls back to English.

## 10. Deploy to Vercel

- Root Directory on Vercel = `web`. Framework preset Vite: build `npm run build`, output `dist`.
- `.gitignore`: `node_modules/`, `dist/`, `.venv/`, `pipeline/raw/`, `*.tif`, `.env*`, `.vercel/`. GitHub blocks files > 100 MB.
- Each JSON file in `web/public/data/` must be smaller than 2 MB.
- Fetch paths are absolute and go through `web/src/core/data.js`.
- The final link must be public, open in an incognito tab, and need no login.

## 11. Plan (details: `docs/window-finder.md` §8, the module table in `docs/technical-reference.md`)

| Time | Work |
|---|---|
| Day 1 (14/11) | D1 ephemeris + vector validation; D2–D5 for the Malapert (MAL) region, then all 9 regions; C0–C5; W1–W4 on mock data. Goal: run the whole flow for one region |
| Day 2 morning | W5 details, D6 famous sites, W6 globe, W7 learning mode, D7 PGDA 69 + QuickMap validation |
| Day 2 noon | Feature freeze, deploy to Vercel, record the demo video |
| Day 2 afternoon | Fix bugs, English project page, slides, submit early |
| Day 2 evening | Extra modules E1–E8 (`docs/extra-prospect.md`; E9, E10 wait for someone to download the LGRS data), one `extra/<code>` branch and one PR per module; merging stops at 22:30 |

Submission requirements (checked against the Submission Guide 2026):

- written in English;
- High-Level Summary;
- public project link;
- demo of at most 7 slides or a 30-second video;
- detailed description;
- space agency data used;
- References.
