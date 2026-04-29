# Ontology 高阶画布优化提示词（MECE 体系）

---

## 优化目标

基于 MECE 原则系统性优化 Ontology 本体论模块的**高阶画布**（OntologyCanvas + D3GraphView），实现**拓扑结构的 AI 智能编排**、**图谱节点的自动布局生成**与**即时生成 SQL 模拟方案**。整体结构需清晰、调用路径明确，确保在复杂场景下稳定输出可执行的拓扑 SQL。

---

## 模块现状概览

Ontology 高阶画布当前包含两个核心视图：

| 视图 | 组件文件 | 当前状态 | 核心能力 |
|------|----------|----------|----------|
| **OntologyCanvas** | `components/Library/OntologyCanvas.tsx` | 功能完整但 AI 填充为硬编码占位 | Space/Group/Item 自由拖拽、拓扑编译为 CTE SQL、持久化到 DuckDB |
| **D3GraphView** | `components/Library/D3GraphView.tsx` | 纯 D3 力导向图谱，无 AI 能力 | TypeHub/Instance/Action 三层节点、颜色分层、边权重可视化 |

### 现有架构

```
OntologyCanvas 内部结构：
  Toolbar: [节点] [空间] [智能布局] [AI 一键填充] [预览 SQL] [清空]
  Canvas: ItemNode + SpaceNode + SVG Edge (dagre auto-layout)
  RightPanel: CanvasNodeInspector (节点配置) / SQL Preview

D3GraphView 内部结构：
  Toolbar: [刷新] [视图控制] [导出]
  SVG: D3 Force Simulation → GraphNode + GraphLink
  Sidebar: 节点详情 + 操作面板

共享依赖：
  useAIFill hook      — 10 种 AI 填充模式的状态管理
  ontologyAiService   — 7 个 AI 生成方法（foundation/relations/methodology/patterns/domains/graph/canvas）
  CanvasTopologyManager — 拓扑编译为 DuckDB CTE SQL
```

### 已知问题

1. `OntologyCanvas.handleAiFill()`（第 460-468 行）为硬编码 3 节点填充，无实际 AI 调用
2. `OntologyCanvas` 未集成 `AIFillPanel`，AI 填充能力形同虚设
3. 画布「清空」按钮只清画布状态，未重置 AI 相关状态
4. `D3GraphView` 完全没有 AI 一键填充入口
5. 缺少模块背景说明、使用场景引导和常见错误提示
6. 没有二次优化入口，用户无法基于 AI 生成结果继续迭代

---

## 模块优化要求（适用于 Ontology 高阶画布）

### 1. 内嵌「AI 一键填充」功能

**目标**：降低拓扑编排门槛，AI 自动生成 Space/Item/Edge 结构和图谱节点布局。

**实现要求**：
- OntologyCanvas 和 D3GraphView 均需提供 AI 填充入口
- 根据当前上下文智能生成内容：
  - **OntologyCanvas**：基于已有对象列表，调用 `ontologyAiService.generateCanvasLayout(scene)` 生成空间组织方案（Space → Group → Item 层级），并将 AI 生成的布局描述编译为拓扑 SQL 片段存入节点 metadata
  - **D3GraphView**：输入话题描述，调用 `ontologyAiService.generateGraphLayout(topic)` 生成概念图谱节点布局 + 关系边数据，直接渲染到 D3 画布
- 填充过程显示加载动画 + 终止按钮
- 填充结果支持二次编辑，确认后可一键「采用」或「注入 SQL」

**OntologyCanvas AI 填充示例**：

```
输入：已有对象 [用户画像, 标签系统, 内容池]
调用：generateCanvasLayout('用户画像 / 标签系统 / 内容池')
输出：
{
  "spaces": [
    { "id": "space_1", "name": "数据源", "x": 0, "y": 0, "w": 400, "h": 300, "color": "purple" }
  ],
  "groups": [
    { "spaceId": "space_1", "name": "用户域", "x": 10, "y": 10, "items": ["用户画像"] },
    { "spaceId": "space_1", "name": "内容域", "x": 10, "y": 80, "items": ["标签系统", "内容池"] }
  ],
  "layoutDescription": "数据从用户域流向内容域，左输入右输出"
}
→ 自动生成 CanvasItem（Source/Transform/Sink 节点）+ CanvasEdge + metadata.sqlFragment
```

**D3GraphView AI 填充示例**：

```
输入：「家庭财务领域」
调用：generateGraphLayout('家庭财务领域')
输出：
{
  "nodes": [
    { "id": "n1", "label": "收入", "type": "object", "x": 300, "y": 100, "color": "green" },
    { "id": "n2", "label": "支出", "type": "object", "x": 100, "y": 300, "color": "orange" },
    { "id": "n3", "label": "储蓄", "type": "object", "x": 500, "y": 300, "color": "blue" }
  ],
  "edges": [
    { "source": "n1", "target": "n3", "label": "存入", "weight": 0.9 },
    { "source": "n2", "target": "n1", "label": "来源", "weight": 0.7 }
  ],
  "layoutAlgorithm": "force"
}
→ 自动生成 GraphNode[] + GraphLink[]，应用 AI 提供的 x/y 坐标初始化 D3 simulation
```

