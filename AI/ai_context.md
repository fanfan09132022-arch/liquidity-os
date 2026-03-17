# AI Context

## Purpose
This file is a compressed handoff for the next AI collaborator.
It reflects the current code reality on the `codex/full-preview` line after the full homepage redesign, detail-page identity pass, and chart-language unification.

The project is no longer in the phase of "make the pages exist" or "start the redesign".
Those parts are broadly done.
The next phase should be selective polish, correctness, and GitHub-ready synchronization of the integrated preview.

## Current Source Of Truth
- Primary local working branch: `codex/full-preview`
- Current root app entry:
  - [src/App.jsx](/Users/fanfan/Documents/Playground/src/App.jsx)
  - [src/styles.css](/Users/fanfan/Documents/Playground/src/styles.css)
- Worker entry:
  - [dashboard/worker/worker.js](/Users/fanfan/Documents/Playground/dashboard/worker/worker.js)

Important distinction:
- `codex/full-preview` is the real current product line.
- Historical PR-able mirror branches may still exist, but the newest redesign/layout/chart work lives on `codex/full-preview` first.

## Branch Roles

### `main`
- Historical remote mainline.
- Still reflects the older `dashboard/web` structure.
- Useful for understanding the previous repo layout and remote history.
- Not the best place to inspect the current full preview product.

### `codex/sync-20260314`
- Deprecated temporary reference branch.
- Mixed multiple workstreams and became unsuitable for PR/merge use.
- Keep only as historical reference. Do not resume development here.

### `codex/data-detail-pages`
- Clean task branch extracted from the older `dashboard/web` line.
- Purpose: isolate the data-detail-page work only.
- Good if someone wants to study or continue the detail-page package in the older structure.
- Not the best branch for reviewing the current full product.

### `codex/full-preview`
- Current local integrated product-preview line.
- Root-level Vite app.
- Main page and detail pages are wired together.
- This is the best branch to inspect the current product behavior.

## What Is Already Built

### Main workspace
- The root dashboard shell is active and usable.
- L0 to L4 structure is present in the root app.
- Macro refresh now goes through Worker-backed `/api/all`.
- The homepage hierarchy has been redesigned into:
  - Hero Control
  - sticky LayerGateBar
  - BTC Anchor
  - 2x2 decision Bento
  - L4 workbench
  - review layer
- Refresh controls now live in a bottom-right floating dock.

### Detail pages
The following pages exist and are wired from the main page:
- [src/BTCDetailPage.jsx](/Users/fanfan/Documents/Playground/src/BTCDetailPage.jsx)
- [src/L1DetailPage.jsx](/Users/fanfan/Documents/Playground/src/L1DetailPage.jsx)
- [src/L2DetailPage.jsx](/Users/fanfan/Documents/Playground/src/L2DetailPage.jsx)
- [src/L3DetailPage.jsx](/Users/fanfan/Documents/Playground/src/L3DetailPage.jsx)
- [src/FGDetailPage.jsx](/Users/fanfan/Documents/Playground/src/FGDetailPage.jsx)

### Shared configuration
- [src/config.js](/Users/fanfan/Documents/Playground/src/config.js)
- [src/lib/api.js](/Users/fanfan/Documents/Playground/src/lib/api.js)
- [src/lib/storage.js](/Users/fanfan/Documents/Playground/src/lib/storage.js)

### Worker / data aggregation
- [dashboard/worker/worker.js](/Users/fanfan/Documents/Playground/dashboard/worker/worker.js)
- `/api/all` now exists and powers homepage macro hydration.
- FRED, Fear & Greed, stablecoin, dex-volume, meme-top, and BTC aggregate data are wired into the homepage payload.
- BTC `200MA` was switched to CoinGecko history to avoid Binance instability.

## What Was Recently Completed
- Homepage Stocki-style card upgrade:
  - quick-read chips
  - action frameworks
  - watch verdict summaries
  - alpha synthesis block
- Theme system:
  - light/dark mode toggle
  - `localStorage` persistence
  - shared CSS-variable color system
- Signal language cleanup:
  - emoji signal lights replaced by real dots
  - trend arrows added to key summary values
- L1 manual-maintenance UX:
  - ScanInput
  - animated GNL readout
