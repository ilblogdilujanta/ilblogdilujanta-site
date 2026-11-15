import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';

const ROOT = process.cwd();
const CARTELLA = path.join(ROOT, 'pdf-generati');
const PUBLIC = path.join(ROOT, 'public');

const cartellaArticoli = path.join(
  ROOT,
  'src/content/articoli/2023'
);

const nomiArticoli = await fs.readdir(cartellaArticoli);

const nomeArticolo = nomiArticoli.find(nome =>
  nome.endsWith('.md') &&
  nome.toLowerCase().includes('santo stefano')
);

if (!nomeArticolo) {
  throw new Error('Markdown di Santo Stefano non trovato');
}

const ARTICOLO = path.join(
  cartellaArticoli,
  nomeArticolo
);

console.log('Markdown trovato:', nomeArticolo);

const URL_ARTICOLO = 'https://ilblogdilujanta.eu/articoli/2023/12023-santo-stefano--la-radice-pagana-e-stregonica-di-uno-dei-più-bei-luoghi-del-trentino/';

const BASE = 'santo-stefano';

await fs.mkdir(CARTELLA, { recursive: true });

function metadato(testo, nome) {
  const riga = testo.split(/\r?\n/).find(
    r => r.startsWith(nome + ':')
  );

  if (!riga) return '';

  return riga.slice(nome.length + 1)
    .trim()
    .replace(/^["']|["']$/g, '');
}

function escapeHTML(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const sorgente = await fs.readFile(ARTICOLO, 'utf8');

const frontmatter = sorgente.match(
  /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n/
);

if (!frontmatter) {
  throw new Error('Frontmatter Markdown non trovato');
}

const titolo = metadato(frontmatter[1], 'title');
const sottotitolo = metadato(frontmatter[1], 'subtitle');
const dataOriginale = metadato(frontmatter[1], 'date');

const corpoMarkdown = sorgente.slice(frontmatter[0].length);

const processor = await createMarkdownProcessor({
  syntaxHighlight: false,
  gfm: true
});

const risultato = await processor.render(corpoMarkdown);
const corpoHTML = risultato.code;

const dataNormalizzata = dataOriginale.replace(
  /^(\d{4})-(\d{1,2})-(\d{1,2})(?=T|$)/,
  (_, anno, mese, giorno) =>
    `${anno}-${mese.padStart(2, '0')}-${giorno.padStart(2, '0')}`
);
const data = new Date(dataNormalizzata);
const dataFormattata = Number.isNaN(data.getTime())
  ? dataOriginale
  : new Intl.DateTimeFormat('it-IT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(data);

const stile = `
@page {
  size: A4;
  margin: 20mm 18mm 20mm 18mm;
}

* {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  padding: 0;
  background: white;
  color: #000;
}

body {
  font-family: "Baskerville Old Face", Georgia, serif;
  font-size: 14pt;
  line-height: 1.5;
}

h1 {
  font-size: 26pt;
  line-height: 1.2;
  font-weight: normal;
  color: #174A32;
  text-align: center;
  margin: 0 0 15pt;
}

.subtitle, .date {
  text-align: center;
  font-size: 14pt;
  margin: 0 0 10pt;
}

.pdf-originale {
  font-size: 14pt;
  line-height: 1.4;
  margin: 14pt 0 22pt;
  overflow-wrap: anywhere;
}

.pdf-originale a {
  color: #000;
  text-decoration: underline;
}

.content {
  font-size: 14pt;
  line-height: 1.5;
}

.content p {
  margin: 0 0 12pt;
  orphans: 3;
  widows: 3;
}

.content h2,
.content h3,
.content h4 {
  break-after: avoid-page;
}

.content figure {
  display: block;
  margin: 12pt auto 20pt;
  padding: 0;
  width: 100%;
  text-align: center;
  break-inside: avoid-page;
}

.content figure img {
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 135mm;
  object-fit: contain;
  margin: 0 auto;
  box-shadow: none;
}

.content figcaption {
  display: block;
  color: #000;
  font-size: 14pt;
  line-height: 1.4;
  text-align: center;
  margin: 8pt 0 0;
  break-before: avoid-page;
}

.content figure.pdf-gruppo {
  break-inside: avoid-page;
  page-break-inside: avoid;
}

.content .pdf-griglia {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8pt;
  justify-items: center;
  align-items: center;
}

.content .pdf-griglia img {
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 78mm;
  object-fit: contain;
}

.content figure.pdf-gruppo[data-count="5"] .pdf-griglia img,
.content figure.pdf-gruppo[data-count="6"] .pdf-griglia img {
  max-height: 50mm;
}

.content figure.pdf-gruppo[data-count="2"] .pdf-griglia {
  grid-template-columns: 1fr;
}

.content figure.pdf-gruppo[data-count="2"] .pdf-griglia img {
  max-height: 82mm;
}

.content figure.pdf-gruppo figcaption {
  margin-top: 9pt;
}

.content img:not(figure img) {
  display: block;
  max-width: 100%;
  max-height: 135mm;
  width: auto;
  height: auto;
  margin: 12pt auto;
}

.pdf-video {
  display: block;
  width: 115mm;
  max-width: 100%;
  margin: 15pt auto;
  text-align: center;
  break-inside: avoid-page;
}

.pdf-video img {
  display: block;
  width: 100%;
  height: auto;
}

.pdf-video a {
  color: #000;
  text-decoration: underline;
}

.pdf-senza-foto figure,
.pdf-senza-foto .foto-singola {
  display: none !important;
}

a {
  overflow-wrap: anywhere;
}


/* IMPAGINAZIONE FOTOGRAFICA GENERALE */

.content figure {
  margin: 12pt auto 20pt !important;
  text-align: center !important;
  break-inside: avoid-page !important;
  page-break-inside: avoid !important;
}

.content figure:not(.pdf-gruppo) img {
  max-height: 125mm !important;
}

.content figure.pdf-gruppo .pdf-griglia {
  display: grid !important;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  gap: 9pt !important;
  align-items: center !important;
  justify-items: center !important;
}

.content figure.pdf-gruppo .pdf-griglia img {
  width: auto !important;
  height: auto !important;
  max-width: 100% !important;
  max-height: 73mm !important;
  object-fit: contain !important;
  margin: 0 auto !important;
}

.content figure.pdf-gruppo[data-count="2"] .pdf-griglia {
  grid-template-columns: 1fr !important;
}

.content figure.pdf-gruppo[data-count="2"] .pdf-griglia img {
  max-height: 91mm !important;
}

.content figure.pdf-gruppo[data-count="5"] .pdf-griglia img,
.content figure.pdf-gruppo[data-count="6"] .pdf-griglia img {
  max-height: 57mm !important;
}

.content figure.pdf-gruppo .pdf-griglia img:last-child:nth-child(odd) {
  grid-column: 1 / -1 !important;
  max-width: 48% !important;
}

.content figure figcaption {
  margin-top: 8pt !important;
  text-align: center !important;
  break-before: avoid-page !important;
}

.content h2,
.content h3,
.content h4 {
  break-after: avoid-page !important;
}

.content p {
  orphans: 3;
  widows: 3;
}

.content > p:empty {
  display: none;
}

`;

function documento(senzaFoto) {
  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">

<style>${stile}</style>
</head>
<body class="${senzaFoto ? 'pdf-senza-foto' : ''}">
<article>
<h1>${escapeHTML(titolo)}</h1>
${sottotitolo
  ? `<p class="subtitle">${escapeHTML(sottotitolo)}</p>`
  : ''}
<p class="date">${escapeHTML(dataFormattata)}</p>
<p class="pdf-originale">▦
<a href="${escapeHTML(URL_ARTICOLO)}">${escapeHTML(URL_ARTICOLO)}</a>
</p>
<div class="content">${corpoHTML}</div>
</article>
</body>
</html>`;
}

// Server locale: serve solo i file del progetto.
// Non recupera l'articolo dal sito pubblicato.
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');

    console.log('Richiesta locale:', url.pathname);

    if (url.pathname === '/con-foto' ||
        url.pathname === '/senza-foto') {
      const senzaFoto = url.pathname === '/senza-foto';

      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8'
      });

      res.end(documento(senzaFoto));
      return;
    }

    const relativa = decodeURIComponent(
      url.pathname
    ).replace(/^[/]+/, '');

    const fileRichiesto = path.resolve(PUBLIC, relativa);
    const relativo = path.relative(PUBLIC, fileRichiesto);

    if (
      relativo.startsWith('..') ||
      path.isAbsolute(relativo)
    ) {
      res.writeHead(403);
      res.end('Accesso negato');
      return;
    }

    const contenuto = await fs.readFile(fileRichiesto);
    const estensione = path.extname(fileRichiesto).toLowerCase();

    const mime = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml'
    };

    res.writeHead(200, {
      'Content-Type': mime[estensione] || 'application/octet-stream'
    });

    res.end(contenuto);

  } catch (errore) {
    console.error('Errore server:', errore.message);
    res.writeHead(404);
    res.end('File non trovato');
  }
});

await new Promise(resolve => server.listen(
  0, '127.0.0.1', resolve
));

const porta = server.address().port;
const browser = await chromium.launch({ headless: true });

async function preparaPagina(page, senzaFoto) {
  await page.evaluate((senzaFoto) => {
    const content = document.querySelector('.content');

    if (!content) {
      throw new Error(
        'Contenitore .content non trovato. ' +
        'Pagina caricata: ' + location.href
      );
    }

    // Elimina le didascalie vuote, senza
    // modificare quelle che contengono testo.
    content.querySelectorAll('figcaption').forEach(c => {
      if (!c.textContent.trim()) c.remove();
    });

    // Riconosce automaticamente i gruppi fotografici.
// Non sposta mai paragrafi contenenti testo.
    if (!senzaFoto) {
      const vuoto = el =>
        el &&
        (
          (el.tagName === 'P' &&
           !el.textContent.trim() &&
           !el.querySelector('img, iframe')) ||
          el.tagName === 'BR'
        );

      const fotografico = el =>
        el &&
        el.tagName === 'FIGURE' &&
        el.querySelector('img');

      let nodo = content.firstElementChild;

      while (nodo) {
        if (!fotografico(nodo)) {
          nodo = nodo.nextElementSibling;
          continue;
        }

        const gruppo = [nodo];
        const separatori = [];
        let corrente = nodo.nextElementSibling;

        while (corrente) {
          if (vuoto(corrente)) {
            separatori.push(corrente);
            corrente = corrente.nextElementSibling;
            continue;
          }

          if (fotografico(corrente)) {
            gruppo.push(corrente);
            corrente = corrente.nextElementSibling;
            continue;
          }

          break;
        }

        const immagini = gruppo.flatMap(f =>
          [...f.querySelectorAll('img')]
        );

        const didascalie = gruppo.flatMap(f =>
          [...f.querySelectorAll('figcaption')]
            .filter(c => c.textContent.trim())
        );

        const didascaliaFinale =
          didascalie.length === 1 &&
          gruppo.at(-1).contains(didascalie[0]);

        if (immagini.length > 1 && didascaliaFinale) {
          const contenitore = document.createElement('figure');
          contenitore.className = 'pdf-gruppo';
          contenitore.dataset.count = String(immagini.length);

          const griglia = document.createElement('div');
          griglia.className = 'pdf-griglia';

          immagini.forEach(img => griglia.append(img));

          contenitore.append(griglia);
          contenitore.append(didascalie[0]);

          gruppo[0].before(contenitore);
          gruppo.forEach(f => f.remove());
          separatori.forEach(el => el.remove());
        }

        nodo = corrente;
      }
    }

    
    // Riconosce anche gruppi di immagini già contenuti
    // in un unico figure, senza alterare testo o didascalie.
    if (!senzaFoto) {
      content.querySelectorAll('figure:not(.pdf-gruppo)').forEach(f => {
        const imgs = [...f.querySelectorAll('img')];
        if (imgs.length < 2) return;

        const figli = [...f.children];
        const strutturaSemplice = figli.every(el =>
          el.tagName === 'IMG' ||
          el.tagName === 'FIGCAPTION' ||
          (el.tagName === 'P' &&
           !el.textContent.trim() &&
           !el.querySelector('img'))
        );

        if (!strutturaSemplice) return;

        const griglia = document.createElement('div');
        griglia.className = 'pdf-griglia';

        imgs.forEach(img => griglia.append(img));

        f.prepend(griglia);
        f.classList.add('pdf-gruppo');
        f.dataset.count = String(imgs.length);
      });
    }

    // I video diventano collegamenti cliccabili.
    content.querySelectorAll('iframe').forEach(frame => {
      const src = frame.getAttribute('src') || '';
      const a = document.createElement('a');

      try {
        const u = new URL(src, location.href);
        const id = u.pathname.match(
          /\/(?:embed|shorts|live)\/([^/?]+)/
        )?.[1] || u.searchParams.get('v');

        if (id && /youtube/.test(u.hostname)) {
          a.href = `https://www.youtube.com/watch?v=${id}`;
          const img = document.createElement('img');
          img.src = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
          img.alt = 'Anteprima video YouTube';
          a.append(img);
        } else {
          a.href = u.href;
          a.textContent = 'Guarda il video';
        }
      } catch {
        a.href = '#';
        a.textContent = 'Video';
      }

      const box = document.createElement('div');
      box.className = 'pdf-video';
      box.append(a);
      frame.replaceWith(box);
    });

    if (senzaFoto) {
      content.querySelectorAll('figure').forEach(f => f.remove());

      content.querySelectorAll('img').forEach(img => {
        if (!img.closest('.pdf-video')) img.remove();
      });
    }

    // Evita il caricamento pigro delle immagini.
    content.querySelectorAll('img').forEach(img => {
      img.loading = 'eager';
    });
  }, senzaFoto);

  const immagini = await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll('.content img')];

    return Promise.all(imgs.map(async img => {
      if (!img.complete) {
        await Promise.race([
          new Promise(resolve => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
          }),
          new Promise(resolve => setTimeout(resolve, 30000))
        ]);
      }

      return {
        src: img.currentSrc || img.src,
        ok: img.naturalWidth > 0
      };
    }));
  });

  const mancanti = immagini.filter(i => !i.ok);

  console.log(
    'Fotografie caricate:',
    immagini.length - mancanti.length,
    '/',
    immagini.length
  );

  if (mancanti.length) {
    console.error(mancanti);
    throw new Error('Alcune immagini non sono disponibili');
  }

  await page.evaluate(() => document.fonts.ready);
}

