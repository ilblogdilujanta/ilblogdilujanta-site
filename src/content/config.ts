// src/content/config.ts
import { defineCollection, z } from "astro:content";

const articoli = defineCollection({
  schema: z.object({
    title: z.string(),
    date: z.date(),
    sentieri: z.array(z.string()).optional(),
    cover: z.string().optional(),

    luogo: z
      .object({
        nome: z.string(),
        lat: z.number(),
        lng: z.number(),
      })
      .optional(),
  }),
});

export const collections = { articoli };
