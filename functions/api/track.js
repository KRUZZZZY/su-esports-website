// functions/api/track.js
// POST /api/track — public beacon endpoint for link-click tracking.
// Body: JSON { label, href, page } (sent via navigator.sendBeacon from the
// client-side click handler in BaseLayout.astro).
// Returns 204. Bots are dropped before any write; a privacy-light per-IP
// daily cap (2000/day) limits abuse; malformed input is silently ignored.
import { insertClick, isBot, isRateLimited } from "../_lib/clicks.js";

const MAX_BODY = 2048; // real beacons are < 500 bytes
const MAX_LABEL = 120;
const MAX_HREF = 500;
const MAX_PAGE = 200;
const HREF_RE = /^(https?:\/\/|mailto:|\/)/i; // http(s), mailto, or site-relative
const CTRL_RE = /[\u0000-\u001f\u007f]/g; // strip control chars incl. NUL

export async function onRequestPost({ request, env }) {
  const ua = request.headers.get("user-agent") || "";
  if (isBot(ua)) {
    return new Response(null, { status: 204 });
  }

  // Content-Type must be JSON. A cross-site fetch() with text/plain is a
  // CORS-safelisted "simple request" that skips preflight; application/json
  // triggers a preflight that Pages Functions rejects, so this blocks the
  // easiest cross-site spam vector.
  const ct = request.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    return new Response(null, { status: 204 });
  }

  // Reject oversized bodies before parsing (memory/CPU guard).
  const len = parseInt(request.headers.get("content-length") || "0", 10);
  if (len > MAX_BODY) {
    return new Response(null, { status: 204 });
  }

  let raw;
  try {
    raw = await request.text();
  } catch {
    return new Response(null, { status: 204 });
  }
  if (!raw || raw.length > MAX_BODY) {
    return new Response(null, { status: 204 });
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 204 });
  }

  // Must be a plain object — `null`, arrays, primitives are all rejected.
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return new Response(null, { status: 204 });
  }

  // Validate + clamp every field (untrusted input from the public internet).
  const label =
    typeof body.label === "string"
      ? body.label.replace(CTRL_RE, " ").trim().slice(0, MAX_LABEL)
      : "";
  const href =
    typeof body.href === "string"
      ? body.href.replace(CTRL_RE, "").trim().slice(0, MAX_HREF)
      : "";
  const page =
    typeof body.page === "string"
      ? body.page.replace(CTRL_RE, "").trim().slice(0, MAX_PAGE)
      : "";

  if (!label || !HREF_RE.test(href)) {
    return new Response(null, { status: 204 });
  }
  // Page must be a site path, not an absolute URL or junk.
  if (!page.startsWith("/")) {
    return new Response(null, { status: 204 });
  }

  try {
    if (await isRateLimited(env, request.headers.get("cf-connecting-ip"))) {
      return new Response(null, { status: 204 });
    }
    await insertClick(env, { label, href, page });
  } catch (err) {
    // Storage unavailable — tracking is best-effort, never break the click.
    console.error("track: insert failed", err);
    return new Response(null, { status: 204 });
  }

  return new Response(null, { status: 204 });
}
