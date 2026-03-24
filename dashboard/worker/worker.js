const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; LiquidityOS/1.0; +https://liquidityos.app)",
};

const CMC_BASE = "https://pro-api.coinmarketcap.com";

const OKX_HEADERS = {
  Origin: "https://www.okx.com",
  Referer: "https://www.okx.com/",
};

const CACHE_TTL = {
  fg: 3600,
  binance: 300,
  binanceWeb3: 300,
  binanceSecurity: 1800,
  cg: 1800,
  cgChart: 3600,
  cmc: 1800,
  llama: 1800,
  fred: 86400,
  gmgn: 300,
  gmgnSecurity: 1800,
  memeRadar: 300,
  all: 3600,
  newsflash: 600,
};

const INTERNAL_CACHE_ORIGIN = "https://liquidityos-data.internal";
const WORKER_PUBLIC_URL = "https://liquidityos-data.fanfan09132022.workers.dev";
const CACHE_NAMESPACE = "v20260323-fix13";
const NEWSFLASH_CONFIG = {
  l0: {
    path: "/v1/newsflash/important",
    keywords: ["BTC", "Bitcoin", "比特币", "ETF", "矿工", "比特大陆"],
  },
  l1: {
    path: "/v1/newsflash/important",
    keywords: ["Fed", "CPI", "美联储", "利率", "通胀", "宏观", "FOMC", "降息", "加息", "M2"],
  },
  l2: {
    path: "/v1/newsflash/onchain",
    keywords: ["stablecoin", "稳定币", "USDT", "USDC", "DeFi", "TVL", "流动性", "净流入"],
  },
  l3: {
    path: "/v1/newsflash",
    keywords: ["情绪", "恐慌", "贪婪", "资金费率", "多空", "清算", "Meme", "MEME", "板块"],
  },
  fg: {
    path: "/v1/newsflash",
    keywords: ["恐慌", "贪婪", "极度", "情绪", "资金费率", "清算", "爆仓", "多空比"],
  },
};

const BINANCE_CHAIN_MAP = {
  sol: "CT_501",
  solana: "CT_501",
  bsc: "56",
  base: "8453",
  eth: "1",
};

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

async function fetchBlockBeatsNewsflash(panel, env) {
  const config = NEWSFLASH_CONFIG[panel];
  if (!config) return [];
  const apiKey = env.BLOCKBEATS_API_KEY;
  if (!apiKey) return [];

  const url = `http://api-pro.theblockbeats.info${config.path}?page=1&size=20&lang=cn`;
  const res = await rawFetch(url, { headers: { "api-key": apiKey }, timeoutMs: 8000 });
  if (!res.ok) return [];

  let body;
  try {
    body = await res.json();
  } catch {
    return [];
  }
  // API returns { status:0, data: { page:N, data: [...items] } }
  const items = Array.isArray(body.data?.data) ? body.data.data
    : Array.isArray(body.data) ? body.data : null;
  if (body.status !== 0 || !items) return [];

  const keywords = config.keywords.map((k) => k.toLowerCase());
  const filtered = items.filter((item) => {
    const text = (item.title || item.content || "").toLowerCase();
    return keywords.some((kw) => text.includes(kw));
  });

  return filtered.slice(0, 5).map((item) => ({
    id: item.id,
    title: item.title || item.content || "",
    url: item.link || item.url || "",
    time: item.add_time || item.published_at || 0,
  }));
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

async function fetchCmcJson(env, path, params = {}) {
  const apiKey = env?.CMC_API_KEY;
  if (!apiKey) throw new Error("CMC_API_KEY not set");

  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, value]) => value != null && String(value) !== ""))
  );
  const url = `${CMC_BASE}${path}?${query.toString()}`;
  const response = await rawFetch(url, {
    timeoutMs: 10000,
    headers: {
      "X-CMC_PRO_API_KEY": apiKey,
      Accept: "application/json",
    },
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`CMC ${response.status}`);
  }
  return JSON.parse(body);
}

function normalizeChain(chain) {
  return String(chain || "").trim().toLowerCase();
}

