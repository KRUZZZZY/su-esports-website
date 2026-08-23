// tests/preview.test.mjs
// Unit tests for the gated preview renderer.
// Run: node --test "tests/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { mdToHtml } from "../functions/api/preview.js";

test("mdToHtml renders headings, paragraphs, lists, links, images, bold/italic", () => {
  const html = mdToHtml(`# Title
Some **bold** and *italic* text with a [link](https://example.com).

- item one
- item two

![alt](/images/x.png)`);

  assert.match(html, /<h1>Title<\/h1>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>italic<\/em>/);
  assert.match(html, /<a href="https:\/\/example.com">link<\/a>/);
  assert.match(html, /<ul>\s*<li>item one<\/li>\s*<li>item two<\/li>\s*<\/ul>/);
  assert.match(html, /<img src="\/images\/x.png" alt="alt"/);
});

test("mdToHtml escapes HTML in source text (no injection)", () => {
  const html = mdToHtml(`<script>alert(1)</script> and <b>raw</b>`);
  assert.ok(!html.includes("<script>"), "script tag must be escaped");
  assert.ok(!html.includes("<b>raw</b>"), "raw bold tag must be escaped");
  assert.match(html, /&lt;script&gt;/);
});

test("mdToHtml handles empty/blank input", () => {
  assert.equal(mdToHtml(""), "");
  assert.equal(mdToHtml("   \n\n  "), "");
});

test("mdToHtml renders h2/h3 and inline images with alt", () => {
  const html = mdToHtml(`## Sub
### Subsub
![cap](/img/a.png)`);
  assert.match(html, /<h2>Sub<\/h2>/);
  assert.match(html, /<h3>Subsub<\/h3>/);
  assert.match(html, /<img src="\/img\/a.png" alt="cap"/);
});
