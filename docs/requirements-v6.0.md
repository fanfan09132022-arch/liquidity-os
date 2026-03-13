# LiquidityOS · 产品需求文档（PRD）

**版本：** v6.0  
**日期：** 2026-03-14  
**状态：** 独立站 MVP 主链路稳定，详细数据页全量上线，Worker 数据层迁移完成  
**作者：** @partrick2022

---

## 一、项目定义

LiquidityOS 是一个基于 L0-L4 流动性框架的个人交易工作台，用于把宏观环境判断、板块热度识别、Meme 标的跟踪、候选筛选、每日记录与历史复盘整合到同一条日常工作流中。

当前产品不是公开 SaaS，也不是多用户系统。  
当前阶段定位为：

- 个人日常交易工作台
- 交易框架沉淀工具
- 内容输出与复盘沉淀的底层支撑工具

---

## 二、项目目标

LiquidityOS 服务于两个长期目标：

1. 建立一套可重复执行的 Meme 币交易判断流程
2. 将交易框架、观察方法和决策过程沉淀为可复盘系统

---

## 三、当前产品状态

### 3.1 当前部署形态

- 前端：Cloudflare Pages
- 数据接口：Cloudflare Worker（全量代理，无浏览器直连外部域名）
- 本地存储：浏览器 `localStorage`

### 3.2 当前已打通的主链路

以下链路已通过真实运行验证：

- 更新数据 / 强制更新 → Worker 返回 → 页面写入当天快照
- 缓存命中 → 当天快照回填
- 历史日期切换 → 只读历史快照 → 切回今天恢复当日数据
- `/api/fred` → GNL 自动计算 → L1 区展示
- BTC / 200MA 自动展示 → 主控层渲染
- Top 50 Meme 榜单 → Worker 返回 → 页面真实渲染
- Alpha Scanner 第一轮自动支撑数据 → 部分接通，且不污染手动判断
- 各层详细数据页 → 独立路由 → 完整图表与数据展示

### 3.3 当前阶段判断

当前产品已完成：

1. 从原型到独立站 MVP 的迁移
2. 五张详细数据页的全量上线（L0-B / F&G / L3 / L2 / L1）
3. 数据层全量迁移至 Cloudflare Worker（INFRA-01 系列完结）

当前重点转向：

- 验证每日数据稳定性
- 根据实际使用习惯评估是否需要调整面板
- 视情况推进整体 UI 布局优化

---

## 四、核心框架：L0-L4

LiquidityOS 的核心逻辑是从宏观到微观逐层过滤，上层约束下层。

```
L0 → 确定仓位上限和操作偏见（进攻 / 防守）
  ↓
L1 → 确认总流动性方向
  ↓
L2 → 确认稳定币弹药与链上战场
  ↓
L3 → 确认 Meme 板块整体热度
  ↓
L4 → 观察存量结构与增量机会，形成最终交易判断
```

**核心原则：**

- 上层信号决定下层操作空间
- 下层机会判断不能脱离上层环境独立使用
- Hero 为综合信号，不等同于仓位指令
- L0 / L1 为仓位约束层，不直接并入 Hero 平均分

---

## 五、当前产品结构

### 5.1 主控层

用于回答：

- 今天整体偏进攻还是偏防守
- 当前是否值得执行
- 数据是否是新的
- BTC 当前处于什么位置

当前正式角色：

- Hero：主控结论中心
- L0-A：主控环境语义
- L0-B：BTC 主控依据卡（附「查看详情」入口）
- Action Dock：刷新与执行位

### 5.2 决策层

用于承载从宏观到中观的环境判断。

包含（每张卡均有「查看详情」入口，跳转对应详细页）：

- L1 · 净流动性
- L2 · 稳定币弹药
- L3 · Meme 板块
- F&G

当前结构：先快扫判断，再按需查看详情。详细页承载深度图表，主页只保留关键信号与趋势迷你图。

### 5.3 执行工作台

包含：

- 主区：存量观测站
- 辅区：Alpha Scanner
- 参考区：Top 50 Meme 市场雷达

### 5.4 复盘与诊断层

包含：

- 历史回看
- 近 30 天摘要
- 系统状态

**说明：** 摘要与笔记已从底部拆出，升级为全局浮动记录工具，默认收起。

---

## 六、功能模块定义

### 6.1 Hero 主控卡

**作用：** 用于快速回答当前环境偏强还是偏弱。

**当前输入：**

- L2
- L3
- F&G
- L4

**当前边界：**

