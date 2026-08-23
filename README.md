# Swansea University Esports — Website

The official website for **Swansea University Esports** (the society, also known as **Swansea Esports** / **SwanseaGG**), live at <https://swanseauniesports.co.uk>.

A fast, free-to-host static site that the committee can edit themselves through a web-based content editor — no developer required for day-to-day updates.

## Stack

| Piece | What it is |
| --- | --- |
| [Astro](https://astro.build) `7.2.3` | Static site generator. Builds the whole site to plain HTML/CSS/JS. |
| [Tailwind CSS](https://tailwindcss.com) `4.3.3` | Styling, configured **CSS-first** via `@theme` tokens in `src/styles/global.css`. |
| `@tailwindcss/typography` | Typographic styles for rendered markdown content. |
| `@astrojs/sitemap` | Generates `sitemap-index.xml` / `sitemap-0.xml` at build time. |
| [Sveltia CMS](https://github.com/sveltia/sveltia-cms) | Git-based headless CMS served at `/admin`. Committee members edit content in the browser; each save commits markdown to the GitHub repo and Cloudflare Pages rebuilds automatically. |

The site is **fully static** — Astro's default `static` output, **no SSR adapter**. Cloudflare Pages serves the `dist/` directory directly.

Package manager is **npm**. Requires **Node >= 22**.

## Local development

```sh
# 1. Install dependencies
npm install

# 2. Start the dev server (http://localhost:4321)
npm run dev

# 3. Production build — outputs to ./dist/
npm run build

# 4. Preview the built site locally
npm run preview

# 5. Type-check the project (content schemas, components)
npx astro check
```

## Project structure

```text
/
├── public/
│   ├── admin/
│   │   ├── index.html          # Sveltia CMS UI (served at /admin)
│   │   └── config.yml          # CMS config: collections + GitHub backend
│   ├── brand/                  # Logos: swan-head.png, swan-wide.png, logo-crest.png
│   ├── fonts/                  # Bebas Neue (Regular + Bold, bundled locally)
│   └── favicon.png
├── src/
│   ├── components/             # Header, Footer, CommitteeCard, EventCard, NewsCard, SocialLinks
│   ├── content/
│   │   ├── committee/*.md      # Committee members
│   │   ├── reps/*.md           # Game reps
│   │   ├── events/*.md         # Events
│   │   ├── news/*.md           # News posts
│   │   ├── placements/*.md     # Competitive placements
│   │   └── rankings/*.md       # Season rankings
│   ├── layouts/BaseLayout.astro
│   ├── pages/                  # Routes: /, /committee, /events, /news, /achievements, /about, 404
│   ├── content.config.ts       # Content collection schemas (zod) — the source of truth
│   ├── site.config.ts          # Site-wide config: name, URL, socials, competitions, etc.
│   └── styles/global.css       # Tailwind entry + all brand design tokens (@theme)
├── astro.config.mjs            # site URL, Tailwind Vite plugin, sitemap integration
└── package.json
```

## How content works

All site content is **markdown files with YAML frontmatter**, organised into six Astro content collections defined in `src/content.config.ts` (glob loaders + zod schemas):

- **Committee & Game Reps** — `src/content/committee/*.md` + `src/content/reps/*.md` — committee members and game representatives (name, role/game, optional photo/socials).
- **Events** — `src/content/events/*.md` — a tournament, LAN, or social (title, publish date, optional start/end date, location, game, link, description, organiser, image/thumbnail, draft/ready flags, plus a body).
- **News** — `src/content/news/*.md` — a news post (title, publish date, author, category, intro, teaser, image/thumbnail, draft/ready flags, plus a body).
- **Achievements & Rankings** — `src/content/placements/*.md` + `src/content/rankings/*.md` — competitive placements and season standings.

> ⚠️ The schemas in `src/content.config.ts` are the source of truth. If a field is added or changed there, `public/admin/config.yml` (the Sveltia CMS editor config) must be updated to match.

The committee edits news and events through the **admin editor at `/admin/new`** (email/password login) and the rest of the content through the **Sveltia CMS web UI at `/admin`** — see [CONTENT-EDITING.md](./CONTENT-EDITING.md). Each save commits the markdown to the GitHub repo, and Cloudflare Pages auto-rebuilds and redeploys the site.

## Brand

- **Name:** Swansea University Esports · **Short:** Swansea Esports · **Handle:** SwanseaGG
- **Colours:** off-white `#e9e9e9`, orange `#e08f20`, black `#000000`, gradient `#1c1c1c → #111215`
- **Font:** Bebas Neue (bundled at `public/fonts/`, no CDN)
- **Logos:** `public/brand/swan-head.png` (square mark), `public/brand/swan-wide.png` (wide swan), `public/brand/logo-crest.png` (full crest)

## Documentation

| Document | Audience | What it covers |
| --- | --- | --- |
| [CONTENT-EDITING.md](./CONTENT-EDITING.md) | Committee members (non-technical) | How to log in to `/admin` and add/edit roster, events, and news. |
| [DEPLOY.md](./DEPLOY.md) | Maintainers | Full deploy runbook: domain, Cloudflare Pages, Sveltia CMS auth. |
| [SPEC.md](./SPEC.md) | Maintainers & agents | Site specification: pages, content types, design tokens, acceptance criteria. |
| [AGENTS.md](./AGENTS.md) | AI coding tools | Cross-tool context: repo rules, commands, and invariants. |
