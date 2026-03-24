# CLAUDE.md — LiquidityOS 项目完整接管文档

> 最后更新：2026-03-24
> 本文件是任何 Claude 接管本项目的**唯一入口**。读完本文件即可无缝继续开发。

---

## 〇、项目概览

**LiquidityOS** 是个人加密交易决策系统（不是数据面板）。
核心：5 层流动性分析漏斗（L0-L4），通过 Hero Signal Engine + Verdict Engine 输出交易姿态（进攻/积极/观望/防御）。
用户：solo crypto trader，桌面端 1024px+，每日使用。

**GitHub:** `https://github.com/fanfan09132022-arch/liquidity-os`
**分支：** 仅 `main`

---

## 一、部署架构与 URL

```
浏览器
  ↓
Cloudflare Pages (SPA, React 18 + Vite)
  ↓
Cloudflare Worker — 数据聚合 + API 代理 + 缓存
  ├── FRED, CoinGecko, CMC, DeFiLlama, DexScreener, Birdeye, BlockBeats
  └── Vercel Serverless (GMGN IPv4 代理) → GMGN API
```

| 服务 | URL | 配置文件 |
|------|-----|---------|
| Frontend (CF Pages) | `liquidityos-data.fanfan09132022.workers.dev` (SPA 托管在同一 Worker) | `wrangler.jsonc` (根目录) |
| Data Worker | `https://liquidityos-data.fanfan09132022.workers.dev` | `dashboard/worker/wrangler.jsonc` |
| GMGN Proxy | `https://gmgn-proxy-three.vercel.app` | `dashboard/gmgn-proxy/vercel.json` |
| 前端 Worker URL 配置 | — | `src/config.js` → `export const WORKER = "https://liquidityos-data.fanfan09132022.workers.dev"` |

### Cloudflare Worker Secrets（已部署）

| Secret 名 | 用途 |
|-----------|------|
| `FRED_API_KEY` | 美联储 FRED 数据（WALCL, TGA, RRP） |
| `CMC_API_KEY` | CoinMarketCap meme 数据 |
| `BIRDEYE_API_KEY` | Birdeye Solana token 价格 |
| `BLOCKBEATS_API_KEY` | BlockBeats 新闻 |
| `GeckoTerminal_API_KEY` | GeckoTerminal |
| `GMGN_API_KEY` | GMGN（旧直连用，现已改走 proxy） |
| `GMGN_PROXY_KEY` | Vercel GMGN proxy 共享密钥：`9e260791ac3c2ee5d3905791229c334a` |

### Vercel GMGN Proxy Env Vars（已部署）

| Env Var | 用途 |
|---------|------|
| `GMGN_API_KEY` | GMGN OpenAPI key：`gmgn_9e6d956e5b51ead3914b51722288a203` |
| `PROXY_KEY` | 共享密钥（必须与 Worker 的 `GMGN_PROXY_KEY` 一致） |

---

## 二、关键运维知识（踩坑记录）

### GMGN IPv6 问题（已解决）

**问题：** Cloudflare Workers 出站 fetch 默认走 IPv6，GMGN API 明确拒绝 IPv6（返回 `"OpenAPI does not support IPv6"`）。
**解决：** 在 Vercel 上部署了一个极简 Serverless Function 作为 IPv4 代理。
**架构：** CF Worker → Vercel Proxy (AWS Lambda, IPv4) → GMGN API
**代码：** `dashboard/gmgn-proxy/api/gmgn.js`
**Worker 调用方式：** `fetchGmgnJson()` 发请求到 `GMGN_PROXY` URL，带 `x-proxy-key` header 认证。
**注意：** 不能在 Worker 里直接调 `openapi.gmgn.ai`，永远会返回 403。

### GMGN 时间戳格式（已修复）

