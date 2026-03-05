const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const UA = { headers: { 'User-Agent': 'LiquidityOS/1.0', 'Accept': 'application/json' } };

async function safe(fn) {
  try { return await fn(); }
  catch (e) { return { error: e.message }; }
}

async function safeFetch(url) {
  const res = await fetch(url, UA);
  const text = await res.text();
  if (!text || !text.trim()) return null;
  return JSON.parse(text);
}

// ── Fear & Greed ──
async function fetchFearGreed() {
  const data = await safeFetch('https://api.alternative.me/fng/?limit=1');
  const item = data?.data?.[0];
  return { value: item ? parseInt(item.value) : null, label: item?.value_classification || null };
}

// ── BTC：Binance (主) → CoinCap (备) → CoinGecko (备) ──
async function fetchBTCPrice() {
  // 主：Binance — 全球最稳，免费，无需 Key
  try {
    const data = await safeFetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT');
    if (data?.lastPrice) {
      return {
        price: parseFloat(parseFloat(data.lastPrice).toFixed(2)),
        change_24h: data.priceChangePercent ? parseFloat(data.priceChangePercent) : null,
        source: 'binance',
      };
    }
  } catch {}

  // 备1：CoinCap
  try {
    const data = await safeFetch('https://api.coincap.io/v2/assets/bitcoin');
    if (data?.data?.priceUsd) {
      return {
        price: parseFloat(parseFloat(data.data.priceUsd).toFixed(2)),
        change_24h: data.data.changePercent24Hr ? parseFloat(parseFloat(data.data.changePercent24Hr).toFixed(2)) : null,
        source: 'coincap',
      };
    }
  } catch {}

  // 备2：CoinGecko
  try {
    const data = await safeFetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true');
    if (data?.bitcoin?.usd) {
      return {
        price: data.bitcoin.usd,
        change_24h: data.bitcoin.usd_24h_change ? parseFloat(data.bitcoin.usd_24h_change.toFixed(2)) : null,
        source: 'coingecko',
      };
    }
  } catch {}

  return { price: null, change_24h: null, source: 'none' };
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
  if (!apiKey) return { error: 'FRED_API_KEY not set', fed: null, tga: null, rrp: null, gnl: null };
  const series = { fed: 'WALCL', tga: 'WTREGEN', rrp: 'RRPONTSYD' };
  const results = {};
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
    results.gnl = { value_t: parseFloat((fedT - tgaT - rrpT).toFixed(4)) };
  } else { results.gnl = null; }
  return results;
}

// ── 主入口 ──
async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

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
      }, null, 2), { headers: CORS_HEADERS });
    }

    if (path === '/api/fear-greed') return new Response(JSON.stringify(await safe(fetchFearGreed)), { headers: CORS_HEADERS });
    if (path === '/api/btc') return new Response(JSON.stringify(await safe(fetchBTCPrice)), { headers: CORS_HEADERS });
    if (path === '/api/tvl') return new Response(JSON.stringify(await safe(fetchChainTVL)), { headers: CORS_HEADERS });
    if (path === '/api/stablecoins') return new Response(JSON.stringify(await safe(fetchStablecoins)), { headers: CORS_HEADERS });
    if (path === '/api/dex') return new Response(JSON.stringify(await safe(fetchDEXVolume)), { headers: CORS_HEADERS });
    if (path === '/api/fred') return new Response(JSON.stringify(await safe(() => fetchFRED(env))), { headers: CORS_HEADERS });
    if (path === '/api/meme') return new Response(JSON.stringify(await safe(fetchMemeMcap)), { headers: CORS_HEADERS });

    if (path === '/' || path === '') {
      return new Response(JSON.stringify({
        status: 'ok', service: 'LiquidityOS Data Worker v4',
        endpoints: ['/api/all', '/api/fear-greed', '/api/btc', '/api/tvl', '/api/stablecoins', '/api/dex', '/api/fred', '/api/meme'],
      }, null, 2), { headers: CORS_HEADERS });
    }
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: CORS_HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS_HEADERS });
  }
}

export default {
  async fetch(request, env, ctx) { return handleRequest(request, env); },
};
