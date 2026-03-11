# LiquidityOS

LiquidityOS 是一个面向个人使用的交易决策工作台，用于把宏观流动性分析、板块热度判断、Meme 资产观察、每日记录与历史回看整合进同一套工作流中。

它最初是一个内部工具原型，现已迁移为网页独立站 MVP，并完成核心主链路验证与第一轮页面级重构。

---

## 当前状态

**独立站 MVP 已上线。**

当前线上形态：

- 前端：Cloudflare Pages
- 数据接口：Cloudflare Worker

当前已确认通过的核心链路包括：

- 更新数据 / 强制更新 -> Worker 返回 -> 页面写入当天快照
- 缓存命中 -> 当天快照回填
- 切换历史日期 -> 只读历史快照 -> 切回今天恢复当日数据
- L1 自动数据 -> `/api/fred` -> `/api/all` -> 页面自动区展示
- Top 50 Meme 榜单 -> Worker 返回 -> 页面真实渲染
- Alpha Scanner 第一轮自动支撑数据 -> 部分打通且不污染手动判断

当前项目阶段可概括为：

> 独立站 MVP 已上线，核心闭环已完成，正在进入产品化打磨阶段。

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
L0：仓位约束层
L0-A：全球流动性周期
扩张
过渡
收缩
用于决定仓位偏进攻还是偏防守。

L0-B：BTC 周期位置
当前承载：

BTC 现价
24h 变化
BTC / 200MA
相对 200MA 偏离
MVRV Z-Score
其中：

BTC / 200MA / 偏离 已自动展示
MVRV Z-Score 当前为手动填写位，带数据日期、来源说明与外链入口
L1：全球净流动性
GNL = Fed - TGA - RRP
当前支持：

自动优先（FRED）
手动兜底
自动计算 GNL
数据日期 / 来源 / 更新时间展示
L1 自动链路当前已打通。

L2：稳定币弹药
用于判断场内总弹药与链上热钱主要聚焦在哪条链。

L3：Meme 板块热度
用于判断 Meme 板块整体是否进入高热或低迷状态。

L4：存量与增量结构
由三部分组成：

自动市场面板
Top 50 Meme 榜单
用于自动观察市场全貌和主要 Meme 资产分布
存量观测站
你主观重点跟踪的持仓 / 准持仓观察台
当前字段包括：
Token
状态（观察中 / 准备建仓 / 已有仓位）
MCap
24h / 7d / 1m
V/MC
筹码集中度评分
池子深度比
备注
Alpha Scanner
用于增量新机会筛选
当前为“标准化输入 + 自动支撑数据”结构
自动值不覆盖手动判断
当前页面结构
当前页面已经从单纯功能堆叠，重构为更清晰的四层结构：

A. 主控层
顶部操作区
当前数据状态
Hero 主控卡
L0-A + L0-B 仓位依据区
B. 决策层
L1
L2
L3
F&G
关键模块带轻趋势图
C. 执行工作台
左侧主区：存量观测站
右侧辅助区：Top 50 Meme 榜单 + Alpha Scanner
D. 记录与诊断层
历史回看
历史摘要
笔记
系统状态
当前已实现能力
核心决策层
L0-A 周期偏见选择
L1 自动 / 手动双模式
L2 / L3 / F&G / L4 / Hero 统一信号结构
Hero 综合信号展示
L0 / L1 作为仓位约束单独展示
数据与展示层
BTC / 200MA 自动展示
MVRV Z-Score 手动填写位
Top 50 Meme 榜单自动展示
L0-A / L1 解释文案补齐
L1 来源 / 数据日期 / 更新时间展示
L1 / L2 / L3 / F&G / BTC 轻趋势图
Alpha Scanner 标准化输入结构
快照与历史层
每日快照保存
按日期回看
近 30 天历史摘要
更新数据
强制更新
系统状态观测层
dirty-save 保存边界控制
Alpha Scanner 第一轮自动拉数现状
当前边界为：

momentum：部分自动化已打通
chips：链路边界已明确，BSC 为 not_supported
pool：自动值第一轮暂缺，继续保留手动输入
自动值不会污染手动判断，也不会写入 L4 打分逻辑
信息层升级与页面重构现状
信息层升级已完成
主要包括：

L0-A：新增简短解释文案
L1：新增解释文案与来源/日期/更新时间展示
BTC / 200MA：自动展示打通
Top 50 Meme 榜单：已切到 CoinMarketCap 主方案并成功显示真实数据
Alpha Scanner：由抽象标签升级为标准化输入 + 自动支撑数据框架
页面状态流修复：最新 Worker 数据不再被旧状态覆盖
页面级重构第一阶段已完成
主要包括：

主控层重构：Hero + L0-A + L0-B 进入同一视觉中心
决策带重构：L1 / L2 / L3 / F&G 形成统一决策带，并加入轻趋势图
L4 工作台重构：存量观测站成为主工作区，Top 50 降为辅助观察区，Alpha Scanner 退为增量机会区
项目结构
当前项目由文档、旧看板代码、Worker 数据层，以及独立站前端工作区共同组成。

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
补充说明：

dashboard/trading-dashboard.jsx：历史单文件看板实现
dashboard/worker/worker.js：Cloudflare Worker 数据聚合层
当前独立站 MVP 前端基于 Vite + React
运行时使用浏览器 localStorage 保存快照与历史
技术架构
前端
Vite
React
localStorage
部署
Cloudflare Pages（前端）
Cloudflare Worker（数据接口）
当前主要数据源
FRED：Fed / TGA / RRP / GNL
Binance：BTC 现价 / 历史价格 / 200MA
CoinMarketCap：Top 50 Meme 榜单
Birdeye：Alpha Scanner token 维度数据
GeckoTerminal：Alpha Scanner pool 数据（第一轮未完全打通）
Glassnode：MVRV 后续自动化规划
线上地址
前端
https://093499c4.liquidity-os-mvp.pages.dev
Worker
https://liquidityos-data.fanfan09132022.workers.dev
当前已知后置项
以下内容已明确后置，不属于当前 MVP 已完成范围：

MVRV 尚未接入 Glassnode 自动数据
Alpha Scanner 的 pool 自动值第一轮暂缺，继续保留手动输入
Alpha Scanner 自动值目前仅为辅助支撑，不参与自动改写最终判断
Top 50 Meme 榜单 当前仅做展示，未并入评分逻辑
移动端表格密度与交互体验仍有进一步优化空间
Pages 当前仍是本地构建后上传，尚未切换为 Git 自动构建流程
下一步方向
下一轮更适合继续保持小步迭代，优先级较高的方向包括：

继续打磨页面级 UI / 交互体验
完善移动端工作台可读性
后续再考虑：
MVRV 自动接入
Alpha Scanner pool 自动值
自动化部署流程完善
项目目标
LiquidityOS 同时服务于两个目标：

建立可重复执行的 Meme 币研判流程
沉淀交易框架，并支撑公开输出与持续学习
声明
本项目仅用于个人研究、学习记录与内容创作，不构成任何投资建议。

相关输出
Twitter：@partrick2022
