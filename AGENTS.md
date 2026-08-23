# AGENTS.md

Cross-tool context for AI coding agents (Claude Code, Codex, Cursor, Copilot, …) working in this repository.

## What this repo is

The website for **Swansea University Esports** (a UK university society), live at https://swanseauniesports.co.uk. A fully static site built with **Astro 7.2.3** + **Tailwind CSS 4.3.3** (CSS-first), with **@tailwindcss/typography** and **@astrojs/sitemap**. Content is markdown in Astro content collections, edited by committee members through **Sveltia CMS** at `/admin`. Hosted on **Cloudflare Pages** (static output, no SSR adapter — `dist/` is served directly). Package manager: **npm**. Node >= 22.

## Commands

```sh
npm install        # install dependencies
npm run dev        # dev server at http://localhost:4321
npm run build      # production build → dist/
npm run preview    # preview the built site locally
npx astro check    # type-check (content schemas, components)
```

Always run `npm run build` (and ideally `npx astro check`) before finishing a change.

## Ground rules

1. **Design tokens live in `src/styles/global.css` (`@theme`) — never hardcode brand values.**
   Brand colours (off-white `#e9e9e9`, orange `#e08f20`, black `#000000`, gradient `#1c1c1c → #111215`) and the Bebas Neue font are defined once, as Tailwind `@theme` tokens (`--color-brand`, `--color-offwhite`, `--font-display`, …) plus the `.bg-brand-gradient` / `.bg-brand-glow` utilities. Use the tokens (`bg-brand`, `text-offwhite`, `font-display`, …) in components and pages. Do **not** add hardcoded hex values, font stacks, or new colours inline. If a new token is genuinely needed, add it to `@theme` first.

2. **Content lives in `src/content/*` with schemas in `src/content.config.ts`.**
   - `src/content/committee/*.md` — name (req), role (req), ign, photo, socials
   - `src/content/events/*.md` — title (req), date (req, YYYY-MM-DD), endDate, location, game, image, link, description + markdown body
   - `src/content/news/*.md` — title (req), date (req), author (default "Swansea Esports"), excerpt, image, draft (default false) + markdown body
   - `src/content/placements/*.md` — year (req, number), competition (req), game (req), medal (req "1st"/"2nd"/"3rd")
   - `src/content/rankings/*.md` — season (req), placement (req), order (number, sort key)
   - `src/content/reps/*.md` — game (req), name (req, "TBC" if vacant), ign
   `src/content.config.ts` (glob loaders + zod schemas) is the source of truth for fields. **Keep `public/admin/config.yml` (Sveltia CMS) in sync** whenever collections or fields change — the CMS editor must match the schemas. Filter `draft: true` news posts out of listings and detail routes.

3. **Never commit `dist/`.** It is git-ignored build output; Cloudflare Pages builds it from source.

4. **Central config:** site metadata, nav, socials, competitions, and links live in `src/site.config.ts` (name "Swansea University Esports", URL https://swanseauniesports.co.uk, handle SwanseaGG, Discord/Instagram/Twitter/Twitch/Steam/Merch/SU links, NUEL + NSE competitions). Add or change links there, not in components.

5. **Brand assets:** fonts in `public/fonts/` (Bebas Neue Regular + Bold, bundled — no CDN), logos in `public/brand/` (`swan-head.png` square mark, `swan-wide.png` wide swan, `logo-crest.png` full crest), favicon `public/favicon.png`.

## Content editing / CMS note

The committee edits content via Sveltia CMS at `/admin` (`public/admin/index.html` + `public/admin/config.yml`). Each save commits markdown to the GitHub repo and Cloudflare Pages auto-rebuilds. Auth uses the `sveltia-cms-auth` Cloudflare Worker with a fine-grained GitHub PAT set as a Pages secret. The `backend.repo` value in `config.yml` is a placeholder until the society repo exists. See DEPLOY.md for the full runbook.

## Admin API / news wizard note

`functions/` holds **Cloudflare Pages Functions** (Pages Functions module syntax — the site stays `output: static`, no adapter needed; Functions co-deploy with the build): `functions/api/auth/{login,me,logout}.js` implement the single-admin login (email + password from secrets, HMAC-SHA256-signed HttpOnly session cookie) and `functions/api/news.js` validates a news post and commits it to GitHub via the Contents API, which triggers the Pages auto-rebuild. Shared helpers live in `functions/_lib/` (underscore-prefixed = not routed). The step-based news wizard is `src/pages/admin/new.astro` → `/admin/new`. Local secrets live in **`.dev.vars`** (git-ignored — never commit it); set the same variables as Pages secrets for production. Test Functions locally with `npx wrangler pages dev dist` after `npm run build` — `astro dev` does not run Functions.

## Link-click analytics note

The site tracks link clicks (per-link per-day, user-selectable range) via `functions/api/track.js` (public beacon ingest → D1 `clicks` table, bot-filtered + per-IP rate-capped) and `functions/api/analytics.js` (admin-auth'd `?days=X` pivot). Report UI at `/admin/analytics`; the client click handler lives in `src/layouts/BaseLayout.astro` (sendBeacon, `data-track` labels). D1 binding `track_db` (database `su-esports-track`) — see `docs/analytics.md` for deployment + label conventions.

## Docs

- `README.md` — overview, stack, local dev, folder structure
- `CONTENT-EDITING.md` — guide for non-technical committee members
- `DEPLOY.md` — deploy runbook (domain, Cloudflare Pages, CMS auth)
- `SPEC.md` — site spec: pages, content model, design tokens, acceptance criteria
- `docs/analytics.md` — link-click tracker: how it works, D1 deployment, label conventions

Keep these docs accurate when you change the site.
