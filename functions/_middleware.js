// functions/_middleware.js
// Site-wide middleware for Cloudflare Pages Functions.
// Gates article routes: when an article has an unpublish gate in D1 and the
// time has passed, serve 404 — exact-time unpublish that doesn't wait for a
// rebuild. Everything else passes through untouched.
import { getUnpublishGate } from "./_lib/clicks.js";

const ARTICLE_RE = /^\/(news|events)\/([a-z0-9-]+)\/?$/;

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  if (request.method !== "GET") return next();

  const m = ARTICLE_RE.exec(url.pathname);
  if (!m) return next();

  // No D1 binding configured → nothing to gate; fall through to static.
  if (!env.track_db) return next();

  try {
    const unpublishAt = await getUnpublishGate(env, m[1], m[2]);
    if (unpublishAt && Date.now() > new Date(unpublishAt).getTime()) {
      return new Response("Not found", { status: 404 });
    }
  } catch (e) {
    /* gate lookup failed — serve the page rather than break it */
  }
  return next();
}
