# LiquidityOS · 产品需求文档（PRD）

**版本：** v3.0  
**日期：** 2026-03-05  
**作者：** @partrick2022  
**状态：** Beta 验收版，主链路已通过真实运行验证

---

## 一、项目背景

### 1.1 我是谁，在做什么

Twitter 账号 @partrick2022，专注 Solana Meme 币交易。  
核心目标：**推特涨粉 + 个人交易能力成长。**  
所有工具的开发，都服务于这两个目标。

### 1.2 为什么需要这个看板

**问题：** 每天手动打开 5-8 个网站查看数据，耗时 40 分钟以上，信息分散，无统一框架，判断过程无法复盘。

**解决方案：** 按四层流动性框架（L0-L4）组织的交易看板，宏观数据一键刷新，微观研判手动录入，每日研判流程标准化。

---

## 二、核心概念：四层流动性框架（含 L0）

### 框架整体逻辑

```
L0 → 确定仓位上限和操作偏见（进攻/防守）
  ↓
L1 → 确认流动性方向，判断信号链走到哪一步
  ↓
L2 → 确认弹药到位，战场聚焦在哪条链
  ↓
L3 → 确认 Meme 板块整体热度
  ↓
L4 → 存量观测 + 增量筛选，做出进出场决策
```

**核心原则：** 上层框架是下层操作的前提条件。L0 偏空时，即使 L4 出现强信号，也应缩小仓位规模、快进快出。

### L0：宏观周期定位

- **L0-A：全球流动性大周期阶段**（Howell 65 个月周期：扩张期 / 过渡期 / 收缩期）→ 手动判断，月度更新
- **L0-B：BTC 周期位置**（BTC 现价 / 200 日均线比率 + MVRV Z-Score）→ AI 自动拉取 BTC 价格 + 手动查看 200MA 和 MVRV

### L1：全球净流动性

**公式：** GNL = 美联储资产负债表 − TGA − RRP  
**关注点：** 连续扩张周数（动量），领先 BTC 约 13 周。  
**当前状态：** FRED API Key 未设置，手动填入（周更数据）。

### L2：稳定币弹药

三维度判断：
- 稳定币总市值 7 日净变化（DeFiLlama 自动拉取）
- Solana / ETH / BSC TVL（DeFiLlama 自动拉取）
- Solana / BSC 链上稳定币 7 日净流入（DeFiLlama 自动拉取）

### L3：Meme 板块流动性

加权评分制判断板块热度：
- **主信号（权重 1.0）：** Meme 总市值 24h 变化 + Solana DEX 24h 交易量变化
- **辅助信号（权重 0.5）：** Base DEX 变化 + BSC DEX 变化
- 数据来源：CoinGecko + DeFiLlama（自动拉取）

### L4：Meme 存量与增量结构（V3.0 新增）

从"存量博弈"和"增量发现"两个维度研判微观资金流向：

**存量观测站（Watchlist）：** 追踪 Top Meme 币的市值、涨跌、换手活跃度（V/MC）  
**新币筛选器（Alpha Scanner）：** 对当天最强新币进行筹码集中度 + 资金动量 + 池子强度研判

---

## 三、目标用户

**唯一用户：** 我自己（@partrick2022）  
**使用场景：** 每天早上点一次「一键刷新」→ 手动填 L4 → 记交易笔记，15-20 分钟  
**使用设备：** 主要手机，偶尔电脑

---

## 四、功能模块（按面板从上到下排列）

### 模块 A：导航栏

| 元素 | 说明 |
|------|------|
| 标题 | LiquidityOS |
| 副标题 | 更新时间 或 当日日期 |
| ⚡ 一键刷新 | 优先请求 Cloudflare Worker `/api/all`；失败时回退 Claude API + Web Search，拉取 L0-B / L2 / L3 / F&G 宏观数据 |

### 模块 B：系统综合信号（Hero 卡片）

