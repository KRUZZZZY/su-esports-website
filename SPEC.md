# Site specification — Swansea University Esports

This document is the **specification** for the Swansea Esports website. It records what the site is, what pages it has, what content it stores, and how it should look and behave. It is written for future maintainers and AI agents: if you are about to change the site, read this first.

- **Site:** <https://swanseauniesports.co.uk>
- **Project:** static website for Swansea University Esports (a UK university society)
- **Stack:** Astro 7.2.3 · Tailwind CSS 4.3.3 (CSS-first) · @tailwindcss/typography · @astrojs/sitemap · Sveltia CMS · npm · Node >= 22
- **Output:** fully static (`dist/`), **no SSR adapter** — Cloudflare Pages serves `dist/` directly.

---

## 1. Pages

| Route | File | Purpose |
| --- | --- | --- |
| `/` | `src/pages/index.astro` | Home — hero, merch banner, upcoming events, latest news, achievements teaser. |
| `/committee` | `src/pages/committee.astro` | Committee members, rendered as cards. |
| `/events` | `src/pages/events.astro` | All events (upcoming + past). |
| `/news` | `src/pages/news/index.astro` | All published news posts + social-follow section. |
| `/news/[slug]` | `src/pages/news/[slug].astro` | Single news post (dynamic route per markdown file). |
| `/events/[slug]` | `src/pages/events/[slug].astro` | Single event detail page. |
| `/achievements` | `src/pages/achievements.astro` | Competitive placements by year + season rankings. |
| `/about` | `src/pages/about.astro` | About the society + contact email. |
| `404` | `src/pages/404.astro` | Custom 404 page. |
| `/admin` | `public/admin/index.html` | Sveltia CMS editor UI (not an Astro route — a static file). |
| `/admin/new` | `src/pages/admin/new.astro` | Admin editor — single-page news/events editor (email/password login, admin + editor roles). |
| `/sitemap-index.xml` | generated | Produced by `@astrojs/sitemap` at build time. |

**Navigation** (defined in `src/site.config.ts` `nav`): Home, Committee, Events, News, Achievements, About.

Shared layout: `src/layouts/BaseLayout.astro`; shared components: `Header.astro`, `Footer.astro`, `CommitteeCard.astro`, `EventCard.astro`, `NewsCard.astro`, `SocialLinks.astro`.

---

## 2. Content model

Six Astro content collections, defined in **`src/content.config.ts`** (glob loaders + zod schemas — this file is the source of truth). All content is **markdown with YAML frontmatter** in `src/content/<collection>/*.md`.

### 2.2 Events — `src/content/events/*.md`

One file per event. Shown on the Events page (+ detail page).

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `title` | string | ✅ | Event name. |
| `date` | datetime | ✅ | **Publish time** — the gate. Live when `ready` && now >= date. |
| `startDate` | datetime | — | When the event actually starts (upcoming/past split). |
| `endDate` | date | — | Only for multi-day events. |
| `location` | string | — | Venue / online. |
| `game` | string | — | Game(s), e.g. "Multi-game" (also drives Discord role pings). |
| `link` | string | — | Sign-up or info URL (https-only). |
| `image` | string | — | Intro/hero image (defaults to `/brand/swan-wide.png`). |
| `thumbnail` | string | — | Card image (cropped 16:9). |
| `description` | string | — | Short line shown on the events listing. |
| `organiser` | string | — | Who's running it (events credit an organiser, not an author). |
| `draft` | boolean | — | Default `false`; `true` hides the event. |
| `ready` | boolean | — | Default `false` — the publish gate. |
| `sponsored` | boolean | — | Hidden from the sitemap. |
| body | markdown | — | Full event details. |

### 2.3 News — `src/content/news/*.md`

One file per post. Shown on the News page (+ detail page).

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `title` | string | ✅ | Headline. |
| `date` | datetime | ✅ | **Publish time** — the gate. Live when `ready` && now >= date. |
| `author` | string | — | Defaults to `Swansea Esports` when omitted. |
| `category` | string | — | Badge on cards, e.g. Announcement, Match Report. |
| `intro` | string | — | Shown at the top of the article (max 300 chars). |
| `teaser` | string | — | Card text (max 120 chars). |
| `image` | string | — | Intro/hero image (defaults to `/brand/swan-wide.png`). |
| `thumbnail` | string | — | Card image (cropped 16:9). |
| `draft` | boolean | — | Default `false`. `true` hides the post from the live site. |
| `ready` | boolean | — | Default `false` — the publish gate. |
| `sponsored` | boolean | — | Hidden from the sitemap. |
| body | markdown | ✅ (in practice) | The article. |

