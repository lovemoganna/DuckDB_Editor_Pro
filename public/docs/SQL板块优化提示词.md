# SQL 板块优化提示词

> 基于 MECE 原则优化 SQL 编辑器模块，实现指定能力的快速调用，并根据用户输入即时生成对应的 SQL 模拟方案。整体结构需清晰、调用路径明确，确保在复杂场景下稳定输出可执行的 SQL 逻辑。

---

## 一、模块定位与目标

**核心功能**：SQL 编辑器是系统的核心工作区，支持 SQL 编写、执行、结果展示、智能提示与历史管理。

**优化目标**：
1. 降低用户编写 SQL 的门槛（AI 辅助生成）
2. 提升迭代效率（快速清除、历史复用）
3. 增强可理解性（模块背景、错误提示、AI 协作）

---

## 二、模块优化要求

### 2.1 内嵌「AI 一键填充」功能

**目的**：快速生成示例或启发式内容，降低用户输入门槛。

**实现方式**：

| 填充类型 | 触发方式 | 生成逻辑 |
|---------|---------|---------|
| **代码片段填充** | 点击代码片段标签 | 插入预定义 SQL 模板（CTE、窗口函数、PIVOT 等） |
| **AI 智能填充** | 点击「AI 填充」按钮 | 基于当前选中的表/列，生成上下文相关的 SQL 建议 |
| **自然语言填充** | 输入框描述需求 | 调用 AI 服务生成对应 SQL（需模拟/草稿模式） |

**填充内容示例**：

```typescript
// AI 填充提示词生成逻辑
const generateAIFillPrompt = (tableName?: string, columns?: ColumnInfo[]): string => {
  if (!tableName) {
    return "请先在左侧选择一个表，然后点击 AI 填充";
  }
  
  const columnList = columns?.map(c => `${c.name} (${c.type})`).join(', ') || '未知列';
  
  return `基于表 ${tableName}，可用字段: ${columnList}，生成优化的 SQL 查询。
  
建议生成：
1. SELECT 基本查询（带 WHERE 条件）
2. 聚合查询（GROUP BY + 聚合函数）
3. 时间序列分析（如适用）
4. JOIN 查询模板（如有多表关系）`;
};
```

**UI 设计**：
- 在 SQL 输入框上方或侧边栏提供「片段库」标签页
- 片段按类别分组（基础查询、聚合、JOIN、窗口函数、DuckDB 特有语法）
- AI 填充按钮使用渐变色（monokai-purple → monokai-pink）强调

---

### 2.2 内嵌「快速清除」按钮

**目的**：一键重置输入，提升迭代效率。

**实现方式**：

| 清除范围 | 触发方式 | 行为 |
|---------|---------|------|
| **当前输入框** | 点击「清除」图标 | 清空当前 SQL 输入框内容 |
| **全部输入** | 点击「快速清除」按钮 | 清空所有输入 + 重置为默认值 |
| **历史记录清除** | 确认对话框 | 清除查询历史（可选） |

**UI 设计**：

```jsx
// 快速清除按钮示例
<button
  onClick={handleClearAll}
  className="flex items-center gap-2 px-3.5 py-2.5 
    bg-monokai-pink/10 border border-monokai-pink/40 
    hover:bg-monokai-pink/20 text-monokai-pink 
    font-medium rounded-lg transition-colors"
  title="一键清空所有输入内容"
>
  <Trash2 className="w-4 h-4" />
  <span>快速清除</span>
</button>
```

**增强功能**：
- 清除前弹出确认对话框（防止误操作）
- 支持「撤销」操作（Ctrl+Z 恢复最近一次清除的内容）
- 清除时可选保留「历史记录」或「收藏查询」

---

### 2.3 提供模块背景说明

**目的**：明确使用场景与常见错误，支持用户基于提示与 AI 进行二次优化。

**MECE 结构设计**（相互独立，完全穷尽）：

#### 2.3.1 按技能类型分类的背景说明

| 技能大类 | 标题 | 核心描述 |
|---------|------|---------|
| **SQL 生成** | SQL 生成 / 建模 | 将自然语言需求快速转成可执行的 DuckDB SQL |
| **数据分析** | 指标 / 分析类 | 时间序列、对比、漏斗、留存等分析场景 |
| **数据转换** | 数据转换 / 清洗 | 列转行、行转列、类型转换、字符串处理 |
| **性能优化** | 性能 / 执行计划优化 | EXPLAIN、索引思路与查询改写 |
| **实用工具** | 实用工具 / 辅助 | 测试数据生成、样本抽取、数据摘要 |

