# [CLAUDE.md](http://CLAUDE.md)

## 这份文件的用途

这是当前项目给 Claude Code 的 **会话入口规则**。

目标是让 Claude 在进入项目后，先按统一方式理解：

- 当前项目现实
- 当前默认工作流
- 当前阶段重点
- 当前不该做什么
- 当前该优先读取哪些文件
- 当前任务应该如何规划、实现、验证、回传

这份文件不是完整知识库。  
它是项目总入口。

详细背景、规则、流程、skills，都在 `AI/` 目录下。

---

## 一、会话启动默认动作

每次进入本项目后，先做以下动作：

### 1. 先读取 AI 工作流入口

优先阅读：

1. `AI/README.md`
2. `AI/01-project-knowledge/04-ai_context.md`
3. `AI/01-project-knowledge/05-stage_summaries.md`
4. `AI/02-control-layer/01-pm-controller.md`

如任务涉及结构、边界或高风险改动，再补充阅读：

5. `AI/01-project-knowledge/02-architecture.md`
6. `AI/01-project-knowledge/03-rules.md`

### 2. 先判断当前任务类型

不要急着改代码。  
先判断当前任务属于哪一类：

- 需求澄清
- 实现规划
- 问题调查
- 实现审查
- 验证验收
- 范围控制

判断依据以：

- `AI/02-control-layer/01-pm-controller.md`

为准。

### 3. 只有在任务已经足够清楚时，才进入实现

如果任务边界不清、根因不明、方向模糊，不要直接实现。  
先回到正确流程节点。

---

## 二、当前项目现实

除非用户明确说明发生变化，否则默认按以下现实工作：

- 当前主要工作分支：`codex/full-preview`
- 当前真实运行时：根目录 Vite + React app
- 当前阶段重点：
  - polish
  - correctness
  - reviewability
  - bounded improvement

默认不要把当前任务理解成：

- 大规模功能扩张
- 架构重做
- router migration
- broad worker rewrite
- 数据源野心扩张

如果历史目录、旧分支、旧文档与当前状态冲突，优先相信：

1. `AI/01-project-knowledge/04-ai_context.md`
2. `AI/01-project-knowledge/05-stage_summaries.md`
3. 当前代码本身

---

## 三、默认工作原则

### 1. 先规划，再实现

对于任何非简单任务，默认先进入 plan mode。

非简单任务包括但不限于：

- 超过 3 个明确步骤
- 需要跨多个文件
- 需要动高风险文件
- 涉及架构判断
- 涉及 bug 根因不明
- 涉及 review / QA / handoff 设计

先把任务写成一个清楚的计划，再开始执行。

### 2. 先验证，再算完成

不要把“代码写完”当成“任务完成”。

只有当以下条件满足时，才可视为本轮完成：

- 当前目标已经真正实现
- 验证步骤已经执行
- 没有把未验证内容伪装成已完成
- 没有隐性扩大 scope

### 3. 根因优先，禁止表面修复

如果是 bug、regression、错误行为、数据异常：

- 先定位根因
- 再决定是否修复
- 不要基于表面症状直接 patch

### 4. 简洁优先

每次改动都优先追求：

- 最小改动面
- 最少受影响文件
- 最低副作用
- 最清楚的实现路径

不要为了“优雅”而过度设计。  
也不要为了“快”而制造 hack。

### 5. 范围必须受控

每一轮实现都应压缩成最小安全实现包。

如果任务开始同时混入：

- UI
- business logic
- data
- storage
- Worker
- refactor
- feature expansion

必须主动停下并拆包。

---

## 四、项目专属护栏

默认不要做以下事情，除非用户明确要求且你已说明风险：

- 把 `codex/sync-20260314` 重新作为当前开发线
- 把 `dashboard/web/...` 误判成当前主运行时
- 无理由扩数据源范围
- 无理由开启 router migration
- 轻易改 Worker
- 轻易重写 homepage → detail-page wiring
- 把 polish 任务升级成架构大改
- 因为“能做”就自动扩 scope

默认高风险文件包括：

