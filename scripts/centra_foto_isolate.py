#!/usr/bin/env python3
"""Centra le fotografie isolate senza modificare le altre pagine."""

import sys
from pathlib import Path
import fitz

MARGINE_MM = 20
PT_PER_MM = 72 / 25.4


def elabora(percorso):
    sorgente = Path(percorso)
    destinazione = sorgente.with_name(
        sorgente.stem + '-centrato.pdf'
    )

    doc = fitz.open(sorgente)
    out = fitz.open()
    centrate = []

    for indice, pagina in enumerate(doc):
        blocchi = pagina.get_text('dict')['blocks']

        immagini = [
            fitz.Rect(b['bbox'])
            for b in blocchi
            if b['type'] == 1
        ]

        testi = []
        numeri = []

        for b in blocchi:
            if b['type'] != 0:
                continue

            contenuto = ' '.join(
                ''.join(s['text'] for s in l['spans'])
                for l in b['lines']
            ).strip()

            if not contenuto:
                continue

            r = fitz.Rect(b['bbox'])

            if (
                contenuto == str(indice + 1)
                and r.y0 > pagina.rect.height * 0.88
            ):
                numeri.append(r)
            else:
                testi.append((contenuto, r))

        if len(immagini) != 1 or len(testi) > 1 or not numeri:
            out.insert_pdf(
                doc, from_page=indice, to_page=indice,
                links=True, annots=True
            )
            continue

        foto = immagini[0]
        insieme = foto

        if len(testi) == 1:
            didascalia = testi[0][1]

            if not (
                foto.y1 <= didascalia.y0 <= foto.y1 + 40
            ):
                out.insert_pdf(
                    doc, from_page=indice, to_page=indice,
                    links=True, annots=True
                )
                continue

            insieme = foto | didascalia

        alto = MARGINE_MM * PT_PER_MM
        basso = pagina.rect.height - alto

        spostamento = (
            (alto + basso) / 2
            - (insieme.y0 + insieme.y1) / 2
        )

        if (
            abs(spostamento) < 8
            or insieme.y0 + spostamento < alto
            or insieme.y1 + spostamento > basso
        ):
            out.insert_pdf(
                doc, from_page=indice, to_page=indice,
                links=True, annots=True
            )
            continue

        nuova = out.new_page(
            width=pagina.rect.width,
            height=pagina.rect.height
        )

        ritaglio = fitz.Rect(
            insieme.x0 - 2,
            insieme.y0 - 2,
            insieme.x1 + 2,
            insieme.y1 + 2
        )

        nuova.show_pdf_page(
            ritaglio + (0, spostamento, 0, spostamento),
            doc, indice, clip=ritaglio,
            keep_proportion=True
        )

        for r in numeri:
            area = fitz.Rect(
                r.x0 - 2, r.y0 - 2,
                r.x1 + 2, r.y1 + 2
            )

            nuova.show_pdf_page(
                area, doc, indice,
                clip=area, keep_proportion=True
            )

        centrate.append(indice + 1)

    if not centrate:
        out.close()
        doc.close()
        import shutil
        shutil.copy2(sorgente, destinazione)
        print('Nessuna pagina da centrare: PDF conservato invariato')
        return

    out.save(destinazione, garbage=4, deflate=True)
    out.close()
    doc.close()

    print('Creato:', destinazione)
    print('Pagine centrate:', ', '.join(map(str, centrate)))


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(
            'Uso: python3 centra_foto_isolate.py file.pdf'
        )

    for file in sys.argv[1:]:
        elabora(file)
