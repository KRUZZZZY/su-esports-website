# Editing the website — a guide for the committee

This guide is for **non-technical committee members**. You do not need to know how to code, use Git, or touch any files. Everything happens in a web browser.

The website is edited in your browser — no code, Git, or files. **News posts and events** are written in the **admin editor** at **`/admin/new`** (sign in with the committee email and password). Everything else (committee, game reps, achievements, rankings) is edited in **Sveltia CMS** at **`/admin`** (sign in with GitHub).

---

## 1. Logging in

1. **News and events** — go to **`https://swanseauniesports.co.uk/admin/new`** and sign in with the committee **email and password** (the person who set up the site gives you these). There are two accounts: **admin** (can write *and* publish) and **editor** (can write and save drafts).
2. **Everything else** (committee, game reps, achievements, rankings) — go to **`https://swanseauniesports.co.uk/admin`** and **sign in with GitHub**. Use the GitHub account that a committee member has invited to the website's repository.

> **First time?** For the admin editor, ask the website manager for the committee login. If Sveltia sign-in errors, the website manager needs to add your GitHub username to the site's GitHub repository (Settings → Collaborators, or a team invite). Both are 2-minute jobs.

## 2. The content types

The site has six things you can edit:

| Section | What it's for | Example |
| --- | --- | --- |
| **Committee** | Committee members shown on the Committee page | "Sam Briggs — President" |
| **Game Reps** | Game representatives on the Committee page | "Zack Lee — League of Legends" |
| **Events** | A tournament, LAN, or social shown on the Events page | "Valentine's LAN — 14 Feb" |
| **News** | A post shown on the News page | "Welcome to the new website" |
| **Achievements** | Competitive placements shown on the Achievements page | "NSE Spring 2025 — 1st, Valorant" |
| **Season Rankings** | Season standings on the Achievements page | "2024/2025 — 3rd Overall NSE" |

Everything else on the site (pages, styling, links in the footer) is handled by the developers and should **not** be edited here.

## 3. Adding or editing a committee member or game rep

The Committee page shows the society's committee and game reps, each with their name, in-game name, role, and photo.

1. In the CMS, click **Committee** or **Game Reps** in the sidebar.
2. To **edit** someone: click their name.
3. To **add** someone: click the **New** (or "+") button.
4. Fill in the fields:

| Field | Needed? | What to put |
| --- | --- | --- |
| **Name** | ✅ Required | Their real name. |
| **IGN** | Optional | Their in-game name / gamertag (e.g. "Jev"). |
| **Role / Game** | ✅ Required | Their committee role (e.g. "President", "Social Secretary") — for game reps, the game they rep instead (e.g. "League of Legends"). |
| **Photo** | Optional | A photo of them. Click to upload — the image goes into the site automatically. |
| **Socials** | Optional | A link to their profile, e.g. a Twitch or Twitter URL. |

5. Click **Save** (or **Publish**). The Committee page updates a minute or so later.

## 4. Adding or editing an event

Events are written in the **admin editor**:

1. Sign in at `/admin/new` and click **＋ New event** (or **Edit** on an existing card).
2. A small dialog asks for the event **name** and **organiser** — fill both and click **Create draft**. You land in the editor.
3. Fill in the fields:

| Field | Needed? | What to put |
| --- | --- | --- |
| **Title** | ✅ Required | Event name, e.g. "Valentine's LAN". |
| **Publish date & time** | ✅ Required | When the event appears on the site (if Ready is ticked). Use the date-time picker. |
| **Start date** | Optional | When the event actually happens — upcoming/past is split by this. |
| **End date** | Optional | Only if the event runs over multiple days. |
| **Organiser** | Optional | Who's running it, e.g. "Lewis Dasilva". |
| **Location** | Optional | Where it is, e.g. "Union Building, Swansea University". |
| **Game** | Optional | The game(s), e.g. "Multi-game", "Rocket League". |
| **Link** | Optional | A sign-up or info link (e.g. a Discord event or NUEL page). |
| **Description** | Optional | A short line shown on the events listing, e.g. "Our mid-season in-person LAN." |
| **Intro image** | Optional | The big image at the top of the event page. Defaults to the swan banner if blank. |
| **Thumbnail** | Optional | The card image, cropped to 16:9. |
| **Ready** | Optional | The publish gate — the event goes live automatically at the publish date & time. Admins only. |
| **Body** | Optional | The main text of the event page. Built from blocks: **Add text block** for writing, **Add image block** for pictures (with a size selector). |

