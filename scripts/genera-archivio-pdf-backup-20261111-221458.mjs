import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, 'pdf-generati');
const CONTENT = path.join(ROOT, 'src/content/articoli');
const ELENCO = path.join(ROOT, 'dist/elenco-articoli-pdf.json');
const MANIFEST = path.join(OUTPUT, 'manifest.json');
const STATO = path.join(OUTPUT, 'stato-generazione.json');

const articoli = JSON.parse(await fs.readFile(ELENCO, 'utf8'));

const manifest = JSON.parse(
  await fs.readFile(MANIFEST, 'utf8').catch(() => '{}')
);

const stato = JSON.parse(
  await fs.readFile(STATO, 'utf8').catch(() => '{}')
);

const limite = process.argv.includes('--prova') ? 1 : Infinity;
let elaborati = 0;

for (const articolo of articoli) {
  if (elaborati >= limite) break;

  const fileMd = path.join(CONTENT, articolo.id);
  const contenuto = await fs.readFile(fileMd, 'utf8');

  const hash = createHash('sha256')
    .update(contenuto)
    .digest('hex');

  const nomeBase = path.basename(fileMd, '.md')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90);

  const conFoto = `${nomeBase}-con-foto-da-md-ottimizzato.pdf`;
  const senzaFoto = `${nomeBase}-senza-foto-da-md-ottimizzato.pdf`;

  const presenti = await Promise.all(
    [conFoto, senzaFoto].map(async nome => {
      try {
        return (await fs.stat(path.join(OUTPUT, nome))).size > 0;
      } catch {
        return false;
      }
    })
  );

  if (stato[articolo.slug] === hash && presenti.every(Boolean)) {
    continue;
  }

  console.log('Generazione:', articolo.slug);

  const risultato = spawnSync('node', [
    'scripts/genera-pdf-da-md.mjs',
    fileMd,
    articolo.url
  ], {
    cwd: ROOT,
    stdio: 'inherit'
  });

  if (risultato.status !== 0) {
    throw new Error(`Generazione fallita: ${articolo.slug}`);
  }

  stato[articolo.slug] = hash;

  // I percorsi pubblici verranno attivati soltanto
  // dopo aver configurato l'accesso ai documenti.
  manifest[articolo.slug] = {
    fileConFoto: conFoto,
    fileSenzaFoto: senzaFoto
  };

  await fs.writeFile(STATO, JSON.stringify(stato, null, 2));
  await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 2));

  elaborati++;
}

console.log('Articoli elaborati:', elaborati);