### 2. 内嵌「快速清除」功能

**目标**：提升迭代效率，支持一键重置输入状态。

**实现要求**：
- 每个画布均需提供快速清除入口
- 清除范围应包括：
  - 当前画布的所有节点（items）、空间（spaces）、连线（edges）
  - 选中的节点 ID（selectedItemId / selectedSpaceId）
  - AI 填充的加载状态（isAIFilling）
  - 右侧面板的 SQL 预览状态
- 支持快捷键操作（Escape 清除，Ctrl+Shift+O 触发 AI 填充）
- 清除后保持视图模式，仅重置画布内容

### 3. 提供模块背景说明与 AI 二次优化引导

**目标**：明确使用场景与常见错误，支持用户与 AI 协作优化。

**实现要求**：

#### 3.1 模块背景说明

每个画布类型需提供清晰的：
- **定位说明**：该画布解决的问题/场景
- **使用场景**：典型用例列表（3-5 个）
- **常见错误**：易错点提示（2-3 个）
- **最佳实践**：推荐使用方式

#### 3.2 与 AI 协作引导

在画布工具栏或侧边面板提供：
- **上下文提示**：基于当前画布的预置填充提示词
- **二次优化入口**：支持用户基于 AI 生成结果继续细化（"再细化一下..."输入框）
- **拓扑洞察**：AI 分析当前拓扑的依赖路径、数据流向、潜在优化点

---

## OntologyCanvas 详细优化规格

### 画布功能矩阵

| 功能 | 当前状态 | 优化后目标 |
|------|----------|------------|
| AI 一键填充 | 硬编码占位 | 调用 `generateCanvasLayout()` 智能生成 Space/Group/Item |
| 快速清除 | 仅清画布状态 | 清画布 + AI 状态 + 面板状态 |
| 背景说明 | 无 | 帮助面板（场景/错误/实践） |
| 二次优化 | 无 | SQL 预览区「再细化一下...」输入框 |
| 节点 AI 辅助 | 无 | CanvasNodeInspector 内嵌 AI 填充按钮 |
| SQL 注入 | 有（手动） | AI 填充后自动注入到拓扑 SQL 预览 |

### AI 填充核心逻辑

```
handleAiFill() 执行流程：

1. 检查 objects.length > 0
2. 拼接场景描述: objects.map(o => o.name).join(' / ')
3. 调用 ontologyAiService.generateCanvasLayout(scene)
4. 解析 CanvasLayoutPlan:
   - plan.spaces → CanvasSpace[]
   - plan.groups → CanvasItem[]（绑定到对应 space）
   - plan.edges → CanvasEdge[]
5. 为每个 Item 注入:
   - nodeType: 'Source' (默认)
   - metadata.tableName: item 名称
   - metadata.sqlFragment: 自动生成 SELECT * FROM tableName
6. 更新 canvasState (items + edges)
7. 自动触发 saveCanvas() 持久化
```

### 节点类型 AI 辅助

| 节点类型 | AI 辅助内容 | 调用方法 |
|----------|-------------|----------|
| Source | 基于对象名生成 SELECT 片段 | `generateObjectModel()` → 提取 properties |
| Transform | 生成 JOIN/聚合 SQL 片段 | `generatePatternSQL()` |
| Sink | 生成最终输出 SELECT 片段 | `generatePatternSQL()` |
| Control | 生成 WHERE/过滤条件 | `generatePatternSQL()` |

---

## D3GraphView 详细优化规格

### 图谱功能矩阵

| 功能 | 当前状态 | 优化后目标 |
|------|----------|------------|
| AI 一键填充 | 无 | 调用 `generateGraphLayout()` 智能生成节点布局 |
| 快速清除 | 无（仅刷新） | 清图谱 + 重置布局 |
| 背景说明 | 无 | 帮助面板（图谱可视化要点） |
| AI 初始化布局 | 无 | 使用 AI 提供的 x/y 坐标初始化 D3 simulation |
| 节点颜色映射 | 硬编码 warm/cool | AI 返回 colorScheme 动态映射 |

### AI 填充核心逻辑

```
handleAiFill() 执行流程：

1. 弹出 AI 填充对话框，输入话题描述
2. 调用 ontologyAiService.generateGraphLayout(topic)
3. 解析 GraphLayoutPlan:
   - plan.nodes → GraphNode[]（应用 AI 提供的 x/y 坐标）
   - plan.edges → GraphLink[]
   - plan.layoutAlgorithm → 决定初始 force 配置
   - plan.colorScheme → 节点颜色映射
4. 将 GraphNode[] + GraphLink[] 合并到现有 graphData
5. 重启 D3 simulation，从 AI 提供的坐标开始稳定
```

---

## 交互设计规范

### 按钮位置

