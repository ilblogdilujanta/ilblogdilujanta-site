import { BetaAnalyticsDataClient } from "@google-analytics/data";

const analyticsDataClient = new BetaAnalyticsDataClient({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
});

const PROPERTY_ID = process.env.GA_PROPERTY_ID;

export default async () => {
  try {
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [
        {
          startDate: "30daysAgo",
          endDate: "today",
        },
      ],
      dimensions: [
        {
          name: "pagePath",
        },
        {
          name: "pageTitle",
        },
      ],
      metrics: [
        {
          name: "screenPageViews",
        },
      ],
      dimensionFilter: {
        filter: {
          fieldName: "pagePath",
          stringFilter: {
            matchType: "BEGINS_WITH",
            value: "/articoli/",
          },
        },
      },
      orderBys: [
        {
          metric: {
            metricName: "screenPageViews",
          },
          desc: true,
        },
      ],
      limit: 100,
    });

    const mappaArticoli = new Map();

    for (const row of response.rows || []) {
      let path = row.dimensionValues[0].value;
      const title = row.dimensionValues[1].value;
      const views = Number(row.metricValues[0].value);

      // Elimina query string ed eventuale slash finale
      path = path.split("?")[0].replace(/\/+$/, "");

      // Esclude la pagina generale /articoli e la homepage
      if (!path || path === "/" || path === "/articoli") {
        continue;
      }

      // Accorpa eventuali righe GA4 riferite allo stesso articolo
      if (mappaArticoli.has(path)) {
        const articolo = mappaArticoli.get(path);
        articolo.views += views;
      } else {
        mappaArticoli.set(path, {
          path,
          title,
          views,
        });
      }
    }

    // Ordina nuovamente dopo avere unito i duplicati
    const articoli = Array.from(mappaArticoli.values())
      .sort((a, b) => b.views - a.views)
      .slice(0, 9);

    return new Response(JSON.stringify(articoli), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Errore Google Analytics:", error);

    return new Response(
      JSON.stringify({
        error: "Impossibile recuperare gli articoli più letti",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
};