# Link-click analytics

Per-link per-day click tracking for the public site. Answers: *which links get
clicked, how many times per day, over a user-selectable span of X days.*

- Report UI: `/admin/analytics` (same login as `/admin/new`)
- Ingest API: `POST /api/track` (public, bot-filtered)
- Report API: `GET /api/analytics?days=X` (admin auth required)
- Storage: Cloudflare D1 database `su-esports-track`, binding `track_db`

## How it works

1. `src/layouts/BaseLayout.astro` embeds a click listener (head, is:inline).
   Every anchor click sends `navigator.sendBeacon("/api/track", {label, href,
   page})`. The label comes from a `data-track` attribute when present, else the
   link text (60 chars), else the href.
2. `functions/api/track.js` drops bot user-agents, clamps field lengths, and
   inserts one row into the D1 `clicks` table. The UTC day is computed
   server-side, so clients can't fake dates.
3. `functions/api/analytics.js` pivots rows into per-link `byDay` maps over the
   requested window (default 30 days, clamped 1–365).
4. `/admin/analytics` renders summary cards + a sticky-column per-day table.

No cookies, no personal data, no third-party analytics. The ingest endpoint is
hardened: JSON content-type required (blocks cross-site `text/plain` spam),
body capped at 2 KB, fields validated/clamped, control chars stripped, bots
filtered by user-agent, and a privacy-light per-IP daily cap (2,000 writes/day,
IP stored only as an HMAC hash with `AUTH_SECRET`).

## Deployment (one-time, requires Cloudflare dashboard access)

The site deploys via git push → Cloudflare Pages auto-build, so the D1 binding
must be added in the dashboard (a `wrangler.toml` binding alone is not enough
for git-integrated deploys):

1. `npx wrangler login`
2. `npx wrangler d1 create su-esports-track`
   → copy the printed `database_id` into `wrangler.toml` (`[[d1_databases]]`).
   The placeholder `00000000-…` id must be replaced before any non-`--local`
   D1 command.
3. `npx wrangler d1 migrations apply su-esports-track` (creates the `clicks`
   and `track_ip_day` tables)
4. Cloudflare dashboard → Pages → `su-esports-website` → Settings → Functions →
   **D1 database bindings** → Add binding:
   - Variable name: `track_db`
   - D1 database: `su-esports-track`
5. Push to `main`. The tracker and `/admin/analytics` go live with the build.

Local dev:

```sh
npm run build
npx wrangler d1 migrations apply su-esports-track --local   # create local tables
npx wrangler pages dev dist                                  # serves site + functions
```

`.dev.vars` already provides `ADMIN_EMAIL`/`ADMIN_PASSWORD`/`AUTH_SECRET` for
the admin login locally.

## Adding a labelled link

Add `data-track="some-descriptive-label"` to any `<a>` for a stable label in
the report (page + label together disambiguate same-label links on different
pages). Untagged links still get tracked using their visible text (first 60
chars).

**Label conventions** — keep families grep-able so the report groups cleanly:

- `join-discord-*` — Discord CTAs by placement (`join-discord-hero`,
  `join-discord-header`, `join-discord-header-mobile`, `join-discord-quiz`,
  `join-discord-ready-band`, `join-discord-about-hero`)
- `nav-*` — header + footer navigation links (`nav-home`, `nav-events`, …)
- `social-*` — auto-derived in `SocialLinks.astro` (`social-discord`, …)
- `footer-*` — footer "Compete & community" links (`footer-nuel`, `footer-nse`,
  `footer-students-union`, `footer-merch-store`)
- `<verb>-<placement>` — page CTAs (`buy-membership-about`, `merch-banner`,
  `students-union-hero`, `swan-discord-hero`)

## Notes / limits

- Day buckets are UTC.
- Bots are filtered by a user-agent regex — a heuristic, not a security
  boundary. WhatsApp/Telegram in-app browsers are deliberately NOT filtered
  (real humans click shared links there).
- Counts are clicks, not unique users (no cookies).
- D1 free tier (5 GB, 100k writes/day) is ample: ~100 clicks/day ≈ 36k rows/yr.
  The per-IP daily cap protects the write quota from scripted abuse.
- No retention job yet: plan a periodic `DELETE FROM clicks WHERE day < …`
  (rows older than ~400 days) via Cloudflare Cron Triggers when the table
  grows.
