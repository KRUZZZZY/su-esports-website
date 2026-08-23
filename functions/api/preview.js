// functions/api/preview.js
// GET /api/preview?type=news|events&slug=<slug>
// Gated draft preview: requires the admin session cookie, fetches the content
// file from GitHub (drafts are committed to main, so this works for hidden
// posts too), and renders a styled HTML page approximating the live article.
// Not linked anywhere public — only reachable with the admin cookie.
import { json, requireSession } from "../_lib/auth.js";
import { getFile } from "../_lib/content.js";
import { parseMarkdown } from "../_lib/content.js";

const BRAND = "#e08f20";
const INK = "#111215";
const OFFWHITE = "#e9e9e9";

/** Escape HTML in raw text. */
function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Minimal markdown → HTML for preview (headings, paragraphs, bold/italic, links, images, lists). */
export function mdToHtml(md) {
  const lines = String(md || "").split("\n");
  const out = [];
  let inList = false;
  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      closeList();
      continue;
    }
    const inline = (t) =>
      t
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*]+)\*/g, "<em>$1</em>");

    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      closeList();
      const lvl = h[1].length;
      out.push(`<h${lvl}>${inline(esc(h[2]))}</h${lvl}>`);
      continue;
    }
    const li = /^[-*]\s+(.*)$/.exec(line);
    if (li) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inline(esc(li[1]))}</li>`);
      continue;
    }
    closeList();
    out.push(`<p>${inline(esc(line))}</p>`);
  }
  closeList();
  return out.join("\n");
}

function fmtDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
  if (!m) return "";
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function page(html, { title, isDraft }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${esc(title)} · Preview — Swansea Esports</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; background: ${INK}; color: ${OFFWHITE}; font-family: system-ui, sans-serif; line-height: 1.7; }
  .banner { background: ${BRAND}; color: #000; text-align: center; font-weight: 700; padding: 10px 16px; letter-spacing: 0.05em; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 48px 20px 80px; }
  h1 { font-size: 2.2rem; line-height: 1.2; margin: 24px 0 8px; }
  .meta { color: rgba(233,233,233,0.6); font-size: 0.9rem; margin-bottom: 24px; }
  img { max-width: 100%; border-radius: 10px; margin: 12px 0; }
  a { color: ${BRAND}; }
  .prose { font-size: 1.05rem; }
  .prose h2 { margin-top: 32px; }
  .prose p { margin: 14px 0; }
</style>
</head>
<body>
  <div class="banner">⚠️ PREVIEW — ${isDraft ? "not published yet" : "published content"}</div>
  <main class="wrap">
    <a href="/admin/new" style="font-size:0.85rem;color:${BRAND}">← Back to admin</a>
    ${html}
  </main>
</body>
</html>`;
}

export async function onRequestGet({ request, env }) {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const slug = url.searchParams.get("slug");
  if (!type || !["news", "events"].includes(type) || !slug) {
    return json({ error: "type and slug query params are required" }, 400);
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return json({ error: "Invalid slug" }, 400);
  }

  const file = await getFile(env, `src/content/${type}/${slug}.md`);
  if (file.status === 404) return json({ error: "Not found" }, 404);
  if (file.status !== 200) return json({ error: "Could not read from GitHub" }, 502);

  const { data, body } = parseMarkdown(file.content);
  const isDraft = data.draft === "true";
  const title = data.title || slug;

  const metaParts = [fmtDate(data.date)].filter(Boolean);
  if (type === "news" && data.author) metaParts.push(data.author);
  if (type === "events") {
    if (data.endDate) metaParts.push(`until ${fmtDate(data.endDate)}`);
    if (data.game) metaParts.push(data.game);
    if (data.location) metaParts.push(data.location);
  }

  const hero = data.image ? `<img src="${esc(data.image)}" alt="" />` : "";
  const link =
    type === "events" && data.link
      ? `<p><a href="${esc(data.link)}" target="_blank" rel="noopener" style="display:inline-block;background:${BRAND};color:#000;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Sign up / more info</a></p>`
      : "";
  const excerpt = data.excerpt || data.description
    ? `<p style="font-style:italic;color:rgba(233,233,233,0.75)">${esc(data.excerpt || data.description)}</p>`
    : "";

  const html = `<h1>${esc(title)}</h1>
<p class="meta">${esc(metaParts.join(" · "))}</p>
${hero}
${excerpt}
<div class="prose">${mdToHtml(body)}</div>
${link}`;

  return new Response(page(html, { title, isDraft }), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}
