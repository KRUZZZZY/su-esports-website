// functions/api/content.js
// Unified CRUD router for news + events content (Cloudflare Pages Functions).
//   GET    /api/content?type=news|events            → list articles (date desc)
//   GET    /api/content?type=news|events&slug=<s>   → one article
//   POST   /api/content                             → create  { type, title, date, ...fields, body, draft, ready, sponsored }
//   PUT    /api/content?type=news|events&slug=<s>   → update  { title, date, ...fields, body, draft, ready, sponsored }
//   DELETE /api/content?type=news|events&slug=<s>   → delete
// All endpoints are gated by requireSession and persist via the GitHub
// Contents API (the commit triggers the Cloudflare Pages auto-rebuild).
// Roles: admins may do everything; editors may create/edit/save drafts but
// cannot flip `ready` (publish gate) — requireAdmin on ready:true transitions.
import { json, requireSession } from "../_lib/auth.js";
import {
  buildMarkdown,
  deleteFile,
  getFile,
  listDir,
  parseMarkdown,
  writeFile,
} from "../_lib/content.js";
import { slugify } from "../_lib/slug.js";

const TYPES = ["news", "events"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{3}Z?)?)?)?$/;

function isValidDate(str) {
  if (!DATE_RE.test(str)) return false;
  const d = new Date(str);
  return !Number.isNaN(d.getTime());
}

function isConfigured(env) {
  return !!(env.GITHUB_TOKEN && env.GITHUB_OWNER && env.GITHUB_REPO);
}

/**
 * Server-side validation mirroring the admin wizard's client-side checks.
 * Returns { fields } on success or { error } on failure.
 */
function validate(type, body) {
  const fail = (error) => ({ error });

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const isDraft = body.draft === true || body.draft === "true";
  const isReady = body.ready === true || body.ready === "true";

  // Rule: drafts (not ready) may have ANY field empty — the wizard auto-saves
  // a skeleton with a random slug as you type. Only going live (ready)
  // requires title, a valid date, and content.
  if (!title && !isDraft) return fail("Title is required");
  if (isReady && !title) return fail("Give the article a title before going live");
  if (title.length > 200) return fail("Title must be 200 characters or fewer");

  const date = typeof body.date === "string" ? body.date.trim() : "";
  if (date && !isValidDate(date)) return fail("Date must be a valid date or datetime (YYYY-MM-DD or YYYY-MM-DDTHH:MM)");
  if (isReady && !date) return fail("Set the unpublish date before going live");

  const mdBody = typeof body.body === "string" ? body.body : "";
  if (!mdBody.trim() && !isDraft) return fail("Body is required");
  if (isReady && !mdBody.trim()) return fail("Write some content before going live");
  if (mdBody.length > 100000) return fail("Body is too long (max 100,000 characters)");

  const fields = { title, date };

  // Draft flag: accept boolean or "true"/"false" strings, default false.
  fields.draft = isDraft;
  // Ready (publish gate): article is public when ready && now < date.
  fields.ready = isReady;
  // Sponsored: hide from the sitemap (search engines).
  fields.sponsored = body.sponsored === true || body.sponsored === "true";

  if (type === "news") {
    // Author defaults to the society name — never blocks a draft or a save.
    const author = typeof body.author === "string" ? body.author.trim() : "";
    if (author.length > 100) return fail("Author must be 100 characters or fewer");
    fields.author = author || "Swansea Esports";
    const excerpt = typeof body.excerpt === "string" ? body.excerpt.trim() : "";
    if (excerpt.length > 300) return fail("Excerpt must be 300 characters or fewer");
    if (excerpt) fields.excerpt = excerpt;
  } else {
    if (body.endDate !== undefined && body.endDate !== "") {
      const endDate = typeof body.endDate === "string" ? body.endDate.trim() : "";
      if (!isValidDate(endDate)) return fail("End date must be a valid date or datetime");
      fields.endDate = endDate;
    }
    for (const key of ["location", "game", "link", "description", "author", "organiser"]) {
      const val = typeof body[key] === "string" ? body[key].trim() : "";
      if (val.length > 200) return fail(`${key} must be 200 characters or fewer`);
      if (val) fields[key] = val;
    }
  }

  if (body.image !== undefined && body.image !== "") {
    const image = typeof body.image === "string" ? body.image.trim() : "";
    if (image.length > 500) return fail("Image must be 500 characters or fewer");
    if (image) fields.image = image;
  }

  return { fields, body: mdBody };
}
export { validate };

function contentTypeLabel(type) {
  return type === "news" ? "news post" : "event";
}