- `src/App.jsx`
- `src/styles.css`
- `src/config.js`
- `src/lib/api.js`
- `src/lib/storage.js`
- `dashboard/worker/worker.js`

如果必须动这些文件，先说明：

- 为什么必须动
- 为什么不能只改低风险区域
- 这次改动的边界是什么

---

## 五、任务执行规则

### 1. Plan First

任何非简单任务，先写计划。  
计划至少要回答：

- 当前任务类型是什么
- 当前唯一主目标是什么
- 当前最小实现包是什么
- 允许修改哪些文件
- 禁止修改哪些文件
- 怎么验证
- 哪些内容明确延后

### 2. Verify Plan

开始实现前，再检查一次计划是否清晰：

- 任务是不是只有一个主目标
- 有没有隐性第二任务
- scope 是否已失控
- 验证步骤是否明确

### 3. Track Progress

执行过程中，持续更新当前状态：

- 正在做什么
- 已完成什么
- 还没完成什么
- 是否发现越界风险
- 是否需要停下重规划

### 4. Explain Changes

每完成一个有意义的步骤，给出高层摘要：

- 改了什么
- 为什么这么改
- 没改什么
- 影响了什么

### 5. Document Results

完成一轮执行后，必须形成结构化结果，而不是自由叙述。

如果是实现结果，优先使用：

- `AI/03-skills/custom/01-执行结果汇报官.md`

### 6. Capture Lessons

如果用户指出错误、回退了某个方向、或明确纠正了你的判断：

- 记录这次纠正的要点
- 后续同类任务避免再犯
- 必要时建议把这类教训更新进项目文档或独立 lessons 文件

---

## 六、技能使用规则

不要把所有任务都当成直接编码任务。  
先按任务类型使用正确 skill。

### 1. 方向不清

使用：

- `AI/03-skills/gstack/office-hours/`

### 2. 方向清楚，需要切实现包

使用：

- `AI/03-skills/gstack/plan-eng-review/`

并遵守：

- `AI/02-control-layer/02-codex-handoff-protocol.md`

### 3. 根因不明的问题 / bug / 异常

使用：

- `AI/03-skills/gstack/investigate/`

### 4. Codex 做完一轮，需要审查

使用：

- `AI/03-skills/gstack/review/`

如果 Codex 输出过长，先用：

- `AI/03-skills/custom/01-执行结果汇报官.md`

### 5. 当前主要需要验证

使用：

- `AI/03-skills/gstack/qa-only/`

### 6. retrospection / 回顾

当前不是默认主流程。  
只有明确需要阶段复盘时，才使用：

- `AI/03-skills/gstack/retro/`

---

## 七、Codex 协同规则

如果本轮要交给 Codex：

### 发包前必须确认

- 当前任务已经足够清楚
- 已形成最小安全实现包
- 已写明允许修改文件
- 已写明禁止修改文件
- 已写明验证步骤
- 已写明延后事项

### 发包时必须遵守

- `AI/02-control-layer/02-codex-handoff-protocol.md`

### Codex 完成后必须遵守

- `AI/03-skills/custom/01-执行结果汇报官.md`

不要直接把冗长原始执行过程当成最终结果。

---

## 八、验证优先规则

没有验证，不算完成。

验证方式可包括：

- 运行相关页面或流程
- 检查用户可见行为
- 检查 console / logs
- 对比改动前后行为
- 检查是否影响相关 detail page / homepage / refresh chain
- 必要时运行已有测试

如果无法验证，必须明确写：

- 哪些没验证
- 为什么没验证
- 当前仍存在什么不确定项

---

## 九、输出风格要求

对用户输出时，优先使用：

- 清楚
- 结构化
- 决策导向
- 范围明确
- 不夸大完成度

尽量说清：

- 当前任务类型
- 当前目标
- 推荐路径
- 当前最小实现包
- 最安全下一步
- 当前不要做什么
- 当前状态

不要用长篇工程自述代替结论。

---

## 十、默认状态协议

做出关键判断时，尽量显式输出一个状态。

优先使用以下状态：

