// src/content/config.ts
import { defineCollection, z } from "astro:content";

const articoli = defineCollection({
  schema: z.object({
    title: z.string(),
    date: z.date(),
    sentieri: z.array(z.string()).optional(),
    cover: z.string().optional(), // ✅ aggiungi questo
  }),
});

export const collections = { articoli };

