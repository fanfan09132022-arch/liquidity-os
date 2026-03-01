# LiquidityOS 流动性仪表盘

> 用四层流动性框架做 Solana Meme 交易决策的个人工具 | 学习记录

## 这个项目是什么

一个个人交易看板，帮助我在每天 30 分钟内完成从宏观分析到个股研判的完整决策流程，最终输出推文草稿。

核心框架：**四层流动性分析**
- **L1 宏观流动性**：Global Net Liquidity，美联储资产负债表决定市场水位
- **L2 稳定币购买力**：USDT 市值趋势，真正的子弹数量
- **L3 链上热钱流向**：Solana / BSC / Base 资金分布
- **L4 Meme个股流动性**：恐惧贪婪指数，判断群体心理位置

## 为什么做这个

我是一个正在学习宏观交易框架的散户。这个项目同时服务于两个目标：
1. 建立可重复执行的 Meme 币研判流程
2. 记录学习过程，在推特 [@partrick2022](https://twitter.com/partrick2022) 持续输出内容

## 项目结构
```
liquidity-os/
├── README.md                    ← 你现在看的这个
├── dashboard/
│   └── trading-dashboard.jsx   ← 看板主体代码（React）
└── docs/
    ├── requirements-v1.1.md    ← 产品需求文档
    └── twitter-sop.md          ← 推特内容发布 SOP
```

## 开发进度

- [x] V1：基础研判看板（四维评分 + 推文草稿生成）
- [x] 热榜抓取（Claude AI + Web Search 驱动）
- [ ] V2：四层流动性指标模块（开发中）
- [ ] V2：Meme 战壕（三链热点币 + 持仓结构分析）
- [ ] V3：Notion 归档 + 研判准确率统计

## 技术栈

- React JSX（运行在 Claude.ai Artifacts 环境）
- Anthropic API + Web Search（实时数据抓取）
- window.storage（数据持久化）

## 学习资源

- Michael Howell《Capital Wars》
- Raoul Pal「Everything Code」框架
- Arthur Hayes Substack

---

*每日研判输出：[@partrick2022](https://twitter.com/partrick2022)*