function toBinanceChainId(chain) {
  return BINANCE_CHAIN_MAP[normalizeChain(chain)] || null;
}

const GMGN_PROXY = "https://gmgn-proxy-three.vercel.app/api/gmgn";

async function fetchGmgnJson(env, path, params = {}) {
  const proxyKey = env?.GMGN_PROXY_KEY;
  if (!proxyKey) throw new Error("GMGN_PROXY_KEY not set");

  const query = new URLSearchParams({
    path,
    ...Object.fromEntries(
      Object.entries(params).filter(([, value]) => value != null && String(value) !== "")
    ),
  });

  const url = `${GMGN_PROXY}?${query.toString()}`;
  const response = await rawFetch(url, {
    timeoutMs: 12000,
    headers: {
      "x-proxy-key": proxyKey,
    },
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`GMGN proxy ${response.status}: ${body.slice(0, 200)}`);
  }
  return JSON.parse(body);
}

async function fetchBinanceWeb3Json(path) {
  const upstreams = [
    `https://dapi.binance.com/public/wallet-direct${path}`,
    `https://www.binance.com/bapi/wallet-direct${path}`,
  ];

  let lastError = null;
  for (const url of upstreams) {
    try {
      const response = await rawFetch(url, {
        timeoutMs: 8000,
        headers: {
          "User-Agent": "binance-web3/1.0 (Skill)",
          "Accept-Encoding": "identity",
          "Content-Type": "application/json",
        },
      });
      const body = await response.text();
      if (!response.ok) {
        throw new Error(`Binance Web3 ${response.status}`);
      }
      return JSON.parse(body);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Binance Web3 fetch failed");
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

function prevObservation(observations) {
  if (!Array.isArray(observations)) return null;
  const valid = observations.filter((item) => item?.date && item?.value && item.value !== ".");
  return valid[1] || null;
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

async function getCmcMemeSummary(env) {
  return getCachedJson("/internal/cmc/meme-category-v2", CACHE_TTL.cmc, async () => {
    const payload = await fetchCmcJson(env, "/v1/cryptocurrency/categories", { limit: 5000 });
    const categories = Array.isArray(payload?.data) ? payload.data : [];
    const memeCat = categories.find((c) => String(c?.name || "").toLowerCase() === "memes")
      || categories.find((c) => /^meme$/i.test(String(c?.name || "")))
      || categories.find((c) => /meme/i.test(String(c?.name || "")) && toNumber(c?.num_tokens) > 1000);
    if (!memeCat) {
      return {
        mcap: null,
        mcap_change_24h: null,
        volume_24h: null,
        num_tokens: null,
        source: "CMC-categories",
        error: "meme category not found",
        updated_at: new Date().toISOString(),
      };
    }
    return {
      mcap: toNumber(memeCat.market_cap),
      mcap_change_24h: toNumber(memeCat.market_cap_change),
      volume_24h: toNumber(memeCat.volume),
      num_tokens: toNumber(memeCat.num_tokens),
      source: "CMC-categories",
      updated_at: new Date().toISOString(),
    };
  });
}

const CMC_MEME_CATEGORY_ID = "6051a82566fc1b42617d6dc6"; // "Memes" main category

async function getCmcMemeMarkets(env) {
  return getCachedJson("/internal/cmc/meme-markets", CACHE_TTL.cmc, async () => {
    const payload = await fetchCmcJson(env, "/v1/cryptocurrency/category", {
      id: CMC_MEME_CATEGORY_ID,
      limit: "50",
      convert: "USD",
    });
    const items = Array.isArray(payload?.data?.coins) ? payload.data.coins : [];
    return items.map((item, index) => ({
      rank: index + 1,
      token: String(item?.symbol || "").toUpperCase(),
      name: item?.name || "",
      image: item?.id ? `https://s2.coinmarketcap.com/static/img/coins/64x64/${item.id}.png` : null,
      logo: item?.id ? `https://s2.coinmarketcap.com/static/img/coins/64x64/${item.id}.png` : null,
      price: toNumber(item?.quote?.USD?.price),
      market_cap: toNumber(item?.quote?.USD?.market_cap),
      change_24h_pct: toNumber(item?.quote?.USD?.percent_change_24h),
      change_7d_pct: toNumber(item?.quote?.USD?.percent_change_7d),
      volume_24h: toNumber(item?.quote?.USD?.volume_24h),
    }));
  });
}

// ── Alpha Support 辅助 ──
function normalizeAlphaChain(chain) {
  const v = String(chain || "").toLowerCase();
  if (v === "solana") return { key: "solana", birdeye: "solana", gecko: "solana" };
  if (v === "bsc") return { key: "bsc", birdeye: "bsc", gecko: "bsc" };
  return null;
}

function firstAlphaNumber(...values) {
  for (const value of values) {
    const num = toNumber(value);
    if (num != null) return num;
  }
  return null;
}

function calcTop10Share(topHolders = []) {
  const firstTen = topHolders.slice(0, 10);
  if (firstTen.length === 0) return null;
  const pctSum = firstTen.reduce((sum, holder) => {
    const pct = toNumber(holder?.percentage ?? holder?.share ?? holder?.ownership_percentage);
    return sum + (pct ?? 0);
  }, 0);
  return pctSum > 0 ? parseFloat(pctSum.toFixed(2)) : null;
}

function pickPrimaryPool(pools = []) {
  if (!Array.isArray(pools) || pools.length === 0) return null;
  return pools
    .map((pool) => {
      const attrs = pool?.attributes || {};
      const liquidity = toNumber(attrs.reserve_in_usd);
      const volume24h = toNumber(attrs.volume_usd?.h24);
      return { pool, liquidity: liquidity ?? 0, volume24h: volume24h ?? 0 };
    })
    .sort((a, b) => (b.liquidity + b.volume24h) - (a.liquidity + a.volume24h))[0]?.pool || null;
}

async function fetchBirdeyeJson(path, params, apiKey, chain) {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
  return fetchJsonOrThrow(`https://public-api.birdeye.so${path}${qs}`, {
    headers: { "X-API-KEY": apiKey, "x-chain": chain },
    timeoutMs: 6000,
  });
}

async function fetchGeckoTerminalJson(path) {
  return fetchJsonSafe(`https://api.geckoterminal.com/api/v2${path}`, {
    timeoutMs: 6000,
  });
}

async function getAlphaSupportPayload(env, chain, address) {
  const normalizedChain = normalizeAlphaChain(chain);
  if (!normalizedChain) {
    return { error: "unsupported_chain", chain, address, chips: null, momentum: null, pool: null };
  }
  if (!address) {
    return { error: "missing_address", chain: normalizedChain.key, address: "", chips: null, momentum: null, pool: null };
  }

  const birdeyeKey = env?.BIRDEYE_API_KEY;
  const geckoKey = env?.GECKOTERMINAL_API_KEY || env?.GeckoTerminal_API_KEY;
  const updatedAt = new Date().toISOString();

  const chips = { source: "birdeye", updated_at: updatedAt, holder_count: null, top10_share_pct: null, top_holders_count: null, error: null };
  const momentum = { source: "birdeye", updated_at: updatedAt, price: null, price_change_24h_pct: null, volume_24h: null, volume_change_24h_pct: null, error: null };
  const pool = { source: "geckoterminal", updated_at: updatedAt, pool_address: null, dex_name: null, liquidity_usd: null, volume_24h_usd: null, liq_vol_ratio: null, error: null };

  if (!birdeyeKey) {
    chips.error = "BIRDEYE_API_KEY not set";
    momentum.error = "BIRDEYE_API_KEY not set";
  } else {
    if (normalizedChain.key !== "solana") {
      chips.error = "not_supported";
    } else {
      try {
        const holdersRes = await fetchBirdeyeJson(
          "/defi/v3/token/holder",
          { address, offset: 0, limit: 10 },
          birdeyeKey,
          normalizedChain.birdeye
        );
        const holdersData = Array.isArray(holdersRes?.data?.items) ? holdersRes.data.items
          : Array.isArray(holdersRes?.data) ? holdersRes.data
          : Array.isArray(holdersRes?.items) ? holdersRes.items
          : [];
        chips.holder_count = firstAlphaNumber(holdersRes?.data?.holder_count, holdersRes?.data?.holders, holdersRes?.holder_count, holdersRes?.data?.total_holders);
        chips.top_holders_count = holdersData.length;
        chips.top10_share_pct = calcTop10Share(holdersData);
      } catch (e) {
        chips.error = e.message;
      }
    }

    try {
      const [priceRes, pvRes] = await Promise.all([
        fetchBirdeyeJson("/defi/price", { address }, birdeyeKey, normalizedChain.birdeye),
        fetchJsonSafe(`https://public-api.birdeye.so/defi/price_volume/single?address=${encodeURIComponent(address)}`, {
          headers: { "X-API-KEY": birdeyeKey, "x-chain": normalizedChain.birdeye },
          timeoutMs: 6000,
        }),
      ]);
      const priceItem = priceRes?.data || priceRes || {};
      const pvItem = pvRes?.data || pvRes || {};
      momentum.price = firstAlphaNumber(priceItem?.value, priceItem?.price, priceItem?.data?.value, pvItem?.price, pvItem?.current_price);
      momentum.price_change_24h_pct = firstAlphaNumber(pvItem?.priceChange24h, pvItem?.price_change_24h, pvItem?.price_change_24h_percent, pvItem?.priceChangePercent24h);
      momentum.volume_24h = firstAlphaNumber(pvItem?.volume24h, pvItem?.volume_24h, pvItem?.volume, pvItem?.volume24hUSD);
      momentum.volume_change_24h_pct = firstAlphaNumber(pvItem?.volumeChange24h, pvItem?.volume_change_24h, pvItem?.volume_change_percent_24h, pvItem?.volume24hChangePercent);
    } catch (e) {
      momentum.error = e.message;
    }
  }

  try {
      const [poolsRes, tokenRes] = await Promise.all([
        fetchGeckoTerminalJson(`/networks/${normalizedChain.gecko}/tokens/${address}/pools`),
        fetchGeckoTerminalJson(`/networks/${normalizedChain.gecko}/tokens/${address}`),
      ]);
      let poolList = Array.isArray(poolsRes?.data) ? poolsRes.data : [];
      let primaryPool = pickPrimaryPool(poolList);
      if (!primaryPool) {
        const searchRes = await fetchJsonSafe(
          `https://api.geckoterminal.com/api/v2/search/pools?query=${encodeURIComponent(address)}&network=${normalizedChain.gecko}`,
          { timeoutMs: 6000 }
        );
        poolList = Array.isArray(searchRes?.data) ? searchRes.data : [];
        primaryPool = pickPrimaryPool(poolList);
      }
      const attrs = primaryPool?.attributes || {};
      let liquidityUsd = firstAlphaNumber(attrs.reserve_in_usd, attrs.total_reserve_in_usd);
      let volume24hUsd = firstAlphaNumber(attrs.volume_usd?.h24, attrs.h24_volume_usd);
      if ((liquidityUsd == null || volume24hUsd == null) && tokenRes?.data?.attributes) {
        const ta = tokenRes.data.attributes;
        liquidityUsd = liquidityUsd ?? firstAlphaNumber(ta.total_reserve_in_usd, ta.reserve_in_usd);
        volume24hUsd = volume24hUsd ?? firstAlphaNumber(ta.volume_usd?.h24, ta.h24_volume_usd);
      }
      pool.pool_address = attrs.address || null;
      pool.dex_name = primaryPool?.relationships?.dex?.data?.id || null;
      pool.liquidity_usd = liquidityUsd;
      pool.volume_24h_usd = volume24hUsd;
      pool.liq_vol_ratio = (liquidityUsd != null && volume24hUsd && volume24hUsd > 0)
        ? parseFloat((liquidityUsd / volume24hUsd).toFixed(2)) : null;
      if (!primaryPool && liquidityUsd == null && volume24hUsd == null) {
        pool.error = "unavailable";
      }
  } catch (e) {
    pool.error = e.message;
  }

  return { chain: normalizedChain.key, address, updated_at: updatedAt, chips, momentum, pool };
}

async function getMemeRadarPayload() {
  return getCachedJson("/api/meme-radar", CACHE_TTL.memeRadar, async () => {
    const updatedAt = new Date().toISOString();
    let profiles = null;

    try {
      profiles = await fetchJsonOrThrow(
        "https://api.dexscreener.com/token-profiles/latest/v1",
        { timeoutMs: 8000 }
      );
    } catch {
      return {
        items: [],
        count: 0,
        source: "dexscreener-token-profiles",
        updatedAt,
        error: "dexscreener_profiles_failed",
      };
    }

    const profileItems = [];
    const seenAddresses = new Set();
    for (const item of Array.isArray(profiles) ? profiles : []) {
      const tokenAddress = String(item?.tokenAddress || "").trim();
      if (!tokenAddress || seenAddresses.has(tokenAddress)) continue;
      seenAddresses.add(tokenAddress);
      profileItems.push({
        tokenAddress,
        chainId: item?.chainId || null,
        url: item?.url || null,
        icon: item?.icon || null,
        description: item?.description || null,
      });
      if (profileItems.length >= 30) break;
    }

    if (!profileItems.length) {
      return {
        items: [],
        count: 0,
        source: "dexscreener-token-profiles",
        updatedAt,
        error: null,
      };
    }

    let pairsPayload = null;
    try {
      pairsPayload = await fetchJsonOrThrow(
        `https://api.dexscreener.com/latest/dex/tokens/${profileItems.map((item) => item.tokenAddress).join(",")}`,
        { timeoutMs: 9000 }
      );
    } catch {
      return {
        items: [],
        count: 0,
        source: "dexscreener-token-profiles",
        updatedAt,
        error: "dexscreener_tokens_failed",
      };
    }

    const pairMap = new Map();
    for (const pair of Array.isArray(pairsPayload?.pairs) ? pairsPayload.pairs : []) {
      const address = String(pair?.baseToken?.address || "").trim().toLowerCase();
      if (!address || pairMap.has(address)) continue;
      pairMap.set(address, pair);
    }

    const items = [];
    for (const profile of profileItems) {
      try {
        const pair = pairMap.get(profile.tokenAddress.toLowerCase());
        if (!pair) continue;
        const marketCapOrFdv = toNumber(pair?.marketCap) ?? toNumber(pair?.fdv);
        if (marketCapOrFdv == null) continue;
        items.push({
          tokenAddress: profile.tokenAddress,
          chainId: profile.chainId,
          symbol: pair?.baseToken?.symbol || null,
          name: pair?.baseToken?.name || null,
          url: profile.url,
          icon: profile.icon,
          description: profile.description,
          dexId: pair?.dexId || null,
          pairCreatedAt: toNumber(pair?.pairCreatedAt),
          priceUsd: pair?.priceUsd ?? null,
          priceChangeH1: toNumber(pair?.priceChange?.h1),
          priceChangeH24: toNumber(pair?.priceChange?.h24),
          volumeH24: toNumber(pair?.volume?.h24),
          volumeH1: toNumber(pair?.volume?.h1),
          liquidityUsd: toNumber(pair?.liquidity?.usd),
          marketCapOrFdv,
        });
      } catch {
        // skip malformed token rows without failing the whole payload
      }
      if (items.length >= 20) break;
    }

    const filteredItems = items.filter((item) => !(
      (item.volumeH1 == null || item.volumeH1 === 0)
      && (item.liquidityUsd == null || item.liquidityUsd === 0)
    ));

    return {
      items: filteredItems,
      count: filteredItems.length,
      source: "dexscreener-token-profiles",
      updatedAt,
      error: null,
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
  const fedPrev = prevObservation(walcl);
  const tgaLatest = latestObservation(tga);
  const tgaPrev = prevObservation(tga);
  const rrpLatest = latestObservation(rrp);
  const rrpPrev = prevObservation(rrp);
  const fedValue = toNumber(fedLatest?.value);
  const fedPrevValue = toNumber(fedPrev?.value);
  const tgaValue = toNumber(tgaLatest?.value);
  const tgaPrevValue = toNumber(tgaPrev?.value);
  const rrpValue = toNumber(rrpLatest?.value);
  const rrpPrevValue = toNumber(rrpPrev?.value);
  const walclT = fedValue != null ? fedValue / 1_000_000 : null;
  const walclTPrev = fedPrevValue != null ? fedPrevValue / 1_000_000 : null;
  const wtregenT = tgaValue != null ? tgaValue / 1_000_000 : null;
  const wtregenTPrev = tgaPrevValue != null ? tgaPrevValue / 1_000_000 : null;
  const rrpontsydT = rrpValue != null ? rrpValue / 1_000 : null;
  const rrpontsydTPrev = rrpPrevValue != null ? rrpPrevValue / 1_000 : null;
  const gnlValueT = walclT != null && wtregenT != null && rrpontsydT != null
    ? Number((walclT - wtregenT - rrpontsydT).toFixed(3))
    : null;
  const gnlPrevT = walclTPrev != null && wtregenTPrev != null && rrpontsydTPrev != null
    ? Number((walclTPrev - wtregenTPrev - rrpontsydTPrev).toFixed(3))
    : null;
  const gnlChange7d = gnlValueT != null && gnlPrevT != null
    ? Number((gnlValueT - gnlPrevT).toFixed(3))
    : null;

  return {
    source: "FRED",
    updated_at: now,
    gnl: {
      value_t: gnlValueT,
      change_7d: gnlChange7d,
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
  let memeSummary = null;
  let memeMarkets = [];

  try {
    const cmcSummary = await readTask("cmc_meme_summary", () => getCmcMemeSummary(env), null);
    if (cmcSummary?.mcap != null) {
      memeSummary = { mcap: cmcSummary.mcap, mcap_change_24h: cmcSummary.mcap_change_24h };
    }
  } catch {
    // CMC summary fallback below
  }
  await sleep(400);

  try {
    const cmcMarkets = await readTask("cmc_meme_markets", () => getCmcMemeMarkets(env), []);
    if (Array.isArray(cmcMarkets) && cmcMarkets.length > 0) {
      memeMarkets = cmcMarkets;
      if (!memeSummary) {
        memeSummary = buildMemeSummary(cmcMarkets);
      }
    }
  } catch {
    // CMC markets fallback below
  }

  if (!memeSummary || memeMarkets.length === 0) {
    await sleep(800);
    try {
      if (!memeSummary) {
        const cgSummary = await readTask("meme_summary", () => fetchWorkerJson("/api/meme-summary"), null);
        if (cgSummary?.mcap != null) {
          memeSummary = { mcap: cgSummary.mcap, mcap_change_24h: cgSummary.mcap_change_24h };
        }
      }
      if (memeMarkets.length === 0) {
        const cgMarkets = await readTask("cg_markets", () => getCgMarkets("meme-token", "50", "1"), []);
        if (Array.isArray(cgMarkets) && cgMarkets.length > 0) {
          memeMarkets = buildMemeRows(cgMarkets);
          if (!memeSummary) {
            memeSummary = buildMemeSummary(memeMarkets);
          }
        }
      }
    } catch {
      // CoinGecko fallback failed
    }
  }

  if (!memeSummary) {
    memeSummary = { mcap: null, mcap_change_24h: null };
  }

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

  const memeTopRows = Array.isArray(memeMarkets) ? memeMarkets : [];
  const fred = buildFredPayload(walcl, tga, rrp, now);

  return {
    timestamp: now,
    fear_greed: {
      value: toNumber(fgEntry?.value),
      label: fgEntry?.value_classification || null,
    },
    btc: btcSnapshot,
    mvrv_z_score: btcSnapshot?.price != null && btcSnapshot?.ma_200 != null && btcSnapshot.ma_200 > 0
      ? Number((btcSnapshot.price / btcSnapshot.ma_200).toFixed(2))
      : null,
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
      source: memeTopRows.length > 0 && String(memeTopRows[0]?.image || "").includes("coinmarketcap") ? "CMC" : "CoinGecko",
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

      if (pathname === "/api/cmc/meme-markets") {
        try {
          const payload = await getCmcMemeMarkets(env);
          return jsonResponse(payload, 200, { "Cache-Control": `public, max-age=${CACHE_TTL.cmc}` });
        } catch (error) {
          return jsonResponse({ error: "cmc_failed", message: error.message }, 500);
        }
      }

      if (pathname === "/api/meme-summary") {
        let payload = null;
        try {
          payload = await getCmcMemeSummary(env);
        } catch {
          // CMC failed, fallback below
        }
        if (!payload || payload.mcap == null) {
          payload = await getMemeSummaryPayload();
        }
        return jsonResponse(payload, 200, { "Cache-Control": "public, max-age=900" });
      }

      if (pathname === "/api/meme-radar") {
        const payload = await getMemeRadarPayload();
        return jsonResponse(payload, 200, { "Cache-Control": `public, max-age=${CACHE_TTL.memeRadar}` });
      }

      if (pathname === "/api/newsflash") {
        const panel = searchParams.get("panel") || "l1";
        const validPanels = ["l0", "l1", "l2", "l3", "fg"];
        if (!validPanels.includes(panel)) {
          return jsonResponse({ error: "invalid panel" }, 400);
        }

        const cacheKey = `${CACHE_NAMESPACE}:newsflash:${panel}`;

        if (env.DATA_CACHE) {
          try {
            const cached = await env.DATA_CACHE.get(cacheKey, "json");
            if (cached) return jsonResponse(cached);
          } catch {}
        }

        const items = await fetchBlockBeatsNewsflash(panel, env);
        const result = { panel, items, cached_at: Math.floor(Date.now() / 1000) };

        if (env.DATA_CACHE) {
          try {
            await env.DATA_CACHE.put(cacheKey, JSON.stringify(result), {
              expirationTtl: CACHE_TTL.newsflash,
            });
          } catch {}
        }

        return jsonResponse(result);
      }

      if (pathname === "/api/alpha-support") {
        const chain = searchParams.get("chain") || "solana";
        const address = searchParams.get("address") || "";
        const payload = await getAlphaSupportPayload(env, chain, address);
        return jsonResponse(payload, 200);
      }

      if (pathname === "/api/gmgn/rank") {
        const chain = normalizeChain(searchParams.get("chain") || "sol");
        if (!["sol", "bsc", "base"].includes(chain)) {
          return jsonResponse({ error: "invalid_chain", message: "chain must be one of sol/bsc/base", chain }, 400);
        }
        try {
          const payload = await getCachedJson(`/api/gmgn/rank?chain=${chain}`, CACHE_TTL.gmgn, () => (
            fetchGmgnJson(env, "/v1/market/rank", { chain })
          ));
          return jsonResponse(payload, 200, { "Cache-Control": `public, max-age=${CACHE_TTL.gmgn}` });
        } catch (error) {
          return jsonResponse({ error: "gmgn_failed", message: error.message, chain }, 500);
        }
      }

      if (pathname === "/api/gmgn/token-info") {
        const chain = normalizeChain(searchParams.get("chain"));
        const address = (searchParams.get("address") || "").trim();
        if (!chain) return jsonResponse({ error: "missing_chain", message: "chain is required" }, 400);
        if (!address) return jsonResponse({ error: "missing_address", message: "address is required", chain }, 400);
        try {
          const payload = await getCachedJson(`/api/gmgn/token-info?chain=${encodeURIComponent(chain)}&address=${encodeURIComponent(address)}`, CACHE_TTL.gmgn, () => (
            fetchGmgnJson(env, "/v1/token/info", { chain, address })
          ));
          return jsonResponse(payload, 200, { "Cache-Control": `public, max-age=${CACHE_TTL.gmgn}` });
        } catch (error) {
          return jsonResponse({ error: "gmgn_failed", message: error.message, chain, address }, 500);
        }
      }

      if (pathname === "/api/gmgn/token-security") {
        const chain = normalizeChain(searchParams.get("chain"));
        const address = (searchParams.get("address") || "").trim();
        if (!chain) return jsonResponse({ error: "missing_chain", message: "chain is required" }, 400);
        if (!address) return jsonResponse({ error: "missing_address", message: "address is required", chain }, 400);
        try {
          const payload = await getCachedJson(`/api/gmgn/token-security?chain=${encodeURIComponent(chain)}&address=${encodeURIComponent(address)}`, CACHE_TTL.gmgnSecurity, () => (
            fetchGmgnJson(env, "/v1/token/security", { chain, address })
          ));
          return jsonResponse(payload, 200, { "Cache-Control": `public, max-age=${CACHE_TTL.gmgnSecurity}` });
        } catch (error) {
          return jsonResponse({ error: "gmgn_failed", message: error.message, chain, address }, 500);
        }
      }

      if (pathname === "/api/binance/token-info") {
        const chain = normalizeChain(searchParams.get("chain"));
        const address = (searchParams.get("address") || "").trim();
        const chainId = toBinanceChainId(chain);
        if (!chain) return jsonResponse({ error: "missing_chain", message: "chain is required" }, 400);
        if (!chainId) return jsonResponse({ error: "invalid_chain", message: "unsupported chain", chain }, 400);
        if (!address) return jsonResponse({ error: "missing_address", message: "address is required", chain }, 400);
        try {
          const payload = await getCachedJson(`/api/binance/token-info?chain=${encodeURIComponent(chain)}&address=${encodeURIComponent(address)}`, CACHE_TTL.binanceWeb3, () => (
            fetchBinanceWeb3Json(`/openapi/v1/public/chain/${chainId}/token/dynamic/info/ai?address=${encodeURIComponent(address)}`)
          ));
          return jsonResponse(payload, 200, { "Cache-Control": `public, max-age=${CACHE_TTL.binanceWeb3}` });
        } catch (error) {
          return jsonResponse({ error: "binance_failed", message: error.message, chain, address }, 500);
        }
      }

      if (pathname === "/api/binance/market-rank") {
        const chain = normalizeChain(searchParams.get("chain"));
        const type = searchParams.get("type") || "trending";
        const chainId = toBinanceChainId(chain);
        if (!chain) return jsonResponse({ error: "missing_chain", message: "chain is required" }, 400);
        if (!chainId) return jsonResponse({ error: "invalid_chain", message: "unsupported chain", chain }, 400);
        if (!["trending", "topSearch", "alpha"].includes(type)) {
          return jsonResponse({ error: "invalid_type", message: "type must be one of trending/topSearch/alpha", chain, type }, 400);
        }
        try {
          const payload = await getCachedJson(`/api/binance/market-rank?chain=${encodeURIComponent(chain)}&type=${encodeURIComponent(type)}`, CACHE_TTL.binanceWeb3, () => (
            fetchBinanceWeb3Json(`/openapi/v1/public/chain/${chainId}/rank/list?type=${encodeURIComponent(type)}`)
          ));
          return jsonResponse(payload, 200, { "Cache-Control": `public, max-age=${CACHE_TTL.binanceWeb3}` });
        } catch (error) {
          return jsonResponse({ error: "binance_failed", message: error.message, chain, type }, 500);
        }
      }

      if (pathname === "/api/binance/token-audit") {
        const chain = normalizeChain(searchParams.get("chain"));
        const address = (searchParams.get("address") || "").trim();
        const chainId = toBinanceChainId(chain);
        if (!chain) return jsonResponse({ error: "missing_chain", message: "chain is required" }, 400);
        if (!chainId) return jsonResponse({ error: "invalid_chain", message: "unsupported chain", chain }, 400);
        if (!address) return jsonResponse({ error: "missing_address", message: "address is required", chain }, 400);
        try {
          const payload = await getCachedJson(`/api/binance/token-audit?chain=${encodeURIComponent(chain)}&address=${encodeURIComponent(address)}`, CACHE_TTL.binanceSecurity, () => (
            fetchBinanceWeb3Json(`/openapi/v1/public/chain/${chainId}/token/security/ai?address=${encodeURIComponent(address)}`)
          ));
          return jsonResponse(payload, 200, { "Cache-Control": `public, max-age=${CACHE_TTL.binanceSecurity}` });
        } catch (error) {
          return jsonResponse({ error: "binance_failed", message: error.message, chain, address }, 500);
        }
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
