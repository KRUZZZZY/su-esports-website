// functions/api/media.js
// GET /api/media — list all uploaded images (the site's media library).
// Images live in public/images/ (committed via /api/upload) and are served at
// /images/<name>. Returns [{ name, url, size }] sorted newest-first.
// Auth required (admin + editor both can pick media).
import { json, requireSession } from "../_lib/auth.js";
import { listDir } from "../_lib/content.js";

export async function onRequestGet({ request, env }) {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const entries = await listDir(env, "public/images");
  const items = entries
    .filter((e) => /\.(png|jpe?g|webp|gif|avif)$/i.test(e.name))
    .map((e) => ({ name: e.name, url: `/images/${encodeURIComponent(e.name)}`, size: e.size || 0 }))
    .sort((a, b) => b.name.localeCompare(a.name));

  return json({ items });
}
