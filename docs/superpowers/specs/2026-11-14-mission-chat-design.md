# Mission chat

The user approved starting the small landing-site chat assistant after discussing
hosted free-tier APIs, Vercel, and usage protection. It prepares the existing
Scenario form, asks for missing or ambiguous details, and requires review before
applying. The existing worker remains responsible for all scientific results.

## Approaches

Hosted Gemini API is the initial implementation choice; Groq was offered as an
alternative and provider confirmation is pending. Local model hosting/training
adds deployment work without helping this bounded parameter-extraction task.
No MCP server or model download is needed.

## Scope and constraints

- Keep JavaScript, React, Vite, existing validator and data contracts; no new npm dependencies.
- Add a same-origin Vercel function, with the same handler available in Vite development.
- Send only bounded conversation, scenario, site names/IDs and date coverage to Gemini.
- Normalize quantities in code. Validate site/cell IDs against shipped data and dates against ephemeris.
- Show draft values and validation errors; preserve unspecified form fields.
- Reject stale drafts after form/map edits. Never auto-run searches or execute model-provided tools.
- English UI; input may be Vietnamese or English. Disclose sending messages to Google.
- Redis atomically reserves global, IP and signed-session allowances before a single provider call.
- Fail closed without configuration or Redis; cap input/output; no automatic retries; deduplicate request IDs.
- Credentials stay server-only. The owner supplies Gemini, Vercel and Upstash access; no secrets in chat.

## Acceptance

Tests cover unit conversion, unknown IDs/fields, invalid dates, partial drafts,
provider failures, quota denial/replay and missing configuration. Build and lint
pass. A browser smoke test covers clarification, review/apply, stale drafts and
unavailable service. Live provider and deployment checks require owner resources.
