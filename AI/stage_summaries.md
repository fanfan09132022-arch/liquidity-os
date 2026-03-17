# Stage Summaries

## Purpose
This file compresses the development history of the data-expression layer.
It is not a full changelog. It records the major stages, why they happened, what they solved, and what state they are in now.

The timeline begins when the project started building detailed data pages from `L0-B · BTC`, because that is the point where the work clearly shifted from structural page cleanup into deeper data-expression capability.

## Stage 1 · From Summary Card To BTC Detail Page

### Goal
Move beyond a homepage BTC summary card and build a proper detail page that can answer:
- where BTC sits in the cycle
- how BTC relates to the alt/meme structure

### What changed
- Created a dedicated BTC detail page:
  - [src/BTCDetailPage.jsx](/Users/fanfan/Documents/Playground/src/BTCDetailPage.jsx)
- Introduced `currentPage`-style page switching instead of a router.
- Established the reusable detail-page shell:
  - back header
  - full-width chart area
  - supporting cards

### Product effect
- The project stopped being "homepage only".
- A new interaction pattern was introduced: summary card → deep context page.

### Status
- Complete

## Stage 2 · Expanding Detail Pages Across The Decision Stack

### Goal
Apply the BTC detail-page pattern to the rest of the decision layer so the dashboard could support deeper reading without bloating the homepage.

### What changed
- Added:
  - [src/L1DetailPage.jsx](/Users/fanfan/Documents/Playground/src/L1DetailPage.jsx)
  - [src/L2DetailPage.jsx](/Users/fanfan/Documents/Playground/src/L2DetailPage.jsx)
  - [src/L3DetailPage.jsx](/Users/fanfan/Documents/Playground/src/L3DetailPage.jsx)
  - [src/FGDetailPage.jsx](/Users/fanfan/Documents/Playground/src/FGDetailPage.jsx)
- Wired entry points from the main page in:
  - [src/App.jsx](/Users/fanfan/Documents/Playground/src/App.jsx)

### Product effect
- The dashboard gained a real layered reading path:
  - homepage for fast judgment
  - detail pages for evidence and context

### Status
- Complete at functional level

## Stage 3 · Shared Data Entry And Config Layer

### Goal
Prevent detail pages from becoming isolated experiments by giving them shared configuration and consistent fetch paths.

### What changed
- Added:
  - [src/config.js](/Users/fanfan/Documents/Playground/src/config.js)
- Standardized Worker-based fetch usage in the detail pages.
- Maintained shared app-level refresh behavior through:
  - [src/lib/api.js](/Users/fanfan/Documents/Playground/src/lib/api.js)

### Product effect
- Detail pages started to act like part of one product, not five separate demos.

### Status
- Complete

## Stage 4 · Data Proxy / Worker Stabilization

### Goal
Reduce frontend instability caused by direct upstream requests and CORS / rate-limit failures.

### What changed
- Expanded:
  - [dashboard/worker/worker.js](/Users/fanfan/Documents/Playground/dashboard/worker/worker.js)
- Added or stabilized routes used by detail pages and homepage macro refresh.
- Introduced `/api/all` as the homepage aggregate source.

### Key correction
- The homepage refresh chain was initially broken because frontend code expected `/api/all`, but Worker did not provide it.
- This was later fixed, and homepage L1/L2/L3/BTC/F&G values began hydrating correctly again.

### Product effect
- Main page macro blocks stopped depending on a missing aggregate endpoint.
- The app regained a credible "refresh data" path.

### Status
- Complete enough for current preview
- Still infrastructure, not final platform architecture

## Stage 5 · Branch Drift And The Failure Of `codex/sync-20260314`

### Goal at the time
Use one branch to hold ongoing implementation progress.

### What went wrong
- Too many concerns mixed together:
  - data-detail pages
  - structure migration
  - historical `dashboard/web` code
  - unrelated UI changes
  - Worker experiments

### Outcome
- `codex/sync-20260314` became a reference dump, not a safe merge branch.

### Product/architecture lesson
- A branch can still contain useful work but no longer be suitable as a PR base.

### Status
- Deprecated for formal development
- Kept only as historical reference

## Stage 6 · Isolating The Data-Detail Task

### Goal
Extract the valuable "data detail pages" work from the mixed temporary branch into a cleaner task branch.

### What changed
- Created the cleaner task line:
  - `codex/data-detail-pages`
- Preserved only the detail-page package and its minimum dependencies.

### Product effect
- Made it possible to reason about the data-detail package on its own.

### Status
- Complete

## Stage 7 · Creating A Unified Preview

### Goal
Avoid the split where:
- one branch had the current main page
- another branch had the detail-page package

### What changed
- Built:
  - `codex/full-preview`
- Integrated the current root app with the detail-page capability.

### Product effect
- Created the first branch that behaved like a unified preview of the real product:
  - homepage present
  - detail pages wired in
  - macro data refreshing again

### Status
- Complete

## Stage 8 · Making The Preview Reviewable On GitHub

