
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");
const OUTPUT = path.join(ROOT, "pdf-generati");

const ARTICOLO =
  "articoli/2016/112016-trumusiate-sainate-la-divinità-del-santuario-di-lagole-calalzo-di-cadore-belluno";

const URL_ORIGINALE =
  "https://ilblogdilujanta.eu/" +
  ARTICOLO + "/";

await fs.mkdir(OUTPUT, { recursive: true });

const tipi = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    let percorso = decodeURIComponent(url.pathname);

    if (percorso.endsWith("/")) {
      percorso += "index.html";
    }

    const file = path.resolve(
      DIST,
      "." + percorso
    );

    if (
      file !== DIST &&
      !file.startsWith(DIST + path.sep)
    ) {
      res.writeHead(403);
      res.end("Accesso negato");
      return;
    }

    const dati = await fs.readFile(file);

    res.writeHead(200, {
      "Content-Type":
        tipi[path.extname(file).toLowerCase()] ||
        "application/octet-stream"
    });

    res.end(dati);
  } catch (errore) {
    res.writeHead(404);
    res.end("File non trovato");
  }
});

await new Promise(resolve => {
  server.listen(0, "127.0.0.1", resolve);
});

const PORTA = server.address().port;
let browser;

async function generaPDF(senzaFoto) {
  const page = await browser.newPage();

  try {
    const url =
      `http://127.0.0.1:${PORTA}/${ARTICOLO}/`;

    await page.goto(url, {
      waitUntil: "networkidle"
    });

    await page.evaluate(
      ({ senzaFoto, urlOriginale }) => {
        const articolo =
          document.querySelector("article.paper");

        if (!articolo) {
          throw new Error(
            "Contenuto dell'articolo non trovato"
          );
        }

        // Conserva soltanto l'articolo.
        document.body.replaceChildren(articolo);

        // Elimina gli elementi estranei.
        articolo.querySelectorAll(
          ".share, .pager, .meta-row, iframe"
        ).forEach(el => el.remove());

        if (senzaFoto) {
          // Elimina le fotografie con le didascalie.
          articolo.querySelectorAll(
            ".content figure"
          ).forEach(el => el.remove());

          // Elimina eventuali fotografie isolate.
          articolo.querySelectorAll(
            ".content img, .content picture"
          ).forEach(el => el.remove());

          // Elimina le didascalie separate.
          articolo.querySelectorAll(
            ".content figcaption, .content p.caption, .content .caption"
          ).forEach(el => el.remove());
        }

        // Collegamento all'articolo originale.
        const link = document.createElement("p");
        link.className = "pdf-originale";

        const a = document.createElement("a");
        a.href = urlOriginale;
        a.textContent = "🔗 " + urlOriginale;

        link.appendChild(a);

        const data =
          articolo.querySelector(".date");

        if (data) {
          data.after(link);
        } else {
          articolo.prepend(link);
        }
      },
      {
        senzaFoto,
        urlOriginale: URL_ORIGINALE
      }
    );

    await page.addStyleTag({
      content: `
        @page {
          size: A4;
          margin: 20mm 18mm 20mm 18mm;
        }

        html, body {
          background: #ffffff !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        body, main, article.paper {
          width: 100% !important;
          max-width: 100% !important;
          background: white !important;
          color: #000 !important;
          box-shadow: none !important;
          border: none !important;
          padding: 0 !important;
          margin: 0 !important;
        }

        article.paper {
          display: block !important;
        }

        article.paper,
        article.paper .content {
          font-family: "Baskerville Old Face",
                       "Baskerville",
                       serif !important;
          font-size: 14pt !important;
          line-height: 1.5 !important;
        }

        h1 {
          font-size: 28pt !important;
          line-height: 1.2 !important;
          color: #174A32 !important;
          text-align: center !important;
          margin-bottom: 14pt !important;
        }

        .subtitle {
          font-size: 16pt !important;
          color: #000 !important;
          text-align: center !important;
        }

        .date {
          font-size: 14pt !important;
          color: #000 !important;
          text-align: center !important;
        }

        .pdf-originale {
          font-size: 14pt !important;
          text-align: center !important;
          margin: 12pt 0 22pt !important;
          overflow-wrap: anywhere;
        }

        .pdf-originale a {
          color: #000 !important;
          text-decoration: none !important;
        }

        .content p {
          margin: 0 0 12pt !important;
          orphans: 2;
          widows: 2;
        }

        .content figure {
          display: block !important;
          margin: 18pt auto 24pt !important;
          text-align: center !important;
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }

        .content img {
          display: block !important;
          max-width: 90% !important;
          max-height: 210mm !important;
          width: auto !important;
          height: auto !important;
          object-fit: contain !important;
          margin: 0 auto !important;
          box-shadow: none !important;
          break-inside: avoid !important;
        }

        .content img.img-large {
          max-width: 95% !important;
        }

        .content img.img-small {
          max-width: 55% !important;
        }

        .content figcaption,
        .content p.caption {
          color: #000 !important;
          text-align: center !important;
          font-size: 14pt !important;
          line-height: 1.4 !important;
          margin-top: 8pt !important;
        }

        .content h2,
        .content h3,
        .content h4 {
          color: #000 !important;
          break-after: avoid !important;
        }

        .content a {
          color: #000 !important;
        }

        header, footer, nav,
        .share, .pager, .meta-row {
          display: none !important;
        }
      `
    });

    await page.evaluate(async () => {
      await document.fonts.ready;

      const immagini = [
        ...document.querySelectorAll(".content img")
      ];

      await Promise.all(
        immagini.map(img => {
          if (img.complete) return Promise.resolve();

          return new Promise(resolve => {
            img.addEventListener("load", resolve, {
              once: true
            });

            img.addEventListener("error", resolve, {
              once: true
            });
          });
        })
      );
    });

    const nome = senzaFoto
      ? "trumusiate-sainate-senza-foto.pdf"
      : "trumusiate-sainate-con-foto.pdf";

    await page.pdf({
      path: path.join(OUTPUT, nome),
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `
        <div style="
          width: 100%;
          text-align: right;
          font-size: 10pt;
          color: black;
          padding-right: 18mm;
        ">
          <span class="pageNumber"></span>
        </div>
      `
    });

    console.log("PDF creato:", nome);
  } finally {
    await page.close();
  }
}

try {
  browser = await chromium.launch({
    headless: true
  });

  await generaPDF(false);
  await generaPDF(true);
} finally {
  if (browser) {
    await browser.close();
  }

  await new Promise(resolve => {
    server.close(resolve);
  });
}
