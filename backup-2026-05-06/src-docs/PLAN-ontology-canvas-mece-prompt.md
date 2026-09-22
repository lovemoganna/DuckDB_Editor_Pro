# Ontology 高阶画布 MECE 优化提示词文档

**模块**: Ontology Canvas（OntologyCanvas + CanvasHelpPanel）  
**原则**: MECE（Mutually Exclusive, Collectively Exhaustive）  
**目标**: AI 一键填充 / 快速清除 / 模块背景说明三大核心功能  
**状态**: 已实现

---

## 1. 模块定位与 MECE 架构

### 1.1 高阶画布在 Ontology 系统中的位置

```
OntologyPanel（三视图架构）
├── Graph 视图（OntologyGraphView）— D3 力导向图谱，全局概念可视化
├── Data 视图（OntologyDataView）  — CRUD 表格，基础数据管理
└── Canvas 视图（OntologyCanvas）  — 自由画布，拓扑编排 + AI 生成
```

**OntologyCanvas** 是 Ontology 模块中最复杂的视图，承担从概念到可执行 SQL 的最后一公里：用户通过 AI 生成或手动编排 Space/Item/Edge 结构，系统将其编译为 DuckDB CTE SQL。

### 1.2 MECE 五层在画布中的映射

| MECE 层 | 画布语义 | Space/Item 角色 | 典型 metadata |
|---------|---------|----------------|-------------|
| **Foundation** | 对象建模 | Space = 对象类型，Item = 实例 | `tableName`, `layerTag: foundation` |
| **Relations** | 关系建模 | Item = 对象实体，边 = 关系 | `sqlFragment` (JOIN/CTE) |
| **Methodology** | 方法论引导 | Group = 方法论步骤，Item = 操作要点 | `sqlFragment` (方法论 SQL) |
| **Patterns** | SQL 模式 | Item = 模式节点（Transform 类型） | `sqlFragment` (DuckDB 模板) |
| **Domains** | 完整领域 | 多 Space = 子领域，Item = 核心对象 | `layerTag: domains` |

---

## 2. 功能一：AI 一键填充

### 2.1 填充触发入口

**工具栏按钮**（位于「智能布局」右侧）：

```
[基础层 ▼] [AI 填充] [AI 一键填充] | [指南] [预览 SQL] [清除 ▼]
```

- **MECE 层选择器**：下拉选择五层之一（Foundation/Relations/Methodology/Patterns/Domains），选中层显示对应语义颜色
- **AI 填充**：调用 `handleMeceFill()`，基于当前选中 MECE 层生成结构化布局
- **AI 一键填充**（通用）：调用 `handleAiFill()`，基于已有对象生成通用拓扑

**快捷键**：`Ctrl + Shift + O` → 触发通用 AI 填充

### 2.2 MECE 五层填充规格

#### Foundation 层 → 对象类型 + 实例

**触发条件**：至少存在 1 个对象类型和 1 个对象实例

**AI 调用**：`ontologyAiService.generateMeceCanvasLayout('foundation', objectNames, objectTypeNames, meceHint)`

**输出结构**：
- 1-3 个 Space，每个 Space = 1 个对象类型
- 2-5 个 Item，每个 Item = 1 个对象实例
- 线性或分组布局，Space 颜色使用对象类型对应色

**metadata**：
```typescript
{
  tableName: objectName,
  sqlFragment: `SELECT * FROM "${objectName}"`,
  layerTag: 'foundation'
}
```

#### Relations 层 → 数据依赖图谱

**AI 调用**：`generateMeceCanvasLayout('relations', ...)`

**输出结构**：
- 0-1 个 Space（可选）
- 3-6 个 Item（对象）+ 3-5 条边
- 树状或线性拓扑

**metadata**：
```typescript
{
  tableName: objectName,
  sqlFragment: `WITH src AS (SELECT * FROM "${srcObject}") SELECT ... -- ${objectName} 关系`,
  layerTag: 'relations'
}
```

#### Methodology 层 → 方法论步骤

**AI 调用**：`generateMeceCanvasLayout('methodology', ...)`

**输出结构**：
- 0-2 个 Space（方法论大类）
- 4-8 个 Item，步骤式布局（从上到下）
- 每个 Item 的 nodeType = Source/Transform

