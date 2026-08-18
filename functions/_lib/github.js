// functions/_lib/github.js
// GitHub Contents API helpers for committing news posts straight to the repo
// (same commit-triggers-rebuild loop the CMS uses).

/**
 * UTF-8-safe base64 for the GitHub Contents API. btoa() alone throws on
 * non-Latin-1 characters (emoji, curly quotes, etc.), so encode to UTF-8
 * bytes first.
 */
export function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/**
 * Assemble the news markdown file exactly as:
 *   ---
 *   title: <title>
 *   date: <date>
 *   author: <author>
 *   excerpt: <excerpt>     ← omitted when empty
 *   draft: false
 *   ---
 *
 *   <body>
 * (author is always kept; matches the zod schema in src/content.config.ts)
 */
export function buildNewsMarkdown({ title, date, author, excerpt, body }) {
  const frontmatter = ["---", `title: ${title}`, `date: ${date}`, `author: ${author}`];
  if (excerpt) frontmatter.push(`excerpt: ${excerpt}`);
  frontmatter.push("draft: false", "---");
  return frontmatter.join("\n") + "\n\n" + body + "\n";
}

/**
 * PUT the news post to GitHub Contents API. Returns the raw Response;
 * callers map status codes (201 ok, 409/422 = slug already exists).
 */
export async function createNewsFile({ env, slug, title, markdown }) {
  const path = `src/content/news/${slug}.md`;
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`;
  return fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "su-esports-admin",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: `Add news post: ${title}`,
      content: toBase64(markdown),
      branch: "main",
      committer: {
        name: "SU Esports Website Bot",
        email: "esports@swansea-societies.co.uk",
      },
    }),
  });
}
