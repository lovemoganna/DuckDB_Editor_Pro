# Ontology 模块架构

> 本文档记录本体(Ontology)模块的架构决策。AI 在处理本体相关任务前必须阅读。

## 模块定位

本体模块是 DuckDB Editor 中基于"本体论"(Ontology)思想的知识管理子系统。
它将现实世界的事物抽象为"对象-关系-行动"三层结构，支持 AI 辅助建模和可视化。

## 核心设计

### 五表数据模型

所有数据存储在 DuckDB WASM 中，表名格式 `{namespace}_{entity}`：

```
{namespace}_object_type    — 对象类型（TypeHub，如"人"、"项目"）
{namespace}_object         — 对象实例（如具体的"张三"、"项目A"）
{namespace}_link_type      — 关系类型（如"认识"、"依赖"）
{namespace}_link           — 关系实例（具体的关系边）
{namespace}_action         — 行动（任务/事件）
{namespace}_introspection   — 反思记录（Q&A）
{namespace}_insight        — 洞察记录（标签化洞察）
```

### 扩展数据

- `ont_property_type` / `ont_property_instance` — 动态属性
- `taxonomy_tag` / `taxonomy_tagged` — 分类标签
- `duckdb_ontology_canvas_state` / `duckdb_ontology_canvas_edges` — 画布持久化

### 单一数据源

`hooks/useOntologyStore.ts` 是本体模块的单一数据源（Single Source of Truth）。
**所有 UI 组件必须通过此 Hook 访问数据**，不得直接查询 DuckDB。

### 三视图架构

```
OntologyPanel
├── graph   → D3GraphView      （力导向图，快速浏览全貌）
├── data    → OntologyDataView （数据表视图，原始 CRUD）
├── canvas  → OntologyCanvas  （画布编辑器，精细编辑）
└── schema  → SchemaTab        （Schema 图谱）
```

## D3GraphView 架构（知识图谱可视化）

### 渲染策略

- **默认**：D3.js 力导向布局 + SVG 渲染
- **加速**：节点数 > 200 时激活 PixiJS WebGL（PixiGraphRenderer 接管圆/徽章，SVG 保留连线/标签）
- **LOD**：
  - zoom < 0.8x → 仅圆点
  - 0.8x - 2.5x → 圆 + 描边
  - >= 2.5x → 全量（圆+描边+徽章+标签）

### 节点分层

| 层级 | 类型 | 半径 | 颜色 |
|------|------|------|------|
| TypeHub | 对象类型 | r=28（六边形图标） | 暖色调 |
| Instance | 对象实例 | r=11（方块图标） | 冷色调 |
| Action | 行动 | r=6（闪电图标） | 独立色 |

### 子模块拆分（2026-05 已部分完成）

```
D3GraphView.tsx              — 主组件（~3900行，待继续重构）
D3GraphView.types.ts         — 类型定义
D3GraphView.layout.ts        — 布局算法（dagre、DAG、环形）
D3GraphView.data.ts          — 数据转换、聚合、社区检测
D3GraphView.helpers.ts       — 工具函数（最短路径、中心度）
D3GraphViewMinimap.tsx       — 小地图
```

## OntologyCanvas 架构（画布编辑器）

### 渲染策略

- **纯 React + SVG**：无 D3/Pixi，纯 DOM + SVG
- **性能优化 P0**：RAF 批量更新 — pan/drag 写入 ref，React state 在 RAF 时同步
- **DOM 直接操作**：拖拽节点时直接修改 `transform: translate()`，绕过 React 重渲染

### 三种 Canvas 模式

| 模式 | 用途 |
|------|------|
| `pipeline` | 数据管道设计（Source/Transform/Sink） |
| `knowledge` | 知识结构设计（Concept/Event/Goal/Insight，支持 MECE 分层） |
| `explorer` | 数据库表关系探索（从 DuckDB 动态加载 schema） |

### MECE 五层体系

Canvas `knowledge` 模式支持 MECE（相互独立，完全穷尽）五层：

```
foundation    — 基础层（核心实体）
relations    — 关系层
methodology  — 方法论层
patterns     — 模式层
domains      — 领域层
```

### 持久化

- 画布状态保存在 DuckDB WASM 表中（防抖 2 秒自动保存）
- 撤销/重做：50 层历史栈（内存中）

## AI 建模服务

```
OntologyModelingWizard    — 引导式 AI 建模（用户输入 topic → LLM 生成对象/关系/布局）
ontologyAiService         — AI 编排层（调用多 Provider LLM）
ontologyModelingService   — 高级建模流程编排
schemaInferenceEngine     — 从 DuckDB Schema 推断本体
```

## 已知架构问题

| 优先级 | 问题 | 状态 |
|--------|------|------|
| 🔴 高 | D3GraphView 和 OntologyCanvas 两套并列，用户入口不清晰 | 规划统一方案 |
| 🔴 高 | DuckDB WASM `ontologyInit()` 后 catalog 可能过期 | 已知，workaround 已加 |
| 🟡 中 | D3GraphView.tsx 单文件 3900 行 | 部分拆分，待完成 |
| 🟡 中 | 测试覆盖率极低 | 待补测 |
| 🟡 中 | MECE 五层认知负担过重 | 规划降级方案 |

## 接口契约

```typescript
// 本体模块统一数据源（useOntologyStore）
interface OntologyStore {
  state: OntologyStoreState;          // 五表数据 + 视图状态
  loadData(): Promise<void>;          // 从 DuckDB 加载数据
  refresh(): Promise<void>;           // 强制刷新
  createObject(name, objectTypeId): Promise<void>;
  createLink(linkTypeId, sourceId, targetId): Promise<void>;
  // ... 其他 CRUD
}

// 统一可视化切换
type ViewTab = 'graph' | 'data' | 'canvas' | 'schema';

// 渲染层契约：只读 + subscribe，不得直接写 DuckDB
GraphView ↔ useOntologyStore（只读订阅）
Canvas ↔ useOntologyStore（只读订阅）
```

---

*最后更新：2026-06-08*
