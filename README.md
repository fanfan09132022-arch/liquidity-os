# LiquidityOS

A personal crypto trading decision system built on a 5-layer liquidity analysis framework (L0-L4). Transforms macro liquidity signals into actionable trading decisions through a structured funnel: macro cycle positioning, liquidity flow tracking, stablecoin deployment analysis, meme sector rotation detection, and individual token execution.

**Live:** Deployed on Cloudflare Workers + Pages

## Architecture

```
Dashboard (HERO verdict + signal panel + L4 CTA)
  |
  +-- L0 Macro Cycle     -- Fed balance sheet, TGA, RRP, global liquidity net
  +-- L1 Liquidity Flow   -- BTC dominance, ETH/BTC, DeFi TVL by chain
  +-- L2 Stablecoin Ammo  -- USDT/USDC supply, chain distribution, 7d delta
  +-- L3 Meme Sector      -- Meme market cap, top 50 radar, sector rotation
  +-- L4 Workbench        -- Alpha scanner, watch station, meme radar, decision log
  |
  +-- Detail Pages        -- BTC, FG (Fear & Greed), L1-L3 deep-dive charts
```

### Decision Engine

The Dashboard computes a real-time **Hero Signal** (0-1 score) from L2/L3/FG/L4 signals, mapped to four trading postures:

| Score | Posture | Action |
|-------|---------|--------|
| >= 0.7 | Attack | Increase position, chase momentum |
| >= 0.5 | Aggressive | Hold winners, add on dips |
| >= 0.35 | Watch | Reduce exposure, wait for confirmation |
| < 0.35 | Defend | Exit risk assets, preserve capital |

A **Verdict Engine** generates natural-language trading guidance based on signal alignment across all layers.

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite + React Router v6 |
| Charts | Recharts + TradingView widget |
| Styling | CSS custom properties (`--lo-*` design tokens) |
| Data Worker | Cloudflare Worker (`dashboard/worker/`) |
| GMGN Proxy | Vercel Serverless Function (`dashboard/gmgn-proxy/`) |
| Hosting | Cloudflare Pages (SPA) |

## Data Sources

| Source | Endpoint | Data |
|--------|----------|------|
| FRED (St. Louis Fed) | `/api/fred/*` | WALCL, TGA, RRP |
| CoinGecko | `/api/cg/*` | BTC price, market charts, categories |
| CoinMarketCap | `/api/meme-summary`, `/api/cmc/*` | Meme market cap, top 50 meme tokens |
| DeFiLlama | `/api/llama/*` | Chain TVL, DEX volume, stablecoin history |
| Alternative.me | `/api/fg` | Fear & Greed Index |
| Birdeye | `/api/birdeye/*` | Solana token prices |
| DexScreener | `/api/dexscreener/*` | Token pairs, boosted tokens |
| GMGN | `/api/gmgn/*` | Meme token ranking, security audit |
| BlockBeats | `/api/newsflash` | Crypto news feed |

## Project Structure

```
/
├── src/
│   ├── App.jsx                    # Main app with signal engine + all detail pages
│   ├── pages/                     # Route pages (Dashboard, L0-L4)
│   ├── components/shared/         # SignalBadge, LOChart, MetricBlock, etc.
│   ├── context/AppStateProvider   # Shared state (watchlist, alpha cards)
│   └── lib/                       # api.js, utils.js, storage.js
├── dashboard/
│   ├── worker/worker.js           # Cloudflare Worker (~1500 lines, all API proxying + aggregation)
│   └── gmgn-proxy/                # Vercel function for GMGN IPv4 proxy
├── index.html
├── AI/                            # PM workflow docs (Claude + Codex handoff protocol)
├── DESIGN.md                      # Design system specification
└── wrangler.jsonc                 # Cloudflare Pages SPA config
```

## Development

```bash
# Frontend
npm install
npm run dev              # http://localhost:5173

# Worker (needs API keys as env vars)
cd dashboard/worker
npx wrangler dev         # http://localhost:8787

# GMGN Proxy (deployed on Vercel)
cd dashboard/gmgn-proxy
npx vercel dev           # http://localhost:3000
```

### Required Environment Variables

**Cloudflare Worker secrets:**
- `FRED_API_KEY` — FRED (St. Louis Fed)
- `CMC_API_KEY` — CoinMarketCap
- `BIRDEYE_API_KEY` — Birdeye
- `BLOCKBEATS_API_KEY` — BlockBeats
- `GeckoTerminal_API_KEY` — GeckoTerminal
- `GMGN_PROXY_KEY` — Shared secret for GMGN proxy

**Vercel GMGN Proxy env vars:**
- `GMGN_API_KEY` — GMGN OpenAPI key
- `PROXY_KEY` — Shared secret (must match Worker's `GMGN_PROXY_KEY`)

## Deployment

```bash
# Deploy data worker
cd dashboard/worker && npx wrangler deploy

# Deploy GMGN proxy
cd dashboard/gmgn-proxy && npx vercel deploy --prod

# Build & deploy frontend (Cloudflare Pages)
npm run build
npx wrangler deploy      # Uses root wrangler.jsonc
```

## PM Workflow

This project uses a **PM Controller** pattern:
1. Claude (PM) diagnoses issues and creates execution packages
2. Codex (execution AI) implements packages autonomously
3. Claude reviews results and iterates

Package specs and handoff protocols are documented in `AI/`.
