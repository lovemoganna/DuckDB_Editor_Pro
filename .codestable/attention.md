# attention.md — 开始前必读

> AI 每次启动时读取此文件。它告诉 AI：这个项目的特殊情况、路径陷阱、运行约束。

## 项目配置

- **项目根目录**：`C:\Users\luoyu\Desktop\Duckdb_Manager\duckdb-editor`
- **技术栈**：React 18 + TypeScript + Vite + Zustand + TailwindCSS + DuckDB WASM
- **包管理器**：npm / pnpm
- **构建命令**：`npm run dev`（开发）或 `npm run build`（生产构建）
- **测试命令**：`npm test`
- **类型检查**：`npx tsc --noEmit`

## Windows 路径注意事项

- 项目在 Windows 上开发，文件路径使用正斜杠 `/`（与 git 和 Vite 兼容）
- Git status 中的反斜杠路径（如 `components\Library\`）是 Windows 显示格式，不是实际文件
- 实际文件都在 `components/Library/`、`services/`、`hooks/` 等正斜杠路径下

## 本体(Ontology)模块特殊说明

本体模块是项目最复杂、最需要谨慎操作的部分。

### 核心数据模型

本体模块使用 **五表结构**（所有表都在 DuckDB WASM 中）：

```
{namespace}_object_type     — 对象类型（类似"用户"这类概念）
{namespace}_object          — 对象实例（具体的"张三"）
{namespace}_link_type      — 关系类型（类似"朋友"）
{namespace}_link           — 关系实例（具体谁是谁的朋友）
{namespace}_action          — 行动（任务/事件）
{namespace}_introspection   — 反思记录
{namespace}_insight         — 洞察记录
```

默认 `namespace` 为 `'life'`。

### 关键文件

| 文件 | 职责 |
|------|------|
| `hooks/useOntologyStore.ts` | 本体模块单一数据源（useReducer，不是 Zustand） |
| `components/Library/OntologyPanel.tsx` | 本体 Tab 主入口 |
| `components/Library/OntologyCanvas.tsx` | 画布编辑器（~860行，React + SVG） |
| `components/Library/D3GraphView.tsx` | 知识图谱可视化（~3900行，D3 + SVG + PixiJS） |
| `services/ontologyAiService.ts` | AI 编排层 |
| `services/ontologyModelingService.ts` | 建模编排层 |
| `services/ontology/ontologyStorage.ts` | 持久化层 |
| `services/PixiGraphRenderer.ts` | WebGL 加速渲染器 |

### 视觉架构（两套并列）

```
OntologyPanel.tsx
├── D3GraphView.tsx        — 力导向图（浏览用，不可编辑节点位置）
└── OntologyCanvas.tsx     — 画布（编辑用，可拖拽节点/连线）
```

**两套系统并存是已知的架构问题**，正在规划统一方案。不要随意修改两者之一而忽略另一个。

### DuckDB WASM 同步问题（已知 bug）

`ontologyInit()` 后 catalog 可能未同步，导致 `getTables()` 返回过期数据。

**Workaround** 已在 `useHandleInitOnly()` 中实现（`OntologyPanel.tsx` 第 89 行）：
```typescript
await duckDBService.ontologyInit();
await duckDBService.flushCatalog(); // ← 关键步骤
```

**用户体验问题**：用户初次进入或数据已存在但不显示时，不知道要点击刷新。已在 `GraphEmptyState` 中增加提示文案「若数据已存在但未显示，请点击下方刷新按钮」。

### 测试覆盖

本体模块测试极少，仅有：
- `hooks/store/useOntologyStore.test.ts`
- `services/ontology/ontologyStorage.test.ts`

修改 CRUD 逻辑前，优先写测试。

## AI 配置

多 Provider 支持：Google Gemini（默认）、Claude、Groq、OpenAI。
配置入口在 App 设置面板。

## 已知的硬禁止事项

- **不修改 `duckdbService.ts` 的 WASM 封装方式**
- **不删除 `types.ts` 中的类型定义**
- **不修改 `aiService.ts` 的多 Provider 路由逻辑**
- **不重构 `skillExecutor.ts` 的 generator→AI 降级流程**
- **不删除 `components/Library/OntologyCanvas.tsx` 或 `D3GraphView.tsx`**，两者都正在使用中

## 代码风格

- 文件命名：`kebab-case.ts` / `kebab-case.tsx`
- 函数命名：`camelCase`
- 类命名：`PascalCase`
- 常量命名：`SCREAMING_SNAKE_CASE`
- 类型定义：与接口文件同级的用 `PascalCase`

## 关键参考实现

- 最佳参考：`services/skillExecutor.ts` — 执行流程最清晰
- 本体模块最佳参考：`hooks/useOntologyStore.ts` — 数据流最完整

---

*最后更新：2026-06-08 | 神秘屋风险评级：危*
