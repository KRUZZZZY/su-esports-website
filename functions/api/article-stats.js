// functions/api/article-stats.js
// GET /api/article-stats?type=news|events&slug=<slug>
// Per-article view counts (total / bot / human). Available to BOTH roles —
// editors may see per-article views; site-wide analytics (/api/analytics)
// stays admin-only.
import { json, requireSession } from "../_lib/auth.js";
import { articleViewCounts } from "../_lib/clicks.js";

export async function onRequestGet({ request, env }) {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const slug = url.searchParams.get("slug");
  if ((type !== "news" && type !== "events") || !/^[a-z0-9-]+$/.test(slug || "")) {
    return json({ error: "type and slug query params are required" }, 400);
  }

  try {
    const counts = await articleViewCounts(env, type, slug);
    return json({ type, slug, ...counts });
  } catch {
    return json({ error: "Analytics database is not configured" }, 500);
  }
}
