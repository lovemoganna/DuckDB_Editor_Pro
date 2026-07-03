---
name: ontology-viz-unification
doc_type: feature-design
feature: ontology-viz-unification
status: draft
summary: 将 D3GraphView（力导向图）和 OntologyCanvas（画布编辑器）统一为单一可视化入口，以 OntologyCanvas 为主视图，D3GraphView 降级为可选的"探索模式"。
tags: [ontology, visualization, refactor, P0]
created: 2026-06-08
---

# ontology-viz-unification — Design

## 1. 背景与范围

### 问题陈述

本体模块目前有两套并列的可视化系统：

- **D3GraphView**：力导向图，适合快速浏览全貌，但节点位置由物理模拟决定不可控
- **OntologyCanvas**：画布编辑器，支持拖拽节点/连线和精细编辑

两者都通过 `useOntologyStore` 读取同一数据源，在 `OntologyPanel.tsx` 中作为两个独立 Tab 并列（`graph` / `canvas`）。用户不知道什么时候该用哪个，且 Tab 标签文字模糊（"知识图谱" / "结构画布"）。

### 目标

以 **OntologyCanvas 为单一主视图**，D3GraphView 降级为可选的"探索模式"，消除用户的认知选择负担。

### 明确不做

- 不废弃 D3GraphView 的代码（保留复用其 PixiJS 加速层）
- 不重写渲染引擎（保持现有 Canvas 的 RAF 优化）
- 不修改 `useOntologyStore` 的数据结构
- 不改变 Data 视图和 Schema 视图

### 复杂度档位

中型重构 — 涉及 `OntologyPanel.tsx` 视图路由 + UI 文案 + 用户引导，不涉及核心数据流变更。

---

## 2. 方案（现状 → 变化）

### 2.1 名词层（现状 → 变化）

**现状**：

```
VIEW_TABS = [
  { id: 'graph',  label: '知识图谱', sub: '可视化 · 探索概念关系', icon: Network },
  { id: 'data',   label: '数据表',  sub: '表格 · 详细数据查看', icon: Table2 },
  { id: 'canvas', label: '结构画布', sub: '拓扑 · 梳理认知结构', icon: Network, badge: 'SQL' },
]
```

`OntologyPanel.tsx` 第 529-531 行条件渲染：

```tsx
{st.activeTab === 'graph' && <D3GraphView .../>}
{st.activeTab === 'data'  && <OntologyDataView />}
{st.activeTab === 'canvas' && <OntologyCanvas .../>}
```

**变化后**：

```
VIEW_TABS = [
  { id: 'data',   label: '数据表',  sub: '表格 · 详细数据查看', icon: Table2 },
  { id: 'canvas', label: '结构画布', sub: '编辑 · 拖拽节点和连线', icon: Network, badge: 'SQL' },
  { id: 'graph',  label: '探索图谱', sub: '浏览 · 一眼看全貌', icon: Sparkles },  // 新 label
]
```

即：将 `graph` 从第一个默认 Tab 移到最后一位，并重写标签为"探索图谱"——传达"这是浏览模式，不是主要编辑入口"。

同时在 Canvas Tab 区域增加**场景引导 Banner**（用户初次使用或数据为空时显示），说明：
- "想梳理关系、拖拽排版 → 结构画布"
- "想快速浏览、一眼看全貌 → 右上角探索图谱"

### 2.2 编排层（现状 → 变化）

**主流程图（变化后）**：

```
OntologyPanel
├── TabBar
│   ├── 数据表（默认第一项）
│   ├── 结构画布（主编辑入口）
│   └── 探索图谱（可选浏览入口）
│
├── MainContent (条件渲染)
│   ├── activeTab === 'data'  → OntologyDataView
│   ├── activeTab === 'canvas' → OntologyCanvas  ← PRIMARY
│   └── activeTab === 'graph'  → D3GraphView     ← SECONDARY (可折叠/可关闭)
│
└── Canvas SceneGuidance Banner
    └── 仅在 canvas Tab 且数据量 < 5 时显示
```

**关键变化点**：

1. `OntologyPanel.tsx` 的 `VIEW_TABS` 数组：重排顺序 + 重写 label/sub
2. 新增 `SceneGuidanceBanner` 组件：在 Canvas Tab 渲染，包含两个带图标的引导卡片
3. D3GraphView 保持不变（其 PixiJS 加速复用价值高，未来可迁移为 Canvas 的 WebGL 层）
4. 在 Canvas Tab 内增加一个快捷按钮「探索全貌」，点击切换到 graph 视图

