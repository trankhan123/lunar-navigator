# Lunar Landing Site Navigator

*Pick a site and a date, see when your lander can charge and call home — and what happens if launch slips.*

NASA Space Apps Challenge 2026 · challenge: **Lunar Landing Site Navigator** · submission deadline 15 Nov 2026, 23:59 (UTC+7).

For a lunar landing site and a time range, the app shows the **Sun and Earth against the real terrain horizon**, the solar-power and direct-to-Earth windows, a **countdown to the next sunset / Earthset**, a launch-slip comparison and a simple battery simulation.

> Full spec (Vietnamese): [CLAUDE.md](CLAUDE.md). Every data file, URL and library: [DATA_SOURCES.md](DATA_SOURCES.md). Credits for the submission: [REFERENCES.md](REFERENCES.md).

## Architecture

```
[Python, run once on a laptop]
  JPL Horizons API ──┐
  LOLA DEM (PGDA 90)─┼─> pipeline/ ─> web/public/data/*.json
  PGDA 69 (validate)─┘
[Vercel, static site]
  web/ (Vite + React + globe.gl + ECharts + Tailwind) fetches /data/<site_id>.json
```

## Repository layout

```
CLAUDE.md            spec and rules (source of truth)
DATA_SOURCES.md      data files, URLs, retrieval dates, libraries
REFERENCES.md        credits for the submission
AI_USAGE.md          where AI was used (required by the rules)
pipeline/
  requirements.txt
  download_data.py   downloads every file in DATA_SOURCES.md section 1 (~330 MB)
  sites.json         site list with coordinates and their sources
  fetch_horizons.py  ┐
  compute_horizon.py │ stubs to implement (owners in the task board below)
  build_site_data.py │
  validate.py        ┘
  raw/               large data, gitignored
web/
  public/data/       generated JSON (mock data lives in public/data/mock/)
  public/textures/   Moon texture for the globe
  src/               React app, one component per file
  src/astronomy.js   Sun/Earth positions in the browser (stub)
```

## Quick start

**Web** (Node 20.19+):

```bash
cd web
npm install
npm run dev        # http://localhost:5173
```

**Data pipeline** (Python 3.11+):

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r pipeline/requirements.txt
python pipeline/download_data.py
```

The download is about 330 MB into `pipeline/raw/`. It is gitignored, so every member downloads it once; the script retries and resumes if the NASA server drops the connection.

## Team rules

- Work on `main` in small commits. Each commit must still run: `cd web && npm run lint && npm run build`.
- Never commit `pipeline/raw/`, `*.tif`, `.env*` or `.vercel/` (already in `.gitignore`).
- No made-up science data. UI mock data goes in `web/public/data/mock/` with `"mock": true`, and the UI shows a **MOCK DATA** badge.
- JavaScript only (no TypeScript), no React Router, no new library without asking the team.
- New library, data source or image → add a line to `REFERENCES.md` and `DATA_SOURCES.md`.
- Big piece of work done with an AI tool → add a line to `AI_USAGE.md`.
- All UI text in English.

## Site coordinates

`pipeline/sites.json` lists 9 Artemis III candidate regions and 3 Apollo sites.

- **Artemis III regions:** NASA published only names and a map. The coordinates used here are approximate region centres derived from the USGS data release (McClernan 2024, [doi:10.5066/P1MEQ6UK](https://doi.org/10.5066/P1MEQ6UK)), marked `"verified": false`. Each one is cross-checked against a second source, which agrees within 10 km except Slater Plain (see its `note`).
- **Apollo sites:** taken from NASA NSSDCA and marked `"verified": true`.

## Task board

| Area | Spec | Owner | Status |
|---|---|---|---|
| Horizons fetch (`fetch_horizons.py`) | CLAUDE.md §5 | | todo |
| Terrain horizon (`compute_horizon.py`) | §6 | | todo |
| Build site JSON (`build_site_data.py`) | §4 | | todo |
| PGDA 69 validation (`validate.py`) | §6 | | todo |
| Globe + site picker | §8.1 | | draft (mock) |
| Horizon view | §8.2 | | draft (mock) |
| Timeline + countdown | §8.3 | | todo |
| Metrics card | §6, §8.4 | | todo |
| Energy panel | §7 | | todo |
| Compare + launch slip + heatmap | §8.5–8.6 | | todo |
| Simple / Expert mode, share link | §8 | | todo |
| `astronomy.js` vs Horizons test | §6 | | todo |
| Demo video, slides, project page | §11 | | todo |

## Deploy

Vercel, static. Set **Root Directory = `web`**, framework preset Vite (`npm run build`, output `dist`). The final link must open in a private window without login.

## Claude Code (optional)

The repo includes a project skill (`.claude/skills/lunar-navigator`) and MCP servers (`.mcp.json`: Playwright, Context7, Firecrawl, Exa). Exa and Firecrawl need your own keys: set `EXA_API_KEY` / `FIRECRAWL_API_KEY` in your shell profile. Never put keys in the repo.
