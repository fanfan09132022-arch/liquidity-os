# LiquidityOS Architecture

## High-level structure
This branch is organized around a root-level Vite + React app.

Top-level runtime-relevant files:
- `index.html`
- `package.json`
- `vite.config.js`
- `src/*`
- `dashboard/worker/worker.js`

## Runtime layers

### 1. Frontend app
Main frontend lives in:
- [src/App.jsx](/Users/fanfan/Documents/Playground/src/App.jsx)
- [src/styles.css](/Users/fanfan/Documents/Playground/src/styles.css)
- [src/main.jsx](/Users/fanfan/Documents/Playground/src/main.jsx)

Responsibilities:
- render homepage
- render detail pages
- manage local UI state
- trigger data refresh
- save/read snapshots via local storage bridge

### 2. Detail page layer
Current detail pages:
- [src/BTCDetailPage.jsx](/Users/fanfan/Documents/Playground/src/BTCDetailPage.jsx)
- [src/L1DetailPage.jsx](/Users/fanfan/Documents/Playground/src/L1DetailPage.jsx)
- [src/L2DetailPage.jsx](/Users/fanfan/Documents/Playground/src/L2DetailPage.jsx)
- [src/L3DetailPage.jsx](/Users/fanfan/Documents/Playground/src/L3DetailPage.jsx)
- [src/FGDetailPage.jsx](/Users/fanfan/Documents/Playground/src/FGDetailPage.jsx)

Responsibilities:
- show deeper evidence than homepage cards
- provide chart-heavy / context-heavy views
- preserve the summary-card → detail-page interaction pattern

### 3. Shared frontend support
Shared app support files:
- [src/config.js](/Users/fanfan/Documents/Playground/src/config.js)
- [src/lib/api.js](/Users/fanfan/Documents/Playground/src/lib/api.js)
- [src/lib/storage.js](/Users/fanfan/Documents/Playground/src/lib/storage.js)

Responsibilities:
- central config
- frontend fetch helpers
- storage abstraction for snapshots/history

### 4. Worker layer
Worker code:
- [dashboard/worker/worker.js](/Users/fanfan/Documents/Playground/dashboard/worker/worker.js)

Responsibilities:
- upstream fetch aggregation
- normalization of external market/macro data
- provide Worker endpoints used by homepage and detail pages

## Homepage structure
The homepage is a multi-layer trading workspace:

### Control layer
Purpose:
- answer “what kind of day is this?”

Contains:
- Hero
- sticky LayerGateBar below topbar
- BTC anchor as a dedicated full-width section
- floating refresh dock at bottom-right

### Decision layer
Purpose:
- summarize environment quickly before execution

Contains:
- a 2x2 Bento decision grid
- L1
- L2
- L3
- F&G compact card with SVG gauge

### Execution layer
Purpose:
- act on watchlist + candidates

Contains:
- watchlist / stock station
- alpha scanner
- top 50 market radar

Current execution-layer behavior:
- watchlist primary view is collapsed by default
- empty watchlist shows an onboarding-style empty state
- row color cues and verdict summaries support scan-first reading

### Review layer
Purpose:
- review history and system state

Contains:
- historical records
- diagnostics
- note/snapshot related review surfaces

Cross-layer floating tools:
- bottom-right refresh capsule / action dock
- draggable global note panel

## Navigation model
The project currently uses app-level page switching from `src/App.jsx`, not a full router framework.

Meaning:
- homepage owns entry wiring
- detail pages are connected from summary cards/buttons
- app state coordination is centralized in the main app shell

## Data flow
Typical path:

1. frontend triggers refresh
2. frontend fetches Worker-backed macro payload
3. Worker aggregates/normalizes upstream responses
4. frontend hydrates homepage cards
5. user can enter detail pages
6. snapshots are written/read locally

## Current visual/runtime notes
- `src/styles.css` now carries the main design-token system for both homepage and detail pages
- Recharts styling is globally normalized from CSS, not per-page JSX overrides
- homepage mini trend widgets (`TrendAssist`) are pure SVG and separate from Recharts
- `src/App.jsx` remains the coordination center for:
  - page switching
  - homepage section order
  - floating dock state
  - snapshot/history workspace mode

## Source-of-truth note
In this branch, the current runtime app is the root `src/*` app.

Do not confuse it with older branch structures such as:
- `dashboard/web/...`

Those may appear in other branches/history, but in this branch the active app is:
- `src/App.jsx`
- `src/styles.css`

## Architecture guardrails
- preserve homepage → detail-page wiring
- keep Worker changes minimal and intentional
- do not mix branch-history archaeology with current runtime assumptions
- treat local snapshot behavior as a first-class product feature, not disposable state
- do not mistake older static action-dock layouts for the current floating-dock runtime
