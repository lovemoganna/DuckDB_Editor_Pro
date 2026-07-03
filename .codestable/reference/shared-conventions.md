# shared-conventions — 共享约定

> 项目内所有 AI 任务必须遵循的约定。这些约定是 PROJECT-HARNESS.md 的补充。

## 文件命名约定

| 类型 | 命名规范 | 示例 |
|------|----------|------|
| React 组件 | `PascalCase.tsx` | `OntologyPanel.tsx` |
| Hooks | `camelCase.ts` / `camelCase.tsx` | `useOntologyStore.ts` |
| Services | `kebab-case.ts` | `ontology-ai-service.ts` → 实际是 `ontologyAiService.ts` |
| 类型文件 | `kebab-case.ts` | `abstraction.ts` → 实际是 `types/abstraction.ts` |
| Store | `camelCase.ts` | `useAppStore.ts` |
| 测试文件 | `{name}.test.ts` | `useOntologyStore.test.ts` |

> 注意：项目实际存在命名不一致的情况。以 `duckdbService.ts`、`ontologyAiService.ts` 等现有文件为准。

## 组件组织约定

```
components/
├── Library/          # Library 模块（本体论 + 模板库）
│   ├── Ontology*.tsx       # 本体论相关
│   ├── Canvas*.tsx         # 画布相关
│   └── D3GraphView/        # D3 图谱子模块
├── Abstraction/      # 数据抽象 Lab
├── skills/          # AI Skills
└── ui/              # 共享 UI
```

## 状态管理约定

```
hooks/
├── store/           # Zustand stores（App 全局状态）
└── useOntologyStore.ts  # 本体模块专用（useReducer，不是 Zustand）
```

**关键**：本体模块用 `useReducer` 而不是 Zustand。在 `useOntologyStore` 中读取状态，用 `dispatch` 更新。

## AI 调用约定

```typescript
// ✅ 正确：通过 robustCall
const result = await aiService.robustCall({ prompt, provider });

// ❌ 错误：直接调用底层方法
const result = await aiService.callProvider({...});
```

## DuckDB 操作约定

```typescript
// ✅ 正确：使用 duckdbService 封装
await duckDBService.query(`SELECT * FROM table`);
await duckDBService.ontologyInit(namespace);

// ❌ 错误：直接操作 WASM
```

## 测试约定

```
{sourceFile}.test.ts      # 单元测试
__tests__/                 # 集成测试（如果需要）
```

- 新增功能必须附测试
- 修改 CRUD 逻辑前，先写测试
- 核心路径（ontology store、skill executor）必须有边界 case 测试

## 代码审查约定

每次 AI 生成代码后，检查：

1. **只改任务范围内的文件**（检查 git diff）
2. **类型签名符合 `types.ts`** 中的定义
3. **没有引入新的 `console.error`**（不必要的错误日志）
4. **没有破坏现有 import 链**
5. **乐观更新有对应的回滚逻辑**（如果涉及 `pendingMutations`）

## 本体模块特殊约定

### 不要混用两套可视化

- D3GraphView（力导向）适合浏览
- OntologyCanvas（画布）适合编辑
- **两者不要相互依赖**，都只从 `useOntologyStore` 读取
- 如果要给其中一个加功能，先确认另一个是否需要同样处理

### WASM 同步

DuckDB WASM 操作后可能需要调用 `flushCatalog()` 来确保 catalog 同步。

### Canvas 性能

Canvas 画布的 RAF 批量更新机制是 P0 优化，不要随意改动。
如果需要改 pan/drag 逻辑，先理解 `transformRef` + `dirtyRef` + `rafRef` 三者协同机制。

---

*最后更新：2026-06-08*
