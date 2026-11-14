# AI Usage

Tool: Claude Code (Anthropic).

- 2026-11-14 — Set up the dev environment, scaffolded `web/` (Vite + React + Tailwind + globe.gl + ECharts) with a mock-data draft page, generated mock data in `web/public/data/mock/`, and test-deployed a draft to Vercel.
- 2026-11-14 — Wrote `pipeline/download_data.py` and `DATA_SOURCES.md`, downloaded NASA PGDA 90/69 rasters and the SVS 4720 texture.
- 2026-11-14 — Created the project Claude Code skill (`.claude/skills/lunar-navigator`) and adapted third-party ECC skills to this stack.
- 2026-11-14 — Researched site coordinates (NTRS, NASA, USGS, NSSDCA) into `pipeline/sites.json` with sources and a verification flag; scaffolded the repo (README, requirements, pipeline stubs, `web/src/astronomy.js` stub).
