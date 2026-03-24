# Design System — LiquidityOS

> 本文件由 `/design-consultation` 竞品调研 + `/ui-ux-pro-max` 代码审查生成。
> 修改任何视觉/交互细节前，先对照此文件。偏离需用户明确批准。

---

## Product Context

- **What this is:** 个人加密货币交易工作台 — 每日决策漏斗，不是查询工具
- **Who it's for:** 单人操盘手，每日开盘前走 L0→L4 漏斗，做出「进 / 观 / 弃」判断
- **Space/industry:** Crypto personal finance / trading tools
- **Project type:** Multi-page SPA（React Router v6）
- **Competitive landscape:** Glassnode、Token Terminal、Nansen、TradingView、Coinglass
- **Stack:** React 18 + Vite + React Router v6 + Recharts + lightweight-charts, Cloudflare Worker, localStorage
- **Min viewport:** 1024px 桌面优先，不做移动端适配

### 产品与竞品的本质区别

竞品（Glassnode、Token Terminal）是**查询工具** — 用户带着问题来找数据。
LiquidityOS 是**决策漏斗** — 用户顺着 L0→L4 走一遍做出判断。
因此设计必须强调 **叙事流** 和 **结论先行**，而不是让用户自己从数据中找答案。

---

## Data Layer Architecture

| 层 | 路由 | 名称 | 核心叙事 | Worker 数据字段 |
|----|------|------|---------|----------------|
| Hero | `/`（首页融合区） | 情绪锚点 | 当前市场综合结论 + 信号对齐度 | fear_greed + hero score |
| L0 | `/macro` | 市场周期 | BTC 在周期中的位置 | btc.price / btc.vs_ma_200_pct / mvrv_z_score |
| L1 | `/liquidity` | 净流动性 | 宏观资金是流入还是流出 | fred.gnl / fed / tga / rrp |
| L2 | `/stablecoins` | 稳定币 | 市场弹药增减 | stablecoins.total / change_7d / chain_stablecoins.solana |
| L3 | `/meme` | Meme 板块 | 风险偏好与板块热度 | meme.mcap / dex_volume（sol/base/bsc） |
| L4 | `/workbench` | 工作台 | 个人操作链 | Meme Radar → Alpha Scanner → Watch Station |

---

## Aesthetic Direction

- **Direction:** Narrative-Industrial
  - Glassnode 的信息密度 + Token Terminal 的排版克制力
  - 不是"查询工具"外观，而是"决策漏斗"外观 — 结论先行，证据在后
- **Decoration level:** Minimal + Signal-Driven
  - 装饰的唯一来源是信号色（绿/黄/红）
  - 无边框装饰、无渐变背景、无 glow 效果、无 neon
- **Mood:** 像一块好用的专业仪表盘 — 信息密度高、层级清晰、不让用户多想一秒
- **Dark mode:** 深色模式为主视觉，浅色为次要

### Anti-Patterns（禁止）

- Purple/violet 渐变作为默认 accent
- 3-column feature grid with icons in colored circles
- Uniform bubbly border-radius on all elements
- Gradient buttons
- Neon glow / glitch / scanline effects
- 把 emoji 当作结构性图标（用 SVG）

---

## Typography

### Font Stack

| Role | Font | Fallback | 理由 |
|------|------|----------|------|
| **Display / Hero** | Satoshi | -apple-system, sans-serif | 比 Inter 更有辨识度，几何性强，让产品第一眼就不同于竞品清一色的 Inter/system-ui |
| **Body / UI / Labels** | DM Sans | -apple-system, sans-serif | 清晰、中性、x-height 大，小字号可读性优秀 |
| **Data / Numbers** | JetBrains Mono | SF Mono, ui-monospace, monospace | tabular-nums，行业标准，与 Glassnode/TradingView 一致 |

### CSS Custom Properties

```css
--lo-font-display: 'Satoshi', -apple-system, sans-serif;
--lo-font-body: 'DM Sans', -apple-system, sans-serif;
--lo-font-mono: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
```

### Loading Strategy

- Satoshi：通过 Fontshare API 引入（`api.fontshare.com`）
- DM Sans + JetBrains Mono：通过 Google Fonts 引入
- 策略：`<link rel="preconnect">` + `display=swap`，FOUT 可接受

### Type Scale

