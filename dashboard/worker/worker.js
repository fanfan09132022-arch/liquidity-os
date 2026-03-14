const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

async function proxy(upstreamUrl, contentType = "application/json", headers = {}) {
  const response = await fetch(upstreamUrl, {
    headers: {
      Accept: contentType === "text/plain" ? "text/plain" : "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; LiquidityOS/1.0; +https://liquidityos.app)",
      ...headers,
    },
  });

  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: {
      "Content-Type": contentType,
      ...CORS,
    },
  });
}

function normalizeFredCsv(csvText, limit = 260) {
  const observations = String(csvText || "")
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => {
      const [date, value] = line.split(",");
      return { date, value };
    })
    .filter((row) => row.date && row.value && row.value !== ".")
    .slice(-limit)
    .reverse();

  return JSON.stringify({ observations });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    const { pathname, searchParams } = new URL(request.url);

    try {
      if (pathname === "/api/fg") {
        const limit = searchParams.get("limit") || "5";
        return proxy(`https://api.alternative.me/fng/?limit=${limit}`);
      }

      if (pathname === "/api/funding") {
        return proxy("https://www.okx.com/api/v5/public/funding-rate?instId=BTC-USDT-SWAP", "application/json", {
          Origin: "https://www.okx.com",
          Referer: "https://www.okx.com/",
        });
      }

      if (pathname === "/api/oi") {
        return proxy("https://www.okx.com/api/v5/public/open-interest?instType=SWAP&instId=BTC-USDT-SWAP", "application/json", {
          Origin: "https://www.okx.com",
          Referer: "https://www.okx.com/",
        });
      }

      if (pathname.startsWith("/api/fred/")) {
        const series = pathname.slice("/api/fred/".length);
        const fredKey = env?.FRED_API_KEY;
        if (fredKey) {
          return proxy(
            `https://api.stlouisfed.org/fred/series/observations?series_id=${series}&api_key=${fredKey}&file_type=json&sort_order=desc&limit=260`
          );
        }

        const csvResponse = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${series}`, {
          headers: {
            Accept: "text/plain",
            "User-Agent": "Mozilla/5.0 (compatible; LiquidityOS/1.0; +https://liquidityos.app)",
          },
        });
        const csvText = await csvResponse.text();
        return new Response(normalizeFredCsv(csvText), {
          status: csvResponse.status,
          headers: { "Content-Type": "application/json", ...CORS },
        });
      }

      if (pathname === "/api/cg/markets") {
        const category = searchParams.get("category") || "meme-token";
        const perPage = searchParams.get("per_page") || "50";
        const page = searchParams.get("page") || "1";
        return proxy(
          `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=${category}&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=false&price_change_percentage=24h`
        );
      }

      if (pathname.startsWith("/api/cg/chart/")) {
        const coinId = pathname.slice("/api/cg/chart/".length);
        const days = searchParams.get("days") || "30";
        return proxy(`https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`);
      }

      if (pathname.startsWith("/api/llama/dex/")) {
        const chain = pathname.slice("/api/llama/dex/".length);
        return proxy(
          `https://api.llama.fi/overview/dexs/${chain}?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true&dataType=dailyVolume`
        );
      }

      if (pathname === "/api/llama/stablecoins") {
        return proxy("https://stablecoins.llama.fi/stablecoins?includePrices=true");
      }

      if (pathname === "/api/llama/stable-chart") {
        return proxy("https://stablecoins.llama.fi/stablecoincharts/all");
      }

      if (pathname.startsWith("/api/llama/stable-chart/")) {
        const chain = pathname.slice("/api/llama/stable-chart/".length);
        return proxy(`https://stablecoins.llama.fi/stablecoincharts/${chain}`);
      }

      return new Response(JSON.stringify({ error: "unknown_route", pathname }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: "proxy_failed", message: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }
  },
};
