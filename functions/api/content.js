// functions/api/content.js
// Unified CRUD router for news + events content (Cloudflare Pages Functions).
//   GET    /api/content?type=news|events            → list articles (date desc)
//   GET    /api/content?type=news|events&slug=<s>   → one article
//   POST   /api/content                             → create  { type, title, date, ...fields, body }
//   PUT    /api/content?type=news|events&slug=<s>   → update  { title, date, ...fields, body }
//   DELETE /api/content?type=news|events&slug=<s>   → delete
// All endpoints are gated by requireSession and persist via the GitHub
// Contents API (the commit triggers the Cloudflare Pages auto-rebuild).
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
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(str) {
  if (!DATE_RE.test(str)) return false;
  const d = new Date(`${str}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === str;
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
  if (!title) return fail("Title is required");
  if (title.length > 200) return fail("Title must be 200 characters or fewer");

  const date = typeof body.date === "string" ? body.date.trim() : "";
  if (!isValidDate(date)) return fail("Date must be a valid YYYY-MM-DD date");

  const mdBody = typeof body.body === "string" ? body.body : "";
  if (!mdBody.trim()) return fail("Body is required");
  if (mdBody.length > 100000) return fail("Body is too long (max 100,000 characters)");

  const fields = { title, date };

  // Draft flag: accept boolean or "true"/"false" strings, default false.
  fields.draft = body.draft === true || body.draft === "true";

  if (type === "news") {
    const author = typeof body.author === "string" ? body.author.trim() : "";
    if (!author) return fail("Author is required");
    if (author.length > 100) return fail("Author must be 100 characters or fewer");
    fields.author = author;
    const excerpt = typeof body.excerpt === "string" ? body.excerpt.trim() : "";
    if (excerpt.length > 300) return fail("Excerpt must be 300 characters or fewer");
    if (excerpt) fields.excerpt = excerpt;
  } else {
    if (body.endDate !== undefined && body.endDate !== "") {
      const endDate = typeof body.endDate === "string" ? body.endDate.trim() : "";
      if (!isValidDate(endDate)) return fail("End date must be a valid YYYY-MM-DD date");
      fields.endDate = endDate;
    }
    for (const key of ["location", "game", "link", "description"]) {
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
    return json({ slug, sha: file.sha, ...data, draft: data.draft === "true", body });
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

/** POST /api/content — create a new article (slug derived from title). */
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

  const slug = slugify(result.fields.title) || "post";
  const path = `src/content/${type}/${slug}.md`;
  const markdown = buildMarkdown(type, result.fields, result.body);

  let res;
  try {
    res = await writeFile(env, path, markdown, undefined, `Add ${contentTypeLabel(type)}: ${result.fields.title}`);
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

  if (res.status === 200) return json({ ok: true });
  return json({ error: "GitHub rejected the delete — try again shortly" }, 502);
}
