# Lunar Landing Site Navigator: the "Window Finder" idea

NASA Space Apps Challenge 2026, Challenge 10 (CLPS). Design document for the team, updated 14/11/2026.

## 1. One-sentence pitch

The user enters the planned landing spot and the mission's limits. The tool finds the best landing sites and times in the same region. Then the user drags a time slider and watches the ranking change with the landing date.

English line for the slides: *"Tell us your landing spot and your mission's limits. We find the best nearby sites and dates, ranked hour by hour."*

## 2. Why we build it this way (following the Background of the challenge)

- The challenge says it plainly: mission schedules often slip. So engineers must quickly check "another site in the same region" or "another date at the same site". Window Finder answers exactly these two questions.
- Near the south pole, moving a few km or a few days changes sunlight and communication a lot.
- Quickmap, Moon Trek and Horizons are all strong, but they are hard to use for comparing many scenarios quickly.
- What makes us different from other teams: we do not only report the % of sunlit time. We turn it into "does the battery survive the whole mission?", and we search backwards from the requirements instead of making the user try site after site.

## 3. User flow

### 3.1 Map for picking a point

- A 2D map of the south polar region (stereographic projection) shows the 9 Artemis III candidate regions. Each region is split into 1 km cells using the USGS LGRS grid.
- Only cells that are feasible for landing are colored (see 5.3): not too steep, not inside a permanently shadowed region. Infeasible cells stay gray.
- There are also pins for famous sites (see 5.5).
- Clicking a cell opens a popup with:
  - cell ID, longitude, latitude, height, slope.
  - Sun and Earth at the time being viewed: elevation, and how long until they set.
  - A "Copy ID" button and a "Use as current point" button (fills the ID into the form).

### 3.2 Scenario form

| Field | Example | Note |
|---|---|---|
| Current landing point | Cell ID `MAL-…` or lon/lat | Also accepts any coordinates (the challenge requires this) |
| Planned date range | 01/01/2028 – 30/06/2028 | At most 6 months per run |
| Days on the surface | 6 | NASA's region selection criteria use about 5.75–6.25 days |
| Maximum continuous darkness | 24 hours | "Dark" means less than 50% of the Sun's disk is visible |
| Maximum communication loss | 12 hours | "Lost" means less than 50% of the Earth's disk is visible |
| Maximum solar panel power | 1,000 W | At 1 AU, full disk visible, sunlight hitting at a right angle |
| Battery capacity | 10 kWh | Assumed full at landing |
| Power consumption | 300 W | Average, constant over the hours |
| Panel type | Automatic | Vertical (good near the poles) or horizontal (good near the equator) |
| Search scope | Same region | Same region, radius R km, or all 9 regions |

The numbers in the "Example" column are only for illustration. They are not the real specifications of any lander. The interface must say this clearly.

There are two modes: **Simple** uses a ready-made preset and only asks for the point, the dates and the days on the surface. **Expert** opens all fields.

There is no "slope the rover can climb" field. That field is only needed for rover path finding, and that feature has been dropped.

### 3.3 Results after pressing Submit

1. **Landing-time slider** (6-hour step) with a Play button.
   - The map colors each cell by its result at the selected time: green means it passes, yellow means it passes but is close to the limit (lowest battery below 20%), red means it fails.
   - The top 10 ranking table for that time updates as soon as the user drags.
2. **"Your current point" card**: whether it passes and why; the nearest time it passes; how many km away the nearest passing cell is.
3. **Timeline of the current point**: each landing time in the date range is colored green or red (a one-row ECharts heatmap).
4. **Top 10 best (cell, time) pairs** over the whole date range.

The ranking table has these columns: rank, cell ID, distance to the current point (km), lowest battery (%), longest darkness (hours), longest communication loss (hours), % sunlit, % Earth visible, mean Sun elevation, hours to recharge fully, status.

Default order:

1. Passing cells come before failing cells.
2. Higher lowest battery comes first.
3. Higher % of time with both Sun and Earth visible comes first.
4. Closer to the current point comes first.
5. Most continuous communication comes first.

Clicking a column header changes the sort. We do not use a weighted total score, so the user always understands why one cell ranks above another.