/** GET /api/content — list (type only) or one (type + slug). */
export async function onRequestGet({ request, env }) {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  if (!isConfigured(env)) {
    return json({ error: "Content management is not configured on this deployment" }, 500);
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const slug = url.searchParams.get("slug");
  if (!type || !TYPES.includes(type)) {
    return json({ error: "Type must be news or events" }, 400);
  }

  if (slug) {
    const file = await getFile(env, `src/content/${type}/${slug}.md`);
    if (file.status === 404) return json({ error: "Not found" }, 404);
    if (file.status !== 200) return json({ error: "Could not read from GitHub" }, 502);
    const { data, body } = parseMarkdown(file.content);
    return json({ slug, sha: file.sha, ...data, draft: data.draft === "true", ready: data.ready === "true", sponsored: data.sponsored === "true", body });
  }

  const entries = await listDir(env, `src/content/${type}`);
  const items = [];
  for (const entry of entries) {
    if (!entry.name.endsWith(".md")) continue;
    const file = await getFile(env, `src/content/${type}/${entry.name}`);
    if (file.status !== 200) continue;
    const { data } = parseMarkdown(file.content);
    items.push({ slug: entry.name.replace(/\.md$/, ""), title: data.title || "", date: data.date || "", ...data, draft: data.draft === "true" });
  }
  items.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return json({ items });
}

/** POST /api/content — create a new article (slug from client or title). */
export async function onRequestPost({ request, env }) {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  if (!isConfigured(env)) {
    return json({ error: "Content management is not configured on this deployment" }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const type = typeof body.type === "string" ? body.type : "";
  if (!TYPES.includes(type)) return json({ error: "Type must be news or events" }, 400);

  const result = validate(type, body);
  if (result.error) return json(result, 400);

  // Flipping `ready` on (publish gate) is admin-only.
  if (result.fields.ready && session.role !== "admin") {
    return json({ error: "Only admins can make an article ready" }, 403);
  }

  // Slug: client-supplied (random identifier for auto-saved drafts) or
  // derived from the title. Random slugs keep repeating events from colliding.
  const SLUG_RE = /^[a-z0-9-]{4,64}$/;
  const clientSlug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  const slug = clientSlug && SLUG_RE.test(clientSlug) ? clientSlug : slugify(result.fields.title) || "post";
  const path = `src/content/${type}/${slug}.md`;
  const markdown = buildMarkdown(type, result.fields, result.body);

  let res;
  try {
    res = await writeFile(env, path, markdown, undefined, `Add ${contentTypeLabel(type)}: ${result.fields.title || slug}`);
  } catch {
    return json({ error: "Could not reach GitHub — try again shortly" }, 502);
  }

  if (res.status === 201 || res.status === 200) {
    let sha = null;
    try {
      const created = await res.json();
      sha = created && created.content ? created.content.sha : null;
    } catch {
      /* body not JSON — sha stays null; the wizard re-reads on next edit anyway */
    }
    // Record the unpublish gate so the middleware 404s at the exact time.
    try {
      const { setUnpublishGate } = await import("../_lib/clicks.js");
      await setUnpublishGate(env, { type, slug, ready: result.fields.ready, unpublishAt: result.fields.date });
    } catch (e) {
      /* gate table unavailable — fall back to rebuild-time filtering */
    }
    return json({ slug, url: `/${type}/${slug}`, sha }, 201);
  }
  if (res.status === 409 || res.status === 422) {
    return json({ error: "An article with that title already exists — change the title" }, 409);
  }
  return json({ error: "GitHub rejected the publish — try again shortly" }, 502);
}

/** PUT /api/content?type=&slug= — update an existing article (filename unchanged). */
export async function onRequestPut({ request, env }) {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  if (!isConfigured(env)) {
    return json({ error: "Content management is not configured on this deployment" }, 500);
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const slug = url.searchParams.get("slug");
  if (!type || !TYPES.includes(type)) return json({ error: "Type must be news or events" }, 400);
  if (!slug) return json({ error: "Missing slug query param" }, 400);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const result = validate(type, body);
  if (result.error) return json(result, 400);

  // Flipping `ready` on (publish gate) is admin-only.
  if (result.fields.ready && session.role !== "admin") {
    return json({ error: "Only admins can make an article ready" }, 403);
  }

  const path = `src/content/${type}/${slug}.md`;
  const current = await getFile(env, path);
  if (current.status === 404) return json({ error: "Not found" }, 404);
  if (current.status !== 200) return json({ error: "Could not read from GitHub" }, 502);

  const markdown = buildMarkdown(type, result.fields, result.body);
  let res;
  try {
    res = await writeFile(env, path, markdown, current.sha, `Update ${contentTypeLabel(type)}: ${result.fields.title}`);
  } catch {
    return json({ error: "Could not reach GitHub — try again shortly" }, 502);
  }

  if (res.status === 200 || res.status === 201) {
    // Update the unpublish gate (ready articles expire at `date`).
    try {
      const { setUnpublishGate } = await import("../_lib/clicks.js");
      await setUnpublishGate(env, { type, slug, ready: result.fields.ready, unpublishAt: result.fields.date });
    } catch (e) {
      /* gate table unavailable — fall back to rebuild-time filtering */
    }
    return json({ slug, url: `/${type}/${slug}` });
  }
  if (res.status === 409 || res.status === 422) {
    return json({ error: "Could not update — the file changed on GitHub. Try again." }, 409);
  }
  return json({ error: "GitHub rejected the update — try again shortly" }, 502);
}

/** DELETE /api/content?type=&slug= — delete an existing article. */
export async function onRequestDelete({ request, env }) {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  if (!isConfigured(env)) {
    return json({ error: "Content management is not configured on this deployment" }, 500);
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const slug = url.searchParams.get("slug");
  if (!type || !TYPES.includes(type)) return json({ error: "Type must be news or events" }, 400);
  if (!slug) return json({ error: "Missing slug query param" }, 400);

  const path = `src/content/${type}/${slug}.md`;
  const current = await getFile(env, path);
  if (current.status === 404) return json({ error: "Not found" }, 404);
  if (current.status !== 200) return json({ error: "Could not read from GitHub" }, 502);

  let res;
  try {
    res = await deleteFile(env, path, current.sha, `Delete ${contentTypeLabel(type)}: ${slug}`);
  } catch {
    return json({ error: "Could not reach GitHub — try again shortly" }, 502);
  }

  if (res.status === 200) {
    try {
      const { setUnpublishGate } = await import("../_lib/clicks.js");
      await setUnpublishGate(env, { type, slug, ready: false, unpublishAt: null });
    } catch (e) {
      /* gate table unavailable */
    }
    return json({ ok: true });
  }
  return json({ error: "GitHub rejected the delete — try again shortly" }, 502);
}
