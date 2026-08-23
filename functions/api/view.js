// functions/api/view.js
// POST /api/view — public beacon for per-article page views.
// Body: JSON { type: "news"|"events", slug }. The user-agent is classified
// bot vs human at write time (isBot from _lib/clicks.js) so the admin can
// show both counts. Same hardening as /api/track: JSON content-type, body
// cap, field validation, per-IP daily cap.
// Returns 204. Best-effort — never breaks the page.
import { insertView } from "../_lib/clicks.js";
import { isBot, isRateLimited } from "../_lib/clicks.js";

const MAX_BODY = 1024;
const CTRL_RE = /[\u0000-\u001f\u007f]/g;

export async function onRequestPost({ request, env }) {
  const ct = request.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    return new Response(null, { status: 204 });
  }
  const len = parseInt(request.headers.get("content-length") || "0", 10);
  if (len > MAX_BODY) return new Response(null, { status: 204 });

  let raw;
  try {
    raw = await request.text();
  } catch {
    return new Response(null, { status: 204 });
  }
  if (!raw || raw.length > MAX_BODY) return new Response(null, { status: 204 });

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 204 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return new Response(null, { status: 204 });
  }

  const type = typeof body.type === "string" ? body.type.replace(CTRL_RE, "") : "";
  const slug = typeof body.slug === "string" ? body.slug.replace(CTRL_RE, "") : "";
  if ((type !== "news" && type !== "events") || !/^[a-z0-9-]+$/.test(slug)) {
    return new Response(null, { status: 204 });
  }

  try {
    if (await isRateLimited(env, request.headers.get("cf-connecting-ip"))) {
      return new Response(null, { status: 204 });
    }
    const ua = request.headers.get("user-agent") || "";
    await insertView(env, { type, slug, isBot: isBot(ua) });
  } catch (err) {
    console.error("view: insert failed", err);
    return new Response(null, { status: 204 });
  }
  return new Response(null, { status: 204 });
}
