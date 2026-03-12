function buildCorsHeaders(request) {
  const origin = request.headers.get('Origin');
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
    'Content-Type': 'application/json',
  };
}

const UA = { headers: { 'User-Agent': 'LiquidityOS/1.0', 'Accept': 'application/json' } };

async function safe(fn) {
  try { return await fn(); }
  catch (e) { return { error: e.message }; }
}

async function safeFetch(url, headers = {}) {
  const res = await fetch(url, { headers: { ...UA.headers, ...headers } });
  const text = await res.text();
  const trimmed = text && text.trim() ? text.trim() : '';
  let parsed = null;
  if (trimmed) {
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      parsed = trimmed;
    }
  }
  if (!res.ok) {
    const detail = typeof parsed === 'string'
      ? parsed
      : parsed?.error || parsed?.message || parsed?.status?.error_message || JSON.stringify(parsed);
    throw new Error(`HTTP ${res.status}${detail ? `: ${detail}` : ''}`);
  }
  return parsed;
}

async function safeFetchCmc(path, params, apiKey) {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
  return safeFetch(`https://pro-api.coinmarketcap.com${path}${qs}`, {
    'X-CMC_PRO_API_KEY': apiKey,
  });
}

async function safeFetchBirdeye(path, params, apiKey, chain) {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
  return safeFetch(`https://public-api.birdeye.so${path}${qs}`, {
    'X-API-KEY': apiKey,
    'x-chain': chain,
  });
}

async function safeFetchGecko(path, apiKey) {
  return safeFetch(`https://pro-api.coingecko.com/api/v3/onchain${path}`, {
    'x-cg-pro-api-key': apiKey,
  });
}

function normalizeAlphaChain(chain) {
  const v = String(chain || '').toLowerCase();
  if (v === 'solana') return { key: 'solana', birdeye: 'solana', gecko: 'solana' };
  if (v === 'bsc') return { key: 'bsc', birdeye: 'bsc', gecko: 'bsc' };
  return null;
}

