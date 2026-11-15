# Extra prospect: extra modules to build after the team finished the main version

Status after the NASA Space Apps Challenge 2026 weekend: E1–E8 were built and merged; E9 and E10 were not done.

Updated 15/11/2026 14:45. Written on `main` at commit `675ff1e`. Goal: merge before **22:30**, because the submission portal closes at 23:59 and the judges will open the web link.

## 0. General rules for every module

- **Branch and PR:** one branch `extra/<code>` and one separate PR per module, so a broken module can be dropped without dragging others down. Start from the latest `main`.
- **Before merging,** run in `web/`:
  ```bash
  node --test src/core/*.test.js
  npm run lint
  npm run build
  ```
  If the change touches data, also run `python pipeline/check_web_data.py` from the repo root.
- **Open the Vercel preview of the PR** and walk through two flows: (a) Apollo 11; (b) cell `MAL-BASCS`, dates 2028-01-01 → 2028-06-30, stay 6 days, click Find, open the detail view.
- **UI text:** add keys to `web/src/i18n/translations.js`. The `en` block is required; `vi` is recommended. A language missing a key falls back to English.
- **Data contract:** if you change a data file or a function signature, update three places at once: README, `*.test.js`, `check_web_data.py`.
- **Touch `App.jsx` as little as possible:** this file has had many conflicts.
- **Bookkeeping:** each module adds one line to `AI_USAGE.md`; new data or sources go into `REFERENCES.md` and `DATA_SOURCES.md`.
- **Stop time:** at 22:30 nothing more is merged.

## 1. Suggested order

| Order | Code | Module | Type | Estimate | Risk | New data needed? |
|---|---|---|---|---|---|---|
| 1 | E1 | Small-bug sweep | Fix a weakness | 30 min | Very low | No |
| 2 | E2 | Put the NASA validation up front | Use a strength | 1–1.5 h | Low | No (`validation.json`) |
| 3 | E3 | "Also search around this point" button | Fix a weakness | 1–1.5 h | Low | No |
| 4 | E4 | Real lander presets | Fix a weakness | 1 h | Low | Published figures |
| 5 | E5 | "If the launch slips" headline sentence | Use a strength | 1 h | Low | No |
| 6 | E6 | Mission Replay (IM-1, IM-2, Chandrayaan-3) | Galactic Impact, validation | 3–4 h | Medium | Horizons, 3 short windows |
| 7 | E7 | Distance to cold trap (PSR) | Best Use of Data, science | 3–4 h | Medium (contract change) | No (PGDA 90 LPSR) |
| 8 | E8 | Extend the 2 km cap cells to 80°S | Coverage | 1 h code + machine time | Medium | No (80 m DEM down to 80°S) |
| 9 | E9 | Original Artemis regions at 1 km (Peak near Shackleton…) | Resolution | 2–3 h + machine time | Medium | Older LGRS zip |
| 10 | E10 | Official LGRS grid layer, ACC coordinates | Credibility | 2 h | Low | Global LGRS shapefile |

**Suggestions:**
- One person does E1 → E5 in sequence (about 5 hours, almost no risk).
- If a second person is available, they take E6 or E7 in parallel.
- Do E8 and E9 only if the machine already has `pipeline/raw/` and a timed trial run shows the computation will finish in time.

---

## E1. Small-bug sweep (30 minutes)

**Tasks:**
1. `web/index.html`: change `og:image` to the full URL `https://lunar-navigator-six.vercel.app/og-image.png`, and add `og:url`. The preview image shown when a link is pasted only appears with a full URL.
2. `results.summary` ("{count} cells × …"): when `count === 1`, say "1 cell". Use a separate key `results.summaryOne`, or pick the key by number inside the component.
3. Legend "1 square = 1 km": when the map is showing 2 km cells (CAP) or the current point is a `CAP-` cell, add "· cap cells: 2 km".
4. The MMO region label is covered by the NR1 label and "IM-2 Athena": offset the MMO label or hide site labels at the whole-pole zoom level. See `MapMarks.jsx`.

