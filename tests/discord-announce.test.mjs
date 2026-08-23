// tests/discord-announce.test.mjs
// Unit tests for the GitHub push webhook → Discord announce pipeline.
// Run: node --test "tests/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  matchContentPath,
  parseContentFile,
  resolveRoleIds,
  buildAnnouncement,
} from "../functions/_lib/discord.js";
import { collectContentPaths } from "../functions/api/github-webhook.js";

// ---- matchContentPath -------------------------------------------------------

test("matchContentPath accepts events/news and returns type+slug", () => {
  assert.deepEqual(matchContentPath("src/content/events/freshers-lan.md"), { type: "events", slug: "freshers-lan" });
  assert.deepEqual(matchContentPath("src/content/news/season-announcement.md"), { type: "news", slug: "season-announcement" });
});

test("matchContentPath rejects non-content paths and nested/.. slugs", () => {
  assert.equal(matchContentPath("src/content/committee/zack.md"), null);
  assert.equal(matchContentPath("src/pages/index.astro"), null);
  assert.equal(matchContentPath("README.md"), null);
  assert.equal(matchContentPath("src/content/events/../news/foo.md"), null);
  assert.equal(matchContentPath("src/content/news/foo/bar.md"), null);
});

// ---- parseContentFile -------------------------------------------------------

const EVENT_MD = `---
title: Freshers LAN
date: 2026-09-20
game: Valorant
location: Singleton Campus
image: /images/lan.jpg
description: Our first LAN of the year.
---
Body here.
`;

const NEWS_DRAFT = `---
title: Draft post
date: 2026-09-01
draft: true
---
Not ready.
`;

const NEWS_DRAFT_YES = `---
title: Draft yes
date: 2026-09-01
draft: yes
---
Not ready.
`;

const EVENT_DRAFT_TRUE = `---
title: Event with draft field
date: 2026-09-01
draft: true
---
Body.
`;

test("parseContentFile parses frontmatter + detects draft (news only)", () => {
  const f = parseContentFile("src/content/events/freshers-lan.md", EVENT_MD);
  assert.equal(f.type, "events");
  assert.equal(f.slug, "freshers-lan");
  assert.equal(f.meta.title, "Freshers LAN");
  assert.equal(f.isDraft, false);
  assert.equal(f.body.trim(), "Body here.");

  assert.equal(parseContentFile("src/content/news/draft-post.md", NEWS_DRAFT).isDraft, true);
});

test("draft: yes/on/1 are treated as drafts (conservative — never announce)", () => {
  assert.equal(parseContentFile("src/content/news/draft-yes.md", NEWS_DRAFT_YES).isDraft, true);
  assert.equal(parseContentFile("src/content/news/draft-yes.md", NEWS_DRAFT_YES.replace("yes", "on")).isDraft, true);
  assert.equal(parseContentFile("src/content/news/draft-yes.md", NEWS_DRAFT_YES.replace("yes", "1")).isDraft, true);
});

test("events with draft:true ARE treated as drafts (events gained a draft field)", () => {
  const f = parseContentFile("src/content/events/event-draft.md", EVENT_DRAFT_TRUE);
  assert.equal(f.isDraft, true);
});

test("parseContentFile returns null for non-content paths", () => {
  assert.equal(parseContentFile("README.md", "---\ntitle: x\n---\n"), null);
});

// ---- resolveRoleIds ---------------------------------------------------------

const ROLES = JSON.stringify({
  default: "111111111111111111",
  valorant: "222222222222222222",
  "league of legends": "333333333333333333",
});

test("resolveRoleIds: event with game pings that game's role", () => {
  assert.deepEqual(resolveRoleIds(ROLES, "events", { game: "Valorant" }).roleIds, ["222222222222222222"]);
  assert.deepEqual(resolveRoleIds(ROLES, "events", { game: "League of Legends" }).roleIds, ["333333333333333333"]);
});

test("resolveRoleIds: event without matching game falls back to default", () => {
  assert.deepEqual(resolveRoleIds(ROLES, "events", { game: "Minecraft" }).roleIds, ["111111111111111111"]);
  assert.deepEqual(resolveRoleIds(ROLES, "events", {}).roleIds, ["111111111111111111"]);
});

test("resolveRoleIds: news always uses default; unconfigured returns []", () => {
  assert.deepEqual(resolveRoleIds(ROLES, "news", { author: "Swansea Esports" }).roleIds, ["111111111111111111"]);
  assert.deepEqual(resolveRoleIds("", "events", { game: "Valorant" }).roleIds, []);
  assert.deepEqual(resolveRoleIds("not json", "news", {}).roleIds, []);
});

test("resolveRoleIds: invalid JSON flags mapOk=false so callers can log it", () => {
  assert.equal(resolveRoleIds("not json", "news", {}).mapOk, false);
  assert.equal(resolveRoleIds("", "news", {}).mapOk, true);
});

// ---- buildAnnouncement ------------------------------------------------------

