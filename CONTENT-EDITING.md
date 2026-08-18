# Editing the website — a guide for the committee

This guide is for **non-technical committee members**. You do not need to know how to code, use Git, or touch any files. Everything happens in a web browser.

The website is powered by **Sveltia CMS** — an editing panel that looks like a normal website admin area. When you save a change, it is published automatically. No emails to a webmaster, no waiting.

---

## 1. Logging in

1. Open your browser and go to **`https://swanseauniesports.co.uk/admin`**.
2. You'll be asked to **sign in with GitHub**. Use the GitHub account that a committee member (the person who set up the site) has invited to the website's repository.
3. After signing in you'll see the editor with three content sections: **Roster**, **Events**, and **News**.

> **First time?** If you get an error at sign-in, the committee member who manages the website needs to add your GitHub username to the site's GitHub repository (Settings → Collaborators, or a team invite). Ask them — it's a 2-minute job.

## 2. The three content types

The site has exactly three things you can edit:

| Section | What it's for | Example |
| --- | --- | --- |
| **Roster** | A player or committee member shown on the Roster page | "Jamie Evans — Top Lane, League of Legends" |
| **Events** | A tournament, LAN, or social shown on the Events page | "Valentine's LAN — 14 Feb" |
| **News** | A post shown on the News page | "Welcome to the new website" |

Everything else on the site (pages, styling, links in the footer) is handled by the developers and should **not** be edited here.

## 3. Adding or editing a roster member

The Roster page shows the society's players (and/or committee), each with their name, in-game name, game, and role.

1. In the CMS, click **Roster** in the sidebar.
2. To **edit** someone: click their name.
3. To **add** someone: click the **New Roster** (or "+") button.
4. Fill in the fields:

| Field | Needed? | What to put |
| --- | --- | --- |
| **Name** | ✅ Required | Their real name. |
| **IGN** | Optional | Their in-game name / gamertag (e.g. "Jev"). |
| **Game** | ✅ Required | Which game they play (e.g. "League of Legends"). |
| **Role** | ✅ Required | Their role or position (e.g. "Top Lane", "Captain", "Social Secretary"). |
| **Photo** | Optional | A photo of them. Click to upload — the image goes into the site automatically. |
| **Socials** | Optional | A link to their profile, e.g. a Twitch or Twitter URL. |

5. Click **Save** (or **Publish**). The Roster page updates a minute or so later.

## 4. Adding or editing an event

1. Click **Events** in the sidebar.
2. **Edit** an existing event by clicking it, or click **New Event** to add one.
3. Fill in the fields:

| Field | Needed? | What to put |
| --- | --- | --- |
| **Title** | ✅ Required | Event name, e.g. "Valentine's LAN". |
| **Date** | ✅ Required | The date of the event, in `YYYY-MM-DD` format (year-month-day), e.g. `2026-02-14`. The editor gives you a date picker, so you usually don't type this. |
| **End Date** | Optional | Only if the event runs over multiple days. |
| **Location** | Optional | Where it is, e.g. "Union Building, Swansea University". |
| **Game** | Optional | The game(s), e.g. "Multi-game", "Rocket League". |
| **Link** | Optional | A sign-up or info link (e.g. a Discord event or NUEL page). |
| **Description** | Optional | A short line shown on the events listing, e.g. "Our mid-season in-person LAN." |
| **Body** | Optional | The main text of the event page. You can write normally and use the toolbar for bold, links, lists, etc. |

4. Click **Save**. Done.

## 5. Adding or editing a news post

1. Click **News** in the sidebar.
2. **Edit** an existing post by clicking it, or click **New Post** to add one.
3. Fill in the fields:

| Field | Needed? | What to put |
| --- | --- | --- |
| **Title** | ✅ Required | Headline, e.g. "OWCS Season Recap". |
| **Date** | ✅ Required | Publish date, `YYYY-MM-DD`. |
| **Author** | Optional | Who wrote it. **If you leave it blank it defaults to "Swansea Esports".** |
| **Excerpt** | Optional | A one- or two-line summary shown on the News listing. If blank, the site shows the start of the post. |
| **Image** | Optional | A cover image. Click to upload. |
| **Draft** | Optional | Leave **off** to publish, or switch **on** to save a draft that is *not* shown on the live site. |
| **Body** | ✅ (in practice) | The full article. Use the toolbar for headings, bold, links, lists. |

4. Click **Save** (to publish) — or save with **Draft** switched on if it's not ready yet.

## 6. Publishing — how it actually works

Don't worry about the technical side, but it helps to know what happens when you hit **Save**:

1. Your change is saved as a text file (markdown) in the website's GitHub repository.
2. The hosting service (Cloudflare Pages) notices the change and automatically rebuilds the site.
3. Within a minute or two, the change is **live** on <https://swanseauniesports.co.uk>.

There is no separate "publish" step (except the **Draft** switch for news posts). Saving = publishing.

## 7. Useful tips

- **Changes take a minute or two** to appear. Refresh the live site after a short wait — don't panic if it's not instant.
- **Photos:** keep them reasonably sized (a few MB max). Very large photos slow the site down.
- **Dates:** always `YYYY-MM-DD` (e.g. `2026-02-14`). The date picker handles this for you.
- **Links:** paste full URLs, e.g. `https://discord.gg/...`.
- **Made a mistake?** You can go back into the item, fix it, and save again. If you need to undo something that's already published, ask a developer — the site's Git history keeps every version.
- **Need to remove something?** Use the delete option on the item in the CMS. If in doubt, ask a developer.

## 8. Still stuck?

Contact the person who manages the website (ask on the society Discord, **@SwanseaGG**). Common fixes they can do in minutes:

- Add you to the GitHub repo so you can sign in.
- Re-invite you if sign-in stops working.
- Fix anything that looks broken on the live site.
