# LiquidityOS 架构说明

## 一、这份文件的用途

这份文件用于描述：

- 当前真实运行时结构
- 当前主要运行层
- 关键页面与支持层的职责
- 哪些区域是高风险区域
- 修改架构时必须尊重的边界

这不是历史回顾文件。  
它只描述当前代码现实。

---

## 二、当前运行时 source of truth

当前 active integrated runtime 位于：

- `src/App.jsx`
- `src/styles.css`
- `src/main.jsx`

Worker 运行时仍位于：

- `dashboard/worker/worker.js`

不要把旧的 `dashboard/web/...` 误认为当前运行时 source of truth。

---

## 三、当前运行层

### 1. App Shell / 首页协调层

主协调文件：

- `src/App.jsx`

职责：

- 负责 app 级 page switching
- 按顺序渲染 homepage sections
- 负责 homepage → detail page 的入口连接
- 持有本地 workspace 状态
- 触发 refresh
- 协调 snapshot / history / notes
- 协调 theme state 和 UI-only interaction state

说明：

`src/App.jsx` 不是单纯布局文件，  
而是当前产品运行协调中心。

---

### 2. 共享视觉系统层

核心文件：

- `src/styles.css`

职责：

- 定义 light / dark theme 的 CSS variables
- 定义共享 surface / material / typography 规则
- 提供 dark-mode overrides
- 定义全局 transition / motion primitives
- 统一 Recharts 的视觉表现

说明：

视觉问题不应默认上升成架构问题。  
但对全局 token、shared surface 的改动要谨慎，因为影响范围广。

---

### 3. Detail Page 层

当前 detail pages 包括：

- `src/BTCDetailPage.jsx`
- `src/L1DetailPage.jsx`
- `src/L2DetailPage.jsx`
- `src/L3DetailPage.jsx`
- `src/FGDetailPage.jsx`

职责：

- 把首页 summary 扩展成 evidence-rich 视图
- 承担 chart-heavy 细节阅读
- 保留“summary card → detail page”的阅读模型

说明：

不要把 detail page 的证据密度重新塞回 homepage summary 层。

---

### 4. 共享支持层

支持文件：

- `src/config.js`
- `src/lib/api.js`
- `src/lib/storage.js`

职责：

- endpoint / runtime config
- fetch helpers
- storage abstraction

说明：

这些文件虽然不是视觉层，但会影响很多区域。  
除非包目标明确，否则不要顺手重构。

---

### 5. Worker 聚合层

Worker 文件：

- `dashboard/worker/worker.js`

职责：

- 聚合上游 macro / market 数据
- 对 homepage 和 detail pages 需要的 payload 做归一化
- 提供 refresh chain 所依赖的 endpoint

说明：

Worker 改动默认视为高风险。  
只有当 homepage macro integrity 直接受影响时，才考虑动它。

---

## 四、首页结构

### Top Frame

包含：

- sticky TopBar
- sticky LayerGateBar

当前 LayerGateBar 行为：

- click-to-scroll section navigation
- 通过 `IntersectionObserver` 高亮当前层
- 节点点击 pulse feedback
- link 动画确认
- 当上游 macro stack 不完整时，对 L4 做弱化显示

---

### `section-l0` Hero / Signal Wash

当前模型：

- Hero 不是大 boxed card
- 页面顶部由 `L0-A` 驱动 subtle `Signal Wash`
- Hero 内容透明、左对齐、compact、summary-first
- signal strip 独立于 Hero 内容区，而不是嵌在里面

包含：

- signal headline
- score
- summary chips
- L0-A cycle controls

---

### Signal Strip

位于 Hero 下方的独立 strip：

- 4 个小 signal lamps
- 位于 Hero 和 BTC Anchor 之间
- 使用 theme-aware glass surface

---

### `section-btc` BTC Anchor

位于 Hero 与 Market Context 之间的 full-width anchor card。

目的：

- 在进入 broader Bento layer 前，先让 BTC regime 作为锚点被看到

---

### `section-market` Market Context

当前结构：

- section header
- 紧凑型 Bento grid

当前卡片包括：

- `section-l1`
  - L1 compact insight card
  - 默认 summary-first
  - 可通过 `l1Expanded` 控制详细区域展开
- F&G compact card

重要说明：

- 当前 homepage Bento 区域里没有独立 standalone 的 L2 / L3 卡片
- LayerGateBar 仍支持 `L2` / `L3` 映射，但 scroll fallback 可能指向 `section-market`

---

### Market → L4 过渡层

位于 Market Context 与 L4 之间的 `LayerTransition` divider。

目的：

- 把 macro posture 平滑交接到 execution tone
- 在进入 L4 前提供可阅读的 handoff

---

### `section-l4` L4 Workbench

当前是双列 workspace：

- 左侧：watch / stock station
- 右侧：Alpha Scanner

当前 Alpha Scanner 行为：

- 有三个 candidate cards
- 默认折叠
- 点击后渐进展开
- 打开 / 关闭时保留已有 scoring state

---

### `section-review` Review & Diagnostics

当前包含：

- saved records
- diagnostics / notes / review-oriented surfaces

---

## 五、导航模型

当前 app 仍采用：

**集中式 page switching inside `src/App.jsx`**

而不是 router migration。

这意味着：

- detail-page entries 由 homepage shell 持有
- 修改 `src/App.jsx` 时，导航正确性属于高风险区域

---

## 六、数据流

当前典型路径：

1. homepage 触发 refresh
2. frontend 拉取 Worker-backed macro payload
3. Worker 聚合并归一化上游数据
4. homepage summary sections 完成 hydration
5. 用户进入 detail pages
6. notes / snapshots 通过 storage helpers 读写

---

## 七、图表架构说明

当前 detail-chart 层的现实：

- L1 / L2 / L3 detail pages 使用 Recharts
- 已形成更平静一致的 shared styling
- 多线 / summary 型图表上已经加入 end labels 和 narrative annotations
- `FGDetailPage` 不在 `CHART-02` 范围内，因为它是单线场景，需求不同

---

## 八、架构护栏

必须保护：

- homepage → detail-page wiring
- Worker 改动必须最小且有明确理由
- calculation functions 不要随意重写
- storage / snapshot 行为属于核心产品能力
- 不要把旧分支历史误判为当前 runtime 架构

---

## 九、默认架构判断原则

遇到改动需求时，默认先问：

1. 这是 UI 层问题，还是运行时协调层问题？
2. 能不能只改局部 page / component，而不动 `src/App.jsx`？
3. 能不能不碰 Worker？
4. 能不能不碰 storage / refresh chain？
5. 这个改动会不会破坏“summary → detail”的阅读模型？

如果答案不清楚，先缩包，再改。