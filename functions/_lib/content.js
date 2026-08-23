// functions/_lib/content.js
// Generalized content helpers for the admin API (Cloudflare Pages Functions).
// Handles YAML-safe frontmatter, markdown assembly/parsing, and GitHub
// Contents API persistence for BOTH news and events content types.
// Zero-dependency: uses global fetch / TextEncoder / btoa (Workers + Node 22).

import { slugify } from "./slug.js";

const COMMITTER = {
  name: "SU Esports Website Bot",
  email: "esports@swansea-societies.co.uk",
};

const encoder = new TextEncoder();

/**
 * UTF-8-safe base64 for the GitHub Contents API. btoa() alone throws on
 * non-Latin-1 characters (emoji, curly quotes, etc.), so encode to UTF-8
 * bytes first.
 */
export function toBase64(str) {
  const bytes = encoder.encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/**
 * Return a YAML-safe single-line scalar for a value.
 * Strings that contain ':' / '#' / leading-or-trailing whitespace / newlines,
 * or that START with a YAML-special character or a digit, are wrapped in
 * double quotes with backslash and double-quote escaped (newlines become
 * \n, so multi-line excerpt/description values survive). Everything else
 * (plain strings, dates, numbers) passes through raw.
 */
export function yamlString(value) {
  const str = typeof value === "string" ? value : String(value);
  const needsQuotes =
    str === "" ||
    /^\s|\s$/.test(str) || // leading/trailing whitespace
    /[\n\r]/.test(str) || // newlines
    /[:#"']/.test(str) || // mapping/comment/quote chars anywhere
    /\\/.test(str) || // backslash — quote + escape for safety
    /^[-?:,\[\]{}#&*!|>'"%@`\d]/.test(str) || // starts with special char or digit
    /^(true|false|null|yes|no|on|off)$/i.test(str); // would parse as bool/null
  if (!needsQuotes) return str;
  let out = "";
  for (const ch of str) {
    if (ch === "\\") out += "\\\\";
    else if (ch === '"') out += '\\"';
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else out += ch;
  }
  return `"${out}"`;
}

/**
 * Assemble a markdown file: YAML frontmatter matching the zod schemas in
 * src/content.config.ts, a blank line, then the body.
 *
 * news:   title, date, author (default "Swansea Esports"), excerpt?, image?, draft (default false)
 * events: title, date, endDate?, location?, game?, image?, link?, description?, draft (default false)
 */
export function buildMarkdown(type, fields, body = "") {
  const f = fields || {};
  const lines = ["---"];

  if (type === "news") {
    lines.push(`title: ${yamlString(f.title || "")}`);
    lines.push(`date: ${yamlString(f.date || "")}`);
    lines.push(`author: ${yamlString(f.author || "Swansea Esports")}`);
    if (f.category) lines.push(`category: ${yamlString(f.category)}`);
    if (f.intro) lines.push(`intro: ${yamlString(f.intro)}`);
    if (f.teaser) lines.push(`teaser: ${yamlString(f.teaser)}`);
    if (f.image) lines.push(`image: ${yamlString(f.image)}`);
    if (f.thumbnail) lines.push(`thumbnail: ${yamlString(f.thumbnail)}`);
    lines.push(`draft: ${f.draft ? "true" : "false"}`);
    lines.push(`ready: ${f.ready ? "true" : "false"}`);
    if (f.sponsored) lines.push("sponsored: true");
  } else if (type === "events") {
    lines.push(`title: ${yamlString(f.title || "")}`);
    lines.push(`date: ${yamlString(f.date || "")}`);
    if (f.startDate) lines.push(`startDate: ${yamlString(f.startDate)}`);
    if (f.endDate) lines.push(`endDate: ${yamlString(f.endDate)}`);
    if (f.location) lines.push(`location: ${yamlString(f.location)}`);
    if (f.game) lines.push(`game: ${yamlString(f.game)}`);
    if (f.image) lines.push(`image: ${yamlString(f.image)}`);
    if (f.thumbnail) lines.push(`thumbnail: ${yamlString(f.thumbnail)}`);
    if (f.link) lines.push(`link: ${yamlString(f.link)}`);
    if (f.description) lines.push(`description: ${yamlString(f.description)}`);
    if (f.organiser) lines.push(`organiser: ${yamlString(f.organiser)}`);
    lines.push(`draft: ${f.draft ? "true" : "false"}`);
    lines.push(`ready: ${f.ready ? "true" : "false"}`);
    if (f.sponsored) lines.push("sponsored: true");
  } else {
    throw new Error(`Unknown content type: ${type}`);
  }

  lines.push("---");
  return lines.join("\n") + "\n\n" + body + "\n";
}

/**
 * Minimal frontmatter+body split. Returns { data, body } where data is a
 * { key: value } map parsed from the lines between the first two '---'
 * fences, and body is everything after. Matching single/double quotes are
 * stripped from values and double-quoted escapes (\" \\ \n \r \t) resolved.
 */
export function parseMarkdown(md) {
  const data = {};
  let body = md || "";
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(md || "");
  if (match) {
    for (const line of match[1].split(/\r?\n/)) {
      const idx = line.indexOf(":");
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      if (!key) continue;
      let value = line.slice(idx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
        value = unescapeQuoted(value);
      }
      data[key] = value;
    }
    body = md.slice(match[0].length);
  }
  return { data, body: body.replace(/^\r?\n/, "") };
}

/** Resolve \" \\ \n \r \t escapes in a double-quoted YAML scalar, left-to-right. */
function unescapeQuoted(value) {
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === "\\" && i + 1 < value.length) {
      const next = value[i + 1];
      if (next === "\\") out += "\\";
      else if (next === '"') out += '"';
      else if (next === "n") out += "\n";
      else if (next === "r") out += "\r";
      else if (next === "t") out += "\t";
      else out += ch;
      i++;
    } else {
      out += ch;
    }
  }
  return out;
}

// ---- GitHub Contents API helpers -------------------------------------------
// getFile returns a { status, sha, content } object; the rest return the raw
// fetch Response so callers map status codes (201/200 ok, 409/422 conflict).

function ghUrl(env, path) {
  const encoded = path
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${encoded}`;
}

function ghHeaders(env) {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "su-esports-admin",
    "Content-Type": "application/json",
  };
}

/** GET a file from the repo. Returns { status, sha, content } — content is
 *  the decoded UTF-8 string (null on failure), sha the blob sha (null on failure). */
export async function getFile(env, path) {
  const res = await fetch(`${ghUrl(env, path)}?ref=main`, { headers: ghHeaders(env) });
  if (!res.ok) return { status: res.status, sha: null, content: null };
  const data = await res.json();
  const content = data.content
    ? new TextDecoder().decode(Uint8Array.from(atob(data.content), (c) => c.charCodeAt(0)))
    : "";
  return { status: res.status, sha: data.sha || null, content };
}

/** PUT a file (create when sha is omitted, update when provided). */
export async function writeFile(env, path, content, sha, message) {
  const payload = {
    message,
    content: toBase64(content),
    branch: "main",
    committer: COMMITTER,
  };
  if (sha) payload.sha = sha;
  return fetch(ghUrl(env, path), {
    method: "PUT",
    headers: ghHeaders(env),
    body: JSON.stringify(payload),
  });
}

/** DELETE a file (sha required). */
export async function deleteFile(env, path, sha, message) {
  return fetch(ghUrl(env, path), {
    method: "DELETE",
    headers: ghHeaders(env),
    body: JSON.stringify({ message, sha, branch: "main", committer: COMMITTER }),
  });
}

/** GET the entries of a directory. Returns [{ name, sha }, ...] ([] on failure). */
export async function listDir(env, path) {
  const res = await fetch(`${ghUrl(env, path)}?ref=main`, { headers: ghHeaders(env) });
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((e) => ({ name: e.name, sha: e.sha }));
}

/** PUT a pre-encoded base64 image into public/images/. Returns the raw Response. */
export async function uploadImage(env, filename, base64) {
  return fetch(ghUrl(env, `public/images/${filename}`), {
    method: "PUT",
    headers: ghHeaders(env),
    body: JSON.stringify({
      message: "Upload image",
      content: base64, // already base64 — do NOT re-encode
      branch: "main",
      committer: COMMITTER,
    }),
  });
}

// Re-export slugify for callers that want it alongside the content helpers.
export { slugify };