| Token | Size | Role |
|-------|------|------|
| `--lo-text-anchor` | 48px | Hero 信号文字（「进攻」「防御」等） |
| `--lo-metric-hero` | 36px | 摘要卡主指标大数字 |
| `--lo-metric-primary` | 24px | 摘要卡副指标 / 详情页核心数值 |
| `--lo-text-value` | 24px | 核心数值（价格、FGI 分值） |
| `--lo-text-title` | 20px | Section 标题 |
| `--lo-text-body` | 15px | 正文阅读内容 |
| `--lo-text-secondary-value` | 16px | 次要数值、section 副标题 |
| `--lo-metric-secondary` | 14px | 次级数据行 |
| `--lo-text-label` | 13px | 表格列标签、按钮文字、卡片标题 |
| `--lo-text-meta` | 11px | 说明文字、时间戳、注释 |

### Font Weight

| Token | Value | Role |
|-------|-------|------|
| `--lo-weight-regular` | 400 | 正文、次要信息 |
| `--lo-weight-medium` | 500 | UI 控件、tab 标签 |
| `--lo-weight-label` | 600 | 标签、次要强调 |
| `--lo-weight-bold` | 700 | 核心数字、Hero 标题 |
| `--lo-weight-black` | 900 | Hero 信号文字（仅 Satoshi display） |

---

## Color

- **Approach:** Signal-First — 信号色是第一视觉语言，品牌色克制辅助
- **Light / Dark:** 完整双模式，深色为主

### Brand

| Token | Dark | Light | 用途 |
|-------|------|-------|------|
| `--lo-brand` | `#0EA5E9` | `#0284c7` | 品牌色（sky-blue），主按钮、激活态、链接、图表主线 |
| `--lo-brand-soft` | `rgba(14,165,233,0.12)` | `rgba(2,132,199,0.10)` | 品牌色浅底 |
| `--lo-brand-hover` | `#38bdf8` | `#0EA5E9` | 品牌色 hover 态 |

**为什么是 sky-blue 而不是 teal：** 竞品偶尔用 teal（Nansen），sky-blue 更独特且与信号色零冲突。在深色底上高对比且中性。

### Signal Colors

| Token | Dark | Light | 语义 |
|-------|------|-------|------|
| `--lo-signal-bull` | `#4ade80` | `#22c55e` | 积极 / 扩张 / 看涨 |
| `--lo-signal-neutral` | `#fbbf24` | `#f59e0b` | 观望 / 过渡 / 中性 |
| `--lo-signal-bear` | `#f87171` | `#ef4444` | 防御 / 收缩 / 看跌 |

**Soft variants（用于 badge 背景、pill）：**

| Token | Value |
|-------|-------|
| `--lo-signal-bull-soft` | `rgba(34,197,94,0.12)` |
| `--lo-signal-neutral-soft` | `rgba(245,158,11,0.12)` |
| `--lo-signal-bear-soft` | `rgba(239,68,68,0.12)` |

**信号色使用规则（WCAG `color-not-only`）：**
- 信号色**必须**同时搭配文字标签或图标，不得仅靠颜色传达含义
- SignalBadge 必须包含：圆点 + 文字标签 + soft background pill

### Surface Colors (Dark Mode — Primary)

| Token | Value | 用途 |
|-------|-------|------|
| `--lo-bg-deep` | `#0a0f14` | 页面最底层背景（比纯黑暖一度，减少压迫感） |
| `--lo-bg-card` | `#111820` | 卡片/面板背景（实色，非 rgba） |
| `--lo-bg-inset` | `#0d1219` | 图表区域背景、内嵌区域 |
| `--lo-bg-hover` | `rgba(255,255,255,0.03)` | 卡片 hover 态 |

### Surface Colors (Light Mode)

| Token | Value | 用途 |
|-------|-------|------|
| `--lo-bg-deep` | `#f3f5f7` | 页面底层 |
| `--lo-bg-card` | `#ffffff` | 卡片背景（实色白，确保可见层次） |
| `--lo-bg-inset` | `#edf0f3` | 内嵌区域 |
| `--lo-bg-hover` | `rgba(0,0,0,0.02)` | hover 态 |

**⚠ 重要修复：** 旧 DESIGN.md 中 light mode `--lo-card-bg: rgba(255,255,255,0.03)` 在浅色背景上不可见。**必须使用实色 `#ffffff`。**

### Text Colors (Dark)

| Token | Value | 用途 |
|-------|-------|------|
| `--lo-text-primary` | `#f0f4f8` | 主要文字 |
| `--lo-text-secondary` | `#7a8a9e` | 次要文字、标签 |
| `--lo-text-muted` | `#4a5568` | placeholder、disabled、meta |

### Text Colors (Light)