**功能：** 综合 L2 / L3 / F&G / L4 四个信号灯，计算系统总判断；L0/L1 作为仓位约束单独展示，不直接并入 Hero 平均分。

**信号灯来源：**

| 信号灯 | 数据来源 | 判定逻辑 |
|--------|---------|---------|
| 稳定币 | L2 自动计算 | 稳定币净增 + Solana 净流入 = 🟢；均负 = 🔴；任一关键数据缺失时按 🟡 降级 |
| Meme板块 | L3 加权评分 | 加权 ≥0.7 = 🟢；0.4-0.7 = 🟡；<0.4 = 🔴；任一主/辅数据缺失时按 🟡 降级 |
| 情绪 | F&G 指数 | ≥55 = 🟢；30-55 = 🟡；<30 = 🔴；缺失时按 🟡 降级 |
| 个股 | L4 手动数据计算 | 基线 0.5 + 存量评分 + 增量调整；≥0.6 = 🟢；0.35-0.6 = 🟡；<0.35 = 🔴 |

**综合计算：** 每个信号灯先转为 score（🟢=1 / 🟡=0.5 / 🔴=0），Hero 取 4 个有效信号平均分，并显示分数与有效信号数量。

| 分数 | 判定 | 含义 |
|------|------|------|
| ≥0.7 | 🟢 进攻 | 多层共振看涨 |
| 0.5-0.7 | 🔵 积极 | 整体偏多，选择性参与 |
| 0.35-0.5 | 🟡 观望 | 信号分歧，等待确认 |
| <0.35 | 🔴 防御 | 多层偏空，缩减仓位 |

### 模块 C0：L0-A · 全球流动性周期

| 字段 | 数据方式 | 说明 |
|------|---------|------|
| 周期阶段 | 手动选择 | 扩张 / 过渡 / 收缩 |
| 仓位偏见提示 | 自动 | 扩张 = 偏进攻；过渡 = 控节奏；收缩 = 偏防守 |

### 模块 C：L0-B · BTC 周期位置

| 字段 | 数据方式 | 说明 |
|------|---------|------|
| BTC 现价 | 一键刷新自动填入 | 来源 Worker 聚合（Binance / CoinCap / CoinGecko），失败时回退 Claude Web Search |
| 24h 变化 | 一键刷新自动填入 | 百分比 |
| BTC/200MA 比率 | 手动查看 | 快捷链接 → TradingView |
| MVRV Z-Score | 手动查看 | 快捷链接 → LookIntoBitcoin |

### 模块 D：L1 · 全球净流动性

| 字段 | 数据方式 | 说明 |
|------|---------|------|
| Fed 资产负债表 | FRED API 或手动 | 自动拉取成功则展示 FRED；否则允许手动录入 |
| TGA | 同上 | 快捷链接 → FRED WTREGEN |
| RRP | 同上 | 快捷链接 → FRED RRPONTSYD |
| GNL | 自动计算 | 自动或手动输入后统一计算 `Fed − TGA − RRP` |

**备注：** FRED API 需翻墙申请 Key。当前面板已支持手动录入 `Fed / TGA / RRP / 数据日期`，周更数据可直接留存在当天记录中。

### 模块 E：L2 · 稳定币弹药

| 字段 | 数据方式 | 来源 |
|------|---------|------|
| 稳定币总市值 | 一键刷新自动 | DeFiLlama |
| 7 日净变化 | 一键刷新自动 | DeFiLlama |
| Solana / ETH / BSC TVL | 一键刷新自动 | DeFiLlama |
| Solana 稳定币净流入(7d) | 一键刷新自动 | DeFiLlama |
| BSC 稳定币净流入(7d) | 一键刷新自动 | DeFiLlama |

**信号灯：** 稳定币净增 且 Solana 净流入正 = 🟢 / 均负 = 🔴 / 任一关键数据缺失或信号分歧 = 🟡  
**当前实现：** 返回 `color / score / reason`，并在 UI 中显示原因说明。

### 模块 F：L3 · Meme 板块流动性

