// functions/api/github-webhook.js
// POST /api/github-webhook — receives GitHub push webhooks and announces new
// events/news to a Discord channel webhook.
//
// Flow: GitHub sends a push event (JSON body + X-Hub-Signature-256 HMAC) →
// we verify the signature → pick out changed src/content/{events,news}/*.md
// files on main → fetch each file's content via the GitHub Contents API (the
// commit that just landed) → parse frontmatter → post a Discord embed + ping.
//
// Catches EVERY publish path (custom admin wizard, Sveltia CMS, direct git
// push) because the repo is the single source of truth. Only pushes to
// refs/heads/main are announced — feature branches and tags are ignored.
//
// Secrets (Pages secrets / .dev.vars for local):
//   GITHUB_WEBHOOK_SECRET  — the secret configured on the GitHub webhook
//   DISCORD_WEBHOOK_URL    — Discord channel webhook URL
//   DISCORD_ROLES          — JSON map { default, <game>: <role id>, ... }
//   GITHUB_TOKEN           — already a Pages secret (admin API uses it)
//   GITHUB_OWNER, GITHUB_REPO — already Pages secrets
import { json, safeEqual } from "../_lib/auth.js";
import { parseContentFile, postToDiscord, buildAnnouncement } from "../_lib/discord.js";

const MAX_BODY = 10 * 1024 * 1024; // GitHub push payloads are small; hard cap abuse
const MAX_FILES = 20; // Discord webhook rate limit is 30 msg/min — cap per push
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Decode base64 without Buffer (Workers runtime has no Node APIs). */
function decodeBase64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return decoder.decode(bytes);
}

/** Verify X-Hub-Signature-256 (HMAC-SHA256 of the raw body vs the secret). */
async function verifySignature(rawBody, signature, secret) {
  if (!signature || !secret) return false;
  const expected = signature.replace(/^sha256=/, "");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const actual = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  // Constant-time comparison via the shared auth helper (HMAC both sides).
  return safeEqual(actual, expected, secret);
}

/**
 * Fetch a file at a specific commit ref via the GitHub Contents API.
 * Per-segment URL encoding (slashes stay literal) — same pattern as _lib/content.js.
 */
async function fetchFileAtCommit(env, path, ref) {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${encoded}?ref=${encodeURIComponent(ref)}`;
  let res;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "su-esports-discord-announce",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
  } catch {
    return { error: "network" };
  }
  if (!res.ok) {
    return { error: `github ${res.status}` };
  }
  let data;
  try {
    data = await res.json();
  } catch {
    return { error: "bad json" };
  }
  if (!data.content) return { error: "no content" };
  try {
    return { raw: decodeBase64(data.content) };
  } catch {
    return { error: "bad base64" };
  }
}

/**
 * Extract the set of changed events/news file paths from a push payload,
 * plus which of them were modified (vs added).
 * GitHub push payload shape: { commits: [{ added: [], modified: [], removed: [] }] }
 */
export function collectContentPaths(payload) {
  const paths = new Set();
  const modified = new Set();
  const commits = Array.isArray(payload.commits) ? payload.commits : [];
  for (const commit of commits) {
    for (const p of commit.added || []) {
      if (/^src\/content\/(events|news)\/.+\.md$/.test(p)) paths.add(p);
    }
    for (const p of commit.modified || []) {
      if (/^src\/content\/(events|news)\/.+\.md$/.test(p)) {
        paths.add(p);
        modified.add(p);
      }
    }
  }
  return { paths: [...paths], modified };
}

/**
 * Process a push payload: fetch + announce each changed content file.
 * Returns { announced, skipped }. Per-file failures are isolated so one bad
 * file never kills the batch, and the handler always returns 200 so GitHub
 * doesn't redeliver (no duplicate announcements).
 */
async function processPush(env, payload, log = console) {
  // Only announce merges to the default branch (main). Feature branches, PR
  // branches, and tags push unreleased content — ignore them silently.
  const ref = payload.ref || "";
  const defaultBranch = payload.repository && payload.repository.default_branch;
  if (ref !== "refs/heads/main" && ref !== `refs/heads/${defaultBranch || "main"}`) {
    return { announced: 0, skipped: [`ref ${ref} ignored (not the default branch)`] };
  }
  if (payload.deleted) {
    return { announced: 0, skipped: ["branch deleted"] };
  }

  const { paths, modified } = collectContentPaths(payload);
  if (paths.length > MAX_FILES) {
    log.warn(`github-webhook: ${paths.length} content files in one push — announcing first ${MAX_FILES}`);
    paths.length = MAX_FILES;
  }

  const after = (payload.after || "").slice(0, 40) || "main";
  const results = { announced: 0, skipped: [] };

  for (const path of paths) {
    try {
      const { raw, error } = await fetchFileAtCommit(env, path, after);
      if (error) {
        results.skipped.push(`${path} (fetch failed: ${error})`);
        log.error(`github-webhook: fetch failed ${path}: ${error}`);
        continue;
      }
      const file = parseContentFile(path, raw);
      if (!file) continue;
      // Skip drafts AND non-ready articles (ready is the publish gate now).
      if (file.isDraft || !file.isReady) {
        results.skipped.push(`${path} (${file.isDraft ? "draft" : "not ready"})`);
        continue;
      }
      const announce = buildAnnouncement(file, {
        rolesJson: env.DISCORD_ROLES,
        updated: modified.has(path),
        onRolesParseError: () => log.warn(`github-webhook: DISCORD_ROLES is not valid JSON for ${path}`),
      });
      const res = await postToDiscord(env.DISCORD_WEBHOOK_URL, announce);
      if (res.ok) {
        results.announced += 1;
        log.log(`github-webhook: announced ${path}`);
      } else {
        results.skipped.push(`${path} (discord ${res.status || res.reason || "error"})`);
        log.error(`github-webhook: discord post failed ${path}: ${res.status || res.reason}`);
      }
    } catch (err) {
      results.skipped.push(`${path} (unexpected: ${(err && err.message) || err})`);
      log.error(`github-webhook: unexpected error ${path}`, err);
    }
  }
  return results;
}

export async function onRequestPost({ request, env }) {
  const event = request.headers.get("x-github-event") || "";

  // Cheap rejections before touching the body.
  const len = parseInt(request.headers.get("content-length") || "0", 10);
  if (len > MAX_BODY) return json({ error: "Payload too large" }, 413);

  // GitHub sends a `ping` when the webhook is created/edited — acknowledge it.
  if (event === "ping") return json({ ok: true, event: "ping" });
  if (event !== "push") return json({ error: "Only push events are supported" }, 400);

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY) return json({ error: "Payload too large" }, 413);

  const ok = await verifySignature(rawBody, request.headers.get("x-hub-signature-256"), env.GITHUB_WEBHOOK_SECRET);
  if (!ok) {
    return json({ error: "Invalid signature" }, 401);
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  try {
    const results = await processPush(env, payload);
    return json({ ok: true, ...results });
  } catch (err) {
    console.error("github-webhook: processing failed", err);
    return json({ error: "Processing failed" }, 500);
  }
}
