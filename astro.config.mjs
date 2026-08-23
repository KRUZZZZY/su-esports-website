// @ts-check
import { defineConfig } from 'astro/config';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config

/** Collect slugs whose frontmatter marks them sponsored (excluded from sitemap). */
function sponsoredSlugs() {
  const slugs = new Set();
  for (const type of ['news', 'events']) {
    const dir = join(process.cwd(), 'src', 'content', type);
    let files = [];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith('.md'));
    } catch {
      continue; // collection dir absent locally (content lives on GitHub)
    }
    for (const file of files) {
      const raw = readFileSync(join(dir, file), 'utf8');
      if (/^sponsored:\s*true\s*$/m.test(raw)) {
        slugs.add(`${type}/${file.replace(/\.md$/, '')}`);
      }
    }
  }
  return slugs;
}

const sponsored = sponsoredSlugs();

export default defineConfig({
  site: 'https://swanseauniesports.co.uk',

  vite: {
    plugins: [tailwindcss()]
  },

  markdown: {
    remarkPlugins: [allowOnlyWideHtml]
  },

  integrations: [
    sitemap({
      filter: (page) => {
        if (page.includes('/admin/')) return false;
        // Exclude sponsored articles from the sitemap (noindex for search engines).
        const m = /\/(news|events)\/([a-z0-9-]+)\/?$/.exec(page);
        if (m && sponsored.has(`${m[1]}/${m[2]}`)) return false;
        return true;
      }
    })
  ]
});

/**
 * Remark plugin: strip ALL raw HTML from markdown EXCEPT the wizard's exact
 * `.wide` block wrapper. Stored XSS defense-in-depth — Astro passes raw HTML
 * in markdown through unescaped, so without this an injected <img onerror>
 * would execute for every visitor. The wizard already escapes text on
 * serialize; this also covers hand-authored/Sveltia content.
 */
function allowOnlyWideHtml() {
  /** @param {any} tree */
  return (tree) => {
    const DANGEROUS = /^(\s*(javascript|vbscript|data):)/i;
    /** @param {any} node */
    const visit = (node) => {
      if (node.type === 'html' && typeof node.value === 'string') {
        const v = node.value.trim();
        if (v === '<div class="wide">' || v === '</div>') return; // keep wrapper
        // Turn everything else into escaped text so it renders visibly, not as markup.
        node.type = 'text';
        node.value = node.value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }
      // Neutralize javascript:/data:/vbscript: markdown link destinations.
      if (node.type === 'link' && typeof node.url === 'string' && DANGEROUS.test(node.url)) {
        node.url = '#';
      }
      if (node.children) node.children.forEach(visit);
    };
    visit(tree);
  };
}
