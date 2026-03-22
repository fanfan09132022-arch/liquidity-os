# Codex Handoff Protocol（Compact / Artifact-first）

用途：
Claude → Codex 的任务交接协议

目标：
- 最小化聊天上下文（降低 token）
- 所有完整信息文件化（artifact）
- 防止重复信息进入对话

---

# 一、核心原则（必须遵守）

1. **完整任务单必须写入文件（Artifact-first）**
   路径：
   ~/.gstack/projects/<repo>/<package-name>.md

2. **聊天中只允许发送“短启动消息”**
   - 不超过 6 行
   - 不重复文件内容

3. **Codex 必须先读文件再执行**
   - 禁止基于聊天内容猜测

---

# 二、标准执行流程

## Step 1 — 写入任务单文件

Claude 必须生成完整 package 并写入：

~/.gstack/projects/<repo>/<package-name>.md

文件必须包含：

- 当前目标
- 修改范围（allowed / forbidden）
- 数据结构 / UI 说明
- 验证方式
- 延后事项

注意：
这些内容**禁止出现在聊天中**

---

## Step 2 — 发送短启动消息（唯一合法格式）

```md
Package: <PACKAGE-NAME>
Goal: <一句话目标>
Read first: ~/.gstack/projects/<repo>/<package-name>.md
Allowed: <最多3项>（必须与 package 文件一致，不得在聊天新增范围）
Forbidden: <仅高风险项>
Return: 使用执行结果汇报官（紧凑模式）
```

*禁止在启动消息中添加解释或额外内容*

------
三、Claude 严格禁止行为

在聊天中禁止：

❌ 粘贴完整 package
❌ 重复背景说明
❌ 重复验证步骤
❌ 展开延后事项
❌ 再写一份执行说明
❌ 再解释“为什么现在做”
------
四、Codex 执行要求

Codex 必须：

读取 Read first 文件
严格按文件执行
不修改 forbidden 文件
不扩 scope
不自行重构无关代码
------
五、Codex 回传协议（紧凑版）

只允许返回：

Package: <PACKAGE-NAME>
Changed: <file1>, <file2>
Scope: on-package / over-scope / blocked
Verified: build pass / endpoint ok / browser unverified
Risks: <最多2条>
Next: READY_FOR_REVIEW / READY_FOR_QA / BLOCKED
Report: ~/.gstack/projects/<repo>/<package-name>-result.md
禁止：
- 解释实现逻辑
- 解释原因
- 添加额外文本

报告路径必须真实存在，否则视为未完成
------
六、长度限制（强制）

Claude → Codex：≤ 6 行  
Codex → Claude：≤ 8 行  
且总计 ≤ 180 中文字  
不得重复 package 内容

超出视为协议违规

七、上下文控制策略（关键）

Claude 必须：

不重复发送同一信息
不复述历史 package
只传“当前任务最小信息”

原因：
Claude 每条消息都会携带完整历史上下文，
上下文越大 → token 成本指数增长

八、状态机（工作流控制）

每个 package 必须处于以下状态之一：

READY_FOR_CODEX
READY_FOR_REVIEW
READY_FOR_QA
BLOCKED

禁止模糊状态

九、错误处理

如果出现以下情况：

需要修改 forbidden 文件
依赖不明确
数据结构不匹配
修改超出 allowed 范围（over-scope）

Codex 必须：

→ 停止执行
→ 返回 BLOCKED 状态
→ 不允许“边做边改协议”

十、设计意图

本协议通过：

Artifact 文件化
聊天极简化
强制结构约束

实现：

→ token 使用下降 70%+
→ 避免上下文污染
→ 提高多代理稳定性