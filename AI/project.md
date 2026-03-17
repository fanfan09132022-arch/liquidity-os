# LiquidityOS Project Brief

## What this project is
LiquidityOS is a personal trading workspace built around an `L0-L4` liquidity framework.

Its job is to help one user do four things in one product:
- judge the market environment
- read sector/liquidity conditions
- track meme positions and new candidates
- save daily notes and snapshots for review

## Core product model
- `L0`: position bias and risk posture
- `L1`: global net liquidity
- `L2`: stablecoin liquidity / on-chain ammo
- `L3`: meme sector heat
- `L4`: stock watchlist + alpha candidate workflow

The product is designed as:
- homepage = fast judgment
- detail pages = evidence and deeper data context

## Current stage
The project has already moved past:
- basic MVP page structure
- detail-page bring-up
- first-pass data-expression plumbing

The current product state is a fully integrated preview with:
- redesigned homepage hierarchy
- five wired detail pages
- unified dark/light visual system
- Recharts chart-language cleanup
- snapshot/history workflow still intact

Current focus is:
- interaction polish
- reviewable diff hygiene
- preserving working data chains while refining presentation
- small UX correctness fixes instead of large new systems

Not the current focus:
- adding large new business features
- multi-user system
- auth/login
- database architecture
- broadening upstream data scope for its own sake

## Current source-of-truth view
For the most complete local product preview, use:
- branch: `codex/full-preview`

This branch is the best place to understand the current integrated product state:
- main homepage exists
- detail pages are wired in
- worker-backed data flow exists
- current redesign work also lives here first

## Important branch meanings
- `main`
  - historical/stable mainline reference
  - useful for baseline and remote history
  - not the best branch for the newest integrated preview

- `codex/data-detail-pages`
  - task branch for data detail pages only
  - use this when working specifically on detail-page features

- `codex/full-preview`
  - integrated preview branch
  - use this when checking the whole product experience

- `codex/sync-20260314`
  - deprecated temporary reference branch
  - do not resume development here

## Main user flows
1. Open homepage and judge market posture from the control layer
2. Scan L1/L2/L3/F&G summary cards
3. Enter L4 workspace to manage tracked assets and alpha candidates
4. Save daily note / snapshot
5. Revisit history later
6. Click detail-entry cards to inspect deeper evidence

## Current known realities
- homepage macro data is fetched through the Worker-backed flow
- detail pages exist for BTC, L1, L2, L3, and F&G
- homepage and detail pages now share one visual/material system
- homepage decision layer is a 2x2 Bento grid
- refresh controls now live in a floating bottom-right dock
- some chart/data behaviors are still under active refinement
- upstream data quality can still affect what appears on screen

## What another AI should do first
If you are a new AI joining this project:
1. read `architecture.md`
2. read `rules.md`
3. inspect `src/App.jsx`
4. inspect the relevant detail page file before editing