| Token | Value |
|-------|-------|
| `--lo-text-primary` | `#0f1718` |
| `--lo-text-secondary` | `rgba(100,110,120,0.78)` |
| `--lo-text-muted` | `rgba(120,130,140,0.50)` |

### Border

| Token | Dark | Light |
|-------|------|-------|
| `--lo-border` | `rgba(255,255,255,0.06)` | `rgba(0,0,0,0.08)` |
| `--lo-border-strong` | `rgba(255,255,255,0.10)` | `rgba(0,0,0,0.12)` |

---

## Spacing

- **Base unit:** 4px
- **Density:** Compact（数据密度优先，比旧 8px base 更紧凑）
- **规则：所有 padding/gap/margin 必须使用 `var(--lo-sp-*)` token，禁止 hardcode**

| Token | Value |
|-------|-------|
| `--lo-sp-1` | 4px |
| `--lo-sp-2` | 8px |
| `--lo-sp-3` | 12px |
| `--lo-sp-4` | 16px |
| `--lo-sp-6` | 24px |
| `--lo-sp-8` | 32px |
| `--lo-sp-12` | 48px |

---

## Layout

- **Approach:** Grid-disciplined（主布局严格网格）
- **Max content width:** 1200px（从旧 1344px 收窄，提升聚焦感）
- **Min viewport:** 1024px，不做响应式 reflow

### Dashboard 首页结构

```
┌────────────────────────────────────────────────────┐
│  TabBar（sticky top, 唯一导航入口）                   │
├────────────────────────────────────────────────────┤
│  HERO — 市场综合结论（非 BTC 价格重复展示）            │
│  4px top accent line（信号颜色）                    │
│  综合信号状态 + 信号对齐度 + 7日 sparkline           │
│  底部：linear-gradient → transparent               │
├────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐               │
│  │  L0 市场周期  │  │  L1 净流动性  │               │
│  └──────────────┘  └──────────────┘               │
│  ┌──────────────┐  ┌──────────────┐               │
│  │  L2 稳定币   │  │  L3 Meme板块  │               │
│  └──────────────┘  └──────────────┘               │
├────────────────────────────────────────────────────┤
│  L4 工作台入口（全宽，数字摘要，非文字描述）           │
└────────────────────────────────────────────────────┘
```

### 信息架构去重规则

| 规则 | 说明 |
|------|------|
| **Hero 不重复 L0 数据** | Hero 聚焦综合信号结论 + 信号对齐度；BTC 价格只在 L0 卡片中出现 |
| **导航不重复** | TabBar 是唯一的跨页导航；卡片整体可点击是 shortcut；去掉"查看详情 →"文字链 |
| **L4 不重复 L1-L3** | L4 工作台入口用数字摘要（"3 个 Alpha 槽位 · 2 个持仓"），不重复上层数据 |
| **Detail page 标题统一** | 格式：`{Layer} · {Name}`（如 `L0 · 市场周期`），无额外描述文字 |

### Border Radius

| Token | Value | 用途 |
|-------|-------|------|
| `--lo-radius-sm` | 6px | badge、pill 内部 |
| `--lo-radius-md` | 8px | 按钮、输入框、小卡片 |
| `--lo-radius-lg` | 12px | 面板、section 卡片 |
| `--lo-radius-xl` | 16px | 主要 section 容器 |

---

## Chart System — TradingView-Grade

**这是当前产品最核心的视觉统一问题。** 所有图表必须遵守以下规范。

### 图表类型选择

| 数据类型 | 推荐图表 | 库 |
|---------|---------|-----|
| BTC/资产价格（OHLC） | Candlestick / K 线图 | **lightweight-charts**（TradingView 开源） |
| 时间序列趋势（GNL、稳定币总量） | Area Chart（面积图） | **Recharts**，统一样式包装 |
| 多分量对比（Fed/TGA/RRP） | Horizontal Bar | Recharts 或纯 CSS |
| 多链对比（SOL/Base/BSC DEX） | Grouped Bar | Recharts |
| Hero 概览 | SparkLine（面积型） | Recharts，轻量 |

### 统一样式规范

```
┌─────────────────────────────────────────┐
│ Chart Title              [1D] [7D] [1M] │  ← 左：标题（--lo-text-label）
│                                         │     右：时间周期切换（pill group）
│                                         │
│         ╱╲                        68k   │  ← Y 轴标签：右侧，--lo-text-muted
│        ╱  ╲    ╱╲                       │     字体：JetBrains Mono
│  ╱╲  ╱    ╲  ╱  ╲                65k   │
│ ╱░░╲╱░░░░░░╲╱░░░░╲              62k   │  ← 面积 fill：brand rgba 0.15
│ ░░░░░░░░░░░░░░░░░░░                    │     主线：--lo-brand, 2px
│─────────────────────────────────────────│
│ ┌───────────────┐                       │  ← Tooltip：深色底 + 品牌色高亮
│ │ Mar 23  $67,240│                      │     JetBrains Mono 数字
│ └───────────────┘                       │
└─────────────────────────────────────────┘
```

