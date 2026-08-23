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
