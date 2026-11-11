import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';

const ROOT = process.cwd();
const PUBLIC = path.join(ROOT, 'public');
const OUTPUT = path.join(ROOT, 'pdf-generati');
const CONTENT = path.join(ROOT, 'src/content/articoli');

await fs.mkdir(OUTPUT, { recursive: true });

const argomento = process.argv[2];

async function trovaMarkdown(dir, testo) {
  for (const voce of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, voce.name);

    if (voce.isDirectory()) {
      const trovato = await trovaMarkdown(p, testo);
      if (trovato) return trovato;
    } else if (
      voce.name.toLowerCase().endsWith('.md') &&
      voce.name.toLowerCase().includes(testo)
    ) {
      return p;
    }
  }
  return null;
}

const fileMd = argomento
  ? path.resolve(ROOT, argomento)
  : await trovaMarkdown(path.join(CONTENT, '2023'), 'santo stefano');

if (!fileMd) throw new Error('Markdown non trovato');

if (!(await fs.stat(fileMd)).isFile()) {
  throw new Error('Percorso Markdown non valido');
}

const nomeBase = argomento
  ? path.basename(fileMd, '.md')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 90)
  : 'santo-stefano';

const URL_ARTICOLO = process.argv[3] || (
  argomento
    ? ''
    : 'https://ilblogdilujanta.eu/articoli/2023/12023-santo-stefano--la-radice-pagana-e-stregonica-di-uno-dei-pi%C3%B9-bei-luoghi-del-trentino/'
);

const escapeHTML = s => String(s)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const sorgente = await fs.readFile(fileMd, 'utf8');

const fm = sorgente.match(
  /^\s*---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n/
);

if (!fm) throw new Error('Frontmatter non trovato');

