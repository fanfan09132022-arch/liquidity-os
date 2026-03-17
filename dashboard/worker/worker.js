const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; LiquidityOS/1.0; +https://liquidityos.app)",
};

const OKX_HEADERS = {
  Origin: "https://www.okx.com",
  Referer: "https://www.okx.com/",
};

const CACHE_TTL = {
  fg: 3600,
  binance: 300,
  cg: 1800,
  cgChart: 3600,
  llama: 1800,
  fred: 86400,
  all: 3600,
};

const INTERNAL_CACHE_ORIGIN = "https://liquidityos-data.internal";
const WORKER_PUBLIC_URL = "https://liquidityos-data.fanfan09132022.workers.dev";
const CACHE_NAMESPACE = "v20260315-fix12";

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
      ...CORS,
    },
  });
}

function textResponse(body, status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain",
      ...extraHeaders,
      ...CORS,
    },
  });
}

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function isRateLimited(status, bodyText) {
  return status === 429 || status === 1015 || /1015/.test(String(bodyText || "")) || /rate limit/i.test(String(bodyText || ""));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rawFetch(url, { headers = {}, accept = "application/json", timeoutMs = 3500 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("upstream_timeout"), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: accept,
        ...DEFAULT_HEADERS,
        ...headers,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function proxy(upstreamUrl, contentType = "application/json", headers = {}) {
  const response = await rawFetch(upstreamUrl, {
    headers,
    accept: contentType === "text/plain" ? "text/plain" : "application/json",
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

async function getCachedJson(cachePath, ttl, producer) {
  const cache = caches.default;
  const cacheKey = new Request(`${INTERNAL_CACHE_ORIGIN}/${CACHE_NAMESPACE}${cachePath}`, { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) {
    return cached.json();
  }

  const data = await producer();
  const response = jsonResponse(data, 200, { "Cache-Control": `public, max-age=${ttl}` });
  await cache.put(cacheKey, response.clone());
  return data;
}

async function fetchJsonOrThrow(url, options = {}) {
  const response = await rawFetch(url, options);
  const body = await response.text();
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return JSON.parse(body);
}

async function fetchJsonSafe(url, options = {}) {
  try {
    return await fetchJsonOrThrow(url, options);
  } catch {
    return null;
  }
}

async function fetchWorkerJson(path) {
  return fetchJsonOrThrow(`${WORKER_PUBLIC_URL}${path}`, { timeoutMs: 12000 });
}

async function fetchJsonWithRetry(url, options = {}, retries = 1, delayMs = 600) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchJsonOrThrow(url, options);
    } catch (error) {
      lastError = error;
      const shouldRetry = attempt < retries && (
        error?.status === 429 ||
        /upstream_timeout/i.test(String(error?.message || "")) ||
        /HTTP 429/i.test(String(error?.message || ""))
      );
      if (!shouldRetry) break;
      await sleep(delayMs);
    }
  }
  throw lastError || new Error("fetch_failed");
}

async function fetchTextOrThrow(url, options = {}) {
  const response = await rawFetch(url, options);
  const body = await response.text();
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
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

  return { observations };
}

async function getFredObservations(series, env) {
  return getCachedJson(`/api/fred/${series}`, CACHE_TTL.fred, async () => {
  const fredKey = env?.FRED_API_KEY;
  if (fredKey) {
    const payload = await fetchJsonOrThrow(
      `https://api.stlouisfed.org/fred/series/observations?series_id=${series}&api_key=${fredKey}&file_type=json&sort_order=desc&limit=260`
    );
    return Array.isArray(payload?.observations)
      ? payload.observations.filter((item) => item?.date && item?.value && item.value !== ".")
      : [];
  }

  const csvText = await fetchTextOrThrow(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${series}`, {
    accept: "text/plain",
  });
  return normalizeFredCsv(csvText).observations;
  });
}

function latestObservation(observations) {
  return Array.isArray(observations) ? observations.find((item) => item?.date && item?.value && item.value !== ".") || null : null;
}

function parseStableHistoryPoints(payload) {
  const rows = Array.isArray(payload) ? payload : payload?.chart || payload?.data || [];
  return rows
    .map((item) => {
      const timestamp = toNumber(item?.date);
      const value = toNumber(item?.totalCirculatingUSD)
        ?? toNumber(item?.totalCirculating?.peggedUSD)
        ?? toNumber(item?.totalCirculatingUSD?.peggedUSD)
        ?? toNumber(item?.peggedUSD);

      if (timestamp == null || value == null) return null;
      return { timestamp: timestamp > 1e12 ? timestamp : timestamp * 1000, value };
    })
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp);
}

function getCurrentAndPast(points, periodsBack = 7) {
  if (!Array.isArray(points) || !points.length) return { current: null, past: null };
  const current = points[points.length - 1] || null;
  const past = points.length > periodsBack ? points[points.length - 1 - periodsBack] : null;
  return { current, past };
}

function buildDexSummary(payload) {
  return {
    total_24h: toNumber(payload?.total24h),
    change_1d_pct: null,
  };
}

function getStableChartUsd(item) {
  return toNumber(item?.totalCirculatingUSD)
    ?? toNumber(item?.totalCirculating?.peggedUSD)
    ?? null;
}

function buildStableChainSummary(payload) {
  const rows = Array.isArray(payload) ? payload : [];
  const latest = rows[rows.length - 1] || null;
  const weekAgo = rows[rows.length - 8] || rows[0] || null;
  const latestUsd = getStableChartUsd(latest);
  const weekAgoUsd = getStableChartUsd(weekAgo);
  return {
    current: latestUsd,
    net_inflow_7d: latestUsd != null && weekAgoUsd != null ? latestUsd - weekAgoUsd : null,
  };
}

function buildMemeRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((item, index) => ({
    rank: index + 1,
    token: String(item?.symbol || "").toUpperCase(),
    name: item?.name || "",
    image: item?.image || null,
    logo: item?.image || null,
    price: toNumber(item?.current_price),
    market_cap: toNumber(item?.market_cap),
    change_24h_pct: toNumber(item?.price_change_percentage_24h),
    change_7d_pct: toNumber(item?.price_change_percentage_7d_in_currency),
    volume_24h: toNumber(item?.total_volume),
  }));
}

const MEME_KEYWORDS = [
  "doge", "shib", "inu", "pepe", "bonk", "floki", "wif", "mog", "turbo", "brett",
  "popcat", "pengu", "cheems", "babydoge", "neiro", "ponke", "cat", "goat",
  "fartcoin", "wojak", "meme", "pnut", "giga", "kek", "mog", "snek",
];

function isLikelyMemeTicker(item) {
  const haystack = `${item?.symbol || ""} ${item?.name || ""} ${item?.nameid || ""}`.toLowerCase();
  return MEME_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

async function getCoinLoreMemeRows() {
  const pages = [0, 100, 200, 300];
  const allRows = [];
  for (const start of pages) {
    const payload = await fetchJsonOrThrow(
      `https://api.coinlore.net/api/tickers/?start=${start}&limit=100`,
      { timeoutMs: 5000 }
    );
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    allRows.push(...rows);
    if (start < 300) await sleep(400);
  }
  return allRows
    .sort((a, b) => (toNumber(b?.market_cap_usd) || 0) - (toNumber(a?.market_cap_usd) || 0))
    .slice(0, 50)
    .map((item, index) => ({
      rank: index + 1,
      token: String(item?.symbol || "").toUpperCase(),
      name: item?.name || "",
      image: null,
      logo: null,
      price: toNumber(item?.price_usd),
      market_cap: toNumber(item?.market_cap_usd),
      change_24h_pct: toNumber(item?.percent_change_24h),
      change_7d_pct: toNumber(item?.percent_change_7d),
      volume_24h: toNumber(item?.volume24),
    }));
}

async function getCoinPaprikaMemeRows() {
  const MEME_KEYWORDS = [
    "doge", "shib", "inu", "pepe", "bonk", "floki", "wif", "mog", "turbo", "brett",
    "popcat", "pengu", "cheems", "babydoge", "neiro", "ponke", "cat", "goat",
    "fartcoin", "wojak", "meme", "pnut", "giga", "kek", "snek", "trump", "melania",
  ];

  const payload = await fetchJsonOrThrow(
    "https://api.coinpaprika.com/v1/tickers?limit=500",
    { timeoutMs: 8000 }
  );
  const rows = Array.isArray(payload) ? payload : [];

  return rows
    .filter(item => {
      const hay = `${item?.symbol || ""} ${item?.name || ""} ${item?.id || ""}`.toLowerCase();
      return MEME_KEYWORDS.some(k => hay.includes(k));
    })
    .sort((a, b) => (toNumber(b?.quotes?.USD?.market_cap) || 0) - (toNumber(a?.quotes?.USD?.market_cap) || 0))
    .slice(0, 50)
    .map((item, index) => ({
      rank: index + 1,
      token: String(item?.symbol || "").toUpperCase(),
      name: item?.name || "",
      image: null,
      logo: null,
      price: toNumber(item?.quotes?.USD?.price),
      market_cap: toNumber(item?.quotes?.USD?.market_cap),
      change_24h_pct: toNumber(item?.quotes?.USD?.percent_change_24h),
      change_7d_pct: toNumber(item?.quotes?.USD?.percent_change_7d),
      volume_24h: toNumber(item?.quotes?.USD?.volume_24h),
    }));
}

function buildMemeSummary(rows) {
  const marketCap = rows.reduce((sum, item) => sum + (toNumber(item?.market_cap) || 0), 0);
  const topTenChangeSum = rows
    .slice(0, 10)
    .reduce((sum, item) => sum + (toNumber(item?.change_24h_pct) ?? toNumber(item?.price_change_percentage_24h) ?? 0), 0);
  return {
    mcap: marketCap || null,
    mcap_change_24h: rows.length ? topTenChangeSum / 10 : null,
  };
}

function averageCloseFromKlines(klines) {
  const closes = (Array.isArray(klines) ? klines : [])
    .map((row) => (Array.isArray(row) ? toNumber(row[4]) : null))
    .filter((value) => value != null);
  if (!closes.length) return null;
  return closes.reduce((sum, value) => sum + value, 0) / closes.length;
}

async function getFearGreed(limit = "5") {
  return getCachedJson(`/api/fg?limit=${limit}`, CACHE_TTL.fg, async () => (
    fetchJsonWithRetry(`https://api.alternative.me/fng/?limit=${limit}`, { timeoutMs: 7000 }, 1, 700)
  ));
}

async function fetchFearGreedLive(limit = "5") {
  return fetchJsonWithRetry(`https://api.alternative.me/fng/?limit=${limit}`, { timeoutMs: 7000 }, 1, 700);
}

async function getCgMarkets(category = "meme-token", perPage = "50", page = "1") {
  return getCachedJson(
    `/api/cg/markets?category=${category}&per_page=${perPage}&page=${page}`,
    CACHE_TTL.cg,
    async () => (
      fetchJsonWithRetry(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=${category}&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=false&price_change_percentage=24h,7d`,
        { timeoutMs: 8000 },
        2,
        1200
      )
    )
  );
}

async function getMemeCategorySummary() {
  return getCachedJson(
    "/internal/cg/meme-category",
    CACHE_TTL.cg,
    async () => {
      const data = await fetchJsonWithRetry(
        "https://api.coingecko.com/api/v3/coins/categories",
        { timeoutMs: 8000 },
        2,
        1500
      );
      const cat = Array.isArray(data)
        ? data.find(c => c.id === "meme-token") || data[0]
        : data;
      return {
        mcap: toNumber(cat?.market_cap),
        mcap_change_24h: toNumber(cat?.market_cap_change_24h),
      };
    }
  );
}

async function getMemeSummaryPayload() {
  return getCachedJson("/api/meme-summary", 900, async () => {
    const data = await fetchJsonWithRetry(
      "https://api.coingecko.com/api/v3/coins/categories",
      { timeoutMs: 8000 },
      2,
      1500
    );
    const cat = Array.isArray(data)
      ? data.find(c => c.id === "meme-token") || null
      : null;
    if (!cat) throw new Error("meme-token category not found");
    return {
      mcap: toNumber(cat.market_cap),
      mcap_change_24h: toNumber(cat.market_cap_change_24h),
      source: "CoinGecko-categories",
      updated_at: new Date().toISOString(),
    };
  });
}

async function getCgChart(coinId, days = "30", interval = "") {
  const intervalParam = interval ? `&interval=${interval}` : "";
  return getCachedJson(
    `/api/cg/chart/${coinId}?days=${days}${interval ? `&interval=${interval}` : ""}`,
    CACHE_TTL.cgChart,
    async () => (
      fetchJsonWithRetry(
        `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}${intervalParam}`,
        { timeoutMs: 9000 },
        2,
        1200
      )
    )
  );
}

async function fetchCgMarketsLive(category = "meme-token", perPage = "50", page = "1") {
  return fetchJsonWithRetry(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=${category}&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=false&price_change_percentage=24h,7d`,
    { timeoutMs: 8000 },
    1,
    1200
  );
}

async function getBtcSnapshot(now) {
  return getCachedJson("/internal/btc-snapshot", CACHE_TTL.binance, async () => {
    const stats = await fetchJsonSafe("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT", { timeoutMs: 7000 });
    const cgPricePayload = stats?.lastPrice != null
      ? null
      : await fetchJsonWithRetry(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true",
        { timeoutMs: 7000 },
        2,
        1200
      );
    const cgHistory = await getCgChart("bitcoin", "200", "daily");
    const prices200 = Array.isArray(cgHistory?.prices) ? cgHistory.prices.slice(-200) : [];

    const btcPrice = toNumber(stats?.lastPrice) ?? toNumber(cgPricePayload?.bitcoin?.usd);
    const ma200 = prices200.length
      ? prices200.reduce((sum, point) => sum + (Array.isArray(point) ? (toNumber(point[1]) || 0) : 0), 0) / prices200.length
      : null;
    const vsMa200Pct = btcPrice != null && ma200 ? ((btcPrice / ma200) - 1) * 100 : null;

    return {
      price: btcPrice,
      change_24h: toNumber(stats?.priceChangePercent) ?? toNumber(cgPricePayload?.bitcoin?.usd_24h_change),
      source: toNumber(stats?.lastPrice) != null ? "Binance" : toNumber(cgPricePayload?.bitcoin?.usd) != null ? "CoinGecko" : null,
      ma_200: ma200 != null ? Number(ma200.toFixed(2)) : null,
      ma_source: ma200 != null ? "CoinGecko" : null,
      vs_ma_200_pct: vsMa200Pct != null ? Number(vsMa200Pct.toFixed(2)) : null,
      updated_at: now,
    };
  });
}

async function fetchBtcSnapshotLive(now) {
  const stats = await fetchJsonSafe("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT", { timeoutMs: 7000 });
  const cgPricePayload = stats?.lastPrice != null
    ? null
    : await fetchJsonWithRetry(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true",
      { timeoutMs: 7000 },
      1,
      1200
    );
  const coinLorePayload = btcPriceFallbackMissing(stats, cgPricePayload)
    ? await fetchJsonSafe("https://api.coinlore.net/api/ticker/?id=90", { timeoutMs: 7000 })
    : null;
  const coinLoreBtc = Array.isArray(coinLorePayload) ? coinLorePayload[0] : null;
  const cgHistory = await getCgChart("bitcoin", "200", "daily");
  const prices200 = Array.isArray(cgHistory?.prices) ? cgHistory.prices.slice(-200) : [];

  const btcPrice = toNumber(stats?.lastPrice) ?? toNumber(cgPricePayload?.bitcoin?.usd) ?? toNumber(coinLoreBtc?.price_usd);
  const ma200 = prices200.length
    ? prices200.reduce((sum, point) => sum + (Array.isArray(point) ? (toNumber(point[1]) || 0) : 0), 0) / prices200.length
    : null;
  const vsMa200Pct = btcPrice != null && ma200 ? ((btcPrice / ma200) - 1) * 100 : null;

  return {
    price: btcPrice,
    change_24h: toNumber(stats?.priceChangePercent) ?? toNumber(cgPricePayload?.bitcoin?.usd_24h_change) ?? toNumber(coinLoreBtc?.percent_change_24h),
    source: toNumber(stats?.lastPrice) != null ? "Binance" : toNumber(cgPricePayload?.bitcoin?.usd) != null ? "CoinGecko" : toNumber(coinLoreBtc?.price_usd) != null ? "CoinLore" : null,
    ma_200: ma200 != null ? Number(ma200.toFixed(2)) : null,
    ma_source: ma200 != null ? "CoinGecko" : null,
    vs_ma_200_pct: vsMa200Pct != null ? Number(vsMa200Pct.toFixed(2)) : null,
    updated_at: now,
  };
}

function btcPriceFallbackMissing(stats, cgPricePayload) {
  return toNumber(stats?.lastPrice) == null && toNumber(cgPricePayload?.bitcoin?.usd) == null;
}

async function getLlamaStableChart(chain = "") {
  const path = chain ? `/api/llama/stable-chart/${chain}` : "/api/llama/stable-chart";
  const upstream = chain
    ? `https://stablecoins.llama.fi/stablecoincharts/${chain}`
    : "https://stablecoins.llama.fi/stablecoincharts/all";
  return getCachedJson(path, CACHE_TTL.llama, async () => fetchJsonWithRetry(upstream, { timeoutMs: 5000 }, 2, 1200));
}

async function fetchLlamaStableChartLive(chain = "") {
  const upstream = chain
    ? `https://stablecoins.llama.fi/stablecoincharts/${chain}`
    : "https://stablecoins.llama.fi/stablecoincharts/all";
  return fetchJsonWithRetry(upstream, { timeoutMs: 5000 }, 1, 1200);
}

function pickChainTvl(rows, names = []) {
  const lowered = new Set(names.map((name) => String(name).toLowerCase()));
  const hit = (Array.isArray(rows) ? rows : []).find((row) => lowered.has(String(row?.name || row?.tokenSymbol || "").toLowerCase()));
  return toNumber(hit?.tvl) ?? null;
}

async function getChainTvls() {
  return getCachedJson("/internal/llama/chains", CACHE_TTL.llama, async () => {
    const payload = await fetchJsonOrThrow("https://api.llama.fi/v2/chains", { timeoutMs: 3200 });
    const rows = Array.isArray(payload) ? payload : [];
    return {
      solana: pickChainTvl(rows, ["solana"]),
      ethereum: pickChainTvl(rows, ["ethereum"]),
      bsc: pickChainTvl(rows, ["bsc", "binance", "binance smart chain"]),
    };
  });
}

async function fetchChainTvlsLive() {
  const payload = await fetchJsonOrThrow("https://api.llama.fi/v2/chains", { timeoutMs: 3200 });
  const rows = Array.isArray(payload) ? payload : [];
  return {
    solana: pickChainTvl(rows, ["solana"]),
    ethereum: pickChainTvl(rows, ["ethereum"]),
    bsc: pickChainTvl(rows, ["bsc", "binance", "binance smart chain"]),
  };
}

async function getLlamaDex(chain) {
  return getCachedJson(
    `/api/llama/dex/${chain}`,
    CACHE_TTL.llama,
    async () => fetchJsonWithRetry(
      `https://api.llama.fi/overview/dexs/${chain}?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true&dataType=dailyVolume`,
      { timeoutMs: 8000 },
      2,
      1200
    )
  );
}

async function fetchLlamaDexLive(chain) {
  return fetchJsonWithRetry(
    `https://api.llama.fi/overview/dexs/${chain}?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true&dataType=dailyVolume`,
    { timeoutMs: 8000 },
    1,
    1200
  );
}

async function fetchFredObservationsLive(series, env) {
  const fredKey = env?.FRED_API_KEY;
  if (fredKey) {
    const payload = await fetchJsonOrThrow(
      `https://api.stlouisfed.org/fred/series/observations?series_id=${series}&api_key=${fredKey}&file_type=json&sort_order=desc&limit=260`
    );
    return Array.isArray(payload?.observations)
      ? payload.observations.filter((item) => item?.date && item?.value && item.value !== ".")
      : [];
  }

  const csvText = await fetchTextOrThrow(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${series}`, {
    accept: "text/plain",
  });
  return normalizeFredCsv(csvText).observations;
}

function buildFredPayload(walcl, tga, rrp, now) {
  const fedLatest = latestObservation(walcl);
  const tgaLatest = latestObservation(tga);
  const rrpLatest = latestObservation(rrp);
  const fedValue = toNumber(fedLatest?.value);
  const tgaValue = toNumber(tgaLatest?.value);
  const rrpValue = toNumber(rrpLatest?.value);
  const walclT = fedValue != null ? fedValue / 1_000_000 : null;
  const wtregenT = tgaValue != null ? tgaValue / 1_000_000 : null;
  const rrpontsydT = rrpValue != null ? rrpValue / 1_000 : null;
  const gnlValueT = walclT != null && wtregenT != null && rrpontsydT != null
    ? Number((walclT - wtregenT - rrpontsydT).toFixed(3))
    : null;

  return {
    source: "FRED",
    updated_at: now,
    gnl: {
      value_t: gnlValueT,
      date: fedLatest?.date || tgaLatest?.date || rrpLatest?.date || null,
    },
    gnl_value_t: gnlValueT,
    walcl: walclT != null ? Number(walclT.toFixed(3)) : null,
    wtregen: wtregenT != null ? Number(wtregenT.toFixed(3)) : null,
    rrpontsyd: rrpontsydT != null ? Number(rrpontsydT.toFixed(3)) : null,
    date: fedLatest?.date || tgaLatest?.date || rrpLatest?.date || null,
    fed: fedLatest ? { value: fedValue, date: fedLatest.date } : null,
    tga: tgaLatest ? { value: tgaValue, date: tgaLatest.date } : null,
    rrp: rrpLatest ? { value: rrpValue, date: rrpLatest.date } : null,
  };
}

async function fundingProxyWithRetry() {
  const upstreamUrl = "https://www.okx.com/api/v5/public/funding-rate?instId=BTC-USDT-SWAP";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await rawFetch(upstreamUrl, {
        headers: OKX_HEADERS,
        accept: "application/json",
      });
      const body = await response.text();

      if (response.ok) {
        return new Response(body, {
          status: response.status,
          headers: { "Content-Type": "application/json", ...CORS },
        });
      }

      if (isRateLimited(response.status, body) && attempt === 0) {
        await sleep(500);
        continue;
      }

      if (isRateLimited(response.status, body)) {
        return jsonResponse({ error: "rate_limited" });
      }

      return new Response(body, {
        status: response.status,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    } catch (error) {
      if (attempt === 0) {
        await sleep(500);
        continue;
      }
      return jsonResponse({ error: "rate_limited", message: error.message });
    }
  }

  return jsonResponse({ error: "rate_limited" });
}

async function buildMacroSnapshot(env) {
  const now = new Date().toISOString();
  const errors = [];
  const readTask = async (key, task, fallback) => {
    try {
      return await task();
    } catch (error) {
      errors.push({ key, message: error?.message || "fetch_failed" });
      return fallback;
    }
  };

  const walcl = await readTask("fred_walcl", () => fetchFredObservationsLive("WALCL", env), []);
  await sleep(500);
  const tga = await readTask("fred_tga", () => fetchFredObservationsLive("WTREGEN", env), []);
  await sleep(500);
  const rrp = await readTask("fred_rrp", () => fetchFredObservationsLive("RRPONTSYD", env), []);
  await sleep(500);
  const tvl = await readTask("llama_chains", () => fetchChainTvlsLive(), { solana: null, ethereum: null, bsc: null });
  await sleep(500);
  const fgPayload = await readTask("fg", () => fetchFearGreedLive("1"), null);
  await sleep(500);
  const btcSnapshot = await readTask("btc_snapshot", () => getBtcSnapshot(now), {
    price: null,
    change_24h: null,
    source: null,
    ma_200: null,
    ma_source: null,
    vs_ma_200_pct: null,
    updated_at: now,
  });
  const stableHistoryPayload = await readTask("llama_stable_chart", () => getLlamaStableChart(), []);
  await sleep(650);
  const stableSolanaPayload = await readTask("llama_stable_solana", () => getLlamaStableChart("Solana"), []);
  await sleep(650);
  const stableBscPayload = await readTask("llama_stable_bsc", () => getLlamaStableChart("bsc"), []);
  await sleep(650);
  const dexSolanaPayload = await readTask("llama_dex_solana", () => getLlamaDex("solana"), null);
  await sleep(650);
  const dexBasePayload = await readTask("llama_dex_base", () => getLlamaDex("base"), null);
  await sleep(650);
  const dexBscPayload = await readTask("llama_dex_bsc", () => getLlamaDex("bsc"), null);
  const memeSummaryDirect = await readTask(
    "meme_summary",
    () => fetchWorkerJson("/api/meme-summary"),
    null
  );
  await sleep(800);
  let memeMarkets = await readTask("cg_markets", () => getCgMarkets("meme-token", "50", "1"), []);
  const memeSummary = memeSummaryDirect
    ? { mcap: memeSummaryDirect.mcap, mcap_change_24h: memeSummaryDirect.mcap_change_24h }
    : buildMemeSummary(Array.isArray(memeMarkets) ? buildMemeRows(memeMarkets) : []);

  const fgEntry = Array.isArray(fgPayload?.data) ? fgPayload.data[0] : null;

  const stableRows = Array.isArray(stableHistoryPayload) ? stableHistoryPayload : [];
  const stableLatest = stableRows[stableRows.length - 1] || null;
  const stableWeekAgo = stableRows[stableRows.length - 8] || stableRows[0] || null;
  const stableNow = getStableChartUsd(stableLatest);
  const stableThen = getStableChartUsd(stableWeekAgo);
  const stableChange7d = stableNow != null && stableThen != null ? stableNow - stableThen : null;
  const stableChange7dPct = stableNow != null && stableThen != null && stableThen !== 0
    ? ((stableNow - stableThen) / stableThen) * 100
    : null;

  const stableSolana = buildStableChainSummary(stableSolanaPayload);
  const stableBsc = buildStableChainSummary(stableBscPayload);

  const memeTopRows = Array.isArray(memeMarkets) ? buildMemeRows(memeMarkets) : [];
  const fred = buildFredPayload(walcl, tga, rrp, now);

  return {
    timestamp: now,
    fear_greed: {
      value: toNumber(fgEntry?.value),
      label: fgEntry?.value_classification || null,
    },
    btc: btcSnapshot,
    meme: memeSummary,
    tvl,
    stablecoins: {
      total: stableNow,
      change_7d: stableChange7d,
      change_7d_pct: stableChange7dPct,
    },
    chain_stablecoins: {
      solana: { net_inflow_7d: stableSolana.net_inflow_7d },
      bsc: { net_inflow_7d: stableBsc.net_inflow_7d },
    },
    dex_volume: {
      solana: buildDexSummary(dexSolanaPayload),
      base: buildDexSummary(dexBasePayload),
      bsc: buildDexSummary(dexBscPayload),
    },
    fred,
    meme_top: {
      source: "CoinGecko",
      updated_at: now,
      items: memeTopRows,
    },
    errors,
  };
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
        const payload = await getFearGreed(limit);
        return jsonResponse(payload, 200, { "Cache-Control": `public, max-age=${CACHE_TTL.fg}` });
      }

      if (pathname === "/api/funding") {
        return fundingProxyWithRetry();
      }

      if (pathname === "/api/oi") {
        return proxy("https://www.okx.com/api/v5/public/open-interest?instType=SWAP&instId=BTC-USDT-SWAP", "application/json", OKX_HEADERS);
      }

      if (pathname.startsWith("/api/fred/")) {
        const series = pathname.slice("/api/fred/".length);
        const observations = await getFredObservations(series, env);
        return jsonResponse({ observations }, 200, { "Cache-Control": `public, max-age=${CACHE_TTL.fred}` });
      }

      if (pathname === "/api/cg/markets") {
        const category = searchParams.get("category") || "meme-token";
        const perPage = searchParams.get("per_page") || "50";
        const page = searchParams.get("page") || "1";
        const payload = await getCgMarkets(category, perPage, page);
        return jsonResponse(payload, 200, { "Cache-Control": `public, max-age=${CACHE_TTL.cg}` });
      }

      if (pathname.startsWith("/api/cg/chart/")) {
        const coinId = pathname.slice("/api/cg/chart/".length);
        const days = searchParams.get("days") || "30";
        const interval = searchParams.get("interval") || "";
        const payload = await getCgChart(coinId, days, interval);
        return jsonResponse(payload, 200, { "Cache-Control": `public, max-age=${CACHE_TTL.cgChart}` });
      }

      if (pathname === "/api/meme-summary") {
        const payload = await getMemeSummaryPayload();
        return jsonResponse(payload, 200, { "Cache-Control": "public, max-age=900" });
      }

      if (pathname.startsWith("/api/llama/dex/")) {
        const chain = pathname.slice("/api/llama/dex/".length);
        const payload = await getLlamaDex(chain);
        return jsonResponse(payload, 200, { "Cache-Control": `public, max-age=${CACHE_TTL.llama}` });
      }

      if (pathname === "/api/llama/stablecoins") {
        return proxy("https://stablecoins.llama.fi/stablecoins?includePrices=true");
      }

      if (pathname === "/api/llama/stable-chart") {
        const payload = await getLlamaStableChart();
        return jsonResponse(payload, 200, { "Cache-Control": `public, max-age=${CACHE_TTL.llama}` });
      }

      if (pathname.startsWith("/api/llama/stable-chart/")) {
        const chain = pathname.slice("/api/llama/stable-chart/".length);
        const payload = await getLlamaStableChart(chain);
        return jsonResponse(payload, 200, { "Cache-Control": `public, max-age=${CACHE_TTL.llama}` });
      }

      if (pathname === "/api/all") {
        const payload = await getCachedJson("/api/all", CACHE_TTL.all, async () => buildMacroSnapshot(env));
        return jsonResponse(payload, 200, { "Cache-Control": `public, max-age=${CACHE_TTL.all}` });
      }

      return jsonResponse({ error: "unknown_route", pathname }, 404);
    } catch (error) {
      return jsonResponse({ error: "proxy_failed", message: error.message }, 500);
    }
  },
};
