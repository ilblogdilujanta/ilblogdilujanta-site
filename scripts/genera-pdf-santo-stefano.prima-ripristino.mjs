
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const OUTPUT = path.join(process.cwd(), 'pdf-generati');
const URL_ORIGINALE = 'https://ilblogdilujanta.eu/articoli/2023/12023-santo-stefano--la-radice-pagana-e-stregonica-di-uno-dei-più-bei-luoghi-del-trentino/';

const NOMI = {
  completo: 'santo-stefano-con-foto.pdf',
  testo: 'santo-stefano-senza-foto.pdf'
};

await fs.mkdir(OUTPUT, { recursive: true });

const browser = await chromium.launch({ headless: true });

async function generaPDF(senzaFoto) {
  const nome = senzaFoto ? NOMI.testo : NOMI.completo;

  const page = await browser.newPage({
    viewport: { width: 1200, height: 900 },
    locale: 'it-IT'
  });

  try {
    await page.route(
      'https://cdn.gtranslate.net/**',
      route => route.abort()
    );

    console.log('Caricamento:', nome);

    const response = await page.goto(URL_ORIGINALE, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    if (!response?.ok()) {
      throw new Error('Articolo non raggiungibile: ' + URL_ORIGINALE);
    }

    await page.waitForSelector('article.paper .content', {
      timeout: 60000
    });

    await page.emulateMedia({ media: 'print' });

    // Elimina gli elementi estranei e converte i video
    // in anteprime cliccabili.
    await page.evaluate((senzaFoto) => {
      document.querySelectorAll(
        'header, footer, nav, .share, .pager, .meta-row, #cookie-banner, .cookie-banner, [id*="cookie-consent"], [class*="cookie-consent"]'
      ).forEach(el => el.remove());

      document.querySelectorAll('.content iframe').forEach(iframe => {
        const src = iframe.getAttribute('src') || '';

        if (!/youtube(?:-nocookie)?\.com|youtu\.be/i.test(src)) {
          iframe.remove();
          return;
        }

        const url = new URL(src, location.href);
        const match = url.pathname.match(
          /\/(?:embed|shorts|live)\/([^/?]+)/
        );

        const videoId =
          match?.[1] ||
          url.searchParams.get('v') ||
          (url.hostname.includes('youtu.be')
            ? url.pathname.slice(1)
            : null);

        const link = document.createElement('a');

        link.href = videoId
          ? `https://www.youtube.com/watch?v=${videoId}`
          : url.href;

        if (videoId) {
          link.className = 'pdf-video-link-immagine';

          const preview = document.createElement('span');
          preview.className = 'pdf-video-anteprima';

          const img = document.createElement('img');
          img.className = 'pdf-video-thumbnail';
          img.src =
            `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
          img.alt = 'Anteprima del video YouTube';

          const play = document.createElement('span');
          play.className = 'pdf-video-play';
          play.textContent = '▶';

          preview.append(img, play);
          link.append(preview);
        } else {
          link.textContent = 'Guarda il video su YouTube';
        }

        iframe.replaceWith(link);
      });

      document.querySelectorAll('.content video')
        .forEach(el => el.remove());

      if (senzaFoto) {
        document.querySelectorAll('.content figure')
          .forEach(el => el.remove());

        document.querySelectorAll(
          '.content img:not(.pdf-video-thumbnail), .content figcaption, .content p.caption'
        ).forEach(el => el.remove());

      } else {
        document.querySelectorAll('.content figure')
          .forEach(figure => {
            const imgs = [
              ...figure.querySelectorAll('img')
            ];

            if (imgs.length < 2) return;

            figure.classList.add('pdf-gruppo-multiplo');
            figure.dataset.foto = String(imgs.length);

            // Mantiene l'ordine delle fotografie
            // e la didascalia originale.
            const gallery = document.createElement('div');
            gallery.className = 'pdf-galleria';

            imgs[0].before(gallery);
            imgs.forEach(img => gallery.append(img));

            figure.querySelectorAll('br')
              .forEach(el => el.remove());
          });
      }

      const article = document.querySelector('article.paper');
      const content = article?.querySelector('.content');

      if (!article || !content) {
        throw new Error('Struttura articolo non trovata');
      }

      const riferimento = document.createElement('p');
      riferimento.className = 'pdf-originale';

      const link = document.createElement('a');
      link.href = 'https://ilblogdilujanta.eu/articoli/2023/12023-santo-stefano--la-radice-pagana-e-stregonica-di-uno-dei-più-bei-luoghi-del-trentino/';
      link.textContent = link.href;

      riferimento.append('▦ ', link);
      article.insertBefore(riferimento, content);
    }, senzaFoto);

    await page.addStyleTag({
      content: `
        @page {
          size: A4;
          margin: 20mm 18mm 20mm 18mm;
        }

        html, body, main, article.paper {
          background: #fff !important;
          color: #000 !important;
          box-shadow: none !important;
        }

        html, body {
          margin: 0 !important;
          padding: 0 !important;
        }

        main, article.paper {
          display: block !important;
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
        }

        article.paper,
        article.paper .content,
        article.paper .content * {
          font-family: 'Baskerville Old Face', serif !important;
        }

        .content {
          font-size: 14pt !important;
          line-height: 1.5 !important;
          color: #000 !important;
        }

        .content p {
          font-size: 14pt !important;
          margin: 0 0 12pt !important;
          color: #000 !important;
          orphans: 3;
          widows: 3;
        }

        article.paper h1 {
          color: #174A32 !important;
          font-size: 26pt !important;
          line-height: 1.2 !important;
          text-align: center !important;
          margin: 0 0 14pt !important;
        }

        article.paper .subtitle,
        article.paper .date {
          color: #000 !important;
          font-size: 14pt !important;
          text-align: center !important;
          opacity: 1 !important;
        }

        .content h2,
        .content h3,
        .content h4 {
          color: #000 !important;
          break-after: avoid-page !important;
          page-break-after: avoid !important;
        }

        .content figure {
          display: block !important;
          width: 100% !important;
          margin: 10pt auto 16pt !important;
          padding: 0 !important;
          text-align: center !important;
          break-inside: avoid-page !important;
          page-break-inside: avoid !important;
        }

        .content figure > img,
        .content figure > a > img {
          display: block !important;
          width: auto !important;
          height: auto !important;
          max-width: 100% !important;
          max-height: 120mm !important;
          object-fit: contain !important;
          margin: 0 auto !important;
          box-shadow: none !important;
        }

        .content figure figcaption,
        .content p.caption {
          display: block !important;
          font-size: 14pt !important;
          line-height: 1.4 !important;
          text-align: center !important;
          color: #000 !important;
          opacity: 1 !important;
          margin: 6pt 0 0 !important;
          break-before: avoid-page !important;
        }

        .content figure + p {
          margin-top: 16pt !important;
        }

        /* Due fotografie: una sotto l'altra. */
        .content figure.pdf-gruppo-multiplo .pdf-galleria {
          display: grid !important;
          grid-template-columns: 1fr !important;
          gap: 5pt !important;
          justify-items: center !important;
          align-items: center !important;
        }

        .content figure.pdf-gruppo-multiplo .pdf-galleria img {
          display: block !important;
          width: auto !important;
          height: auto !important;
          max-width: 100% !important;
          max-height: 80mm !important;
          object-fit: contain !important;
          margin: 0 auto !important;
        }

        /* Gruppi da 3 a 6 fotografie:
           due colonne e didascalia comune. */
        .content figure.pdf-gruppo-multiplo[data-foto='3'] .pdf-galleria,
        .content figure.pdf-gruppo-multiplo[data-foto='4'] .pdf-galleria,
        .content figure.pdf-gruppo-multiplo[data-foto='5'] .pdf-galleria,
        .content figure.pdf-gruppo-multiplo[data-foto='6'] .pdf-galleria {
          grid-template-columns:
            repeat(2, minmax(0, 1fr)) !important;
          column-gap: 8pt !important;
          row-gap: 5pt !important;
        }

        .content figure.pdf-gruppo-multiplo[data-foto='3'] .pdf-galleria img,
        .content figure.pdf-gruppo-multiplo[data-foto='4'] .pdf-galleria img {
          max-width: 100% !important;
          max-height: 77mm !important;
        }

        .content figure.pdf-gruppo-multiplo[data-foto='5'] .pdf-galleria img,
        .content figure.pdf-gruppo-multiplo[data-foto='6'] .pdf-galleria img {
          max-width: 100% !important;
          max-height: 53mm !important;
        }

        .pdf-originale {
          font-size: 14pt !important;
          line-height: 1.4 !important;
          margin: 14pt 0 20pt !important;
          overflow-wrap: anywhere !important;
        }

        .pdf-originale a,
        .content a {
          color: #000 !important;
        }

        .pdf-originale a {
          text-decoration: underline !important;
        }

        /* Anteprima video cliccabile. */
        .content .pdf-video-link-immagine {
          display: block !important;
          width: 115mm !important;
          max-width: 100% !important;
          margin: 14pt auto 20pt !important;
          text-decoration: none !important;
          break-inside: avoid-page !important;
        }

        .content .pdf-video-anteprima {
          display: block !important;
          position: relative !important;
          width: 100% !important;
          aspect-ratio: 16/9 !important;
          overflow: hidden !important;
        }

        .content .pdf-video-thumbnail {
          display: block !important;
          width: 100% !important;
          height: 100% !important;
          max-width: none !important;
          max-height: none !important;
          object-fit: cover !important;
          margin: 0 !important;
        }

        .content .pdf-video-play {
          display: block !important;
          position: absolute !important;
          top: 50% !important;
          left: 50% !important;
          transform: translate(-50%, -50%) !important;
          background: #c00 !important;
          color: #fff !important;
          font: 20pt Arial, sans-serif !important;
          line-height: 1 !important;
          padding: 12pt 18pt !important;
          border-radius: 12pt !important;
        }

        /* Nessun banner dei cookie nel PDF. */
        #cookie-banner,
        .cookie-banner,
        [id*='cookie-banner'],
        [class*='cookie-banner'],
        [id*='cookie-consent'],
        [class*='cookie-consent'],
        [aria-label*='cookie' i],
        header,
        footer,
        nav,
        .share,
        .pager,
        .meta-row {
          display: none !important;
        }
      `
    });

    // Verifica che tutte le fotografie siano caricate.
    const foto = await page.evaluate(async () => {
      const imgs = [
        ...document.querySelectorAll('.content img')
      ];

      return await Promise.all(
        imgs.map(async img => {
          if (!img.complete || !img.naturalWidth) {
            await new Promise(resolve => {
              const timer = setTimeout(resolve, 60000);

              img.addEventListener('load', () => {
                clearTimeout(timer);
                resolve();
              }, { once: true });

              img.addEventListener('error', () => {
                clearTimeout(timer);
                resolve();
              }, { once: true });
            });
          }

          await img.decode().catch(() => {});

          return {
            src: img.currentSrc || img.src,
            ok: img.naturalWidth > 0
          };
        })
      );
    });

    const mancanti = foto.filter(f => !f.ok);

    console.log(
      'Immagini caricate:',
      foto.length - mancanti.length,
      '/',
      foto.length
    );

    if (mancanti.length) {
      throw new Error(
        'Immagini non caricate: ' +
        JSON.stringify(mancanti)
      );
    }

    await page.evaluate(() => document.fonts.ready);

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
          font-size:10pt;
          color:#000;
          padding-right:18mm
        ">
          <span class="pageNumber"></span>
        </div>
      `,
      timeout: 120000
    });

    console.log('PDF creato:', nome);

  } finally {
    await page.close();
  }
}

try {
  await generaPDF(false);
  await generaPDF(true);

  console.log(
    'Operazione completata. Cartella:',
    OUTPUT
  );

} catch (errore) {
  console.error('ERRORE:', errore);
  process.exitCode = 1;

} finally {
  await browser.close();
}