### 3.4 Detail screen (click a row in the table)

- **2D horizon view**: the horizontal axis is azimuth 0–360°, the vertical axis is elevation. It draws the terrain silhouette (the 360° horizon) with the paths of the Sun and the Earth over the whole mission, and a time cursor the user can drag.
- **Countdown**: "Sunset in 3 hours 20 minutes", "Earthset in 18 hours", "sunlight returns in …".
- **Sun elevation** is shown big and prominent (the challenge stresses this value).
- **Hourly battery chart**, with the background shaded for sunlit, dark and communication-loss periods.
- **Side-by-side comparison with the current point**: two horizons overlaid, with one explanatory sentence, for example "Moving 2.3 km to cell X: the longest darkness drops from 72 hours to 10 hours because the northern ridge is 1.5° lower".
- CSV export button (Expert mode).

### 3.5 3D globe (globe.gl)

- The Moon uses a NASA texture, with pins for the famous sites and the 9 regions.
- From the selected site, it draws arrows pointing to the Sun and the Earth.
- Clicking the south polar region switches to the 2D map.

### 3.6 Learning mode (teachers, the public)

- Every metric has a one-sentence explanation in plain words.
- Card "Why moving 1 km changes so much": it automatically finds the pair of neighboring cells whose results differ the most, then compares the two horizons.
- Card "How the Moon differs from the Earth": no atmosphere, so no refraction and the sky is black even in the daytime; near the south pole the Sun stays only a few degrees high; one lunar day lasts about 29.5 Earth days.

## 4. Algorithm

### 4.1 Hourly log of one cell

For each hour t and each cell c:

1. Compute the elevation and azimuth of the Sun and the Earth at the cell (section 4.3).
2. Take the horizon elevation of the cell at that same azimuth.
3. Compute the visible fraction of the Sun's disk (`sun_frac`), the visible fraction of the Earth's disk (`earth_frac`), and the sunlight factor (`sun_factor`).

### 4.2 Sliding window

For each cell c in the search scope and each landing time s (6-hour step), the window is the hours from s to s + days × 24.

Metrics in the window:

- `longest_dark`: the longest run of consecutive hours with `sun_frac < 0.5`.
- `longest_comm_loss`: the longest run of consecutive hours with `earth_frac < 0.5`.
- `pct_sun`, `pct_earth`, `pct_both`: the share of hours with sunlight, with the Earth visible, and with both.
- Battery simulation:
  - The battery starts at full capacity.
  - Each hour: battery = min(capacity, battery + max power × `sun_factor` − power consumption).
  - `min_battery` is the lowest battery level. If the battery reaches 0, we record "battery dead at hour …".
- `recharge_hours`: the hours from the lowest battery point until the battery is full again, or "not fully recharged within the window".
- `time_to_sunset`: the hours from landing until the first dark hour.

A cell passes when all three conditions hold: `longest_dark ≤ max darkness`, `longest_comm_loss ≤ max communication loss`, and `min_battery > 0`.

### 4.3 Formulas

Constants: Moon radius R = 1737.4 km; Sun radius 696,000 km; Earth radius 6,371 km; 1 AU = 149,597,870.7 km.

**Cell position** (longitude λ, latitude φ, height h in km):

```
P = (R + h) · (cos φ cos λ, cos φ sin λ, sin φ)
```

**Sun or Earth position**, computed from the sub-body point (λb, φb) and the distance D to the Moon's center:

```
B = D · (cos φb cos λb, cos φb sin λb, sin φb)
```

**Elevation and azimuth at the cell:**

```
d    = B − P
up   = P / |P|
east = (−sin λ, cos λ, 0)
north = up × east
el = asin( d·up / |d| )
az = atan2( d·east, d·north )   (convert to 0–360°, measured from North, clockwise)
```

**Visible fraction of the disk** (linear approximation), where ρ is the angular radius of the disk (Sun about 0.27°, Earth about 0.95°) and H is the horizon elevation at azimuth az:

```
frac = clamp( (el − H + ρ) / (2ρ), 0, 1 )
```

**Sunlight factor:**

