# Mission Chat Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task by task.

**Goal:** Turn short mission descriptions into reviewed Scenario form changes.
**Architecture:** A bounded Gemini extraction endpoint prepares a partial patch;
pure JS validates and normalizes it before React offers Apply. Redis protects
the public endpoint, while existing browser code computes scientific results.
**Tech Stack:** Existing JavaScript/React/Vite, Node native fetch/crypto, Redis REST.
**Spec:** `docs/superpowers/specs/2026-11-14-mission-chat-design.md`.

## Global Constraints

- No npm dependencies, training or scientific model changes.
- Existing Scenario contract; English UI; secrets server-only.
- Single provider call per accepted request; fail closed on quota/config errors.

## Review Focus

- Concurrent requests must share an atomic global cap (task 2).
- Form edits during a request must not be overwritten (task 3).
- Unknown locations and ambiguous requests must not be auto-applied (tasks 1, 3).
- Provider errors must leave the form usable (tasks 2, 3).
- Missing production resources must disable AI safely (task 2).

## Task 1: Scenario preparation

- [ ] Add `src/core/missionChat.test.js`: assert kWh/W/h normalization, preserve other fields, reject invented IDs/extra keys, report invalid dates and missing point.
- [ ] Run the test and observe missing module failure.
- [ ] Add `src/core/missionChat.js`: `normalizeChatPatch(patch, catalog)`, `prepareChatDraft(reply, scenario, catalog)` and UI field formatting; reuse `validateScenario`.
- [ ] Run `node --test src/core/missionChat.test.js`.

## Task 2: Protected API

- [ ] Add `server/missionChat.test.js`: missing config and Redis denial cause zero provider calls; duplicate ID rejected; upstream failure never retries.
- [ ] Add `server/missionChat.js`, `server/chatQuota.js`, `server/chatCatalog.js`, and `api/mission-chat.js`; use native fetch and atomic Redis EVAL.
- [ ] Add same handler to Vite dev middleware, env example and Vercel function bundling.
- [ ] Run server tests, including actual Lua concurrency test when Redis is available.

## Task 3: UX and delivery

- [ ] Add `components/MissionChat.jsx`, wire above ScenarioForm in App, expose reviewed draft only after validation.
- [ ] Check clarification, apply, stale draft, keyboard and unavailable service in Chromium with stubbed API responses.
- [ ] Document resources, limits, privacy and deployment in `docs/mission-chat-setup.md`; update README and AI usage.
- [ ] Run `npm test`, `npm run lint`, `npm run build`; review diff for secrets and scope.

Execution: the user's instruction to start setup authorizes implementation;
continue in this session without reopening the already discussed design.
WF2 was fast-forwarded to origin/main because the completed form is required.
Live credentials and deployment remain pending; do not imply live verification.
