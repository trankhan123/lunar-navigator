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

- [x] Add `src/core/missionChat.test.js`: assert kWh/W/h normalization, preserve other fields, reject invented IDs/extra keys, report invalid dates and missing point.
- [x] Run the test and observe missing module failure.
- [x] Add `src/core/missionChat.js`: `normalizeChatPatch(patch, catalog)`, `prepareChatDraft(reply, scenario, catalog)` and UI field formatting; reuse `validateScenario`.
- [x] Run `node --test src/core/missionChat.test.js`.

## Task 2: Protected API

- [x] Add `server/missionChat.test.js`: missing config and Redis denial cause zero provider calls; duplicate ID rejected; upstream failure never retries.
- [x] Add `server/missionChat.js`, `server/chatQuota.js`, `server/chatCatalog.js`, and `api/mission-chat.js`; use native fetch and atomic Redis EVAL.
- [x] Add same handler to Vite dev middleware, env example and Vercel function bundling.
- [x] Run server tests, including actual Lua concurrency test when Redis is available.

## Task 3: UX and delivery

- [x] Add `components/MissionChat.jsx`, wire above ScenarioForm in App, expose reviewed draft only after validation.
- [x] Check clarification, apply, stale draft, keyboard and unavailable service in Chromium with stubbed API responses.
- [x] Document resources, limits, privacy and deployment in `docs/mission-chat-setup.md`; update README and AI usage.
- [x] Run `npm test`, `npm run lint`, `npm run build`; review diff for secrets and scope.

Execution: the user's instruction to start setup authorizes implementation;
continue in this session without reopening the already discussed design.
WF2 was fast-forwarded to origin/main because the completed form is required.
Live provider verification remains pending; do not imply it passed from stub tests or a successful deployment alone.

## Verification and delivery status

- Integrated origin/main `b948f7c` into WF2.
- 128 tests pass (including the actual Redis Lua concurrency check), lint and production build pass.
- Chromium smoke tests pass on desktop and 390px mobile with stubbed AI replies.
- Reviewer coordinate-provenance findings fixed with regression tests.
- WF2 pushed and draft PR #11 opened; no merge or Production deployment.
- Initial Vercel builds failed with `vite: command not found`; deployment metadata confirmed Root Directory was unset. The owner set it to `web`, and redeployment reached Ready.
- The Preview URL is https://lunar-navigator-git-wf2-hackathon-400c.vercel.app. It redirects unauthenticated requests to Vercel login; live Gemini/Upstash verification remains pending Preview access.