| 字段 | 数据方式 | 来源 |
|------|---------|------|
| Meme 总市值 | 一键刷新自动 | CoinGecko |
| Meme 24h 市值变化 | 一键刷新自动 | CoinGecko |
| Solana DEX 24h 交易量 | 一键刷新自动 | DeFiLlama |
| Base DEX 24h 交易量 | 一键刷新自动 | DeFiLlama |
| BSC DEX 24h 交易量 | 一键刷新自动 | DeFiLlama |

**信号灯（加权评分制）：**

```
主信号（权重 1.0）：Meme 市值变化方向 + Solana DEX 变化方向
辅助信号（权重 0.5）：Base DEX 变化方向 + BSC DEX 变化方向

方向判断：变化 ≥5% → 上升(1分)；-5%~5% → 持平(0.5分)；≤-5% → 下降(0分)
Meme 市值：变化 ≥1% → 上升；-1%~1% → 持平；≤-1% → 下降

加权平均 ≥0.7 → 🟢 · 0.4~0.7 → 🟡 · <0.4 → 🔴
```

**当前实现：** 若 Meme 市值变化或任一链 DEX 变化缺失，整体按 🟡 降级，并显示缺失字段。

### 模块 G：恐惧贪婪指数

| 字段 | 数据方式 | 说明 |
|------|---------|------|
| F&G Index | 一键刷新自动填入 | 来源 Alternative.me |
| 滑动条可视化 | 自动 | 0-100，颜色渐变 |
| 可手动编辑 | 输入框 | 覆盖自动值 |

**信号灯：** ≥55 = 🟢 / 30-55 = 🟡 / <30 = 🔴 / 缺失 = 🟡  
**当前实现：** 返回 `color / score / reason`，允许用户手动覆盖自动值。

### 模块 H：L4 · Meme 存量与增量结构（V3.0 新增）

**快捷链接栏：** CoinGecko Meme | DEX Screener | GMGN

#### H1：存量观测站（Watchlist）

手动录入表格，追踪 Top Meme 币动态：

| 列 | 说明 | 输入方式 |
|----|------|---------|
| Token | 代币名称，如 DOGE / PEPE / WIF | 手动输入 |
| MCap | 市值 | 手动输入 |
| 24h% | 24 小时涨跌幅 | 手动输入 |
| 7d% | 7 日涨跌幅 | 手动输入 |
| Vol24h | 24 小时交易量 | 手动输入 |
| V/MC | 换手活跃度 = Vol24h / MCap | 自动计算 |

- 默认 5 行，可添加至 10 行
- V/MC 颜色编码：≥0.5 🟢 活跃 / 0.2-0.5 🟡 一般 / <0.2 🔴 低迷

#### H2：新币筛选器（Alpha Scanner）

3 个候选新币卡片，每个包含：

| 维度 | 选项 | 说明 |
|------|------|------|
| 代币名称 | 手动输入 | $TICKER 或合约地址 |
| 筹码集中度 | 🎯 控盘 / 📊 分布 / 👥 散户 | 单选按钮 |
| 资金动量 | 🚀 喷发 / 🤝 承接稳 / 📉 卖压 / 💀 衰减 | 单选按钮 |
| 池子强度 | Liq/Vol 数值 | 手动输入 |
| 备注 | 简要判断 | 手动输入 |

#### H3：L4 信号灯逻辑

```
输入：Watchlist 数据 + Alpha Scanner 数据  
基线分 = 0.5

存量评分（权重 60%）：
  bullRatio = 24h上涨币数 / 已填币数 × 0.4
  vmcActive = V/MC≥0.3 的币数 / 已填币数 × 0.3

增量调整：
  goodAlpha（筹码分布/散户 + 喷发/承接稳）→ +0.2
  badAlpha（衰减 + 池子强度<0.5）→ -0.15

最终分 = 基线 0.5 + 存量评分 + 增量调整
结果：≥0.6 → 🟢 进攻 · 0.35-0.6 → 🟡 观望 · <0.35 → 🔴 防御
```

