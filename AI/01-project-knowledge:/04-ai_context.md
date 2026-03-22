# AI Context

## 一、这份文件的用途

这份文件是给“下一位接手项目的 AI”看的现实压缩包。

它的目标不是完整介绍项目历史，  
而是帮助新的 AI 快速知道：

- 当前真实工作线是什么
- 当前真实 runtime 是什么
- 哪些旧结构只是历史参考
- 当前阶段应该做什么
- 当前阶段不要做什么

这份文件应优先服务于：
**快速接手、少走弯路、避免误判运行时。**

---

## 二、当前真实项目状态

当前最值得信任的本地产品状态位于：

- 分支：`codex/full-preview`

当前真实运行时是根目录 app，而不是旧目录：

- `src/App.jsx`
- `src/styles.css`
- `src/main.jsx`

Worker 仍然存在，并且仍影响 homepage macro 数据路径：

- `dashboard/worker/worker.js`

---

## 三、当前阶段判断

当前 integrated preview 已经足够强，可以审查、可以 polish、可以做小范围 correctness 修正。  
但它还不是最终 production system。

当前阶段的正确理解应是：

- 已经进入独立站真实开发阶段
- 当前不是重新搭骨架
- 当前不是扩数据野心
- 当前重点是 polish / stabilize / reviewability

---

## 四、当前不是最终解决的问题

以下事项应被视为“有意未完全解决”，而不是“忘了做”：

- 某些历史 chart path 仍然因为 upstream 可靠性问题而保持简化
- 若干交互细节仍需要小型 polish，而不是大重构
- Top 50 icon quality 仍视为 upstream-data 质量问题，不是当前前端主优先级
- router migration 仍不是优先级
- 一些旧 docs / repo 结构仅具历史参考价值

---

## 五、下一阶段不该做什么

默认不要：

- 把下阶段理解成“继续扩数据源”
- 把 router migration 当成下一步主任务
- 因为局部粗糙就重开架构
- 因为历史目录还在就误以为那是当前 runtime
- 因为 GitHub 不同步就否定本地 `codex/full-preview`

---

## 六、下一阶段应该做什么

默认优先级应是：

1. 小范围 correctness fixes
2. reviewability / GitHub sync hygiene
3. 剩余 interaction rough edges
4. 保护已经工作的 data entry points
5. 避免不必要的 scope 增长

---

## 七、给下一位 AI 的必读文件

如果你是新接手的 AI，必须优先读：

- `src/App.jsx`
  - 主页面结构
  - detail-page 入口 wiring
  - floating dock
  - LayerGateBar
  - F&G gauge
- `src/styles.css`
  - 根 app 的主视觉系统
  - 全局 Recharts 样式
- `src/BTCDetailPage.jsx`
- `src/L1DetailPage.jsx`
- `src/L2DetailPage.jsx`
- `src/L3DetailPage.jsx`
- `src/FGDetailPage.jsx`
- `src/config.js`
- `dashboard/worker/worker.js`

---

## 八、仅历史参考的内容

以下内容可以参考，但不能默认当成当前 source of truth：

- `dashboard/web/...`
  - 旧结构
  - 适合做 branch archaeology，不适合判断当前 root-app execution
- `README.md`
  - 可能无法完整反映当前 root-app 现实
- `docs/*`
  - 适合补背景
  - 不一定等于当前实现真相

---

## 九、接手时的默认判断规则

如果你想最快看到当前最完整产品状态：

- 优先检查 `codex/full-preview`

如果 GitHub 与本地不一致：

- 先信本地 `codex/full-preview`
- 再考虑同步 GitHub

如果你只想看历史上的 isolated detail-page package：

- 再去看 `codex/data-detail-pages`

---

## 十、当前护栏

接手后默认遵守：

- 不要把 `codex/sync-20260314` 重新作为工作分支
- 不要把 `dashboard/web` 误判为主运行时
- 不要随意扩数据源 scope
- 不要在 UI restructuring 中破坏 `src/App.jsx` 的 detail-page entry wiring
- Worker 改动默认保持最小，除非 homepage macro integrity 直接受损
- 不要重新引入旧的 static action-dock 布局，当前 runtime 使用 floating dock

---

## 十一、一句话交接结论

这个项目现在最需要的不是“再造一个系统”，  
而是：

**在已经成型的独立站结构上，做更稳、更小、更可审查的推进。**