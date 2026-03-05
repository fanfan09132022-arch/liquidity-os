# LiquidityOS · 产品需求文档（PRD）

**版本：** v3.0  
**日期：** 2026-03-05  
**作者：** @partrick2022  
**状态：** V2 已实现，内测中

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
| ⚡ 一键刷新 | 调用 Claude API + Web Search，约 10-20 秒拉取 L0-B / L2 / L3 / F&G 全部宏观数据 |

### 模块 B：系统综合信号（Hero 卡片）

**功能：** 综合 L2 / L3 / F&G / L4 四个信号灯，计算系统总判断。

**信号灯来源：**

| 信号灯 | 数据来源 | 判定逻辑 |
|--------|---------|---------|
| 稳定币 | L2 自动计算 | 稳定币净增 + Solana 净流入 = 🟢；仅一项 = 🟡；均负 = 🔴 |
| Meme板块 | L3 加权评分 | 加权 ≥0.7 = 🟢；0.4-0.7 = 🟡；<0.4 = 🔴 |
| 情绪 | F&G 指数 | ≥55 = 🟢；30-55 = 🟡；<30 = 🔴 |
| 个股 | L4 手动数据计算 | 存量普涨+V/MC高+新币承接稳 = 🟢；背离/控盘 = 🟡；全线回撤+衰减 = 🔴 |

**综合计算：** 🟢=1 / 🟡=0.5 / 🔴=0 → 平均分

| 分数 | 判定 | 含义 |
|------|------|------|
| ≥0.7 | 🟢 进攻 | 多层共振看涨 |
| 0.5-0.7 | 🔵 积极 | 整体偏多，选择性参与 |
| 0.35-0.5 | 🟡 观望 | 信号分歧，等待确认 |
| <0.35 | 🔴 防御 | 多层偏空，缩减仓位 |

### 模块 C：L0-B · BTC 周期位置

| 字段 | 数据方式 | 说明 |
|------|---------|------|
| BTC 现价 | 一键刷新自动填入 | 来源 CoinGecko（通过 Claude Web Search） |
| 24h 变化 | 一键刷新自动填入 | 百分比 |
| BTC/200MA 比率 | 手动查看 | 快捷链接 → TradingView |
| MVRV Z-Score | 手动查看 | 快捷链接 → LookIntoBitcoin |

### 模块 D：L1 · 全球净流动性

| 字段 | 数据方式 | 说明 |
|------|---------|------|
| Fed 资产负债表 | FRED API（未接入）或手动 | 快捷链接 → FRED WALCL |
| TGA | 同上 | 快捷链接 → FRED WTREGEN |
| RRP | 同上 | 快捷链接 → FRED RRPONTSYD |
| GNL | 自动计算 | Fed − TGA − RRP（当 FRED 接入后） |

**备注：** FRED API 需翻墙申请 Key。当前手动填入，周更数据。

### 模块 E：L2 · 稳定币弹药

| 字段 | 数据方式 | 来源 |
|------|---------|------|
| 稳定币总市值 | 一键刷新自动 | DeFiLlama |
| 7 日净变化 | 一键刷新自动 | DeFiLlama |
| Solana / ETH / BSC TVL | 一键刷新自动 | DeFiLlama |
| Solana 稳定币净流入(7d) | 一键刷新自动 | DeFiLlama |
| BSC 稳定币净流入(7d) | 一键刷新自动 | DeFiLlama |

**信号灯：** 稳定币净增 且 Solana 净流入正 = 🟢 / 仅一项正 = 🟡 / 均负 = 🔴

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

### 模块 G：恐惧贪婪指数

| 字段 | 数据方式 | 说明 |
|------|---------|------|
| F&G Index | 一键刷新自动填入 | 来源 Alternative.me |
| 滑动条可视化 | 自动 | 0-100，颜色渐变 |
| 可手动编辑 | 输入框 | 覆盖自动值 |

**信号灯：** ≥55 = 🟢 / 30-55 = 🟡 / <30 = 🔴

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