**当前实现：** 返回 `color / score / bullRatio / vmcActive / stockScore / alphaAdjustment / reason`，并在 UI 中展示分数拆解。

### 模块 I：今日交易笔记

自由文本区域，记录市场观察、入场理由、止损位等。

---

## 五、数据架构

### 5.1 数据获取方式

| 数据类别 | 获取方式 | 说明 |
|---------|---------|------|
| L0-B BTC 价格 / L2 / L3 / F&G | Worker 优先，Claude API + Web Search 兜底 | 点击「一键刷新」后优先走 Worker，失败再回退 AI |
| L0-A 周期 | 手动选择 | 按月或按阶段变化更新 |
| L0-B 200MA+MVRV | 手动查看 + 快捷链接 | 日更 |
| L1 Fed / TGA / RRP | FRED API 或手动填入 | 周更数据；FRED 不可用时仍可在面板录入 |
| L4 Watchlist + Alpha | 全部手动填入 | 日更 |
| F&G | 自动填入，可手动覆盖 | 一键刷新时自动 |

### 5.2 数据代理（已部署，面板优先使用）

**Cloudflare Worker：** `https://liquidityos-data.fanfan09132022.workers.dev`

| 端点 | 数据 | 状态 |
|------|------|------|
| /api/all | 全部宏观数据 | ✅ 可用 |
| /api/btc | BTC 价格 | ✅ Binance + CoinGecko |
| /api/tvl | 三链 TVL | ✅ DeFiLlama |
| /api/stablecoins | 稳定币总量 + 7日变化 | ✅ DeFiLlama |
| /api/dex | DEX 交易量 | ✅ DeFiLlama |
| /api/meme | Meme 总市值 | ⚠️ CoinGecko 偶尔限速 |
| /api/fear-greed | F&G 指数 | ✅ Alternative.me |
| /api/fred | Fed/TGA/RRP/GNL | ⏭️ 需设置 FRED_API_KEY |

**用途：** 当前面板已优先请求 Worker，以降低宏观数据聚合复杂度；若 Worker 请求失败，再回退 Claude API + Web Search。未来独立网站可直接复用 Worker，实现更快响应和更低 token 消耗。

### 5.3 持久化存储

使用 `window.storage` API，键格式 `daily:YYYY-MM-DD`。

```json
{
  "macroSnapshot": { "btc": { "price": 71680, "change_24h": -1.2 } },
  "macroMeta": { "time": "09:15", "source": "Worker" },
  "heroSnapshot": { "score": 0.5, "label": "积　极", "color": "blue", "count": 4 },
  "signalSnapshots": {
    "l2": { "color": "yellow", "score": 0.5, "reason": "稳定币与净流入信号分歧" },
    "l3": { "color": "green", "score": 0.83, "reason": "Meme 市值与 DEX 交易量共振偏强" },
    "fg": { "color": "red", "score": 0, "reason": "F&G < 30，市场偏恐惧" },
    "l4": { "color": "green", "score": 0.7, "reason": "上涨占比 60% · V/MC 活跃占比 40% · goodAlpha +0.20" }
  },
  "l4Snapshot": { "score": 0.7, "color": "green", "reason": "上涨占比 60% · V/MC 活跃占比 40% · goodAlpha +0.20" },
  "fgVal": "22",
  "l0Cycle": "transition",
  "l1Manual": { "fed": "6.600", "tga": "0.700", "rrp": "0.300", "date": "2026-03-09" },
  "dailyNote": "今日笔记文本",
  "watchlist": [
    { "token": "PEPE", "mcap": "5200000000", "chg24h": "3.2", "chg7d": "-5.1", "vol24h": "1800000000" },
    { "token": "", "mcap": "", "chg24h": "", "chg7d": "", "vol24h": "" }
  ],
  "alphaCards": [
    { "token": "$NEWCOIN", "chips": "spread", "momentum": "stable", "poolStrength": "0.8", "note": "叙事强" },
    { "token": "", "chips": "", "momentum": "", "poolStrength": "", "note": "" }
  ],
  "savedAt": "2026-03-05T09:14:00Z"
}
```