function toFloat(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function firstNumber(...values) {
  for (const value of values) {
    const num = toFloat(value);
    if (num != null) return num;
  }
  return null;
}

function calcTop10Share(topHolders = []) {
  const firstTen = topHolders.slice(0, 10);
  if (firstTen.length === 0) return null;
  const pctSum = firstTen.reduce((sum, holder) => {
    const pct = toFloat(holder?.percentage ?? holder?.share ?? holder?.ownership_percentage);
    return sum + (pct ?? 0);
  }, 0);
  return pctSum > 0 ? parseFloat(pctSum.toFixed(2)) : null;
}

function pickPrimaryPool(pools = []) {
  if (!Array.isArray(pools) || pools.length === 0) return null;
  return pools
    .map(pool => {
      const attrs = pool?.attributes || {};
      const liquidity = toFloat(attrs.reserve_in_usd);
      const volume24h = toFloat(attrs.volume_usd?.h24);
      return { pool, liquidity: liquidity ?? 0, volume24h: volume24h ?? 0 };
    })
    .sort((a, b) => (b.liquidity + b.volume24h) - (a.liquidity + a.volume24h))[0]?.pool || null;
}

async function fetchAlphaSupport(env, chain, address) {
  const normalizedChain = normalizeAlphaChain(chain);
  if (!normalizedChain) return { error: 'Unsupported chain', chain, address, chips: null, momentum: null, pool: null };
  if (!address) return { error: 'Missing token address', chain: normalizedChain.key, address: '', chips: null, momentum: null, pool: null };

  const birdeyeKey = env?.BIRDEYE_API_KEY;
  const geckoKey = env?.GECKOTERMINAL_API_KEY || env?.GeckoTerminal_API_KEY;
  const updatedAt = new Date().toISOString();

  const chips = { source: 'birdeye', updated_at: updatedAt, holder_count: null, top10_share_pct: null, top_holders_count: null, error: null };
  const momentum = { source: 'birdeye', updated_at: updatedAt, price: null, price_change_24h_pct: null, volume_24h: null, volume_change_24h_pct: null, error: null };
  const pool = { source: 'geckoterminal', updated_at: updatedAt, pool_address: null, dex_name: null, liquidity_usd: null, volume_24h_usd: null, liq_vol_ratio: null, error: null };

  if (!birdeyeKey) {
    chips.error = 'BIRDEYE_API_KEY not set';
    momentum.error = 'BIRDEYE_API_KEY not set';
  } else {
    if (normalizedChain.key !== 'solana') {
      chips.error = 'not_supported';
    } else {
      try {
        const holdersRes = await safeFetchBirdeye('/defi/v3/token/holder', { address, offset: 0, limit: 10 }, birdeyeKey, normalizedChain.birdeye);
        const holdersData = Array.isArray(holdersRes?.data?.items) ? holdersRes.data.items
          : Array.isArray(holdersRes?.data) ? holdersRes.data
          : Array.isArray(holdersRes?.items) ? holdersRes.items
          : [];
        const holderCount = firstNumber(holdersRes?.data?.holder_count, holdersRes?.data?.holders, holdersRes?.holder_count, holdersRes?.data?.total_holders);
        chips.holder_count = holderCount;
        chips.top_holders_count = holdersData.length;
        chips.top10_share_pct = calcTop10Share(holdersData);
      } catch (e) {
        chips.error = e.message;
      }
    }

    try {
      const [priceRes, priceVolumeRes] = await Promise.all([
        safeFetchBirdeye('/defi/price', { address }, birdeyeKey, normalizedChain.birdeye),
        safe(() => safeFetchBirdeye('/defi/price_volume/single', { address }, birdeyeKey, normalizedChain.birdeye)),
      ]);
      const priceItem = priceRes?.data || priceRes || {};
      const pvItem = priceVolumeRes?.data || priceVolumeRes || {};
      momentum.price = firstNumber(priceItem?.value, priceItem?.price, priceItem?.data?.value, pvItem?.price, pvItem?.current_price, pvItem?.value);
      momentum.price_change_24h_pct = firstNumber(
        pvItem?.priceChange24h,
        pvItem?.price_change_24h,
        pvItem?.price_change_24h_percent,
        pvItem?.priceChangePercent24h,
        pvItem?.price_24h_change_percent
      );
      momentum.volume_24h = firstNumber(
        pvItem?.volume24h,
        pvItem?.volume_24h,
        pvItem?.volume,
        pvItem?.volume24hUSD,
        pvItem?.volume24h_usd
      );
      momentum.volume_change_24h_pct = firstNumber(
        pvItem?.volumeChange24h,
        pvItem?.volume_change_24h,
        pvItem?.volume_change_percent_24h,
        pvItem?.volume24hChangePercent
      );
    } catch (e) {
      momentum.error = e.message;
    }
  }

  if (!geckoKey) {
    pool.error = 'GECKOTERMINAL_API_KEY not set';
  } else {
    try {
      const [poolsRes, tokenRes] = await Promise.all([
        safe(() => safeFetchGecko(`/networks/${normalizedChain.gecko}/tokens/${address}/pools`, geckoKey)),
        safe(() => safeFetchGecko(`/networks/${normalizedChain.gecko}/tokens/${address}`, geckoKey)),
      ]);
      let poolList = Array.isArray(poolsRes?.data) ? poolsRes.data : [];
      let primaryPool = pickPrimaryPool(poolList);
      if (!primaryPool) {
        const searchRes = await safe(() => safeFetchGecko(`/search/pools?query=${encodeURIComponent(address)}&network=${normalizedChain.gecko}`, geckoKey));
        const searchPools = Array.isArray(searchRes?.data) ? searchRes.data : [];
        poolList = searchPools;
        primaryPool = pickPrimaryPool(searchPools);
      }
      const attrs = primaryPool?.attributes || {};
      let liquidityUsd = firstNumber(attrs.reserve_in_usd, attrs.total_reserve_in_usd);
      let volume24hUsd = firstNumber(attrs.volume_usd?.h24, attrs.h24_volume_usd);
      if ((liquidityUsd == null || volume24hUsd == null) && tokenRes?.data?.attributes) {
        const tokenAttrs = tokenRes.data.attributes;
        liquidityUsd = liquidityUsd ?? firstNumber(tokenAttrs.total_reserve_in_usd, tokenAttrs.reserve_in_usd);
        volume24hUsd = volume24hUsd ?? firstNumber(tokenAttrs.volume_usd?.h24, tokenAttrs.h24_volume_usd);
      }
      pool.pool_address = attrs.address || null;
      pool.dex_name = primaryPool?.relationships?.dex?.data?.id || null;
      pool.liquidity_usd = liquidityUsd;
      pool.volume_24h_usd = volume24hUsd;
      pool.liq_vol_ratio = liquidityUsd != null && volume24hUsd && volume24hUsd > 0
        ? parseFloat((liquidityUsd / volume24hUsd).toFixed(2))
        : null;
      if (!primaryPool && liquidityUsd == null && volume24hUsd == null) {
        pool.error = 'unavailable';
      }
    } catch (e) {
      pool.error = e.message;
    }
  }

  return {
    chain: normalizedChain.key,
    address,
    updated_at: updatedAt,
    chips,
    momentum,
    pool,
  };
}

function calcSimpleMovingAverage(values, length) {
  if (!Array.isArray(values) || values.length < length) return null;
  const slice = values.slice(-length);
  const sum = slice.reduce((acc, item) => acc + item, 0);
  return parseFloat((sum / length).toFixed(2));
}

async function fetchBtc200MA() {
  const data = await safeFetch('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=220&interval=daily');
  const prices = Array.isArray(data?.prices) ? data.prices.map(point => point?.[1]).filter(v => Number.isFinite(v)) : [];
  const ma200 = calcSimpleMovingAverage(prices, 200);
  return {
    ma_200: ma200,
    source: 'coingecko',
    updated_at: new Date().toISOString(),
  };
}

// ── Fear & Greed ──
async function fetchFearGreed() {
  const data = await safeFetch('https://api.alternative.me/fng/?limit=1');
  const item = data?.data?.[0];
  return { value: item ? parseInt(item.value) : null, label: item?.value_classification || null };
}

// ── BTC：Binance (主) → CoinCap (备) → CoinGecko (备) ──
async function fetchBTCPrice() {
  const maInfo = await safe(() => fetchBtc200MA());

  // 主：Binance — 全球最稳，免费，无需 Key
  try {
    const data = await safeFetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT');
    if (data?.lastPrice) {
      const price = parseFloat(parseFloat(data.lastPrice).toFixed(2));
      return {
        price,
        change_24h: data.priceChangePercent ? parseFloat(data.priceChangePercent) : null,
        source: 'binance',
        ma_200: maInfo?.ma_200 ?? null,
        ma_source: maInfo?.source || null,
        vs_ma_200_pct: maInfo?.ma_200 ? parseFloat((((price - maInfo.ma_200) / maInfo.ma_200) * 100).toFixed(2)) : null,
        updated_at: maInfo?.updated_at || new Date().toISOString(),
      };
    }
  } catch {}

  // 备1：CoinCap
  try {
    const data = await safeFetch('https://api.coincap.io/v2/assets/bitcoin');
    if (data?.data?.priceUsd) {
      const price = parseFloat(parseFloat(data.data.priceUsd).toFixed(2));
      return {
        price,
        change_24h: data.data.changePercent24Hr ? parseFloat(parseFloat(data.data.changePercent24Hr).toFixed(2)) : null,
        source: 'coincap',
        ma_200: maInfo?.ma_200 ?? null,
        ma_source: maInfo?.source || null,
        vs_ma_200_pct: maInfo?.ma_200 ? parseFloat((((price - maInfo.ma_200) / maInfo.ma_200) * 100).toFixed(2)) : null,
        updated_at: maInfo?.updated_at || new Date().toISOString(),
      };
    }
  } catch {}

  // 备2：CoinGecko
  try {
    const data = await safeFetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true');
    if (data?.bitcoin?.usd) {
      const price = data.bitcoin.usd;
      return {
        price,
        change_24h: data.bitcoin.usd_24h_change ? parseFloat(data.bitcoin.usd_24h_change.toFixed(2)) : null,
        source: 'coingecko',
        ma_200: maInfo?.ma_200 ?? null,
        ma_source: maInfo?.source || null,
        vs_ma_200_pct: maInfo?.ma_200 ? parseFloat((((price - maInfo.ma_200) / maInfo.ma_200) * 100).toFixed(2)) : null,
        updated_at: maInfo?.updated_at || new Date().toISOString(),
      };
    }
  } catch {}

  return {
    price: null,
    change_24h: null,
    source: 'none',
    ma_200: maInfo?.ma_200 ?? null,
    ma_source: maInfo?.source || null,
    vs_ma_200_pct: null,
    updated_at: maInfo?.updated_at || new Date().toISOString(),
  };
}

// ── Meme 总市值：单独请求 CoinGecko（不和 BTC 并发，避免限速）──
async function fetchMemeMcap() {
  for (let i = 0; i < 2; i++) {
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/coins/categories', UA);
      if (res.status === 429) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      const text = await res.text();
      if (!text || !text.trim()) continue;
      const data = JSON.parse(text);
      if (Array.isArray(data)) {
        const meme = data.find(c => c.id === 'meme-token');
        if (meme) {
          return {
            mcap: meme.market_cap || null,
            mcap_change_24h: meme.market_cap_change_24h || null,
            volume_24h: meme.volume_24h || null,
            source: 'coingecko',
          };
        }
      }
      if (data?.status?.error_message) {
        return { mcap: null, note: data.status.error_message, source: 'coingecko_error' };
      }
    } catch {}
    if (i === 0) await new Promise(r => setTimeout(r, 2000));
  }
  return { mcap: null, source: 'coingecko_limited' };
}