| 属性 | 值 |
|------|-----|
| 背景 | `--lo-bg-inset` |
| 主线颜色 | `--lo-brand` (#0EA5E9) |
| 主线宽度 | 2px |
| Area fill | `rgba(--lo-brand, 0.15)` → 底部透明 |
| Y 轴 | 右侧，`--lo-text-muted`，JetBrains Mono |
| X 轴 | 底部，`--lo-text-muted`，auto-skip |
| 网格线 | 仅水平，`rgba(255,255,255,0.04)`，无垂直 |
| Tooltip | 深色底 `#1a2332`，白色文字，品牌色数值高亮 |
| Crosshair | 垂直虚线，`rgba(255,255,255,0.2)` |
| 动画 | 无入场动画（isAnimationActive={false}） |
| 时间切换 | Pill group：1D / 7D / 1M / 3M / 1Y |

### K 线图专项（lightweight-charts）

| 属性 | 值 |
|------|-----|
| Bullish candle | `#22c55e`（filled） |
| Bearish candle | `#ef4444`（filled） |
| Volume bars | 40% opacity，同色系 |
| Background | `--lo-bg-inset` |
| Grid | `rgba(255,255,255,0.04)` |
| Crosshair | 十字线 + tooltip |

### ⚠ Detail Page 图表迁移规则

**当前问题：** L1DetailPage 等使用独立的旧色值系统（`#F2F2F7`, `#fff`, `#007AFF`）。
**必须迁移：** 所有 detail page 图表必须使用本节定义的统一样式。禁止在图表组件中使用 hardcoded hex 色值。

---

## Component Specs

### TabBar

顶部导航栏，sticky 固定，全宽。**唯一的跨页导航入口。**

| 属性 | 规范 |
|------|------|
| 标签 | Dashboard / L0 宏观 / L1 流动性 / L2 稳定币 / L3 Meme / L4 工作台 |
| 字体 | `--lo-font-body`（DM Sans） |
| Active | 顶部 2px accent line（`--lo-brand`）+ weight-label + text-primary |
| Hover | `color: --lo-text-primary`，**transition: color 0.15s ease** |
| Default | text-secondary + weight-regular |
| ⚠ 禁止 | 底部下划线（underline） |

### Hero（首页融合区）

| 属性 | 规范 |
|------|------|
| 顶线 | 4px solid，由信号状态驱动 |
| 背景 | `--lo-bg-deep`，无 glow |
| 底部 | `linear-gradient(to bottom, --lo-bg-deep, transparent)` |
| **内容** | **综合信号状态 + 信号对齐度（如"4/5 信号对齐"）+ F&G + 7日 sparkline** |
| ⚠ 禁止 | BTC 价格大数字（已移至 L0 卡片，避免重复） |
| ⚠ 禁止 | 信号色背景 glow |

### SummaryCard（摘要卡片）

首页 2×2 网格，每层一张。

```
┌─────────────────────────────────────┐
│ L0 市场周期                  ● 看涨  │  ← kicker + SignalBadge（pill 样式）
│                                     │
│   67,240                            │  ← --lo-metric-hero，JetBrains Mono
│   BTC  +2.4%                        │  ← 副标签
│                                     │
│  F&G 42    Dominance 52%            │  ← 次级指标行
│  ────────────────────────────────   │
│  [视觉元素区：sparkline / 分量条]     │
│                                     │
└─────────────────────────────────────┘  ← 整卡可点击，无"查看详情"文字链
```

| 属性 | 规范 |
|------|------|
| 背景 | `--lo-bg-card`（实色） |
| 边框 | `1px solid --lo-border` |
| 圆角 | `--lo-radius-lg` (12px) |
| Hover | `background: --lo-bg-hover`，cursor pointer |
| 交互 | 整卡可点击 → 导航对应路由 |
| ⚠ 去除 | "查看详情 →" 文字链（与 TabBar + 卡片点击重复） |

### SignalBadge

| 属性 | 规范 |
|------|------|
| 结构 | Pill 容器 + 圆点（8-10px）+ 文字标签 |
| 背景 | `--lo-signal-{type}-soft` |
| 文字色 | `--lo-signal-{type}` |
| 圆角 | `--lo-radius-sm` |
| ⚠ 规则 | **必须包含文字标签**，不得仅靠颜色传达信号（WCAG color-not-only） |

### L4 工作台入口

| 属性 | 规范 |
|------|------|
| 布局 | 全宽，信号色 top border |
| 标题 | `--lo-text-title`，Satoshi，weight-bold |
| 内容 | **数字摘要**：如 "3 个 Alpha 槽位 · 2 个持仓 · 4/5 信号对齐" |
| ⚠ 禁止 | 工作流文字描述（"Meme Radar → Alpha Scanner → Watch Station"） |

---

## Interaction States

每个交互区域必须定义 5 种状态：

| 状态 | 规范 |
|------|------|
| loading | **Skeleton 脉冲动画**（模拟最终布局结构），非简单灰色条 |
| empty | 暖色调引导文案 + 主要操作入口 |
| error | `⚠` + 错误描述 + 重试按钮 + 上次成功时间戳 |
| success | 数据正常展示 |
| hover | `--lo-bg-hover` 背景过渡，**transition: 0.15s ease** |

---

## Information Hierarchy Rules

Section 内部视觉权重三级：

1. **一级：核心数字/信号值** — `--lo-metric-hero` 或 `--lo-text-value`，weight 700，JetBrains Mono
2. **二级：标签/操作** — `--lo-text-label`，weight 600，DM Sans
3. **三级：说明/注释** — `--lo-text-meta`，color `--lo-text-muted`

---

## Motion

- **Approach:** Minimal-Functional — 仅用于状态过渡，不做纯装饰
- **原则：** 这是每天使用的工具，任何入场动画/scroll-driven 动画都会成为干扰

| 属性 | 值 |
|------|-----|
| Hover/Active 过渡 | `transition: all 0.15s ease` |
| Loading skeleton | `@keyframes pulse` 1.5s infinite |
| 图表 | `isAnimationActive={false}` |
| 入场动画 | **无** |
| Scroll-driven | **无** |

---

## Code Quality Rules

### ⚠ 禁止 Inline Style 扩散

当前代码全部使用 `style={{}}` inline styles。新组件和重构组件**必须**使用 CSS class：

| 组件 | className |
|------|-----------|
| SummaryCard | `.lo-card` |
| Hero | `.lo-hero` |
| MetricBlock | `.lo-metric` |
| SignalBadge | `.lo-signal-badge` |
| TabBar | `.lo-tabbar` |
| Chart 容器 | `.lo-chart` |

### ⚠ 禁止 Detail Page 独立设计系统

**当前问题：** L1DetailPage 等使用 `#F2F2F7`, `#fff`, `#007AFF` 等硬编码色值。
**规则：** 所有页面必须使用 `--lo-*` CSS custom properties。禁止在组件中出现 hardcoded hex 色值（`const C = { bg: "#F2F2F7" }` 这种模式必须清除）。

### 数字格式化统一

`fmtPct()`, `fmtB()`, `fmt()` 等函数必须抽取到 `src/lib/format.js`，禁止各页面重复定义。

---

## Implementation Priority

| Phase | 内容 | 解决的核心问题 |
|-------|------|---------------|
| **P1** | 统一设计基础：修复 light mode tokens、迁移 detail page 到 --lo-* 系统、抽取 CSS classes | 图表不统一的根因（两套设计系统）|
| **P2** | 信息架构去重：Hero 重构、去掉冗余导航、L4 改数字摘要 | 信息结构冗余 |
| **P3** | 图表系统统一：建立 LOChart 组件、引入 lightweight-charts、统一样式 | 图表风格不统一 |
| **P4** | 组件质量提升：SignalBadge pill 化、TabBar hover、Skeleton 加载态 | 视觉层级不足、专业感不够 |

---

## Decisions Log

| 日期 | 决策 | 来源 |
|------|------|------|
| 2026-03-23 | 推倒重来：全新设计系统，替代旧 DESIGN.md | /design-consultation |
| 2026-03-23 | Aesthetic: Narrative-Industrial（决策漏斗，非查询工具） | /design-consultation 竞品调研 |
| 2026-03-23 | Display font: Satoshi（替代 Inter，提升辨识度） | /design-consultation Phase 3 |
| 2026-03-23 | Body font: DM Sans（替代 Inter，小字号可读性更优） | /design-consultation Phase 3 |
| 2026-03-23 | Brand color: #0EA5E9 sky-blue（替代 teal，与信号色零冲突） | /design-consultation Phase 3 |
| 2026-03-23 | Spacing base: 4px（从 8px 收紧，适合数据密集） | /design-consultation Phase 3 |
| 2026-03-23 | Max content: 1200px（从 1344px 收窄，提升聚焦感） | /design-consultation Phase 3 |
| 2026-03-23 | Chart system: lightweight-charts + Recharts 统一样式 | /design-consultation + /ui-ux-pro-max chart domain |
| 2026-03-23 | Motion: Minimal-Functional，无入场动画 | /design-consultation Phase 3 |
| 2026-03-23 | Hero 去重：不再重复 BTC 价格，聚焦综合信号 | /ui-ux-pro-max review H1 |
| 2026-03-23 | 导航去重：去掉"查看详情 →"文字链 | /ui-ux-pro-max review H2 |
| 2026-03-23 | Detail page 必须迁移到 --lo-* token 系统 | /ui-ux-pro-max review C1 |
| 2026-03-23 | Light mode card-bg 修复为实色 #ffffff | /ui-ux-pro-max review C2 |
| 2026-03-23 | SignalBadge 必须包含文字标签（WCAG color-not-only） | /ui-ux-pro-max review C3 |
| 2026-03-23 | L4 入口改为数字摘要，非工作流文字描述 | /ui-ux-pro-max review H6 |

---

## Implementation Progress（2026-03-24 更新）

> 本节记录 DESIGN.md 各 Phase 的实际实施进度。
> 每个 PKG 的完整任务单和执行结果存放在 `~/.gstack/projects/Playground/` 目录下。
> 工作流遵循 `AI/02-control-layer:/01-pm-controller.md`（PM Controller）和 `AI/02-control-layer:/02-codex-handoff-protocol.md`（Codex Handoff Protocol）。

### P1 — 统一设计基础 ✅ Complete

P1 共 9 个 Step（在本轮之前的会话中完成），加 3 个 Hotfix：

| Step | 内容 | 状态 |
|------|------|------|
| Steps 1-9 | CSS token 修正、字体加载、styles.css 硬编码修复、L1/L2/L3 迁移到 `--lo-*`、FGDetailPage 迁移、格式化函数统一、共享 CSS class 定义 | ✅ Done |
| PKG-P1-HOTFIX-001 | L3DetailPage `fmtBillions` import 缺失导致白屏 | ✅ Done |
| PKG-P1-HOTFIX-002A | Theme toggle 从 App.jsx 提取到 AppStateProvider（修复 detail page dark mode 不响应） | ✅ Done |
| PKG-P1-HOTFIX-002B | TradingView widget 动态读取 `data-theme`（修复嵌入图表始终 light mode） | ✅ Done |

### P2 — 信息架构去重 ✅ Complete

| 包 | 内容 | 文件 | 状态 |
|----|------|------|------|
| PKG-P2-A | Hero 重构（信号状态+对齐度+sparkline）、SummaryCard 去掉"查看详情→"、L4 入口改数字摘要 | `src/pages/Dashboard.jsx` | ✅ Done |
| PKG-P2-B | max-width 统一 1200px（`.lo-shell`、`.lo-topbar-inner`、Dashboard grid） | `src/pages/Dashboard.jsx`, `src/styles.css` | ✅ Done |

**P2 设计决策：**
- Hero 信号对齐度逻辑：5 signals（L0 vs_ma_200_pct>=0, L1 gnl.change_7d>=0, L2 change_7d>=0, L3 mcap_change_24h>=0, FG value>=50）
- hero_score 做主判断，对齐度只辅助展示（非决策依据）
- L4 入口仅显示对齐度，不显示 slot/持仓计数

### P3 — 图表系统统一 ✅ Complete（P3-C deferred）

| 包 | 内容 | 文件 | 状态 |
|----|------|------|------|
| PKG-P3-A | 新建 `LOChart` 统一包装组件（exports: LOChart, LOTooltip, LO_CHART_DEFAULTS） | `src/components/shared/LOChart.jsx` | ✅ Done |
| PKG-P3-B | 迁移 5 个 Recharts 图表到 LOChart（L1 GNL + Fed/TGA/RRP, L2 稳定币总量 + 三链折线, L3 DEX volume） | `src/L1DetailPage.jsx`, `src/L2DetailPage.jsx`, `src/L3DetailPage.jsx` | ✅ Done |
| PKG-P3-C | TradingView widget 提取共享组件 | — | 🔲 **Deferred → 重编号为 PKG-P5-B** |

**P3 设计决策：**
- LOChart：右侧 Y 轴、水平 grid（rgba(255,255,255,0.04)）、深色 tooltip（#1a2332）、JetBrains Mono 轴标签
- 各页面保留本地 `CustomTooltip`（因 LOTooltip 不支持 formatters 参数），通过 `tooltipContent` prop 传入
- lightweight-charts **DEFERRED**（缺 OHLC 数据源）
- SparkLine 不迁移（已是独立轻量组件）

### P4 — 组件质量提升 + CSS Class 迁移 ✅ Complete

| 包 | 内容 | 文件 | 状态 |
|----|------|------|------|
| PKG-P4-A | SignalBadge pill 化（inline → `.lo-signal-badge` CSS class，添加 soft background） | `src/components/shared/SignalBadge.jsx` | ✅ Done |
| PKG-P4-B | TabBar hover transition + inline → CSS class（`.lo-tabbar__item`，`transition: color 0.15s ease`） | `src/components/TabBar.jsx`, `src/styles.css` | ✅ Done |
| PKG-P4-C | Dashboard SummaryCard skeleton loading（`@keyframes lo-skeleton-pulse`，4 层结构化 skeleton） | `src/pages/Dashboard.jsx`, `src/styles.css` | ✅ Done |
| PKG-P4-D | SummaryCard inline → CSS class（`.lo-card`，移除 JS hover state → CSS `:hover`） | `src/pages/Dashboard.jsx`, `src/styles.css` | ✅ Done |
| PKG-P4-E | Dashboard 页面壳/Hero/Grid/L4 入口 inline → CSS class（`.lo-page`, `.lo-hero`, `.lo-summary-grid`, `.lo-l4-entry`） | `src/pages/Dashboard.jsx`, `src/styles.css` | ✅ Done |
| PKG-P4-F | Dashboard Bars 三组件 inline → `.lo-bar-list` 共享 CSS class | `src/pages/Dashboard.jsx`, `src/styles.css` | ✅ Done |
| PKG-P4-G | L1/L2/L3 消除 `const C` + `pageBodyStyle`/`cardStyle`/`numFontStyle` 样式对象（84 处 C.xxx 替换） | `src/L1DetailPage.jsx`, `src/L2DetailPage.jsx`, `src/L3DetailPage.jsx`, `src/styles.css` | ✅ Done |
| PKG-P4-H | L1/L2/L3 六个重复内部组件 inline → CSS class（DataStateCard→`.lo-dsc__*`, PeriodButtons→`.lo-period-btn`, ChartStateBlock→`.lo-chart-state`, CustomTooltip→`.lo-chart-tooltip`, SkeletonLine→`.lo-skeleton-line`, ChartSkeleton→`.lo-skeleton-chart`） | `src/L1DetailPage.jsx`, `src/L2DetailPage.jsx`, `src/L3DetailPage.jsx`, `src/styles.css` | ✅ Done |
| PKG-P4-I | L1/L2/L3 content section 剩余 inline → CSS class（`.lo-d-grid`, `.lo-inset-panel`, `.lo-metric--xl/lg/md/sm/xs`, `.lo-text-footnote`, `.lo-radar-table`, `.lo-stat-pill` 等） | `src/L1DetailPage.jsx`, `src/L2DetailPage.jsx`, `src/L3DetailPage.jsx`, `src/styles.css` | ✅ Done |
| PKG-P4-J | FGDetailPage 全面 inline 清理（消除 const C + 6 个样式对象 + content section + 旧 token alias 规范化） | `src/FGDetailPage.jsx`, `src/styles.css` | ✅ Done |

**P4 inline style 最终计数：**

| 文件 | 初始 | 最终 | 剩余性质 |
|------|------|------|----------|
| `Dashboard.jsx` | ~60+ | 17 | skeleton 动态尺寸、信号色 borderTop、百分比宽度 |
| `L1DetailPage.jsx` | 45 | 15 | Recharts SVG 属性、TradingView 容器、动态 gap/color |
| `L2DetailPage.jsx` | 41 | 14 | 同 L1 |
| `L3DetailPage.jsx` | 73 | 29 | 同 L1 + radar 表格动态边框色 |
| `FGDetailPage.jsx` | 57 | 32 | Gauge SVG 旋转/animation、SignalDot 动态 size/glow、动态信号色 |
| `BTCDetailPage.jsx` | 2 | 2 | TradingView 容器（不在清理范围） |
| `SignalBadge.jsx` | 全 inline | 0 | 全部 CSS class |
| `TabBar.jsx` | 全 inline | 0 | 全部 CSS class |

### 未完成 / 下一步

| 包 | 内容 | 优先级 | 状态 |
|----|------|--------|------|
| **PKG-P5-A** | 6 个重复内部组件抽取到 `src/components/shared/`（SkeletonLine, ChartSkeleton, DataStateCard, PeriodButtons, ChartStateBlock, CustomTooltip），消除 L1/L2/L3/FG 四文件代码重复 | 高 | 🔲 待执行 |
| **PKG-P5-B** | TradingView widget 提取共享组件到 `src/components/shared/TradingViewWidget.jsx`（当前 L1 + BTC 各有一份副本） | 中 | 🔲 待执行 |
| BTCDetailPage inline 清理 | 仅 2 处 inline（TradingView 容器），优先级极低 | 低 | 🔲 |
| LOTooltip 支持 formatters | 统一 tooltip 格式化，消除各页面本地 CustomTooltip | 低 | 🔲 |
| lightweight-charts 引入 | K 线图，DEFERRED（缺 OHLC 数据源） | Blocked | 🔲 |
| 浏览器 QA | P2-P4 全部改动的运行时视觉验证 | 高 | 🔲 |

### CSS Class 体系总览（styles.css 中已定义的共享 class）

```
Core:        .lo-page, .lo-card, .lo-card:hover, .lo-card__*
TabBar:      .lo-tabbar, .lo-tabbar__item, .lo-tabbar__item--active, .lo-tabbar__accent, .lo-tabbar__theme-toggle
Signal:      .lo-signal-badge, .lo-signal-badge--bull/neutral/bear, .lo-signal-badge__dot
Hero:        .lo-hero, .lo-hero__*, .lo-hero__fade
Summary:     .lo-summary-grid
L4:          .lo-l4-wrapper, .lo-l4-entry, .lo-l4-entry__*
Bars:        .lo-bar-list, .lo-bar-list__*
Skeleton:    .lo-skeleton, .lo-skeleton-line, .lo-skeleton-chart, @keyframes lo-skeleton-pulse
Detail:      .lo-detail-page, .lo-detail-content, .lo-detail-card
DSC:         .lo-dsc__header/title/subtitle/grid/error-text/retry
Period:      .lo-period-group, .lo-period-btn, .lo-period-btn--active
Chart:       .lo-chart-state, .lo-chart-state__*, .lo-chart-tooltip, .lo-chart-tooltip__*
Layout:      .lo-d-grid, .lo-d-grid--3col, .lo-d-flex-between, .lo-d-flex-end
Panel:       .lo-inset-panel, .lo-inset-panel__*
Text:        .lo-text-footnote, .lo-text-meta-muted, .lo-text-label-primary
Metric:      .lo-metric, .lo-metric--hero/xl/lg/md/sm/xs/secondary
Table:       .lo-radar-table, .lo-radar-table__*
FG:          .lo-fg-label, .lo-fg-compare, .lo-fg-gauge-layout, .lo-fg-gauge-center, .lo-link-btn
Misc:        .lo-stat-pill, .lo-stat-card, .lo-note-panel, .lo-turnover-panel, .lo-toggle-btn, .lo-manual-card__header
```

### 重复组件现状（PKG-P5-A 的输入）

以下 6 个组件在 L1/L2/L3/FG 中各有一份副本（FG 的 DataStateCard 少一个 `action` prop，SkeletonLine background 略有不同）：

| 组件 | L1 | L2 | L3 | FG | 差异 |
|------|----|----|----|----|------|
| SkeletonLine | ✅ | ✅ | ✅ | ✅ | FG 曾用不同 background，P4-J 已统一 |
| ChartSkeleton | ✅ | ✅ | ✅ | ❌ | FG 无 |
| DataStateCard | ✅ | ✅ | ✅ | ✅ | FG 少 `action` prop |
| PeriodButtons | ✅ | ✅ | ✅ | ❌ | FG 无 |
| ChartStateBlock | ✅ | ✅ | ✅ | ❌ | FG 无 |
| CustomTooltip | ✅ | ✅ | ✅ | ❌ | FG 无 |

### TradingView Widget 现状（PKG-P5-B 的输入）

`TradingViewWidget` 函数在两个文件中各有一份副本：
- `src/L1DetailPage.jsx:325` — 用于 DXY 周线图
- `src/BTCDetailPage.jsx:37` — 用于 BTC/TOTAL/BTC.D/TOTAL3 多图

两个副本功能一致：动态创建 TradingView embed script，读取 `data-theme` 切换深浅色。