**metadata**：
```typescript
{
  tableName: undefined,
  sqlFragment: `-- ${stepName} 建议：${advice}`,
  layerTag: 'methodology'
}
```

#### Patterns 层 → SQL 模式

**AI 调用**：`generateMeceCanvasLayout('patterns', ...)`

**输出结构**：
- 0-1 个 Space
- 2-4 个 Item，全部为 Transform 类型
- 0-2 条边

**metadata**：
```typescript
{
  tableName: undefined,
  sqlFragment: `-- DuckDB SQL 模板（递归 CTE / 聚合视图 / 时序分析）`,
  layerTag: 'patterns'
}
```

#### Domains 层 → 完整领域

**AI 调用**：`generateMeceCanvasLayout('domains', ...)`

**输出结构**：
- 2-3 个 Space（子领域）
- 6-10 个 Item，网格或分组布局
- 多个边表示领域内关系

### 2.3 填充状态管理

```typescript
const [isAIFilling, setIsAIFilling] = useState(false);
// 填充中：按钮显示 Loader2 旋转动画 + "AI 构思中..."
// 失败：alert 提示，isAIFilling = false
// 成功：setCanvasState 合并新节点/边
```

---

## 3. 功能二：快速清除

### 3.1 分级清除机制（L1/L2/L3）

| 级别 | 范围 | 触发条件 |
|------|------|---------|
| **L1** | 仅清除选中的节点（Item） | 点击「L1 清除选中节点」 |
| **L2** | 清除选中的 Space 及其内部全部内容 | 点击「L2 清除选中空间」 |
| **L3** | 清除画布 + AI 状态 + 面板状态 | 点击「L3 清除全部」 |

**L3 清除内容**：
- `items: []` — 所有自由节点
- `spaces: []` — 所有空间
- `edges: []` — 所有连线
- `selectedItemId: null`
- `selectedSpaceId: null`
- `isAIFilling: false`
- `showSqlPreview: false`
- `showRefinePanel: false`

### 3.2 清除菜单交互

```
[清除 ▼] → 弹出菜单（位于按钮上方）
  ├─ L1 清除选中节点  （文字色 #94a3b8）
  ├─ L2 清除选中空间  （文字色 #94a3b8）
  ├────────────────────
  └─ L3 清除全部      （文字色 #ef4444，加粗）
```

- 菜单 `position: absolute`，`bottom: 100%`，避免遮挡画布内容
- L1/L2 选项在无选中时自动禁用（不显示或置灰）
- 菜单外点击或 Escape 关闭

### 3.3 快捷键

| 操作 | 快捷键 | 行为 |
|------|--------|------|
| 清除全部 | `Escape` | L3 清除，无确认弹窗 |
| 关闭菜单 | `Escape`（菜单打开时） | 仅关闭菜单，不清除 |
| AI 填充 | `Ctrl + Shift + O` | 触发通用 AI 填充 |

---

## 4. 功能三：模块背景说明

### 4.1 CanvasHelpPanel 三标签页结构

```
[指南] [AI 提示词] [MECE 层]
```

**指南 tab**（默认）：适用场景 / 常见错误 / 最佳实践  
**AI 提示词 tab**：预置填充提示词 + 二次优化说明  
**MECE 层 tab**（新增）：五层导航 + 每层详情

### 4.2 MECE 层详情内容（每层含 4 项）

| 字段 | 内容 |
|------|------|
| 层标题 | `{labelZh} / {label}`（如「基础层 / Foundation」） |
| 层描述 | 一句话说明该层在本体论中的角色 |
| 适用场景 | 该层最适合解决什么问题 |
| 常见错误 | 2-3 个典型误用点 |
| 示例 | `CANVAS_MECE_PROMPTS.example(layer)` 快速启发 |

### 4.3 MECE 层 AI 提示词常量

**`CANVAS_MECE_PROMPTS.fill(layer, context)`**  
返回针对指定 MECE 层的完整 AI 填充提示词字符串。

**`CANVAS_MECE_PROMPTS.refine(layer, currentSql, userInstruction)`**  
返回针对指定 MECE 层和用户指令的二次优化提示词。

**`CANVAS_MECE_PROMPTS.example(layer)`**  
返回指定 MECE 层的启发式示例字符串，用于帮助面板展示。