```
sun_factor = (1 AU / D_sun)² × sun_frac × panel_factor
```

- Vertical panel, rotating to follow the azimuth: `panel_factor = cos(el)`.
- Horizontal panel: `panel_factor = max(sin(el), 0)`.
- Automatic mode: |latitude| ≥ 60° uses the vertical panel, otherwise the horizontal panel.

Power per hour = maximum panel power × `sun_factor`.

### 4.4 Amount of computation

- One region has about 225 cells. With 6 months (730 landing times, 6-hour step) and a 144-hour window, the total is about 24 million steps, which runs in about 1–2 seconds.
- All 9 regions (about 2,000 cells) are about 10 times heavier, so they run in a Web Worker with a progress bar.
- Precompute the hourly arrays of each cell once, then slide the window over those arrays.

## 5. Data and preprocessing (Python, run once)

Libraries: `requests`, `numpy`, `rasterio`, `geopandas`, `pyproj`.

### 5.1 Shared ephemeris: `ephemeris.json`

- Call the Horizons API: `COMMAND='301'`, `CENTER='500@399'`, `QUANTITIES='14,15,19,20'`, `STEP_SIZE='1h'`, `CSV_FORMAT='YES'`, from 2027-01-01 to 2029-01-31 (one extra month at the end so the sliding window is never cut short). If one call is too long, split it by quarter.
- The codes to request:
  - Code 14: the sub-observer point. For an observer at the Earth's center, this is the sub-Earth point on the Moon, and its movement is exactly the libration.
  - Code 15: the sub-Sun point on the Moon.
  - Code 19: the Moon–Sun distance.
  - Code 20: the Earth–Moon distance.
- Each hour we store: `t, earth_sub_lon, earth_sub_lat, earth_dist_km, sun_sub_lon, sun_sub_lat, sun_dist_au`. Read the header of the result to confirm the units and column names.
- Longitude uses positive East longitude, in the Moon's mean-Earth coordinate system.
- **Mandatory validation**: pick 2 cells, call Horizons directly (`COMMAND='10'` and `'399'`, `CENTER='coord@301'`, `SITE_COORD`, `QUANTITIES='4'`), then compare the elevation and azimuth with the vector method in 4.3. The difference must be very small (about 0.1° or less). If it is larger, recheck the longitude convention and the coordinate system.
- **Fallback** if the sub-body-point approach does not work: call Horizons for elevation and azimuth directly for the center of each region and for the famous sites (about 30 calls). Cells in a region share the result of the center. This is less accurate, with an error of up to about 0.25° at the edge of a region.

### 5.2 Cell grid: from USGS

- Use the LGRS grid in ACC form for the 9 Artemis III regions. Each region has shapefiles for the 1 km, 100 m and 10 m grids. Do not use the "Terrestrial Navigational Training Grids", because those are training grids on Earth (UTM, WGS84).
- Read the 1 km grid with `geopandas`, take the cell centers, then convert them to lunar longitude/latitude. USGS recommends a registered coordinate system such as `IAU_2015:30100` or `ESRI:104903`.
- A cell ID looks like `<region code>-<1 km cell label>`. Region codes:

| Code | Region |
|---|---|
| CAB | Peak near Cabeus B |
| HAW | Haworth |
| MAL | Malapert Massif |
| MMP | Mons Mouton Plateau |
| MMO | Mons Mouton |
| NR1 | Nobile Rim 1 |
| NR2 | Nobile Rim 2 |
| DGR | de Gerlache Rim 2 |
| SLP | Slater Plain |

- The cell label comes from an existing attribute in the shapefile (check when opening the file). If there is none, name it `r<row>c<column>` ourselves.

### 5.3 Feasible cells

- **Slope**: PGDA 90 `LDSM_80S_80MPP_ADJ.TIF` (231 MB). A cell is feasible if the median slope in the cell does not exceed the threshold. The default threshold is 20°, following the map NASA showed for Space Apps 2025 (areas steeper than 20° painted black). It can be changed in the code.
- **Permanently shadowed regions**: PGDA 90 `LPSR_80S_20MPP_ADJ.TIF` (148 MB). A cell with more than 50% of its area permanently shadowed still appears on the map, but it is colored gray and labeled "no sunlight".
- The PGDA files are Cloud-Optimized GeoTIFFs, so `rasterio` can read just the windows around the 9 regions over HTTP, without downloading the whole file.