| 按钮 | OntologyCanvas 位置 | D3GraphView 位置 |
|------|---------------------|------------------|
| AI 一键填充 | 工具栏，与「智能布局」并列 | 工具栏，与「刷新」并列 |
| 快速清除 | 工具栏右侧 | 工具栏右侧 |
| 帮助/说明 | 工具栏最左或最右 | 工具栏最左或最右 |
| 二次优化 | 右侧 SQL 预览面板底部 | 节点详情面板底部 |
| 节点 AI 辅助 | CanvasNodeInspector 内部 | — |

### 视觉反馈

| 状态 | 视觉表现 |
|------|----------|
| AI 填充进行中 | 按钮变为 `bg-indigo-500/30` + `Loader2` 旋转 + 文字「AI 构思中...」，点击可终止 |
| 填充完成 | 短暂高亮动画（脉冲效果），自动滚动到新节点 |
| 清除操作 | 瞬间完成，无需动画 |
| 二次优化中 | 「再细化一下...」输入框展开，加载动画同 AI 构思 |

### 快捷键支持

| 操作 | 快捷键 |
|------|--------|
| 触发 AI 填充 | Ctrl + Shift + O |
| 快速清除 | Escape |
| 确认采用（填充结果） | Enter |
| 打开帮助面板 | Ctrl + H |
| 切换视图（Canvas ↔ Graph） | Ctrl + 1 / Ctrl + 2 |

---

## 与 AI 二次优化的对话示例

### 示例 1：OntologyCanvas 拓扑生成

```
用户：点击「AI 一键填充」
AI：→ 生成 Space「数据工作流」，Group[输入、处理、输出]，Item 共 6 个节点
    + 拓扑边 5 条 + 每个节点的 metadata.sqlFragment

用户：点击 SQL 预览区「再细化一下...」，输入「增加一个过滤条件节点」
AI：→ 在 Transform 组内插入 Filter 节点，更新 edges
    → 追加 WHERE 条件 SQL 片段到 filter 节点 metadata

用户：再次点击「AI 一键填充」，场景变为「实时数据流」
AI：→ 替换整个拓扑，重新生成 Pipeline 流式拓扑结构
```

### 示例 2：D3GraphView 图谱生成

```
用户：点击「AI 一键填充」，输入「电商订单领域」
AI：→ 生成 8 个概念节点（商品、用户、订单、支付、物流、评价、退款、库存）
    + 12 条关系边
    + 力导向布局参数
    → 渲染到 D3 画布，从 AI 坐标开始 simulation

用户：点击某节点「再细化一下...」，输入「围绕退款节点展开更多关系」
AI：→ 在退款节点周围追加 3 个新节点（退款原因、客服介入、仲裁结果）
    → 追加 4 条新边
```

### 示例 3：CanvasNodeInspector 节点 SQL 辅助

```
用户：在 Transform 节点编辑器点击「AI 辅助」
AI：→ 分析当前拓扑上下文（前序 Source 节点、后序 Sink 节点）
    → 生成 JOIN 聚合 SQL：
    WITH source_0 AS (SELECT * FROM 用户画像)
    SELECT user_id, COUNT(*) as action_count
    FROM source_0 GROUP BY user_id
```

---

## 验收标准

1. ✅ OntologyCanvas 的 AI 填充调用真实 AI 服务（`generateCanvasLayout`），非硬编码
2. ✅ D3GraphView 提供 AI 一键填充按钮，调用 `generateGraphLayout`
3. ✅ 两个画布的「清空」按钮均同时重置画布内容 + AI 状态
4. ✅ OntologyCanvas 提供模块背景说明面板（场景/错误/实践）
5. ✅ D3GraphView 提供模块背景说明面板（图谱可视化要点）
6. ✅ OntologyCanvas 右侧 SQL 预览区提供「再细化一下...」二次优化入口
7. ✅ CanvasNodeInspector 提供节点类型 AI 辅助填充
8. ✅ 整体交互路径清晰，用户可在 3 次点击内完成任意操作
9. ✅ 复杂场景下 AI 生成内容稳定可执行
10. ✅ 快捷键覆盖所有高频操作（AI 填充、清除）

---

## 实施优先级

| 优先级 | 模块 | 理由 |
|--------|------|------|
| P0 | OntologyCanvas AI 填充（替换硬编码） | 核心入口，用户使用频率最高 |
| P0 | D3GraphView AI 填充按钮 | 图谱可视化增强，AI 构思 > 手动拖拽 |
| P0 | OntologyCanvas 快速清除增强 | 迭代效率基础保障 |
| P1 | CanvasNodeInspector AI 辅助 | 节点配置效率提升 |
| P1 | OntologyCanvas 背景说明面板 | 降低用户认知门槛 |
| P1 | D3GraphView 快速清除 | 图谱迭代效率保障 |
| P2 | OntologyCanvas 二次优化入口 | 用户迭代体验优化 |
| P2 | D3GraphView 背景说明面板 | 辅助参考，非核心路径 |
