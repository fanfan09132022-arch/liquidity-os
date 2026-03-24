# AGENTS.md

## 这份文件的用途

这是当前项目给执行型 AI 的入口规则。

它的目标不是重复完整背景，而是让进入项目的 AI 先对齐以下事实：

- 当前真实运行时是什么
- 当前项目已经做到哪一步
- 哪些区域风险高
- 默认应该怎么执行、验证、回传

如果旧文档与当前代码冲突，优先相信：

1. 当前代码
2. `PROJECT_STATUS.md`
3. `DESIGN.md`
4. `package-results/` 与 `RESULTS_INDEX.md`

---

## 一、当前项目现实

截至 `2026-03-23`，默认按以下现实执行：

- 仓库路径：`/Users/partrick/Desktop/Playground`
- 当前分支：`main`
- 当前主运行时：根目录 Vite + React 18 单仓前端
- 路由：React Router v6
- 主样式入口：`src/styles.css`
- 主工作台核心：`src/App.jsx`
- 外部数据主入口：Cloudflare Worker
- Worker 默认地址：`https://liquidityos-data.fanfan09132022.workers.dev`

当前已确认存在的页面路由：

- `/`
- `/macro`
- `/liquidity`
- `/stablecoins`
- `/meme`
- `/workbench`
- `/fg`

当前代码结构不是全量模块化完成态，而是：

- `Dashboard` + `L0` 到 `L3` 已拆成独立 page
- `L4 /workbench` 仍主要复用巨型单体 `src/App.jsx`
- 全局状态迁移只完成到 `AppStateProvider` Phase A / B
- `watchlist` / `alphaCards` / `alphaDecisions` 仍属高风险未完全迁移区域

不要再把这个项目默认理解成：

- 旧的多目录 dashboard runtime
- 待进行的大规模 router migration
- 可随意推进的架构重做项目

---

## 二、当前交付状态

根据 `PROJECT_STATUS.md` 与当前代码，项目已完成：

- Dashboard 首页与 L0-L4 基础路由
- 共享 `TabBar`、`NewsStrip`、`useWorkerData`
- 多个 Worker 字段修复与端点补充
- L4 Workbench 多轮功能增强
- 5 个 DetailPage 接入共享快讯条

当前已知现实：

- `npm run build` 可通过
- 本地开发服务可正常启动
- `/stablecoins` 曾有 `CHART_HEIGHT is not defined` 白屏问题，已在当前基线修复
- 仍存在浏览器级回归缺口，不应假设所有页面都已完整手工验证

---

## 三、进入项目后的默认动作

开始工作前，优先读取：

1. `PROJECT_STATUS.md`
2. `DESIGN.md`
3. `RESULTS_INDEX.md`
4. 与当前任务直接相关的代码文件

如任务明确来自 `AI/` 内流程，再按需补读：

5. `AI/README.md`
6. `AI/01-project-knowledge/*`
7. `AI/02-control-layer/*`
8. `AI/03-skills/custom/01-执行结果汇报官.md`

不要先泛读整个 `AI/` 目录。先对齐当前代码和当前状态。

---

## 四、你的角色

你是执行 AI，不是默认的产品经理或架构改写者。

你的职责：

- 在当前任务边界内完成实现
- 尽量选择最小改动路径
- 保持现有运行时稳定
- 做最小必要验证
- 回传可审查、可交接的结果

你的默认目标不是：

- 自行升级需求
- 顺手做架构重整
- 把局部 bug 修成大规模重构
- 把 polish 任务扩成数据层或路由层改造

---

## 五、执行总原则

### 1. 包外不做

如果当前任务有明确包边界，只做包内目标。

不要：

- 顺手修 unrelated 区域
- 顺手统一风格
- 顺手重命名或重构
- 顺手扩数据源
- 顺手继续 Phase C 状态迁移

### 2. 最小改动优先

优先选择：

- 最少文件
- 最小 diff
- 最低副作用
- 最容易 review 的实现方式

### 3. 根因优先

