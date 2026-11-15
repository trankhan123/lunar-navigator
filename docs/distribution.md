# Work split: 5 workflows + web

The team has 5 people. One person handles the web: putting every part together in the interface. The other four each pick a workflow:

- each workflow groups related D modules (Python pipeline) and C modules (JS core in the browser), so one person works from the data all the way to the computing functions;
- there are **5 workflows for 4 people**; see how to split them in [If there are only 4 people](#if-there-are-only-4-people).

The official contract (input/output, units, file formats, function signatures) still lives in [docs/technical-reference.md](technical-reference.md). This file only says **who does what, in which order, and what to hand to whom**. Every section in docs/technical-reference.md such as "C1 Sunlight" or "D4 Terrain horizon" must be read before coding.

## Choice table

| Workflow | Topic | Modules | Workload | Owner |
|---|---|---|---|---|
| [WF1](#wf1--sunlight-and-terrain) | Sunlight and terrain | C1 Sunlight, D4 Terrain horizon | heavy (~9 h) | Quoc_Bao |
| [WF2](#wf2--communication-and-validation) | Communication and validation | C2 Communication, D6 Famous sites, D7 Validation | medium (~7 h) | chubin271-blip |
| [WF3](#wf3--distance-and-optimization) | Distance and optimization | C5 Optimizer, `core/explain.js` | medium (~7 h) | vominhuy28 |
| [WF4](#wf4--energy-need-and-charging-time) | Energy need and charging time | C3 Energy need, C4 Charging, `validateScenario` | light (~5 h) | hoanggbach |
| [WF5](#wf5--map-and-coordinates) | Map and coordinates | D2 LGRS grid, D3 Feasibility, D5 Build web data, D8 Map background | medium (~8 h) | trankhan123 (Claude Code) |
| [WEB](#web--putting-the-interface-together) | Putting the interface together | W1–W7, S1 | heavy | trankhan123 |

**Already done:** C0 (geometry, hourly series) and D1 (real ephemeris in `web/public/data/ephemeris.json`, matching JPL Horizons within 0.015°). Every workflow can use these two parts right away.

**How to take a workflow:**

1. Write your name in the "Owner" column of the table above.
2. Write your name in the `Owner` column of the module table in docs/technical-reference.md for **every** module of the workflow, and set `Status` to `doing`.
3. Commit and push at once, so two people do not take the same workflow.

**"Distance" in WF3** is the distance (km) to the nearest passing cell, together with the ranking of cells and times. Path finding for the rover has been dropped (docs/window-finder.md §3.2).

## Who hands what to whom

```
            WF5 grid_MAL.json ──────────────> WF1 (D4 computes the horizon)
            WF1 horizon_MAL.json ───────────> WF5 (D5 merges)
WF1 C1 sunlight.js ──┬──> WF3 (evaluateWindow), WF4 (uses the SunTrack shape), WF2 (D7), WEB
WF2 C2 communication.js ─┼──> WF3, WEB
WF4 C4 charging.js ──────┼──> WF3, WEB (battery chart)
WF4 C3 energyNeed.js, validateScenario ──> WEB
WF5 cells_<CODE>.json, regions.json, sites.json, maps/ ──> WEB, WF3, WF2 (D7)
WF2 sites.json (D6 coordinates) ──> WF5 (D5 publishes), WF1 (horizon for sites ≤ −60°)
WF2 validation.json ──> WEB (About page)
WF3 optimizer.js, explain.js ──> WEB (results, details, learning mode)
```

| Order | Who hands over | What | Who needs it | Deadline |
|---|---|---|---|---|
| 1 | WF1 | `sunlight.js` passing its tests | WF3, WF4, WF2, WEB | **as early as possible** (first few hours) |
| 1 | WF2 | `communication.js` passing its tests | WF3, WEB | first few hours |
| 1 | WF4 | `charging.js` passing its tests | WF3, WEB | first few hours |
| 2 | WF5 | `pipeline/out/grid_MAL.json` | WF1 | as soon as the LGRS shapefile is available |
| 3 | WF1 | `pipeline/out/horizon_MAL.json` | WF5 | afternoon of day 1 |
| 4 | WF5 | `cells_MAL.json`, `regions.json`, `sites.json` | WEB, WF3, WF2 | evening of day 1 → **milestone M1** |
| 4 | WF3 | `optimizer.js` passing its tests, Worker running on mock | WEB | evening of day 1 |
| 5 | WF5 + WF1 | all 9 regions | WEB | morning of day 2 |
| 5 | WF2 | `sites.json` with all coordinates, `validation.json` | WEB | morning of day 2 |

**Shared milestones:**

- **M1 (end of day 1):** the full flow runs for the Malapert (MAL) region with real data: map → form → results → details.
- **M2 (morning of day 2):** all 9 regions, famous sites, PGDA 69 validation.
- **M3 (noon of day 2):** feature freeze, deploy to Vercel, record the video.

## WF1 — Sunlight and terrain

**Goal:** know when each cell has sunlight and how much the solar panel receives. This needs two parts: the 360° terrain horizon (D4) and the hourly Sun track (C1).

**Your files:** `web/src/core/sunlight.js`, `pipeline/compute_horizon.py`, `pipeline/out/horizon_*.json`.

**Steps:**

1. **C1 first**, because three other workflows wait for it. It needs no real data: the tests are ready, and you can try it on the real `ephemeris.json` with `mock/cells_MAL.json`.
   - `resolvePanelType`, `panelFactor`;
   - `computeSunTrack`: each hour call `bodyAzimuthElevation` (C0) with `sunSubLonDeg/sunSubLatDeg/sunDistanceAu × AU_KM`, then `horizonElevationAt` and `visibleDiskFraction` with `SUN_DISK_RADIUS_DEG`. `powerFactor = (1/D)² × diskFraction × panelFactor`;
   - `summarizeSunWindow` and `nextSunEvent`: use `longestRunBelow`, `fractionAtLeast`, `meanWhereAtLeast`, `firstIndexBelow`, `nextCrossing` from `timeSeries.js`;
   - run `cd web && node --test src/core/sunlight.test.js`, then push.
2. **D4 on the points that already have coordinates**, before the grid exists: the function `compute_horizon(lat, lon, near_dem, far_dem)` runs on the 9 region centers in `pipeline/sites.json`.
   - Plot the horizon at the Malapert center and compare it by eye with QuickMap or Moon Trek.
   - Write `pipeline/out/horizon_sites.json` for sites with lat ≤ −60°.
3. **D4 for the grid:** when WF5 pushes `grid_MAL.json`, run `--region MAL` to write `horizon_MAL.json`, push it, then do all 9 regions.

**Data notes** (checked 14/11):

- **Shared CRS:** `common.PGDA_CRS`, nodata is `nan`, heights are in meters relative to a sphere of 1737.4 km.
- **`LDEM_80S_80MPP_ADJ.TIF`:** 7600×7600, 80 m/px, covers ±304 km around the pole.
- **`LDEM_60S_240MPP_ADJ.TIF`:** 7760×7760, 240 m/px, covers ±931 km. Use it for the part of the rays that goes outside the ±304 km square. Peak near Cabeus B is 196 km from the pole, so its 150 km rays surely go outside.
- **Formula** (docs/technical-reference.md D4): `angle = atan2(h_sample − h_cell − 2 m − d²/(2R), d)`, write `round(10 × degrees)`.
- **Speed:** 225 cells × 360 rays × a few hundred samples. Vectorize with numpy, use bilinear interpolation, and do not loop over samples in Python.

**Done when:** `sunlight.test.js` passes; `horizon_<CODE>.json` exists for the 9 regions and `horizon_sites.json` exists; one horizon has been checked by eye.

## WF2 — Communication and validation

**Goal:**

- know when the Earth is visible for direct-to-Earth communication (C2);
- fill in the coordinates of the famous sites (D6);
- prove the results are right using NASA sources (D7).

**Your files:** `web/src/core/communication.js`, `pipeline/sites.json` (only the TODO sites and the `sources` entry), `pipeline/validate.py`, `pipeline/visibility_stats.mjs` (new), `web/public/data/validation.json`.

**Steps:**

1. **C2:** do it like C1 but with `earthSubLonDeg/earthSubLatDeg/earthDistanceKm` and `EARTH_DISK_RADIUS_DEG`.
   - Always compute from the cell position, because parallax is up to 0.26°.
   - `summarizeEarthWindow` and `nextEarthEvent` (`'earthset'|'earthrise'`).
   - Run `node --test src/core/communication.test.js`, then push.
2. **D6:** fill in `lat/lon` for the 13 sites with `"source": "TODO"` (Apollo 12/14/16, IM-1/2/3, Blue Ghost 1, Chang'e 3–6, Chandrayaan-3, SLIM).
   - Take values only from official sources (LROC, NASA, CNSA, ISRO, JAXA).
   - Add each source to `sources`, `REFERENCES.md` and `DATA_SOURCES.md` §3.
   - **Do not guess.** A site with lat ≤ −60° (for example Chandrayaan-3) gets `hasTerrain: true`, and you tell WF1 to compute its horizon.
3. **D7, when WF5 has `cells_MAL.json`:**
   - write `pipeline/visibility_stats.mjs` (node, imports `web/src/core/sunlight.js` and `communication.js`): compute `sunFraction` and `earthFraction` of the cells over the whole ephemeris, and write `pipeline/out/our_visibility.json`;
   - `validate.py`: read the PGDA 69 pixels at those cells (value × 4e-05 = fraction of time; it only covers 85–90°S, so CAB, MMP, NR2 are missing), then write `validation.json` as defined in docs/technical-reference.md;
   - the `horizons` entry comes from the fixture: 30 points, differences 0.015° / 0.010°;
   - take one QuickMap "Compute Visibility" screenshot for the slides.

**Related to the new criterion** (docs/window-finder.md, sort order number 5, "most continuous communication"): measured by a smaller `longestCommLossHours`. WF3 uses it to break ties when all earlier criteria are equal.

**Done when:** `communication.test.js` passes; no TODO sites remain (or any remaining site has a `note` explaining why); `validation.json` exists; the About page has numbers for WEB to show.

## WF3 — Distance and optimization

**Goal:** this is the "Window Finder" core.

- Slide a `stayDays`-day window over every feasible cell and every landing time (6-hour step), and rate each as pass / close to the limit / fail.
- Rank, and find the nearest passing time and the nearest passing cell (km).
- Write the sentence that explains why moving a few km gives different results.

**Your files:** `web/src/core/optimizer.js`, `web/src/core/explain.js` (the logic part of W5/W7; WEB only builds the components).

**Steps:**

1. **The part that does not need C1/C2/C4:** `metricsAt`, `rankCells`, `rankBestWindows`, `summarizeCurrentPoint`, `selectSearchCells` (uses `distanceKm` from C0). The tests are ready in `optimizer.test.js`.
   - **Default order:** passing or close-to-limit first → higher `minBatteryFraction` → higher `fractionBoth` → smaller `distanceKm` → smaller `longestCommLossHours` (most continuous communication).
   - Do not use a weighted score.
2. **`evaluateWindow` and `runWindowSearch`,** once WF1/WF2/WF4 have pushed C1/C2/C4: for each cell compute the two tracks once, slide the window, then throw the tracks away.
   - Try it in the browser with `startWindowSearch` (the Worker is already written) and `mock/cells_MAL.json`.
   - Speed goal: scope `region` in under 3 seconds.
3. **`explain.js`:**
   - `compassName`;
   - `explainDifference`: find the hours when the current cell is dark but the other cell is sunlit, compare the two cells' horizons at the Sun's azimuth at that time, then write an English sentence;
   - `findMostDifferentNeighbors`;
   - add tests for the last two functions to `explain.test.js`.

**Done when:** `optimizer.test.js` and `explain.test.js` pass; the Worker runs on the MAL mock in under 3 seconds; WEB receives real `WindowResults` data.

## WF4 — Energy need and charging time

**Goal:** turn sunlight into electricity.

- Does the lander survive the window, how low does the battery get, and how long does it take to recharge fully (C4).
- How much minimum battery is needed to survive the window (C3).
- Check the form where the mission limits are entered.

**Your files:** `web/src/core/charging.js`, `web/src/core/energyNeed.js`, `validateScenario` and `LANDER_PRESETS` in `web/src/core/scenario.js`.

**Steps:**

1. **C4 first**, because WF3 needs it:
   - `simulateBattery`: battery full at landing; each hour `clamp(battery + panelMaxW × powerFactor − loadW, 0, capacity)`; compute `deadAtHour`, `rechargeHours`, `chargingMask`;
   - `findFullChargeWindows`: the battery level at each sunset;
   - run `node --test src/core/charging.test.js`, then push.
2. **C3:**
   - `findDarkPeriods`;
   - `summarizeEnergyNeed`: `minimumCapacityWh` is the largest cumulative deficit, formula in docs/technical-reference.md C3.
3. **`validateScenario`:** the rules are in the Scenario table of docs/technical-reference.md; each field gets at most one error, written in English.
   - `LANDER_PRESETS` are only illustrative examples, not real lander specifications. To add a preset, mark it clearly as "illustrative".
4. **If there is time left:** check the C3/C4 results against a hand calculation on 2–3 mock cells, and note it in docs/technical-reference.md C3.

**No need to wait for anyone:** it only uses the `SunTrack` shape (`powerFactor`, `diskFraction`), and the tests come with fake data.

**Done when:** `charging.test.js`, `energyNeed.test.js` and `scenario.test.js` pass.

## WF5 — Map and coordinates

**Goal:** build the 1 km cell grid in the USGS LGRS standard for the 9 Artemis III regions, then mark the feasible cells (slope, permanently shadowed regions). After that, merge everything into files the web can read, and make the map background images.

**Your files:** `pipeline/build_grid.py`, `compute_feasibility.py`, `build_site_data.py`, `export_map_background.py`, `pipeline/out/grid_*.json`, `feasibility_*.json`, `web/public/data/regions.json`, `cells_*.json`, `sites.json`, `web/public/maps/`.

**Steps:**

1. **Download the shapefile** with a **browser** (scripts get blocked with 403) from https://www.sciencebase.gov/catalog/item/671a6fa8d34efed5620f89f8 (McClernan 2024, doi:10.5066/P1MEQ6UK), and save it in `pipeline/raw/lgrs/`. Grid design and ACC labels: USGS T&M 11-E1 (doi:10.3133/tm11E1).
2. **D2 `build_grid.py`** (geopandas is already in `requirements.txt`):
   - take the center of each 1 km cell, convert to lat/lon and to `xM/yM` using `PGDA_CRS`;
   - take the label from the ACC attribute; write the attribute name in the README D2;
   - **do `MAL` first and push `grid_MAL.json` for WF1 at once**, then do all 9 regions;
   - write the cell count of each region in the region table in the README.
3. **D3 `compute_feasibility.py`:**
   - `slopeDeg` is the median slope in the cell;
   - `psrFraction` is the fraction of permanently shadowed pixels;
   - `heightM` is the height at the center.
4. **D5 `build_site_data.py`:** merge grid + feasibility + horizon (from WF1) + `pipeline/sites.json`, then run `python pipeline/check_web_data.py`. Finishing `MAL` reaches **milestone M1**.
5. **D8 `export_map_background.py`:** hillshade → PNG ≤ 1 MB for the whole pole and for each region, with `maps.json`; also add a PGDA 69 sunlight % overlay if there is time.

**Data notes** (checked 14/11):

- **`LDSM_80S_80MPP_ADJ.TIF`:** slope in degrees, float32, 7600×7600, 80 m/px.
- **`LPSR_80S_20MPP_ADJ.TIF`:** values 0/1, float32, **30400×30400**. The whole file is about 3.7 GB in RAM, so **read it by window** (`rasterio.windows`) around each cell, never the whole file.
- **Axis direction:** in `PGDA_CRS`, `+x` points toward longitude 90°E and `+y` points toward the 0° meridian.
- **Large region:** Mons Mouton Plateau is about ±58 km wide and may have more than 2,000 cells. If `cells_MMP.json` goes over 2 MB, tell the team before changing the format.

**Done when:** `check_web_data.py` passes on `web/public/data` for the 9 regions; `maps.json` exists; the cell count of each region is written in the README.

## WEB — Putting the interface together

**Owner:** trankhan123. This part builds every component and connects the workflows to the interface. The pure-logic parts were given to other workflows:

- `explain.js` belongs to WF3;
- `validateScenario` belongs to WF4.

**Modules:** W1 app skeleton + share link, W2 map + popup, W3 form, W4 results, W5 details, W6 globe, W7 learning mode, S1 submission. Props are detailed in the README.

**Suggested order:**

1. W1 app skeleton on mock: the screens, the MOCK DATA label, the data-source footer.
2. W3 form.
3. W2 map, reading `mock/cells_MAL.json`.
4. W4 results: connect `startWindowSearch` when WF3 pushes.
5. W5 details: horizon view, countdown, battery chart. Needs C1, C2, C4.
6. W7, then W6 (drop it first if we run late).
7. Deploy, then S1.

**Connection points:** each time a workflow finishes a push, switch the matching part from mock to real. Real data turns on by itself when `web/public/data/regions.json` exists (README W1).

## Rules for every workflow

- **Before coding:** read your module section in the README. Functions, JSON fields, units and file names are already fixed.
- **Only edit files in your "Your files" section.** If the contract must change, ask the team first, then change the README, the tests and `pipeline/check_web_data.py` at the same time.
- **Small commits, push early:** `git pull --rebase` before pushing. Every commit must pass `cd web && npm run lint && npm run build`.
- **Your own tests:**
  - JS: `cd web && node --test src/core/<file>.test.js`;
  - data: `python pipeline/check_web_data.py`.
- **Data:** do not invent scientific data. Do not commit `pipeline/raw/` and `*.tif`. Write new sources in `REFERENCES.md` and `DATA_SOURCES.md`; write big pieces of work done with AI in `AI_USAGE.md`.
- **Using Claude Code:**
  - open Claude Code in the repo, and the project skill loads by itself;
  - type an example like "Implement WF4 following distribution.md";
  - Claude will read the README and CLAUDE.md and follow the contract.

## If there are only 4 people

There are 5 workflows but only 4 people, so **split WF2** among three people:

- **C2** goes to the person doing **WF4**: C2 works like C1 and is light; WF4 plus C2 is still about 6–7 h.
- **D6** goes to the person doing **WF5**: filling in site coordinates fits with the map work.
- **D7** goes to whoever finishes earliest. D7 belongs to milestone M2 (morning of day 2), so it is not on the critical path.

After the split, write down who took C2, D6 and D7 in the choice table above.