4. Click **Save** (saving is explicit — nothing auto-saves). While **Ready** is off, the event stays a private draft; an admin ticks **Ready** and it goes live when the publish time arrives.

## 5. Adding or editing a news post

News posts are written in the **admin editor**:

1. Sign in at `/admin/new` and click **＋ New news post** (or **Edit** on an existing card).
2. A small dialog asks for the post **name** and **author** — fill both and click **Create draft**. You land in the editor.
3. Fill in the fields:

| Field | Needed? | What to put |
| --- | --- | --- |
| **Title** | ✅ Required | Headline, e.g. "OWCS Season Recap". |
| **Publish date & time** | ✅ Required | When the post goes live (if Ready is ticked). |
| **Author** | Optional | Who wrote it. **If you leave it blank it defaults to "Swansea Esports".** |
| **Category** | Optional | A badge on the card, e.g. "Announcement", "Match Report". |
| **Introduction** | Optional | One or two sentences shown at the top of the article. Max 300 characters. |
| **Teaser** | Optional | A short hook shown on the News card. Max 120 characters. If blank, the card falls back to the introduction. |
| **Intro image** | Optional | The big image at the top of the article. Defaults to the swan banner if blank. |
| **Thumbnail** | Optional | The card image, cropped to 16:9. |
| **Ready** | Optional | The publish gate — the post goes live automatically at the publish date & time. Admins only. |
| **Body** | ✅ (in practice) | The full article. Built from blocks: **Add text block** for writing (toolbar for bold, links, headings), **Add image block** for pictures. |

4. Click **Save** (saving is explicit — nothing auto-saves). While **Ready** is off, the post stays a private draft; an admin ticks **Ready** and it goes live when the publish time arrives.

## 6. Publishing — how it actually works

Don't worry about the technical side, but it helps to know what happens when you hit **Save**:

1. Your change is saved as a text file (markdown) in the website's GitHub repository.
2. The hosting service (Cloudflare Pages) notices the change and automatically rebuilds the site.
3. Within a minute or two, the change is **live** on <https://swanseauniesports.co.uk> — *if* it's published.

News and events use a **publish gate**: while **Ready** is off, the article is a private draft. When an admin ticks **Ready**, the article goes live automatically once the **publish date & time** arrives (you can schedule posts this way). Editors can write and save; **only admins can publish**.

## 7. Useful tips

- **Changes take a minute or two** to appear. Refresh the live site after a short wait — don't panic if it's not instant.
- **Photos:** at least 800px wide is best (the editor rejects images under 400px) and keep them under 5MB. Uploads are converted to WebP automatically, which keeps the site fast.
- **Dates:** the admin editor gives you a date-time picker — no need to type dates by hand.
- **Links:** paste full URLs, e.g. `https://discord.gg/...`.
- **Made a mistake?** You can go back into the item, fix it, and save again. If you need to undo something that's already published, ask a developer — the site's Git history keeps every version.
- **Need to remove something?** Use the delete option on the item in the CMS. If in doubt, ask a developer.

## 8. Still stuck?

Contact the person who manages the website (ask on the society Discord, **@SwanseaGG**). Common fixes they can do in minutes:

- Give you the committee admin/editor login for the admin editor.
- Add you to the GitHub repo so you can sign in to Sveltia.
- Re-invite you if sign-in stops working.
- Fix anything that looks broken on the live site.
