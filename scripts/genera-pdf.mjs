
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");
const OUTPUT = path.join(ROOT, "pdf-generati");

const ARTICOLO =
  "articoli/2025/il-tormento-notturno-vii";

await fs.mkdir(OUTPUT, { recursive: true });

const browser = await chromium.launch({
  headless: true
});

async function generaPDF(senzaFoto) {
  const page = await browser.newPage();

  const fileHTML = path.join(
    DIST,
    ARTICOLO,
    "index.html"
  );

  await page.goto(
    pathToFileURL(fileHTML).href,
    { waitUntil: "load" }
  );

  await page.evaluate((senzaFoto) => {
    document.querySelectorAll(
      "header, footer, nav, .share, .meta-row"
    ).forEach(el => el.remove());

    if (senzaFoto) {
      document.querySelectorAll(
        ".content figure, .content img, .content .caption"
      ).forEach(el => el.remove());
    }
  }, senzaFoto);

  await page.addStyleTag({
    content: `
      @page {
        size: A4;
        margin: 20mm 18mm;
      }

      body, main, .paper {
        background: white !important;
        box-shadow: none !important;
        color: #000000 !important;
      }

      .paper {
        padding: 0 !important;
        max-width: 100% !important;
      }

      .content {
        font-family: "Baskerville Old Face", serif !important;
        font-size: 14pt !important;
        line-height: 1.5 !important;
      }

      h1 {
        color: #174A32 !important;
      }

      .content img {
        max-width: 100% !important;
        height: auto !important;
        box-shadow: none !important;
      }

      .content figure {
        break-inside: avoid;
      }

      .content figcaption {
        color: #000000 !important;
      }
    `
  });

  const nome = senzaFoto
    ? "tormento-notturno-vii-senza-foto.pdf"
    : "tormento-notturno-vii-con-foto.pdf";

  await page.pdf({
    path: path.join(OUTPUT, nome),
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: `
      <div style="
        width:100%;
        text-align:right;
        font-size:10px;
        padding-right:18mm;
      ">
        <span class="pageNumber"></span>
      </div>
    `
  });

  await page.close();

  console.log("Creato:", nome);
}

try {
  await generaPDF(false);
  await generaPDF(true);
} finally {
  await browser.close();
}