- LayerGateBar:
  - sticky L0-L4 progress strip
  - L4 de-emphasis when macro stack is incomplete
- Global redesign pass:
  - new token system
  - new typography scale
  - glass material system
  - homepage Bento layout
  - floating refresh dock
  - F&G SVG gauge on homepage
- Detail-page polish:
  - dynamic Y-axis fixes where needed
  - numeric/anchor typography cleanup
  - per-page identity accents
  - chart narrative/context labels
- Recharts visual unification from CSS:
  - lighter grids
  - unified axis typography
  - glass tooltip styling
  - normalized legends

## Current Product State

### Stable enough to review
- Main dashboard loads and refreshes.
- BTC anchor shows current price and non-null `200MA`.
- L1 GNL summary displays.
- L2 stablecoin summary displays.
- L3 meme summary and Top 50 display.
- F&G summary displays.
- Detail-page navigation works from the homepage.
- Light/dark theme switching works.
- Detail pages visually match the redesigned homepage much more closely.
- Recharts-driven detail charts now share one calmer visual language.

### Intentionally not final
- The integrated preview is strong enough to review, but still not a finalized production system.
- Some historical chart paths remain intentionally simplified when upstream reliability is weak.
- A few interaction details still need small polish passes rather than broad rewrites.

### Explicitly deferred / not solved
- Top 50 icon quality is still treated as upstream-data quality, not a frontend priority.
- Router migration is still not a priority; page switching remains centralized in `src/App.jsx`.
- Some older docs and repository structure are historical only.
- The next phase is not "expand data scope"; it is "polish and stabilize the integrated preview".

## File Map For The Next AI

### Must-read files
- [src/App.jsx](/Users/fanfan/Documents/Playground/src/App.jsx)
  - Main page structure
  - detail-page entry wiring
  - floating dock
  - LayerGateBar
  - F&G gauge
- [src/styles.css](/Users/fanfan/Documents/Playground/src/styles.css)
  - main visual system in the root app
  - global Recharts styling
- [src/BTCDetailPage.jsx](/Users/fanfan/Documents/Playground/src/BTCDetailPage.jsx)
- [src/L1DetailPage.jsx](/Users/fanfan/Documents/Playground/src/L1DetailPage.jsx)
- [src/L2DetailPage.jsx](/Users/fanfan/Documents/Playground/src/L2DetailPage.jsx)
- [src/L3DetailPage.jsx](/Users/fanfan/Documents/Playground/src/L3DetailPage.jsx)
- [src/FGDetailPage.jsx](/Users/fanfan/Documents/Playground/src/FGDetailPage.jsx)
- [src/config.js](/Users/fanfan/Documents/Playground/src/config.js)
- [dashboard/worker/worker.js](/Users/fanfan/Documents/Playground/dashboard/worker/worker.js)

### Historical / reference only
- `dashboard/web/...`
  - older structure
  - useful for branch archaeology, not current root-app execution
- `README.md`
  - may not match current root-app reality on every branch
- `docs/*`
  - historical requirements/context
  - useful for background, not always source-of-truth for current implementation

## Preview / Review Guidance
- If the next AI wants the most complete local product state, inspect `codex/full-preview`.
- If GitHub and local state ever diverge, trust the local `codex/full-preview` implementation first, then resync.
- If the next AI wants only the isolated historical detail-page package, inspect `codex/data-detail-pages`.

## Recommended Next Phase
- Stay in polish mode, not architecture-rebuild mode.
- Keep data plumbing changes tightly bounded.
- Treat current data-detail capability as "working infrastructure to preserve".
- Prioritize:
  1. small correctness fixes
  2. reviewability / GitHub sync hygiene
  3. remaining interaction rough edges
  4. preserving already-working data entry points
  5. avoiding unnecessary scope growth

## Practical Guardrails For The Next AI
- Do not reopen `codex/sync-20260314` as a working branch.
- Do not mistake `dashboard/web` for the primary current runtime.
- Do not expand data-source scope unless the redesign truly requires it.
- Do not break `src/App.jsx` detail-page entry wiring during UI restructuring.
- Keep Worker changes minimal unless homepage macro integrity is directly at risk.
- Do not reintroduce old static action-dock layouts; current runtime uses the floating dock.
