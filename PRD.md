# LiquidityOS — Product Requirements Document v7.0

> Last updated: 2026-03-24

## 1. Product Vision

LiquidityOS is a **personal crypto trading decision system** that transforms macro liquidity analysis into actionable trading signals through a structured 5-layer funnel (L0-L4). It is not a data dashboard — it is an opinionated decision engine that tells you **what to do** based on multi-layer signal alignment.

### Core Principle

> Upper-layer signals constrain lower-layer actions. No token execution (L4) without macro confirmation (L0-L3).

### Target User

Solo crypto trader. Desktop-only (1024px+). Daily active usage for market assessment and trade execution decisions.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────┐
│               Dashboard                      │
│  HERO Verdict → Signal Panel → L4 CTA       │
└──────────┬──────────────────────────────────┘
           │
     ┌─────┴─────┐
     │ 5-Layer   │
     │ Signal    │
     │ Engine    │
     └─────┬─────┘
           │
  ┌────────┼────────┬────────┬────────┐
  L0       L1       L2       L3       L4
  Macro    Liq.     Stable   Meme     Workbench
  Cycle    Flow     Ammo     Sector   (Execution)
```

### Decision Flow

1. **Dashboard** displays real-time Hero Signal verdict (Attack/Aggressive/Watch/Defend)
2. **Signal Panel** shows 5 layer signals with color-coded status
3. **CTA** directs user to L4 Workbench for execution
4. **L4 Workbench** provides Watch Station + Alpha Scanner + Meme Radar

---

## 3. Hero Signal Engine

The core computation aggregates signals from L2, L3, FG (Fear & Greed), and L4 into a single 0-1 score.

### Score → Posture Mapping

| Score | Posture | Label | Action Guidance |
|-------|---------|-------|-----------------|
| >= 0.7 | Attack | 进攻 | Actively filter new targets, increase conversion, scale size |
| 0.5-0.69 | Aggressive | 积极 | Select quality targets, no chasing, control position |
| 0.35-0.49 | Watch | 观望 | No new positions, monitor existing, await confirmation |
| < 0.35 | Defend | 防御 | No new positions, reduce watch list, await improvement |

### Verdict Engine

Generates natural-language trading guidance based on:
- Signal alignment count (X/5 layers aligned)
- Bull/bear signal composition (which layers are bullish vs bearish)
- L4 execution hint (what to do in the Workbench)

### Layer Signal Definitions

| Layer | Input | Green | Yellow | Red |
|-------|-------|-------|--------|-----|
| L0 | BTC vs 200MA | >= 0% (expansion) | — | < 0% (contraction) |
| L1 | FRED GNL 7d change | >= 0 (inflow) | — | < 0 (outflow) |
| L2 | Stablecoin 7d change + SOL inflow | Both positive | Mixed | Both negative |
| L3 | Meme mcap 24h + DEX volume | Resonance strong (>= 0.7) | Mixed (0.4-0.69) | Sector weak (< 0.4) |
| FG | Fear & Greed index | >= 55 | 30-54 | < 30 |
| L4 | Watch Station + Alpha assessment | Bull ratio high + V/Liq active | Divergence | Full retreat + shallow pool |

---

## 4. Page Specifications

### 4.1 Dashboard (/)

**Structure:** HERO Verdict → 5 Signal Rows → L4 CTA → History

- **HERO Block:** Computed verdict with posture label, gradient background, action text
- **Signal Panel:** 5 interactive rows (L0/L1/L2/L3/FG), each showing:
  - Layer badge + label + SignalBadge (color dot)
  - Primary metric (BTC price, GNL value, stablecoins total, meme mcap, FG value)
  - Secondary metric/reason
  - Click navigates to detail page
- **L4 CTA:** "Go to Workbench" button
- **History:** Collapsible daily snapshot archive

### 4.2 L0 Macro Cycle (/l0)

- BTC current price (hero metric)
- Expansion/Contraction signal badge
- vs 200MA percentage
- MVRV Z-Score with interpretation zones (overvalued > 7, healthy 0-3, undervalued < 0)
- BTC 7-day sparkline
- Embedded BTC detail charts

### 4.3 L1 Liquidity Flow (/l1)

- GNL current value in trillions (hero metric)
- Inflow/Outflow signal badge
- Component breakdown: FED balance, TGA, RRP (all in trillions)
- Historical charts

### 4.4 L2 Stablecoin Ammo (/l2)

- Stablecoins total with trend arrow (hero metric)
- 7-day net change amount and percentage
- Solana chain net inflow 7-day
- Chain-by-chain breakdown detail

### 4.5 L3 Meme Sector (/l3)

- Meme total market cap (hero metric)
- Hot/Cold signal badge
- 24h change percentage
- DEX volume distribution (Solana / Base / BSC)
- Top 50 meme token list

### 4.6 L4 Workbench (/workbench)

The primary execution interface. Contains four sections:

#### Watch Station (Main Work Area)
- Up to 10 token slots for daily monitoring
- Per-slot: token address, status pill (ready/position/watching), V/Liq ratio (color-coded), quick judgment
- Expandable fields: 7d change, 1m change, chips distribution, pool depth, notes
- Auto-refresh toggle
- Summary stats: subjective targets / ready to execute / positioned

#### Alpha Scanner (Secondary Work Area)
- Candidate collection slots for initial screening
- Per-slot: chain selector (SOL/BSC/Base), token address, auto-data panel
- Auto-fill from `/api/alpha-support` with security indicators, price action, momentum/pool/chips judgment
- Decision buttons: Attack (进) / Watch (观) / Abandon (弃)
- Action: promote to Watch Station or clear

#### Meme Radar (Candidate Discovery Layer)
- Latest on-chain tokens from DexScreener
- Sort modes: Composite / Latest / V/Liq / Price Change
- Per-item: symbol, chain, launch time, 1h change, volume, liquidity
- Quick actions: "+ Alpha" / "+ Watch"
- Market context display showing current signal posture
- Top 3 badges in composite sort

#### Supporting Features
- **Daily Brief:** One-click copy of macro state + watchlist + today's decisions
- **Decision History:** Auto-recorded Attack/Watch/Abandon log (last 100)
- **Note Panel:** Floating draggable notepad for market observations

### 4.7 Detail Pages

| Route | Page | Content |
|-------|------|---------|
| /btc | BTC Detail | TradingView chart, price metrics, on-chain indicators |
| /fg | Fear & Greed Detail | Historical FG chart, interpretation zones |
| /l1/detail | L1 Detail | FRED component charts (WALCL, TGA, RRP) |
| /l2/detail | L2 Detail | Stablecoin supply charts, chain distribution |
| /l3/detail | L3 Detail | Meme market breakdown, top token tables |

---

## 5. Data Architecture

### Worker API Endpoints

All data proxied through Cloudflare Worker (`dashboard/worker/worker.js`).

| Endpoint | Source | Cache | Purpose |
|----------|--------|-------|---------|
| `/api/all` | Aggregated | 1h | Full macro snapshot for Dashboard |
| `/api/fg` | Alternative.me | 1h | Fear & Greed Index |
| `/api/cg/markets` | CoinGecko | 30m | Market data by category |
| `/api/cg/chart/:id` | CoinGecko | 1h | Historical price charts |
| `/api/meme-summary` | CMC (CG fallback) | 15m | Meme sector market cap |
| `/api/cmc/meme-markets` | CoinMarketCap | 30m | Top 50 meme tokens |
| `/api/meme-radar` | DexScreener | 5m | New token discovery |
| `/api/newsflash` | BlockBeats | 10m | Crypto news by layer |
| `/api/alpha-support` | Birdeye + DexScreener | — | Token auto-fill data |
| `/api/gmgn/rank` | GMGN (via proxy) | 5m | Meme token ranking |
| `/api/gmgn/token-info` | GMGN (via proxy) | — | Token details |
| `/api/gmgn/token-security` | GMGN (via proxy) | 30m | Security audit |
| `/api/llama/stablecoins` | DeFiLlama | 30m | Stablecoin supply list |
| `/api/llama/stable-chart` | DeFiLlama | 30m | Stablecoin time-series |
| `/api/fred/*` | FRED (St. Louis Fed) | 24h | WALCL, TGA, RRP |

### Infrastructure

```
Browser
  ↓
Cloudflare Pages (SPA)
  ↓
Cloudflare Worker (data aggregation + caching)
  ├── FRED, CoinGecko, CMC, DeFiLlama, DexScreener, Birdeye, BlockBeats
  └── Vercel Serverless (GMGN IPv4 proxy) → GMGN API
```

GMGN requires IPv4 — Cloudflare Workers default to IPv6, so a Vercel proxy (`dashboard/gmgn-proxy/`) handles the translation.

---

## 6. Design System

- **Tokens:** CSS custom properties with `--lo-*` prefix
- **Modes:** Light + Dark (dark is primary)
- **Typography:** System fonts, monospace for numbers
- **Colors:** Signal semantics — green (bull), yellow (neutral), red (bear)
- **Components:** SignalBadge, LOChart, MetricBlock, SparkLine, TabBar

Full specification in `DESIGN.md`.

---

## 7. Current Status (v7.0)

### Completed
- L0-L4 full layer architecture with signal computation
- Hero Signal Engine + Verdict Engine
- Dashboard rebuilt as decision system (HERO → Signals → CTA)
- L4 Workbench: Watch Station, Alpha Scanner, Meme Radar, Daily Brief, Decision History
- 5 Detail Pages with charts and deep-dive data
- Worker with 15+ API endpoints, multi-source aggregation, intelligent caching
- CMC integration replacing rate-limited CoinGecko for meme data
- GMGN integration via Vercel IPv4 proxy for token ranking + security audit
- Cloudflare deployment (Worker + Pages)

### Known Limitations
- Binance Web3 API geo-blocked (451) — 3 dead routes pending removal
- CoinGecko rate limiting (30 req/min) — CMC primary, CG as fallback only
- GMGN anti-replay requires unique client_id per request
- No mobile support (desktop 1024px+ only, by design)

### Deferred
- P1 Design unification (two design systems coexist: `--lo-*` tokens vs hardcoded iOS hex)
- Format function deduplication across 8+ files
- Component migration from inline styles to CSS classes
- AppStateProvider Phase C (watchlist/alphaCards context migration)
