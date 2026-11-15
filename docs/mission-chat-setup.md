# Mission chat: owner setup and deployment

Target project: https://vercel.com/hackathon-400c/lunar-navigator.
Configured provider: `gemini-3.5-flash-lite`; the owner reported 20 RPM,
300,000 TPM and 600 RPD. These are account observations, not guaranteed quotas.
The Redis database is in Tokyo, and `web/vercel.json` selects Tokyo (`hnd1`)
for the function. Only Preview deployment is authorized; do not merge this PR
or publish to Production automatically.

The assistant prepares the existing form. It sends bounded messages and settings
to Gemini; the existing browser worker computes landing windows after the user
reviews and submits the form. No model download, training, GPU or MCP server is
required. No new npm dependency was added.

## Resources to create

1. In [Google AI Studio](https://aistudio.google.com/apikey), create a dedicated
   Google project/API key for this demo. Select an available **free-tier** Gemini
   model supporting JSON structured output. Check its active RPM/TPM/RPD in AI
   Studio; model access and quotas vary. Keep paid billing disabled if zero paid
   usage is required. Put the exact model ID in `GEMINI_MODEL`.
2. In [Upstash](https://console.upstash.com/), create a dedicated free Redis
   database. Copy its HTTPS REST URL and read/write REST token into Vercel.
   The limiter uses Redis EVAL; a read-only token will not work. Choose a region
   near the Vercel function. Check the database's current free quota.
3. Use the existing Vercel project serving
   https://lunar-navigator-six.vercel.app/. Root Directory stays `web`, framework
   Vite, build `npm run build`, output `dist`. Node 22+ is recommended.
   `web/vercel.json` pins the install command to `npm ci --include=dev` so Vite
   and its build plugins are installed even when the environment defaults to
   production-only dependencies. For `vite: command not found`, first confirm
   Root Directory is `web`; root-level builds cannot see this configuration.

## Two Hobby accounts, one public repository

The repository `trankhan123/lunar-navigator` is public, confirmed through the
GitHub API. Public repository collaboration is free on Vercel. A contributor
with GitHub write access can push feature branches for automatic previews and
merge through the repository's normal rules for a production deployment, when
the Vercel Git integration is configured accordingly. No owner-authored release
commit or Pro upgrade is required for this public-repository workflow.

The private-repository Hobby commit-author restriction does not apply to this
public repository. GitHub write access does not grant Vercel dashboard access:
the project owner still configures secrets, domains and project settings.
Check the actual Production Branch in Project Settings; do not change it to WF2
without coordinating with the team. Keep changes attributed to their real author.

The owner enters environment variables. Contributors can then trigger Git-based
deployments without sharing the owner's Vercel password.
If the user wants independent deployment instead, create a separate project
from code they are authorized to copy into a personal repository, and configure
its own secrets. That gets a separate URL and does not control the existing site.

## Environment variables

Set these in the Vercel project's Environment Variables. Add secrets directly
in the dashboard, never in chat, Git or variables starting with `VITE_`.
For Preview and Production, explicitly select the environments to configure.
Changes require a new deployment.

| Variable | Value |
|---|---|
| `AI_CHAT_ENABLED` | `false` initially; `true` after configuration and preview checks |
| `GEMINI_API_KEY` | Dedicated AI Studio API key |
| `GEMINI_MODEL` | Exact available free-tier model ID, beginning `gemini-` |
| `UPSTASH_REDIS_REST_URL` | Database HTTPS REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Database read/write REST token |
| `CHAT_SESSION_SECRET` | Random secret of at least 32 characters |
| `CHAT_GLOBAL_DAILY_LIMIT` | `50` initially; keep below provider/project quota |
| `CHAT_GLOBAL_MINUTE_LIMIT` | `3` initially; keep below provider RPM |

Generate the session secret privately on the owner's machine:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

To run locally, copy `web/.env.example` to `web/.env.local`, fill it privately,
then run `cd web && npm ci && npm run dev`. Vite serves the same API handler
locally. `vite preview` serves the static build only; use a Vercel preview for
deployment checks. Without credentials the form works and chat fails closed.

## Protection and practical limits

- Every accepted request atomically reserves global, IP and signed-session
  allowances **before** calling Gemini. There are no automatic provider retries.
- Defaults: global 50/day and 3/minute, IP 4/minute and 20/day, signed session
  20/day. Minute/day buckets use UTC. Counters and request IDs expire in Redis.
- All deployments using this Redis database share the global quota. Requests
  that fail at the provider still consume their reservation. Do not delete
  counters to bypass the budget.
- Messages: 1,200 characters, at most 6 history turns/6,000 characters, request
  body 16 KiB, output 1,024 tokens. Redis timeout 3 seconds, Gemini 15 seconds.
- Missing configuration, Redis outage, exhausted quota, provider errors or
  invalid responses return a safe error while the existing form remains usable.
- New coordinates require explicit signed labels, for example
  `lat: -89.5, lon: 10`. Unknown site/cell IDs are rejected. Ambiguous values
  need clarification; the user reviews all fields before applying.
- The API uses a fixed server-side model and schema, same-origin checks,
  signed HttpOnly sessions and plain text React rendering. It exposes no tools.
- These controls cap model requests; they do not prevent traffic from consuming
  Vercel invocations or Redis commands, nor guarantee the provider remains free
  if billing is later enabled. Configure available Vercel firewall/bot rules for
  `/api/mission-chat` before promoting a public demo. Shared event Wi-Fi can hit
  the IP limit; the form remains available.
- The app stores counters/hashed IP identifiers in Redis, not chat text. The
  browser keeps recent chat in memory, and sends it plus settings to Google.
  Google's applicable free-tier terms may allow product improvement use.
  Do not add request-body logs or send private information.

## Owner preview checklist

1. Review the patch, run `npm test`, `npm run lint` and `npm run build` in `web`.
2. Have the owner configure Preview secrets, enable chat, and deploy a feature branch.
3. Try a complete English and Vietnamese mission; verify units, catalog IDs,
   a follow-up answer and invalid/out-of-range dates. Check the actual model's
   structured-output support and response time. Do not treat stub tests as live
   Gemini verification.
4. Verify Apply only updates the form and that editing the form while a request
   runs blocks the stale draft. Submit a short search to verify existing results.
5. Temporarily set a low cap and confirm the next request is denied without
   another Gemini call. Restore the intended cap without clearing counters.
6. Have the owner configure Production secrets, merge the reviewed change, then test the public
   URL in an incognito window. Confirm no server keys appear in browser assets.

Emergency stop: set `AI_CHAT_ENABLED=false` and redeploy; revoke the Gemini key
in AI Studio when immediate provider-level shutdown is needed. Disabling the
assistant does not disable the mission form.

## Validation recorded during implementation

137 Node tests pass, including actual Redis Lua with 20 concurrent requests
against a cap of 3: 3 accepted, 17 denied, duplicate requests denied and TTLs
present. Synthetic-response browser tests cover stale drafts and unavailable
service. Live tests through the owner's Preview sharing link confirmed Gemini
English/Vietnamese extraction, clarification and Apply followed by the existing
worker search. Upstash-backed duplicate and minute limits returned 409/429.
See [recorded cases](mission-chat-evaluation.md). Keep sharing credentials out
of Git and PR descriptions; revoke test access when no longer needed.

References: [Vercel collaboration](https://vercel.com/docs/deployments/troubleshoot-project-collaboration),
[Vite functions](https://vercel.com/docs/frameworks/frontend/vite),
[Gemini structured output](https://aistudio.google.com/docs/structured-output),
[Gemini REST schema](https://generativelanguage.googleapis.com/$discovery/rest?version=v1beta),
[Upstash EVAL](https://upstash.com/docs/redis/sdks/ts/commands/scripts/eval).
