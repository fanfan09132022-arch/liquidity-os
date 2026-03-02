# LiquidityOS 流动性仪表盘

用四层流动性框架做 Solana Meme 交易决策的个人工具 | 学习记录

---

## 这个项目是什么

一个个人交易看板，帮助我在每天 20 分钟内完成从宏观分析到个股研判的完整决策流程，最终输出推文草稿。

---

## 核心框架：五层流动性分析（含 L0）

框架的整体逻辑是**从宏观到微观逐层过滤**，上层是下层的前提条件。
```
L0 → 确定仓位上限和操作偏见（进攻/防守）
  ↓
L1 → 确认流动性方向，判断信号链走到哪一步
  ↓
L2 → 确认弹药到位，战场聚焦在哪条链
  ↓
L3 → 确认 Meme 板块整体热度
  ↓
L4 → 研判具体标的，做出进出场决策
```

**L0 宏观周期定位（框架的框架）**
- L0-A：全球流动性大周期阶段（Howell 65 个月周期：扩张期 / 见顶区 / 收缩期）
- L0-B：BTC 周期位置（BTC 现价 / 200 日均线比率 + MVRV Z-Score）

**L1 全球净流动性**
- Global Net Liquidity = 美联储资产负债表 − TGA 账户余额 − 逆回购（RRP）余额
- 关注动量（增速），不是绝对值
- ⚠️ 时滞警告：L1 领先 BTC 约 13 周，需标注"已持续第几周"

**L2 稳定币弹药**
- Solana vs ETH vs BSC TVL（总量）—— 总流动性参考
- Total Stablecoin Market Cap 7 日净变化 —— 总流动性参考
- Solana / Base / BNBChain 链上稳定币净流入（7 日）—— 判断战场在哪条链

**L3 Meme 板块流动性**
- Meme 币总市值
- 新币发射数量变化（7 日）

**L4 Meme 个股流动性**
- 持仓结构 / LP 比例 / 换手率 / 聪明钱动向（GMGN）

---

## 为什么做这个

我是一个正在学习宏观交易框架的散户。这个项目同时服务于两个目标：

1. 建立可重复执行的 Meme 币研判流程
2. 记录学习过程，在推特 [@partrick2022](https://twitter.com/partrick2022) 持续输出内容

---

## 项目结构
```
liquidity-os/
├── README.md
├── dashboard/
│   └── trading-dashboard.jsx     ← 看板主体代码（React，V1）
└── docs/
    ├── requirements-v1.1.md      ← PRD 旧版（已废弃，仅存档）
    ├── requirements-v2.0.md      ← PRD 当前正式版（v2.1）
    ├── twitter-sop.md            ← 推特内容发布 SOP
    └── 四层流动性框架 理论补全 2026.03.02  ← 框架理论梳理文档
```

---

## 开发进度

- ✅ V1：基础研判看板（四维评分 + 推文草稿生成）
- ✅ V1：热榜抓取（Claude AI + Web Search 驱动）
- ✅ 框架理论补全（L0 新增 / L2 修正 / 时滞说明）
- ✅ PRD v2.1 定稿
- 🔲 V2 Phase 1：宏观信号仪表盘（L0-L3 指标 + 信号灯 + 持久化）
- 🔲 V2 Phase 2：Meme 板块热点币抓取
- 🔲 V2 Phase 3：完整研判卡 + 推文草稿升级
- 🔲 V2 Phase 4：历史回顾 + 移动端打磨

---

## 技术栈

- React JSX（运行在 Claude.ai Artifacts 环境）
- Anthropic API + Web Search（实时数据抓取）
- window.storage（数据持久化）

---

## 学习资源

- Michael Howell《Capital Wars》Substack
- Raoul Pal「Everything Code」框架（Real Vision）
- Arthur Hayes Substack
- DefiLlama（稳定币 / TVL 数据）
- CryptoQuant（MVRV Z-Score）

---

每日研判输出：[@partrick2022](https://twitter.com/partrick2022)
