# AI Usage

Tool: Claude Code (Anthropic).

- 2026-11-14 — Set up the dev environment, scaffolded `web/` (Vite + React + Tailwind + globe.gl + ECharts) with a mock-data draft page, generated mock data in `web/public/data/mock/`, and test-deployed a draft to Vercel.
- 2026-11-14 — Wrote `pipeline/download_data.py` and `DATA_SOURCES.md`, downloaded NASA PGDA 90/69 rasters and the SVS 4720 texture.
- 2026-11-14 — Created the project Claude Code skill (`.claude/skills/lunar-navigator`) and adapted third-party ECC skills to this stack.
- 2026-11-14 — Researched site coordinates (NTRS, NASA, USGS, NSSDCA) into `pipeline/sites.json` with sources and a verification flag; scaffolded the repo (README, requirements, pipeline stubs, `web/src/astronomy.js` stub).
- 2026-11-14 — Split the Window Finder design into modules with strict contracts (README module board, data formats, function signatures); wrote module stubs in `web/src/core/` and `pipeline/`, contract tests (`node:test`), the data checker `pipeline/check_web_data.py`, the mock-data generator and the Web Worker plumbing; updated CLAUDE.md and the project skill.