test("buildAnnouncement builds event embed with fields + ping + allowed_mentions", () => {
  const file = parseContentFile("src/content/events/freshers-lan.md", EVENT_MD);
  const payload = buildAnnouncement(file, { rolesJson: ROLES });

  assert.equal(payload.content, "📢 New event — <@&222222222222222222>");
  assert.deepEqual(payload.allowed_mentions, { parse: [], roles: ["222222222222222222"] });
  assert.equal(payload.embeds.length, 1);
  const e = payload.embeds[0];
  assert.equal(e.title, "Freshers LAN");
  assert.equal(e.url, "https://swanseauniesports.co.uk/events/freshers-lan");
  assert.equal(e.color, 0xe08f20);
  assert.equal(e.description, "Our first LAN of the year.");
  assert.equal(e.thumbnail.url, "https://swanseauniesports.co.uk/images/lan.jpg");
  const names = e.fields.map((f) => f.name);
  assert.ok(names.includes("🎮 Game"));
  assert.ok(names.includes("📍 Location"));
  assert.ok(names.includes("📅 Date"));
});

test("buildAnnouncement: title with @everyone is not pinging (allowed_mentions blocks it)", () => {
  const evil = `---
title: "@everyone"
date: 2026-09-01
---
Body.
`;
  const file = parseContentFile("src/content/news/evil.md", evil);
  const payload = buildAnnouncement(file, { rolesJson: "" });
  assert.deepEqual(payload.allowed_mentions, { parse: [], roles: [] });
  assert.ok(!payload.content.includes("@everyone"), "content must not contain raw @everyone");
});

test("buildAnnouncement: news with no roles configured → no ping, escaped title in content", () => {
  const newsMd = `---
title: Big Win
date: 2026-08-20
author: Swansea Esports
excerpt: We won nationals!
---
Body.
`;
  const file = parseContentFile("src/content/news/big-win.md", newsMd);
  const payload = buildAnnouncement(file, { rolesJson: "" });
  assert.equal(payload.content, "📰 News — Big Win");
  assert.equal(payload.embeds[0].title, "Big Win");
  const names = payload.embeds[0].fields.map((f) => f.name);
  assert.ok(names.includes("✍️ Author"));
});

test("buildAnnouncement: updated flag adds (updated) marker", () => {
  const file = parseContentFile("src/content/news/big-win.md", `---
title: Big Win
date: 2026-08-20
---
Body.
`);
  const fresh = buildAnnouncement(file, { rolesJson: ROLES });
  const edited = buildAnnouncement(file, { rolesJson: ROLES, updated: true });
  assert.ok(fresh.content.endsWith("111111111111111111>"));
  assert.ok(edited.content.includes("(updated)"));
});

test("buildAnnouncement: long titles are truncated to Discord's 256 limit", () => {
  const longTitle = "x".repeat(400);
  const file = parseContentFile("src/content/news/long.md", `---
title: ${longTitle}
date: 2026-08-20
---
Body.
`);
  const payload = buildAnnouncement(file, { rolesJson: "" });
  assert.ok(payload.embeds[0].title.length <= 256);
});

test("buildAnnouncement: malformed image value does not throw (no thumbnail)", () => {
  const file = parseContentFile("src/content/events/bad-img.md", `---
title: Bad image
date: 2026-09-01
image: http://
---
Body.
`);
  const payload = buildAnnouncement(file, { rolesJson: ROLES });
  assert.equal(payload.embeds[0].thumbnail, undefined);
});

test("buildAnnouncement: ISO datetime renders with a space (not '20 Sep 2026T19:00:00Z')", () => {
  const file = parseContentFile("src/content/events/iso-date.md", `---
title: ISO
date: 2026-09-20T19:00:00.000Z
---
Body.
`);
  const payload = buildAnnouncement(file, { rolesJson: "" });
  const dateField = payload.embeds[0].fields.find((f) => f.name === "📅 Date");
  assert.ok(dateField.value.startsWith("20 Sep 2026 "), `got: ${dateField.value}`);
});

test("buildAnnouncement: slug with spaces is URL-encoded in the embed link", () => {
  const file = parseContentFile("src/content/news/my post.md", `---
title: My Post
date: 2026-08-20
---
Body.
`);
  const payload = buildAnnouncement(file, { rolesJson: "" });
  assert.equal(payload.embeds[0].url, "https://swanseauniesports.co.uk/news/my%20post");
});

// ---- collectContentPaths ----------------------------------------------------

test("collectContentPaths dedupes across commits, tracks modified, ignores non-content", () => {
  const payload = {
    commits: [
      { added: ["src/content/events/a.md"], modified: [], removed: [] },
      { added: ["src/content/events/a.md", "src/content/news/b.md"], modified: [], removed: [] },
      { added: ["src/content/reps/cs.md", "src/pages/index.astro"], modified: [], removed: [] },
      { added: [], modified: ["src/content/events/a.md", "src/content/news/c.md"], removed: [] },
    ],
  };
  const { paths, modified } = collectContentPaths(payload);
  assert.deepEqual([...paths].sort(), [
    "src/content/events/a.md",
    "src/content/news/b.md",
    "src/content/news/c.md",
  ]);
  assert.deepEqual([...modified].sort(), ["src/content/events/a.md", "src/content/news/c.md"]);
});

test("collectContentPaths handles empty/missing commits", () => {
  assert.deepEqual(collectContentPaths({ commits: [] }), { paths: [], modified: new Set() });
  assert.deepEqual(collectContentPaths({}), { paths: [], modified: new Set() });
  assert.deepEqual(collectContentPaths({ commits: null }), { paths: [], modified: new Set() });
});
