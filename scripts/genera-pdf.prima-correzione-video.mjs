
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, "pdf-generati");

const ARTICOLO =
  "articoli/2016/112016-trumusiate-sainate-la-divinità-del-santuario-di-lagole-calalzo-di-cadore-belluno";

const URL_ORIGINALE =
  "https://ilblogdilujanta.eu/" + ARTICOLO + "/";

const NOMI = {
  completo: "trumusiate-sainate-con-foto.pdf",
  testo: "trumusiate-sainate-senza-foto.pdf"
};

await fs.mkdir(OUTPUT, { recursive: true });

let browser;

async function generaPDF(senzaFoto) {
  const nome = senzaFoto ? NOMI.testo : NOMI.completo;

  console.log("Preparazione:", nome);

  const page = await browser.newPage({
    viewport: { width: 1200, height: 900 },
    locale: "it-IT"
  });

  try {
    // Impedisce la traduzione automatica.
    await page.route(
      "https://cdn.gtranslate.net/**",
      route => route.abort()
    );

    console.log("Caricamento articolo...");

    const response = await page.goto(URL_ORIGINALE, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    if (!response || !response.ok()) {
      throw new Error(
        "Articolo non trovato: " + URL_ORIGINALE
      );
    }

    await page.emulateMedia({ media: "print" });

    await page.waitForSelector(".content", {
      timeout: 60000
    });

    console.log("Articolo caricato.");

    // Attende i caratteri.
    await Promise.race([
      page.evaluate(() => document.fonts.ready),
      new Promise(resolve => setTimeout(resolve, 15000))
    ]);

    // Recupera tutte le fotografie originali.
    if (!senzaFoto) {
      console.log("Controllo fotografie...");

      const immagini = await page.evaluate(async () => {
        const imgs = [
          ...document.querySelectorAll(".content img")
        ];

        async function carica(img) {
          if (img.complete && img.naturalWidth > 0) {
            return true;
          }

          const src = img.currentSrc || img.src;

          for (let tentativo = 1; tentativo <= 3; tentativo++) {
            const ok = await new Promise(resolve => {
              const prova = new Image();

              const timer = setTimeout(
                () => resolve(false),
                60000
              );

              prova.onload = () => {
                clearTimeout(timer);
                resolve(prova.naturalWidth > 0);
              };

              prova.onerror = () => {
                clearTimeout(timer);
                resolve(false);
              };

              prova.src = src;
            });

            if (ok) {
              img.removeAttribute("srcset");
              img.removeAttribute("sizes");
              img.src = src;

              await img.decode().catch(() => {});

              return img.naturalWidth > 0;
            }
          }

          return false;
        }

        return await Promise.all(
          imgs.map(async img => ({
            src: img.currentSrc || img.src,
            ok: await carica(img)
          }))
        );
      });

      const mancanti = immagini.filter(img => !img.ok);

      console.log(
        "Fotografie caricate:",
        immagini.length - mancanti.length,
        "/",
        immagini.length
      );

      if (mancanti.length) {
        console.error("Fotografie mancanti:", mancanti);

        throw new Error(
          "PDF interrotto: alcune fotografie non sono caricate."
        );
      }
    }

    // Nasconde il banner dei cookie soltanto nel PDF.
    // Mantiene la correzione che funzionava.
    await page.addStyleTag({
      content: `
        @media print {
          #cookie-banner,
          .cookie-banner,
          [id*="cookie-banner"],
          [class*="cookie-banner"],
          [id*="cookie-consent"],
          [class*="cookie-consent"],
          [aria-label*="cookie" i] {
            display: none !important;
          }
        }
      `
    });

    // Elimina gli elementi estranei al PDF.
    await page.evaluate((senzaFoto) => {
      document.querySelectorAll(
        "header, footer, nav, .share, .pager, .meta-row"
      ).forEach(el => el.remove());

      // Converte il video YouTube in link cliccabile.
      document.querySelectorAll(
        ".content iframe"
      ).forEach(iframe => {
        const src = iframe.getAttribute("src") || "";

        if (/youtube(?:-nocookie)?\.com|youtu\.be/i.test(src)) {
          const url = new URL(src, location.href);

          const id = url.pathname.match(
            /\/(?:embed|shorts|live)\/([^/?]+)/
          );

          const link = document.createElement("a");

          link.href = id
            ? "https://www.youtube.com/watch?v=" + id[1]
            : url.href;

          // ANTEPRIMA VIDEO YOUTUBE
          const videoId = id
            ? id[1]
            : url.searchParams.get("v");

          if (videoId) {
            const anteprima = document.createElement("span");
            anteprima.className = "pdf-video-anteprima";

            const immagine = document.createElement("img");
            immagine.src =
              "https://img.youtube.com/vi/" +
              videoId +
              "/hqdefault.jpg";
            immagine.alt = "Anteprima del video YouTube";

            const play = document.createElement("span");
            play.className = "pdf-video-play";
            play.textContent = "▶";

            anteprima.append(immagine, play);
            link.appendChild(anteprima);
            link.className = "pdf-video-link-immagine";
          } else {
            link.textContent = "Guarda il video su YouTube";
            link.className = "pdf-video-link";
          }

          iframe.replaceWith(link);
        } else {
          iframe.remove();
        }
      });

      document.querySelectorAll(
        ".content video"
      ).forEach(video => video.remove());

      if (senzaFoto) {
        document.querySelectorAll(
          ".content figure"
        ).forEach(el => el.remove());

        document.querySelectorAll(
          ".content img, .content figcaption, .content .caption"
        ).forEach(el => el.remove());
      } else {
        // Identifica i gruppi con più fotografie.
        // Non modifica l'ordine né le didascalie.
        document.querySelectorAll(
          ".content figure"
        ).forEach(figure => {
          const imgs = figure.querySelectorAll("img");

          if (imgs.length > 1) {
            figure.classList.add("pdf-gruppo-multiplo");
          }
        });
      }
    }, senzaFoto);


    // Raggruppa le fotografie 9 e 10 per la stampa.
    if (!senzaFoto) {
      await page.evaluate(() => {
        const figures = [...document.querySelectorAll(".content figure")];

        const findFigure = numero => figures.find(figure => {
          const caption = figure.querySelector("figcaption");
          return caption &&
            new RegExp("^\\s*" + numero + "\\.").test(
              caption.textContent.trim()
            );
        });

        const foto9 = findFigure(9);
        const foto10 = findFigure(10);

        if (foto9 && foto10) {
          const group = document.createElement("div");
          group.className = "pdf-foto-9-10";

          foto9.before(group);
          group.appendChild(foto9);
          group.appendChild(foto10);
        }
      });
    }

    // Inserisce l'URL originale nella prima pagina.
    await page.evaluate(originale => {
      const article = document.querySelector("article.paper");
      const content = article?.querySelector(".content");

      if (!article || !content) {
        throw new Error("Struttura articolo non trovata.");
      }

      const riferimento = document.createElement("p");
      riferimento.className = "pdf-originale";

      const simbolo = document.createElement("span");
      simbolo.textContent = "▦ ";

      riferimento.appendChild(simbolo);

      const link = document.createElement("a");
      link.href = originale;
      link.textContent = originale;

      riferimento.appendChild(link);
      article.insertBefore(riferimento, content);
    }, URL_ORIGINALE);

    // Impaginazione PDF.
    await page.addStyleTag({
      content: `
        @page {
          size: A4;
          margin: 20mm 18mm 20mm 18mm;
        }

        html, body, main, article.paper {
          background: #ffffff !important;
          color: #000000 !important;
          box-shadow: none !important;
        }

        html, body {
          margin: 0 !important;
          padding: 0 !important;
        }

        main {
          display: block !important;
          width: 100% !important;
          padding: 0 !important;
          margin: 0 !important;
        }

        article.paper {
          width: 100% !important;
          max-width: 100% !important;
          padding: 0 !important;
          margin: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
        }

        article.paper,
        article.paper .content,
        article.paper .content * {
          font-family: "Baskerville Old Face", serif !important;
        }

        .content {
          font-size: 14pt !important;
          line-height: 1.5 !important;
          color: #000000 !important;
        }

        .content p {
          font-size: 14pt !important;
          margin: 0 0 12pt !important;
          color: #000000 !important;
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
          color: #000000 !important;
          font-size: 14pt !important;
          text-align: center !important;
          opacity: 1 !important;
        }

        .content h2,
        .content h3,
        .content h4 {
          color: #000000 !important;
          break-after: avoid !important;
          page-break-after: avoid !important;
        }

        /* Fotografie singole con didascalia. */
        .content figure {
          display: block !important;
          width: 100% !important;
          margin: 14pt auto 20pt !important;
          padding: 0 !important;
          text-align: center !important;
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }

        .content img,
        .content figure img {
          display: block !important;
          max-width: 100% !important;
          max-height: 175mm !important;
          width: auto !important;
          height: auto !important;
          object-fit: contain !important;
          margin-left: auto !important;
          margin-right: auto !important;
          box-shadow: none !important;
          break-inside: avoid !important;
        }

        /* Fotografie 5 e 6:
           restano una sotto l'altra,
           unite alla didascalia comune. */
        .content figure.pdf-gruppo-multiplo {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
          margin: 14pt auto 20pt !important;
        }

        .content figure.pdf-gruppo-multiplo img {
          max-width: 100% !important;
          max-height: 78mm !important;
          width: auto !important;
          height: auto !important;
          object-fit: contain !important;
          margin: 0 auto 8pt !important;
        }

        .content figure.pdf-gruppo-multiplo br {
          display: none !important;
        }

        /* Didascalie sempre sotto le immagini. */
        .content figcaption,
        .content p.caption {
          display: block !important;
          color: #000000 !important;
          text-align: center !important;
          font-size: 14pt !important;
          line-height: 1.4 !important;
          margin: 8pt 0 0 !important;
          opacity: 1 !important;
          break-before: avoid !important;
          page-break-before: avoid !important;
        }

        /* Spazio tra fotografie e testo successivo. */
        .content figure + p {
          margin-top: 24pt !important;
        }


        /* Fotografie 9 e 10: stessa pagina, con didascalie. */
        .content .pdf-foto-9-10 {
          display: block !important;
          break-inside: avoid !important;
          page-break-inside: avoid !important;
          margin: 12pt 0 20pt !important;
        }

        .content .pdf-foto-9-10 figure {
          margin: 0 auto 14pt !important;
          break-inside: avoid !important;
        }

        .content .pdf-foto-9-10 img {
          max-height: 85mm !important;
          max-width: 100% !important;
          width: auto !important;
          height: auto !important;
          margin: 0 auto !important;
        }

        .content .pdf-foto-9-10 figcaption {
          margin-top: 6pt !important;
          text-align: center !important;
        }


        /* RIFINITURA COMPATTA FINALE */

        /* Riduce gli spazi inutilizzati tra le fotografie. */
        .content figure {
          margin-top: 10pt !important;
          margin-bottom: 16pt !important;
        }

        /* Mantiene la didascalia vicina alla fotografia. */
        .content figure figcaption {
          margin-top: 6pt !important;
          break-before: avoid !important;
        }

        /* Spazio equilibrato prima del testo successivo. */
        .content figure + p {
          margin-top: 16pt !important;
        }

        /* Le fotografie 5 e 6 restano unite. */
        .content figure.pdf-gruppo-multiplo {
          margin-top: 10pt !important;
          margin-bottom: 16pt !important;
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }

        .content figure.pdf-gruppo-multiplo img {
          max-height: 85mm !important;
          margin-bottom: 5pt !important;
        }

        /* Le fotografie 9 e 10 restano insieme. */
        .content .pdf-foto-9-10 {
          margin-top: 10pt !important;
          margin-bottom: 16pt !important;
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }

        .content .pdf-foto-9-10 figure {
          margin-bottom: 10pt !important;
        }

        .content .pdf-foto-9-10 img {
          max-height: 85mm !important;
        }


        /* Anteprima fotografica cliccabile del video. */
        .content .pdf-video-link-immagine {
          display: block !important;
          width: 115mm !important;
          max-width: 100% !important;
          margin: 14pt auto 20pt !important;
          text-decoration: none !important;
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }

        .content .pdf-video-anteprima {
          display: block !important;
          position: relative !important;
          width: 100% !important;
          aspect-ratio: 16 / 9 !important;
          overflow: hidden !important;
        }

        .content .pdf-video-anteprima img {
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
          background: #cc0000 !important;
          color: #ffffff !important;
          font-family: Arial, sans-serif !important;
          font-size: 20pt !important;
          line-height: 1 !important;
          padding: 12pt 18pt !important;
          border-radius: 12pt !important;
        }

        /* Collegamento all'articolo originale. */
        .pdf-originale {
          font-size: 14pt !important;
          line-height: 1.4 !important;
          margin: 14pt 0 20pt !important;
          overflow-wrap: anywhere !important;
        }

        .pdf-originale a {
          color: #000000 !important;
          text-decoration: underline !important;
        }

        .pdf-video-link {
          color: #000000 !important;
          text-decoration: underline !important;
        }

        .content a {
          color: #000000 !important;
        }

        /* Nasconde ancora il banner anche
           nell'ultimo foglio di stile. */
        #cookie-banner,
        .cookie-banner,
        [id*="cookie-banner"],
        [class*="cookie-banner"],
        [id*="cookie-consent"],
        [class*="cookie-consent"],
        [aria-label*="cookie" i],
        header, footer, nav,
        .share, .pager, .meta-row {
          display: none !important;
        }
      `
    });

    console.log("Creazione PDF...");

    await page.pdf({
      path: path.join(OUTPUT, nome),
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `
        <div style="
          width:100%;
          text-align:right;
          font-size:10pt;
          color:#000000;
          padding-right:18mm;
        ">
          <span class="pageNumber"></span>
        </div>
      `,
      timeout: 60000
    });

    console.log("PDF creato:", nome);
  } finally {
    await page.close();
  }
}

try {
  console.log("Avvio Chromium...");

  browser = await chromium.launch({
    headless: true
  });

  await generaPDF(false);
  await generaPDF(true);

  console.log("Operazione completata.");
  console.log("Cartella:", OUTPUT);
} catch (errore) {
  console.error("ERRORE:", errore.message);
  process.exitCode = 1;
} finally {
  if (browser) {
    await browser.close();
  }
}
