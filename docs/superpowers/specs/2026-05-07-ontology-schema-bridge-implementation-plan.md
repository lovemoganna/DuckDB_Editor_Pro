# Ontology 模块重构 — 实现计划

**关联设计文档**: `docs/superpowers/specs/2026-05-07-ontology-schema-bridge-design.md`
**状态**: 待实施
**版本**: v1.0

---

## 实施原则

- 每次只执行一个 Phase，不跨 Phase 混合提交
- 每个子任务完成后提交一次，便于回滚
- 优先验证 Schema 读取能力，再做推断引擎
- "预设库"Tab 删除放在最后，确认其他功能正常后再执行

---

## Phase 1 — 最小可行产品

### P1.1 新增"我的 Schema"Tab（左侧抽屉第三 Tab）

**涉及文件**：
- `components/Library/OntologyPanel.tsx` — DRAWER_TABS 增加 `schema`
- `components/Library/SchemaTab.tsx` — **新增**，显示 DuckDB 表列表

**验收标准**：
- 打开 Ontology → 左侧抽屉可见"我的 Schema"Tab
- 点击后列出当前 DuckDB 所有表名

**实现步骤**：
1. 在 `OntologyPanel.tsx` 的 DRAWER_TABS 添加 `{ id: 'schema', label: '我的 Schema', icon: Database }`
2. 在抽屉内容区添加 `{drawerTab === 'schema' && <SchemaTab />}`
3. 新建 `SchemaTab.tsx`，调用 `duckDBService.getTables()` 获取表列表
4. 表列表以可勾选卡片形式展示（每张表一个 checkbox + 表名 + 字段数）

**回滚方式**：删除 `SchemaTab.tsx`，还原 DRAWER_TABS

---

### P1.2 Schema 图谱视图（中心区域第三视图）

**涉及文件**：
- `components/Library/OntologyPanel.tsx` — VIEW_TABS 增加 `schema`
- `components/Library/SchemaGraphView.tsx` — **新增**，基于表结构的力导向图

**验收标准**：
- 顶部视图栏可见"Schema 图谱"Tab
- 勾选 Schema Tab 中某些表 → 中心区域显示表结构图谱
- 节点 = 表，边 = 外键关系

**实现步骤**：
1. VIEW_TABS 添加 `{ id: 'schema', label: 'Schema 图谱', sub: '表结构可视化', icon: Table2 }`
2. 新建 `SchemaGraphView.tsx`，复用 D3GraphView 的力导向图布局逻辑
3. 读取被勾选表的列信息（包括外键推断），生成 {nodes: TableNode[], links: FKLink[]}
4. 渲染为 D3 力导向图，节点显示表名，边显示外键列名
5. 在 SchemaTab 中维护选中表状态，传递给 SchemaGraphView

**回滚方式**：删除 VIEW_TABS 中的 schema 项，删除 `SchemaGraphView.tsx`

---

### P1.3 Schema → 本体推断引擎

**涉及文件**：
- `services/schemaInferenceEngine.ts` — **新增**，核心推断逻辑
- `components/Library/SchemaInferencePanel.tsx` — **新增**，推断预览 UI

**验收标准**：
- Schema 图谱中点击"推断本体"按钮
- 弹出面板显示：推断出的对象类型列表 + 关系列表
- 每个推断结果可编辑、可确认

**实现步骤**：
1. 新建 `schemaInferenceEngine.ts`：
   - `inferObjectTypes(tables: TableInfo[]): ObjectType[]`
   - `inferLinks(tables: TableInfo[], fks: FKInfo[]): LinkType[]`
   - `inferObjects(tableData: any[]): Object[]`（可选，Phase 2）
2. 推断规则实现：
   - 表名单数化：`orders` → `Order`
   - 外键列匹配：`user_id` 引用 `users.id` → LinkType `属于`
   - 列名关键词推断：含 `type`/`status` → 属性枚举建议
3. 新建 `SchemaInferencePanel.tsx`：
   - 显示推断结果（对象类型卡片 + 关系连线预览）
   - 每项可编辑名称、描述
   - "确认导入"按钮 → 写入 Ontology 5表
4. 在 `SchemaGraphView.tsx` 添加"推断本体"按钮，触发推断面板

**回滚方式**：删除 `schemaInferenceEngine.ts` 和 `SchemaInferencePanel.tsx`

---

### P1.4 "我的人生"示例引导 Tab

**涉及文件**：
- `components/Library/ExampleGuide.tsx` — **新增**
- `components/Library/OntologyPanel.tsx` — DRAWER_TABS 调整

**验收标准**：
- 左侧抽屉有独立"示例"Tab
- 点击后展示三步引导流程
- 最后一步 CTA 可跳转"我的 Schema"Tab

**实现步骤**：
1. DRAWER_TABS 调整为：`['schema', 'crud', 'mapping']`，示例改为独立入口（顶部按钮或欢迎页）
2. 新建 `ExampleGuide.tsx`，实现三步引导：
   - Step 1: 展示图谱效果（读取现有 life_object 等5表数据渲染）
   - Step 2: 解释本体论基本概念（3张概念说明卡片）
   - Step 3: CTA "开始构建自己的本体" → 切换到 Schema Tab
3. 将示例引导嵌入欢迎页逻辑（首次打开时的 onboarding）

**回滚方式**：还原 DRAWER_TABS，删除 `ExampleGuide.tsx`

---

## Phase 2 — 功能完善

### P2.1 本体图谱数据源切换

**涉及文件**：
- `components/Library/D3GraphView.tsx` — 改为显示推断后的本体
- `components/Library/OntologyPanel.tsx` — 视图 Tab 调整

**变更**：D3GraphView 默认显示 Ontology 5表数据，与 Schema 图谱解耦

---

### P2.2 CRUD 支持导入推断结果

**涉及文件**：
- `hooks/useOntologyStore.ts` — 新增 `batchImportFromSchema(inferred: InferredOntology)` 方法
- `components/Library/OntologyPanel.tsx` — SchemaInferencePanel 触发 store 写入

---

### P2.3 AI 推断增强

**涉及文件**：
- `services/ontologyAiService.ts` — 新增 `suggestSchemaMapping(tables)` 方法
- `SchemaInferencePanel.tsx` — 添加"AI 优化"按钮

---

## Phase 3 — 体验优化

- P3.1: 画布视图与本体图谱数据同步
- P3.2: 本体导出为 DuckDB 表
- P3.3: 多本体支持（命名空间）

---

## 优先级执行顺序

```
P1.1 → P1.2 → P1.3 → P1.4 → P2.1 → P2.2 → P2.3 → P3
```

---

## 删除计划（放在最后）

- `data/ontologyTemplates.ts` 标记废弃 → 移动到 `data/ontologyTemplates.deprecated.ts`
- `OntologyPanel.tsx` 中的"预设库"Tab 代码 → 移除
- `TemplatePanel.tsx` 组件 → 移除（单独文件时可删除整个文件）
- 26 个 SQL 模板对应的执行逻辑 → 移除

---

## 风险与注意事项

| 风险 | 缓解 |
|---|---|
| Schema 推断质量依赖 DuckDB 表结构规范 | 提供手动编辑界面，允许用户修正 |
| 删除预设库可能影响现有用户 | 确认用户无活跃数据后再删除，保留迁移路径 |
| D3 图谱复用可能导致耦合 | SchemaGraphView 独立实现，不复用 D3GraphView 核心逻辑 |
