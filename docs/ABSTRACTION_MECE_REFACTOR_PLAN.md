# Abstraction 模块 MECE 重构计划

> 重构时间：2026-04-11 北京时间  
> 目标：彻底重构 Abstraction 数据抽象表模块，遵循 MECE 原则

---

## 一、现状 MECE 分析

### 当前模块的核心价值
Abstraction 模块的目标：**将 SQL 查询逻辑封装为可复用、可组合的"抽象模板"**，通过 `concept → property → relation → instance` 四层路径实现快速定位与调用。

### MECE 视角问题定位

| MECE 维度 | 当前状态 | 问题 |
|-----------|---------|------|
| **完整性（Mutually Exclusive）** | 仅覆盖 CRUD + 简单 AI mock | 缺少：验证、导入导出、多维度筛选、AI 真实调用 |
| **互斥性（Collectively Exhaustive）** | abstractionLevel 和 SqlOperation 未充分利用 | 筛选维度单一，层级和操作未独立组合 |

### 关键发现
1. **AI 生成是假数据**：组件内 `handleAIGenerate` 仅用 `setTimeout` 返回硬编码 SQL，**未调用任何真实 AI 服务**
2. **组件严重耦合**：945 行组件混在一起（UI / 状态 / AI / 存储），无法独立测试
3. **无用 prop 残留**：`ontologyEntries` prop 传入但从未使用
4. **Ontology 与 Abstraction 职责不清**：两者都定义了 `abstractionLevel`，但属于不同概念层级
5. **MECE 层与 SQL Operation 混淆**：`abstractionPath`（概念层）与 `operation`（操作类型）属于不同维度，应独立组合

---

## 二、MECE 架构设计

### 维度一：按功能层次（5 个互斥模块）

```
Abstraction 模块
├── 1. 模板管理层（Template Management）
│   - 抽象表的 CRUD 操作
│   - 模板的收藏、标记、系统/用户分类
│
├── 2. AI 生成层（AI Generation）  ← 当前为假数据，需修复
│   - 调用 ontologyAiService 真实生成
│   - 支持 8 种 operation × 4 种 level 组合
│   - 生成结果预览、采纳、编辑
│
├── 3. 搜索与筛选层（Search & Filter）
│   - 按 domain / operation / abstraction level / tags 多维筛选
│   - 全文搜索（name、description、sqlTemplate）
│   - 快速清除
│
├── 4. 执行与验证层（Execution & Validation）
│   - SQL 模板参数替换预览
│   - 语法验证
│   - 参数完整性校验
│
└── 5. 导入导出层（Import/Export）
    - JSON 格式导入/导出
    - 示例模板库管理
    - 批量填充示例数据
```

### 维度二：按 SQL 操作类型（8 个互斥类别）

```
SELECT | INSERT | UPDATE | DELETE | AGGREGATE | JOIN | WINDOW | CTE
```

每个操作类型对应一种 SQL 生成能力，AI 可根据操作类型选择不同的生成策略。

---

## 三、目标文件结构

```
components/Abstraction/
├── AbstractionPanel.tsx          # 主容器（三栏布局），~100 行
├── AbstractionList.tsx            # 左侧列表视图 + 卡片
├── AbstractionDetail.tsx          # 中间详情面板
├── AbstractionForm.tsx             # 创建/编辑表单（Modal）
├── AbstractionSearchBar.tsx        # 搜索栏（含多维筛选器）
├── AbstractionAIPanel.tsx         # 右侧 AI 生成面板
├── AbstractionPathTag.tsx          # 抽象路径 Badge 渲染
├── AbstractionHelp.tsx             # 帮助面板（可折叠）
├── AbstractionExportDialog.tsx     # 导入导出对话框
├── AbstractionCard.tsx             # 列表项卡片
├── AbstractionEmptyState.tsx       # 空状态
├── index.ts                        # 统一导出

hooks/
├── useAbstractionTable.ts          # 抽象表状态管理（提取组件内 useState）
├── useAbstractionAI.ts            # AI 生成逻辑（调用 ontologyAiService）
└── useAbstractionFilters.ts        # 筛选状态（独立出来便于复用）

services/
├── abstractionService.ts           # 抽象表业务逻辑（封装 libraryStorage）
└── abstractionPromptBuilder.ts     # AI 提示词构建

types/
└── abstraction.ts                  # 抽象模块专用类型（补充 types.ts）

utils/
├── abstractionValidator.ts         # 抽象表验证工具
├── abstractionImportExport.ts      # JSON 导入导出工具
└── abstractionSeedData.ts          # 示例数据（从组件内 SAMPLE_TABLES 迁移）
```

---

## 四、核心类型定义 (`types/abstraction.ts`)

