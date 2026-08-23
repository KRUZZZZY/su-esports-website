# Discord announce-on-publish

Whenever an **event** or **news article** is published on the site — via the
admin wizard (`/admin/new`), Sveltia CMS (`/admin`), or a direct git push — a
Discord message (embed + role ping) is posted automatically.

Architecture:

```
Publish (wizard | Sveltia | git push)
  → commit lands on main
  → GitHub push webhook → POST https://swanseauniesports.co.uk/api/github-webhook
  → Pages Function verifies X-Hub-Signature-256 (HMAC)
  → picks changed src/content/{events,news}/*.md files (main branch only)
  → fetches each at the pushed commit (GitHub Contents API)
  → parses frontmatter, skips drafts
  → posts Discord embed + ping to the channel webhook
```

The repo is the single source of truth, so **every** publish path is caught —
no per-admin wiring needed. Zero new hosting, zero cost (all free tiers).

## What gets announced

- **Events**: embed with title (links to `/events/<slug>`), date, end date,
  location, game, sign-up link, thumbnail from the post image, brand-orange
  accent. Content line: `📢 New event — <@&role>`.
- **News**: title (links to `/news/<slug>`), author, date, excerpt, thumbnail.
  Content line: `📰 News — <@&role>`.
- **Edits** re-announce with an "(updated)" marker so date changes get noticed.
  Deletes are ignored.
- News with a truthy `draft` (`true`/`yes`/`on`/`1`) is **never** announced.
  Events have no draft field (schema strips it), so an event with `draft: true`
  is live on the site and IS announced — don't use it to hide events.
- Emoji in Discord messages (📢 📰 📅 📍 🎮 ✍️ 🔗) is intentional — Discord is
  a chat surface, not site copy; the site's no-emoji rule applies to the site.

## Role pings (configurable per game)

The ping target comes from the `DISCORD_ROLES` secret — a JSON map:

```json
{
  "default": "111111111111111111",
  "valorant": "222222222222222222",
  "league of legends": "333333333333333333",
  "rocket league": "444444444444444444"
}
```

- An event whose `game:` frontmatter matches a key pings **that game's role**
  (case-insensitive, whole-string match). Unknown games fall back to `default`.
- News always pings `default`.
- No `DISCORD_ROLES` secret / no match → no ping, just the message. Mentions
  are locked down with `allowed_mentions` — content can never trigger
  `@everyone`/`@here`/other roles no matter what a title says.

**Discord requirement:** a webhook can only mention a role if the role is
marked **mentionable** (Server Settings → Roles → role → toggle *Allow anyone
to @mention this role*) — otherwise the ping silently doesn't fire. `@everyone`
works without that if you prefer it as the default.

## Setup (one-time)

1. **Discord webhook** — in the channel you want announcements in (e.g.
   #announcements): Channel Settings → Integrations → Webhooks → New Webhook →
   name it "Swansea Esports Site" → copy the URL.
2. **GitHub webhook** — repo → Settings → Webhooks → Add webhook:
   - Payload URL: `https://swanseauniesports.co.uk/api/github-webhook`
   - Content type: `application/json`
   - Secret: pick a long random string (this is `GITHUB_WEBHOOK_SECRET`)
   - Events: **Just the push event** (deselect everything else)
3. **Pages secrets** (Cloudflare dashboard → Pages → su-esports-website →
   Settings → Environment variables, or `npx wrangler pages secret put`):
   - `GITHUB_WEBHOOK_SECRET` — the secret from step 2
   - `DISCORD_WEBHOOK_URL` — the webhook URL from step 1
   - `DISCORD_ROLES` — the JSON role map (see "Role pings" above)
   - `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO` — already set (admin API)
4. Push a change to `main` — the deploy includes `/api/github-webhook`.

Only pushes to `main` (the default branch) announce. Feature/PR branches and
tags are ignored — GitHub's setup `ping` is acknowledged with 200.

## Local dev

Add the same keys to `.dev.vars`
(`GITHUB_WEBHOOK_SECRET`, `DISCORD_WEBHOOK_URL`, `DISCORD_ROLES`), then:

```sh
npm run build
npx wrangler pages dev dist --port 8799
```

To simulate a GitHub push, sign a fixture payload and POST it:

```sh
node -e '
const { createHmac } = require("node:crypto");
const payload = { ref: "refs/heads/main", after: "abc123", repository: { default_branch: "main" },
  commits: [{ added: ["src/content/events/test.md"], modified: [], removed: [] }] };
const body = JSON.stringify(payload);
const sig = "sha256=" + createHmac("sha256", process.env.SECRET).update(body).digest("hex");
process.stdout.write(JSON.stringify({ body, sig }));
' > /tmp/push.json

curl -s -X POST http://localhost:8799/api/github-webhook \
  -H "Content-Type: application/json" -H "X-GitHub-Event: push" \
  -H "X-Hub-Signature-256: $(python3 -c 'import json; print(json.load(open("/tmp/push.json"))["sig"])')" \
  -d "$(python3 -c 'import json; print(json.load(open("/tmp/push.json"))["body"])')"
```

(`SECRET` env var must match the `GITHUB_WEBHOOK_SECRET` in `.dev.vars`.)

## Tests

```sh
node --test "tests/*.test.mjs"        # unit tests (21)
node tests/webhook-integration.test.mjs  # full handler with real HMAC + mocks
```

Covers: path matching, frontmatter parsing, draft detection (incl. `yes`/`on`),
role resolution (game match / fallback / unconfigured / bad JSON), embed shape,
mention lockdown, cross-commit dedupe, non-main branch ignore, ping event,
modified-file `(updated)` marker, forged-signature rejection.

## Troubleshooting

A missing Discord message usually means one of:

1. **Check GitHub redeliveries**: repo → Settings → Webhooks → Recent
   Deliveries → the push delivery → Response. The body says which files were
   announced or skipped and why.
2. **Check Cloudflare logs**: Pages → su-esports-website → Logs, or
   `npx wrangler pages deployment tail`. The function logs every announce /
   skip / error.
3. **Role not pinging**: the role isn't marked mentionable (see above), or
   `DISCORD_ROLES` is invalid JSON (logged as a warning).
4. **Nothing happened at all**: `GITHUB_WEBHOOK_SECRET` mismatch → 401 in
   Recent Deliveries; missing `DISCORD_WEBHOOK_URL` → every file skipped with
   "no webhook url".

## Notes / limits

- Signature verification is mandatory — forged pushes are rejected (401).
- Announcements are best-effort: a Discord/API failure logs and skips, it
  never breaks the site build or the admin publish. Per-file failures are
  isolated (one bad file doesn't kill the batch).
- Rate limits: Discord webhooks allow 30 msg/min — the code caps a single push
  at 20 announcements and retries once on 429/5xx. The GitHub Contents API is
  called a handful of times per push (5,000/hr with the token, shared with the
  admin API — a bulk import is the only realistic way to get close).
- The announced page link can 404 for ~30–60s after the push while Cloudflare
  Pages deploys — the embed itself is correct.
