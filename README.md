# LiquidityOS

LiquidityOS 是一个面向个人使用的交易决策看板，用于将宏观流动性分析、板块热度判断、Meme 资产观察、每日记录与历史回看整合进同一套工作流中。

它最初是一个内部工具原型，现已迁移为网页独立站 MVP，并完成核心主链路的线上验证。

---

## 当前状态

**独立站 MVP 已上线。**

当前线上形态：

- 前端：Cloudflare Pages
- 数据接口：Cloudflare Worker

当前已确认通过的核心链路包括：

- 强制刷新 -> Worker 返回 -> 页面写入当天快照
- 读取缓存 -> 命中当天快照 -> 页面回填
- 切换历史日期 -> 只读历史快照 -> 切回今天恢复当日数据

当前项目阶段可概括为：

> Beta 核心闭环已完成，并已迁移为可访问的网页独立站 MVP。

---

## 核心框架：L0-L4 流动性分析

LiquidityOS 的核心逻辑是从宏观到微观逐层过滤，上层信号约束下层操作。

```text
L0 → 确定仓位上限和操作偏见（进攻 / 防守）
  ↓
L1 → 确认总流动性方向
  ↓
L2 → 确认稳定币弹药与链上战场
  ↓
L3 → 确认 Meme 板块整体热度
  ↓
L4 → 观察存量结构与增量机会，形成最终交易判断
------
L0：仓位约束层
L0-A：全球流动性周期

扩张 / 过渡 / 收缩
用于决定仓位偏进攻还是偏防守
L0-B：BTC 周期位置

BTC 现价
24h 变化
BTC / 200MA
MVRV（当前仍以外链/后续自动化为主）

L1：全球净流动性：GNL = Fed - TGA - RRP
当前支持：

自动优先（FRED）
手动兜底
自动计算 GNL
数据日期 / 来源 / 更新时间展示框架

L2：稳定币弹药
用于判断场内总弹药与链上热钱主要聚焦在哪条链。

L3：Meme 板块热度
用于判断 Meme 板块整体是否进入高热或低迷状态。

L4：存量与增量结构
由两部分构成：

存量观测站

自动 Top 50 Meme 榜单
手动 watchlist 并存
Alpha Scanner

标准化数据输入
判断展示结构
为后续自动化接入预留接口
------
**当前已实现能力**
当前版本已完成以下能力：

核心决策层
L0-A 周期偏见选择
L1 自动 / 手动双模式
L2 / L3 / F&G / L4 / Hero 统一信号结构
Hero 综合信号展示
L0 / L1 作为仓位约束单独展示

数据与展示层
BTC / 200MA 自动展示
Top 50 Meme 榜单自动展示
L0-A / L1 解释文案补齐
Alpha Scanner 标准化输入结构

快照与历史层
每日快照保存
按日期回看
近 30 天历史摘要
强制刷新
读取缓存
系统状态观测层
dirty-save 保存边界控制
------
**信息层升级现状**
本轮信息层升级已完成并通过关键验证，主要包括：

L0-A：新增简短解释文案
L1：新增解释文案与来源/日期/更新时间展示框架
BTC / 200MA：完成自动展示
Top 50 Meme 榜单：已切到 CoinMarketCap 主方案并成功显示真实数据行
Alpha Scanner：从抽象标签升级为标准化输入 + 判断展示
页面状态流修复：强制刷新后最新 Worker 数据不会再被旧状态覆盖
------
**当前项目结构**
当前项目由前端独立站和 Worker 数据层两部分组成。
liquidity-os/
├── README.md
├── dashboard/
│   ├── trading-dashboard.jsx
│   └── worker/
│       └── worker.js
└── docs/
    ├── requirements-v1.1.md
    ├── requirements-v2.0.md
    ├── requirements-v3.0.md
    └── twitter-sop.md
独立站 MVP 前端当前基于 Vite + React 构建，运行时使用浏览器 localStorage 保存快照与历史。
------
**技术架构**
前端
Vite
React
localStorage
部署
Cloudflare Pages（前端）
Cloudflare Worker（数据接口）
当前主要数据源
FRED：Fed / TGA / RRP
Binance：BTC 现价 / 历史价格 / 200MA
CoinMarketCap：Top 50 Meme 榜单
Birdeye / GeckoTerminal：Alpha Scanner 后续自动化规划
Glassnode：MVRV 后续自动化规划
------
**线上地址**
前端
https://093499c4.liquidity-os-mvp.pages.dev
Worker
https://liquidityos-data.fanfan09132022.workers.dev
------
**当前已知后置项**
以下内容已明确后置，不属于当前 MVP 已完成范围：

FRED_API_KEY 尚未完成配置，L1 自动宏观数据尚未完全打通
MVRV 尚未接入 Glassnode 自动数据
Alpha Scanner 尚未接入 Birdeye / GeckoTerminal 自动拉数
Top 50 Meme 榜单 当前仅做展示，未并入评分逻辑
移动端表格密度与交互体验尚未专项优化
Pages 当前为本地构建后上传，尚未切换为 Git 自动构建流程
------
**下一步方向**
下一轮更适合继续保持小步迭代，优先级最高的下一项是：

配置 FRED_API_KEY，打通 L1 自动数据闭环
之后再考虑：

MVRV 自动接入
Alpha Scanner 自动数据接入
移动端优化
自动化部署流程完善
------
**项目目标**
LiquidityOS 同时服务于两个目标：

建立可重复执行的 Meme 币研判流程
沉淀交易框架，并支撑公开输出与持续学习

**声明**
本项目仅用于个人研究、学习记录与内容创作，不构成任何投资建议。

相关输出
Twitter：@partrick2022
