这是一个根据 2026 年 3 月 5 日最新代码逻辑、Worker 架构以及 v3.0 PRD 文档汇总生成的全新 **`README.md`** 文件。它整合了项目结构、开发进度以及您关注的学习资源。

---

# LiquidityOS 流动性仪表盘 (v3.0)

**LiquidityOS** 是一个专为 Solana Meme 币交易者设计的个人决策看板。它基于“四层流动性框架”理论，旨在将碎片化的宏观数据与微观资产筛选整合进一个标准化的工作流中，最终服务于**推特涨粉 (@partrick2022)** 与**个人交易能力成长**。

---

## 核心框架：五层过滤体系 (L0-L4)

本工具的核心逻辑是**从宏观到微观逐层过滤**，上层信号是下层操作的前提条件。

* **L0 周期定位**：确定全球流动性大周期与 BTC 周期位置，决定仓位上限与操作偏见。
* **L1 全球净流动性**：确认 GNL (Fed - TGA - RRP) 的扩张动量，捕捉领先 BTC 的信号。
* **L2 稳定币弹药**：确认场内总弹药量及热钱聚焦的战场（Solana/Base/BSC）。
* **L3 Meme 板块热度**：基于全链 Meme 市值与各链 DEX 交易量的加权评分，判定板块季节。
* **L4 存量与增量结构**：通过“存量观测”与“增量筛选”进行微观选品，做出最终决策。

---

## 项目结构

```text
liquidity-os/
├── README.md                 ← 项目主说明文档
├── dashboard/
│   └── trading-dashboard.jsx  ← 看板主体代码 (React v2.5+)
├── worker/
│   └── worker.js             ← Cloudflare Worker 数据代理代码 (v4)
└── docs/
    ├── requirements-v3.0.md  ← 最新产品需求文档 (PRD)
    └── requirements-v2.0.md  ← 旧版 PRD (存档参考)

```

---

## 核心功能特性 (v3.0 升级)

### 1. 自动数据驱动

* **一键刷新**：通过内置的 Claude API + Web Search 能力，自动拉取 BTC 价格、L2 稳定币、L3 DEX 交易量及恐惧贪婪指数。
* **数据代理 (Cloudflare Worker)**：已部署独立代理层，支持从 Binance、DeFiLlama、CoinGecko 等多源实时清洗数据。

### 2. 智能化信号引擎

* **Hero 综合信号卡片**：综合 L2、L3、情绪与 L4 四层信号灯，自动判定市场状态（进攻/积极/观望/防御）。
* **L3/L4 加权评分**：引入主/辅助信号加权算法，科学评估板块热度与个股动能。

### 3. 微观资产筛选器 (L4)

* **存量观测站 (Watchlist)**：追踪 Top 50 Meme 资产，自动计算 **V/MC (成交量/市值比)** 以识别资金聚集地。
* **新币筛选器 (Alpha Scanner)**：从筹码集中度、资金动量（喷发/承接/衰减）及池子强度三个维度快速过滤新币。

---

## 开发进度

* ✅ **V1**：基础研判看板、AI 热榜抓取、四维评分、推文草稿生成。
* ✅ **V2**：宏观信号仪表盘、信号灯引擎、window.storage 持久化。
* ✅ **V3 (当前)**：重构 L4 逻辑（存量/增量双表）、部署 Cloudflare Worker 数据代理、实现一键刷新宏观快照。
* 🔲 **未来计划**：接入 FRED API Key 实现 L1 全自动、开发历史回顾功能、优化移动端体验。

---

## 学习资源

* **宏观框架**：Michael Howell《Capital Wars》、Raoul Pal「Everything Code」框架、Arthur Hayes Substack。
* **数据工具**：DefiLlama (稳定币/TVL)、CoinGecko (市值)、CryptoQuant (MVRV Z-Score)、FRED (美联储数据)。
* **链上分析**：DEX Screener (新币发现)、GMGN (聪明钱分析)。

---

## 技术栈

* **前端**：React JSX (运行于 Claude.ai Artifacts)。
* **后端代理**：Cloudflare Workers (JavaScript)。
* **数据交互**：Anthropic API + Web Search。
* **存储**：window.storage 本地持久化。

---

**声明**：本工具仅供个人学习及推特内容创作使用，不构成任何投资建议。每日研判输出：[@partrick2022](https://twitter.com/partrick2022)。
