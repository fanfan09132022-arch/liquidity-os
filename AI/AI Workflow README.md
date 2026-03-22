# AI Workflow README

## 一、这份 README 的用途

这个 `AI/` 文件夹不是普通文档目录。  
它是当前项目的：

- 项目知识层
- AI 控制层
- skill 调用层
- 历史归档层

它的目标不是“把所有信息都放进来”，  
而是帮助：

- Claude / PM 型 AI
- Codex / 执行型 AI
- 人类维护者

在进入项目时，快速知道：

- 当前项目是什么
- 当前项目的真实运行时是什么
- 当前阶段应该做什么
- 当前阶段不要做什么
- 任务应该怎么分流
- Codex 应该怎么接包、怎么回传

---

## 二、当前目录结构

```text
AI/
├── README.md
│
├── 01-project-knowledge/
│   ├── 01-project.md
│   ├── 02-architecture.md
│   ├── 03-rules.md
│   ├── 04-ai_context.md
│   └── 05-stage_summaries.md
│
├── 02-control-layer/
│   ├── 01-pm-controller.md
│   └── 02-codex-handoff-protocol.md
│
├── 03-skills/
│   ├── custom/
│   │   └── 01-执行结果汇报官.md
│   │
│   └── gstack/
│       ├── office-hours/
│       ├── plan-eng-review/
│       ├── investigate/
│       ├── review/
│       ├── qa-only/
│       └── retro/
│
└── archived-skills/
```

## **三、分层说明**

### **1.** **01-project-knowledge/**

这一层保存的是 **项目现实**。

它回答的是：

- 这个产品是什么
- 当前架构长什么样
- 当前哪些方向已经定了
- 当前阶段处在哪
- 哪些历史方向不要重开

这一层不是 skill。

它主要是给接手项目的 AI 做现实校准。

### **2.** **02-control-layer/**

这一层保存的是 **流程控制规则**。

它回答的是：

- 当前任务属于哪种类型
- 应该走哪个模块
- 什么时候可以交给 Codex
- Codex 的任务包应该怎么写
- 什么时候应该 review / qa / investigate

这一层不是项目知识，

而是 workflow 控制层。

### **3.** **03-skills/**

这一层保存 **可调用的方法模块**。

分为两类：

#### **gstack/**

放来自 gstack 体系的方法 skill，例如：

- office-hours
- plan-eng-review
- investigate
- review
- qa-only
- retro

#### **custom/**

放项目自定义 skill，例如：

- 01-执行结果汇报官.md

### **4.** **archived-skills/**

这一层保存旧版、自定义、已迁移或已废弃的 skill。

不要删，留作历史参考。

它不参与当前主流程。

---

## **四、每个核心文件一句话定位**

### **项目知识层**

#### **01-project-knowledge/01-project.md**

定义这个产品当前是什么、当前不是什么、下一阶段主目标是什么。

#### **01-project-knowledge/02-architecture.md**

定义当前真实运行时结构、关键层、主要文件职责与高风险区。

#### **01-project-knowledge/03-rules.md**

定义本项目 AI 工作的边界、保护区、实现包规则和默认工作风格。

#### **01-project-knowledge/04-ai_context.md**

给下一位 AI 的快速接手压缩包，帮助它迅速知道当前真实状态。

#### **01-project-knowledge/05-stage_summaries.md**

用阶段方式压缩项目历史，说明哪些方向已完成、已放弃、当前该聚焦什么。

---

---

## **四、每个核心文件一句话定位**

### **项目知识层**

#### **01-project-knowledge/01-project.md**

定义这个产品当前是什么、当前不是什么、下一阶段主目标是什么。

#### **01-project-knowledge/02-architecture.md**

定义当前真实运行时结构、关键层、主要文件职责与高风险区。

#### **01-project-knowledge/03-rules.md**

定义本项目 AI 工作的边界、保护区、实现包规则和默认工作风格。

#### **01-project-knowledge/04-ai_context.md**

给下一位 AI 的快速接手压缩包，帮助它迅速知道当前真实状态。

#### **01-project-knowledge/05-stage_summaries.md**

用阶段方式压缩项目历史，说明哪些方向已完成、已放弃、当前该聚焦什么。

---

## **四、每个核心文件一句话定位**

---

### **项目知识层**

#### **01-project-knowledge/01-project.md**

定义这个产品当前是什么、当前不是什么、下一阶段主目标是什么。

#### **01-project-knowledge/02-architecture.md**

定义当前真实运行时结构、关键层、主要文件职责与高风险区。

#### **01-project-knowledge/03-rules.md**

定义本项目 AI 工作的边界、保护区、实现包规则和默认工作风格。

#### **01-project-knowledge/04-ai_context.md**

给下一位 AI 的快速接手压缩包，帮助它迅速知道当前真实状态。

#### **01-project-knowledge/05-stage_summaries.md**

用阶段方式压缩项目历史，说明哪些方向已完成、已放弃、当前该聚焦什么。

---

### **控制层**

#### **02-control-layer/01-pm-controller.md**

整个 AI workflow 的总控器，负责识别任务类型、路由 skill、控制范围、决定下一步。

#### **02-control-layer/02-codex-handoff-protocol.md**

定义 PM / Claude 在把任务交给 Codex 前，必须如何打包成受控实现包。

---

### **自定义 skill**

#### **03-skills/custom/01-执行结果汇报官.md**