#### 2.3.2 每个分类包含的字段

```typescript
type CategoryHelpData = {
  title: string;              // 分类标题
  description: string;       // 核心描述
  scenarios: string[];       // 适用场景（3-5 个）
  commonErrors: string[];    // 常见错误（3-5 个）
  aiHints: string[];         // AI 协作提示（3-5 个）
  quickStart: string[];      // 快速开始步骤（5 个以内）
  bestPractices: string[];  // 最佳实践（3-5 个）
  exampleFlows: { name: string; description: string }[]; // 推荐流程
};
```

#### 2.3.3 具体内容示例（SQL 生成类）

```typescript
const SQL_CATEGORY_HELP = {
  title: 'SQL 生成 / 建模',
  description: '适用于将自然语言需求快速转成可执行的 DuckDB SQL，包括查询、建表、增删改等操作。',
  
  scenarios: [
    '有明确业务问题，需要一条或一组 SQL 直接回答',
    '需要快速搭建表结构或模拟数据场景',
    '已有表和字段，想要生成标准化的 SQL 模板',
    '需要从零开始设计完整的数据模型'
  ],
  
  commonErrors: [
    '未指定表或字段，导致生成的 SQL 含有占位符（如 table_name、col）',
    '在 WHERE 条件中直接拼接中文自然语言而非字段条件',
    '混用不同数据库方言（如 MySQL 语法）导致在 DuckDB 中执行失败',
    '未考虑 NULL 值处理，导致结果不符合预期',
    '列名未加引号，特殊字符列名导致语法错误'
  ],
  
  aiHints: [
    '尽量用「业务意图 + 关键字段名」描述需求，AI 更容易生成稳定 SQL',
    '如果生成结果包含占位符，先用一键示例填充，再按字段手动微调',
    '复杂场景可以先用高级技能拆为多个子查询，再逐步合成',
    '使用 CTE 逐步构建复杂查询，便于调试和维护',
    'DuckDB 特有语法：SUMMARIZE、pivot、unnest 等优先使用'
  ],
  
  quickStart: [
    '1. 选择「SELECT 查询生成」技能',
    '2. 描述你的查询需求',
    '3. 点击「AI 填充」快速生成',
    '4. 查看实时 SQL 预览',
    '5. 复制或执行生成的 SQL'
  ],
  
  bestPractices: [
    '优先使用带列名的 SELECT，避免 SELECT *',
    'WHERE 条件使用参数化查询',
    '大型结果集添加 LIMIT',
    '复杂查询使用 CTE 分解'
  ],
  
  exampleFlows: [
    { name: '查询用户订单', description: 'SELECT → JOIN → WHERE 组合' },
    { name: '创建电商表', description: '自然语言建表 → 模板优化' },
    { name: '复杂分析', description: 'CTE + 窗口函数 + 聚合' }
  ]
};
```

---

## 三、UI 组件设计规范

### 3.1 布局结构

```
┌─────────────────────────────────────────────────────────────┐
│  SQL 编辑器 Header                                          │
│  [标签页: 查询1 | 查询2 | +]              [历史] [收藏] [设置] │
├─────────────────────────────────────────────────────────────┤
│  AI 助手栏                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [AI 一键填充] [片段库 ▼] [快速清除]      [实时预览 ✓] │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 输入框：描述你的 SQL 需求...              [生成 SQL]  │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┬───────────────────────────┐     │
│  │ 侧边栏               │ SQL 编辑器主区域            │     │
│  │ - 历史记录           │ - CodeMirror 编辑器        │     │
│  │ - 收藏查询           │ - 语法高亮                 │     │
│  │ - 片段库             │ - 自动补全                 │     │
│  │ - 表结构             │                            │     │
│  └─────────────────────┴───────────────────────────┘     │
├─────────────────────────────────────────────────────────────┤
│  结果展示区                                                  │
│  [表格] [图表] [JSON]                    [执行时间: xx ms]  │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 配色规范（Monokai 主题）

| 元素 | 颜色 | CSS 类 |
|------|------|--------|
| 主按钮（生成 SQL） | 渐变紫→粉 | `bg-gradient-to-r from-monokai-purple to-monokai-pink` |
| AI 填充按钮 | 绿色 | `bg-monokai-green/10 text-monokai-green` |
| 快速清除按钮 | 粉色 | `bg-monokai-pink/10 text-monokai-pink` |
| 预览开关开启 | 紫色 | `bg-monokai-purple/20 text-monokai-purple` |
| 背景色 | 深色 | `bg-monokai-bg` |
| 侧边栏 | 稍浅 | `bg-monokai-sidebar` |

---

## 四、功能交互流程

### 4.1 AI 一键填充流程

```
用户点击「AI 填充」按钮
       ↓