const metadato = nome => (
  fm[1].split(/\r?\n/).find(r => r.startsWith(nome + ':')) || ''
).slice(nome.length + 1).trim().replace(/^["']|["']$/g, '');

const titolo = metadato('title');
const sottotitolo = metadato('subtitle');
const dataOriginale = metadato('date');

const dataISO = dataOriginale.replace(
  /^(\d{4})-(\d{1,2})-(\d{1,2})(?=T|$)/,
  (_, y, m, d) =>
    `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
);

const data = new Date(dataISO);

const dataFormattata = Number.isNaN(data.getTime())
  ? dataOriginale
  : new Intl.DateTimeFormat('it-IT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(data);

const processor = await createMarkdownProcessor({
  syntaxHighlight: false,
  gfm: true
});

const corpoHTML = (
  await processor.render(sorgente.slice(fm[0].length))
).code;

const fontBaskervilleBase64 = (
  await fs.readFile(path.join(ROOT, 'fonts/BASKVILL.TTF'))
).toString('base64');

const stile = `
@font-face {
  font-family: "Baskerville Old Face";
  src: url("data:font/ttf;base64,${fontBaskervilleBase64}") format("truetype");
  font-style: normal;
  font-weight: 400;
  font-display: block;
}

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
  background: #fff;
  color: #000;
}

body {
  font-family: "Baskerville Old Face", Georgia, serif;
  font-size: 14pt;
  line-height: 1.5;
}

h1 {
  font-size: 22pt;
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

.pdf-originale a,
.pdf-video a {
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
  page-break-after: avoid;
}

.content > p:empty {
  display: none;
}


.content figure {
  display: block;
  width: 100%;
  padding: 0;
  margin: 10pt auto 16pt;
  text-align: center;
  break-inside: avoid-page;
  page-break-inside: avoid;
}

.content figure img {
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 155mm;
  object-fit: contain;
  margin: 0 auto;
  box-shadow: none;
}


/* Una riga aggiuntiva dopo il blocco fotografico */
.content figure + p,
.content figure + p.pdf-titolo-grassetto {
  margin-top: 19pt;
}

.content figcaption {
  display: block;
  color: #000;
  font-size: 10pt;
  line-height: 1.4;
  text-align: center;
  margin: 7pt 0 0;
  break-before: avoid-page;
}

.content .pdf-griglia {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7pt;
  align-items: center;
  justify-items: center;
}

.content .pdf-griglia img {
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 82mm;
  margin: 0 auto;
}

.content figure.pdf-gruppo[data-count="2"] .pdf-griglia {
  grid-template-columns: 1fr;
}

.content figure.pdf-gruppo[data-count="2"] .pdf-griglia img {
  max-height: 92mm;
}

.content figure.pdf-gruppo[data-count="3"] .pdf-griglia img,
.content figure.pdf-gruppo[data-count="4"] .pdf-griglia img {
  max-height: 82mm;
}

.content figure.pdf-gruppo[data-count="5"] .pdf-griglia img,
.content figure.pdf-gruppo[data-count="6"] .pdf-griglia img {
  max-height: 62mm;
}

.content figure.pdf-gruppo .pdf-griglia img:last-child:nth-child(odd) {
  grid-column: 1 / -1;
  max-width: 70%;
}

.content figure.pdf-gruppo[data-count="2"] .pdf-griglia img:last-child {
  max-width: 100%;
}

.content figure.pdf-gruppo[data-count="7"] .pdf-griglia img,
.content figure.pdf-gruppo[data-count="8"] .pdf-griglia img {
  max-height: 45mm;
}

.content img:not(figure img) {
  display: block;
  max-width: 100%;
  max-height: 155mm;
  width: auto;
  height: auto;
  margin: 10pt auto;
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

.pdf-senza-foto figure,
.pdf-senza-foto .foto-singola {
  display: none !important;
}

a {
  overflow-wrap: anywhere;
}





/* CORREZIONI SPAZIATURA E NOTE */

/* Distanza dopo fotografie anche con separatori vuoti */
.content figure + p:not(:has(img)):not(:has(iframe)) {
  margin-top: 19pt;
}

/* Mantiene il titolo Note con la sezione successiva */
.content p:has(+ p.pdf-titolo-grassetto) {
  break-after: avoid-page;
  page-break-after: avoid;
}


/* Correzione fotografia senza figure nel Markdown */
.content img:not(figure img):not(.pdf-video img) {
  margin-bottom: 19pt;
}

/* IMPAGINAZIONE PDF GENERALE */

/* Il testo scorre senza interruzioni forzate */
.content p {
  orphans: 2;
  widows: 2;
  break-before: auto;
  break-after: auto;
  margin-bottom: 9pt;
}

/* I titoli non devono restare isolati */
.content h2,
.content h3,
.content h4 {
  break-after: avoid-page;
  page-break-after: avoid;
  margin-bottom: 8pt;
}

/* Fotografie singole con didascalie unite */
.content figure:not(.pdf-gruppo) {
  break-inside: avoid-page;
  page-break-inside: avoid;
}

/* Gruppi fotografici mantenuti uniti */
.content figure.pdf-gruppo {
  break-inside: avoid-page;
  page-break-inside: avoid;
}

/* Spazi più compatti intorno alle fotografie */
.content figure {
  margin-top: 5pt;
  margin-bottom: 8pt;
}

/* Didascalie */
.content figcaption {
  margin-top: 5pt;
  break-before: avoid-page;
  page-break-before: avoid;
}

/* Evita spazi eccessivi prima dei titoli */
.content h2,
.content h3,
.content h4 {
  margin-top: 12pt;
}

/* TITOLI IN GRASSETTO DA MARKDOWN */
.content p.pdf-titolo-grassetto {
  break-after: avoid-page !important;
  page-break-after: avoid !important;
  margin-top: 12pt;
  margin-bottom: 8pt;
}

/* Maggiore distanza tra titoli di sezione e fotografie */
.content p:has(> strong):has(+ figure),
.content h2:has(+ figure),
.content h3:has(+ figure),
.content h4:has(+ figure) {
  margin-bottom: 16pt !important;
}

/* Collegamento originale: quattro quadratini azzurri */
.pdf-originale {
  display: flex;
  align-items: baseline;
  gap: 9pt;
}

.pdf-simbolo-link {
  display: inline-grid;
  grid-template-columns: repeat(2, 8px);
  grid-template-rows: repeat(2, 8px);
  gap: 3px;
  flex-shrink: 0;
  align-self: flex-start;
}

.pdf-simbolo-link span {
  width: 8px;
  height: 8px;
  background: #24658A;
}

.pdf-originale a {
  color: #24658A;
  text-decoration: underline;
}
`;

function documento(senzaFoto) {
  const link = URL_ARTICOLO
    ? `<p class="pdf-originale"><span class="pdf-simbolo-link"><span></span><span></span><span></span><span></span></span> <a href="${escapeHTML(URL_ARTICOLO)}">${escapeHTML(URL_ARTICOLO)}</a></p>`
    : '';

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
${link}
<div class="content">${corpoHTML.replace(
  /(?:\s*<br\s*\/?>(?:\s*<\/p>\s*<p>)?){3,}(?=\s*(?:<p>)?\s*<u>Immagini<\/u>)/gi,
  ""
)}</div>
</article>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');

    if (
      url.pathname === '/con-foto' ||
      url.pathname === '/senza-foto'
    ) {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8'
      });

      res.end(documento(url.pathname === '/senza-foto'));
      return;
    }

    const relativo = decodeURIComponent(url.pathname)
      .replace(/^\/+/, '');

    const richiesto = path.resolve(PUBLIC, relativo);
    const percorsoRelativo = path.relative(PUBLIC, richiesto);

    if (
      percorsoRelativo.startsWith('..') ||
      path.isAbsolute(percorsoRelativo)
    ) {
      res.writeHead(403);
      res.end();
      return;
    }

    const contenuto = await fs.readFile(richiesto);
    const ext = path.extname(richiesto).toLowerCase();

    const mime = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml'
    };

    res.writeHead(200, {
      'Content-Type': mime[ext] || 'application/octet-stream'
    });

    res.end(contenuto);
  } catch (e) {
    console.error('Server:', e.message);
    res.writeHead(404);
    res.end('File non trovato');
  }
});

await new Promise(resolve =>
  server.listen(0, '127.0.0.1', resolve)
);

const porta = server.address().port;
const browser = await chromium.launch({ headless: true });

async function preparaPagina(page, senzaFoto) {
  await page.evaluate(senzaFoto => {
    const content = document.querySelector('.content');

    if (!content) {
      throw new Error('Contenitore .content non trovato');
    }


    // Riconosce i titoli scritti come paragrafi in grassetto.
    content.querySelectorAll('p').forEach(p => {
      const figli = [...p.childNodes].filter(n =>
        n.nodeType !== Node.TEXT_NODE ||
        n.textContent.trim()
      );

      if (
        figli.length === 1 &&
        figli[0].nodeType === Node.ELEMENT_NODE &&
        ['STRONG', 'B'].includes(figli[0].tagName)
      ) {
        p.classList.add('pdf-titolo-grassetto');
      }
    });

    content.querySelectorAll('figcaption').forEach(c => {
      if (!c.textContent.trim()) c.remove();
    });

    if (!senzaFoto) {
      const vuoto = el =>
        el &&
        (
          (el.tagName === 'P' &&
            !el.textContent.trim() &&
            !el.querySelector('img,iframe')) ||
          el.tagName === 'BR'
        );

      const fotografico = el =>
        el &&
        el.tagName === 'FIGURE' &&
        !!el.querySelector('img');

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

        if (
          immagini.length > 1 &&
          didascalie.length === 1 &&
          gruppo.at(-1).contains(didascalie[0])
        ) {
          const f = document.createElement('figure');
          f.className = 'pdf-gruppo';
          f.dataset.count = String(immagini.length);

          const griglia = document.createElement('div');
          griglia.className = 'pdf-griglia';

          immagini.forEach(img => griglia.append(img));

          f.append(griglia, didascalie[0]);
          gruppo[0].before(f);

          gruppo.forEach(el => el.remove());
          separatori.forEach(el => el.remove());
        }

        nodo = corrente;
      }

      content.querySelectorAll(
        'figure:not(.pdf-gruppo)'
      ).forEach(f => {
        const imgs = [...f.querySelectorAll('img')];

        if (imgs.length < 2) return;

        const semplice = [...f.children].every(el =>
          ['IMG', 'FIGCAPTION'].includes(el.tagName) ||
          (
            el.tagName === 'P' &&
            !el.textContent.trim() &&
            !el.querySelector('img')
          )
        );

        if (!semplice) return;

        const griglia = document.createElement('div');
        griglia.className = 'pdf-griglia';

        imgs.forEach(img => griglia.append(img));
        f.prepend(griglia);

        f.classList.add('pdf-gruppo');
        f.dataset.count = String(imgs.length);
      });
    }

    content.querySelectorAll('iframe').forEach(frame => {
      const src = frame.getAttribute('src') || '';
      const a = document.createElement('a');

      try {
        const u = new URL(src, location.href);

        const id = u.pathname.match(
          /\/(?:embed|shorts|live)\/([^/?]+)/
        )?.[1] || u.searchParams.get('v');

        if (
          id &&
          /(?:^|\.)youtube(?:-nocookie)?\.com$/.test(u.hostname)
        ) {
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

    content.querySelectorAll('img').forEach(img => {
      img.loading = 'eager';
    });
  }, senzaFoto);

  const immagini = await page.evaluate(async () =>
    Promise.all(
      [...document.querySelectorAll('.content img')].map(async img => {
        if (!img.complete) {
          await Promise.race([
            new Promise(resolve => {
              img.addEventListener('load', resolve, { once: true });
              img.addEventListener('error', resolve, { once: true });
            }),
            new Promise(resolve =>
              setTimeout(resolve, 30000)
            )
          ]);
        }

        return {
          src: img.currentSrc || img.src,
          ok: img.naturalWidth > 0
        };
      })
    )
  );

  const mancanti = immagini.filter(i => !i.ok);

  console.log(
    'Immagini caricate:',
    immagini.length - mancanti.length,
    '/',
    immagini.length
  );

  if (mancanti.length) {
    throw new Error(
      'Immagini mancanti: ' +
      mancanti.map(i => i.src).join(', ')
    );
  }

  await page.evaluate(() => document.fonts.ready);
}

async function genera(senzaFoto) {
  const nome = `${nomeBase}-${
    senzaFoto ? 'senza-foto' : 'con-foto'
  }.pdf`;

  const page = await browser.newPage({
    viewport: { width: 1200, height: 900 },
    locale: 'it-IT'
  });

  try {
    const url = `http://127.0.0.1:${porta}/${
      senzaFoto ? 'senza-foto' : 'con-foto'
    }`;

    const risposta = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    if (!risposta?.ok()) {
      throw new Error(
        'Pagina HTML non caricata: ' + risposta?.status()
      );
    }

    await preparaPagina(page, senzaFoto);
    await page.emulateMedia({ media: 'print' });

    // Riduce progressivamente la fotografia se il paragrafo
    // successivo non entra interamente nella stessa pagina.
    if (!senzaFoto) {
      await page.evaluate(() => {
        const contenuto = document.querySelector('.content');
        const paragrafi = [...contenuto.querySelectorAll('p')];

        const paragrafo = paragrafi.find(p =>
          p.textContent.trim().startsWith('Carisolo, il cui territorio')
        );

        if (!paragrafo) return;

        let precedente = paragrafo.previousElementSibling;

        while (precedente && !precedente.querySelector('img')) {
          precedente = precedente.previousElementSibling;
        }

        const img = precedente?.querySelector('img');
        if (!img) return;

        const pagina = 297 * 96 / 25.4;
        const margineSuperiore = 20 * 96 / 25.4;
        const margineInferiore = 20 * 96 / 25.4;
        const altezzaUtile = pagina - margineSuperiore - margineInferiore;

        const altezzaOriginale = img.getBoundingClientRect().height;
        if (!altezzaOriginale) return;

        function entraInteramente() {
          const rect = paragrafo.getBoundingClientRect();
          const inizioPagina = Math.floor(
            (rect.top + 0.5) / altezzaUtile
          ) * altezzaUtile;

          return rect.bottom <= inizioPagina + altezzaUtile - 5;
        }

        if (entraInteramente()) return;

        for (let percentuale = 85; percentuale >= 50; percentuale -= 5) {
          img.style.maxHeight =
            (altezzaOriginale * percentuale / 100) + 'px';

          if (entraInteramente()) {
            console.log('Fotografia ridotta al ' + percentuale + '%');
            break;
          }
        }
      });
    }

    await page.pdf({
      path: path.join(OUTPUT, nome),
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
    await page.close();
  }
}

try {
  console.log('Markdown:', fileMd);
  await genera(false);
  await genera(true);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

for (const versione of ['con-foto', 'senza-foto']) {
  const originale = path.join(
    OUTPUT,
    `${nomeBase}-${versione}.pdf`
  );

  const ottimizzato = path.join(
    OUTPUT,
    `${nomeBase}-${versione}-da-md-ottimizzato.pdf`
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
  ], {
    stdio: 'inherit'
  });

  if (gs.status !== 0) {
    throw new Error(`Compressione Ghostscript non riuscita: ${versione}`);
  }

  console.log('PDF ottimizzato:', ottimizzato);
}