把 Codex 的执行结果压缩成结构化执行交接单，供 review / qa / PM 继续消费。

---

## **五、推荐读取顺序**

如果你是一个新接手项目的 AI，按下面顺序读取。

### **第一步：先理解项目现实**

1. 01-project-knowledge/01-project.md
2. 01-project-knowledge/04-ai_context.md
3. 01-project-knowledge/05-stage_summaries.md

先知道：

- 这是什么产品
- 现在在哪个阶段
- 哪些方向已经定了

---

### **第二步：再理解架构与边界**

4. 01-project-knowledge/02-architecture.md
5. 01-project-knowledge/03-rules.md

再知道：

- 当前 runtime 在哪
- 哪些文件高风险
- 哪些改动默认不该做

---

### **第三步：再进入 workflow**

6. 02-control-layer/01-pm-controller.md
7. 02-control-layer/02-codex-handoff-protocol.md

再知道：

- 当前任务怎么分流
- 什么时候允许交 Codex
- 交给 Codex 的包怎么写

---

### **第四步：最后理解 skills**

8. 03-skills/gstack/office-hours/
9. 03-skills/gstack/plan-eng-review/
10. 03-skills/gstack/investigate/
11. 03-skills/gstack/review/
12. 03-skills/gstack/qa-only/
13. 03-skills/custom/01-执行结果汇报官.md

最后再看：

- 每个模块具体怎么工作
- 每个模块产出什么交付物

---

## **六、当前默认工作流**

当前推荐默认主流程如下：

用户需求 / 问题

→ pm-controller 判断任务类型

→ 选择正确模块

→ office-hours（需求不清）

→ plan-eng-review（方向清楚，需要切实现包）

→ investigate（行为错误，根因不明）

→ codex-handoff-protocol（把实现包发给 Codex）

→ Codex 执行

→ 执行结果汇报官（压缩成执行交接单）

→ review（审查）

→ qa-only（必要时验证）

→ pm-controller 决定下一步

---

## **七、当前项目的默认判断**

除非用户明确改变方向，否则默认按以下现实理解项目：

- 当前主要工作线是 codex/full-preview
- 当前真实运行时是根目录 Vite + React app
- 当前阶段重点是：
  - polish
  - correctness
  - reviewability
  - bounded improvement

默认不是：

- 大规模新功能扩张
- 架构重做
- router migration
- broad worker rewrite
- 数据源野心扩展

---

## **八、当前最重要的工作原则**

### **1. 小包优先**

所有实现任务都应尽量压缩成最小安全实现包。

### **2. 先调查，后修**

当根因不清楚时，不要直接修 bug。

### **3. 先审查，后扩大**

先确认当前包是否真的完成，再决定是否继续。

### **4. 优先保护 working runtime**

不要为了“顺手优化”破坏当前已经工作的结构。

### **5. 显式 defer 优于隐式扩包**

本轮不做的内容必须明确写出来。

## **九、哪些文件经常更新，哪些文件少改**

### **建议经常更新**

这些文件应随着项目推进持续更新：

- 01-project-knowledge/04-ai_context.md
- 01-project-knowledge/05-stage_summaries.md

因为它们负责记录当前现实和阶段变化。

---

### **建议阶段性更新**

这些文件在产品结构或项目阶段明显变化时更新：

- 01-project-knowledge/01-project.md
- 01-project-knowledge/02-architecture.md
- 01-project-knowledge/03-rules.md

---

### **建议少改**

这些文件属于流程协议，不应频繁改：

- 02-control-layer/01-pm-controller.md
- 02-control-layer/02-codex-handoff-protocol.md
- 03-skills/custom/01-执行结果汇报官.md

只有确认 workflow 真的有结构性问题时，再改这些文件。

---

## **十、gstack skill 在这套系统里的角色**

gstack skill 不是项目知识文件。

它们是 **方法模块**。

### **当前默认主流程中最常用的 skill**

- office-hours
- plan-eng-review
- investigate
- review
- qa-only

### **当前不是主流程核心，但可作为补充**

- retro

### **当前项目自定义补充 skill**

- 01-执行结果汇报官.md

---

## **十一、关于命名规则**

本目录采用编号命名，目的是：

- 固定阅读顺序
- 降低 AI 接手时的理解歧义
- 让知识层、控制层、skill 层内部都有清晰顺序

规则如下：

- 知识层文件按推荐阅读顺序编号
- 控制层文件按实际流程顺序编号
- custom skills 按常用程度和维护顺序编号
- gstack 目录保持原 skill 名称，不额外改名

---

## **十二、给新接手 AI 的简短提示**

如果你是第一次进入这个项目，请不要急着：

- 重新设计架构
- 默认扩 scope
- 重新引入旧方向
- 把历史目录误判成当前 runtime

你应该先做的是：

1. 先确认当前项目现实
2. 再确认当前任务类型
3. 再决定该走哪个 skill
4. 再决定是否值得交给 Codex

---

## **十三、维护建议**

如果你正在维护这套 AI/ 文件夹：

- 不要在多个文件里重复维护同一套规则
- 不要让项目现实写进 skill 文件
- 不要让 skill 路由逻辑散落进 project knowledge 文件
- 不要把历史归档重新混回主流程
- 每次阶段发生明显变化时，优先更新 04-ai_context.md 和 05-stage_summaries.md

