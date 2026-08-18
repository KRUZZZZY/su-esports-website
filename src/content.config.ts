import { defineCollection } from "astro:content";
import { z } from "zod";
import { glob } from "astro/loaders";

const roster = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/roster" }),
  schema: z.object({
    name: z.string(),
    ign: z.string().optional(), // in-game name / gamertag
    game: z.string(),
    role: z.string(),
    photo: z.string().optional(),
    socials: z.string().optional()
  })
});

const committee = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/committee" }),
  schema: z.object({
    name: z.string(),
    role: z.string(),
    ign: z.string().optional(),
    photo: z.string().optional(),
    socials: z.string().optional()
  })
});

const reps = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/reps" }),
  schema: z.object({
    game: z.string(),
    name: z.string(),
    ign: z.string().optional()
  })
});

const events = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/events" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    location: z.string().optional(),
    game: z.string().optional(),
    image: z.string().optional(),
    link: z.string().optional(),
    description: z.string().optional()
  })
});

const news = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/news" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    author: z.string().default("Swansea Esports"),
    excerpt: z.string().optional(),
    image: z.string().optional(),
    draft: z.boolean().default(false)
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

export const collections = { roster, committee, reps, events, news, placements, rankings };
