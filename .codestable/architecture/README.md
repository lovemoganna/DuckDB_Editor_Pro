# architecture — 架构文档

## 模块概览

```
duckdb-editor/
├── components/           # UI 组件（按功能域/模块组织）
│   ├── Library/          # Library 模块（含 OntologyApp/LibraryApp 本体论层）
│   ├── Abstraction/      # Abstraction Lab UI（数据抽象）
│   ├── AnalysisHub/      # 数据分析 Hub
│   ├── Learn/            # 教程/学习 UI
│   ├── skills/           # AI Skills 系统 UI
│   ├── schema-generator/ # Schema 生成器 UI
│   ├── theme/            # 主题（monokai / ai-skills）
│   └── ui/               # 基础 UI 组件
├── services/             # 业务逻辑层
│   ├── duckdbService.ts  # DuckDB WASM 封装（核心基础设施）
│   ├── aiService.ts       # AI Provider 调用
│   ├── ontology/         # 本体持久化（ontologyStorage / ontologyInsights）
│   ├── schema/           # Schema 推断
│   ├── skill/            # Skill 系统核心
│   ├── skills/           # Skill 定义/生成器
│   ├── PixiGraphRenderer.ts    # WebGL 图谱渲染
│   ├── SimulationEngine.ts      # 物理引擎（d3-force）
│   └── graphSimulation.worker.ts # Web Worker 物理计算
├── hooks/                # React Hooks
│   ├── store/            # Zustand stores（useAppStore）
│   └── useOntologyStore.ts  # 本体 Store（useReducer，不是 Zustand）
└── types/                # 类型定义
```

## 核心设计决策

### 1. 本体模块数据流

```
DuckDB WASM (持久化)
      ↕ 读写
useOntologyStore (useReducer, 内存缓存 + 状态)
      ↕ 订阅/更新
OntologyPanel (路由 + 视图切换)
      ↕
├── D3GraphView (知识图谱浏览)
└── OntologyCanvas (画布编辑)
```

### 2. 状态管理策略

- **全局 UI 状态** → Zustand store (`hooks/store/useAppStore.ts`)
- **本体模块状态** → useReducer (`hooks/useOntologyStore.ts`) — 不是 Zustand
- **组件本地状态** → React `useState` / `useRef`

### 3. 三层可视化架构

| 层级 | 技术 | 文件 | 用途 |
|------|------|------|------|
| React 层 | React + SVG | `OntologyCanvas.tsx` | 画布编辑 |
| D3 层 | D3.js + SVG | `D3GraphView.tsx` | 力导向图 |
| WebGL 层 | PixiJS | `services/PixiGraphRenderer.ts` | >200 节点时加速 |

### 4. AI Skill 系统

```
用户输入
  → skillRouter.analyzeIntent()  [意图分类]
  → skillRouter.suggestSkills()  [技能推荐]
  → skillExecutor.execute()       [执行]
      ├── GeneratorRegistry.lookup(generatorId)  [模板生成]
      └── aiService.robustCall()               [AI 降级]
```

## 架构约束

- `services/` 不得依赖 `components/`（单向依赖）
- AI 调用必须通过 `aiService.robustCall()`，不直接用 `callProvider`
- 本体模块的 CRUD 操作使用乐观更新（`pendingMutations`）
- `DuckDB WASM` 是唯一数据库，所有数据存储在浏览器 IndexedDB + DuckDB WASM 内存表

## 待记录

- 详细模块架构（AnalysisHub、Abstraction、Skill 系统）
- 接口契约（模块间协议）
- 数据流图

---

*最后更新：2026-06-08*