---

## 5. MECE 协同机制

### 5.1 三视图数据联动

```
Data 视图 CRUD 操作（对象/关系 CRUD）
        ↓ 写入 / 刷新
useOntologyStore（单一数据源）
        ↓ 订阅
Canvas 视图（OntologyCanvas）← 可视化 + AI 生成
Graph 视图（D3GraphView）   ← 图谱展示
```

### 5.2 MECE 层颜色语义体系

画布中所有 Space/Item 的边框颜色严格遵循 MECE 层语义：

| 层 | 主色 | 用途 |
|----|------|------|
| Foundation | `#a78bfa`（紫色） | Space 边框、Item 类型标识 |
| Relations | `#38bdf8`（蓝色） | Item 边框（关系型对象） |
| Methodology | `#4ade80`（绿色） | Group 标题色、方法论标注 |
| Patterns | `#fb923c`（橙色） | Transform 节点高亮 |
| Domains | `#fbbf24`（黄色） | Space 颜色域（多子领域区分） |

---

## 6. 实施变更摘要

### 6.1 新增 / 修改文件清单

| 文件 | 操作 | 变更内容 |
|------|------|---------|
| `components/skills/CanvasHelpPanel.tsx` | 修改 | 新增 `CANVAS_MECE_LAYER_DESIGN`、`CANVAS_MECE_PROMPTS`、`MECELayer` 类型、帮助面板 MECE tab |
| `hooks/useOntologyStore.ts` | 修改 | 新增 `CanvasSnapshot`、`MECELayer` 类型、`canvasActiveLayer`、`canvasAiFillLoading`、`canvasSnapshots` 状态及对应 action |
| `services/ontologyAiService.ts` | 修改 | 新增 `MeceCanvasLayoutPlan` 类型、`generateMeceCanvasLayout()` 方法（层感知布局生成） |
| `components/Library/OntologyCanvas.tsx` | 修改 | 新增 `MECE_LAYER_COLORS` 常量、`activeLayer` 状态、`handleMeceFill()`、`handleClear()`、`showClearMenu`；工具栏新增层选择器、MECE AI 填充按钮、分级清除菜单；快捷键增强 |

### 6.2 代码片段引用

**MECE 层颜色映射**（`OntologyCanvas.tsx`）：
```typescript
export const MECE_LAYER_COLORS: Record<MECELayer, string> = {
  foundation:  '#a78bfa',
  relations:   '#38bdf8',
  methodology: '#4ade80',
  patterns:    '#fb923c',
  domains:     '#fbbf24',
};
```

**分级清除**（`OntologyCanvas.tsx`）：
```typescript
const handleClear = (level: 'selected' | 'space' | 'all') => {
  if (level === 'selected') { if (selectedItemId) deleteItem(selectedItemId); }
  else if (level === 'space') { if (selectedSpaceId) deleteSpace(selectedSpaceId); }
  else { /* L3: 清除全部 + AI 状态 */ }
};
```

**MECE 层提示词**（`CanvasHelpPanel.tsx`）：
```typescript
CANVAS_MECE_PROMPTS.fill('foundation', { existingObjects: ['用户', '订单'] })
// → "基于已有对象类型 [...] 和已有对象 [用户 / 订单]，请为画布生成 Foundation 层布局..."
```

---

## 7. 验收标准

- [x] `OntologyCanvas` 工具栏提供 MECE 层选择器 + AI 填充按钮，颜色随层变化
- [x] `handleMeceFill()` 调用 `ontologyAiService.generateMeceCanvasLayout()`，非硬编码
- [x] 清除按钮提供 L1/L2/L3 三级菜单，无选中时 L1/L2 不可见
- [x] Escape 快捷键支持清除全部并关闭菜单/帮助面板
- [x] `CanvasHelpPanel` 新增「MECE 层」tab，展示五层详情和快速示例
- [x] `useOntologyStore` 提供 `canvasActiveLayer`、`canvasAiFillLoading`、`canvasSnapshots` 状态
- [x] `ontologyAiService.generateMeceCanvasLayout()` 支持五层差异化 prompt 生成
- [x] 三视图共享 `useOntologyStore` 单一数据源，MECE 层变化可跨视图传播
