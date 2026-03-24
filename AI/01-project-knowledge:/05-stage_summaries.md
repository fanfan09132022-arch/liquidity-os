# Stage Summaries

## 一、这份文件的用途

这份文件用于压缩记录当前项目已经走过的主要阶段。

它不是完整 changelog，也不是任务清单。
它只回答：

- 这个产品是怎么走到现在这一步的
- 哪些阶段已经落地
- 当前阶段主要卡在哪里
- 下一步默认应该看什么

---

## 二、阶段记录

### Stage 1 · 单体工作台成型

#### 目标

先把个人交易工作台主流程做出来。

#### 发生了什么

- `src/App.jsx` 逐步承载了首页、工作台、观察列表、Alpha 决策等核心逻辑
- 本地状态、交互和多块 UI 在单体文件中快速沉淀

#### 状态

- 已完成

---

### Stage 2 · Detail Page 证据层建立

#### 目标

让产品不只停留在 summary，而是具备更深证据层。

#### 发生了什么

- 新增 `BTCDetailPage`、`L1DetailPage`、`L2DetailPage`、`L3DetailPage`、`FGDetailPage`
- 首页 / 工作台开始具备进入 detail 的路径

#### 产品影响

- 产品形成了“summary -> evidence”的阅读结构

#### 状态

- 已完成

---

### Stage 3 · Worker 聚合与共享数据路径

#### 目标

减少不同页面各自拉数据造成的割裂。

#### 发生了什么

- `src/lib/api.js` 成为前端 Worker 请求入口
- `/api/all` 成为宏观聚合 payload 的核心路径
- `useWorkerData` 建立共享轮询层

#### 产品影响

- Dashboard 与多个页面开始共享一套宏观数据源

#### 状态

- 已完成

---

### Stage 4 · 路由化外壳建立

#### 目标

从单页切换过渡到真实 URL 路由。

#### 发生了什么

- 接入 React Router v6
- 新增独立 page：
  - `Dashboard`
  - `L0MacroPage`
  - `L1LiquidityPage`
  - `L2StablecoinsPage`
  - `L3MemeSectorPage`
  - `L4WorkbenchPage`
- `/fg` 作为单独路由保留

#### 产品影响

- 产品从“单页工作台”升级为“多页面 SPA”

#### 状态

- 已完成

---

### Stage 5 · 共享组件与导航统一

#### 目标

让新页面不再各自为政。

#### 发生了什么

- 引入 `TabBar`
- 抽取共享 `NewsStrip`
- 引入共享小组件如 `MetricBlock`、`SignalBadge`、`SparkLine`

#### 产品影响

- 页面间视觉语言和导航方式更统一

#### 状态

- 已完成

---

### Stage 6 · L4 Workbench 多轮增强

#### 目标

把 L4 从占位区提升为真正的执行层。

#### 发生了什么

- Meme Radar 增强
- `+ Alpha` / `+ Watch` 快捷入口
- Watch Station 体验修复
- Alpha 决策记录与统计增强
- 每日简报、复制反馈、刷新反馈、Banner 等逐步补齐

#### 产品影响

- L4 已从概念区块变成主要工作区

#### 状态

- 已完成第一轮主要增强

---

### Stage 7 · AppStateProvider Phase A / B

#### 目标

开始把部分共享状态从单体组件向 context 迁移。

#### 发生了什么

- 新增 `AppStateProvider`
- 迁入部分 Meme Radar、展开状态、自动刷新状态等共享状态

#### 产品影响

- 为后续状态解耦做了第一阶段铺垫

#### 状态

- 已完成到 Phase A / B

---

### Stage 8 · 当前阶段：稳定化与补验证

#### 目标

在已有功能基础上收口风险，而不是继续扩张。

#### 已知现实

- 当前 `npm run build` 可通过
- 路由和页面外壳已形成
- 仍有浏览器级验证缺口
- 高风险状态迁移尚未进入 Phase C 执行

#### 当前主要关注点

- 页面级 runtime bug
- 浏览器白屏和交互回归
- Worker 字段与页面接线正确性
- 尽量不扩大结构性改动

#### 状态

- 进行中

---

## 三、当前阶段不应误判的事

不要把现在理解成：

- 待重启的一次大规模架构重写
- 待全面路由迁移的未完成原型
- 待无限扩展数据源的研究平台

更准确的理解是：

**核心产品已经成型，当前主要工作是把它修准、补稳、补验证。**

---

## 四、下一步默认关注

默认下一步优先看：

1. `PROJECT_STATUS.md`
2. `RESULTS_INDEX.md`
3. 各页面实际浏览器表现
4. `AppStateProvider` 与 `src/App.jsx` 的边界
5. Worker 数据字段与页面使用方是否一致
