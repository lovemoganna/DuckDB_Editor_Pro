# PLAN: High-Level Canvas AI Optimization (高阶画布 AI 优化方案)

## Goal
依据先前定义的「高阶画布模块系统性优化提示词（MECE 体系）」，全面升级 `OntologyCanvas.tsx`（及相关的图谱视图），引入结构化的四大图元节点、三阶空间管理与三大 AI 增强视窗，彻底打通 “自然语言 -> 画布拓扑 -> SQL逻辑” 的双向生成链路。

## User Review Required
> [!IMPORTANT]
> - 本计划当前仅为规划阶段（`/plan`），无需编写业务代码。
> - 在进入 `/create` 执行前，请评估以下对 `OntologyCanvas` 数据结构的破坏性变更：
>   目前的 `CanvasItem` 仅映射 `life_object`。根据新架构，我们需要将图元区分为 Source, Transform, Control, Sink，这可能需要在鸭子库状态表中增加类似于 `node_type` 和 `sql_metadata` 的字段。

## Required Agent Assignments
- **project-planner**: 负责制定与追踪本执行计划。
- **frontend-specialist**: 负责 `OntologyCanvas` 的 UI 交互升级，包括连线、防抖渲染及拖拽结构重构。
- **backend-specialist**: 负责实现 `topology-to-sql` 引擎解析，将画布节点树转换为完整的 DuckDB CTE/SQL 查询语句。
- **orchestrator**: 负责实现 LLM Prompt 的无缝连接与生成控制（`useAIFill.ts` / `ontologyAiService.ts`）。

## Task Breakdown

### Phase 1: 底层数据结构与状态适配 (Foundation)
- [ ] 升级 `life_canvas_state` 表结构，支持存储节点类型（Source/Transform/Control/Sink）和附属的 SQL 配置元数据。
- [ ] 改造 `OntologyCanvas.tsx` 原有状态管理，引入 Edge（连线）状态支持（目前似乎缺少物理级别连线逻辑，或补充 ReactFlow 依赖）。
- [ ] 封装并实现 `CanvasTopologyManager`，提供拓扑转 SQL（Topology-to-SQL）的基础抽象方法。

### Phase 2: 画布操作栏与 AI 原生交互 (AI Core Features)
- [ ] 在 `OntologyCanvas` 顶部与各选中 Node 组件中集成「AI 一键填充（AI Fill）」悬浮菜单 / 入口。
- [ ] 实现针对单点图元的 AI Fill：支持自然语言局部修改选中的 Group 或 Transform 节点（例如自动填写 `CASE WHEN` 逻辑）。
- [ ] 集成「快速清除」核心操作栈，涵盖视口重置、全局状态清空、报错复位逻辑，并绑定 `Ctrl+Shift+R` / `Esc` 等快捷键。

### Phase 3: AI 侧边栏与渲染链路 (Insights & Visuals)
- [ ] 构建独立的右侧栏 `SqlPreviewer` 组件，应用防抖机制，当画布发生拖拽时，实时预览由画布组装编译生成的 SQL。
- [ ] 集成并在右侧常驻「拓扑洞察（Topology Insights）」，监听画布变更，及时警告闭环依赖与高风险 JOIN。
- [ ] 通过 `ontologyAiService` 提供整张画布自适应流向排版（Layout Assistant）调用点，升级原本仅基于颜色的简单 AI Canvas Layout。

### Phase 4: 测试与联调 (Verification)
- [ ] 验证包含多 CTE 级联映射的拖拽能否生成正确的嵌套 SQL。
- [ ] 检查力导向排布算法在 50+ 节点大型拓扑下是否会导致 React 渲染卡顿阻塞，加入节流防护。
- [ ] （系统提示词）注入上述 “MECE 高阶画布 AI 指南”，观察 LLM 实际生成的 Canvas state JSON 数据正确性。

## Verification Plan
1. **Automated Tests**:
   - `npm run test` 对 `topology-to-sql` 工具类进行输入输出单测。
2. **Manual Verification**:
   - 进入画布测试 “生成用户生命周期图谱” 提示词，验证：生成节点正确、自动拉线、SQL Previewer 立即展现结果、右侧不提示死循环。