- L0 / L1 不直接并入 Hero 平均分
- L0 / L1 独立承担仓位约束职责

**当前输出结构：**

- color
- score
- reason

### 6.2 L0：仓位约束层

#### L0-A：全球流动性周期

**当前状态：** 扩张 / 过渡 / 收缩

**当前语义：**

- 扩张：偏进攻
- 过渡：控制仓位
- 收缩：偏防守

**当前实现：**

- 手动选择
- 不再单独占卡
- 已并入主控层环境语义

#### L0-B：BTC 周期位置

**当前承载字段：**

- BTC 现价
- 200MA 比率
- 200MA
- MVRV Z-Score

**当前实现状态：**

- BTC 现价 / 200MA / 比率：自动展示
- MVRV Z-Score：手动填写位
- 继续作为主控确认依据卡保留

**当前产品要求：**

- 不得从主控层消失
- 不得被弱化成脚注信息
- 必须保留判断价值，而非装饰卡

**L0-B 详细页（v6.0 新增）：**

| 模块 | 内容 |
|------|------|
| BTC/USDT 周线 | TradingView Widget |
| 加密总市值 | TradingView Widget（TOTAL） |
| BTC 市值占比 | TradingView Widget（BTC.D） |
| 山寨币总市值 | TradingView Widget（TOTAL3） |

**说明：** 全部为 TradingView 嵌入 Widget，无额外 API 依赖。文件：`BTCDetailPage.jsx`

### 6.3 L1：全球净流动性

**公式：** GNL = Fed − TGA − RRP

**当前自动数据（全部经 Worker 代理）：**

- Fed（FRED WALCL）
- TGA（FRED WTREGEN）
- RRP（FRED RRPONTSYD）
- GNL（前端自动计算）
- 数据日期 / 来源 / 更新时间

**当前产品逻辑：**

- 自动优先（FRED）
- 手动兜底
- 先快扫判断
- 维护区按需展开，不再常驻主路径

**L1 详细页（v6.0 新增）：**

| 模块 | 内容 |
|------|------|
| GNL 数值卡 | 当前 Fed / TGA / RRP / GNL，显示最新数据日期 |
| GNL 历史走势图 | 折线图，近 52 周 |
| 三分量历史折线图 | Fed / TGA / RRP 三线并列，近 52 周 |
| DXY 参考 | TradingView Widget 嵌入，实时美元指数 |

**数据源：** FRED JSON API（`/api/fred/:series`，经 Worker，`FRED_API_KEY` secret）。文件：`L1DetailPage.jsx`

### 6.4 L2：稳定币弹药

**作用：** 判断场内总弹药是否增强，以及热钱当前集中在哪条链。

**当前状态：**

- 已有统一信号结构
- 已进入环境快扫层
- 已补充轻趋势图表达

**L2 详细页（v6.0 新增）：**

| 模块 | 内容 |
|------|------|
| 稳定币总量数值卡 | 当前总量（USD） |
| 历史走势图 | 折线图，全链稳定币总量 |
| 三链净流入 | Solana / Base / BNB Chain，7 日净变化 |
| 三链历史折线图 | 三链稳定币规模趋势对比 |

**数据源：** DeFiLlama（`/api/llama/stablecoins`、`/api/llama/stable-chart`、`/api/llama/stable-chart/:chain`，经 Worker）。文件：`L2DetailPage.jsx`

### 6.5 L3：Meme 板块热度

**作用：** 判断 Meme 板块整体热度是否升温或降温。

**当前状态：**

- 已有统一信号结构
- 已进入环境快扫层
- 已补充轻趋势图表达

**L3 详细页（v6.0 新增）：**

| 模块 | 内容 |
|------|------|
| Top 50 Meme 榜单表 | symbol / 价格 / 市值 / 24h 涨跌 / 7d 涨跌 / 成交量 |
| Meme 总市值走势图 | Top 10 动态加总，双轴图，近 30 日 |
| 三链 DEX 交易量折线图 | Solana / Base / BSC，近 30 日 |

**数据源：**
- CoinGecko（`/api/cg/markets`、`/api/cg/chart/:id`，经 Worker）
- DeFiLlama（`/api/llama/dex/:chain`，经 Worker）

**注：** CoinGecko 403 问题已通过 Worker 添加浏览器态 User-Agent 解决（INFRA-01c）。文件：`L3DetailPage.jsx`

### 6.6 F&G：情绪层

**作用：** 作为市场情绪辅助信号，补充环境判断。

**当前状态：**