**Done when:** the build passes, and all four items are correct on the preview.

---

## E2. Put the NASA validation up front (1–1.5 h)

**Why:** this is the team's strongest point. Against PGDA 69 over 240 cells: r = 0.983 (sun) and 0.986 (Earth), mean error 1.9 and 3.6 percentage points. Against Horizons the maximum error is 0.015°. Right now these numbers appear only at the bottom of the About page.

**Tasks:**
1. **New pure function** `validationSummary(validation)` in `web/src/core/validationStats.js`. It returns `{sunR, earthR, sunMae, earthMae, cellCount, horizonsMaxDeg}`. Take the values from `pgda69Stats` if present; otherwise compute them from the `pgda69` array. Write a test for it using synthetic data.
2. **Component `ValidationBadge.jsx`:** a small chip "✓ Validated vs NASA PGDA 69 (r = 0.98) and JPL Horizons (0.015°)". Clicking it switches to the About screen.
   - Place it at the top of the Results screen and the Cell detail screen.
   - It only needs one new prop `onOpenAbout` from `App.jsx`.
3. **Component `ValidationScatter.jsx`** (ECharts, lazy-loaded like the seasonal calendar):
   - 240 points, x axis is PGDA 69, y axis is the team's value, with a y = x line;
   - two tabs, Sun and Earth.
   - Place it in `AboutView.jsx`, above the existing table.
4. **i18n:** add keys `validation.badge`, `validation.scatterTitle`, `validation.axisNasa`, `validation.axisOurs`.

**Done when:** the `validationStats` test passes; the chip shows on Results and Detail; the scatter plot draws all 240 points.

---

## E3. "Also search around this point" button (1–1.5 h)

**Why:** Simple mode only searches inside the 9 square regions, so users think nothing outside the regions is feasible. A Node test shows that from `MAL-BASCS` with a 30 km radius, 500 cells of 2 km are searched, and 337 of them passed at some point.

**Tasks:**
1. **On the Results screen,** when `scenario.searchScope === 'region'`, add a button "Also search 15 km around this point (includes 2 km cap cells)".
   - Clicking it calls `runSearch({...scenario, searchScope: 'radius', searchRadiusKm: 15})` again.
   - No contract change: the `radius` scope already exists, and `MAX_SEARCH_RADIUS_KM = 50`.
2. **Explanation line under the map** (Map and Results): "Cells outside the 9 regions (2 km cap grid) are searched when you pick one as your point, or with 'Search around this point'."
3. **Pure function** `suggestWiderSearch(scenario, results)` in `core/` (optional): returns `true` when the scope is a region and the pass rate is low, to highlight the button. Includes a test.

**Done when:** from `MAL-BASCS`, clicking the button produces `CAP-` cells in the ranking table and on the map.

---

## E4. Real lander presets (1 h)

**Why:** with only "Example lander", the battery figures look arbitrary. `docs/window-finder.md` has no lander figures: every "published" number must be checked against the sources below, and a number not found in a source is labelled as an estimate.