- `READY_FOR_PLAN`
- `READY_FOR_CODEX`
- `READY_FOR_REVIEW`
- `READY_FOR_QA`
- `BLOCKED_NEEDS_CONTEXT`
- `BLOCKED_NEEDS_INVESTIGATION`
- `POLISH_ONLY_NO_SCOPE_EXPANSION`
- `DEFERRED`

---

## 十一、当事情开始走偏时

如果出现以下任一情况，立即停下并重规划：

- 任务开始跨多个层
- 发现原本不是小包
- 根因仍然不明
- 必须动高风险文件，但理由不充分
- 当前做法越来越 hack
- 当前步骤与项目阶段不匹配
- 当前改动将打破 working runtime

此时不要硬推进。  
应明确告诉用户：

- 当前卡点是什么
- 为什么不能继续硬做
- 最合理的缩包方式是什么
- 哪些内容建议延后

---

## 十二、最终原则

你在这个项目里不是为了“看起来很能做”，  
而是为了像一个可靠的高级工程师 / PM 协同体那样工作：

- 先理解现实
- 先规划
- 找根因
- 小包推进
- 验证优先
- 显式记录边界
- 交付可审查结果

这个项目最重要的不是更快扩张，  
而是：

**在已经成型的独立站结构上，稳定、清楚、可验证地推进。**
---
## 十三、🔁 Handoff Safe Protocol（自动接力）

当用户输入以下任一指令时：
- handoff-safe
- 交接
- 进入下一阶段

必须执行以下流程：

### Step 1：使用执行结果汇报官（紧凑模式）

必须遵守：
AI/03-skills/custom/01-执行结果汇报官.md

仅输出最小必要信息


### Step 2：上下文压缩（强制执行）

压缩当前上下文，仅保留：

Preserve:
- task objective
- current state
- key decisions
- next step

Discard:
- explanations
- repeated discussion
- failed attempts

必须在输出中体现
如果当前结果不适合交接，返回 BLOCKED_NEEDS_CONTEXT 或 BLOCKED_NEEDS_INVESTIGATION

### Step 3：输出最小交接包（handoff）

格式如下：

[任务目标]
一句话

[当前状态]
当前进度（精简）

[下一步]
明确行动

[约束]
必须遵守的规则


### 全局约束

- 禁止输出解释
- 禁止长文本
- 优先最小信息密度
- 每个字段 ≤ 1 行，总长度 ≤ 6 行

##十四、🧩 GSTACK 技能体系（强制）

1. 浏览器行为接管（必须）

所有网页访问 / 抓取 / 调研行为：

→ 必须使用 gstack 提供的：

/browse

禁止使用：

- mcp__claude-in-chrome__*
- 任何内置浏览器工具

如违反，视为流程错误。

---

### 2. 核心技能库（21项）

必须优先使用以下技能进行任务路由：

- /office-hours
- /plan-ceo-review
- /plan-eng-review
- /plan-design-review
- /design-consultation
- /review
- /ship
- /browse
- /qa
- /qa-only
- /design-review
- /setup-browser-cookies
- /retro
- /investigate
- /document-release
- /codex
- /careful
- /freeze
- /guard
- /unfreeze
- /gstack-upgrade

规则：

→ 不允许绕过 skill 直接执行复杂任务  
→ 必须先判断任务类型，再选择 skill  

---

### 3. 自愈机制（必须）

如果出现以下情况：

- /browse 无法使用
- skill 未注册
- gstack 行为异常
- 命令报错或无响应

必须自动执行：

```bash
cd .claude/skills/gstack && ./setup

然后：

→ 重新执行原任务
→ 不向用户请求手动修复

4. 使用优先级

任务执行顺序：

用户请求
→ 判断任务类型
→ 选择 gstack skill
→ 执行
→ 必要时 handoff-safe

5. 禁止行为

❌ 绕过 gstack skill 直接做复杂任务
❌ 混用系统内置浏览器与 /browse
❌ 在 skill 失败时直接放弃

必须：

→ 优先修复 skill
→ 再继续执行任务
