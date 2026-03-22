# LiquidityOS AI 规则

## 一、这份文件的用途

这份文件定义本项目中 AI 的工作规则。  
它的目标是让：

- 产品判断
- 实现执行
- 审查验证

三者保持一致。

这份文件重点约束：

- 分支使用
- runtime 认知
- scope 边界
- 代码安全
- 文档卫生

---

## 二、分支规则

### 当前分支含义

- `codex/full-preview`
  - 当前集成本地预览分支
  - 当前最重要 source of truth

- `codex/data-detail-pages`
  - 历史任务分支
  - 主要用于 detail-page 历史参考

- `main`
  - 历史基线 / 远端参考

- `codex/sync-20260314`
  - 已废弃混合分支
  - 不允许作为当前开发线恢复使用

### 分支默认规则

- 若需要理解当前产品，优先看 `codex/full-preview`
- 若 GitHub 和本地状态冲突，先信本地 `codex/full-preview`
- 不要把历史任务分支误当成当前运行分支

---

## 三、runtime 规则

当前 active runtime 是：

- `src/App.jsx`
- `src/styles.css`
- `dashboard/worker/worker.js`

不要默认相信以下内容仍是当前 runtime：

- `dashboard/web/...`
- 老 README 目录说明
- 历史分支中的旧结构

---

## 四、实现包规则

本项目当前必须通过 **小而清晰的实现包** 推进。

已有包的风格示例：

- `HERO-03`
- `NAV-01`
- `BONE-01`
- `CARD-01`
- `CHART-02`
- `POLISH-01`

### 好的实现包
- 一次视觉 polish
- 一次 chart annotation 调整
- 一次导航行为修正
- 一次局部 correctness 修复

### 坏的实现包
- polish + worker rewrite + storage refactor + new feature 一起做
- UI 调整顺手改 refresh chain
- 改 detail page 时顺手改 homepage 信息结构
- 修 bug 时顺手重构共享层

默认不要混改。

---

## 五、核心逻辑保护规则

以下区域默认属于保护区，除非用户明确要求，否则不要随意改：

- signal calculation function bodies
- Worker aggregation logic
- storage / dirty-save / history logic
- homepage → detail-page navigation model
- refresh call chain
- tweet generation logic

若确实必须动，必须先说明：

- 为什么必须动
- 不动会导致什么问题
- 为什么不能用更小的替代方案

---

## 六、产品阅读模型保护规则

当前产品阅读模型是：

- homepage = 快速判断
- detail pages = 更深证据

不要通过以下方式破坏它：

- 把 detail 级别的信息密度塞回首页
- 把只该在 evidence 层出现的逻辑搬回 summary 层
- 断开 summary card 和 detail page 的连接

---

## 七、已接受产品决策保护规则

有些方向已经被探索过并明确放弃。  
不要偷偷带回来。

典型例子：

- 早期 boxed / oversized Hero 方向，已经被 `HERO-03 Signal Wash` 替代
- 大规模架构重写不是当前阶段模式
- 当前正确方向是 polish、correctness、reviewability

如果某个提案会重新引入旧方向，必须明确说明，而不是隐性回退。

---

## 八、文档规则：记录现实，不写愿景

更新项目文档时：

必须写清：

- 当前代码里真实存在什么
- 哪些是 complete
- 哪些是 in progress
- 哪些是 intentionally skipped / not executed
- 哪些是 known issue

不要把这些误写成完成状态：

- 实验性分支
- 尚未验证的 local pass
- broken refresh 状态
- 未提交的临时想法

---

## 九、UI 区域所有权规则

当前 homepage 各区域有较强边界：

- Hero / Signal Wash
- LayerGateBar
- BTC Anchor
- Market Context
- LayerTransition
- L4 Workbench
- Review
- floating dock

如果实现包写的是“只改一个区域”，就不要溢出到其他区域。

---

## 十、`src/App.jsx` 特殊规则

在编辑 `src/App.jsx` 前，必须检查是否会影响：

- section IDs / scroll targets
- page switching
- refresh controls
- theme switching
- storage effects
- detail-page entry wiring

记住：

`src/App.jsx` 不是普通页面文件，而是当前协调中心。

---

## 十一、Worker 特殊规则

在编辑 `dashboard/worker/worker.js` 前，必须先确认：

- 当前问题是否真的来自 Worker
- 是否已经排除前端展示层问题
- 是否已经排除 fetch / config 问题
- 这次改动是否只服务当前页面的 correctness，而不是扩大数据野心

默认 Worker 改动属于高风险改动。

---

## 十二、默认工作风格

本项目当前默认工作风格是：

- 小包推进
- 先调查，后修复
- 先审查，后扩大
- 先保持 working runtime，再谈优化
- 先交付可 review 的变化，再谈更大重构

不要让 AI 因为“做得到”就自动扩 scope。

---

## 十三、状态规则

在输出任务判断时，尽量显式标注状态：

- `READY_FOR_PLAN`
- `READY_FOR_CODEX`
- `READY_FOR_REVIEW`
- `READY_FOR_QA`
- `BLOCKED_NEEDS_INVESTIGATION`
- `POLISH_ONLY_NO_SCOPE_EXPANSION`
- `DEFERRED`

目的不是形式化，而是避免“看起来说了很多，但其实没决定下一步”。