如果是 bug fix：

- 优先修根因
- 不要只盖症状
- 根因不明时，先说明再决定是否继续

### 4. 保持结构现实

当前项目允许“新 page 外壳 + 老 workbench 核心”并存。

因此默认不要主动做：

- 拆 `src/App.jsx` 大手术
- 强推全量 context migration
- 改写所有 detail page 接口
- 重做 Worker 数据协议

### 5. 验证是完成定义的一部分

代码改完不等于完成。

至少要做和当前改动匹配的最小验证。

---

## 六、项目专属护栏

### 默认高风险文件

以下文件默认高风险，改动时要收敛范围并在回传中说明：

- `src/App.jsx`
- `src/styles.css`
- `src/config.js`
- `src/lib/api.js`
- `src/lib/storage.js`
- `src/context/AppStateProvider.jsx`
- `dashboard/worker/worker.js`

### 默认高风险主题

以下主题默认不主动展开，除非任务明确要求：

- AppStateProvider Phase C
- localStorage key 迁移
- Worker 协议扩张
- detail page 全量重构
- 路由体系再拆分
- Dashboard 与 Workbench 的统一架构重写

### 处理脏工作区

当前仓库可能处于脏工作树。

因此：

- 不要回退你未创建的改动
- 不要假设未提交文件无效
- 若发现冲突但非当前任务直接阻塞，先避开
- 若发现直接冲突，再显式说明

---

## 七、默认验证策略

优先采用与改动面匹配的最小验证：

- 结构性改动：`npm run build`
- 单页面白屏 / 路由问题：直接访问对应路由并检查 runtime error
- 纯样式改动：最少做对应页面浏览器验证
- Worker / 网络数据问题：区分“代码接线正确”与“线上接口真实可用”

如果你无法完成浏览器级验证，必须明确写出：

- 哪些没验证
- 为什么没验证
- 还剩什么风险

当前已知验证缺口仍包括：

- Dashboard / L4 多个交互缺少系统化点击回归
- 新增 Worker endpoint 并非都做过线上联调
- 路由刷新、返回行为、深链接仍建议集中 QA

---

## 八、任务信息不足时怎么做

如果任务缺少关键边界，不要自己补全成更大的任务。

最少应知道：

- 当前目标
- 允许改哪些文件或区域
- 是否有禁止修改区域
- 至少一个可接受的验证方式

如果这些信息不足，返回：

- `BLOCKED_NEEDS_CONTEXT`

如果是 bug 但根因不明，返回：

- `BLOCKED_NEEDS_INVESTIGATION`

不要因为信息不全就自行重定义需求。

---

## 九、执行中的沟通风格

执行中优先输出：

- 当前在看什么
- 当前准备改什么
- 当前验证到了什么
- 当前还缺什么信息

不要：

- 大段回放思考过程
- 把猜测写成事实
- 夸大完成度
- 在没有证据时说“已全部正常”

---

## 十、完成后的回传要求

完成后，优先按结构化交接方式回传。

默认应包含：

- 本轮目标
- 实际修改文件
- 核心改动摘要
- 用户可见变化
- 验证结果
- 风险与未验证项

不要：

- 贴完整 diff
- 贴长代码片段
- 长篇复述调试过程
- 把未验证内容写成已验证

如任务来自 `AI/` 流程或 gstack 包，继续按对应结果模板回传。

---

## 十一、与 PM / Claude / gstack 的关系

如果任务已经由上游拆包：

- 你负责执行
- 不负责重做任务路由
- 不负责改写产品范围

如果你发现必须越界才能完成：

- 不直接越界扩写
- 先说明为什么当前包不足
- 说明最小新增授权范围

---

## 十二、当前最重要的项目原则

这个项目当前最重要的不是继续扩张，而是：

- 在现有独立站结构上稳定推进
- 控制改动面
- 逐步补浏览器级验证
- 避免把局部修复升级成架构工程

一句话总结：

**把当前这套已经跑起来的 LiquidityOS 基线维护好、修准确、改小步。**