```typescript
import { AbstractionTable, AbstractionSqlOperation, AbstractionLevel } from '../../types';

// 导出操作级别常量
export const OPERATION_CONFIG: Record<AbstractionSqlOperation, OperationMeta> = {
  SELECT:    { label: '查询', color: 'monokai-blue', icon: Search },
  INSERT:    { label: '插入', color: 'monokai-green', icon: Plus },
  UPDATE:    { label: '更新', color: 'monokai-yellow', icon: Edit3 },
  DELETE:    { label: '删除', color: 'monokai-red', icon: Trash2 },
  AGGREGATE: { label: '聚合', color: 'monokai-purple', icon: Calculator },
  JOIN:      { label: '关联', color: 'monokai-pink', icon: Link2 },
  WINDOW:    { label: '窗口', color: 'monokai-orange', icon: Layers },
  CTE:       { label: 'CTE',  color: 'monokai-cyan', icon: Database }
};

export const LEVEL_CONFIG: Record<AbstractionLevel, LevelMeta> = {
  concept:   { label: '概念', color: 'monokai-purple' },
  property:  { label: '属性', color: 'monokai-blue' },
  relation:  { label: '关系', color: 'monokai-green' },
  instance:  { label: '实例', color: 'monokai-yellow' }
};

// 抽象表筛选状态
export interface AbstractionFilters {
  domain: string;
  operation: AbstractionSqlOperation | 'all';
  abstractionLevel: AbstractionLevel | 'all';
  searchQuery: string;
  tags: string[];
  isFavorite?: boolean;
  isSystem?: boolean;
}

export const DEFAULT_FILTERS: AbstractionFilters = {
  domain: 'all',
  operation: 'all',
  abstractionLevel: 'all',
  searchQuery: '',
  tags: [],
};

// AI 生成请求
export interface AbstractionGenerationRequest {
  concept: string;
  property?: string;
  relation?: string;
  operation: AbstractionSqlOperation;
  context?: string;
}

// AI 生成结果（转换自 ontologyAiService 的类型）
export interface AbstractionGenerationResult {
  sql: string;
  explanation: string;
  template?: string;
  parameters?: Array<{ name: string; type: string; description: string; defaultValue?: string }>;
}

// 帮助数据
export interface AbstractionHelpData {
  title: string;
  description: string;
  scenarios: string[];
  commonErrors: string[];
  aiHints: string[];
  quickStart: string[];
  bestPractices: string[];
}
```

---

## 五、核心 Hook 设计

### `useAbstractionTable.ts`

```typescript
// 状态导出：封装组件内所有 useState 逻辑
export const useAbstractionTable = () => {
  // 状态
  const [tables, setTables] = useState<AbstractionTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<AbstractionTable | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTable, setEditingTable] = useState<AbstractionTable | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 副作用：初始化加载
  useEffect(() => {
    loadTables();
  }, []);

  // CRUD 回调
  const handleAdd = useCallback(async (table) => { ... }, []);
  const handleDelete = useCallback(async (id) => { ... }, []);
  const handleUpdate = useCallback(async (table) => { ... }, []);
  const handleToggleFavorite = useCallback(async (id) => { ... }, []);

  return {
    tables, selectedTable, setSelectedTable,
    showForm, setShowForm, editingTable, setEditingTable,
    copiedId, setCopiedId, isLoading,
    handleAdd, handleDelete, handleUpdate, handleToggleFavorite,
    filteredTables,  // 注入 useAbstractionFilters 的结果
    loadTables
  };
};
```

### `useAbstractionAI.ts`

```typescript
// 替换 mock AI 为真实 ontologyAiService 调用
export const useAbstractionAI = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSQL, setGeneratedSQL] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const generate = useCallback(async (request: AbstractionGenerationRequest) => {
    setIsGenerating(true);
    setError(null);

    try {
      // 根据 operation type 选择 AI 能力
      let result: AbstractionGenerationResult;

      switch (request.operation) {
        case 'AGGREGATE':
          result = await ontologyAiService.generatePatternSQL({
            patternType: 'aggregation',
            context: request.context
          });
          break;
        case 'WINDOW':
          result = await ontologyAiService.generatePatternSQL({
            patternType: 'window',
            context: request.context
          });
          break;
        case 'JOIN':
          result = await ontologyAiService.generateObjectModel({ withLinks: true });
          break;
        default:
          result = await ontologyAiService.generateObjectModel();
      }

      setGeneratedSQL(result.sql);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 生成失败');
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsGenerating(false);
  }, []);

  const clear = useCallback(() => {
    setGeneratedSQL('');
    setError(null);
  }, []);

  return { generate, isGenerating, generatedSQL, error, abort, clear };
};
```

---

## 六、数据库存储层优化 (`libraryStorage.ts`)

补充以下能力：