**Publish rule:** an article is public only when `ready: true` AND `now >= date` (date = publish time). Listings and detail routes filter drafts and not-yet-ready posts; a D1-backed middleware 404s article routes before the publish time so scheduled posts never leak early between rebuilds.

---

### 2.4 Committee — `src/content/committee/*.md`

One file per committee member. Shown on the Committee page.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | ✅ | Real name. |
| `role` | string | ✅ | Committee role (President, Treasurer, …). |
| `ign` | string | — | In-game name / tag. |
| `photo` | string | — | Optional image path. |
| `socials` | string | — | Optional profile URL. |

### 2.5 Placements — `src/content/placements/*.md`

One file per competitive placement. Shown on the Achievements page, grouped by year.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `year` | number | ✅ | Year of the placement. |
| `competition` | string | ✅ | e.g. "NSE Spring", "NUEL Winter". |
| `game` | string | ✅ | Game, e.g. "R6S", "Apex", "CSGO". |
| `medal` | string | ✅ | "1st" / "2nd" / "3rd" (rendered as gold/silver/bronze badges). |

### 2.6 Rankings — `src/content/rankings/*.md`

One file per season ranking. Shown on the Achievements page.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `season` | string | ✅ | e.g. "2024/2025", "Winter 2024". |
| `placement` | string | ✅ | e.g. "🥉 3rd Overall NSE". |
| `order` | number | — | Sort order (lower = higher / more recent). |

---

### 2.7 Game Reps — `src/content/reps/*.md`

One file per game rep. Shown on the Committee page.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `game` | string | ✅ | The game they rep. |
| `name` | string | ✅ | Real name (use "TBC" if vacant). |
| `ign` | string | — | In-game name / tag. |

---

## 3. Site-wide configuration — `src/site.config.ts`

Single source for site metadata and links (used by Header, Footer, SocialLinks, and pages):

- **name:** `Swansea University Esports`
- **shortName:** `Swansea Esports`
- **handle:** `SwanseaGG`
- **url:** `https://swanseauniesports.co.uk`
- **discord:** `https://discord.gg/swansea`
- **studentsUnion:** `https://www.swansea-union.co.uk/activities/society/swanseaesports/`
- **merch:** `https://esk.gg/collections/swansea-esports`
- **email:** `esports@swansea-societies.co.uk`
- **socials:** Discord, Instagram `https://instagram.com/swanseagg`, Twitter/X `https://twitter.com/swanseagg`, Twitch `https://twitch.tv/swanseagg`, Steam `https://steamcommunity.com/groups/SwanseaGG`, Merch Store, Students' Union
- **competitions:** NUEL `https://thenuel.com/university/swansea-university`, NSE `https://www.nse.gg/universities/swansea-university/`

> Rule: new links belong in `site.config.ts`, not hardcoded in components.

---

## 4. Design tokens & brand

**All design tokens live in `src/styles/global.css` under `@theme`** (Tailwind CSS-first). Components and pages must use the theme tokens (e.g. `bg-brand`, `text-offwhite`, `font-display`) — **never hardcode brand colours or fonts inline**.

| Token | Value | Purpose |
| --- | --- | --- |
| `--color-brand` | `#e08f20` | Orange accent. |
| `--color-brand-dark` | `#c07a16` | Darker orange (hover states). |
| `--color-offwhite` | `#e9e9e9` | Off-white text/background. |
| `--color-ink` | `#0b0c0e` | Page background (near-black). |
| `--color-panel` | `#111215` | Panel bg — gradient top-right. |
| `--color-panel-2` | `#1c1c1c` | Panel bg — gradient bottom-left. |
| `--font-display` | `"Bebas Neue", "Arial Narrow", sans-serif` | Headings. |
| `--font-body` | system sans stack | Body text. |

**Brand:**

- **Colours:** off-white `#e9e9e9`, orange `#e08f20`, black `#000000`.
- **Gradient:** `#1c1c1c` (bottom-left) → `#111215` (top-right) — exposed as the `.bg-brand-gradient` utility (and `.bg-brand-glow` for hero sections).
- **Font:** **Bebas Neue**, bundled locally at `public/fonts/` (Regular + Bold, `@font-face` in `global.css`) — **no CDN**.
- **Logos:** `public/brand/swan-head.png` (square mark), `public/brand/swan-wide.png` (wide swan), `public/brand/logo-crest.png` (full crest), plus `public/favicon.png`.

**Style conventions:** dark theme (`color-scheme: dark`); Bebas Neue for headings with `letter-spacing: 0.03em`; body text in the system sans stack; prose styles from `@tailwindcss/typography` for rendered markdown.

