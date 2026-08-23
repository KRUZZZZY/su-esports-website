// functions/api/media.js
// GET /api/media — list all uploaded images (the site's media library).
// Images live in public/images/ (committed via /api/upload) and are served at
// /images/<name>. Returns [{ name, url, size }] sorted newest-first.
// Auth required (admin + editor both can pick media).
import { json, requireSession } from "../_lib/auth.js";
import { listDir } from "../_lib/content.js";

const MAX_ITEMS = 200; // cap the library so a huge images dir can't blow the DOM

export async function onRequestGet({ request, env }) {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const entries = await listDir(env, "public/images");
  const items = entries
    .filter((e) => /\.(png|jpe?g|webp|gif|avif)$/i.test(e.name))
    .map((e) => ({ name: e.name, url: `/images/${encodeURIComponent(e.name)}` }))
    .sort((a, b) => b.name.localeCompare(a.name))
    .slice(0, MAX_ITEMS);

  return json({ items });
}
