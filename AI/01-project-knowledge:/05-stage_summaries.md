# Stage Summaries

## 一、这份文件的用途

这份文件用于压缩记录当前 integrated preview 的开发阶段历史。

它不是完整 changelog。  
它只回答四个问题：

- 这个产品是怎么一步步变成现在这个样子的
- 哪些阶段已经完成
- 哪些方向已经明确不再重开
- 当前阶段下一步该聚焦什么

---

## 二、阶段记录

### Stage 1 · 从 Summary Card 到 Detail Page 模型

#### 目标

让产品不再只是 homepage-only dashboard，建立更深证据层的阅读模式。

#### 发生了什么

- 引入独立 detail-page shell
- homepage 开始通过 app-level page switching 打开 detail pages
- BTC 成为第一个真实 detail page

#### 产品影响

- 产品开始有“分层阅读路径”

#### 状态

- 已完成

---

### Stage 2 · 决策层 Detail 扩展

#### 目标

把 detail-page 模型扩展到整个决策栈。

#### 发生了什么

新增：

- `src/L1DetailPage.jsx`
- `src/L2DetailPage.jsx`
- `src/L3DetailPage.jsx`
- `src/FGDetailPage.jsx`

并在 `src/App.jsx` 中接入 homepage entry points。

#### 产品影响

- homepage 成为 summary layer
- detail pages 成为 evidence layer

#### 状态

- 已完成

---

### Stage 3 · 共享数据 / Worker 稳定化

#### 目标

避免 homepage 与 detail pages 各自形成不一致的 fetch path。

#### 发生了什么

- 引入 shared config / fetch helpers
- Worker aggregation 成为 homepage macro hydration 的骨干
- `/api/all` 成为 integrated homepage payload

#### 产品影响

- app 恢复了连贯的 refresh / data path

#### 状态

- 对当前 preview 来说已足够完成

---

### Stage 4 · Unified Preview Branch

#### 目标

结束“homepage 线”和“detail-page 线”分裂的问题。

#### 发生了什么

- `codex/full-preview` 成为 integrated preview branch
- 根目录 Vite app 成为 active runtime truth

#### 产品影响

- 一条分支即可代表当前真实本地产品

#### 状态

- 已完成

---

### Stage 5 · Homepage 重构基础

#### 目标

让 homepage 从“杂乱卡片堆叠”变成真正的 trading workspace。

#### 发生了什么

- 建立 CSS-variable visual system
- 加强 typography / surface hierarchy
- 引入 sticky TopBar 和 LayerGateBar
- 确定 floating dock 方向
- 清理 decision-layer 结构

#### 产品影响

- homepage 变得可以作为系统整体扫描

#### 状态

- 已完成

---

### Stage 6 · Hero 方向重置

#### 目标

纠正早期 Hero 方向，不再把 Hero 当成巨大的彩色卡片。

#### 发生了什么

- 早期 boxed / full-bleed Hero 方案被探索、审查、淘汰
- 最终接受的方向变成 `HERO-03 Signal Wash`

#### 最终结果

- 页面顶部使用 page-level tint wash
- Hero 内容透明
- Hero 更紧凑、左对齐、summary-first

#### 状态

- 已完成
- 注：更早的 Hero 包仅是历史，不是当前方向

---

### Stage 7 · LayerGateBar 成为真实导航

#### 目标

把 layer strip 从静态装饰升级成真实导航 / 控制层。

#### 发生了什么

- `NAV-01`
- 增加 section IDs
- 增加 click-to-scroll
- 增加 active-layer highlighting
- 增加 pulse + flowing link 动画
- 当早层不完整时，对 L4 做 de-emphasis

#### 产品影响

- 用户可以按 layer 导航，而不是盲目滚动

#### 状态

- 已完成

---

### Stage 8 · Bento 压缩与层间交接

#### 目标

缩短 Market Context 高度，让进入 L4 的过程更明确。

#### 发生了什么

- `BONE-01`
  - L1 卡默认折叠为 summary 模式
- `BONE-02`
  - 增加 Market → L4 的 transition divider

#### 产品影响

- 更 scan-first
- 在进入 execution 层前有更清楚的 handoff

#### 状态

- 已完成

---

### Stage 9 · Alpha Scanner 渐进展开

#### 目标

避免 L4 一开始就出现三个完全展开的大表单卡片。

#### 发生了什么

- `CARD-01`
- Alpha Scanner cards 默认折叠
- 每个卡片可独立展开
- 在完全展开前，先用 summary dots 暴露维度状态

#### 产品影响

- L4 更短、更平静、更容易进入

#### 状态

- 已完成

---

### Stage 10 · FLOW-01 决策

#### 目标

判断 `FLOW-01` 是否真的需要执行。

#### 结论

- `FLOW-01` 已被明确判断为当前阶段不需要执行

#### 状态

- 有意不执行

---

### Stage 11 · Detail 图表语言升级

#### 目标

让 detail charts 更像分析工具，而不是原始图表库默认样式。

#### 发生了什么

- `CHART-02`
- L1 Fed/TGA/RRP chart 增加 end labels
- L1 GNL extrema annotations
- L2 multi-line end labels
- L2 total stablecoin direction annotation
- L3 DEX end labels 与方向提示

#### 产品影响

- detail pages 能更快表达“当前状态”

#### 状态

- 已完成

---

### Stage 12 · Integrated Polish Pass

#### 目标

补掉最后一段 spacing、readability、dark mode、motion 的差距。

#### 当前状态

- 当前 working tree 中存在 `POLISH-01`
- 这是实际本地进展
- 但在验证和提交前，不应直接算成已完成阶段

#### 状态

- 进行中

---

## 三、当前阶段总结

当前产品已经完成从：

- homepage-only dashboard
- 到 layered reading product
- 再到 integrated preview workspace

的关键转变。

因此当前不应默认进入：

- 架构重开
- 大范围数据扩张
- 历史方向复活

当前正确阶段应理解为：

- polish
- correctness
- reviewability
- bounded improvement

---

## 四、下一位 AI 应牢记的历史结论

必须记住：

- `codex/full-preview` 才是当前真实集成产品线
- root-level Vite app 才是当前 active runtime
- `HERO-03` 是已接受方向，不要复活早期 Hero 方案
- LayerGateBar 已经是实际导航，不是装饰
- 当前不是 router migration 阶段
- 当前不是 broad worker rewrite 阶段
- `FLOW-01` 当前已明确不执行

---

## 五、一句话阶段结论

这个项目当前最重要的不是“再决定产品长什么样”，  
而是：

**在已接受的产品结构上，把最后一段质量、正确性和可审查性做稳。**