- 已进入环境快扫层
- 已补充轻趋势图表达

**F&G 详细页（v6.0 新增）：**

| 模块 | 内容 |
|------|------|
| SVG 半圆仪表盘 | 当前指数 / 状态标签 |
| 历史对比 | 近 5 日指数列表 |
| 资金费率 | BTC-USDT-SWAP 当前资金费率 |
| 未平仓合约 OI | BTC 当前 OI（USD） |
| 多空比 | BTC 当前多空账户比 |

**数据源：**
- Alternative.me（`/api/fg`，经 Worker）
- OKX（`/api/funding`、`/api/oi`，经 Worker；替代原 Binance fapi）
- Binance Futures（`/api/ls-ratio`，经 Worker，多空比保留 Binance 端点）

文件：`FGDetailPage.jsx`

### 6.7 L4：存量与增量结构

L4 当前已明确拆成三种不同职责。

#### A. 存量观测站

**定位：** 主工作区，用于集中跟踪近期看好、准备建仓或已经有仓位的标的。

**当前字段：**

| 字段 | 说明 |
|------|------|
| Token | 代币名称 |
| 状态 | 观察中 / 准备建仓 / 已有仓位 |
| MCap | 市值 |
| 24h | 24 小时涨跌 |
| 7d | 7 日涨跌 |
| 1m | 1 个月涨跌 |
| V/MC | 换手活跃度 |
| 筹码集中度评分 | 健康 / 中性 / 集中 |
| 池子深度比 | 深 / 中 / 浅 |
| 备注 | 文本输入 |

**当前要求：**

- 保持主区稳定结构
- 不得为了补空白打散内部布局
- 在视觉上增强单行识别，但不改功能

#### B. Alpha Scanner

**定位：** 辅工作区，用于承接新增候选、初筛与研究。

**第一轮自动拉数边界：**

- 支持链：solana、bsc
- 输入主键：chain + token address
- 自动值只做支撑，不覆盖手动判断

**当前自动化状态：**

| 维度 | 状态 |
|------|------|
| momentum | 部分自动化已打通 |
| chips | BSC 当前为 not_supported |
| pool | 自动值第一轮暂缺，保留手动输入 |

#### C. Top 50 Meme 市场雷达

**职责：** 自动市场观察，用于横向扫市场热度、涨跌与成交节奏。

**当前状态：**

- 数据源：CoinMarketCap
- 当前仅做展示
- 不并入评分逻辑
- 当前为参考区

---

## 七、数据架构

### 7.1 Worker 路由表（v6.0 完整版）

**Worker 部署地址：** `https://liquidityos-data.fanfan09132022.workers.dev`

| 路由 | 上游数据源 | 缓存 TTL |
|------|----------|---------|
| `/api/fg?limit=N` | Alternative.me | 3600s |
| `/api/funding` | OKX 资金费率（BTC-USDT-SWAP） | 300s |
| `/api/oi` | OKX 未平仓合约（BTC-USDT-SWAP） | 300s |
| `/api/ls-ratio` | Binance Futures 多空比 | 300s |
| `/api/fred/:series` | FRED JSON API（`FRED_API_KEY` secret） | 86400s |
| `/api/cg/markets` | CoinGecko coins/markets | 300s |
| `/api/cg/chart/:coinId` | CoinGecko market_chart | 3600s |
| `/api/llama/dex/:chain` | DeFiLlama dexs overview | 1800s |
| `/api/llama/stablecoins` | DeFiLlama stablecoins | 1800s |
| `/api/llama/stable-chart` | DeFiLlama stablecoincharts/all | 1800s |
| `/api/llama/stable-chart/:chain` | DeFiLlama stablecoincharts/:chain | 1800s |

### 7.2 数据源变更记录（v5.0 → v6.0）

| 数据类型 | v5.0 方案 | v6.0 方案 | 变更原因 |
|---------|---------|---------|---------|
| 资金费率 / OI | Binance fapi（浏览器直连） | OKX（Worker 代理） | Binance fapi 浏览器 CORS 封锁 + Worker IP 封锁 |
| FRED 宏观数据 | FRED fredgraph.csv（浏览器直连） | FRED JSON API + API Key（Worker 代理） | CSV 端点 CORS 封锁 + Worker 服务端 520 |
| CoinGecko | 浏览器直连（不稳定） | Worker 代理 + 浏览器态 UA | 统一规范，消除不稳定性 |
| DeFiLlama | 浏览器直连 | Worker 代理 | 统一规范 |

