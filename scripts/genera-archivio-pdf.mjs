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


function centraPDF(nomeFile) {
  const sorgente = path.join(OUTPUT, nomeFile);
  const centrato = sorgente.replace(/\.pdf$/i, '-centrato.pdf');

  const risultato = spawnSync('python3', [
    'scripts/centra_foto_isolate.py',
    sorgente
  ], {
    cwd: ROOT,
    stdio: 'inherit'
  });

  if (risultato.status !== 0) {
    throw new Error(`Centratura fallita: ${nomeFile}`);
  }

  return centrato;
}

for (const articolo of articoli) {
  if (elaborati >= limite) break;

  const fileMd = path.join(CONTENT, articolo.id);
  const contenuto = await fs.readFile(fileMd, 'utf8');

  const generatore = await fs.readFile(
    path.join(ROOT, 'scripts/genera-pdf-da-md.mjs')
  );

  const cartellaImmagini = path.join(ROOT, 'public/immagini');
  const immagini = [];

  async function visitaImmagini(dir) {
    try {
      const voci = await fs.readdir(dir, { withFileTypes: true });

      for (const voce of voci) {
        const percorso = path.join(dir, voce.name);

        if (voce.isDirectory()) {
          await visitaImmagini(percorso);
        } else if (/\.(jpg|jpeg|png|webp|gif|svg)$/i.test(voce.name)) {
          const info = await fs.stat(percorso);
          immagini.push(
            `${path.relative(ROOT, percorso)}:${info.size}:${info.mtimeMs}`
          );
        }
      }
    } catch (errore) {
      if (errore.code !== 'ENOENT') throw errore;
    }
  }

  await visitaImmagini(cartellaImmagini);
  immagini.sort();

  const hash = createHash('sha256')
    .update(contenuto)
    .update(generatore)
    .update(articolo.url)
    .update(immagini.join('\n'))
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

  const pdfConFotoDefinitivo = path.join(
    OUTPUT,
    conFoto.replace(/\.pdf$/i, '-centrato.pdf')
  );

  const centratoEsiste = await fs.access(pdfConFotoDefinitivo)
    .then(() => true)
    .catch(() => false);

  if (stato[articolo.slug] === hash && presenti.every(Boolean) && centratoEsiste) {
    const cartellaPubblica = path.join(ROOT, 'public/pdf');
    await fs.mkdir(cartellaPubblica, { recursive: true });

    const destinazioneConFoto = `${nomeBase}-con-foto.pdf`;
    const destinazioneSenzaFoto = `${nomeBase}-senza-foto.pdf`;

    await fs.copyFile(
      pdfConFotoDefinitivo,
      path.join(cartellaPubblica, destinazioneConFoto)
    );

    await fs.copyFile(
      path.join(OUTPUT, senzaFoto),
      path.join(cartellaPubblica, destinazioneSenzaFoto)
    );

    manifest[articolo.slug] = {
      conFoto: `/pdf/${destinazioneConFoto}`,
      senzaFoto: `/pdf/${destinazioneSenzaFoto}`
    };

    await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 2));
    console.log('PDF già pronti:', articolo.slug);
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

  centraPDF(conFoto);

  // Copia i PDF ottimizzati nella cartella del sito.
  const cartellaPubblica = path.join(ROOT, 'public/pdf');
  await fs.mkdir(cartellaPubblica, { recursive: true });

  const destinazioneConFoto = `${nomeBase}-con-foto.pdf`;
  const destinazioneSenzaFoto = `${nomeBase}-senza-foto.pdf`;

  await fs.copyFile(
    pdfConFotoDefinitivo,
    path.join(cartellaPubblica, destinazioneConFoto)
  );

  await fs.copyFile(
    path.join(OUTPUT, senzaFoto),
    path.join(cartellaPubblica, destinazioneSenzaFoto)
  );

  manifest[articolo.slug] = {
    conFoto: `/pdf/${destinazioneConFoto}`,
    senzaFoto: `/pdf/${destinazioneSenzaFoto}`
  };

  stato[articolo.slug] = hash;

  await fs.writeFile(STATO, JSON.stringify(stato, null, 2));
  await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 2));

  elaborati++;
}

console.log('Articoli elaborati:', elaborati);
