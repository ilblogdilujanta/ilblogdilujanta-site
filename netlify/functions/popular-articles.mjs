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
        andGroup: {
          expressions: [
            // Considera esclusivamente le pagine degli articoli
            {
              filter: {
                fieldName: "pagePath",
                stringFilter: {
                  matchType: "BEGINS_WITH",
                  value: "/articoli/",
                  caseSensitive: false,
                },
              },
            },

            // Esclude la pagina generale "Articoli"
            // sia con sia senza slash finale
            {
              notExpression: {
                filter: {
                  fieldName: "pagePath",
                  inListFilter: {
                    values: [
                      "/articoli",
                      "/articoli/",
                    ],
                    caseSensitive: false,
                  },
                },
              },
            },
          ],
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

      // 8 articoli più letti
      limit: 9,
    });

    const articoli = (response.rows || [])
      .map((row) => ({
        path: row.dimensionValues?.[0]?.value || "",
        title: row.dimensionValues?.[1]?.value || "",
        views: Number(row.metricValues?.[0]?.value || 0),
      }))

      // Ulteriore sicurezza:
      // elimina comunque l'indice /articoli
      .filter((articolo) => {
        const path = articolo.path.replace(/\/+$/, "");

        return (
          path !== "/articoli" &&
          path.startsWith("/articoli/")
        );
      })

      .slice(0, 9);

    return new Response(JSON.stringify(articoli), {
      status: 200,
      headers: {
        "Content-Type": "application/json",

        // Durante i test niente cache:
        // così vedi immediatamente il nuovo risultato.
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