### 5.4 Horizon of each cell: `cells_<region code>.json`

- DEM: PGDA 90 `LDEM_80S_80MPP_ADJ.TIF` (181 MB) for the near part; `LDEM_60S_240MPP_ADJ.TIF` (210 MB) for the far part outside 80°S.
- Cast 360 rays (one per degree of azimuth) and sample along each ray from 100 m to 150 km with a growing step.
- Elevation angle of each sample:

```
angle = atan2( h_sample − h_cell − mast − d² / (2R), d )
```

  where d is the horizontal distance to the sample. The term d²/(2R) is the curvature of the Moon, so the horizon automatically includes the "spherical edge" mentioned by the challenge. `mast` is the height of the solar panel or antenna, 2 m by default.
- The horizon at each azimuth is the largest angle along that ray.
- Each cell stores: `id, lat, lon, h, slope, psr, horizon` (360 integers, unit 0.1°).

### 5.5 Famous sites: `sites.json`

The challenge suggests a list with Apollo sites, CLPS targets, other commercial missions and missions of other countries:

| Group | Sites |
|---|---|
| Apollo | Apollo 11, 12, 14, 15, 16, 17 |
| CLPS / commercial | IM-1 (near Malapert A), IM-2 (Mons Mouton region), Blue Ghost Mission 1 (Mare Crisium), IM-3 (Reiner Gamma, upcoming) |
| Other countries | Chang'e 3, 4, 5, 6; Chandrayaan-3; SLIM |

- Take coordinates from official sources (LROC/NASA or the relevant space agency) and list them in References.
- A site inside the coverage of the PGDA 90 DEM (down to 60°S, for example Chandrayaan-3) gets a terrain horizon. Other sites only use the spherical horizon (elevation > 0°), and the interface clearly says "terrain not included".

### 5.6 Validation

- Compare the % sunlit and % Earth visible of a few cells with the PGDA 69 map. PGDA 69 is an 18.6-year average, while we only compute 2 years, so we can only compare the order of magnitude.
- Compare one cell with QuickMap's Compute Visibility tool and take a screenshot for the slides.
- Compare the vector method with Horizons as in section 5.1.

### 5.7 File sizes

- `ephemeris.json`: about 18,000 hours × 7 numbers, around 1–2 MB (Vercel compresses it when sending).
- `cells_*.json`: about 2,000 cells × 360 numbers, around 3–4 MB in total. Split by region (about 400 KB per region) and load only the region in use.

## 6. Mapping to the challenge requirements

### 6.1 Objectives

| Challenge requirement | Feature that meets it |
|---|---|
| Interactive site selection and comparison: list of famous sites, any coordinates, compare several sites | 1 km cell grid with IDs, list of famous sites (5.5), lon/lat input, ranking table, side-by-side comparison (3.4) |
| Date and time flexibility: pick date and time, see changes over the lunar day and over the seasons | Planned date range, 6-hour slider, 2-year timeline of the current point (seasons are easy to see) |
| Sun and Earth position visualization, time left until sunset/Earthset | 2D horizon view, countdown (3.4), popup on the map (3.1) |
| Power and communication assessment: Sun elevation, sunlit duration, Earth visibility windows | Prominent elevation display, % sunlit, longest darkness, % Earth visible, longest communication loss, plus battery simulation |
| Multiple visualization approaches | 2D map, horizon view, 3D globe, battery chart, heatmap |
| Temporal dynamics: animation, timeline | Play button on the slider, time cursor in the horizon view, paths of the Sun and the Earth |
| Accessibility across skill levels | Simple and Expert modes, learning mode (3.6) |

### 6.2 Potential Considerations