**问题：** GMGN 要求 `timestamp` 参数为 **Unix 秒**（`Math.floor(Date.now() / 1000)`），不是毫秒（`Date.now()`）。毫秒会导致 `AUTH_TIMESTAMP_EXPIRED`。
**修复位置：** `dashboard/gmgn-proxy/api/gmgn.js` line 47

### GMGN Anti-Replay（已修复）

**问题：** GMGN 对同一 `client_id + timestamp` 组合有反重放检测，快速连续请求会返回 `AUTH_CLIENT_ID_REPLAYED`。
**解决：** `client_id` 加了随机后缀：`` `liquidityos_${Math.random().toString(36).slice(2, 8)}` ``
**修复位置：** `dashboard/gmgn-proxy/api/gmgn.js` line 48

### CMC Meme Category ID（已修复）

**问题：** CMC `/v1/cryptocurrency/categories` 返回 342 个分类，模糊匹配 `/meme/i` 会命中 "TRON Memes"（$8M mcap）而不是主 "Memes" 分类（$30B mcap）。
**解决：** 精确匹配 `name === "memes"`，fallback 到 num_tokens > 1000 的分类。
**CMC Meme Category ID：** `6051a82566fc1b42617d6dc6`（硬编码在 `worker.js` 的 `CMC_MEME_CATEGORY_ID` 常量中）。
**CMC markets 端点：** 用 `/v1/cryptocurrency/category`（单数，按 category ID 获取），不是 `/v1/cryptocurrency/listings/latest`（免费 tier 不支持 `tag` 参数会返回 400）。

### Binance Web3 API（不可用，勿修复）

**结论：** Binance Web3 Skills API 所有端点都返回 451 geo-restriction。测试过 5 个备用域名（`dapi.binance.com`, `www.binance.com`, `api.binance.com`, `data-api.binance.vision`, `testnet.binance.vision`）全部失败。`data-api.binance.vision` 能通但没有 Web3 端点。
**Worker 中有 3 个死路由待清理：** `/api/binance/token-info`, `/api/binance/market-rank`, `/api/binance/token-audit`
**前端 `fetchTokenSecurity`** (`src/lib/api.js`) 有 Binance fallback 也待清理。

### CoinGecko 限速

CoinGecko 免费 API 30 req/min，在 `/api/all` 聚合时频繁触发 429。已切换到 CMC 作为 meme 数据主源，CoinGecko 降为 fallback。

---

## 三、项目文件地图

