# Mission chat verification — 15 November 2026

Verified on the WF2 Vercel Preview using `gemini-3.5-flash-lite` and the owner's
Upstash Redis database. The owner provided a scoped Preview share link; no model
key was downloaded or included in the browser bundle. Inputs below are synthetic
mission scenarios, not specifications of real spacecraft.

## Live checks

| Case | Expected and observed behavior |
|---|---|
| English date range | “At Malapert Massif, January 1–7, 2028, stay 6 days. Battery 10 kWh, panel 1 kW, load 300 W.” → start `2028-01-01`, end `2028-01-07`, 6 days, 10000 Wh, 1000 W, 300 W; Apply updates the form. |
| Vietnamese limits | “Ở Malapert Massif, hạ cánh từ 2028-02-01 đến 2028-02-07, ở lại 3 ngày. Pin 2.5 kWh, tấm pin 1.2 kW, tải 150 W. Tối đa 8 giờ tối và 4 giờ mất liên lạc. Tìm trong bán kính 5 km.” → all ten expected date/quantity/scope fields matched. |
| Month without year | “At Malapert Massif in January, staying 6 days.” → asks for year; Apply disabled. |
| Partial update | Change only battery to 2.5 kWh in a custom Haworth scenario → 2500 Wh; point, dates, 875 W panel, 225 W load, 9 h darkness, 7 h comm loss, horizontal panel and 12.5 km radius preserved. |
| Missing landing point | January 1–7, 2028, 3-day stay, 2 kWh battery, 150 W load → asks for landing site and disables Apply. |
| Follow-up answer | “Use Malapert Massif.” → preserves the preceding dates/limits; enables Apply. |
| Apply and search | Reviewed draft fills the Expert form; Find landing windows runs the existing worker and returns 287 cells × 28 landing times with no alert. |
| Duplicate request | Repeat the same signed-session request ID → HTTP 409. |
| Minute cap | New fourth request after three accepted calls in one minute → HTTP 429. |
| Invalid payload | Add a user-controlled `model` field → HTTP 400 before quota/provider processing. |
| Invalid calendar date | `2028-02-30` → asks for clarification; Apply disabled. |
| Unknown location | “Atlantis Base” → asks for a catalog site or explicit coordinates; no invented location applied. |
| Outside scope | Request a shoe-company sales email → explains the supported task; no mission draft can be applied. |
| Mobile layout | 390 px Chromium viewport → no horizontal page overflow; form/chat controls usable. |

## Local checks and corrections

- All 197 Node tests, lint and production build pass on the branch integrated
  with current main. A clean build with
  `NODE_ENV=production` and `npm ci --include=dev` also passed.
- Actual Redis Lua concurrency test: 20 simultaneous reservations at a cap of 3
  accepted exactly 3; replay denial and expiry were checked.
- Browser tests with synthetic API replies cover unavailable service, multi-turn
  clarification, unit display and stale drafts after a user edits the form.
- Early live responses omitted the last landing date and power/communication
  fields. Requiring complete nullable extraction, adding concrete date/unit
  examples and checking ambiguous years corrected the tested cases.
- Coordinate provenance rejects invented values, sign flips and integer-prefix
  parsing of decimal longitudes. A quantity such as 2000.5 W cannot satisfy a
  request for the landing year.

## Final review fixes (local regression checks)

- A new message supersedes the previous draft immediately. If the request fails,
  Apply stays disabled; the input and preceding mission context are kept for a
  successful retry. Chromium checks cover HTTP 429/502, network failure, invalid
  JSON and an incomplete response; retrying applies the corrected 5 kWh battery
  instead of the earlier 2.5 kWh value.
- Empty or all-null extraction patches cannot enable Apply, including when the
  current form is valid. Explicit mission fields remain reviewable even when
  their values match the form. Browser checks also verify an outside-scope
  response leaves the form unchanged and displays no applicable parameters.
- Reproduce the browser checks against the local Vite server with
  `PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs CHROMIUM_PATH=/path/to/chromium CHAT_TEST_URL=http://localhost:5173/?screen=map node tests/mission-chat.browser.mjs`
  from `web`. Playwright is external tooling, not an app dependency. These cases
  use synthetic API replies and do not spend Gemini quota.

## Guided mission entry

The assistant now provides a guided request builder with site/date choices,
plain-language quantity hints and explicit unit selectors. Blank fields keep
the displayed current values; only supplied details go into the generated
message. Preparing the message makes no API call. The user sends it explicitly.
The review labels illustrative defaults in grey, supplied values that pass form
validation in green, invalid values in red, missing values in amber and existing
custom form values as “From form”. Source tracking survives screen changes during
the session and does not label later manual edits as chat input. “Valid” means
form validation, not physical mission feasibility.

Local Node tests cover conversion, invalid inputs, date constraints and source
tracking. Chromium regressions cover guide-to-chat-to-Apply, untouched defaults,
invalid guide and draft values, source persistence, no call when generating a
message, the header shortcut and a 390 px viewport. No new service or dependency
is required. These new UI checks use synthetic API responses.
The guided labels and status badges support English and Vietnamese through the
team's translation layer. The existing `VITE_CHAT_UI=true` build-time flag must
be set to show chat; the server still requires `AI_CHAT_ENABLED=true` and secrets.

## Practical limits

These checks cover the listed scenarios, not every possible phrasing. Users
review the full draft before Apply, and still submit searches explicitly.
Unspecified limits retain the form's current values, which may be illustrative
defaults. Gemini interprets input; it does not supply scientific search results.
Provider quota and model availability can change. App caps limit model calls;
Vercel/Redis traffic remains subject to their own quotas.

Only Preview was deployed. The PR remains subject to human review; no merge or
Production publication is authorized by this verification record.
