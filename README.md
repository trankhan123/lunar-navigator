# Lunar Landing Site Navigator — Window Finder

*Tell us your landing spot and your mission's limits. We find the best nearby sites and dates, ranked hour by hour.*

NASA Space Apps Challenge 2026 · challenge **Lunar Landing Site Navigator** · submission deadline **15 Nov 2026, 23:59 (UTC+7)**.

- Product design (Vietnamese, the team's final idea): [docs/window-finder.md](docs/window-finder.md)
- Rules for Claude Code and the short spec: [CLAUDE.md](CLAUDE.md)
- Every data file, URL and library: [DATA_SOURCES.md](DATA_SOURCES.md) · credits: [REFERENCES.md](REFERENCES.md) · AI usage: [AI_USAGE.md](AI_USAGE.md)

**This README is the integration contract.** Every module below has fixed inputs, outputs, units and file formats. Build your module against them and the pieces fit together without meetings.

## What the app does

1. On a 2D south-pole map, the user picks the planned landing cell from the **USGS Lunar Grid Reference System (LGRS)** 1 km grid of the 9 Artemis III regions. Only feasible cells (slope ≤ 20°, not in permanent shadow) can be picked. The user can also type coordinates or pick a famous site.
2. The user enters the date range and mission limits: stay length, longest allowed dark period, longest allowed comm loss, panel power, battery, load.
3. On **Submit**, the browser simulates Sun, Earth and battery hour by hour. It does this for every feasible cell in the search scope and for every landing time, in 6 h steps.
4. The user drags the **landing-time slider**. The map recolours each cell (pass / marginal / fail) and the top-10 table updates instantly. A card shows how the user's current point does and where the nearest passing time and cell are.
5. Opening a row shows the detail view:
   - the horizon view with the Sun and Earth paths;
   - a countdown to sunset and Earthset;
   - the battery chart;
   - a side-by-side comparison with the current point, with one sentence explaining the difference.

## Architecture

```
[Python, run once on a laptop]                              [Browser, static site on Vercel]
 JPL Horizons ──────────── D1 ─> ephemeris.json ──────────┐
 USGS LGRS 1 km grid ───── D2 ─> out/grid_<CODE> ───┐      │   C0 geometry + time series
 PGDA 90 slope + shadow ── D3 ─> out/feasibility_ ──┼ D5 ─>│   C1 sunlight   C2 communication
 PGDA 90 DEM ───────────── D4 ─> out/horizon_ ──────┘      ├─> C3 energy need C4 charging
 famous sites ──────────── D6 ─> pipeline/sites.json ──────┤   C5 optimizer (Web Worker)
 PGDA 69 ───────────────── D7 ─> validation.json ──────────┤        │
 PGDA 90 hillshade ─────── D8 ─> maps/*.png ───────────────┘   W1–W7 React UI
                                   D5 = cells_<CODE>.json, regions.json, sites.json
```

All heavy terrain work is done ahead of time in Python. The browser only needs the ephemeris (about 1 MB) and one cells file per region (about 0.3 MB). The Sun and Earth position at any cell follows from the sub-solar and sub-Earth points with one vector formula ([C0](#c0-shared-geometry-and-time-series)), so arbitrary coordinates work too.

## Quick start

**Web** (Node 20.19+):

```bash
cd web
npm install
npm run dev        # http://localhost:5173
npm test           # contract tests of web/src/core (fail until each module is implemented)
npm run lint && npm run build
```

While `web/public/data/regions.json` does not exist yet (D5), the web reads fake data from `web/public/data/mock/` (every file has `"mock": true`, and the UI shows a **MOCK DATA** badge). To regenerate it after a contract change, run `python pipeline/make_mock_data.py`.

**Data pipeline** (Python 3.11+):

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r pipeline/requirements.txt
python pipeline/download_data.py           # about 920 MB into pipeline/raw/ (gitignored), resumes on drops
python pipeline/check_web_data.py          # checks web/public/data against this README
python pipeline/check_web_data.py web/public/data/mock
```

LGRS shapefiles cannot be downloaded by script (ScienceBase returns 403). See [D2](#d2-lgrs-grid).

## How to pick a module

1. **Choose a row** in the module board whose `Needs` are done, or that can start on mock data.
2. **Claim it:**
   - write your name in `Owner` and set `Status` to `doing`;
   - commit and push that README change right away, so two people never take the same module.
3. **Touch only the files listed** for your module.
   - Do not change a function signature, JSON field, unit or file name from the contracts below on your own.
   - If the contract has to change, agree with the team first. Then update this README, the contract test and `pipeline/check_web_data.py` in the same commit.
4. **Implement:**
   - remove the `eslint-disable` stub line at the top of the JS file;
   - replace `throw notImplemented(...)` or `raise NotImplementedError` with real code.
5. **Done** means all of these are true:
   - the module's *Done when* list holds;
   - its contract test passes (`cd web && node --test src/core/<file>.test.js`);
   - `npm run lint && npm run build` pass.

   Then set `Status` to `done`.

**Team of 5:** the modules are bundled into workflows WF1–WF5 (D + C modules that belong together) plus WEB. Pick a whole workflow in [distribution.md](distribution.md), which also gives the order of work and the handoffs. Logic parts of two web modules belong to workflows: `core/explain.js` → WF3, and `validateScenario` / `LANDER_PRESETS` in `core/scenario.js` → WF4. WEB builds the components.

Status values: `todo` · `doing` · `done` · `blocked (reason)`. Size: **S** ≈ 1–2 h, **M** ≈ 3–4 h, **L** ≈ 5 h or more.

## Module board

| ID | Workflow | Module | Files | Needs | Size | Owner | Status |
|---|---|---|---|---|---|---|---|
| D1 | done | Ephemeris (JPL Horizons) | `pipeline/fetch_horizons.py` | — | M | Claude (trankhan123) | done |
| D2 | WF5 | LGRS grid (1 km cells) | `pipeline/build_grid.py` | LGRS shapefiles (manual download) | M | | todo |
| D3 | WF5 | Landing feasibility (slope, permanent shadow) | `pipeline/compute_feasibility.py` | D2 | S | | todo |
| D4 | WF1 | Terrain horizon | `pipeline/compute_horizon.py` | D2 (D6 for sites) | L | | todo |
| D5 | WF5 | Build web data | `pipeline/build_site_data.py` | D2, D3, D4 | S | | todo |
| D6 | WF2 | Famous sites (coordinates) | `pipeline/sites.json` | — | S | | todo |
| D7 | WF2 | Validation (PGDA 69, Horizons, QuickMap) | `pipeline/validate.py` | D1, D5, C1, C2 | M | | todo |
| D8 | WF5 | Map background images | `pipeline/export_map_background.py` | D5 | S | | todo |
| C0 | done | Shared geometry and time series | `web/src/core/geometry.js`, `timeSeries.js` | — | S | Claude (trankhan123) | done |
| C1 | WF1 | Sunlight | `web/src/core/sunlight.js` | C0 | M | Quoc_Bao | done |
| C2 | WF2 | Communication (sóng liên lạc, direct-to-Earth) | `web/src/core/communication.js` | C0 | S | | todo |
| C3 | WF4 | Energy need (năng lượng cần) | `web/src/core/energyNeed.js` | track shape only | S | hoanggbach | done |
| C4 | WF4 | Charging (sạc năng lượng, battery) | `web/src/core/charging.js` | track shape only | S | hoanggbach | done |
| C5 | WF3 | Optimizer: best nearby cell and date (quãng đường tối ưu) | `web/src/core/optimizer.js` | C1–C4 | L | vominhuy28 | done |
| W1 | WEB | App shell, data loading, share link, modes, About | `web/src/App.jsx`, `core/shareLink.js` | — | M | trankhan123 | doing |
| W2 | WEB | South-pole map and cell popup | `components/SouthPoleMap.jsx`, `CellPopup.jsx` | W1 (D8 optional) | L | trankhan123 | doing |
| W3 | WEB | Scenario form | `components/ScenarioForm.jsx`, `core/scenario.js` | — | M | trankhan123 | doing |
| W4 | WEB | Results: slider, ranking, current-point card | `components/LandingTimeSlider.jsx`, `RankingTable.jsx`, `CurrentPointCard.jsx`, `CurrentPointStrip.jsx`, `BestPairsTable.jsx` | C5 | L | trankhan123 | todo |
| W5 | WEB | Detail: horizon view, countdown, battery chart, compare | `components/DetailView.jsx`, `HorizonChart.jsx`, `CountdownCard.jsx`, `BatteryChart.jsx`, `CompareView.jsx`, `core/explain.js` | C1–C4 | L | trankhan123 | todo |
| W6 | WEB | 3D globe | `components/MoonGlobe.jsx` | W1 | M | trankhan123 | todo |
| W7 | WEB | Learn mode | `components/LearnView.jsx`, `core/explain.js` (`findMostDifferentNeighbors`) | C5 | S | trankhan123 | todo |
| S1 | all | Submission: video or slides, project page, references | `docs/`, `REFERENCES.md`, `AI_USAGE.md` | all | M | trankhan123 | todo |
| X1 | — | *(optional)* astronomy-engine for dates outside the ephemeris | `web/src/astronomy.js` | C0 | S | | later |

**Already done:** C0 and D1. The real `web/public/data/ephemeris.json` is in the repo: 2027-01-01 → 2029-01-31, 18,288 h, 0.69 MB. The vector method matches Horizons within 0.015°. Also done: `web/src/core/data.js` (loaders, `hourIndexOf`, `timeAtHour`), `scenario.js` constants and `countDays`, the Web Worker files (`windowSearchWorker.js`, `startWindowSearch.js`), the data checker, the mock data and `pipeline/download_data.py`.

**Critical path for the end of day 1** (window-finder.md §8: full flow for one region, Malapert Massif):

- **Browser core:** C0 → C1, C2 → C3, C4 → C5 → W4.
- **Pipeline, in parallel:** D1, and D2 → D3, D4 → D5 for `MAL` first.
- **Start now on mock data:** W1, W2, W3.

**If late, drop in this order:** W6 globe, W7 learn mode, the `all` search scope.

**"Quãng đường tối ưu" is C5.** It ranks cells and landing times, and reports the nearest passing cell in km. Rover route planning was dropped in window-finder.md §3.2. If the team wants it back, it needs a new module and a slope-limit field.

## Global conventions (every module)

| Topic | Rule |
|---|---|
| Angles | Degrees everywhere. Azimuth clockwise from North, `0 ≤ az < 360`. Elevation above the local horizontal plane of the 1737.4 km sphere. |
| Coordinates | `lat` degrees North (south is negative), `lon` degrees **East** in −180…180, Moon mean-Earth/polar-axis (ME) frame. |
| Map coordinates | `xM`, `yM` in metres, PGDA south polar stereographic (`common.PGDA_CRS`). `+x` points to lon 90°E and `+y` to the 0° meridian, so draw x to the right and y up. |
| Time | UTC. Times are written `YYYY-MM-DDTHH:mmZ`, dates `YYYY-MM-DD`. Ephemeris hour `i` = `startTime + i h`. Convert only with `hourIndexOf` / `timeAtHour` (`core/data.js`). |
| Hourly arrays | `Float32Array` in the browser, plain lists in JSON. Track index `i` ↔ ephemeris hour `track.firstHour + i`. Window functions take `(startIndex, lengthHours)` in track indices. |
| Units in names | `…Deg`, `…Km`, `…M`, `…W`, `…Wh`, `…Hours`, `…Au`, `…Fraction` (0…1). Percent only in UI text. |
| Energy | The core works in W and Wh. The form shows the battery in kWh and converts. |
| Visible | A body counts as visible when **≥ 50 % of its disk** is above the terrain horizon (`VISIBLE_THRESHOLD = 0.5`). A dark hour has Sun < 0.5; a comm-loss hour has Earth < 0.5. |
| Disk radius | Sun 0.27°, Earth 0.95° (constants in `geometry.js`). |
| Missing values | `null` in JSON and JS objects. In `WindowResults` typed arrays, −1 for integers and `NaN` for floats. |
| JSON files | Always an object (never a bare array), < 2 MB. `"mock": true` appears only under `web/public/data/mock/`. Rounding: degrees 2 decimals, horizon integers of 0.1°, km integers, AU 5 decimals. |
| UI text | English. |

## Data files (pipeline → web)

All files live in `web/public/data/` (mock copies in `web/public/data/mock/`). `python pipeline/check_web_data.py [folder]` must pass for both folders.

### `ephemeris.json` (D1)

```json
{
  "source": "JPL Horizons API, COMMAND=301 CENTER=500@399 QUANTITIES=14,15,19,20, retrieved 2026-11-14",
  "startTime": "2027-01-01T00:00Z",
  "stepHours": 1,
  "hours": 18288,
  "sunSubLonDeg": [],
  "sunSubLatDeg": [],
  "sunDistanceAu": [],
  "earthSubLonDeg": [],
  "earthSubLatDeg": [],
  "earthDistanceKm": []
}
```

- Every array has length `hours`.
- `sun*` are the sub-solar point on the Moon and the Moon-centre → Sun distance.
- `earth*` are the sub-Earth point (libration is included) and the Moon-centre → Earth-centre distance.
- The file covers 2027-01-01T00:00Z … 2029-01-31T23:00Z (18,288 h), so any 6-month range in 2027–2028 plus a 30-day stay fits.

### `regions.json` (D5)

```json
{ "regions": [{ "code": "MAL", "siteId": "malapert-massif", "name": "Malapert Massif", "lat": -85.925, "lon": -1.205,
                "verified": false, "cellCount": 225, "feasibleCount": 140, "cellsFile": "cells_MAL.json",
                "boundsM": [0, 0, 0, 0] }] }
```

`boundsM` = `[xMin, yMin, xMax, yMax]` of the region's cells. `cellsFile` is relative to the same folder.

| Code | Region | `siteId` in `pipeline/sites.json` |
|---|---|---|
| CAB | Peak near Cabeus B | `peak-near-cabeus-b` |
| HAW | Haworth | `haworth` |
| MAL | Malapert Massif | `malapert-massif` |
| MMP | Mons Mouton Plateau | `mons-mouton-plateau` |
| MMO | Mons Mouton | `mons-mouton` |
| NR1 | Nobile Rim 1 | `nobile-rim-1` |
| NR2 | Nobile Rim 2 | `nobile-rim-2` |
| DGR | de Gerlache Rim 2 | `de-gerlache-rim-2` |
| SLP | Slater Plain | `slater-plain` |

### `cells_<CODE>.json` (D5)

```json
{
  "region": "MAL", "name": "Malapert Massif",
  "gridSource": "USGS LGRS ACC 1 km grid, McClernan 2024, doi:10.5066/P1MEQ6UK",
  "demSource": "LOLA PGDA 90: LDEM_80S_80MPP_ADJ + LDEM_60S_240MPP_ADJ",
  "mastHeightM": 2, "slopeLimitDeg": 20, "psrLimitFraction": 0.5, "horizonUnitDeg": 0.1,
  "cells": [{
    "id": "MAL-<label>", "label": "<ACC 1 km label>",
    "lat": -85.93, "lon": -1.2, "xM": 0, "yM": 0,
    "heightM": 0.0, "slopeDeg": 12.3, "psrFraction": 0.0,
    "feasible": true, "infeasibleReason": null,
    "horizon": [0]
  }]
}
```

- **Keys:** each cell has exactly these keys.
- **`id`:** `id` = `<CODE>-<label>`.
- **Feasibility:**
  - `feasible` = `slopeDeg ≤ slopeLimitDeg` and `psrFraction ≤ psrLimitFraction`;
  - `infeasibleReason` is `"slope"` (checked first), `"psr"` or `null`.
  - the rule is applied to the rounded values written in the file.
- **`horizon`:** 360 integers. `horizon[k]` is the terrain horizon elevation at azimuth k° in units of 0.1°. It may be negative because of curvature, and the mast height is already included.
- **Infeasible cells:** they stay in the file and are drawn grey. Only feasible cells are searched.
- **Size limit:** if a region has more than about 2,000 cells (the file would pass 2 MB), tell the team before changing the format.

### `sites.json` (D5, from D6)

```json
{ "sites": [{ "id": "apollo-11", "name": "Apollo 11", "group": "apollo", "lat": 0.67416, "lon": 23.47314,
              "region": null, "hasTerrain": false, "horizon": null, "source": "nssdca-apollo", "verified": true }] }
```

- `group` is one of `artemis-region | apollo | clps | international`.
- `region` is a region code for the 9 Artemis region centres, `null` otherwise.
- `hasTerrain` is `true` exactly when `horizon` is given, which happens for sites at lat ≤ −60° (inside the 60°S DEM).
- Sites whose coordinates are still TODO are never published.

### `validation.json` (D7)

```json
{
  "pgda69": [{ "cellId": "MAL-…", "pgdaSunFraction": 0, "pgdaEarthFraction": 0, "ourSunFraction": 0, "ourEarthFraction": 0 }],
  "horizons": { "pointCount": 30, "maxAzimuthErrorDeg": 0, "maxElevationErrorDeg": 0, "checkedAt": "2026-11-15" },
  "quickmap": [{ "cellId": "MAL-…", "image": "/validation/quickmap_MAL.png", "note": "" }]
}
```

### `web/public/maps/maps.json` (D8)

```json
{ "maps": [{ "id": "south_pole", "kind": "hillshade", "image": "/maps/south_pole.png", "boundsM": [0, 0, 0, 0], "metersPerPixel": 400 }] }
```

- `id` is `south_pole` or a region code.
- `kind` is `hillshade` or `sun-visibility`.
- Each PNG is ≤ 1 MB.

### Pipeline intermediate files (`pipeline/out/`, committed so others can build without raw data)

| File | Written by | Format |
|---|---|---|
| `grid_<CODE>.json` | D2 | `[{"id", "label", "lat", "lon", "xM", "yM"}]` |
| `feasibility_<CODE>.json` | D3 | `{"<cellId>": {"heightM", "slopeDeg", "psrFraction"}}` |
| `horizon_<CODE>.json` | D4 | `{"<cellId>": [360 ints, 0.1°]}` |
| `horizon_sites.json` | D4 | `{"<siteId>": [360 ints, 0.1°]}` |
| `our_visibility.json` | D7 | `{"<cellId>": {"sunFraction", "earthFraction"}}` over the whole ephemeris |

### Test fixture `web/src/core/fixtures/horizons_check.json` (D1)

```json
{ "source": "JPL Horizons, CENTER=coord@301, QUANTITIES=4",
  "points": [{ "lat": -85.925, "lon": -1.205, "heightM": 0, "body": "sun", "time": "2028-01-01T00:00Z",
               "azimuthDeg": 0, "elevationDeg": 0, "subLonDeg": 0, "subLatDeg": 0, "distanceKm": 0 }] }
```

`geometry.test.js` checks that `bodyAzimuthElevation` matches every point within 0.1°. The test is skipped until this file exists.

## Browser core contracts (`web/src/core/`, plain JS)

Core files are pure functions with no React, no DOM and no fetch (`data.js` is the only exception). That way they run in node tests and inside the Web Worker. Every file has a contract test `<file>.test.js`, run with `cd web && node --test src/core/<file>.test.js`. The JSDoc in each file repeats these contracts and must stay identical to them.

### Shared objects

**`Cell`** — one cell of `cells_<CODE>.json`. Two kinds of pseudo-cell have the same keys:

- a famous site: `id: "SITE-<siteId>"`, `horizon` from `sites.json` or `null`;
- typed coordinates: `id: "CUSTOM"`, `heightM: 0`, `horizon: null` (smooth sphere, shown as "terrain not included"), `feasible: null`, and `xM/yM` computed when lat ≤ −60, else `null`.

**`Ephemeris`** — the parsed `ephemeris.json`.

**`Scenario`** — the form output; defaults are in `core/scenario.js` (`DEFAULT_SCENARIO`). The example numbers are illustrative, not any real lander, and the UI says so.

| Field | Type | Example | Rule (`validateScenario`) |
|---|---|---|---|
| `currentPoint` | `{type:'cell', cellId}` \| `{type:'site', siteId}` \| `{type:'coordinates', lat, lon}` | `{type:'cell', cellId:'MAL-…'}` | required; coordinates need −90 ≤ lat ≤ 90 and −180 ≤ lon ≤ 180 |
| `startDate`, `endDate` | `'YYYY-MM-DD'` | 2028-01-01, 2028-06-30 | real calendar dates (2028-02-30 is an error); start ≤ end; ≤ 183 days (both ends counted); `endDate + stayDays` inside the ephemeris |
| `stayDays` | integer | 6 | 1…30 |
| `maxDarkHours` | number | 24 | ≥ 0 |
| `maxCommLossHours` | number | 12 | ≥ 0 |
| `panelMaxW` | number | 1000 | > 0. Power at 1 AU, full disk, Sun perpendicular to the panel |
| `batteryCapacityWh` | number | 10000 | > 0. Full at landing |
| `loadW` | number | 300 | ≥ 0. Constant average |
| `panelMode` | `'auto'` \| `'vertical'` \| `'horizontal'` | auto | one of the three; auto = vertical when \|lat\| ≥ 60°, else horizontal |
| `searchScope` | `'region'` \| `'radius'` \| `'all'` | region | one of the three |
| `searchRadiusKm` | number | 10 | > 0 when scope is `radius` |

`validateScenario(scenario, ephemeris)` returns at most one `{field, message}` per field, or `[]` when the scenario is valid.

**`SunTrack`** `{firstHour, panelType, azimuthDeg, elevationDeg, diskFraction, powerFactor}` and **`EarthTrack`** `{firstHour, azimuthDeg, elevationDeg, diskFraction}`: each array is a `Float32Array` of length `hourCount`.

**`WindowMetrics`** — one (cell, landing time) pair over `stayDays × 24` hours:
`{status: 'pass'|'marginal'|'fail', failReasons: ('dark'|'commLoss'|'battery')[], longestDarkHours, longestCommLossHours, fractionSun, fractionEarth, fractionBoth, meanSunElevationDeg|null, hoursToSunset|null, minBatteryFraction, deadAtHour|null, rechargeHours|null}`.

**`WindowResults`** — flat typed arrays indexed `cellIndex * landingCount + landingIndex`; cell 0 is always the current point. The full field list is the typedef in `optimizer.js`.

### C0 Shared geometry and time series

Files: `geometry.js`, `timeSeries.js`.

| Function | Returns |
|---|---|
| `bodyAzimuthElevation(cell, subLonDeg, subLatDeg, distanceKm)` | `{azimuthDeg, elevationDeg}` |
| `horizonElevationAt(horizon, azimuthDeg)` | degrees, linear between whole degrees, wraps 359→0, `null` horizon → 0 |
| `visibleDiskFraction(elevationDeg, horizonDeg, diskRadiusDeg)` | 0…1 |
| `distanceKm(a, b)` | great-circle km on the 1737.4 km sphere |
| `longestRunBelow(values, threshold, start, length)` | hours |
| `fractionAtLeast(values, threshold, start, length)` | 0…1 |
| `fractionBothAtLeast(a, b, threshold, start, length)` | 0…1 |
| `firstIndexBelow(values, threshold, start, length)` | offset from `start`, or `null` |
| `meanWhereAtLeast(values, gate, threshold, start, length)` | mean of `values` where `gate ≥ threshold`, or `null` |
| `nextCrossing(values, threshold, atIndex)` | `{direction: 'down'|'up', hoursFromNow}` (linear interpolation, `atIndex` may be fractional) or `null` |

Formulas (window-finder.md §4.3):

```
P = (R + h)·(cosφ cosλ, cosφ sinλ, sinφ)      R = 1737.4 km, h = heightM / 1000
B = D·(cosφb cosλb, cosφb sinλb, sinφb)        sub-body point (λb, φb), distance D
d = B − P,  up = P/|P|,  east = (−sinλ, cosλ, 0),  north = up × east
el = asin(d·up / |d|),  az = atan2(d·east, d·north) mod 360
frac = clamp((el − H + ρ) / (2ρ), 0, 1)        H = horizon at az, ρ = disk radius
```

**Done when:** `geometry.test.js` and `timeSeries.test.js` pass, including the Horizons fixture test once D1 publishes it.

### C1 Sunlight

File: `sunlight.js`.

| Function | Returns |
|---|---|
| `resolvePanelType(panelMode, latDeg)` | `'vertical'` \| `'horizontal'` |
| `panelFactor(elevationDeg, panelType)` | vertical `cos(el)`, horizontal `max(sin(el), 0)` |
| `computeSunTrack(cell, ephemeris, firstHour, hourCount, panelMode)` | `SunTrack` |
| `summarizeSunWindow(sunTrack, startIndex, lengthHours)` | `{longestDarkHours, fractionSun, meanSunElevationDeg, hoursToSunset}` |
| `nextSunEvent(sunTrack, atIndex)` | `{event: 'sunset'|'sunrise', hoursFromNow}` or `null` |

Rules:

- `diskFraction` uses `horizonElevationAt(cell.horizon, az)` and `SUN_DISK_RADIUS_DEG`.
- `powerFactor = (1 / sunDistanceAu)² × diskFraction × panelFactor`.
- `meanSunElevationDeg` is the mean over sunlit hours only, or `null` if there are none.
- `hoursToSunset` is the offset of the first dark hour: 0 if it is dark at landing, `null` if it never gets dark in the window.
- **Speed:** one cell × 4,500 h in under 5 ms. Do not allocate objects inside the hour loop.

### C2 Communication

File: `communication.js`.

| Function | Returns |
|---|---|
| `computeEarthTrack(cell, ephemeris, firstHour, hourCount)` | `EarthTrack` |
| `summarizeEarthWindow(earthTrack, startIndex, lengthHours)` | `{longestCommLossHours, fractionEarth}` |
| `nextEarthEvent(earthTrack, atIndex)` | `{event: 'earthset'|'earthrise', hoursFromNow}` or `null` |

Rules:

- Use `EARTH_DISK_RADIUS_DEG`.
- Always use the cell position, never the Moon centre. Earth is close enough that parallax shifts it by up to 0.26°.
- **Known limitation:** the model does not check whether a ground station on Earth can see the Moon.

### C3 Energy need

File: `energyNeed.js`.

| Function | Returns |
|---|---|
| `findDarkPeriods(diskFraction, startIndex, lengthHours)` | `[{startOffset, lengthHours}]` in time order |
| `summarizeEnergyNeed(sunTrack, startIndex, lengthHours, {panelMaxW, loadW})` | `{totalLoadWh, totalGeneratedWh, energyBalanceWh, minimumCapacityWh, longestDarkEnergyWh, darkPeriods: [{startOffset, lengthHours, energyWh}]}` |

Rules:

- Generation in hour `h` = `panelMaxW × powerFactor[h] × 1 h`. Load = `loadW × 1 h`.
- `minimumCapacityWh` is the largest value of the running deficit over the window:
  - `D₀ = 0` and `D_{h+1} = max(0, D_h − (generation − load))`;
  - a battery that starts full survives the window exactly when `capacity > minimumCapacityWh`.
- The `energyWh` of a dark period is `loadW × lengthHours`.
- The UI shows it as "Battery needed for this window: X kWh".

### C4 Charging

File: `charging.js`.

| Function | Returns |
|---|---|
| `simulateBattery(powerFactor, startIndex, lengthHours, {panelMaxW, loadW, batteryCapacityWh})` | `{batteryWh (length lengthHours+1), minBatteryWh, minBatteryFraction, deadAtHour, rechargeHours, chargingMask (length lengthHours)}` |
| `findFullChargeWindows(batteryWh, sunDiskFraction, startIndex, batteryCapacityWh)` | `[{sunsetOffset, batteryAtSunsetFraction, fullBeforeSunset}]` |

Rules:

- **Simulation:**
  - `batteryWh[0] = capacity`;
  - `raw = batteryWh[h] + panelMaxW × powerFactor[startIndex + h] − loadW`;
  - `batteryWh[h+1] = clamp(raw, 0, capacity)`.
- **`deadAtHour`:** the first `h+1` with `raw ≤ 0`, or `null`.
- **`minBattery…`:** taken over `batteryWh`.
- **`rechargeHours`:** hours from the first minimum to the first full value after it. 0 if the battery never discharged, `null` if it is not full again inside the window.
- **`chargingMask[h]`:** 1 when generation > load.
- **Sunset** is an offset `h ≥ 1` with `sunDiskFraction[startIndex+h−1] ≥ 0.5` and `sunDiskFraction[startIndex+h] < 0.5`.
- **At each sunset:**
  - `batteryAtSunsetFraction = batteryWh[h] / capacity`;
  - `fullBeforeSunset = batteryAtSunsetFraction ≥ 0.999`.

### C5 Optimizer

Files: `optimizer.js`. The Web Worker files `windowSearchWorker.js` and `startWindowSearch.js` are already written.

| Function | Returns |
|---|---|
| `evaluateWindow(sunTrack, earthTrack, startIndex, scenario)` | `WindowMetrics` |
| `selectSearchCells(scenario, currentCell, cellsByRegion)` | `Cell[]`, current point first |
| `runWindowSearch(cells, ephemeris, scenario, onProgress)` | `WindowResults` |
| `metricsAt(results, cellIndex, landingIndex)` | `WindowMetrics` + `{cellIndex, cellId, landingIndex, landingTime, distanceKm}` |
| `rankCells(results, landingIndex, {sortBy, direction, limit = 10})` | rows of `metricsAt` + `rank` |
| `rankBestPairs(results, {limit = 10})` | best (cell, landing time) pairs over the whole range |
| `summarizeCurrentPoint(results, landingIndex)` | `{metrics, nearestPassingLanding: {landingIndex, landingTime, offsetHours} \| null, nearestPassingCell: {cellIndex, cellId, distanceKm} \| null}` |
| `startWindowSearch({cells, ephemeris, scenario, onProgress})` | `{promise (resolves WindowResults), cancel}` |

Rules:

- **Landing times:**
  - every 6 h, `k = 0 … countDays(startDate, endDate) × 4 − 1`;
  - landing `k` is at `startDate 00:00Z + 6k h`;
  - the window length is `stayDays × 24`.
- **Tracks:**
  - `firstHour = hourIndexOf(ephemeris, startDate + 'T00:00Z')` and `hourCount = (countDays + stayDays) × 24`;
  - window `k` starts at track index `6k`;
  - compute each cell's two tracks once, slide the window, then drop the tracks, so memory stays small for 2,000 cells.
- **Fail reasons**, in this order:
  - `'dark'` if `longestDarkHours > maxDarkHours`;
  - `'commLoss'` if `longestCommLossHours > maxCommLossHours`;
  - `'battery'` if `deadAtHour !== null`.
- **Status:** `fail` if there is any fail reason, otherwise `marginal` if `minBatteryFraction < 0.2`, otherwise `pass`. Codes: `STATUS = {fail: 0, marginal: 1, pass: 2}`; `failReasonBits` = dark 1 | commLoss 2 | battery 4.
- **`selectSearchCells`:**
  - `region` = feasible cells of the current point's region;
  - `radius` = feasible cells of all loaded regions within `searchRadiusKm`;
  - `all` = feasible cells of all 9 regions;
  - for a site or typed coordinates, "its region" is the region of the nearest grid cell within 1 km; if there is none, only the current point is searched;
  - the current point is always index 0, even when it is infeasible or custom, and there are no duplicate ids.
- **Default ranking order:**
  1. pass or marginal before fail;
  2. higher `minBatteryFraction`;
  3. higher `fractionBoth`;
  4. smaller `distanceKm`;
  5. smaller `longestCommLossHours` ("most seamless communication", docs/window-finder.md §3.3).

  There is no weighted score.
- **Sorting by column:**
  - `sortBy` may be any number key of `WindowMetrics` or `distanceKm`;
  - the default direction is better first: smaller is better for `distanceKm`, `longestDarkHours`, `longestCommLossHours` and `rechargeHours`, larger for the rest;
  - nulls go last, and ties fall back to the default order.
- **`summarizeCurrentPoint`:**
  - the nearest passing landing is the landing of cell 0 with status ≥ marginal closest in time to `landingIndex`; on a tie the later one wins;
  - `offsetHours = 6 × (k − landingIndex)`;
  - the nearest passing cell is the one with the smallest `distanceKm` and status ≥ marginal at `landingIndex`, cell 0 excluded.
- **Worker protocol:**
  - main → worker: `{type:'run', requestId, cells, ephemeris, scenario}`;
  - worker → main: `{type:'progress', requestId, doneCells, totalCells}`, then `{type:'done', requestId, results}` (typed array buffers are transferred) or `{type:'error', requestId, message}`.
- **Speed:** region scope (about 225 cells × 730 landings × 144 h) in under 3 s on a laptop.

## Web UI modules (`web/src/components/`, one component per file)

- **State:** it lives in `App.jsx` (W1). Components receive data by props and report back by callbacks.
- **Every screen shows:**
  - the footer line "Terrain: LOLA 80 m (NASA PGDA 90). Ephemeris: JPL Horizons. Grid: USGS LGRS.";
  - the **MOCK DATA** badge when the loaded data has `mock: true`.
- **Layout:** works on a laptop and is usable on a phone.

### W1 App shell

Files: `App.jsx`, `core/shareLink.js` (`core/data.js` is done).

- **Screens:** switched by state, no router: `'map'` (default), `'results'`, `'detail'`, `'globe'`, `'learn'`, `'about'`.
- **Loading:**
  - at start, load the ephemeris, regions and sites;
  - load cells per region on demand with `loadCells(useMock, region.cellsFile)`;
  - `useMock` is true while `/data/regions.json` is missing, or when `?mock=1` is in the URL.
  - The real `/data/ephemeris.json` already exists. The mock ephemeris only covers 2028-01 → 2028-07.
- **State it holds:** `scenario`, `results`, `landingIndex`, `selectedCellId`, `mode` (`'simple'|'expert'`).
- **Share link query keys:**
  - `point` (`cell:MAL-r3c4` \| `site:apollo-11` \| `coords:-85.9,-1.2`), `start`, `end`, `stay`, `dark`, `comm`, `panel`, `battery`, `load`, `panelMode`, `scope`, `radius`, `landing`, `cell`, `mode`, `screen`;
  - missing keys take `DEFAULT_SCENARIO` values;
  - a link opened on the Results screen (`screen=results`) with a current point runs the search on open;
  - untrusted values in the link (empty, not a number, unknown option, malformed point) fall back to the defaults.
- **Keyboard path to the map:** a Cell list next to the Region list selects any cell without a mouse.
- **Search:** before starting the worker, load the cells of every region the search needs (all regions for `radius` and `all`).
- **About screen:** known limitations (window-finder.md §7), data sources and AI usage.
- **Replace the old draft:** today's `App.jsx` is the old per-site draft reading `/data/mock/legacy/`. Replace it, then delete that folder.
- **Done when:** `shareLink.test.js` passes; the mock flow map → form → results → detail works; `npm run build` passes.

### W2 South-pole map

Files: `SouthPoleMap.jsx`, `CellPopup.jsx`.

- **`SouthPoleMap` props:** `{region, cells, sites, statusByCellId, currentCellId, selectedCellId, onSelectCell(cell)}`, one region at a time. A `mapBackground` prop (the region's entry in `maps.json`) is added when D8 lands.
  - `statusByCellId` is a `Map<cellId, 0|1|2>` at the current landing time, or `null` before Submit;
  - every status also shows a symbol (✓ ! ✕) so it does not rely on colour alone.
- **Drawing:**
  - draw in `xM/yM`, with x to the right and y up (the 0° meridian points up);
  - square cells 1 km wide;
  - use ECharts or SVG; no new library.
- **Colours:**
  - before Submit: feasible cells blue, infeasible cells grey (the tooltip gives the reason);
  - after Submit: green pass, yellow marginal, red fail, grey infeasible.
- **Pins and current point:** pins mark famous sites; the current point is outlined.
- **`CellPopup` props:** `{cell, ephemeris, hour, isCurrent, onUseAsCurrent, onClose}`. Copying the ID is handled inside, with a visible "Copied" confirmation.
  - It shows the id, lat/lon, height and slope.
  - It shows Sun and Earth elevation at `hour` and "sets in …", computed with C1/C2 tracks over the next 30 days.
  - It has the buttons "Copy ID" and "Use as current point". Infeasible cells explain why, and can still be the current point (the planner's own spot may be infeasible).
- **Done when:** it works on `mock/cells_MAL.json`, and tapping a cell selects it on a phone.

### W3 Scenario form

Files: `ScenarioForm.jsx`, `core/scenario.js`.

- **`ScenarioForm` props:** `{mode, value: Scenario, errors, sites, busy, onChange(scenario), onSubmit(scenario)}`.
- **Modes:**
  - Simple asks only for the point, dates and stay days, plus the `LANDER_PRESETS` dropdown;
  - Expert shows every field.
- **Current point** can be given three ways:
  - a cell ID text field, filled by the map's "Use as current point";
  - a famous-site dropdown;
  - lat/lon inputs.
- **Battery** is shown in kWh and stored in Wh.
- **Note under the form:** "Example values are illustrative, not the specification of any real lander."
- **Validation:** implement `validateScenario` (rules in the Scenario table), show errors next to their fields, and disable Submit while the scenario is invalid.
- **Done when:** `scenario.test.js` passes.

### W4 Results

Files: `LandingTimeSlider.jsx`, `RankingTable.jsx`, `CurrentPointCard.jsx`, `CurrentPointStrip.jsx`, `BestPairsTable.jsx`.

- **`LandingTimeSlider`** `{landingTimes, value, onChange, playing, onTogglePlay}`:
  - steps of 6 h;
  - Play advances one step about every 300 ms;
  - shows the UTC time.
- **`RankingTable`** `{rows, sortBy, direction, onSort(key), onSelectRow(row), currentCellId, mode}`:
  - columns: rank, cell, distance (km), min battery (%), longest dark (h), longest comm loss (h), Sun (%), Earth (%), mean Sun elevation (°), recharge (h), status;
  - Simple mode hides the last four;
  - clicking a header calls `onSort`.
- **`CurrentPointCard`** `{summary, mode}`:
  - pass or fail, with the reasons in words;
  - the nearest passing time ("+18 h") and the nearest passing cell with its distance in km.
- **`CurrentPointStrip`** `{landingTimes, statuses, value, onSelectLanding(index)}`:
  - an ECharts one-row heatmap of cell 0;
  - colour = status.
- **`BestPairsTable`** `{rows, onSelectRow}`: the output of `rankBestPairs`.
- **While the worker runs:** show a progress bar fed by `onProgress`.
- **Done when:** dragging the slider updates the map colours and the table in under 100 ms for region scope.

### W5 Detail

Files: `DetailView.jsx`, `HorizonChart.jsx`, `CountdownCard.jsx`, `BatteryChart.jsx`, `CompareView.jsx`, `core/explain.js`.

- **`DetailView`** `{cell, currentCell, ephemeris, scenario, landingTime, mode, onBack}`:
  - computes the stay-window tracks of both cells with C1–C4 on the main thread (cheap) and lays out the parts below;
  - in Expert mode, has a CSV export with one row per hour: `time, sunAzimuthDeg, sunElevationDeg, sunDiskFraction, earthAzimuthDeg, earthElevationDeg, earthDiskFraction, batteryWh`.
- **`HorizonChart`** `{horizonDeg, compareHorizonDeg, sunPath, earthPath, cursorIndex}`:
  - `horizonDeg` = `horizon / 10`, or zeros when the horizon is `null`;
  - the paths are `[azimuthDeg, elevationDeg][]`;
  - terrain is a filled area, and the Sun and Earth paths cover the whole stay, with big dots at the cursor;
  - always draw both bodies;
  - if you exaggerate the vertical scale, say so on the chart;
  - today's `HorizonChart.jsx` is the old draft: change its props to these.
- **`CountdownCard`** `{sunTrack, earthTrack, atIndex, mode}`:
  - big text such as "Sun sets in 3 h 20 min", "Earth sets in 18 h", "Sunlight returns in 2 d 4 h", from `nextSunEvent` / `nextEarthEvent`;
  - the Sun elevation in large type.
- **`BatteryChart`** `{batteryWh, capacityWh, chargingMask, sunDiskFraction, earthDiskFraction, startTime}`:
  - battery % as a line;
  - background bands for sunlit, dark and comm loss;
  - the dead hour marked;
  - shows `minimumCapacityWh` from C3.
- **`CompareView`** `{current, other}`, each `{cell, metrics, sunTrack, startIndex, lengthHours}`:
  - the two horizons overlaid;
  - the `explainDifference` sentence.
- **`explain.js`:**
  - `compassName`;
  - `explainDifference`: find hours that are dark at the current point but sunlit at the other cell, compare the two horizons at those Sun azimuths, and name the direction;
  - `findMostDifferentNeighbors` (for W7).
- **Done when:** `explain.test.js` passes, and the detail view of a mock cell renders every part.

### W6 Globe

File: `MoonGlobe.jsx`.

- **Props:** `{sites, regions, selectedSiteId, sunDirection, earthDirection, onSelectSite(site), onOpenSouthPoleMap()}`. `sunDirection` and `earthDirection` are `{azimuthDeg, elevationDeg}` or `null`.
- **Content:**
  - texture `/textures/lroc_color_2k.jpg` (NASA SVS 4720);
  - pins for the sites and the 9 regions;
  - arrows toward the Sun and Earth from the selected site.
- **Interaction:** a click at lat < −80° opens the map screen.
- **Lifecycle:** keep `new Globe(container)`, the `_destructor()` cleanup and stable callbacks.

### W7 Learn mode

File: `LearnView.jsx`.

- **Props:** `{results, cellsById, landingIndex}`.
- **Cards:**
  - a plain-English sentence for each metric;
  - "Why moving 1 km matters": `findMostDifferentNeighbors` plus the two horizons;
  - "How the Moon differs from Earth": no atmosphere, so no refraction and a black sky; the Sun is only a few degrees high at the pole; one lunar day is about 29.5 Earth days.

### S1 Submission

Everything is in English and follows the Space Apps 2026 Submission Guide:

- High-Level Summary, a detailed description and the public project link;
- a 30 s video or at most 7 slides (record with the `ui-demo` skill);
- the Space Agency Data list (JPL Horizons, LOLA PGDA 90 and 69, USGS LGRS, NASA SVS);
- References, and AI usage from `AI_USAGE.md`.

Target: submit on 15 Nov in the afternoon; the portal closes at 23:59 UTC+7.

## Pipeline modules (`pipeline/`)

Shared paths, CRS, limits and region codes are in `pipeline/common.py`. Import them; never copy the constants.

### D1 Ephemeris

File: `fetch_horizons.py`.

- **Input:** the Horizons API (window-finder.md §5.1): `COMMAND='301'`, `CENTER='500@399'`, `QUANTITIES='14,15,19,20'`, `STEP_SIZE='1h'`, `CSV_FORMAT='YES'`.
- **Output:** `ephemeris.json` and `fixtures/horizons_check.json`.
- **Rules:**
  - one request per quarter; cache the raw text in `pipeline/raw/horizons/`;
  - read the header for column names and units (ask for the Earth range in km);
  - longitudes become East-positive in −180…180.
- **Fixture:** 3 points (MAL centre, HAW centre, Apollo 11) × Sun and Earth × 5 times, via `CENTER='coord@301'`, `SITE_COORD`, `QUANTITIES='4'`.
- **Result (14/11):**
  - 9 quarterly calls (about 47 s, cached), giving 18,288 hours;
  - frame `MOON_ME`, Horizons longitudes are East-positive 0…360 and were converted to −180…180;
  - the Earth range came back in km (`RANGE_UNITS=KM`);
  - fixture: 30 points; `bodyAzimuthElevation` differs from Horizons apparent az/el by at most **0.015° in azimuth and 0.010° in elevation**, so the sub-point method is validated (no fallback needed).
- **Done when:**
  - `check_web_data.py` passes on the ephemeris part;
  - `geometry.test.js` passes the Horizons test (< 0.1°) once C0 is implemented. If it fails, check the longitude convention and frame first; the fallback is in §5.1.

### D2 LGRS grid

File: `build_grid.py`.

- **Input:** the 1 km ACC shapefiles of the 9 regions from McClernan 2024, USGS data release [doi:10.5066/P1MEQ6UK](https://doi.org/10.5066/P1MEQ6UK) (ScienceBase item `671a6fa8d34efed5620f89f8`).
  - Download them **in a browser** into `pipeline/raw/lgrs/`; scripts get 403.
  - The grid design (LPS projection, LGRS, Artemis Condensed Coordinates) is in USGS Techniques and Methods 11-E1 (2025), [doi:10.3133/tm11E1](https://doi.org/10.3133/tm11E1).
  - Do **not** use the "Terrestrial Navigational Training Grids" (they are on Earth).
- **Library:** `geopandas` (already in `requirements.txt`).
- **Output:** `pipeline/out/grid_<CODE>.json`.
- **Rules:**
  - take the centre of each square;
  - get lat/lon with pyproj from the shapefile CRS (USGS suggests `IAU_2015:30100` or `ESRI:104903`);
  - `xM/yM` are in `PGDA_CRS`;
  - the label is the ACC 1 km label attribute. Write its name here: `______`.
- **Fallback** if the shapefiles cannot be read: build a 1 km grid in the LPS projection with the `lgrs` Python package (SETI/USGS, Apache-2.0; this is a new library, so the team must agree) and label cells `r<row>c<col>`.
- **Done when:**
  - all 9 files are written, with the cell count of each region added to the region table above;
  - a spot check of one cell in QuickMap is in the right place.

### D3 Feasibility

File: `compute_feasibility.py`.

- **Input:** `grid_<CODE>.json`, plus `LDSM_80S_80MPP_ADJ.TIF` (slope), `LPSR_80S_20MPP_ADJ.TIF` (permanent shadow, 20 m) and `LDEM_80S_80MPP_ADJ.TIF` (height).
- **Output:** `pipeline/out/feasibility_<CODE>.json`.
- **Rules:**
  - `slopeDeg` is the median over the 1 km square;
  - `psrFraction` is the share of PSR pixels in the square;
  - `heightM` is the DEM at the centre (bilinear);
  - the limits are in `common.py` (20°, from the NASA HLS Space Apps 2025 slope map; 0.5).
- **Done when:** all regions are done, and one region is spot-checked against the PGDA slope map.

### D4 Terrain horizon

File: `compute_horizon.py`.

- **Input:** `grid_<CODE>.json`, and the sites with lat ≤ −60° from `sites.json`.
  - Near terrain comes from `LDEM_80S_80MPP_ADJ.TIF`.
  - Far terrain, where a ray leaves 80°S, comes from `LDEM_60S_240MPP_ADJ.TIF`.
- **Output:** `horizon_<CODE>.json` and `horizon_sites.json`.
- **Method** (window-finder.md §5.4):
  - ray `k` at azimuth k°, measured clockwise from **local geographic north** (same as `bodyAzimuthElevation`). In `PGDA_CRS` map coordinates, ray k at a cell of longitude λ points along `(sin(k+λ), cos(k+λ))`, not along `+y`;
  - samples from 100 m to 150 km, with the step growing with distance;
  - `angle = atan2(h_sample − h_cell − mast − d²/(2R), d)`;
  - `horizon[k] = round(10 × max angle)`;
  - mast height = `common.MAST_HEIGHT_M` (2 m).
- **Speed:** vectorise with numpy (sample the DEM with bilinear interpolation). 225 cells should take minutes, not hours.
- **Done when:**
  - `MAL` is done first (critical path), then every region and site;
  - one plotted horizon looks right next to QuickMap or Moon Trek.

### D5 Build web data

File: `build_site_data.py`.

- **Input:** the `pipeline/out/` files and `pipeline/sites.json`.
- **Output:** `regions.json`, `cells_<CODE>.json` and `sites.json` in `web/public/data/`.
- **Rules:**
  - apply the feasibility rule;
  - leave out regions that have no grid yet, with a warning.
- **Done when:** `python pipeline/check_web_data.py` passes and every file is < 2 MB.

### D6 Famous sites

File: `pipeline/sites.json`.

- **Task:** fill `lat/lon` for the 13 entries marked `"source": "TODO"`:
  - Apollo 12, 14 and 16;
  - IM-1, IM-2, IM-3 and Blue Ghost 1;
  - Chang'e 3–6, Chandrayaan-3 and SLIM.
- **Sources:** official only (LROC/NASA or the mission's agency).
  - Add each source to `sources` in `sites.json`, `REFERENCES.md` and `DATA_SOURCES.md` §3.
  - Set `verified: true` only for measured positions from an official source. **Never guess.**
- **Terrain:** for sites with lat ≤ −60° (for example Chandrayaan-3), set `hasTerrain: true` and D4 computes their horizon.
- **Done when:** no TODO entries are left, or the ones left are explained in their `note`.

### D7 Validation

File: `validate.py`.

- **Input:**
  - PGDA 69 `AVGVISIB_85S_060M_201608*.TIF`: pixel × 4e-05 = fraction of time visible, an 18.6-year average;
  - `pipeline/out/our_visibility.json`, written by a small node script that imports `sunlight.js` and `communication.js` and runs over the whole ephemeris.
- **Output:** `validation.json`.
- **Rules:**
  - PGDA 69 covers 85–90°S only, so CAB, MMP and NR2 have no PGDA value;
  - expect the same trend, not equality (2 years against 18.6 years).
- **Done when:**
  - `validation.json` is written;
  - the comparison is shown on the About screen and in the README;
  - one QuickMap "Compute Visibility" screenshot is saved for the slides.

### D8 Map background

File: `export_map_background.py`.

- **Input:** the hillshade `LDEM_80S_80MPP_ADJ_HILL.TIF`, the PGDA 69 Sun visibility raster and `regions.json`.
- **Output:** `web/public/maps/*.png` and `maps.json`.
- **Rules:**
  - write the PNGs with rasterio (GDAL PNG driver), no new library;
  - each image is ≤ 1 MB.

## Site coordinates

`pipeline/sites.json` has 25 sites:

- **9 Artemis III regions** (`group: artemis-region`, with a region code):
  - NASA published only names and a map, so the coordinates are approximate region centres derived from the USGS data release (McClernan 2024, [doi:10.5066/P1MEQ6UK](https://doi.org/10.5066/P1MEQ6UK)), marked `"verified": false`;
  - each one is cross-checked against a second source, and they agree within 10 km except Slater Plain (see its `note`).
- **3 Apollo sites:** from NASA NSSDCA, marked `"verified": true`.
- **13 TODO sites:** for D6. Code must skip them and print a warning; `common.load_sites()` already does this.

## Team rules

- **Commits:** work on `main` in small commits. Each commit must still pass `cd web && npm run lint && npm run build`.
- **Never commit** `pipeline/raw/`, `*.tif`, `.env*` or `.vercel/` (already in `.gitignore`). `pipeline/out/` *is* committed.
- **No made-up science data.**
  - UI mock data goes only in `web/public/data/mock/`, with `"mock": true`, and the UI shows a **MOCK DATA** badge.
  - Test values in `*.test.js` are synthetic and say so.
- **Code:** JavaScript only (no TypeScript), no React Router, and no new library without asking the team.
- **Bookkeeping:**
  - a new library, data source or image gets a line in `REFERENCES.md` and `DATA_SOURCES.md`;
  - a big piece of work done with an AI tool gets a line in `AI_USAGE.md`.
- **UI text** is in English.
- **The contract is this README**, together with `web/src/core/*.test.js` and `pipeline/check_web_data.py`. Change all three together, or none.

## Deploy

Vercel, static site:

- set **Root Directory = `web`**, framework preset Vite (`npm run build`, output `dist`);
- the final link must open in a private window without login.

## Claude Code (optional)

- The repo includes a project skill (`.claude/skills/lunar-navigator`) and MCP servers (`.mcp.json`: Playwright, Context7, Firecrawl, Exa).
- Exa and Firecrawl need your own keys: set `EXA_API_KEY` / `FIRECRAWL_API_KEY` in your shell profile. Never put keys in the repo.