```
/Users/partrick/Desktop/Playground/
├── README.md                          # 项目概述（英文）
├── PRD.md                             # 产品需求文档 v7.0
├── DESIGN.md                          # 设计系统规格
├── .impeccable.md                     # Impeccable 设计工具配置
├── index.html                         # SPA 入口
├── package.json                       # React 18, react-router-dom, recharts, vite
├── vite.config.js                     # Vite 配置
├── wrangler.jsonc                     # CF Pages SPA 部署配置（name: liquidity-os-mvp）
│
├── src/
│   ├── App.jsx                        # ⚠️ 核心文件 ~4100 行
│   │                                  #   - Hero Signal Engine (calcHeroSignal, signalToScore, getHeroInfo)
│   │                                  #   - Verdict Engine (buildVerdictText)
│   │                                  #   - 所有 Detail Pages (BTC, FG, L1, L2, L3)
│   │                                  #   - L4 Workbench (Watch Station, Alpha Scanner, Meme Radar)
│   │                                  #   - Signal 计算 (calcL0-L4, calcFG)
│   ├── config.js                      # Worker URL 配置
│   ├── main.jsx                       # React Router 路由定义
│   ├── styles.css                     # ⚠️ ~2200 行，全局样式 + --lo-* design tokens
│   │
│   ├── pages/                         # 路由页面
│   │   ├── Dashboard.jsx              # HERO verdict + 5 SignalRow + L4 CTA
│   │   ├── L0MacroPage.jsx            # BTC + 200MA + MVRV
│   │   ├── L1LiquidityPage.jsx        # GNL (FED - TGA - RRP)
│   │   ├── L2StablecoinsPage.jsx      # Stablecoin supply + chain distribution
│   │   ├── L3MemeSectorPage.jsx       # Meme mcap + DEX volume
│   │   └── L4WorkbenchPage.jsx        # 包装 App.jsx 的 L4 区域
│   │
│   ├── BTCDetailPage.jsx              # BTC 详情（TradingView + 指标）
│   ├── FGDetailPage.jsx               # Fear & Greed 详情
│   ├── L1DetailPage.jsx               # FRED 组件图表
│   ├── L2DetailPage.jsx               # Stablecoin 链级分析
│   ├── L3DetailPage.jsx               # Meme top tokens
│   │
│   ├── components/
│   │   ├── NewsStrip.jsx              # 新闻条组件
│   │   ├── TabBar.jsx                 # 导航 Tab 栏
│   │   └── shared/                    # 11 个共享组件
│   │       ├── SignalBadge.jsx        # 信号颜色点
│   │       ├── LOChart.jsx            # 图表封装
│   │       ├── MetricBlock.jsx        # 指标展示块
│   │       ├── SparkLine.jsx          # 迷你折线图
│   │       ├── TradingViewWidget.jsx  # TradingView 嵌入
│   │       └── ... (6 more)
│   │
│   ├── context/
│   │   └── AppStateProvider.jsx       # Watchlist + Alpha cards 共享状态
│   │
│   └── lib/
│       ├── api.js                     # ⚠️ Worker 通信 + fetchTokenSecurity
│       ├── storage.js                 # ⚠️ localStorage 持久化
│       ├── useWorkerData.js           # Worker 数据 hook
│       └── utils.js                   # 格式化函数 (fmtPct, fmtB, toNumber...)
│
├── dashboard/
│   ├── worker/
│   │   ├── worker.js                  # ⚠️ CF Worker ~1500 行，所有 API 代理 + /api/all 聚合
│   │   └── wrangler.jsonc             # Worker 部署配置（name: liquidityos-data）
│   │
│   └── gmgn-proxy/
│       ├── api/gmgn.js               # Vercel Serverless — GMGN IPv4 代理
│       ├── package.json
│       └── vercel.json
│
└── AI/                                # PM 工作流文档
    ├── CLAUDE.md                      # ← 你正在读的这个文件
    ├── AGENTS.md                      # Agent 定义
    ├── 01-project-knowledge:/         # 项目知识库
    │   ├── 01-project.md
    │   ├── 02-architecture.md
    │   ├── 03-rules.md
    │   ├── 04-ai_context.md
    │   └── 05-stage_summaries.md
    ├── 02-control-layer:/             # 控制层
    │   ├── 01-pm-controller.md        # PM Controller 角色定义
    │   └── 02-codex-handoff-protocol.md  # Codex 交接协议
    └── 03-skills/
        ├── custom:/
        │   └── 01-执行结果汇报官.md    # Codex 结果格式化
        └── gstack/                    # gstack 技能框架（27 个 skill）
```

---

## 四、Worker API 路由全览

Data Worker 共 18 个路由（`dashboard/worker/worker.js`）：

