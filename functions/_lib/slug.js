// functions/_lib/slug.js
// Slug helper: the slug becomes the news post's filename and URL
// (src/content/news/<slug>.md → /news/<slug>).

/** lowercase, replace non-alphanumeric runs with "-", collapse, trim dashes */
export function slugify(input) {
  return String(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
