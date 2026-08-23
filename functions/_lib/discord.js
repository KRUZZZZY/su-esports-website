// functions/_lib/discord.js
// Discord announce helpers for the GitHub push webhook.
// Underscore-prefixed directories are NOT routed by Pages Functions.
//
// NOTE: no Node APIs (Buffer etc.) — this runs on the Cloudflare Workers
// runtime (compat date 2024-11-01, no nodejs_compat flag). Base64 decoding
// uses atob/TextDecoder, same pattern as _lib/content.js.
import { parseMarkdown } from "./content.js";

export const BRAND_COLOR = 0xe08f20; // brand orange
// Mirrors src/site.config.ts `site.url` — keep in sync if the domain changes.
export const SITE_URL = "https://swanseauniesports.co.uk";

const CONTENT_RE = /^src\/content\/(events|news)\/([^/]+)\.md$/;
// Conservative draft set: zod rejects non-boolean draft, but never announce
// content that might not be live. Applies to BOTH news and events (events
// gained a draft field in the same schema update).
const DRAFT_VALUES = new Set(["true", "yes", "on", "1"]);

/** Is this path a publishable events/news markdown file? Returns null or { type, slug }. */
export function matchContentPath(path) {
  const m = CONTENT_RE.exec(path || "");
  return m ? { type: m[1], slug: m[2] } : null;
}

/**
 * Parse a content file into a { type, slug, meta, body, isDraft } object.
 * meta = frontmatter { key: value } via the existing parseMarkdown.
 */
export function parseContentFile(path, raw) {
  const hit = matchContentPath(path);
  if (!hit) return null;
  const { data, body } = parseMarkdown(raw);
  return {
    type: hit.type,
    slug: hit.slug,
    meta: data,
    body,
    isDraft: DRAFT_VALUES.has(String(data.draft).toLowerCase()),
    isReady: String(data.ready).toLowerCase() === "true",
  };
}

/**
 * Resolve which role(s) to ping from the DISCORD_ROLES JSON map:
 *   { "default": "123...", "valorant": "456...", "league of legends": "789..." }
 * Events with a `game` frontmatter ping that game's role (case-insensitive,
 * exact match on the whole game string); everything else pings the default.
 * Returns { roleIds: [], mapOk: true } — mapOk is false when DISCORD_ROLES
 * was present but not valid JSON (so callers can log it).
 */
export function resolveRoleIds(rolesJson, type, meta) {
  let map = {};
  let mapOk = true;
  if (rolesJson) {
    try {
      map = JSON.parse(rolesJson);
    } catch {
      map = {};
      mapOk = false;
    }
  }
  const defaultId = typeof map.default === "string" ? map.default : "";
  if (type === "events" && typeof meta.game === "string" && meta.game.trim()) {
    const game = meta.game.trim().toLowerCase();
    const match = Object.entries(map).find(
      ([key, val]) => key.toLowerCase() !== "default" && key.toLowerCase() === game && typeof val === "string"
    );
    if (match) return { roleIds: [match[1]], mapOk };
  }
  return { roleIds: defaultId ? [defaultId] : [], mapOk };
}

function fmtDate(value) {
  if (!value) return "";
  // Accept YYYY-MM-DD or ISO datetimes.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (!m) return String(value).slice(0, 200);
  const [, y, mo, d] = m;
  const month = parseInt(mo, 10);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (month < 1 || month > 12) return String(value).slice(0, 200);
  const label = `${d} ${months[month - 1]} ${y}`;
  const rest = String(value).slice(10).trim();
  return rest ? `${label} ${rest}` : label;
}

/** Escape Discord markdown mention-ish text in a fallback label. */
function escLabel(s) {
  return String(s).replace(/[@<]/g, "").slice(0, 256);
}

/**
 * Build the Discord webhook payload for one content file.
 * Returns { content, embeds, allowed_mentions } ready for the webhook API.
 */
export function buildAnnouncement(file, opts = {}) {
  const { meta, type, slug } = file;
  const url = `${SITE_URL}/${type}/${encodeURIComponent(slug)}`;
  const title = String(meta.title || slug).slice(0, 256);
  const excerpt = String(meta.teaser || meta.intro || meta.description || "").trim().slice(0, 200);

  const embed = {
    title,
    url,
    color: BRAND_COLOR,
    description: excerpt || undefined,
    thumbnail: undefined,
    footer: { text: "swanseauniesports.co.uk" },
  };
  // Thumbnail must be a valid absolute URL; a bad value skips just the image.
  const thumbSrc = meta.thumbnail || meta.image;
  if (typeof thumbSrc === "string" && thumbSrc.trim()) {
    try {
      embed.thumbnail = { url: new URL(thumbSrc, SITE_URL).href };
    } catch {
      /* malformed image — announce without thumbnail */
    }
  }
  if (!embed.thumbnail) delete embed.thumbnail;

  const fields = [];
  if (type === "events") {
    if (meta.date) fields.push({ name: "📅 Date", value: fmtDate(meta.date), inline: true });
    if (meta.endDate) fields.push({ name: "🏁 Ends", value: fmtDate(meta.endDate), inline: true });
    if (meta.location) fields.push({ name: "📍 Location", value: String(meta.location).slice(0, 100), inline: true });
    if (meta.game) fields.push({ name: "🎮 Game", value: String(meta.game).slice(0, 100), inline: true });
    if (meta.link) fields.push({ name: "🔗 Sign up", value: String(meta.link).slice(0, 200), inline: false });
  } else {
    if (meta.category) fields.push({ name: "🏷️ Category", value: String(meta.category).slice(0, 60), inline: true });
    if (meta.author) fields.push({ name: "✍️ Author", value: String(meta.author).slice(0, 100), inline: true });
    if (meta.date) fields.push({ name: "📅 Date", value: fmtDate(meta.date), inline: true });
  }
  if (fields.length) embed.fields = fields;

  const { roleIds, mapOk } = resolveRoleIds(opts.rolesJson, type, meta);
  if (opts.onRolesParseError && !mapOk) opts.onRolesParseError();

  const label = type === "events" ? "📢 New event" : "📰 News";
  const updated = opts.updated ? " (updated)" : "";
  const content = roleIds.length
    ? `${label}${updated} — ${roleIds.map((id) => `<@&${id}>`).join(" ")}`
    : `${label}${updated} — ${escLabel(title)}`;

  // Only ever ping the resolved role IDs — never @everyone/@here from content.
  return { content, embeds: [embed], allowed_mentions: { parse: [], roles: roleIds } };
}

/**
 * POST the announcement to the Discord webhook. Retries once on 429/5xx.
 * Returns { ok, status, reason }. Failures are logged by the caller.
 */
export async function postToDiscord(webhookUrl, payload) {
  if (!webhookUrl) return { ok: false, status: 0, reason: "no webhook url" };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok || (res.status !== 429 && res.status < 500)) {
        return { ok: res.ok, status: res.status };
      }
      // 429 rate limit or 5xx — brief backoff, retry once.
      await new Promise((r) => setTimeout(r, 750));
    } catch (err) {
      return { ok: false, status: 0, reason: String((err && err.message) || err) };
    }
  }
  return { ok: false, status: 429, reason: "rate limited after retry" };
}
