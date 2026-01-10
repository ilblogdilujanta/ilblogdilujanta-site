// src/content/config.ts
import { defineCollection, z } from "astro:content";

const articoli = defineCollection({
  schema: z.object({
    title: z.string(),

    date: z
  .union([z.string(), z.date()])
  .transform((value) => {
    if (value instanceof Date) return value;
    // se manca timezone, aggiungo Z (UTC) per renderla ISO valida
    const v = value.match(/Z|[+\-]\d\d:\d\d$/) ? value : `${value}Z`;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) throw new Error("Invalid date");
    return d;
  }),


    // Sentieri (facoltativi)
    sentieri: z.array(z.string()).optional(),

    // Cover (facoltativa)
    cover: z.string().optional(),

    // ===== MAPPA (facoltativi) =====
    luogo: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
  }),
});

export const collections = { articoli };