```typescript
// 1. 批量插入（支持一键填充示例数据）
export const batchSaveAbstractionTables = async (
  tables: Omit<AbstractionTable, 'id' | 'createdAt' | 'updatedAt'>[]
): Promise<AbstractionTable[]> => { ... }

// 2. 按 filters 查询（支持 domain、operation、abstractionLevel 索引）
export const queryAbstractionTables = async (
  filters: AbstractionFilters
): Promise<AbstractionTable[]> => { ... }

// 3. 模糊搜索（name + description + sqlTemplate 全文检索）
export const searchAbstractionTables = async (
  query: string
): Promise<AbstractionTable[]> => { ... }

// 4. 切换收藏状态
export const toggleAbstractionFavorite = async (id: string): Promise<void> => { ... }

// 5. 统计摘要
export const getAbstractionStats = async (): Promise<{
  total: number;
  byDomain: Record<string, number>;
  byOperation: Record<string, number>;
}> => { ... }
```

---

## 七、实施步骤

### Phase 1：类型系统 + Hooks（基础层）

1. 创建 `types/abstraction.ts` — 补充类型和常量
2. 创建 `hooks/useAbstractionFilters.ts` — 筛选状态
3. 创建 `hooks/useAbstractionTable.ts` — 状态管理
4. 创建 `hooks/useAbstractionAI.ts` — **真实 AI 调用**（替换 mock）

### Phase 2：工具层

5. 创建 `utils/abstractionValidator.ts` — 验证工具
6. 创建 `utils/abstractionSeedData.ts` — 示例数据迁移
7. 创建 `utils/abstractionImportExport.ts` — 导入导出

### Phase 3：服务层

8. 创建 `services/abstractionService.ts` — 业务逻辑封装
9. 创建 `services/abstractionPromptBuilder.ts` — AI 提示词构建
10. 更新 `services/libraryStorage.ts` — 补充缺失方法

### Phase 4：组件层（MECE 拆分）

11. 创建 `components/Abstraction/AbstractionCard.tsx` — 列表卡片
12. 创建 `components/Abstraction/AbstractionSearchBar.tsx` — 搜索筛选
13. 创建 `components/Abstraction/AbstractionList.tsx` — 列表视图
14. 创建 `components/Abstraction/AbstractionDetail.tsx` — 详情面板
15. 创建 `components/Abstraction/AbstractionPathTag.tsx` — 路径标签
16. 创建 `components/Abstraction/AbstractionForm.tsx` — 表单 Modal
17. 创建 `components/Abstraction/AbstractionAIPanel.tsx` — AI 面板
18. 创建 `components/Abstraction/AbstractionHelp.tsx` — 帮助面板
19. 创建 `components/Abstraction/AbstractionExportDialog.tsx` — 导入导出
20. 创建 `components/Abstraction/AbstractionEmptyState.tsx` — 空状态
21. 创建 `components/Abstraction/AbstractionPanel.tsx` — **主容器**（~100 行）
22. 创建 `components/Abstraction/index.ts` — 统一导出
23. **删除** `components/Library/AbstractionTablePanel.tsx`

### Phase 5：集成与测试

24. 更新 `App.tsx` — 替换组件引用
25. 更新 `components/ui/index.ts` — 注册导出
26. 编写 `services/abstractionService.test.ts` — 单元测试
27. 运行开发服务器验证功能

---

## 八、关键技术决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 组件拆分粒度 | 按 UI 区域拆分 | 符合 MECE 独立功能区隔原则 |
| AI 集成 | 调用 `ontologyAiService` | 复用现有 AI 服务，避免重复造轮子 |
| 状态管理 | React hooks 本地状态 | 模块内状态简单，无需全局 store |
| 导入导出格式 | JSON | 易于阅读和程序处理 |
| 示例数据管理 | 独立文件 | 便于维护和扩展 |
| 数据持久化 | 复用 IndexedDB | 保持现有架构一致性 |

---

## 九、验证标准

重构完成后，Abstraction 模块应满足：

- [ ] **AI 生成真实调用**：不再使用 `setTimeout` mock，返回真实 AI 生成的 SQL
- [ ] **MECE 筛选**：支持按 domain + operation + abstractionLevel 三维度独立筛选
- [ ] **组件可独立测试**：每个组件 Props 接口清晰，可单独渲染
- [ ] **数据可导入导出**：支持 JSON 格式的批量导入/导出
- [ ] **模板验证**：SQL 模板参数与定义一致
- [ ] **示例数据丰富**：提供 10+ 不同 operation + level 组合的示例模板
- [ ] **无无用依赖**：移除 `ontologyEntries` 无用 prop，Ontology 与 Abstraction 完全解耦
- [ ] **类型安全**：所有 Props 使用 TypeScript interface
