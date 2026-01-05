import { defineCollection, z } from "astro:content";

const articoli = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),                 // accetta "2016-01-24" e lo converte in Date
    sentieri: z.array(z.string()).default([]),
  }),
});

export const collections = { articoli };
