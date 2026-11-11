import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async () => {
  const articoli = await getCollection('articoli');

  const elenco = articoli.map(articolo => ({
    id: articolo.id,
    slug: articolo.slug,
    url: new URL(
      `/articoli/${articolo.slug}`,
      'https://ilblogdilujanta.eu'
    ).toString()
  }));

  return new Response(JSON.stringify(elenco, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
};