**Tasks:**
1. **`web/src/core/scenario.js`, `LANDER_PRESETS`:** add the presets below. Each entry has `source`, `sourceUrl`, and a `published` or `estimate` flag for each number.

   | id | Solar panel | Battery | Consumption | Stay |
   |---|---|---|---|---|
   | `viper` | 450 W (published) | 5,420 Wh (published) | ~110 W (estimate = 5,420 Wh ÷ 50 h power-saving mode) | 30 days, because `MAX_STAY_DAYS` = 30; note "mission planned 100 days" |
   | `nova-c` | 200 W (published) | ~700 Wh (25 Ah × 28 V, estimate) | ~50 W (estimate) | 14 days |
   | `blue-ghost-1` | 400 W (published) | ~1,400 Wh (estimate) | ~100 W (estimate) | 14 days |
   | `vikram` | 738 W (published) | ~2,600 Wh (estimate) | ~185 W (estimate) | 14 days |

   Sources:
   - VIPER: [NTRS 20240013903](https://ntrs.nasa.gov/api/citations/20240013903/downloads/LSIC_2024-Tech%20Infusion_Panel-VIPER_Mob-HW.pdf)
   - Nova-C: [Wikipedia](https://en.wikipedia.org/wiki/Intuitive_Machines_Nova-C)
   - Blue Ghost: [Firefly](https://fireflyspace.com/missions/blue-ghost-mission-1/)
   - Vikram: [ISRO brochure](https://www.isro.gov.in/NSPD2024/assets/pdf/CH3%20Landing%20Brochure-Pagewise.pdf)
2. **`ScenarioForm.jsx`:**
   - add `stayDays` to `PRESET_FIELDS` (or fill it only when the user has not edited it by hand);
   - under the preset selector, show one source line with a link and a "published / estimated" label.
3. **`scenario.test.js`:** every preset passes `validateScenario`.
4. **State it clearly in the UI:** "Approximate values from public documents, for comparing scenarios."

**Done when:** choosing VIPER fills the form automatically and Find runs; the test passes.

---

## E5. "If the launch slips" headline sentence (1 h)

**Why:** "Can slip" is a unique feature, but right now it is buried in a table.

**Tasks:**
1. **Pure function** `slipSentence(results, landingIndex, windows)` in `core/format.js`, or a new file `core/slip.js`. It returns:
   - if the current point passes: "Your landing can slip up to **X** and still meet every limit (until …)";
   - if it does not pass: "Next window at your point: … (in **Y**). Nearest cell that works now: … (**Z km**)."
   - Use existing data: `rankBestWindows` and `summarizeCurrentPoint`.
   - Write tests for both branches.
2. **Show this sentence in large text** at the top of `CurrentPointCard.jsx`.

**Done when:** the test passes; the `MAL-BASCS` flow shows a sentence that matches the tables below it.

---

## E6. Mission Replay (3–4 h)

**Why:** it shows that the app's predictions match real missions. The horizons for `im-1`, `im-2` and `chandrayaan-3` **already exist** in `web/public/data/sites.json`.

**Tasks:**
1. **Pipeline:** add `--start/--stop/--out` options to `pipeline/fetch_horizons.py` (or write a small script `fetch_replay.py` that reuses D1's functions). Fetch 3 windows, each about 3 weeks around the landing date, and write them to `web/public/data/replay/<siteId>.json`, in the same format as `ephemeris.json`.
2. **`web/public/data/replay/index.json`:** for each mission record `{siteId, name, landedUtc, endedUtc, endedReason, sourceUrls}`.
   - **Dates and times must come from official sources** (NASA, ISRO, Intuitive Machines) with links.
   - Reference dates to double-check: Chandrayaan-3 landed 23/8/2023 12:33 UTC; IM-1 Odysseus landed 22/2/2024; IM-2 Athena landed 6/3/2025.
3. **Pure function `core/replay.js`:** `replaySummary(site, replayEphemeris, mission)` → `{predictedSunsetUtc, predictedEarthsetUtc, hoursFromLandingToSunset, endedUtc, differenceHours}`. Use `computeSunTrack`, `computeEarthTrack`, `nextSunEvent`. Write a test with synthetic ephemeris.
4. **UI:** a "Real missions replayed" card in Learn (or on About), one line per mission containing:
   - the predicted sunset time at the site;
   - the actual time the mission ended, with the reason (for example IM-1 lying on its side, IM-2 tipped over inside a cold crater);
   - the difference in hours.
   - Each line has a button that opens the site's detail screen with the real landing date.
5. **`check_web_data.py`:** check the `replay/` folder when it exists.

**Risk:** a lander lying on its side or tipped over loses power earlier than the predicted geometry. So compare only the **sunset time at the site**, and show the real-world reason next to the result. Never write "exact" if the numbers do not match.

**Done when:** three lines have numbers; sources have links; the test passes.

---

## E7. Distance to cold trap (PSR) (3–4 h)

**Why:** the challenge asks to balance the needs of "both science and engineering teams". Right now the app serves only the engineering side.

**Tasks:**
1. **Pipeline:** new script `pipeline/compute_science_access.py`.
   - Read `LPSR_80S_20MPP_ADJ.TIF` (already used in D3). Downsample to about 100 m, then use `rasterio.features.shapes` to build polygons.
   - Keep PSRs of 1 km² or larger (matching the table of 1,531 PSRs in PGDA 90).
   - For each cell (regions and CAP), compute `psrDistanceKm` to the nearest PSR with `shapely.STRtree`. shapely ships with geopandas, so no new library is added.
2. **Contract change:**
   - add field `psrDistanceKm` (number | null) to cells in `cells_*.json` and `cap/*.json`;
   - D5 and `build_cap_grid.py` merge this field in;
   - update README, `check_web_data.py`, and `make_mock_data.py` (mock data).
3. **Core:** `runWindowSearch` copies each cell's `psrDistanceKm` into the results as `distanceKm`; `rankCells` allows `sortBy: 'psrDistanceKm'` (smaller is better). Update the tests.
4. **UI:**
   - a "To cold trap (km)" column in the ranking table (Expert mode);
   - a matching row in the cell popup;
   - a map layer "Distance to permanent shadow".
5. **Learn:** one sentence explaining why PSRs matter (cold traps, where water ice may exist).

**Done when:** the checker passes; sorting by the new column works; the popup shows the number.

---

## E8. Extend the 2 km cap cells to 80°S

**Why:** the 80–85°S ring (around IM-1, CAB, NR2, MMP) has no cells yet. Hand-typed coordinates there currently use the spherical horizon, which is badly wrong.

**Tasks:**
1. Add a `--south-of -80` parameter to `build_cap_grid.py`; the outer ring beyond 85°S can use 4 km cells to reduce the cell count.
2. **Run a timed trial first:** `python pipeline/build_cap_grid.py --limit 200`. Estimate the time for the new ring's cell count (about 3 times the current cap at 2 km cells). If it exceeds 2 hours, drop it.
3. **Check `MapCapLayer.jsx`:** the README says this layer is drawn as a 152 × 152 px raster, computed for a radius of 85°S. It must change so the size is computed from `index.json`.
4. Run `check_web_data.py`, check that each tile is under 2 MB, and check a search around IM-1 (80.13°S).

**Done when:** typing the IM-1 coordinates shows the line "Terrain from the 2 km cap grid"; the map covers down to 80°S.

---

## E9. Original Artemis regions at 1 km (Peak near Shackleton, Connecting Ridge…)

**Why:** these are the famous points that are sunlit almost all year, which makes them ideal for the demo. Right now they only have the 2 km cap cells.

**Tasks:**
1. **Download with a browser** the 1 km grid zip from the older USGS release for 13 regions: ScienceBase item `67168797d34ebf903f48b6fc`, doi:10.5066/P13FD9ZD. This release has Peak_Near_Shackleton, Connecting_Ridge, Connecting_Ridge_Extension, Faustini_Rim_A, Leibnitz_Beta_Plateau, Amundsen_Rim, de_Gerlache-Kocher_Massif…
2. Add the new region codes to `pipeline/common.py`, then run D2 → D3 → D4 → D5 for those regions.
3. **Re-run `build_cap_grid.py`** so the 2 km cap excludes the new regions' extent; otherwise cells would overlap.
4. **`regions.json`:** mark `"artemis2024": false` and the label "original 2022 candidate", so they are not confused with the 9 current official regions.

**Done when:** choosing Peak near Shackleton gives 1 km cells and search results.

---

## E10. Official LGRS grid layer and ACC coordinates (optional)

**Why:** showing the exact coordinate system the Artemis astronauts will navigate with adds credibility.

**Tasks:**
1. Download the LGRS 25 km cell shapefiles for the south polar area (doi:10.5066/P13YPWQD), then export a small GeoJSON containing the grid lines and 25 km cell labels.
2. Add a map layer "LGRS 25 km grid".
3. The cell popup shows the 25 km cell label and the 1 km ACC label. The ACC label is already available in `cell.label`.

---

## 2. Can the earlier LGRS data be used?

| Dataset | In use? | What more can it give |
|---|---|---|
| **Terrestrial Navigational Training Grids** (ScienceBase `6751db29…`) | No | **Not usable:** training grids on Earth (UTM, WGS84) |
| **9 "Down Selected" regions** (`671a6fa8…`, doi:10.5066/P1MEQ6UK) | Yes, 1 km grid (D2) | The zip also has 100 m and 10 m grids. They could show the 100 m ACC label of a clicked point (E10), or let us look inside a 1 km cell (not recommended today because horizons would have to be recomputed) |
| **13 original regions and Apollo 11–17** (`67168797…`, doi:10.5066/P13FD9ZD) | No | **Useful for E9:** the original polar regions run through the pipeline unchanged. The Apollo grids have no value yet, because the PGDA 90 DEM only reaches 60°S, so Apollo cells have no terrain horizon |
| **Global LGRS, LTM/LPS projection** (doi:10.5066/P13YPWQD) | No | The official grid layer and 25 km cell labels (E10) |

**Conclusion:** LGRS only provides **cell positions and labels**, not illumination data. The added value lies in E9 (more polar regions at 1 km) and E10 (the official coordinate system); both need a pipeline run with the DEM. To increase the coverage of illumination data, E8 is more effective, because it does not need LGRS.

## 3. Not doing today

- **Globe with high-resolution tiles (Moon Trek WMTS):** `globe.gl` assumes Mercator-projected tile images by default, which does not cover the polar areas; CORS risk.
- **Horizons for equatorial sites using SLDEM2015:** needs a new DEM download and reading a different projection.
- **100 m detail inside a cell:** hard to validate.
- **Moon Base Network (combining sunlight across several cells):** left for after the NASA Space Apps Challenge.

## 4. Raw data for E6–E10 (checked at 18:45 on 15/11)

`pipeline/raw/` was re-downloaded with `pipeline/download_data.py` after the incident on the morning of 15/11. All 8 files from table 1 of `DATA_SOURCES.md` are present. The folder `pipeline/raw/lgrs/` (hand-downloaded LGRS zips) and the cache `pipeline/raw/horizons/` are gone.

| Module | Needs | Status | Who |
|---|---|---|---|
| E6 | JPL Horizons API, 3 short windows | The script calls the API itself, a fresh cache goes into `pipeline/raw/horizons/` | Automatic |
| E7 | `LPSR_80S_20MPP_ADJ.TIF` | Available | Automatic |
| E8 | `LDEM_80S_80MPP_ADJ`, `LDEM_60S_240MPP_ADJ`, `LDSM_80S_80MPP_ADJ`, `LPSR_80S_20MPP_ADJ` | Available. Only the run time still needs to be measured | Automatic |
| E9 | 1 km grid zip of the original regions: ScienceBase `67168797d34ebf903f48b6fc`, doi:10.5066/P13FD9ZD | **Not present.** ScienceBase blocks scripts, so it must be downloaded with a browser into `pipeline/raw/lgrs/` | **A team member downloads it by hand** |
| E10 | LGRS 25 km south-pole grid shapefile, doi:10.5066/P13YPWQD | **Not present.** Download with a browser into `pipeline/raw/lgrs_global/` | **A team member downloads it by hand** |

- The 1 km zip of the 9 current regions (doi:10.5066/P1MEQ6UK) is also gone. It does not need to be downloaded again, because `pipeline/out/grid_<CODE>.json` is committed; it is only needed when re-running D2 for the 9 regions.
- E9 re-runs D2 → D5 for the new regions and re-runs `build_cap_grid.py`, so it also needs the DEMs listed in the E8 row.