async function genera(senzaFoto) {
  const nome = senzaFoto
    ? `${BASE}-senza-foto.pdf`
    : `${BASE}-con-foto.pdf`;

  const pagina = await browser.newPage({
    viewport: { width: 1200, height: 900 },
    locale: 'it-IT'
  });

  try {
    const url = `http://127.0.0.1:${porta}/${
      senzaFoto ? 'senza-foto' : 'con-foto'
    }`;

    const risposta = await pagina.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    const controllo = await pagina.evaluate(() => ({
      titolo: document.title,
      contentPresente: !!document.querySelector('.content'),
      testoIniziale: document.body?.innerText.slice(0, 500)
    }));

    console.log('HTTP:', risposta?.status());
    console.log('Controllo pagina:', controllo);

    if (!risposta?.ok() || !controllo.contentPresente) {
      throw new Error(
        'La pagina HTML non è stata caricata correttamente.'
      );
    }

    await preparaPagina(pagina, senzaFoto);
    await pagina.emulateMedia({ media: 'print' });

    await pagina.pdf({
      path: path.join(CARTELLA, nome),
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `
        <div style="
          width:100%;
          text-align:right;
          padding-right:18mm;
          font-size:10pt;
          color:black
        ">
          <span class="pageNumber"></span>
        </div>
      `,
      timeout: 120000
    });

    console.log('Creato:', nome);

  } finally {
    await pagina.close();
  }
}

try {
  console.log('Lettura Markdown completata.');

  await genera(false);
  await genera(true);

  console.log('PDF generati correttamente.');

} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

// Compressione del PDF fotografico dopo la stampa.
const originale = path.join(
  CARTELLA,
  `${BASE}-con-foto.pdf`
);

const ottimizzato = path.join(
  CARTELLA,
  `${BASE}-con-foto-da-md-ottimizzato.pdf`
);

const gs = spawnSync('gs', [
  '-sDEVICE=pdfwrite',
  '-dCompatibilityLevel=1.6',
  '-dPDFSETTINGS=/printer',
  '-dDownsampleColorImages=true',
  '-dColorImageResolution=170',
  '-dAutoFilterColorImages=false',
  '-dColorImageFilter=/DCTEncode',
  '-dJPEGQ=85',
  '-dDownsampleGrayImages=true',
  '-dGrayImageResolution=170',
  '-dNOPAUSE',
  '-dBATCH',
  `-sOutputFile=${ottimizzato}`,
  originale
], { stdio: 'inherit' });

if (gs.status !== 0) {
  throw new Error('Compressione Ghostscript non riuscita');
}

console.log('PDF ottimizzato:', ottimizzato);
