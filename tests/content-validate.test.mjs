// tests/content-validate.test.mjs
// Unit tests for the content API validation contract:
// drafts (not ready) accept ANY empty field; going live (ready) requires
// title, date, and body. Author defaults to "Swansea Esports" for news.
// Run: node --test "tests/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { validate } from "../functions/api/content.js";

test("skeleton news draft (all fields empty) is accepted", () => {
  const r = validate("news", {
    title: "",
    date: "",
    body: "",
    draft: true,
    ready: false,
    sponsored: false,
  });
  assert.equal(r.error, undefined, "no error: " + r.error);
  assert.equal(r.fields.author, "Swansea Esports", "author defaults");
  assert.equal(r.fields.draft, true);
});

test("skeleton event draft (all fields empty) is accepted", () => {
  const r = validate("events", {
    title: "",
    date: "",
    body: "",
    draft: true,
    ready: false,
  });
  assert.equal(r.error, undefined, "no error: " + r.error);
  assert.equal(r.fields.draft, true);
});

test("ready news requires title + date + body", () => {
  const noFields = validate("news", { title: "", date: "", body: "", draft: false, ready: true });
  assert.equal(noFields.error, "Title is required");

  const noDate = validate("news", { title: "T", date: "", body: "b", draft: false, ready: true });
  assert.equal(noDate.error, "Set the unpublish date before going live");

  const noBody = validate("news", { title: "T", date: "2026-09-20T12:00", body: "", draft: false, ready: true });
  assert.equal(noBody.error, "Body is required");
});

test("ready event accepts organiser + author, requires body/date/title", () => {
  const ok = validate("events", {
    title: "LAN",
    date: "2026-09-20T18:00",
    body: "body",
    organiser: "Lewis",
    author: "Zack",
    ready: true,
  });
  assert.equal(ok.error, undefined);
  assert.equal(ok.fields.organiser, "Lewis");
  assert.equal(ok.fields.author, "Zack");
});

test("ready news still defaults author when omitted", () => {
  const r = validate("news", { title: "T", date: "2026-09-20T12:00", body: "b", ready: true });
  assert.equal(r.error, undefined);
  assert.equal(r.fields.author, "Swansea Esports");
});

test("invalid date is rejected even on drafts; empty date ok on drafts", () => {
  const bad = validate("news", { title: "", date: "not-a-date", body: "", draft: true });
  assert.match(bad.error || "", /valid date or datetime/);
  const ok = validate("news", { title: "", date: "", body: "", draft: true });
  assert.equal(ok.error, undefined);
});
