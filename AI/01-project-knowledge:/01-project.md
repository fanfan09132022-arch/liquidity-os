# LiquidityOS 项目定义

## 一、这份文件的用途

这份文件用于定义：

- 当前产品是什么
- 当前产品不是什么
- 当前阶段的主目标是什么
- 当前主用户流是什么
- 下一位 AI / 开发者进入项目时，应该先理解什么

这不是完整 changelog，也不是任务列表。  
它是当前产品层面的 **项目定义文件**。

---

## 二、当前产品定位

LiquidityOS 当前不是一个泛化的信息门户，也不是一个重型多用户系统。  
它当前更接近：

**一个面向交易决策的分层阅读型数据工作台**

核心特征：

- 首页负责快速判断
- Detail Page 负责提供更深证据
- 用户从宏观判断进入局部证据，再进入执行层
- 产品重点在“读得快、跳得准、看得深”，不是把所有信息堆在首页

---

## 三、当前不是重点的方向

当前阶段默认 **不是** 以下方向：

- 大型新业务功能
- 登录 / 多用户系统
- 为了迁移而迁移 router
- 大范围 Worker / 数据架构重写
- 无明确产品必要性的新数据源扩展

如果某个请求会自然滑向上面这些方向，默认先收缩 scope，而不是直接推进。

---

## 四、当前 source of truth

当前产品理解应优先基于：

- 分支：`codex/full-preview`
- 当前主运行时：
  - `src/App.jsx`
  - `src/styles.css`

这条分支代表当前最完整的本地真实产品状态。

不要默认把历史分支、旧 README、旧目录结构当成当前产品现实。

---

## 五、当前已完成的重要实现包

以下实现包可以视为当前产品方向已经接受、已经落地的重要阶段：

- `HERO-03`
  - Hero 不再是大卡片，而是 page-level 的 `Signal Wash`
- `NAV-01`
  - LayerGateBar 已经变成真实导航，而不是静态装饰
- `BONE-01`
  - L1 卡片默认更偏 summary-first
- `BONE-02`
  - Market → L4 的过渡层已建立
- `CARD-01`
  - Alpha Scanner 候选卡片默认折叠、渐进展开
- `CHART-02`
  - Detail 图表语言更清晰，增加 end labels / narrative annotations

这些不是待验证想法，而是当前产品结构的一部分。

---

## 六、当前本地进行中的状态

当前 working tree 里还有一个本地 polish pass：

- `POLISH-01`
  - 间距优化
  - 可读性提升
  - 暗色模式修正
  - 小型 hover / stagger / transition 优化

这部分应视为：

- 已有真实本地进展
- 但尚未默认视为“已完成包”
- 在验证和提交前，不应过度写成完成状态

---

## 七、当前主用户流

当前产品主用户流应理解为：

1. 在 `L0` Hero / Signal Wash 区域快速读取整体气候
2. 用 LayerGateBar 在层级之间移动
3. 查看 BTC Anchor 获得锚点判断
4. 浏览 Market Context 的 summary cards
5. 进入 `L4`，做 watchlist / Alpha Scanner 相关工作
6. 从 summary cards 进入 detail pages 查看证据
7. 保存 note / snapshot，之后回到 review 阶段继续判断

这个阅读流是当前产品最核心的结构，不应随意打散。

---

## 八、当前产品现实

当前项目要默认接受这些现实：

- homepage 的宏观数据仍依赖 Worker-backed 数据流
- detail pages 已经集成在主 app shell 中，不是独立 router 体系
- 主题切换是持久化的，并跨 homepage + detail pages 共享
- 某些 refresh 路径仍可能受 upstream/runtime 条件影响
- 正确的下一阶段是 polish 和 correctness，而不是系统扩张

---

## 九、下一阶段默认目标

下一阶段默认目标不是“大做新功能”，而是：

1. 小范围 correctness 修正
2. reviewability 提升
3. GitHub 同步与交接卫生
4. 交互细节收尾
5. 保护已经工作的 runtime 结构

---

## 十、给下一位 AI 的第一动作

如果你是新接手这个项目的 AI，请先：

1. 读取 `AI/project.md`
2. 读取 `AI/architecture.md`
3. 读取 `AI/rules.md`
4. 检查 `src/App.jsx`
5. 在修改前先查看相关 detail page

默认不要先发明新架构。
默认先理解当前真实产品。