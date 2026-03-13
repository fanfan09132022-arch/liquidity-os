// LiquidityOS Data Proxy · Cloudflare Worker
// 所有外部数据源通过此 Worker 中转，消除 CORS 问题并提供服务端缓存

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// 各接口缓存时长（秒）
const TTL = {
  fg: 3600,        // F&G 指数：1小时
  binance: 300,    // Binance 衍生品数据：5分钟
  cg: 300,         // CoinGecko 市场：5分钟
  cgChart: 3600,   // CoinGecko 图表：1小时
  llama: 1800,     // DeFiLlama：30分钟
  fred: 86400,     // FRED 宏观数据：24小时（周更新）
};

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders, ...CORS },
  });
}

function normalizeFredCsv(csvText, limit = 260) {
  const lines = csvText.trim().split("\n").slice(1);
  const observations = lines
    .map((line) => {
      const [date, value] = line.split(",");
      return { date, value };
    })
    .filter((row) => row.date && row.value && row.value !== ".")
    .slice(-limit)
    .reverse();
  return JSON.stringify({ observations });
}

async function fetchFredSeries(series, fredKey, ttl) {
  const cache = caches.default;
  const cacheKey = new Request(`https://liquidityos-data.fanfan09132022.workers.dev/api/fred/${series}`);

  try {
    const cached = await cache.match(cacheKey);
    if (cached) {
      return jsonResponse(await cached.text(), cached.status, {
        "X-Cache": "HIT",
        "Cache-Control": `public, max-age=${ttl}`,
      });
    }
  } catch (e) {
    console.error("fred_cache_match_failed", series, e);
  }

  const apiUrl = fredKey
    ? `https://api.stlouisfed.org/fred/series/observations?series_id=${series}&api_key=${encodeURIComponent(fredKey)}&file_type=json&sort_order=desc&limit=260`
    : null;

  if (apiUrl) {
    try {
      const upstream = await fetch(apiUrl, { headers: { Accept: "application/json" }, redirect: "follow" });
      if (upstream.ok) {
        const body = await upstream.text();
        try {
          await cache.put(
            cacheKey,
            new Response(body, { status: upstream.status, headers: { "Cache-Control": `public, max-age=${ttl}` } }),
          );
        } catch (e) {
          console.error("fred_cache_put_failed", series, e);
        }
        return jsonResponse(body, upstream.status, { "X-Cache": "MISS", "Cache-Control": `public, max-age=${ttl}` });
      }
      console.error("fred_api_failed", series, upstream.status);
    } catch (e) {
      console.error("fred_api_fetch_failed", series, e);
    }
  }

  try {
    const csvUrl = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${series}`;
    const upstream = await fetch(csvUrl, { headers: { Accept: "text/plain" }, redirect: "follow" });
    if (!upstream.ok) {
      return jsonResponse(JSON.stringify({ error: "fred_upstream_failed", series, status: upstream.status }), upstream.status);
    }
    const body = normalizeFredCsv(await upstream.text());
    try {
      await cache.put(
        cacheKey,
        new Response(body, { status: 200, headers: { "Cache-Control": `public, max-age=${ttl}` } }),
      );
    } catch (e) {
      console.error("fred_csv_cache_put_failed", series, e);
    }
    return jsonResponse(body, 200, { "X-Cache": "MISS", "Cache-Control": `public, max-age=${ttl}` });
  } catch (e) {
    return jsonResponse(JSON.stringify({ error: "fred_fetch_failed", series, message: e.message }), 502);
  }
}

async function proxy(upstreamUrl, ttl, contentType = "application/json", init = {}) {
  const cache = caches.default;
  const cacheKey = new Request(upstreamUrl);

  try {
    const cached = await cache.match(cacheKey);
    if (cached) {
      const body = await cached.text();
      return new Response(body, {
        status: cached.status,
        headers: { "Content-Type": contentType, "X-Cache": "HIT", "Cache-Control": `public, max-age=${ttl}`, ...CORS },
      });
    }
  } catch (e) {
    console.error("cache_match_failed", upstreamUrl, e);
  }

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LiquidityOS/1.0; +https://liquidityos.app)",
        Accept: "application/json",
        ...(init.headers || {}),
      },
      redirect: "follow",
      ...init,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "upstream_fetch_failed", message: e.message, upstreamUrl }), {
      status: 502, headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  const body = await upstream.text();

  if (upstream.ok) {
    try {
      const toCache = new Response(body, {
        status: upstream.status,
        headers: { "Cache-Control": `public, max-age=${ttl}` },
      });
      await cache.put(cacheKey, toCache);
    } catch (e) {
      console.error("cache_put_failed", upstreamUrl, e);
    }
  }

  return new Response(body, {
    status: upstream.status,
    headers: { "Content-Type": contentType, "X-Cache": "MISS", "Cache-Control": `public, max-age=${ttl}`, ...CORS },
  });
}

export default {
  async fetch(request, env) {
    // OPTIONS 预检
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    const { pathname, searchParams } = new URL(request.url);

    // ── Fear & Greed ─────────────────────────────────────────────
    // GET /api/fg?limit=5
    if (pathname === "/api/fg") {
      const limit = searchParams.get("limit") || "5";
      return proxy(`https://api.alternative.me/fng/?limit=${limit}`, TTL.fg);
    }

    // ── Binance Futures：资金费率 ──────────────────────────────────
    // GET /api/funding?symbol=BTCUSDT
    if (pathname === "/api/funding") {
      return proxy("https://www.okx.com/api/v5/public/funding-rate?instId=BTC-USDT-SWAP", TTL.binance, "application/json", {
        headers: {
          Origin: "https://www.okx.com",
          Referer: "https://www.okx.com/",
        },
      });
    }

    // ── Binance Futures：未平仓合约 OI ────────────────────────────
    // GET /api/oi?symbol=BTCUSDT
    if (pathname === "/api/oi") {
      return proxy("https://www.okx.com/api/v5/public/open-interest?instType=SWAP&instId=BTC-USDT-SWAP", TTL.binance, "application/json", {
        headers: {
          Origin: "https://www.okx.com",
          Referer: "https://www.okx.com/",
        },
      });
    }

    // ── Binance Futures：多空比 ───────────────────────────────────
    // GET /api/ls-ratio?symbol=BTCUSDT&period=5m&limit=1
    if (pathname === "/api/ls-ratio") {
      const sym = searchParams.get("symbol") || "BTCUSDT";
      const period = searchParams.get("period") || "5m";
      const limit = searchParams.get("limit") || "1";
      return proxy(
        `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${sym}&period=${period}&limit=${limit}`,
        TTL.binance,
      );
    }

    // ── CoinGecko：Meme 市值列表 ──────────────────────────────────
    // GET /api/cg/markets?category=meme-token&per_page=50&page=1
    if (pathname === "/api/cg/markets") {
      const cat = searchParams.get("category") || "meme-token";
      const per = searchParams.get("per_page") || "50";
      const page = searchParams.get("page") || "1";
      return proxy(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=${cat}&order=market_cap_desc&per_page=${per}&page=${page}&sparkline=false&price_change_percentage=24h`,
        TTL.cg,
      );
    }

    // ── CoinGecko：币种历史图表 ───────────────────────────────────
    // GET /api/cg/chart/:coinId?days=30
    if (pathname.startsWith("/api/cg/chart/")) {
      const coinId = pathname.slice("/api/cg/chart/".length);
      const days = searchParams.get("days") || "30";
      return proxy(
        `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`,
        TTL.cgChart,
      );
    }

    // ── DeFiLlama：DEX 交易量（按链）────────────────────────────
    // GET /api/llama/dex/:chain  (chain = solana | base | bsc)
    if (pathname.startsWith("/api/llama/dex/")) {
      const chain = pathname.slice("/api/llama/dex/".length);
      return proxy(
        `https://api.llama.fi/overview/dexs/${chain}?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true&dataType=dailyVolume`,
        TTL.llama,
      );
    }

    // ── DeFiLlama：稳定币列表 ─────────────────────────────────────
    // GET /api/llama/stablecoins
    if (pathname === "/api/llama/stablecoins") {
      return proxy("https://stablecoins.llama.fi/stablecoins?includePrices=true", TTL.llama);
    }

    // ── DeFiLlama：稳定币历史（全链）────────────────────────────
    // GET /api/llama/stable-chart
    if (pathname === "/api/llama/stable-chart") {
      return proxy("https://stablecoins.llama.fi/stablecoincharts/all", TTL.llama);
    }

    // ── DeFiLlama：稳定币历史（指定链）──────────────────────────
    // GET /api/llama/stable-chart/:chain  (chain = Solana | Ethereum | BSC | Base)
    if (pathname.startsWith("/api/llama/stable-chart/")) {
      const chain = pathname.slice("/api/llama/stable-chart/".length);
      return proxy(`https://stablecoins.llama.fi/stablecoincharts/${chain}`, TTL.llama);
    }

    // ── FRED：宏观 CSV 数据 ───────────────────────────────────────
    // GET /api/fred/:series  (series = WALCL | WTREGEN | RRPONTSYD)
    if (pathname.startsWith("/api/fred/")) {
      const series = pathname.slice("/api/fred/".length);
      const fredKey = env?.FRED_API_KEY || null;
      return fetchFredSeries(series, fredKey, TTL.fred);
    }

    // 未匹配路由
    return new Response(JSON.stringify({ error: "unknown_route", pathname }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  },
};