结果：≥0.6 → 🟢 进攻 · 0.35-0.6 → 🟡 观望 · <0.35 → 🔴 防御
```

### 模块 I：今日交易笔记

自由文本区域，记录市场观察、入场理由、止损位等。

---

## 五、数据架构

### 5.1 数据获取方式

| 数据类别 | 获取方式 | 说明 |
|---------|---------|------|
| L0-B BTC 价格 / L2 / L3 / F&G | Claude API + Web Search | 点击「一键刷新」，约 10-20 秒 |
| L0-A 周期 / L0-B 200MA+MVRV | 手动查看 + 快捷链接 | 月度/日 |
| L1 Fed / TGA / RRP | 手动填入 + 快捷链接 | 周更数据，FRED 需翻墙 |
| L4 Watchlist + Alpha | 全部手动填入 | 日更 |
| F&G | 自动填入，可手动覆盖 | 一键刷新时自动 |

### 5.2 备用数据代理（已部署，未在面板中使用）

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

**用途：** Artifacts 沙盒无法直接 fetch Worker，当前面板走 Claude API。Worker 留给未来独立网站使用（1 秒响应、零 token 消耗）。

### 5.3 持久化存储

使用 `window.storage` API，键格式 `daily:YYYY-MM-DD`。

```json
{
  "fgVal": "22",
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

**注意：** 宏观数据（macro）不持久化存储，每次打开面板需点一次「一键刷新」重新拉取。L4 数据 + F&G + 笔记自动保存。

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
| 网络 | 一键刷新需要网络（Claude API），L4 和笔记支持离线 |
| 性能 | 页面加载 < 1 秒，宏观数据刷新 10-20 秒 |
| 设备 | 移动端优先，桌面可用 |
| 语言 | 界面全中文 |
| 存储 | window.storage，无需后端 |
| API | Claude.ai Artifact 内置 Anthropic API，无需自行管理 Key |
| 代码 | 单文件 ~360 行，无外部依赖 |

---

## 八、技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| 前端 | React JSX + Tailwind-style inline | 单文件，Claude.ai Artifacts |
| 宏观数据 | Anthropic API + Web Search | 搜索 DeFiLlama / CoinGecko / Alternative.me |
| 数据代理（备用） | Cloudflare Worker | 已部署，留给未来独立网站 |
| 持久化 | window.storage API | 按日期键存储 |
| 代码托管 | GitHub Public | fanfan09132022-arch/liquidity-os |
| 框架文档 | Notion | 「交易系统」页面 |

---

## 九、已实现 vs 待开发

### ✅ 已实现（V2 当前状态）

- [x] Hero 综合信号卡片（4 信号灯驱动）
- [x] L0-B BTC 价格自动拉取 + 手动快捷链接
- [x] L1 GNL 手动填入 + FRED 快捷链接
- [x] L2 稳定币全量自动（总市值 / 7日变化 / TVL / 净流入）
- [x] L3 Meme 板块自动（Meme 市值 / DEX 交易量 × 3 链）
- [x] L3 加权评分信号灯
- [x] F&G 自动填入 + 手动可编辑
- [x] L4 存量观测站（5-10 行手动表格 + V/MC 自动算）
- [x] L4 Alpha Scanner（3 卡片 × 筹码/动量/池子强度）
- [x] L4 信号灯自动计算
- [x] 交易笔记持久化
- [x] 全数据 window.storage 按日持久化
- [x] Cloudflare Worker 数据代理已部署

### 🔲 待开发

- [ ] L0-A 周期阶段选择器（扩张/过渡/收缩）
- [ ] L1 FRED API 接入（需翻墙申请 Key）
- [ ] 历史数据回顾（选日期查看过去研判）
- [ ] 推文草稿自动生成
- [ ] 宏观数据缓存（同日内二次打开免重复刷新）
- [ ] 独立网站部署（直接 fetch Worker，零 token 消耗）
- [ ] 移动端体验优化

---

## 十、每日使用流程

```
1. 打开面板
2. 点击右上角「⚡ 一键刷新」→ 等待 10-20 秒
   → L0-B BTC 价格自动填入
   → L2 稳定币数据自动填入
   → L3 Meme/DEX 数据自动填入
   → F&G 自动填入
   → Hero 信号灯自动亮起

3. 手动查看（快捷链接）：
   → BTC/200MA 比率（TradingView）
   → MVRV Z-Score（LookIntoBitcoin）
   → L1 Fed/TGA/RRP（FRED，周更）

4. 填写 L4 存量观测站：
   → CoinGecko Meme 页面查 Top 5-10 币数据
   → 填入 Token / MCap / 24h% / 7d% / Vol

5. 填写 L4 Alpha Scanner：
   → DEX Screener 看今天最强新币
   → 填入筹码 / 动量 / 池子强度

6. 写交易笔记

7. 数据自动保存，关闭即可
```

---

## 十一、已知局限性

1. **Artifacts 沙盒限制：** 无法直接 fetch 外部 API（如 Worker），必须走 Claude API 中转，消耗 token 且耗时 10-20 秒。
2. **CoinGecko 限速：** 免费 API 偶尔返回空（rate limit），BTC 改用 Claude 搜索间接获取。
3. **FRED 需翻墙：** 中国大陆无法直接访问 fred.stlouisfed.org 申请 API Key。
4. **L4 全手动：** GMGN 不开放数据 API，存量和增量数据只能手动填入。
5. **无历史回顾：** 当前只能看今天的数据，无法回看过去日期。
6. **宏观数据不缓存：** 每次打开面板都需重新刷新，同日内多次打开浪费 token。

---

## 十二、文档修订历史

| 版本 | 日期 | 主要变更 |
|------|------|---------|
| v1.0 | 2026-02-xx | 初稿：四层框架 + 基础功能 |
| v1.1 | 2026-03-01 | 修正框架定义；新增分期计划；加入评分权重 |
| v2.0 | 2026-03-02 | 新增 L0 宏观周期层；修正 L2 为总稳定币市值；新增时滞警告 |
| v2.1 | 2026-03-03 | L2 补充 TVL + 链上净流入；L3 改为 Meme 板块流动性；新增信号链触发顺序 |
| v2.1.1 | 2026-03-05 | L3 指标替换为 DEX 交易量；加权评分制；存储结构更新 |
| **v3.0** | **2026-03-05** | **重写 PRD 对齐实际代码：新增 L4 存量与增量结构（Watchlist + Alpha Scanner）；删除 24H 热榜研判模块；新增 Cloudflare Worker 备用数据代理；宏观数据改为 Claude API + Web Search 一键拉取；存储结构重构** |

---

*PRD v3.0 · @partrick2022 · LiquidityOS*
