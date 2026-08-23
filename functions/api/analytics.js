// functions/api/analytics.js
// GET /api/analytics?days=X — per-link per-day click counts over the last X days.
// Auth-protected (admin session required).
// Response:
//   {
//     days, fromDay, toDay, totalClicks,
//     links: [ { label, href, page, total, byDay: { "2026-08-18": 5, ... } } ]
//   }
import { json, requireAdmin } from "../_lib/auth.js";
import { clicksByDay, totalClicks } from "../_lib/clicks.js";

const MAX_DAYS = 365;
const MAX_LINKS = 500; // cap the pivot so poisoned data can't bloat the response
const DAY_MS = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD for a Date in UTC. */
function toDayString(d) {
  return d.toISOString().slice(0, 10);
}

export async function onRequestGet({ request, env }) {
  // Site-wide analytics are admin-only (editors see per-article views only).
  const session = await requireAdmin(request, env);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const raw = parseInt(url.searchParams.get("days") || "30", 10);
  const days = Number.isFinite(raw) ? Math.min(MAX_DAYS, Math.max(1, raw)) : 30;

  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * DAY_MS);
  const toDay = toDayString(to);
  const fromDay = toDayString(from);

  let rows;
  try {
    rows = await clicksByDay(env, fromDay, toDay);
  } catch {
    return json({ error: "Analytics database is not configured" }, 500);
  }

  // Pivot: group rows into per-link objects with a byDay map. Key by
  // JSON.stringify (unambiguous) rather than a NUL join (which crafted labels
  // could collide).
  const linkMap = new Map();
  for (const r of rows) {
    const key = JSON.stringify([r.label, r.href, r.page]);
    let entry = linkMap.get(key);
    if (!entry) {
      entry = { label: r.label, href: r.href, page: r.page, total: 0, byDay: {} };
      linkMap.set(key, entry);
    }
    entry.byDay[r.day] = r.clicks;
    entry.total += r.clicks;
  }

  const links = [...linkMap.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, MAX_LINKS);

  let totalClicksN = 0;
  try {
    totalClicksN = await totalClicks(env, fromDay, toDay);
  } catch {
    /* keep 0 */
  }

  const res = json({ days, fromDay, toDay, totalClicks: totalClicksN, links });
  // Click inventory is admin-internal — never cache it.
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
