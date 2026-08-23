// functions/_lib/clicks.js
// Shared D1 helpers for the link-click tracker.
// Underscore-prefixed directories are NOT routed by Pages Functions.

// Module-level memo: run the DDL once per isolate instead of on every request.
let ensured = false;

/**
 * Lazily create the schema (idempotent). Runs once per isolate on first use;
 * migrations/*.sql is the canonical schema for `wrangler d1 migrations apply`.
 */
async function ensureTable(env) {
  if (ensured) return;
  await env.track_db
    .prepare(
      `CREATE TABLE IF NOT EXISTS clicks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT NOT NULL,
        href TEXT NOT NULL DEFAULT '',
        page TEXT NOT NULL DEFAULT '',
        day TEXT NOT NULL,
        ts INTEGER NOT NULL
      )`
    )
    .run();
  await env.track_db
    .prepare(
      `CREATE INDEX IF NOT EXISTS idx_clicks_day_label ON clicks(day, label, href, page)`
    )
    .run();
  await env.track_db
    .prepare(
      `CREATE TABLE IF NOT EXISTS track_ip_day (
        ip_hash TEXT NOT NULL,
        day TEXT NOT NULL,
        n INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (ip_hash, day)
      )`
    )
    .run();
  ensured = true;
}

/** Insert one click event. day/ts are computed server-side (UTC). */
export async function insertClick(env, { label, href, page }) {
  await ensureTable(env);
  const now = new Date();
  const day = now.toISOString().slice(0, 10); // YYYY-MM-DD in UTC
  await env.track_db
    .prepare(
      `INSERT INTO clicks (label, href, page, day, ts) VALUES (?, ?, ?, ?, ?)`
    )
    .bind(label, href, page, day, now.getTime())
    .run();
}

/**
 * Privacy-light per-IP daily write cap: HMACs the connecting IP with
 * AUTH_SECRET (raw IPs never touch disk), counts rows per hash per UTC day,
 * and rejects once a caller passes the cap. Returns true when limited.
 * The counter table self-prunes rows older than 7 days on each call.
 */
export async function isRateLimited(env, ip) {
  if (!ip || !env.AUTH_SECRET) return false;
  await ensureTable(env);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.AUTH_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`ip:${ip}`)
  );
  const hash = [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);

  const day = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const row = await env.track_db
    .prepare(`SELECT n FROM track_ip_day WHERE ip_hash = ? AND day = ?`)
    .bind(hash, day)
    .first();
  const n = row ? row.n : 0;
  if (n >= 2000) return true;

  await env.track_db
    .prepare(
      `INSERT INTO track_ip_day (ip_hash, day, n) VALUES (?, ?, 1)
       ON CONFLICT(ip_hash, day) DO UPDATE SET n = n + 1`
    )
    .bind(hash, day)
    .run();
  await env.track_db
    .prepare(`DELETE FROM track_ip_day WHERE day < ?`)
    .bind(cutoff)
    .run();
  return false;
}

/** Total clicks in the inclusive window [fromDay, toDay]. */
export async function totalClicks(env, fromDay, toDay) {
  await ensureTable(env);
  const res = await env.track_db
    .prepare(`SELECT COUNT(*) AS n FROM clicks WHERE day >= ? AND day <= ?`)
    .bind(fromDay, toDay)
    .first();
  return res ? res.n : 0;
}

/**
 * Per-link per-day counts in the window [fromDay, toDay].
 * Returns rows grouped by (label, href, page, day) ordered by day.
 */
export async function clicksByDay(env, fromDay, toDay) {
  await ensureTable(env);
  const { results } = await env.track_db
    .prepare(
      `SELECT label, href, page, day, COUNT(*) AS clicks
       FROM clicks
       WHERE day >= ? AND day <= ?
       GROUP BY label, href, page, day
       ORDER BY day ASC`
    )
    .bind(fromDay, toDay)
    .all();
  return results;
}

/**
 * Robots/spiders user-agent filter. Cheap guard — not a security boundary,
 * just stops obvious crawler noise. Deliberately does NOT match "whatsapp" or
 * "telegram": those substrings appear in real users' in-app browsers, so
 * matching them would silently drop genuine clicks shared via chat apps.
 */
const BOT_RE =
  /bot|crawl|spider|slurp|preview|monitor|uptime|pingdom|statuscake|headless|facebookexternalhit|discordbot|yandex|baidu|ia_archiver|apache-httpclient|urllib|node-fetch|undici|pagespeed|google-inspectiontool|datadog-synthetics|curl|wget|python-requests|go-http-client|java\/|okhttp|axios|postman|insomnia/i;

export function isBot(ua) {
  return BOT_RE.test(ua || "");
}