**News article page layout (`/news/[slug]`):** full-bleed hero band at the top (article `image`/`thumbnail`, sharp corners, dark gradient overlay, capped at `70vh`) with the category badge, Bebas Neue title and an `author · date · N min read` line overlaid at the bottom-left; below, a two-column grid (`7fr/3fr`, stacks on small screens) — the article body (intro lead + prose) on the left, and a right sidebar separated by a vertical rule containing **Other News** (4 most recent published posts, excluding the current one) and **Other Events** (3 nearest upcoming), the two modules split by a horizontal rule. Inline markdown images in the prose are capped (`max-height: 24rem`, `object-fit: cover`, rounded, token-bordered).

---

## 5. Content editing (CMS)

- The **admin editor** at `/admin/new` (`src/pages/admin/new.astro`) is the primary news/events editor: email/password login (admin + editor roles), single-page editor with a create dialog, explicit save, duplicate, media picker, 16:9 thumbnail crop, image size / wide blocks, and the ready + publish-time gate. Backed by Pages Functions: `/api/content` (CRUD), `/api/upload`, `/api/media`, `/api/preview`.
- Sveltia CMS (Decap/Netlify-CMS-compatible, git-based) served at **`/admin`** from `public/admin/index.html` + `public/admin/config.yml`.
- Committee members edit content in the web UI; **each save commits markdown to the GitHub repo**; Cloudflare Pages auto-rebuilds.
- Auth: `sveltia-cms-auth` Cloudflare Worker + fine-grained GitHub PAT (set as a Pages secret).
- `config.yml` `backend.repo` is a placeholder until the society repo exists; it must be kept **in sync** with `src/content.config.ts` (collections, fields, types). See [DEPLOY.md](./DEPLOY.md).

---

## 6. Build & deployment

- **Build:** `npm run build` → static output in `dist/` (no SSR; `@astrojs/sitemap` generates the sitemap).
- **Dev:** `npm run dev` at `http://localhost:4321`; preview with `npm run preview`; type-check with `npx astro check`.
- **Deploy:** Cloudflare Pages, build command `npm run build`, output directory `dist`, custom domain **SwanseaUniEsports.co.uk** on Cloudflare DNS (automatic HTTPS). Free tier: unlimited static bandwidth, 500 builds/month.
- **`dist/` is never committed** (git-ignored).

---

## 7. Acceptance criteria

Use as a checklist when reviewing the site or a change to it.

### Content & data
- [ ] Committee, game reps, events, news, placements, and rankings all render from their markdown collections via `src/content.config.ts` schemas.
- [ ] Every required field is enforced by the zod schema; optional fields render only when present.
- [ ] News/event posts are public only when `ready: true` and the publish time has passed — drafts and not-yet-ready posts never appear on the live site.
- [ ] Events sort by `date`; multi-day events (`endDate`) display correctly.
- [ ] Listing pages show teasers/intros/descriptions where provided and degrade gracefully when absent.

### Design & brand
- [ ] All colours/fonts come from `@theme` tokens in `src/styles/global.css` — no hardcoded brand values in components.
- [ ] Off-white `#e9e9e9`, orange `#e08f20`, black `#000000` used per spec; gradient `#1c1c1c → #111215` via `.bg-brand-gradient`.
- [ ] Headings use Bebas Neue from the bundled `public/fonts/` files (no external font CDN).
- [ ] Logos referenced from `public/brand/` (swan-head square mark, swan-wide, logo-crest) and `public/favicon.png` used for the favicon.

### Site behaviour
- [ ] All nav links (Home, Committee, Events, News, Achievements, About) resolve; 404 page handles unknown routes.
- [ ] Social/competition/merch/SU links match `src/site.config.ts` exactly.
- [ ] Sitemap generated at build (`@astrojs/sitemap`) with the canonical URL `https://swanseauniesports.co.uk`.
- [ ] Fully static — `npm run build` succeeds with no SSR adapter; `dist/` works when served statically.
- [ ] `npx astro check` passes with no type errors.
- [ ] Accessibility: readable contrast against the dark theme, alt text on images, semantic headings.

### CMS & deploy
- [ ] `/admin` loads the Sveltia CMS UI; sign-in works for GitHub collaborators.
- [ ] Saving an edit commits markdown to the configured repo/branch and triggers a Cloudflare Pages rebuild.
- [ ] `public/admin/config.yml` matches `src/content.config.ts` (collections, fields, types, required flags).
- [ ] Custom domain serves HTTPS automatically; domain/Site config/astro.config URLs agree.

### Housekeeping
- [ ] `dist/` and `node_modules/` are never committed.
- [ ] `README.md`, `CONTENT-EDITING.md`, `DEPLOY.md`, `SPEC.md`, `AGENTS.md` stay accurate when the site changes.

---

## 8. Future work

- **Weekly results tab** (backburner — not implemented): a page where players/teams are entered, and weekly match results plus final standings feed an automated roundup; ideally auto-pulled from the Google Docs where results are already published.