| Hint from the challenge | How we handle it |
|---|---|
| Use Horizons or precomputed data | Horizons API, precomputed into `ephemeris.json` |
| Use LOLA for an accurate horizon | 360° horizon from the PGDA 90 DEM |
| No atmosphere; the horizon is set by terrain and the spherical edge | No refraction; the d²/(2R) term in the horizon formula |
| Sun elevation is an important metric | Shown big; used in the panel factor |
| Favor quick comparison of many scenarios | Backward search, ranking table, instantly updating slider |
| Clearly report the time to sunset/Earthset | Countdown |
| Highlight differences between the Moon and the Earth | Card "How the Moon differs from the Earth" |
| Explain why small changes cause big differences | Card "Why moving 1 km changes so much", two-horizon comparison |
| Account for real terrain | Horizon and slope from LOLA |
| Libration, variation of the Moon's orbit | The sub-Earth point (code 14) already includes libration; distances change by the hour (codes 19, 20) |
| Steep slopes, deep craters near the south pole | Slope filter, permanently shadowed region layer |
| Support when the schedule changes | The core of Window Finder: another date at the same site, another site in the same region |
| Educational tool | Learning mode |

## 7. Limitations (state them honestly in the submission)

- Data has a 1-hour step; the countdown is linearly interpolated, so it can be off by a few minutes up to about an hour.
- The visible fraction of the disk is a linear approximation.
- The horizon is computed at the center of a 1 km cell with an 80 m DEM, so it does not see boulders or small ridges.
- Sites outside the DEM coverage only have the spherical horizon.
- The battery model is simple: constant load, no temperature and no efficiency degradation.
- "Earth visible" takes into account real communication with the network of 3 NASA Deep Space Network (DSN) ground stations (Goldstone DSS-14, Madrid DSS-63, Canberra DSS-43, with elevation data from the JPL Horizons API, requiring a Moon elevation ≥ 10°).
- This is not an official NASA tool.

## 8. Work plan

**Day 1 (14/11)**

- Data (Python):
  - Morning: create `ephemeris.json` and do the vector validation against Horizons.
  - Afternoon: grid and horizon for one region (Malapert Massif).
  - Evening: run all 9 regions.
- Web:
  - App skeleton, 2D map of one region (using mock data while waiting), scenario form.
  - Web Worker for the sliding window, ranking table, slider.
- Goal for the end of day 1: the full flow runs for one region.

**Day 2 (15/11)**

- Horizon view, countdown, battery chart, side-by-side comparison.
- Famous sites, 3D globe, learning mode.
- Deploy to Vercel, validate against PGDA 69 and QuickMap.
- Slides or video in English, project page in English.
- Submit a few hours before the portal closes (23:59 on 15/11).

If we run late, drop in this order: 3D globe, learning mode, the "all 9 regions" scope.

## 9. Submission

- **Space Agency Data**: JPL Horizons, LOLA (PGDA 90, PGDA 69), the USGS LGRS grid, NASA's Moon texture.
- **References**: list every source in section 10, and state clearly which parts had AI help and how it was used.
- **Demo**: a 30-second video or at most 7 slides.

## 10. Sources

- Challenge page: https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/
- Horizons API: https://ssd-api.jpl.nasa.gov/doc/horizons.html
- Horizons manual (QUANTITIES codes): https://ssd.jpl.nasa.gov/horizons/manual.html
- PGDA 90, south pole DEM, slope, permanently shadowed regions: https://pgda.gsfc.nasa.gov/products/90
- PGDA 69, average illumination and Earth visibility maps: https://pgda.gsfc.nasa.gov/products/69
- LGRS grid in ACC form for the 9 Artemis III regions (USGS): https://www.sciencebase.gov/catalog/item/671a6fa8d34efed5620f89f8
- The nine candidate regions and selection criteria (LPSC 2026): https://ntrs.nasa.gov/citations/20250011660
- NASA HLS document for Space Apps 2025 (slope threshold, lighting and communication requirements): https://ntrs.nasa.gov/api/citations/20250009323/downloads/ArtemisOverview2025IntSPAPPSChallenge.pdf
- Moon texture, NASA SVS: https://svs.gsfc.nasa.gov/4720
- Cross-check tools: QuickMap https://quickmap.lroc.im-ldi.com , Moon Trek https://trek.nasa.gov/moon/