### Goal
Convert the working full preview into something GitHub can diff and review against `main`.

### Problem
- `codex/full-preview` had no common history with remote `main`, so GitHub could not create a PR.

### What changed
- Built:
  - `codex/full-preview-prable`
- Started from `origin/main`
- Transplanted the current full-preview code into that branch
- Opened GitHub draft PR `#1`

### Product effect
- The current full preview is no longer trapped as local-only truth.
- It now has a reviewable branch and PR surface.

### Status
- Complete

## Stage 9 · Recent Corrections To Data Expression

### BTC
- `200MA` stopped relying on unstable Binance kline behavior in the Worker.
- BTC moving average now comes from CoinGecko 200-day history.
- Homepage BTC anchor now shows non-null `200MA`.

### F&G
- Homepage F&G pointer positioning was corrected so low values render on the left as intended.

### L3 Top 50
- Top 50 table stopped independently re-requesting the same CoinGecko markets payload that the main macro snapshot already had.
- It now reuses shared macro payload data passed from the homepage.

### L3 Meme history chart
- The unstable free-tier historical chart path was removed from active use.
- The Meme summary area now shows real-time snapshot values plus an explicit note that historical trend is temporarily unavailable.

### Product effect
- Fewer misleading "temporarily unavailable" states
- More truthful UI behavior
- Better separation between:
  - live snapshot data
  - unstable historical views

### Status
- Complete for current preview line

## Stage 10 · Homepage UI System Upgrade

### Goal
Turn the root homepage from a working data dashboard into a coherent trading workspace with stronger hierarchy and scanability.

### What changed
- Upgraded summary cards with:
  - AI-summary emphasis
  - quick-read chips
  - action frameworks
  - watch verdict summaries
  - alpha synthesis
- Added:
  - theme switching
  - real signal dots
  - trend arrows
  - animated L1 manual inputs / GNL readout
  - sticky LayerGateBar
- Replaced the old homepage visual language with a stronger token-driven design system.

### Product effect
- The homepage became much easier to scan in sequence.
- Macro posture now reads as one system rather than many isolated cards.

### Status
- Complete for current preview line

## Stage 11 · Detail-Page Visual And Identity Pass

### Goal
Remove the visual and experiential gap between homepage and detail pages.

### What changed
- Added per-page identity accents:
  - L1 cold blue
  - L2 cyan/green
  - L3 warm orange
  - F&G value-driven emotional tint
- Improved detail-page numeric anchors and supporting copy.
- Added contextual comparison lines and narrative annotations where appropriate.

### Product effect
- Detail pages stopped feeling like detached utility screens.
- Each page now communicates what kind of evidence it represents before the user reads deeply.

### Status
- Complete for current preview line

## Stage 12 · Global Redesign And Layout Reconstruction

### Goal
Rebuild the homepage rhythm, spacing, and section order around a more intentional workspace flow.

### What changed
- Rebuilt the color / typography system around CSS variables.
- Reworked the homepage layout into:
  - Hero Control
  - LayerGateBar
  - BTC Anchor
  - 2x2 decision Bento
  - L4 workbench
  - review layer
- Moved refresh controls into a bottom-right floating dock.
- Rebuilt the homepage F&G card around a compact gauge-based layout.

### Product effect
- The homepage now behaves more like a deliberate control room than a stacked list of cards.
- Visual weight flows outward from Hero instead of being evenly flat everywhere.

### Status
- Complete for current preview line

## Stage 13 · Chart-Language Unification

### Goal
Give Recharts-based detail pages one shared visual language without reopening every JSX chart implementation.

### What changed
- Unified chart styling from CSS:
  - faint horizontal-only grids
  - subdued numeric axes
  - glass tooltip styling
  - normalized legends
  - wrapper overflow cleanup for tooltips

### Product effect
- Charts across L1/L2/L3 feel like part of one product.
- The background noise of chart chrome was reduced significantly.

### Status
- Complete for current preview line

## Current Acceptance Summary

### Pass
- Homepage macro refresh path
- BTC anchor basic evidence
- L1/L2/L3/F&G summaries
- Detail-page entry wiring
- Top 50 table presence
- Homepage redesign / floating dock / LayerGateBar
- Detail-page identity pass
- Chart-language unification

### Pass with follow-up
- GitHub sync / PR hygiene for the newest local state
- Minor interaction polish
- Selective remaining chart narration improvements

### Intentionally deferred
- Top 50 icon-quality cleanup
- Broader data-source expansion
- Restoring every unstable historical visualization before it can be made truthful

## What The Next Phase Should Focus On
- Finishing reviewability and handoff quality
- Small UX correctness fixes
- Preserving the already-working data-expression skeleton while polishing the interface

## What Not To Reopen By Default
- Do not revive `codex/sync-20260314` as a live branch.
- Do not treat older `dashboard/web` files as the primary current app.
- Do not let new data-source work replace the polish/stability priority unless a concrete blocker appears.
