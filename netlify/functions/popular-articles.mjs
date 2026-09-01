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
            caseSensitive: false,
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

      // Ne chiediamo più di 8 e filtriamo dopo
      limit: 50,
    });

    const articoli = (response.rows || [])
      .map((row) => ({
        path: row.dimensionValues?.[0]?.value || "",
        title: row.dimensionValues?.[1]?.value || "",
        views: Number(row.metricValues?.[0]?.value || 0),
      }))

      // Accetta SOLO veri articoli:
      // /articoli/2016/...
      // /articoli/2025/...
      // ecc.
      .filter((articolo) => {
        const path = articolo.path.replace(/\/+$/, "");

        return /^\/articoli\/\d{4}\//.test(path);
      })

      // Evita eventuali duplicati dello stesso URL
      .filter(
        (articolo, index, array) =>
          array.findIndex((item) => item.path === articolo.path) === index
      )

      // Prende infine gli 8 più letti
      .slice(0, 9);

    return new Response(JSON.stringify(articoli), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
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
          "Cache-Control": "no-store",
        },
      }
    );
  }
};