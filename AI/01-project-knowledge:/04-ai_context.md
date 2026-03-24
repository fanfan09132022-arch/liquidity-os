# AI Context

## 一、这份文件的用途

这份文件给下一位接手项目的 AI 提供“当前现实压缩版”。

它只回答几件事：

- 当前真实运行时是什么
- 当前项目已经推进到什么状态
- 哪些旧叙事已经过时
- 下一步默认该做什么、不该做什么

如果它与代码冲突，优先相信当前代码与 `PROJECT_STATUS.md`。

---

## 二、当前真实项目状态

截至 `2026-03-23`，当前最值得信任的本地现实是：

- 当前分支：`main`
- 当前真实运行时：根目录 Vite + React 18 app
- 当前路由入口：`src/main.jsx`
- 当前主工作台核心：`src/App.jsx`
- 当前主样式入口：`src/styles.css`
- 当前共享状态层：`src/context/AppStateProvider.jsx`
- 当前共享 Worker 数据轮询：`src/lib/useWorkerData.js`
- 当前 Worker 默认地址：`src/config.js`

当前真实可访问路由：

- `/`
- `/macro`
- `/liquidity`
- `/stablecoins`
- `/meme`
- `/workbench`
- `/fg`

`dashboard/worker/worker.js` 仍然存在且仍有意义，但它不是当前前端运行时入口。

---

## 三、当前结构现实

当前项目不是“全新模块化完成态”，而是一个过渡中的稳定基线：

- `Dashboard` 与 `L0-L3` 已拆成独立 page
- `L4 /workbench` 仍主要复用 `src/App.jsx`
- detail pages 仍是独立文件，但已接入新导航与共享组件
- 外部数据主要走 Cloudflare Worker
- 个别浏览器端数据仍直接从第三方接口拉取

因此，接手时应接受“新路由壳 + 老核心工作台并存”的现实，不要误判为需要立刻统一重写。

---

## 四、当前阶段判断

当前阶段的正确理解是：

- 已完成一轮较大规模前端整合
- 已进入稳定化、校正和补验证阶段
- 当前不是重新搭骨架
- 当前不是大规模扩数据野心
- 当前重点是 correctness / polish / reviewability / browser QA

可以把现在理解成：

**一个已经能跑、能 build、但仍存在浏览器级验证缺口的交易工作台基线。**

---

## 五、当前已完成的高价值成果

当前代码与状态文档已经明确完成：

- React Router v6 基础接入
- Dashboard 与 L0-L4 页面骨架
- `TabBar`、`NewsStrip`、`useWorkerData` 等共享能力
- 多个 Worker 字段修复与端点补充
- L4 Workbench 多轮增强
- 5 个 DetailPage 接入共享快讯条
- 部分 `AppStateProvider` 迁移，已到 Phase A / B

当前基线还确认过：

- `npm run build` 可通过
- `/stablecoins` 曾出现 `CHART_HEIGHT is not defined` 白屏，已在当前基线修复

---

## 六、当前不是重点的问题

以下事项应视为“当前没有优先推进”，而不是“忘记做”：

- AppStateProvider Phase C 全量迁移
- 大规模路由重构
- Worker 协议重写
- 登录 / 多用户 / 后台系统
- 无明确收益的新数据源扩张
- 为了整洁感而拆掉 `src/App.jsx` 做大手术

---

## 七、下一阶段默认该做什么

默认优先级应是：

1. 小范围 correctness fixes
2. 页面级白屏 / runtime error 清理
3. 浏览器级回归验证
4. reviewability 与交接卫生
5. 在不破坏现有结构的前提下做局部 polish

---

## 八、下一阶段默认不该做什么

默认不要：

- 把项目重新理解成旧分支工程
- 把 `dashboard/web` 当成主运行时
- 因为 `src/App.jsx` 很大就直接发起大拆分
- 把局部修复升级成架构重构
- 在没有明确任务时继续推进高风险状态迁移
- 把未验证内容写成“已稳定”

---

## 九、接手时的优先阅读顺序

如果你是新接手的 AI，建议优先读：

1. `PROJECT_STATUS.md`
2. `DESIGN.md`
3. `RESULTS_INDEX.md`
4. `src/main.jsx`
5. `src/App.jsx`
6. `src/pages/Dashboard.jsx`
7. `src/context/AppStateProvider.jsx`
8. `src/lib/api.js`
9. `src/lib/useWorkerData.js`
10. 与当前任务直接相关的 detail/page 文件

不要先默认去做历史考古。

---

## 十、一句话交接结论

这个项目现在最需要的不是“重做系统”，而是：

**在已经跑起来的 LiquidityOS 基线上，小步修正、补验证、稳定推进。**