**注意：** 当前已开始把 `macroSnapshot + heroSnapshot + signalSnapshots + l4Snapshot` 按日期写入本地存储，用于历史回看；并已支持近 30 天摘要、轻量筛选与基础统计。当天工作区默认优先读取本地快照，只有点击“强制刷新”才重新请求网络。

---

## 六、数据源快捷链接清单

| 层级 | 链接 | 用途 |
|------|------|------|
| L0-B | [TradingView BTCUSD](https://www.tradingview.com/symbols/BTCUSD/) | BTC 现价 + 200MA |
| L0-B | [LookIntoBitcoin MVRV](https://www.lookintobitcoin.com/charts/mvrv-zscore/) | MVRV Z-Score |
| L1 | [FRED WALCL](https://fred.stlouisfed.org/series/WALCL) | Fed 资产负债表 |
| L1 | [FRED WTREGEN](https://fred.stlouisfed.org/series/WTREGEN) | TGA |
| L1 | [FRED RRPONTSYD](https://fred.stlouisfed.org/series/RRPONTSYD) | RRP |
| L2 | [DeFiLlama /chains](https://defillama.com/chains) | 三链 TVL |
| L2 | [DeFiLlama /stablecoins](https://defillama.com/stablecoins) | 稳定币总量 7 日变化 |
| L2 | [DeFiLlama /stablecoins/chains](https://defillama.com/stablecoins/chains) | 各链稳定币净流入 |
| L3 | [CoinGecko Meme](https://www.coingecko.com/en/categories/meme-token) | Meme 总市值 |
| L3 | [DeFiLlama DEX Solana](https://defillama.com/dexs/chains/solana) | Solana DEX 交易量 |
| L3 | [DeFiLlama DEX Base](https://defillama.com/dexs/chains/base) | Base DEX 交易量 |
| L3 | [DeFiLlama DEX BSC](https://defillama.com/dexs/chains/bsc) | BSC DEX 交易量 |
| L4 | [CoinGecko Meme](https://www.coingecko.com/en/categories/meme-token) | 存量观测数据 |
| L4 | [DEX Screener Solana](https://dexscreener.com/solana) | 新币发现 |
| L4 | [GMGN](https://gmgn.ai) | 聪明钱分析 |
| F&G | [Alternative.me](https://alternative.me/crypto/fear-and-greed-index/) | 恐惧贪婪指数 |

---

## 七、非功能需求

| 项目 | 要求 |
|------|------|
| 平台 | 单文件 React JSX，运行在 Claude.ai Artifacts |
| 网络 | 一键刷新需要网络（Worker 或 Claude API），L0-A / L1 手动录入 / L4 / 笔记支持离线 |
| 性能 | 页面加载 < 1 秒，宏观数据刷新 10-20 秒 |
| 设备 | 移动端优先，桌面可用 |
| 语言 | 界面全中文 |
| 存储 | window.storage，无需后端 |
| API | Worker 聚合 + Claude.ai Artifact 内置 Anthropic API 兜底 |
| 代码 | 单文件 React JSX，无外部依赖 |

---

## 八、技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| 前端 | React JSX + Tailwind-style inline | 单文件，Claude.ai Artifacts |
| 宏观数据 | Cloudflare Worker + Anthropic API + Web Search | Worker 优先，AI 兜底 |
| 数据代理 | Cloudflare Worker | 已部署，前端优先调用 |
| 持久化 | window.storage API | 按日期键存储 |
| 代码托管 | GitHub Public | fanfan09132022-arch/liquidity-os |
| 框架文档 | Notion | 「交易系统」页面 |

---

## 九、已实现 vs 待开发

### ✅ 已实现（当前面板状态）

- [x] Hero 综合信号卡片（4 信号灯驱动）
- [x] Hero 分数与有效信号数量展示
- [x] L0-A 周期阶段选择器（扩张 / 过渡 / 收缩）
- [x] L0-B BTC 价格自动拉取 + 手动快捷链接
- [x] L1 FRED 自动展示 + 手动录入 + GNL 自动计算
- [x] L2 稳定币全量自动（总市值 / 7日变化 / TVL / 净流入）
- [x] L2 缺失数据降级逻辑 + reason 展示
- [x] L3 Meme 板块自动（Meme 市值 / DEX 交易量 × 3 链）
- [x] L3 加权评分信号灯
- [x] L3 缺失数据降级逻辑 + reason 展示
- [x] F&G 自动填入 + 手动可编辑
- [x] F&G reason 展示
- [x] L4 存量观测站（5-10 行手动表格 + V/MC 自动算）
- [x] L4 Alpha Scanner（3 卡片 × 筹码/动量/池子强度）
- [x] L4 信号灯自动计算 + 分数拆解展示 + reason 返回
- [x] 交易笔记持久化
- [x] `macroSnapshot / signalSnapshots / Hero / L0-A / L1 手动值 / F&G / L4 / 笔记` 按日持久化
- [x] 历史日期切换（今天 / 昨天 / 自选日期）
- [x] 近 30 天历史摘要列表（Hero / F&G / L4 / 笔记）
- [x] 历史轻量筛选（全部 / 有宏观 / 有笔记 / 进攻日）
- [x] 历史基础统计（记录数 / 宏观快照数 / 平均 Hero / 平均 F&G）
- [x] 当天优先读取本地缓存 + 强制刷新
- [x] 系统状态观测层（日期切换层 / 快照保存层 / 缓存读取层 / 历史汇总层）
- [x] dirty-save 保存边界：仅用户真实编辑或网络刷新成功才触发保存
- [x] 历史切换与缓存回填不触发写入
- [x] 5 条 Beta 真实运行验收已完成（日期切换 / 自动保存 / 缓存读取 / 历史详情一致性）
- [x] Cloudflare Worker 数据代理已部署并接入面板优先链路

### 🔲 待开发

- [ ] L1 FRED API 接入（需翻墙申请 Key）
- [ ] 历史数据回顾增强（按月统计、标签筛选、批量复盘视图）
- [ ] 推文草稿自动生成
- [ ] 缓存增强（TTL / 缓存状态标记 / 按字段失效策略）
- [ ] 独立网站部署（直接 fetch Worker，零 token 消耗）
- [ ] 移动端体验优化

---

## 十、每日使用流程

```
1. 打开面板
2. 先确认 L0-A 周期阶段（扩张 / 过渡 / 收缩）
3. 如有需要，先录入 L1 手动值（Fed / TGA / RRP / 日期）
4. 点击右上角「读取缓存」→ 当天优先读取本地快照；若没有缓存再请求 Worker / AI
5. 如需拿最新宏观数据，点击「强制刷新」→ 优先走 Worker，失败时回退 AI
   → L0-B BTC 价格自动填入
   → L2 稳定币数据自动填入
   → L3 Meme/DEX 数据自动填入
   → F&G 自动填入
   → Hero 信号灯与分数自动更新

6. 手动查看（快捷链接）：
   → BTC/200MA 比率（TradingView）
   → MVRV Z-Score（LookIntoBitcoin）
   → L1 Fed/TGA/RRP（FRED，周更；必要时修正手动值）

7. 填写 L4 存量观测站：
   → CoinGecko Meme 页面查 Top 5-10 币数据
   → 填入 Token / MCap / 24h% / 7d% / Vol

8. 填写 L4 Alpha Scanner：
   → DEX Screener 看今天最强新币
   → 填入筹码 / 动量 / 池子强度

9. 写交易笔记

10. 数据自动保存，关闭即可
11. 如需复盘，可切到昨天或任意历史日期查看快照；也可在“近 30 天摘要”里用筛选和统计快速定位目标日期
```

---

## 十一、已知局限性

1. **Worker / 第三方数据源稳定性：** 当前虽已优先走 Worker，但 CoinGecko、DeFiLlama、Alternative.me 任一异常都可能触发降级或 AI 兜底。
2. **CoinGecko 限速：** 免费 API 偶尔返回空（rate limit），L3 已实现黄灯降级，但数据完整性仍受影响。
3. **FRED 需翻墙：** 中国大陆无法直接访问 fred.stlouisfed.org 申请 API Key。
4. **L4 全手动：** GMGN 不开放数据 API，存量和增量数据只能手动填入。
5. **历史回看仍是轻量版：** 当前已支持按日期读取本地快照、近 30 天摘要、轻量筛选和基础统计，但还没有按月统计、标签筛选和批量复盘视图。
6. **缓存仍是轻量版：** 当前只做当天本地快照优先读取，没有 TTL、缓存状态标记和按字段失效策略。

---

## 十二、Beta 验收结论

- 已按既定 5 条验收清单完成真实运行验证
- 已确认通过：日期切换、自动保存、缓存优先读取、强制刷新、历史摘要跳转详情
- 真实运行中发现的循环更新问题已修复
- 历史日期残留当天缓存状态的问题已修复
- 当前版本应按“Beta 可验收版本”管理，不继续扩展大功能，优先做小范围稳定性修正

### 当前已确认成立的系统边界

- 只有用户真实编辑或网络刷新成功才会触发保存
- 历史切换不会触发写入
- 缓存回填不会触发写入
- “读取缓存”只在今天工作区有效，优先回填当天本地快照
- “强制刷新”跳过缓存，直接请求网络；成功后写入当天快照
- 历史日期只读本地快照，不请求网络
- 历史摘要点击后可跳回对应日期，且摘要与详情一致

---

## 十三、文档修订历史

| 版本 | 日期 | 主要变更 |
|------|------|---------|
| v1.0 | 2026-02-xx | 初稿：四层框架 + 基础功能 |
| v1.1 | 2026-03-01 | 修正框架定义；新增分期计划；加入评分权重 |
| v2.0 | 2026-03-02 | 新增 L0 宏观周期层；修正 L2 为总稳定币市值；新增时滞警告 |
| v2.1 | 2026-03-03 | L2 补充 TVL + 链上净流入；L3 改为 Meme 板块流动性；新增信号链触发顺序 |
| v2.1.1 | 2026-03-05 | L3 指标替换为 DEX 交易量；加权评分制；存储结构更新 |
| **v3.0** | **2026-03-05** | **重写 PRD 对齐实际代码：新增 L4 存量与增量结构（Watchlist + Alpha Scanner）；删除 24H 热榜研判模块；新增 Cloudflare Worker 数据代理；宏观数据改为一键拉取；存储结构重构** |
| **v3.0.1** | **2026-03-09** | **补齐当前实现口径：面板改为 Worker 优先 + AI 兜底；新增 L0-A 周期选择器与 L1 手动录入；Hero/L2/L3/L4/F&G 补充 score/reason 与降级规则说明** |
| **v3.0.2** | **2026-03-09** | **开始实现历史回看：新增 macroSnapshot / heroSnapshot / l4Snapshot 按日存储、历史日期切换、近 30 天摘要列表、轻量筛选与基础统计** |
| **v3.0.3** | **2026-03-09** | **收口信号结构与缓存口径：L4/Hero 补齐 reason；每日快照扩展为 macroSnapshot + signalSnapshots + heroSnapshot；当天默认读取缓存并支持强制刷新** |
| **v3.0.4** | **2026-03-09** | **同步 Beta 验收结果：新增系统状态观测层与 dirty-save 边界说明；确认历史切换/缓存回填不写入；记录 5 条真实运行验收通过与已修复问题** |

---

*PRD v3.0 · @partrick2022 · LiquidityOS*
