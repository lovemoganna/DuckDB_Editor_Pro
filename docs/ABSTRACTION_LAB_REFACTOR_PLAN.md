# Abstraction Lab 重构计划（最终版）

> 重构时间：2026-04-11 北京时间
> 核心理念：实验迭代工作流（设计 → 实验 → 迭代）
> 优先级：实验台（Sandbox）为核心

---

## 一、已确认的设计决策

| 决策点 | 选择 |
|--------|------|
| 布局模式 | **Tab 切换**（编辑器 / 结果 / AI 三个 Tab） |
| AI 集成 | **编辑器内联对话**（Inline Chat，类似 VS Code） |
| SQL 执行 | 复用项目已有的 `duckDBService` |
| 存储 | IndexedDB（模板 + 版本历史）、localStorage（草稿） |

---

## 二、三视图架构

```
Abstraction Lab
├── 🧪 实验台（Sandbox）  ← 核心，优先级最高
│   ├── Tab 1: 编辑器（CodeMirror + 内联 AI 对话）
│   ├── Tab 2: 结果预览（表格 / 统计 / 图表）
│   └── Tab 3: AI 协作（对话历史 + 上下文注入）
│
├── 📋 模板库（Templates）  ← 实验的产出物
│   ├── 卡片列表（双击 → 跳转到实验台继续编辑）
│   └── 筛选 + 搜索
│
└── 🔄 版本历史（History）  ← 每次保存都有记录
    └── 时间线 + 版本对比
```

---

## 三、实验台（Sandbox）详细设计

### 3.1 三 Tab 布局

```
┌─────────────────────────────────────────────────────────────┐
│  🧪 抽象实验台                     [保存模板] [执行] 快捷键 │
├─────────────────────────────────────────────────────────────┤
│  [编辑器] [结果] [AI 协作]                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Tab 1 - 编辑器                                            │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ -- 输入 SQL 或描述需求，AI 辅助生成                    │ │
│  │ SELECT ...                                         │ │
│  │                                                       │ │
│  │ ╔═══════════════════════════════════════════════╗     │ │
│  │ ║ 🤖 AI 建议：是否需要添加 WHERE 条件过滤？     ║     │ │
│  │ ╚═══════════════════════════════════════════════╝     │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                             │
│  Tab 2 - 结果预览                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ 列1      │ 列2      │ 列3                          │ │
│  │ ────────│ ────────│ ────────                      │ │
│  │ 数据1    │ 数据2    │ 数据3                        │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                             │
│  Tab 3 - AI 协作                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ 🧑 用户：帮我写一个日活统计                          │ │
│  │                                                       │ │
│  │ 🤖 AI：以下是 DAU 统计 SQL...                        │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 核心交互流程

```
1. 用户在编辑器输入 SQL（或描述需求）
         ↓
2. 点击「执行」或 Ctrl+Enter → 结果 Tab 显示结果
         ↓
3. 对结果不满意 → 切换到编辑器 Tab 继续修改
         ↓
4. 需要 AI 辅助 → 切换到 AI Tab 或使用内联对话
         ↓
5. 满意后 → 点击「保存模板」→ 保存到模板库
         ↓
6. 下次打开 → 双击模板 → 跳转到实验台继续编辑
```

### 3.3 AI 内联对话

在编辑器中：
- 用户选中代码 → AI 分析选中部分
- 用户输入 `/* AI:帮我优化这个查询 */` → AI 自动处理
- AI 建议显示为**可点击的代码片段**，点一下插入

### 3.4 草稿与版本

| 类型 | 存储 | 说明 |
|------|------|------|
| 草稿（Draft） | localStorage | 未保存的实验，自动保存 |
| 模板（Template） | IndexedDB | 已保存到模板库 |
| 版本（Version） | IndexedDB | 每次「另存」创建新版本 |

---

## 四、技术架构

### 4.1 组件结构

```
components/Abstraction/
├── AbstractionLab.tsx          # 主容器（Tab 导航）
├── AbstractionSandbox.tsx       # 实验台视图
│   ├── SandboxEditor.tsx        # 编辑器 + 内联 AI
│   ├── SandboxResults.tsx        # 结果预览
│   └── SandboxAIPanel.tsx        # AI 协作面板
├── AbstractionTemplates.tsx      # 模板库视图
│   └── TemplateCard.tsx          # 模板卡片
├── AbstractionHistory.tsx        # 版本历史视图
│   └── VersionTimeline.tsx       # 时间线
└── index.ts

hooks/
├── useAbstractionSandbox.ts      # 实验台状态
├── useAbstractionTemplates.ts   # 模板库状态
└── useAbstractionHistory.ts     # 版本历史状态

services/
├── abstractionSandboxService.ts   # 实验台业务逻辑
└── abstractionVersionService.ts   # 版本管理业务逻辑

utils/
├── abstractionDraftStorage.ts     # 草稿存储（localStorage）
└── abstractionAIInline.ts       # 内联 AI 解析
```

### 4.2 数据模型

```typescript
// 模板
interface AbstractionTemplate {
  id: string;
  name: string;
  description: string;
  sql: string;
  domain: string;
  tags: string[];
  abstractionPath: AbstractionPath;
  createdAt: number;
  updatedAt: number;
  isFavorite: boolean;
  isSystem: boolean;
  currentVersion: number;
}

// 版本
interface AbstractionVersion {
  id: string;
  templateId: string;
  version: number;
  sql: string;
  changeNote: string;
  createdAt: number;
}

// 草稿
interface AbstractionDraft {
  id: string;
  sql: string;
  result: any;
  createdAt: number;
  updatedAt: number;
}
```

---

## 五、实施步骤（Phase 1 - 核心功能）

### Step 1：基础结构
1. 创建 `AbstractionLab.tsx` — 主容器
2. 创建 `AbstractionSandbox.tsx` — 实验台视图
3. 创建 `useAbstractionSandbox.ts` — 实验台状态

### Step 2：编辑器
4. 创建 `SandboxEditor.tsx` — SQL 编辑器（复用现有 CodeMirror）
5. 创建 `SandboxResults.tsx` — 结果预览
6. 集成 SQL 执行（复用 `duckDBService`）

### Step 3：AI 协作
7. 创建 `SandboxAIPanel.tsx` — AI 协作面板
8. 创建 `abstractionAIInline.ts` — 内联 AI 解析

### Step 4：模板库 & 版本
9. 创建 `AbstractionTemplates.tsx` — 模板库视图
10. 创建 `AbstractionHistory.tsx` — 版本历史视图
11. 更新存储服务支持版本管理

### Step 5：集成
12. 更新 App.tsx 路由
13. 清理旧组件

---

## 六、验证标准

- [ ] 实验台可正常打开，三个 Tab 切换正常
- [ ] 编辑器输入 SQL 可执行并显示结果
- [ ] AI 协作面板可发起对话并插入 SQL
- [ ] 保存模板后可从模板库打开继续编辑
- [ ] 版本历史可查看和恢复
- [ ] 无 TypeScript 编译错误
- [ ] Vite 构建成功

---

## 七、与现有 Abstraction 模块的关系

**现状**：已完成基于 MECE 的 Abstraction 模块重构（12 个组件 + 3 个 Hooks）

**新 Abstraction Lab**：基于实验迭代理念重新设计实验台

**合并策略**：
- 保留已构建的组件作为「模板库」的基础
- 实验台作为新核心视图
- 版本历史作为新增功能
- 最终形态：**一个入口（Abstraction Lab）**，包含三个子视图