| 路由 | 数据源 | 缓存 TTL | 状态 |
|------|--------|---------|------|
| `/api/all` | 聚合所有数据 | 3600s | ✅ |
| `/api/fg` | Alternative.me | 3600s | ✅ |
| `/api/funding` | Binance | — | ✅ |
| `/api/oi` | Binance | — | ✅ |
| `/api/cg/markets` | CoinGecko | 1800s | ✅ |
| `/api/cg/chart/:id` | CoinGecko | 3600s | ✅ |
| `/api/meme-summary` | CMC → CG fallback | 900s | ✅ |
| `/api/cmc/meme-markets` | CoinMarketCap | 1800s | ✅ |
| `/api/meme-radar` | DexScreener | 300s | ✅ |
| `/api/newsflash` | BlockBeats | 600s | ✅ |
| `/api/alpha-support` | Birdeye + DexScreener | — | ✅ |
| `/api/gmgn/rank` | GMGN (via Vercel proxy) | 300s | ✅ |
| `/api/gmgn/token-info` | GMGN (via Vercel proxy) | — | ✅ |
| `/api/gmgn/token-security` | GMGN (via Vercel proxy) | 1800s | ✅ |
| `/api/binance/token-info` | Binance Web3 | 300s | ❌ 451 geo-block |
| `/api/binance/market-rank` | Binance Web3 | 300s | ❌ 451 geo-block |
| `/api/binance/token-audit` | Binance Web3 | 1800s | ❌ 451 geo-block |
| `/api/llama/stablecoins` | DeFiLlama | 1800s | ✅ |
| `/api/llama/stable-chart` | DeFiLlama | 1800s | ✅ |
| `/api/fred/*` | FRED (St. Louis Fed) | 86400s | ✅ |
| `/api/llama/dex/:chain` | DeFiLlama | 1800s | ✅ |

---

## 五、信号引擎核心逻辑

### Hero Signal 计算

```
calcHeroSignal(signals=[l2Signal, l3Signal, fgSignal, l4Signal], context)
  → 平均 score (0-1)
  → 映射到 4 级姿态
```

| Score | 姿态 | Label | 行动 |
|-------|------|-------|------|
| >= 0.7 | 进攻 | Attack | 积极筛选新标的，加大转化 |
| 0.5-0.69 | 积极 | Aggressive | 精选标的，不追涨，控仓位 |
| 0.35-0.49 | 观望 | Watch | 不建新仓，观察持仓，等信号 |
| < 0.35 | 防御 | Defend | 不建新仓，缩减观察列表 |

### 各层信号

| 层 | 函数 | 输入 | Green | Red |
|----|------|------|-------|-----|
| L0 | calcL0SignalDetail | BTC vs 200MA % | >= 0 (expansion) | < 0 (contraction) |
| L1 | calcL1SignalDetail | FRED GNL 7d change | >= 0 (inflow) | < 0 (outflow) |
| L2 | calcL2SignalDetail | Stablecoin 7d + SOL inflow | Both positive | Both negative |
| L3 | calcL3SignalDetail | Meme mcap 24h + DEX volume | Resonance (>= 0.7) | Weak (< 0.4) |
| FG | calcFGSignalDetail | Fear & Greed index | >= 55 | < 30 |
| L4 | calcL4SignalDetail | Watch Station + Alpha | Bull ratio high | Full retreat |

### Verdict Engine

`buildVerdictText(score, signals, alignment)` → `{ verdict, action, l4Hint }`

基于 score 档位 + signal alignment (X/5 bullish) 生成自然语言交易建议。

---

## 六、当前进度与待办

### 项目阶段判断（2026-03-24）

**已稳定、不需要改的部分：**
- `dashboard/worker/worker.js` — 数据层（API 代理、数据聚合、缓存），除清理 Binance 死路由外不需改动
- `dashboard/gmgn-proxy/` — GMGN IPv4 代理，已稳定
- `src/lib/api.js` — Worker 通信层（除清理 Binance fallback 外）
- `src/lib/storage.js` — localStorage 持久化
- `src/lib/utils.js` — 格式化工具函数
- `src/config.js` — Worker URL 配置
- 所有数据获取逻辑、缓存策略、API 路由

**需要重新修改的部分（= 下一阶段主要工作）：**
- **决策引擎** — `calcHeroSignal`、`buildVerdictText`、信号计算逻辑（在 `src/App.jsx`）需要重新设计评分模型和输出方式
- **页面交互** — 所有页面的交互流程、状态管理、用户操作路径需要重新规划
- **页面设计** — 两套设计系统共存（`--lo-*` tokens vs 硬编码 iOS hex），视觉风格、布局、组件样式需要统一重做
- **功能区** — Dashboard 结构、L4 Workbench 布局、Detail Pages 信息架构、组件组织方式需要重新构建

