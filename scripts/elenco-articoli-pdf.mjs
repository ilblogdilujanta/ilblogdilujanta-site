import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';

const ROOT = process.cwd();

const server = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  appType: 'custom',
  plugins: [
    {
      name: 'astro-content-loader',
      async buildStart() {}
    }
  ]
});

try {
  const files = [];

  async function visita(dir) {
    for (const voce of await fs.readdir(dir, { withFileTypes: true })) {
      const percorso = path.join(dir, voce.name);
      if (voce.isDirectory()) {
        await visita(percorso);
      } else if (voce.name.endsWith('.md')) {
        files.push(percorso);
      }
    }
  }

  await visita(path.join(ROOT, 'src/content/articoli'));

  console.log(`Articoli Markdown trovati: ${files.length}`);
} finally {
  await server.close();
}
