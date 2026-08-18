# Deploy runbook — Swansea Esports website

How the site gets from a local repo to the live site at **https://swanseauniesports.co.uk**.

**Architecture in one line:** a fully static Astro build (`npm run build` → `dist/`) served by **Cloudflare Pages**, connected to a **GitHub** repo, with content edited through **Sveltia CMS** at `/admin`. Every push to the repo's main branch triggers an automatic rebuild.

**Cost:** Cloudflare's free tier — unlimited static bandwidth and 500 builds/month. The domain is the only recurring cost.

---

## 0. Prerequisites

- A GitHub account with admin access to the site repository.
- A Cloudflare account with the domain **SwanseaUniEsports.co.uk** added to it (Cloudflare DNS).
- Node >= 22 and npm locally (for testing builds before pushing).

---

## 1. Register / set up the domain

1. Register **SwanseaUniEsports.co.uk** at a registrar of your choice (Cloudflare Registrar is easiest if you already use Cloudflare — domains are at cost).
2. Add the domain to your Cloudflare account (if it wasn't registered there) and point its nameservers at Cloudflare. Cloudflare issues HTTPS certificates automatically once DNS is active.

> ⚠️ **60-day transfer lock:** Cloudflare enforces the industry-standard 60-day lock on domain transfers. If the domain was recently registered or transferred, it cannot be moved to another registrar (including Cloudflare Registrar) until the lock expires. Register the domain well ahead of any deadline (e.g. before freshers), and if you're moving it to Cloudflare, do that at least 60 days before you need to make changes elsewhere.

3. The site's canonical URL is configured in `src/site.config.ts` (`url: "https://swanseauniesports.co.uk"`) and `astro.config.mjs` (`site:`). Keep these in sync with the actual domain.

---

## 2. Push the code to GitHub

1. Create a new GitHub repository for the site (e.g. `swansea-esports-website`). Private is fine — the CMS and Pages work with private repos.
2. Push the code from your machine:

```sh
cd /path/to/su-esports-website
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-org>/<repo>.git
git push -u origin main
```

3. Add the committee members who should edit content as **collaborators** (Settings → Collaborators) — they'll sign in to the CMS with their GitHub accounts. (Or add a team with write access.)

> `dist/` is git-ignored and must **never** be committed — Cloudflare Pages builds it for you.

---

## 3. Connect Cloudflare Pages

1. In the Cloudflare dashboard, go to **Workers & Pages → Create → Pages → Connect to Git**.
2. Authorise Cloudflare to access the GitHub repo, then select it.
3. Configure the build:

| Setting | Value |
| --- | --- |
| Framework preset | None (or Astro if offered) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | >= 22 (set in **Settings → Builds & deployments → Build configuration** if needed) |

4. Click **Save and Deploy**. The first build should complete and publish a `*.pages.dev` URL.

---

## 4. Add the custom domain + DNS

1. In the Pages project, go to **Custom domains → Set up a custom domain**.
2. Enter **SwanseaUniEsports.co.uk** and follow the wizard.
3. Cloudflare creates the DNS record automatically and enables **automatic HTTPS** (certificate issuance + renewal handled by Cloudflare — no action needed).
4. Verify `https://swanseauniesports.co.uk` loads and the sitemap is reachable at `/sitemap-index.xml`.

---

## 5. Set up Sveltia CMS authentication

The CMS lives at `/admin` (files: `public/admin/index.html` + `public/admin/config.yml`). Sveltia CMS is a git-based CMS — when a committee member saves a change, it commits markdown straight to the GitHub repo. That commit triggers the Cloudflare Pages auto-rebuild.

Auth uses the **`sveltia-cms-auth` Cloudflare Worker** with a **fine-grained GitHub Personal Access Token**:

1. **Deploy the auth worker.** Follow the Sveltia CMS docs for `sveltia-cms-auth` (the Cloudflare Worker that proxies GitHub authentication for the CMS). Deploy it to your Cloudflare account.
2. **Create a fine-grained GitHub PAT:**
   - GitHub → Settings → Developer settings → **Fine-grained personal access tokens** → Generate new token.
   - **Repository access:** the site repository only.
   - **Permissions → Contents:** **Read and write** (the CMS commits markdown as you).
3. **Set the PAT as a Pages secret.** In the Cloudflare Pages project → **Settings → Environment variables / secrets**, add the token as a secret (e.g. `GITHUB_TOKEN`) so the auth worker can use it on behalf of the CMS. (The exact variable name must match what the `sveltia-cms-auth` worker expects — see its docs.)
4. **Point the CMS at the repo.** In `public/admin/config.yml`, the `backend` block must name the GitHub repo and branch, and the auth worker URL:

```yaml
backend:
  name: github
  repo: <your-org>/<repo>        # ← fill in when the society repo exists
  branch: main
  base_url: https://<your-worker>.<account>.workers.dev  # sveltia-cms-auth worker URL
```

> ⚠️ The `repo` value is intentionally a placeholder right now — it gets filled in when the society's GitHub repository exists. `config.yml` must stay in sync with `src/content.config.ts` (collection names, fields, and field types) or the CMS editor will not match the site's content schemas.

5. **Test it:** go to `https://swanseauniesports.co.uk/admin`, sign in with a collaborator's GitHub account, make a tiny test edit (e.g. fix a typo in a news post), and save. Confirm the commit lands in GitHub and the site rebuilds.

### Admin news wizard — `/admin/new`

Alongside the Sveltia CMS at `/admin`, the site ships a step-based news wizard at **`/admin/new`** (source: `src/pages/admin/new.astro`) — a single-admin login (email + password) plus a 5-step article form, backed by **Cloudflare Pages Functions** in the repo's `functions/` directory. `POST /api/news` validates the post and commits it to GitHub via the Contents API — the same commit-triggers-rebuild loop as the CMS — so a published post appears on the site within a minute. The wizard page itself is public (it holds no secrets); the API is the security boundary, gated by an HMAC-signed HttpOnly session cookie.

Set these Pages secrets (Settings → Environment variables → add → mark as **secret**):

| Variable | Value |
| --- | --- |
| `ADMIN_EMAIL` | Admin login email, e.g. `esports@swansea-societies.co.uk` |
| `ADMIN_PASSWORD` | Admin login password (the single credential — keep it strong) |
| `AUTH_SECRET` | Random 32-byte hex used to sign session cookies (`openssl rand -hex 32`) |
| `GITHUB_TOKEN` | Fine-grained GitHub PAT with **Contents: Read and write** on the site repo (can be the same token the CMS auth uses) |
| `GITHUB_OWNER` | GitHub owner of the site repo, e.g. `SwanseaUniEsports` |
| `GITHUB_REPO` | GitHub repo name, e.g. `su-esports-website` |

Locally these live in **`.dev.vars`** (git-ignored). Test the full stack with `npm run build` then `npx wrangler pages dev dist` — `astro dev` does not run Functions.

---

## 6. Enable auto-deploy

Auto-deploy is on by default once Pages is connected to Git: **every push to `main`** (including CMS commits) triggers a new build with the settings from step 3.

- **Deployment log:** Pages project → **Deployments**.
- **Rollback:** any previous deployment can be rolled back to from the same screen.
- **Builds limit:** the free tier includes **500 builds/month** — CMS edits and pushes count, so this is far more than enough for normal committee use.
- **Bandwidth:** free tier = **unlimited static bandwidth** — no per-visitor cost, even during freshers spikes.

---

## 7. Post-deploy checklist

- [ ] `https://swanseauniesports.co.uk` serves the site over HTTPS (auto cert).
- [ ] `/admin` loads and signs in with a GitHub collaborator account.
- [ ] A test save commits to GitHub and auto-rebuilds the site.
- [ ] `/sitemap-index.xml` exists (generated by `@astrojs/sitemap`).
- [ ] Redirects/404 page work (a custom `404.html` is part of the build).
- [ ] `src/site.config.ts` URL, `astro.config.mjs` site, and the Pages custom domain all agree.

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| Build fails | Run `npm run build` locally — fix and push again. Check the Node version in Pages build config (needs >= 22). |
| `/admin` won't sign in | Auth worker not deployed, PAT missing/expired, or the collaborator isn't in the GitHub repo. Check the Pages secret and the worker's logs. |
| CMS saves but site doesn't update | Repo/branch mismatch in `config.yml` `backend`, or the commit landed on a different branch. |
| Certificate errors | Cloudflare auto-HTTPS needs the domain on Cloudflare DNS. Give it a few minutes, then check **SSL/TLS** settings. |
