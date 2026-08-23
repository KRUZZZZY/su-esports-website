// tests/webhook-integration.test.mjs
// Full handler integration test: real HMAC signature, mocked GitHub Contents
// API + Discord webhook. Run: node tests/webhook-integration.test.mjs
import { createHmac } from "node:crypto";
import { onRequestPost } from "../functions/api/github-webhook.js";

const SECRET = "test-webhook-secret-123";
const EVENT_MD = `---
title: Freshers LAN
date: 2026-09-20
game: Valorant
location: Singleton Campus
image: /images/lan.jpg
description: Our first LAN of the year.
ready: true
---
Body here.
`;
const NEWS_MD = `---
title: Big Win
date: 2026-08-20
author: Swansea Esports
teaser: We won nationals!
ready: true
---
Body.
`;
const DRAFT_MD = `---
title: Draft post
date: 2026-09-01
draft: true
ready: false
---
Not ready.
`;

function makePush(commits, ref = "refs/heads/main", after = "abc123def456") {
  return {
    ref,
    after,
    repository: { default_branch: "main" },
    commits,
  };
}

const fileContents = {
  "src/content/events/freshers-lan.md": EVENT_MD,
  "src/content/news/big-win.md": NEWS_MD,
  "src/content/news/draft-post.md": DRAFT_MD,
};
const discordCalls = [];
globalThis.fetch = async (url, opts) => {
  if (url.startsWith("https://api.github.com/")) {
    const path = decodeURIComponent(url.split("/contents/")[1].split("?")[0]);
    const content = fileContents[path];
    if (!content) return new Response(JSON.stringify({ message: "not found" }), { status: 404 });
    return new Response(JSON.stringify({ content: Buffer.from(content).toString("base64") }), { status: 200 });
  }
  if (url.startsWith("https://discord.com/api/webhooks/")) {
    discordCalls.push(JSON.parse(opts.body));
    return new Response(null, { status: 204 });
  }
  throw new Error("unexpected url " + url);
};

const env = {
  GITHUB_WEBHOOK_SECRET: SECRET,
  DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/123/abc",
  DISCORD_ROLES: JSON.stringify({ default: "111111111111111111", valorant: "222222222222222222" }),
  GITHUB_TOKEN: "fake-token",
  GITHUB_OWNER: "KRUZZZZY",
  GITHUB_REPO: "su-esports-website",
};

async function call(payload) {
  const body = JSON.stringify(payload);
  const sig = "sha256=" + createHmac("sha256", SECRET).update(body).digest("hex");
  const req = new Request("http://localhost/api/github-webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-GitHub-Event": "push", "X-Hub-Signature-256": sig },
    body,
  });
  const res = await onRequestPost({ request: req, env });
  return { res, data: await res.json() };
}

const assert = (cond, msg) => { if (!cond) { console.error("FAIL:", msg); process.exit(1); } };

// ---- test 1: happy path — event + news announced, draft skipped ------------
discordCalls.length = 0;
{
  const { res, data } = await call(makePush([
    { added: ["src/content/events/freshers-lan.md", "src/content/news/big-win.md"], modified: [], removed: [] },
    { added: ["src/content/news/draft-post.md"], modified: [], removed: [] },
  ]));
  assert(res.status === 200, "status 200");
  assert(data.announced === 2, `announced=2 got ${data.announced}`);
  assert(data.skipped.length === 1 && data.skipped[0].includes("draft"), "draft skipped");
  assert(discordCalls.length === 2, "two discord calls");
  assert(discordCalls[0].content === "📢 New event — <@&222222222222222222>", "event pings valorant role");
  assert(discordCalls[0].embeds[0].title === "Freshers LAN", "event title");
  assert(discordCalls[0].embeds[0].url === "https://swanseauniesports.co.uk/events/freshers-lan", "event url");
  assert(discordCalls[1].content === "📰 News — <@&111111111111111111>", "news pings default");
  console.log("✓ test 1: happy path (event+news announced, draft skipped)");
}

// ---- test 2: non-main branch push is ignored --------------------------------
discordCalls.length = 0;
{
  const { res, data } = await call(makePush(
    [{ added: ["src/content/events/freshers-lan.md"], modified: [], removed: [] }],
    "refs/heads/feature-branch"
  ));
  assert(res.status === 200, "non-main branch returns 200");
  assert(data.announced === 0, "non-main branch announces nothing");
  assert(discordCalls.length === 0, "non-main branch posts nothing to Discord");
  console.log("✓ test 2: non-main branch push ignored");
}

// ---- test 3: ping event acknowledged ---------------------------------------
{
  const body = JSON.stringify({ zen: "keep it simple" });
  const sig = "sha256=" + createHmac("sha256", SECRET).update(body).digest("hex");
  const req = new Request("http://localhost/api/github-webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-GitHub-Event": "ping", "X-Hub-Signature-256": sig },
    body,
  });
  const res = await onRequestPost({ request: req, env });
  assert(res.status === 200, "ping returns 200");
  console.log("✓ test 3: ping event acknowledged with 200");
}

// ---- test 4: modified file gets (updated) marker ----------------------------
discordCalls.length = 0;
{
  const { res, data } = await call(makePush([
    { added: [], modified: ["src/content/news/big-win.md"], removed: [] },
  ]));
  assert(res.status === 200, "modified returns 200");
  assert(data.announced === 1, "modified file announced");
  assert(discordCalls[0].content.includes("(updated)"), "modified file gets (updated) marker");
  console.log("✓ test 4: modified file re-announces with (updated) marker");
}

// ---- test 5: bad signature rejected ----------------------------------------
{
  const body = JSON.stringify(makePush([]));
  const req = new Request("http://localhost/api/github-webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-GitHub-Event": "push", "X-Hub-Signature-256": "sha256=deadbeef" },
    body,
  });
  const res = await onRequestPost({ request: req, env });
  assert(res.status === 401, "bad signature → 401");
  console.log("✓ test 5: forged signature rejected (401)");
}

console.log("\nALL INTEGRATION ASSERTIONS PASSED");