检测当前选中的表和列信息
       ↓
生成上下文感知的填充提示
       ↓
[如有示例] 合并示例与上下文
       ↓
更新输入框内容
       ↓
显示「已填充」状态提示
```

### 4.2 快速清除流程

```
用户点击「快速清除」按钮
       ↓
[可选] 弹出确认对话框
       ↓
清空所有输入字段
       ↓
重置为默认值（如果有）
       ↓
显示「已清除」状态提示
       ↓
[支持 Ctrl+Z 撤销]
```

### 4.3 实时预览流程

```
用户修改输入（防抖 500ms）
       ↓
验证必填字段是否已填写
       ↓
调用 executeSkill simulateOnly 模式
       ↓
获取生成的 SQL 草稿
       ↓
更新预览区域内容
       ↓
显示复制按钮
```

---

## 五、技术实现要点

### 5.1 状态管理

```typescript
interface SqlEditorState {
  // 输入相关
  sqlContent: string;
  aiPrompt: string;
  
  // AI 相关
  isAiLoading: boolean;
  isGeneratingSuggestion: boolean;
  
  // 预览相关
  showLivePreview: boolean;
  liveSqlPreview: string;
  isGeneratingPreview: boolean;
  
  // 清除相关
  lastClearedContent: string | null;  // 用于撤销
}
```

### 5.2 关键函数

| 函数名 | 功能 | 输入 | 输出 |
|-------|------|------|------|
| `handleAIFill` | AI 智能填充 | skill, currentTable, currentColumns | 更新 inputs 状态 |
| `handleApplyExample` | 示例填充 | exampleInput, exampleName | 合并示例与上下文 |
| `handleClear` | 快速清除 | - | 清空所有输入 |
| `generateLivePreview` | 实时生成预览 | inputs | SQL 字符串 |
| `handleReset` | 重置为默认值 | - | 恢复默认值 |

### 5.3 防抖与缓存

- **实时预览**：500ms 防抖，避免频繁调用 AI
- **历史记录**：本地存储 + 内存缓存
- **撤销栈**：保留最近 10 次清除操作

---

## 六、可选增强功能

### 6.1 SQL 语法验证（本地）

- 使用 `sql-formatter` 格式化 SQL
- 基础语法错误即时提示

### 6.2 执行计划预览

- 集成 `EXPLAIN` 输出展示
- 可视化执行计划树

### 6.3 查询模板市场

- 用户可保存自定义模板
- 支持模板分享（导出/导入 JSON）

---

## 七、验收标准

| 验收项 | 标准 | 测试方法 |
|--------|------|---------|
| AI 一键填充 | 点击按钮后，输入框出现上下文相关的 SQL 建议 | 选中表 → 点击填充 → 检查输入框 |
| 快速清除 | 点击按钮后，所有输入字段被清空 | 点击清除 → 检查所有字段为空 |
| 模块背景说明 | 侧边栏展示 MECE 结构的帮助信息 | 展开帮助面板 → 检查内容完整性 |
| 实时预览 | 输入变化后 1 秒内显示 SQL 预览 | 输入内容 → 观察预览区域 |
| 撤销支持 | 清除后可 Ctrl+Z 恢复 | 清除 → Ctrl+Z → 检查内容恢复 |

---

## 八、参考实现

详见 `components/SkillInvoker.tsx` 中的实现，该组件已完整实现了：
- ✅ AI 一键填充功能（`handleAIFill`、`handleApplyExample`）
- ✅ 快速清除按钮（`handleClear`）
- ✅ MECE 结构的模块背景说明（`CATEGORY_HELP`）
- ✅ 实时 SQL 预览（`generateLivePreview`）

**可复用逻辑**：
- `CATEGORY_HELP` 数据结构 → 迁移至 SqlEditor
- `handleAIFill` 逻辑 → 适配 SqlEditor 的 AI 填充
- 快速清除按钮样式 → 直接复用
