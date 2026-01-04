import { defineCollection, z } from "astro:content";

const articoli = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    // Astro accetta anche date come stringa ISO, ma qui forziamo Date per evitare unknown
    date: z.coerce.date(),
    sentieri: z.array(z.string()).default([]),
  }),
});

export const collections = {
  articoli,
};