function pickMemeCategory(categories = []) {
  const chainHints = ['tron', 'solana', 'base', 'bsc', 'ethereum', 'arbitrum', 'avalanche', 'sui', 'ton', 'polygon'];
  const scored = categories
    .filter(item => {
      const text = `${item?.name || ''} ${item?.title || ''} ${item?.slug || ''}`.toLowerCase();
      return text.includes('meme');
    })
    .map((item) => {
      const text = `${item?.name || ''} ${item?.title || ''} ${item?.slug || ''}`.toLowerCase();
      let score = 0;
      if (text === 'memes' || text === 'meme') score += 100;
      if (item?.name === 'Memes' || item?.title === 'Memes') score += 100;
      if (text.includes(' memes') || text.startsWith('memes')) score += 20;
      if (chainHints.some(hint => text.includes(hint))) score -= 50;
      score += Math.min(Number(item?.num_tokens || 0) / 100, 20);
      return { item, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0]?.item || null;
}

function mapCmcCoin(item, idx) {
  const usd = item?.quote?.USD || {};
  return {
    rank: item?.cmc_rank || idx + 1,
    token: item?.symbol || item?.name || `#${idx + 1}`,
    name: item?.name || null,
    image: null,
    price: usd?.price ?? null,
    market_cap: usd?.market_cap ?? null,
    change_24h_pct: usd?.percent_change_24h ?? null,
    change_7d_pct: usd?.percent_change_7d ?? null,
    volume_24h: usd?.volume_24h ?? null,
  };
}

async function fetchMemeTopList(env) {
  const apiKey = env?.CMC_API_KEY;
  if (!apiKey) return { items: [], source: 'cmc_not_configured', updated_at: new Date().toISOString(), error: 'CMC_API_KEY not set' };

  try {
    const categoriesRes = await safeFetchCmc('/v1/cryptocurrency/categories', null, apiKey);
    const categories = Array.isArray(categoriesRes?.data) ? categoriesRes.data : [];
    const memeCategory = pickMemeCategory(categories);
    if (memeCategory?.id) {
      const categoryRes = await safeFetchCmc('/v1/cryptocurrency/category', { id: memeCategory.id }, apiKey);
      const coins = Array.isArray(categoryRes?.data?.coins) ? categoryRes.data.coins : [];
      if (coins.length > 0) {
        return {
          source: 'coinmarketcap',
          updated_at: categoryRes?.data?.last_updated || new Date().toISOString(),
          items: coins.slice(0, 50).map(mapCmcCoin),
        };
      }
    }
  } catch {}

  const listingsRes = await safeFetchCmc('/v1/cryptocurrency/listings/latest', {
    limit: 500,
    aux: 'tags',
  }, apiKey);
  const listings = Array.isArray(listingsRes?.data) ? listingsRes.data : [];
  const memeListings = listings.filter((item) => {
    const tags = Array.isArray(item?.tags) ? item.tags.map(tag => String(tag).toLowerCase()) : [];
    return tags.some(tag => tag === 'memes' || tag === 'meme' || tag.includes('meme'));
  });

  return {
    source: 'coinmarketcap_fallback',
    updated_at: listingsRes?.status?.timestamp || new Date().toISOString(),
    items: memeListings.slice(0, 50).map(mapCmcCoin),
  };
}

// ── 三链 TVL ──
async function fetchChainTVL() {
  const data = await safeFetch('https://api.llama.fi/v2/chains');
  if (!Array.isArray(data)) return { solana: null, ethereum: null, bsc: null };
  const find = (name) => {
    const chain = data.find(c => c.name?.toLowerCase() === name.toLowerCase());
    return chain?.tvl ? parseFloat(chain.tvl.toFixed(0)) : null;
  };
  return { solana: find('Solana'), ethereum: find('Ethereum'), bsc: find('BSC') };
}

// ── 稳定币总量 ──
async function fetchStablecoins() {
  const data = await safeFetch('https://stablecoins.llama.fi/stablecoincharts/all?stablecoin=1');
  let currentTotal = null, weekAgoTotal = null;
  if (Array.isArray(data) && data.length >= 8) {
    const latest = data[data.length - 1];
    const weekAgo = data[data.length - 8];
    currentTotal = latest?.totalCirculating?.peggedUSD || null;
    weekAgoTotal = weekAgo?.totalCirculating?.peggedUSD || null;
  }
  return {
    total: currentTotal,
    total_7d_ago: weekAgoTotal,
    change_7d: currentTotal && weekAgoTotal ? parseFloat((currentTotal - weekAgoTotal).toFixed(0)) : null,
    change_7d_pct: currentTotal && weekAgoTotal ? parseFloat(((currentTotal - weekAgoTotal) / weekAgoTotal * 100).toFixed(3)) : null,
  };
}

// ── 各链稳定币净流入 ──
async function fetchChainStablecoins() {
  const chains = ['Solana', 'BSC', 'Base'];
  const results = {};
  for (const chain of chains) {
    try {
      const res = await fetch(`https://stablecoins.llama.fi/stablecoincharts/${chain}?stablecoin=1`, UA);
      const text = await res.text();
      if (!text || !text.trim() || !text.trim().startsWith('[')) {
        results[chain.toLowerCase()] = null;
        continue;
      }
      const chartData = JSON.parse(text);
      if (Array.isArray(chartData) && chartData.length >= 8) {
        const latest = chartData[chartData.length - 1];
        const weekAgo = chartData[chartData.length - 8];
        const currentVal = latest?.totalCirculating?.peggedUSD || 0;
        const weekAgoVal = weekAgo?.totalCirculating?.peggedUSD || 0;
        results[chain.toLowerCase()] = {
          current: parseFloat(currentVal.toFixed(0)),
          week_ago: parseFloat(weekAgoVal.toFixed(0)),
          net_inflow_7d: parseFloat((currentVal - weekAgoVal).toFixed(0)),
        };
      } else {
        results[chain.toLowerCase()] = null;
      }
    } catch (e) {
      results[chain.toLowerCase()] = { error: e.message };
    }
  }
  return results;
}

// ── DEX 交易量：用 /overview/dexs 全局端点再按链过滤 ──
async function fetchDEXVolume() {
  const chains = ['Solana', 'Base', 'BSC'];
  const results = {};

  for (const chain of chains) {
    try {
      const res = await fetch(`https://api.llama.fi/overview/dexs/${chain}?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`, UA);
      const text = await res.text();
      if (!text || !text.trim() || !text.trim().startsWith('{')) {
        results[chain.toLowerCase()] = null;
        continue;
      }
      const data = JSON.parse(text);
      results[chain.toLowerCase()] = {
        total_24h: data?.total24h ? parseFloat(data.total24h.toFixed(0)) : null,
        total_7d: data?.total7d ? parseFloat(data.total7d.toFixed(0)) : null,
        change_1d_pct: data?.change_1d != null ? parseFloat(data.change_1d.toFixed(2)) : null,
      };
    } catch (e) {
      results[chain.toLowerCase()] = { error: e.message };
    }
  }
  return results;
}

// ── FRED ──
async function fetchFRED(env) {
  const apiKey = env?.FRED_API_KEY;
  if (!apiKey) return { error: 'FRED_API_KEY not set', source: 'fred', updated_at: new Date().toISOString(), fed: null, tga: null, rrp: null, gnl: null };
  const series = { fed: 'WALCL', tga: 'WTREGEN', rrp: 'RRPONTSYD' };
  const results = { source: 'fred', updated_at: new Date().toISOString() };
  for (const [key, seriesId] of Object.entries(series)) {
    try {
      const data = await safeFetch(
        `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=4`
      );
      const obs = data?.observations;
      if (obs?.length > 0) {
        const valid = obs.find(o => o.value !== '.');
        results[key] = { value: valid ? parseFloat(valid.value) : null, date: valid?.date || null };
      } else { results[key] = null; }
    } catch (e) { results[key] = { error: e.message }; }
  }
  if (results.fed?.value != null && results.tga?.value != null && results.rrp?.value != null) {
    const fedT = results.fed.value / 1e6;
    const tgaT = results.tga.value / 1e6;
    const rrpT = results.rrp.value / 1e3;
    results.gnl = { value_t: parseFloat((fedT - tgaT - rrpT).toFixed(4)), date: results.fed?.date || results.tga?.date || results.rrp?.date || null };
  } else { results.gnl = null; }
  return results;
}

// ── 主入口 ──
async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const corsHeaders = buildCorsHeaders(request);

  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    if (path === '/api/all') {
      // 先并发拉不会互相限速的源
      const [fearGreed, btc, chainTVL, stablecoins, chainStables, dexVolume, fred] =
        await Promise.all([
          safe(fetchFearGreed),
          safe(fetchBTCPrice),
          safe(fetchChainTVL),
          safe(fetchStablecoins),
          safe(fetchChainStablecoins),
          safe(fetchDEXVolume),
          safe(() => fetchFRED(env)),
        ]);

      // CoinGecko 单独串行请求，避免和 BTC 的 CoinGecko 备用源并发触发限速
      const memeMcap = await safe(fetchMemeMcap);
      const memeTop = await safe(() => fetchMemeTopList(env));

      return new Response(JSON.stringify({
        timestamp: new Date().toISOString(),
        fear_greed: fearGreed,
        btc: btc,
        meme: memeMcap,
        tvl: chainTVL,
        stablecoins: stablecoins,
        chain_stablecoins: chainStables,
        dex_volume: dexVolume,
        fred: fred,
        meme_top: memeTop,
      }, null, 2), { headers: corsHeaders });
    }

    if (path === '/api/fear-greed') return new Response(JSON.stringify(await safe(fetchFearGreed)), { headers: corsHeaders });
    if (path === '/api/btc') return new Response(JSON.stringify(await safe(fetchBTCPrice)), { headers: corsHeaders });
    if (path === '/api/tvl') return new Response(JSON.stringify(await safe(fetchChainTVL)), { headers: corsHeaders });
    if (path === '/api/stablecoins') return new Response(JSON.stringify(await safe(fetchStablecoins)), { headers: corsHeaders });
    if (path === '/api/dex') return new Response(JSON.stringify(await safe(fetchDEXVolume)), { headers: corsHeaders });
    if (path === '/api/fred') return new Response(JSON.stringify(await safe(() => fetchFRED(env))), { headers: corsHeaders });
    if (path === '/api/meme') return new Response(JSON.stringify(await safe(fetchMemeMcap)), { headers: corsHeaders });
    if (path === '/api/meme-top') return new Response(JSON.stringify(await safe(() => fetchMemeTopList(env))), { headers: corsHeaders });
    if (path === '/api/alpha-support') {
      const chain = url.searchParams.get('chain');
      const address = url.searchParams.get('address');
      return new Response(JSON.stringify(await safe(() => fetchAlphaSupport(env, chain, address))), { headers: corsHeaders });
    }

    if (path === '/' || path === '') {
      return new Response(JSON.stringify({
        status: 'ok', service: 'LiquidityOS Data Worker v4',
        endpoints: ['/api/all', '/api/fear-greed', '/api/btc', '/api/tvl', '/api/stablecoins', '/api/dex', '/api/fred', '/api/meme', '/api/meme-top', '/api/alpha-support'],
      }, null, 2), { headers: corsHeaders });
    }
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
}

export default {
  async fetch(request, env, ctx) { return handleRequest(request, env); },
};
