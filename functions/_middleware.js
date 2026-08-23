// functions/_middleware.js
// Site-wide middleware for Cloudflare Pages Functions.
// Gates article routes: `date` is the PUBLISH time. When an article is ready
// and the publish time hasn't arrived yet, serve 404 (it goes live at the
// exact minute without waiting for a rebuild). Everything else passes through.
import { getPublishGate } from "./_lib/clicks.js";

const ARTICLE_RE = /^\/(news|events)\/([a-z0-9-]+)\/?$/;

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  if (request.method !== "GET") return next();

  const m = ARTICLE_RE.exec(url.pathname);
  if (!m) return next();

  // No D1 binding configured → nothing to gate; fall through to static.
  if (!env.track_db) return next();

  try {
    const publishAt = await getPublishGate(env, m[1], m[2]);
    if (publishAt && Date.now() < new Date(publishAt).getTime()) {
      return new Response("Not found", { status: 404 });
    }
  } catch (e) {
    /* gate lookup failed — serve the page rather than break it */
  }
  return next();
}
