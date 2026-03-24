# LiquidityOS 项目定义

## 一、这份文件的用途

这份文件用于定义当前产品是什么、当前不是什么，以及下一位 AI / 开发者进入项目时最先该理解什么。

它不是完整 changelog，也不是任务列表。
它是当前产品层面的项目定义。

---

## 二、当前产品定位

LiquidityOS 当前更接近：

**一个面向个人加密交易决策的分层研究与执行工作台**

核心特征：

- Dashboard 负责快速建立全局判断
- L0-L3 负责宏观到板块的证据阅读
- L4 Workbench 负责个人执行动作
- DetailPage 负责提供更深一层证据

这个产品不是单纯资讯站，也不是泛化的数据门户。

---

## 三、当前产品不是什么

当前阶段默认不是以下方向：

- 多用户 SaaS
- 登录 / 权限 / 团队协作系统
- 为迁移而迁移的重型路由重做
- 无明确收益的大范围 Worker 重写
- 无明确边界的新数据源扩张工程

如果某个请求自然滑向这些方向，默认先收缩 scope。

---

## 四、当前 source of truth

当前产品理解应优先基于：

- 当前代码本身
- `PROJECT_STATUS.md`
- `DESIGN.md`
- `RESULTS_INDEX.md`

当前代码基线事实：

- 分支：`main`
- 主运行时：根目录 Vite + React app
- 路由入口：`src/main.jsx`
- L4 主核心：`src/App.jsx`
- 样式主入口：`src/styles.css`

不要默认把旧分支、旧目录或旧 README 当成当前产品现实。

---

## 五、当前用户流

当前主用户流应理解为：

1. 进入 Dashboard，快速看市场综合状态
2. 按 `L0 -> L3` 阅读宏观、流动性、稳定币、Meme 板块证据
3. 在 DetailPage 中下钻看更细图表与快讯
4. 进入 `L4 /workbench` 处理观察、筛选和决策
5. 记录 watch / alpha / brief 等个人执行信息

也就是说：

- `Dashboard` 是入口层
- `L0-L3` 是分析层
- `L4` 是执行层

---

## 六、当前产品现实

当前项目要默认接受这些现实：

- 这是一个多页面 SPA，而不是单页原型
- `Dashboard` 与 `L0-L3` 已有独立 page 外壳
- `L4 /workbench` 仍主要依赖大体量 `src/App.jsx`
- 外部数据主要由 Cloudflare Worker 提供
- 部分浏览器端第三方请求仍存在
- localStorage 仍参与部分用户数据持久化

当前已存在的页面路由：

- `/`
- `/macro`
- `/liquidity`
- `/stablecoins`
- `/meme`
- `/workbench`
- `/fg`

---

## 七、当前已完成的重要能力

当前产品方向中，以下能力已经是现实，而不是概念：

- React Router v6 路由层
- Dashboard 首页总览
- L0-L4 页面骨架
- 共享 `TabBar`
- 共享 `NewsStrip`
- 共享 `useWorkerData`
- Meme Radar / Alpha / Watch 的一轮主要工作流
- DetailPage 基础导航与快讯接线

---

## 八、当前仍未完成的重点

当前未完成但重要的事项包括：

- `AppStateProvider` Phase C 尚未推进
- `watchlist` / `alphaCards` / `alphaDecisions` 仍是高风险状态区域
- 多处新交互缺少系统化浏览器回归
- 部分 Worker endpoint 缺少全面线上联调验证

这意味着当前阶段更适合：

- 修正确性
- 补浏览器验证
- 控制结构性改动

而不是继续铺大新功能面。

---

## 九、下一阶段默认目标

下一阶段默认目标应是：

1. 小范围 correctness 修正
2. 页面级白屏 / runtime bug 修复
3. reviewability 提升
4. 交互细节收尾
5. 保护已经工作的运行时结构

---

## 十、给下一位 AI 的第一动作

如果你是新接手这个项目的 AI，请先：

1. 读取 `PROJECT_STATUS.md`
2. 读取 `DESIGN.md`
3. 查看 `src/main.jsx`
4. 查看 `src/App.jsx`
5. 查看当前任务相关 page / detail / lib 文件

默认不要先发明新架构。
默认先理解当前真实产品，再决定最小改动路径。
