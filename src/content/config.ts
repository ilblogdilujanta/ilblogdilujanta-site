// src/content/config.ts
import { defineCollection, z } from "astro:content";

const articoli = defineCollection({
  schema: z.object({
    title: z.string(),
    date: z.date(),
    sentieri: z.array(z.string()).optional(),
    cover: z.string().optional(),

    // ✅ per la mappa
    luogo: z.string().optional(), // nome “umano” del luogo
    lat: z.number().optional(),
    lng: z.number().optional(),
  }),
});

export const collections = { articoli };
