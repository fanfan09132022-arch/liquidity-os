# LiquidityOS 流动性仪表盘

基于 L0-L4 流动性框架的个人交易看板，用于在同一工作流内完成宏观判断、板块研判、个股筛选、每日记录与历史回看。

---

## 这个项目是什么

LiquidityOS 是一个面向个人使用的交易决策工具，目标是在每天较短时间内完成一套可重复执行的研判流程：

1. 先看宏观与流动性环境
2. 再看板块与链上弹药
3. 最后落到 Meme 个股层面的筛选与记录
4. 将当天判断保存为快照，便于后续复盘

项目同时承担两个用途：

- 作为个人交易工作台
- 作为公开输出交易框架与学习过程的底层工具

---

## 核心框架：L0-L4 流动性分析

框架逻辑是从宏观到微观逐层收敛，上层约束下层。

```text
L0 → 确定仓位上限和操作偏见（进攻 / 防守）
  ↓
L1 → 确认总流动性方向
  ↓
L2 → 确认稳定币弹药与链上战场
  ↓
L3 → 确认 Meme 板块整体热度
  ↓
L4 → 研判具体标的与当日操作
L0：仓位约束层
L0-A：全球流动性周期阶段

扩张
过渡
收缩
用于定义仓位偏见，不直接参与 Hero 平均分。

L0-B：BTC 周期位置

BTC 现价
24h 变化
BTC / 200MA
MVRV Z-Score
L1：全球净流动性
公式：

GNL = 美联储资产负债表 - TGA - RRP
支持两种模式：

FRED 自动读取
手动录入 Fed / TGA / RRP / 数据日期
L1 主要作为仓位约束和背景判断，不直接等同于进场信号。

L2：稳定币弹药
关注：

Total Stablecoin Market Cap
7 日净变化
Solana / ETH / BSC TVL
Solana / BSC 稳定币净流入（7d）
输出统一信号结构：

color
score
reason
L3：Meme 板块流动性
关注：

Meme 总市值
Meme 市值 24h 变化
Solana DEX 交易量变化
Base / BSC DEX 变化（辅助）
同样输出统一信号结构：

color
score
reason
L4：Meme 个股层
由两部分组成：

Watchlist

Token
MCap
24h%
7d%
Vol24h
V/MC
Alpha Scanner

筹码集中度
资金动量
池子强度
备注
L4 会基于存量与增量数据形成可解释分数，并输出：

color
score
reason
Hero 信号的定位
Hero 是系统综合信号，用于汇总：

L2
L3
F&G
L4
Hero 当前不直接纳入 L0 / L1 的平均分。

也就是说：

Hero 负责回答“环境是否偏强”
L0 / L1 负责回答“即使偏强，仓位是否该放大”
当前版本能力
当前 Beta 核心闭环已完成，已具备：

L0-A 周期偏见选择
L1 自动 / 手动双模式
L2 / L3 / F&G / L4 / Hero 统一信号结构
每日快照保存
按日期回看
近 30 天历史摘要
当日缓存优先读取
强制刷新
系统状态观测层
dirty-save 保存边界控制
Beta 验收结论
当前版本已完成 Beta 核心主链路验收。

已通过的关键链路包括：

日期切换
自动保存
缓存读取
今日与历史隔离
历史摘要与详情一致性
当前已确认成立的系统边界：

历史日期只读本地快照，不触发网络请求
缓存回填不会误触发保存
历史查看不会误触发保存
自动保存仅在真实编辑或网络刷新成功后触发
历史摘要与详情数据一致
对应提交：

f01694d
项目结构
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
    ├── docs/README.md
    └── twitter-sop.md
说明：

dashboard/trading-dashboard.jsx：主看板代码
dashboard/worker/worker.js：宏观数据聚合 Worker
docs/requirements-v3.0.md：当前主 PRD
docs/requirements-v1.1.md / v2.0.md：历史版本存档
当前技术方案
React JSX
Cloudflare Worker 聚合接口
AI 兜底抓取
window.storage 本地持久化
本地快照 + 按日期读取
当前数据获取策略为：

Worker 优先
AI 兜底
本地快照优先回填当日缓存
强制刷新绕过本地缓存
为什么做这个
这个项目服务于两个长期目标：

建立可重复执行的 Meme 币交易研判流程
沉淀个人交易框架，并作为公开输出内容的底层工具
它既是一个实用看板，也是一个持续迭代的学习工程。

下一步迭代方向
当前阶段不优先扩展大功能，后续更适合按小步迭代推进，例如：

更细粒度的错误分级
缓存 TTL 与失效策略
Worker 返回结构标准化
移动端交互优化
推文草稿生成能力增强
学习资源
Michael Howell / Capital Wars
Raoul Pal / Everything Code
Arthur Hayes
DefiLlama
CoinGecko
CryptoQuant
Alternative.me
相关输出
Twitter：@partrick2022