### 2.3 挂载点（按"删了它 feature 是否消失"判据）

1. **`components/Library/OntologyPanel.tsx`** — `VIEW_TABS` 数组 + Tab 渲染逻辑（核心挂载点）
2. **`hooks/useOntologyStore.ts`** — `ViewTab` 类型定义（需要确认是否要调整默认值，`activeTab: 'graph'` → `'data'` 或 `'canvas'`）
3. **新建 `components/Library/SceneGuidanceBanner.tsx`** — 场景引导 Banner（纯新增，无破坏点）

### 2.4 推进策略（按 paradigm 切片）

**Step 1：数据层准备**
- 确认 `useOntologyStore` 中 `activeTab` 的初始值是否改为 `'canvas'`
- 评估：改为 `'canvas'` 是否会影响现有用户体验？（旧用户习惯从 graph 进入）
- 结论：保持 `'graph'` 初始值，但调整 Tab 顺序让 Canvas 更突出

**Step 2：视图路由重构**
- 重排 `VIEW_TABS` 数组顺序
- 重写每个 Tab 的 label + sub 文案
- 条件渲染逻辑不变

**Step 3：场景引导 Banner**
- 新建 `SceneGuidanceBanner.tsx`
- 在 Canvas Tab 内渲染（当 `activeTab === 'canvas'` 且 `objects.length < 5` 时）
- 包含两个引导卡片，点击跳转到对应视图

**Step 4：Canvas 内快捷探索按钮**
- 在 `OntologyCanvas` 工具栏增加「探索」按钮（图标：Sparkles）
- 点击调用 `dispatch(ontologyActions.setActiveTab('graph'))`

**Step 5：验证**
- 三种数据量场景（空数据 / 少量 / 大量）下 Tab 切换正常
- D3GraphView 仍可正常渲染和交互

### 2.5 结构健康度评估

- **目标文件**：仅修改 `OntologyPanel.tsx`（~600 行）+ 新建 `SceneGuidanceBanner.tsx`
- **目录健康度**：良好 — `components/Library/` 结构清晰
- **无微重构需求** — 此次不涉及胖文件拆分或目录重组

---

## 3. 验收标准

### 功能性验收

- [ ] `VIEW_TABS` 顺序为 `['data', 'canvas', 'graph']`
- [ ] Canvas Tab 文案为「结构画布 · 编辑 · 拖拽节点和连线」
- [ ] Graph Tab 文案为「探索图谱 · 浏览 · 一眼看全貌」
- [ ] SceneGuidanceBanner 在 Canvas Tab + 数据 < 5 时可见
- [ ] SceneGuidanceBanner 的两个引导卡片分别链接到 Canvas 和 Graph
- [ ] Canvas 工具栏有「探索」按钮，点击切换到 Graph
- [ ] 三种 Tab 切换后内容正确渲染
- [ ] D3GraphView 在 graph Tab 下正常渲染（PixiJS 加速仍工作）

### 明确不做（反向核对）

- [ ] 未修改 `useOntologyStore` 的数据结构
- [ ] 未修改任何 CRUD 操作
- [ ] 未修改 D3GraphView 内部代码
- [ ] 未修改 OntologyCanvas 内部代码

---

## 附录：为什么选 Canvas 为主

| 维度 | D3GraphView | OntologyCanvas |
|------|------------|----------------|
| 节点位置控制 | 不可控（力模拟） | 可控（用户拖拽） |
| 编辑能力 | 无（只读浏览） | 有（CRUD 节点/连线） |
| MECE 层级 | 无 | 有（knowledge 模式） |
| SQL 编译 | 无 | 有（CanvasRightPanel） |
| 性能（>200 节点） | PixiJS 加速 | 纯 React，暂无加速 |
| 维护状态 | 3900 行单文件 | 860 行，功能完整 |
| WebGL 复用 | — | PixiGraphRenderer 可迁移 |

Canvas 在"可控性"和"编辑能力"上全面优于 D3GraphView，且 D3GraphView 的核心价值（PixiJS 加速 + 力导向布局）可以作为未来 Canvas 的可选渲染模式迁移。
