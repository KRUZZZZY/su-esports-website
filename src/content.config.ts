import { defineCollection } from "astro:content";
import { z } from "zod";
import { glob } from "astro/loaders";

const committee = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/committee" }),
  schema: z.object({
    name: z.string(),
    role: z.string(),
    ign: z.string().optional(),
    photo: z.string().optional(),
    bio: z.string().optional(),
    socials: z.string().optional(),
    order: z.coerce.number().default(99)
  })
});

const reps = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/reps" }),
  schema: z.object({
    game: z.string(),
    name: z.string(),
    ign: z.string().optional(),
    photo: z.string().optional(),
    bio: z.string().optional()
  })
});

const events = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/events" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(), // publish date (gate: live when ready && now >= date)
    startDate: z.coerce.date().optional(), // when the event actually starts
    endDate: z.coerce.date().optional(),
    location: z.string().optional(),
    game: z.string().optional(),
    image: z.string().optional(), // intro/hero image (defaults to swan-wide)
    thumbnail: z.string().optional(), // card image (cropped)
    link: z.string().optional(),
    description: z.string().optional(),
    organiser: z.string().optional(),
    draft: z.boolean().default(false),
    ready: z.boolean().default(false),
    sponsored: z.boolean().default(false)
  })
});

const news = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/news" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(), // publish date (gate: live when ready && now >= date)
    author: z.string().default("Swansea Esports"),
    category: z.string().optional(),
    // intro = shown on the article (max 300 chars); teaser = card text (max 120).
    intro: z.string().optional(),
    teaser: z.string().optional(),
    image: z.string().optional(), // intro/hero image (defaults to swan-wide)
    thumbnail: z.string().optional(), // card image (cropped)
    draft: z.boolean().default(false),
    ready: z.boolean().default(false),
    sponsored: z.boolean().default(false)
  })
});

const placements = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/placements" }),
  schema: z.object({
    year: z.coerce.number(),
    competition: z.string(),
    game: z.string(),
    medal: z.string()
  })
});

const rankings = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/rankings" }),
  schema: z.object({
    season: z.string(),
    placement: z.string(),
    order: z.coerce.number().default(99)
  })
});

export const collections = { committee, reps, events, news, placements, rankings };
