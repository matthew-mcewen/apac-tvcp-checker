# APAC TVCP Eligibility Checker

A small service for checking whether a VATSIM member is eligible for the Specialists of
ATC (TVCP) program, and submitting their application if so. Runs as a single Cloudflare
Worker that serves both the React frontend and the API.

## How it works

1. A visitor enters their VATSIM CID and clicks **Check**.
2. The Worker looks up the member's details and stats from the
   [VATSIM Core API](https://vatsim.dev/api/core-api/) and evaluates them against the
   rules in `config.json`.
3. If eligible, the visitor can consent to being listed on a public roster and submit
   their application, which the Worker delivers by email and/or a Discord webhook,
   depending on what's enabled in `config.json`.

## Eligibility rules

Configured under `tvcp` in `config.json`:

- `minimum_rating` — the member's ATC rating must be at least this (e.g. `"S3"`).
- `minimum_rating_change_days` — days since the member's last rating change must be at
  least this (consolidation).
- `minimum_consolidated_hours` — hours logged on the member's *current* rating must be
  at least this (consolidation).

### Known limitation

The TVCP rules also call for "no region change in the last 90 days." The VATSIM Core
API does not expose region-change history (only a rating-change timestamp), so this
rule is **not currently enforced** — see the `// TODO` in [`src/eligibility.ts`](src/eligibility.ts).
Revisit once a data source for this exists (e.g. our own historical snapshots of each
CID's region/division/subdivision).

## Setup

1. **VATSIM API key** — request a Core API key from the VATSIM Technology Team, then:
   ```bash
   npx wrangler secret put VATSIM_API_KEY
   ```
2. **Non-secret config** — copy `config.example.json` to `config.json` (already present
   with sensible defaults) and adjust the `tvcp` thresholds and `delivery` settings for
   your division.
3. **Delivery secrets** — for whichever delivery methods you enable:
   ```bash
   npx wrangler secret put SMTP_USERNAME
   npx wrangler secret put SMTP_PASSWORD
   npx wrangler secret put DISCORD_WEBHOOK_URL
   ```
4. **Local development** — copy `.dev.vars.example` to `.dev.vars` and fill in the same
   values for local testing, then:
   ```bash
   npm install
   npm run build:frontend
   npm run dev
   ```
5. **Deploy**:
   ```bash
   npm run deploy
   ```

## Project layout

- `src/` — the Worker: API routes (`index.ts`), the VATSIM API client (`vatsim.ts`),
  eligibility rules (`eligibility.ts`), and delivery (`delivery/email.ts`,
  `delivery/discord.ts`).
- `frontend/` — the React + Vite single-page app, built to `frontend/dist` and served
  by the Worker as static assets.
- `config.json` — non-secret settings (TVCP thresholds, delivery configuration). Secrets
  (API keys, SMTP password, webhook URL) are Wrangler secrets, never stored here.