**简而言之：数据管道已通，上层全部重做。**

当前代码可以正常 `npm run build` + 运行，但前端产品形态处于"功能可用但需要全面重构"的状态。下一阶段的工作是在稳定的数据层之上，重建整个用户界面和决策体验。

### 已完成的基础设施

| 包 | 内容 | 状态 |
|----|------|------|
| PKG-DATA-WORKER | Worker 6 新路由 (3 GMGN + 3 Binance) | ✅ 已部署 |
| PKG-VERDICT-ENGINE | buildVerdictText + calcHeroSignal 升级 | ✅ 已合并 |
| PKG-DASHBOARD-REBUILD | Dashboard → HERO + signal panel + CTA | ✅ 已合并 |
| PKG-L4-DECISION | 执行建议条 + composite sort + security rating | ✅ 已合并 |
| PKG-MEME-DATA-CMC | CMC 替换 CoinGecko meme 数据 | ✅ 已部署验证 |
| GMGN IPv6 修复 | Vercel IPv4 proxy | ✅ 3 端点全通 |
| 仓库清理 | 删除旧分支/旧文件，更新 README + PRD | ✅ 已推送 |

### 待办（进入重构前的清理）

1. **清理 Binance 死路由** — 删除 worker.js 中 3 个 `/api/binance/*` 路由 + `fetchBinanceWeb3Json` + `BINANCE_CHAIN_MAP` + api.js 中 Binance fallback

### 重构方向（待规划）

以下都需要通过 `/office-hours` 或 `/plan-eng-review` 明确范围后再执行：

- **设计系统统一** — 统一到 `--lo-*` token 体系，消除硬编码色值
- **决策引擎重设计** — 信号评分模型、verdict 输出方式、信号对齐逻辑
- **页面架构重构** — Dashboard/L0-L4/Detail Pages 的信息架构和交互流程
- **组件体系重建** — 从 inline style 迁移到 CSS class，组件复用
- **格式化函数去重** — fmtPct/fmtB 在 8+ 文件重复定义

### 已知问题

- CMC `/v1/cryptocurrency/category` 的 BSEN token mcap $587B 异常（CMC 数据质量问题）
- `/api/all` 缓存 1h，部署后首次需等缓存刷新

---

## 七、开发命令

```bash
# 前端开发
cd /Users/partrick/Desktop/Playground
npm install
npm run dev                    # http://localhost:5173

# Worker 本地开发
cd dashboard/worker
npx wrangler dev               # http://localhost:8787
# 需要环境变量：CMC_API_KEY, FRED_API_KEY, GMGN_PROXY_KEY 等

# GMGN Proxy 本地开发
cd dashboard/gmgn-proxy
npx vercel dev                 # http://localhost:3000

# 部署 Worker
cd dashboard/worker && npx wrangler deploy

# 部署 GMGN Proxy
cd dashboard/gmgn-proxy && npx vercel deploy --prod

# 部署前端
npm run build && npx wrangler deploy   # 使用根目录 wrangler.jsonc
```

---

## 八、角色定义

Claude 在本项目中是 **PM Controller**：

- 诊断问题、规划任务、创建 Codex 执行包
- Codex 负责执行包的代码实现
- Claude 审查 Codex 执行结果

**默认不直接写代码**，除非用户明确要求。

参考：`AI/02-control-layer:/01-pm-controller.md`

---

## 九、高风险文件

修改前必须说明理由和边界：

