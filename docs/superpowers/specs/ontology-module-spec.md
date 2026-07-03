# Ontology Module Spec

> 生成日期：2026-05-11
> 状态：已整理（基于代码审计）

---

## 一、模块职责边界

Ontology 模块负责将**数据库 schema** 与**业务语义本体**建立映射，提供三层抽象：

| 层级 | 英文名 | 含义 |
|------|--------|------|
| Concept | AbstractionLevel | 概念（SELECT/INSERT/UPDATE/DELETE/AGGREGATE...） |
| Property | SemanticType | 属性（DIMENSION/MEASURE/IDENTIFIER/TIME...） |
| Relation | OntologyEntry | 关系（is_a/has_a/depends_on...） |
| Instance | 实体对象 | 具体数据记录 |

---

## 二、核心类型

### 2.1 Ontology 层（types/ontology.ts）

```typescript
OntologyEntry       // 本体论条目：四层抽象 + 语义类型 + 关系图谱
OntologyView        // 本体论视图：树/图/列表布局 + 过滤器
AIGeneratedContent  // AI 生成元数据
OntologyExport      // 导出格式
AbstractionLevel    // 'concept' | 'property' | 'relation' | 'instance'
OntologySemanticType // 'DIMENSION' | 'MEASURE' | 'IDENTIFIER' | 'ATTRIBUTE' | 'TIME' | 'RELATIONSHIP' | 'COMPUTED'
RelationType        // 'is_a' | 'has_a' | 'has_many' | 'belongs_to' | 'related_to' | 'depends_on'
```

### 2.2 Abstraction 层（types/abstraction.ts）

```typescript
AbstractionTable           // 抽象表：abstractionPath + sqlConfig
AbstractionSqlOperation    // 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'AGGREGATE' | 'JOIN' | 'WINDOW' | 'CTE'
SqlParameter              // SQL 参数定义
AbstractionFilters        // 筛选状态
AbstractionGenerationRequest / AbstractionGenerationResult // AI 生成
AISession / AISessionMessage  // 持续会话
SandboxState              // 实验台状态
```

### 2.3 Canvas 层（components/Library/OntologyCanvas.types.ts）

```typescript
CanvasItem     // 画布节点
CanvasEdge      // 画布连线
CanvasSpace     // 画布空间（分组容器）
CanvasState    // 画布全局状态
MECELayer      // 'foundation' | 'relations' | 'methodology' | 'patterns' | 'domains'（5层，非 AbstractionLevel）
CanvasMode      // 'pipeline' | 'knowledge' | 'explorer'
```

> 注意：Canvas MECE Layer（5层）与 Abstraction AbstractionLevel（4层）是**独立的抽象维度**，各自解决不同问题，无映射关系。

---

## 三、模块内组件关系

```
OntologyPanel (主入口，561行)
├── D3GraphView（只读知识图谱，D3 force simulation）
├── OntologyCanvas（可编辑画布，3种模式）
│   ├── CanvasToolbar
│   ├── CanvasItemNode / CanvasSpaceNode
│   ├── CanvasObjectPicker
│   ├── CanvasRightPanel
│   ├── CanvasAIPreviewModal
│   └── CanvasModeDesign
├── OntologyInsightsPanel（洞察聚合）
├── OntologyDataView（数据表视图）
├── SchemaGraphView（Schema 图）
├── SchemaTab（Schema 推断）
├── ExampleGuide（示例引导）
└── MappingConsole（数据映射台）

Abstraction Lab（独立 Tab）
├── AbstractionList
├── AbstractionDetail
├── AbstractionSearchBar
├── AbstractionCard
├── AbstractionAIPanel
├── AbstractionForm
└── SandboxEditor / SandboxResults / SandboxAIPanel
```

---

## 四、服务层

| 服务 | 职责 |
|------|------|
| duckDBService | DuckDB WASM 封装，CRUD + 查询 |
| ontologyAiService | 多 Provider AI 调用（Gemini/Claude/Groq/OpenAI）|
| ontologyModelingService | 本体建模 AI 编排 |
| schemaInferenceEngine | 从数据库 schema 推断语义类型 |

---

## 五、已知技术债

| 优先级 | 问题 | 建议 |
|--------|------|------|
| 中 | Canvas MECE Layer 与 Abstraction Layer 无语义映射 | 人工决策是否需要建立映射 |
| 低 | AI prompt ID 偏移量无协调 | 检查 `ontologyAiService.ts` 中 prompt 构建逻辑 |
| 低 | IndexedDB 存储配额无检查 | 添加 storage quota 监听 |

---

## 六、状态管理

- **useOntologyStore**（hooks/useOntologyStore.ts）：全局本体论状态
- **AbstractionStore**：Abstraction Lab 专用状态（已拆分）
- Canvas 状态为组件本地 state（`CanvasState`），通过 DuckDB 持久化

---

## 七、持久化策略

- **DuckDB 内部表**：`life_object / life_object_type / life_link / life_link_type / life_action`
- **Canvas 状态**：通过 `getOntologyCanvasStateTable()` / `getOntologyCanvasEdgeTable()` 存储
- **Abstraction 模板**：通过 `AbstractionTable` + DuckDB 表存储