### 7.3 前后端职责边界

**Cloudflare Worker 负责：**

- 所有外部数据请求（无例外）
- 服务端缓存（TTL 按数据更新频率分级）
- 统一返回结构

**前端负责：**

- 页面结构与交互
- 本地快照保存和历史读取
- 手动输入与展示逻辑
- 图表渲染（Chart.js / TradingView Widget）
- 浮动笔记面板的本地状态

---

## 八、详细数据页导航结构（v6.0 新增）

每张主页卡片包含「查看详情 →」入口，点击跳转对应独立路由页。

| 主页卡片 | 详细页路由 | 文件 |
|---------|---------|------|
| L0-B BTC 周期 | `/btc-detail` | `BTCDetailPage.jsx` |
| F&G 情绪 | `/fg-detail` | `FGDetailPage.jsx` |
| L3 Meme 板块 | `/l3-detail` | `L3DetailPage.jsx` |
| L2 稳定币 | `/l2-detail` | `L2DetailPage.jsx` |
| L1 净流动性 | `/l1-detail` | `L1DetailPage.jsx` |

**详细页设计原则：**

- 每张图表必须回答一个明确问题
- 数据不足时弱化图表，不弱化判断结论
- 详细页不承载操作功能，只承载信息深度
- 从详细页返回主页，主页状态保持不变
- 详细页是主页的纵深，不是主页的复制

---

## 九、快照与历史能力

**当前已实现：**

- 每日快照保存
- 按日期读取
- 近 30 天摘要
- dirty-save 保存边界
- 历史只读查看

**当前原则：**

- 历史查看不应误触发保存
- 缓存回填不应污染手动状态
- 更新成功后的最新数据不应被旧状态覆盖
- 浮动笔记不改变 `dailyNote` 本身的保存逻辑

---

## 十、页面级状态

### 10.1 当前已完成

**主控层：**

- Hero / L0-A / L0-B / Action Dock

**决策层：**

- L1 / L2 / L3 / F&G 已统一为环境快扫层
- 四张关键卡形成"左数值右趋势"的判断语言
- L1 维护区已改为按需展开，不再常驻主路径

**执行工作台：**

- 主区 / 辅区 / 参考区的角色已明确
- Top 50 已完成榜单表格化
- 存量观测站已增强单行视觉识别

**记录与诊断层：**

- 摘要与笔记已拆出为全局浮动便签，默认收起
- 底部区域重新定义为复盘与诊断层

**v6.0 新增完成项：**

- 五张详细数据页全量上线（L0-B / F&G / L3 / L2 / L1）
- Worker 全量数据代理（INFRA-01 系列完结）
- CoinGecko 403 问题修复（INFRA-01c，User-Agent 修复）
- Binance fapi → OKX 迁移完成
- FRED CSV → FRED JSON API 迁移完成

### 10.2 挂起 / 后置

- Top 50 图标资产缺失（上游问题，前端无法修复）
- L4 存量观测站局部布局调整（方向确认中）
- MVRV Z-Score 自动接入（Glassnode，后置）
- Alpha Scanner pool 自动值（GeckoTerminal 第一轮未完全打通）
- BOJ / 其他央行数据（L1 后置）
- L2 交易所储备趋势（后置）

---

## 十一、当前页面原则

- 图表必须回答问题，不能只是装饰
- 数据不足时，弱化图，不弱化判断
- 页面结构必须服从真实使用习惯，而不是先搭模块再塞内容
- 高频动作前置，低频维护后置
- 详细页是主页的纵深，不是主页的复制

---

## 十二、下一步方向（v6.0 之后）

**当前优先级评估中：**

1. 验证每日数据稳定性（当前阶段）
2. 根据实际使用习惯评估是否需要调整面板布局
3. 视情况推进整体 UI 布局优化

**当前不建议的方向：**

- 再加大量新功能
- 重写核心打分逻辑
- 同时大改业务层与 UI 层
- 在上游资产未补齐前继续纠缠 Top 50 图标

---

## 十三、非目标 / 后置项

- MVRV 自动接入（Glassnode）
- Alpha Scanner pool 自动值
- Top 50 榜单并入评分逻辑
- Top 50 图标资产扩展
- 多用户 / 登录系统
- 服务端数据库
- Git 自动构建部署流程
- 大规模新功能扩展

---

## 十四、声明

本项目仅用于个人研究、学习记录与内容创作，不构成任何投资建议。

---

*PRD v6.0 · @partrick2022 · LiquidityOS*