| 文件 | 行数 | 内容 |
|------|------|------|
| `src/App.jsx` | ~4100 | 信号引擎 + 所有 detail pages + L4 workbench |
| `src/styles.css` | ~2200 | 全局样式 + design tokens |
| `dashboard/worker/worker.js` | ~1500 | 所有 API 代理 + 数据聚合 + 缓存 |
| `src/lib/api.js` | ~100 | Worker 通信 + fetchTokenSecurity |
| `src/lib/storage.js` | ~80 | localStorage 持久化 |

---

## 十、工作原则

1. **先规划，再实现** — 非简单任务必须先写计划
2. **先验证，再算完成** — 代码写完 ≠ 任务完成
3. **根因优先** — Bug/异常先定位根因，不做表面 patch
4. **最小改动** — 最少文件、最低副作用
5. **范围受控** — 混入多层时停下拆包

---

## 十一、Codex 协同

### 发包规则

遵守 `AI/02-control-layer:/02-codex-handoff-protocol.md`：
- Artifact-first（包文件先行）
- 启动消息 ≤ 6 行，返回消息 ≤ 8 行
- 包文件存放：`~/.gstack/projects/Playground/<PKG-NAME>.md`

### 包结构

每个包必须包含：唯一目标、允许/禁止修改文件、具体改动（含代码片段）、验证步骤、延后事项。

### 结果格式化

使用 `AI/03-skills/custom:/01-执行结果汇报官.md`

---

## 十二、GSTACK 技能体系（强制）

本项目使用 [gstack](https://github.com/garrytan/gstack) 技能框架，安装在 `AI/03-skills/gstack/`。

### 规则

1. **所有复杂任务必须通过 gstack skill 路由**，不允许绕过
2. **先判断任务类型，再选择 skill**
3. **浏览器访问必须使用 `/browse`**，禁止使用系统内置浏览器工具

### 任务类型 → 技能映射

| 任务类型 | Skill |
|----------|-------|
| 方向不清、需求澄清 | `/office-hours` |
| 规划实现包（工程） | `/plan-eng-review` |
| 规划实现包（CEO 视角） | `/plan-ceo-review` |
| 规划实现包（设计） | `/plan-design-review` |
| 设计咨询/审核 | `/design-consultation`, `/design-review` |
| 根因调查/Bug | `/investigate` |
| 代码审查 | `/review` |
| 验证/QA | `/qa`, `/qa-only` |
| 交付/发版 | `/ship`, `/document-release` |
| 交给 Codex | `/codex` |
| 自动规划 | `/autoplan` |
| 浏览器操作 | `/browse` |
| 阶段复盘 | `/retro` |
| 冻结/解冻 | `/freeze`, `/unfreeze` |
| 护栏检查 | `/guard`, `/careful` |

### 自愈

skill 报错时：`cd AI/03-skills/gstack && ./setup`，然后重试，不请求用户修复。

---

## 十三、项目护栏

默认不做：
- 无理由扩数据源
- polish 升级成架构大改
- 因为"能做"就扩 scope
- 未确认改高风险文件
- 验证不充分声称完成

走偏信号（立即停下重规划）：
- 任务跨多层
- 根因不明
- 改动越来越 hack

---

## 十四、状态协议

关键判断时输出：

`READY_FOR_PLAN` / `READY_FOR_CODEX` / `READY_FOR_REVIEW` / `READY_FOR_QA` / `BLOCKED_NEEDS_CONTEXT` / `BLOCKED_NEEDS_INVESTIGATION` / `DEFERRED`

---

## 十五、Handoff Safe Protocol

用户输入 `handoff-safe` / `交接` / `进入下一阶段` 时：
1. 执行结果汇报官（紧凑模式）
2. 压缩上下文：task objective / current state / key decisions / next step
3. 输出最小交接包（每字段 ≤ 1 行，总长 ≤ 6 行）

---

## 十六、输出风格

- 清楚、结构化、决策导向
- 不夸大完成度
- 说清：任务类型、目标、推荐路径、最小实现包、当前状态
- 不用长篇自述代替结论
