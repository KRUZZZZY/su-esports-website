// functions/api/news.js
// POST /api/news — requireSession, validate, slugify, and commit the post to
// GitHub via the Contents API. The commit triggers the Pages auto-rebuild.
import { json, requireSession } from "../_lib/auth.js";
import { buildNewsMarkdown, createNewsFile } from "../_lib/github.js";
import { slugify } from "../_lib/slug.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(str) {
  if (!DATE_RE.test(str)) return false;
  const d = new Date(`${str}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === str;
}

export async function onRequestPost({ request, env }) {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  if (!env.GITHUB_TOKEN || !env.GITHUB_OWNER || !env.GITHUB_REPO) {
    return json({ error: "News publishing is not configured on this deployment" }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const date = typeof body.date === "string" ? body.date.trim() : "";
  const author = typeof body.author === "string" ? body.author.trim() : "";
  const excerpt = typeof body.excerpt === "string" ? body.excerpt.trim() : "";
  const mdBody = typeof body.body === "string" ? body.body : "";

  // Server-side validation (mirrors the wizard's client-side checks).
  if (!title) return json({ error: "Title is required" }, 400);
  if (title.length > 200) return json({ error: "Title must be 200 characters or fewer" }, 400);
  if (!isValidDate(date)) return json({ error: "Date must be a valid YYYY-MM-DD date" }, 400);
  if (!author) return json({ error: "Author is required" }, 400);
  if (author.length > 100) return json({ error: "Author must be 100 characters or fewer" }, 400);
  if (excerpt.length > 300) return json({ error: "Excerpt must be 300 characters or fewer" }, 400);
  if (!mdBody) return json({ error: "Body is required" }, 400);
  if (mdBody.length > 100000) return json({ error: "Body is too long (max 100,000 characters)" }, 400);

  const slug = slugify(title) || "post";
  const markdown = buildNewsMarkdown({ title, date, author, excerpt, body: mdBody });

  let res;
  try {
    res = await createNewsFile({ env, slug, title, markdown });
  } catch {
    return json({ error: "Could not reach GitHub — try again shortly" }, 502);
  }

  if (res.status === 201 || res.status === 200) {
    return json({ slug, path: `src/content/news/${slug}.md`, url: `/news/${slug}` }, 201);
  }

  if (res.status === 409 || res.status === 422) {
    return json({ error: "A post with that title already exists — change the title" }, 409);
  }

  return json({ error: "GitHub rejected the publish — try again shortly" }, 502);
}
