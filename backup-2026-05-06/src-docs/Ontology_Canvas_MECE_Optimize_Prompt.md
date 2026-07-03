# Ontology 高阶画布优化提示词（MECE 体系）

---

## 优化目标

基于 MECE 原则系统性优化 Ontology 本体论模块的**高阶画布**（OntologyCanvas），聚焦**格调统一**、**排版布局规范**与**使用体验流畅**三大维度。同步实现 AI 一键拓扑编排、图谱节点自动生成与即时 SQL 模拟输出，确保在复杂场景下稳定输出可执行的拓扑 SQL。

**当前高阶画布存在的主要问题：**

1. **格调层面**：MECE 层颜色语义不统一，部分节点/边未严格遵循层色标注；深色主题下对比度不足；字体层级模糊
2. **排版布局层面**：Space/Item 间距无网格对齐；工具栏按钮密度过高；Edge 贝塞尔曲线弧度不统一；缩放步进值不合理
3. **使用体验层面**：拖拽 ghost 透明度不明确；空画布无引导提示；缺少多选/框选；清除逻辑不完整；AI 填充为硬编码占位

---

## 模块现状概览

Ontology 高阶画布当前包含三个核心视图：

| 视图 | 组件文件 | 核心能力 | AI 能力现状 |
|------|----------|----------|-------------|
| **Canvas** | `components/Library/OntologyCanvas.tsx` | Space/Group/Item 自由拖拽、拓扑编译为 CTE SQL、持久化到 DuckDB | AI 填充为硬编码，缺少设计规范 |
| **Graph** | `components/Library/D3GraphView.tsx` | D3 力导向图谱、TypeHub/Instance/Action 三层节点、边权重可视化 | 无 AI 填充入口 |
| **Panel** | `components/Library/OntologyPanel.tsx`（内嵌 Data 视图） | CRUD 表格、基础数据管理 | 无 AI 协作引导 |

### 现有 Canvas 架构

```
OntologyCanvas 内部结构：
  Toolbar: [层选择器] [AI 填充] [AI 一键填充] [指南] [预览 SQL] [清除 ▼]
  Canvas: OntologyCanvasInner (5000x5000 可缩放画布)
    - SpaceNode（空间容器，带颜色语义）
    - ItemNode（节点，支持 Source/Transform/Sink/Control 类型）
    - SVG Edge（贝塞尔连接线，dagre auto-layout）
  RightPanel: CanvasNodeInspector / SQL Preview / RefinePanel
  CanvasHelpPanel: [指南] [AI 提示词] [MECE 层] 三标签

共享依赖：
  useOntologyStore    — canvasActiveLayer, canvasAiFillLoading, canvasSnapshots
  ontologyAiService   — generateCanvasLayout / generateMeceCanvasLayout / generateGraphLayout
  CanvasTopologyManager — 拓扑编译为 DuckDB CTE SQL
```

---

## 模块优化要求（适用于 Ontology 高阶画布所有视图）

### 1. 内嵌「AI 一键填充」功能

**目标**：降低拓扑编排门槛，AI 自动生成 Space/Item/Edge 结构和图谱节点布局，实现从语义描述到可执行 SQL 的端到端生成。

**实现要求：**

- OntologyCanvas 和 D3GraphView 均需提供 AI 填充入口
- 根据当前 MECE 层上下文智能生成内容：
  - **Foundation 层**：输入概念描述 → 生成 object_type + object 实例完整模型（Space = 对象类型，Item = 实例）+ 五表 DDL + sqlFragment
  - **Relations 层**：选择源/目标对象 → 生成 link_type + link 实例 + 权重建模方案（树状或线性拓扑）
  - **Methodology 层**：输入业务场景 → 生成步骤式布局（Source → Transform），每个节点含方法论建议
  - **Patterns 层**：选择模式类型 → 生成 Transform 节点组 + DuckDB SQL 模板（递归 CTE / 聚合视图 / 时序分析）
  - **Domains 层**：选择/输入领域 → 生成 2-3 个 Space（子领域）+ 6-10 个 Item 的完整领域拓扑
  - **通用填充**：已有对象列表 → 调用 `generateCanvasLayout(scene)` 生成空间组织方案
  - **图谱填充**：输入话题描述 → 调用 `generateGraphLayout(topic)` 生成 D3 节点布局
- 填充过程显示加载动画 + 终止按钮
- 填充结果支持二次编辑，确认后一键「采用并入库」或「注入 SQL 编辑器」

**AI 填充示例（MECE 层 × 场景）：**

| 层 | 输入 | 输出 |
|----|------|------|
| Foundation | 「用户画像」 | Space[UserProfile] + Item 实例 3 个 + DDL CREATE TABLE |
| Relations | 「员工-公司雇佣」 | Space[Employee/Company] + Item + EMPLOYED_BY 边 + 时态权重 SQL |
| Methodology | 「遗留系统整合」 | 步骤式拓扑：盘点→抽象→映射→生成，4 个 Transform 节点 |
| Patterns | 「用户路径追踪」 | 递归 CTE Transform 节点 + latest_path_view |
| Domains | 「家庭财务管理」 | 3 个 Space（收支/资产/预算）+ 8 个 Item + 完整种子数据 |
| 通用画布 | 已有对象[用户, 订单, 商品] | Space[数据源/处理层] + Group + Item 拓扑 + edges |

### 2. 内嵌「快速清除」功能

**目标**：提升迭代效率，支持分级一键重置输入状态，确保清除操作覆盖画布、AI 状态与面板状态。

**实现要求：**

- 每个画布均需提供分级清除入口（L1/L2/L3）
- 清除范围定义：

| 级别 | 范围 | 触发条件 |
|------|------|----------|
| **L1** | 仅清除选中的节点（Item） | 有 selectedItemId 时可用 |
| **L2** | 清除选中的 Space 及其内部全部内容 | 有 selectedSpaceId 时可用 |
| **L3** | 清除画布 + AI 状态 + 面板状态 | 始终可用，红色高亮 |

- L3 清除内容完整清单：
  - `items: []`
  - `spaces: []`
  - `edges: []`
  - `selectedItemId: null`
  - `selectedSpaceId: null`
  - `isAIFilling: false`
  - `showSqlPreview: false`
  - `showRefinePanel: false`
- 支持快捷键（Escape → L3 清除；菜单打开时 Escape 仅关闭菜单）
- 清除后保持视图模式，仅重置画布内容

**清除菜单交互规范：**

```
[清除 ▼] → 弹出菜单（位于按钮上方）
  ├─ L1 清除选中节点  （selectedItemId 存在时显示，置灰禁用）
  ├─ L2 清除选中空间  （selectedSpaceId 存在时显示，置灰禁用）
  ├────────────────────
  └─ L3 清除全部      （文字色 #ef4444，加粗）
```

### 3. 提供模块背景说明与 AI 二次优化引导

**目标**：明确使用场景与常见错误，支持用户与 AI 协作进行拓扑迭代优化。

**实现要求：**

#### 3.1 MECE 五层模块背景说明

每个层级提供四个维度的说明：

| 维度 | 内容要求 |
|------|----------|
| **定位说明** | 该层在本体论中的角色与解决的问题 |
| **使用场景** | 典型用例列表（3-5 个） |
| **常见错误** | 易错点提示（2-3 个） |
| **最佳实践** | 推荐使用方式 |

#### 3.2 与 AI 协作引导

在 CanvasHelpPanel（指南 tab）或右侧 SQL 预览面板提供：

- **上下文提示**：基于当前 MECE 层的预置填充提示词
- **示例展示**：可点击复制的示例请求（copy 按钮）
- **拓扑洞察**：AI 分析当前拓扑的依赖路径、数据流向、潜在优化点
- **二次优化入口**：SQL 预览区底部「再细化一下...」输入框，支持基于当前 SQL 继续迭代

---

## 设计审计（格调 / 排版布局 / 使用体验）

### 1. 格调一致性

#### 1.1 MECE 层颜色语义体系

画布中所有 Space/Item 的边框颜色严格遵循 MECE 层语义，不得混用：

| 层 | 主色 | 十六进制 | 用途 |
|----|------|---------|------|
| Foundation | 紫色 | `#a78bfa` | Space 边框、Item 类型标识、层标签 |
| Relations | 蓝色 | `#38bdf8` | Item 边框（关系型对象）、连接线 |
| Methodology | 绿色 | `#4ade80` | Group 标题色、方法论标注、步骤连线 |
| Patterns | 橙色 | `#fb923c` | Transform 节点高亮、模式标签 |
| Domains | 黄色 | `#fbbf24` | Space 颜色域（多子领域区分）、领域标签 |

**审计检查点：**

- [ ] 所有 SpaceNode 的边框颜色必须与其内含 Item 的层属性一致
- [ ] ItemNode 的类型边框颜色（Source/Transform/Sink/Control）与 MECE 层颜色不冲突时优先遵循 MECE 层色
- [ ] 连接线（Edge）颜色与源节点/目标节点的层色保持一致性
- [ ] 深色主题（monokai-bg `#0d0d14`）下，所有文字与背景对比度满足 WCAG AA（≥ 4.5:1）

#### 1.2 字体层级

| 元素 | 字号 | 字重 | 颜色 |
|------|------|------|------|
| Space 标题 | 14px | 600 (semibold) | `#e2e8f0` |
| Item 标签 | 12px | 500 (medium) | `#cbd5e1` |
| metadata 注释 | 10px | 400 (normal) | `#64748b` |
| MECE 层标签 | 10px | 500 | 对应层颜色 |
| SQL 预览代码 | 11px | 400 | `#a5f3fc` (青色等宽) |

#### 1.3 图标风格统一性

- 所有图标统一使用 `lucide-react`，尺寸规范：
  - 工具栏按钮图标：16px
  - 节点内图标：12px
  - 帮助面板图标：14px
- 同一类型的操作使用相同图标（如所有「添加」操作统一使用 `Plus`）

### 2. 排版布局

#### 2.1 网格系统

- Space / Item 间距对齐到 **8px 网格**（间距值：8 / 16 / 24 / 32 / 48）
- Item 最小尺寸限制：**宽度 ≥ 120px，高度 ≥ 48px**（防止标签溢出）
- Space 内边距：**16px**
- Space 之间间距（无重叠）：**≥ 24px**

#### 2.2 工具栏布局

工具栏按钮分组规范：

```
[层选择器 ▼] | [AI 填充] [AI 一键填充] | [智能布局] | [指南] [预览 SQL] | [清除 ▼]
```

- 分组之间使用 `|` 分隔符，间距 8px
- AI 相关按钮（填充/布局）使用 `bg-indigo-500/30` 背景色区分
- 「清除」按钮组始终靠右，使用下拉菜单

#### 2.3 Edge 连接线样式

- 使用贝塞尔曲线（Quadratic Bezier），弧度系数 **k = 0.4**
- 箭头大小：8px，等边三角形
- 线宽：2px（普通）、3px（选中时高亮）
- 线色：与源节点的 MECE 层颜色一致
- hover 效果：线宽从 2px 扩展到 3px + 发光阴影

### 3. 使用体验

#### 3.1 拖拽反馈

| 状态 | 视觉表现 |
|------|----------|
| 拖拽开始 | ghost 节点透明度 `opacity: 0.6`，原节点添加虚线边框 |
| 拖拽中 | 实时跟随鼠标，ghost 节点添加 `box-shadow: 0 8px 24px rgba(0,0,0,0.4)` |
| 拖拽释放 | 吸附到 8px 网格，300ms ease-out 回弹动画 |
| 放置无效 | 红色闪烁（200ms × 2），返回原位置 |

#### 3.2 节点连接

- 连接线吸附到节点的触发阈值：**20px**（超出后自动断开）
- 连接线起点/终点绑定到 Item 节点的东南西北四个锚点
- 创建新连接时：hover Item 显示 4 个锚点（圆形，8px，层色填充）

#### 3.3 缩放规范

- 缩放范围：`0.1x ~ 3.0x`
- 缩放步进值：每次 `± 0.1`
- 默认缩放：`1.0x`
- 缩放控制：鼠标滚轮 + 缩放按钮（`ZoomIn`/`ZoomOut`/`Maximize2` 重置）
- 缩放时保持当前视口中心点不变

#### 3.4 空画布引导

空画布状态下显示引导提示（居中，不可交互）：

```
[Sparkles 图标，48px，#64748b]

还没有任何节点

拖拽添加 · 或点击「AI 一键填充」自动生成

[AI 一键填充] 按钮（主色调，水平居中）
```

#### 3.5 右键上下文菜单

ItemNode 右键菜单：

```
├── 编辑节点属性          [Edit3 图标]
├── 复制节点              [Copy 图标]
├── 连接到...             [ArrowRight 图标]
├── 设为 Source           [Database 图标]
├── 设为 Transform        [Settings 图标]
├── 设为 Sink             [Database 图标]
├── ─────────────────
├── 复制 SQL 片段         [Code 图标]
├── 注入到编辑器          [ExternalLink 图标]
├── ─────────────────
├── 删除节点              [Trash2 图标，#ef4444]
```

#### 3.6 多选与框选

- **多选**：Ctrl + Click 切换选中状态
- **框选**：鼠标按住空白区域拖拽，蓝色半透明矩形框选
- **批量操作**：选中多个节点后，显示浮动工具栏 `[连接] [删除] [分组到 Space]`
- **快捷键**：
  - `Ctrl + A`：全选
  - `Delete`/`Backspace`：删除选中
  - `Ctrl + D`：复制选中节点（偏移 20px）

#### 3.7 撤销/重做

- 使用 `useOntologyStore.canvasSnapshots[]` 实现
- `Ctrl + Z`：撤销
- `Ctrl + Shift + Z` / `Ctrl + Y`：重做
- 最多保存 50 步快照，超出后丢弃最旧记录
- 每次以下操作后自动保存快照：
  - 添加/删除 Item
  - 添加/删除 Space
  - 添加/删除 Edge
  - 拖拽释放节点
  - 清除操作（L1/L2/L3）

---

## MECE 五大层级详细优化规格

### 6.1 Foundation 层（基础层 / 对象建模）

| 优化项 | 规格说明 |
|--------|----------|
| **AI 填充** | 输入概念描述 → 生成 object_type + object 实例完整模型（Space = 对象类型，Item = 实例）+ 五表 DDL + sqlFragment |
| **快速清除** | 清除 Foundation 层标记的所有 Space/Item（通过 layerTag 筛选） |
| **背景说明** | 定位：从零构建本体论概念体系；场景：新建对象类型、设计属性结构；错误：类型表/实例表顺序颠倒、外键约束冲突；实践：先设计 object_type 再创建实例 |
| **AI 填充示例** | 输入「用户画像」→ Space[UserProfile] + Item[VIP 用户/普通用户/游客] + CREATE TABLE + INSERT 示例 |

### 6.2 Relations 层（关系层 / 关系建模）

| 优化项 | 规格说明 |
|--------|----------|
| **AI 填充** | 选择源/目标对象 → 生成 link_type + link 实例 + 权重建模方案（树状或线性拓扑） |
| **快速清除** | 清除 Relations 层标记的所有 Edge + 关联 Item |
| **背景说明** | 定位：建立实体间关联与数据依赖；场景：设计对象间引用关系、构建数据流；错误：关系类型混用（因果/组成混用）、权重归一化缺失；实践：明确实体关系类型（一对多/多对多/时态） |
| **AI 填充示例** | 输入「员工-公司雇佣」→ EMPLOYED_BY link_type + start_date/end_date 属性 + 时态权重查询 SQL |

### 6.3 Methodology 层（方法论层 / 步骤建模）

| 优化项 | 规格说明 |
|--------|----------|
| **AI 填充** | 输入业务场景 → 生成步骤式拓扑（Source → Transform → ... → Sink），每个节点含方法论建议 |
| **快速清除** | 清除 Methodology 层标记的所有 Space/Item/Edge |
| **背景说明** | 定位：按方法论步骤组织工作流；场景：遗留系统整合、数据治理流程；错误：方法选择不当（过度抽象/不足抽象）、步骤间逻辑断裂；实践：从上到下顺序建模，每步记录输入输出 |
| **AI 填充示例** | 输入「遗留系统数据整合」→ 步骤1-4（盘点→抽象→映射→生成）+ 每个步骤含 SQL 片段建议 |

### 6.4 Patterns 层（模式层 / SQL 模式）

| 优化项 | 规格说明 |
|--------|----------|
| **AI 填充** | 选择模式类型 → 生成 Transform 节点组 + DuckDB SQL 模板（递归 CTE / 聚合视图 / 时序分析） |
| **快速清除** | 清除 Patterns 层标记的所有 Transform 节点 + 关联边 |
| **背景说明** | 定位：高级 SQL 模式复用与调优；场景：递归路径查询、滑动窗口聚合、物化路径遍历；错误：递归深度未设限（max_recursion 默认 100）、权重聚合逻辑错误；实践：每个 Pattern 节点包含完整 SQL 模板 + 参数占位符 |
| **AI 填充示例** | 输入「用户地址变更历史」→ 时态本体模式（valid_from/to）+ 递归 CTE 节点 + latest_address_view |

### 6.5 Domains 层（领域层 / 完整领域）

| 优化项 | 规格说明 |
|--------|----------|
| **AI 填充** | 选择/输入领域 → 生成 2-3 个 Space（子领域）+ 6-10 个 Item 的完整领域拓扑 + 种子数据 |
| **快速清除** | 清除 Domains 层标记的所有 Space + 内部 Item + Edge |
| **背景说明** | 定位：垂直行业完整本体论建模；场景：金融风控、医疗健康、电商订单；错误：概念照搬不适配（互联网套医疗概念）、种子数据脱离实际；实践：先识别核心实体，再扩展属性与关系，最后填充种子数据验证 |
| **AI 填充示例** | 输入「家庭财务管理」→ 3 个 Space（收支/资产/预算）+ Income/Expense/Asset/Liability/Budget + 种子数据 12 条 |

---

## 交互设计规范

### 按钮位置总览

| 按钮 | Canvas 工具栏位置 | 快捷键 |
|------|------------------|--------|
| MECE 层选择器 | 工具栏最左 | Ctrl + [ / Ctrl + ] |
| AI 填充（MECE 层感知） | 层选择器右侧 | — |
| AI 一键填充（通用） | AI 填充右侧 | Ctrl + Shift + O |
| 智能布局 | AI 一键填充右侧 | — |
| 指南 | 右侧区域 | Ctrl + H |
| 预览 SQL | 指南右侧 | — |
| 清除（▼下拉菜单） | 工具栏最右 | Escape |

### SQL 预览面板

- 位于画布右侧，可折叠
- 面板宽度：320px（可拖拽调整）
- 面板内容：
  - 顶部：拓扑 SQL 预览（语法高亮，可复制）
  - 中部：节点映射表（Item → tableName 映射）
  - 底部：二次优化入口

**二次优化输入框规范：**

```
┌─────────────────────────────────────────────────────┐
│ 再细化一下...（placeholder，#64748b）               │
│                                                     │
│ [textarea，2行，border #38bdf8/30，focus 时高亮]    │
├─────────────────────────────────────────────────────┤
│ [采用并注入编辑器]（主色调）  [取消]（ghost 按钮） │
└─────────────────────────────────────────────────────┘
```

### 视觉反馈规范

| 状态 | 视觉表现 |
|------|----------|
| AI 填充进行中 | 按钮变为 `bg-indigo-500/30` + `Loader2` 旋转 + 文字「AI 构思中...」（150ms 脉冲动画），可点击终止 |
| AI 填充完成 | 新节点脉冲高亮（`box-shadow` 扩散 300ms），自动滚动到第一个新节点 |
| 清除操作 | 瞬间完成，无需动画 |
| 节点 hover | 边框加粗 + 锚点显示 + cursor: pointer |
| 节点选中 | 边框变为白色 + `ring-2 ring-white/30` |
| Space 选中 | 背景色加深 `10%`，标题高亮 |
| Edge hover | 线宽 2px → 3px + 发光阴影 |
| Edge 选中 | 箭头高亮 + 虚线动画（表示可编辑） |
| 缩放中 | 缩放数值实时显示在画布右下角（tooltip，1.5s 后消失） |

### 快捷键完整清单

| 操作 | 快捷键 | 备注 |
|------|--------|------|
| 触发 AI 填充（通用） | Ctrl + Shift + O | 全局，画布获焦时有效 |
| 触发 AI 填充（MECE 层感知） | Ctrl + Shift + L | 调用 handleMeceFill |
| 快速清除（L3） | Escape | 无确认弹窗 |
| 关闭菜单/面板 | Escape | 优先级高于 L3 清除 |
| 确认采用（填充结果） | Enter | 填充结果弹窗获焦时 |
| 打开帮助面板 | Ctrl + H | |
| 切换视图（Canvas ↔ Graph ↔ Panel） | Ctrl + 1 / 2 / 3 | |
| 切换 MECE 层级 | Ctrl + [ / Ctrl + ] | |
| 打开 Insights | Ctrl + I | |
| 全选 | Ctrl + A | |
| 删除选中 | Delete / Backspace | |
| 复制选中节点 | Ctrl + D | 偏移 20px |
| 撤销 | Ctrl + Z | |
| 重做 | Ctrl + Shift + Z / Ctrl + Y | |
| 复制 SQL | Ctrl + Shift + C | SQL 预览面板获焦时 |
| 注入编辑器 | Ctrl + Shift + Enter | SQL 预览面板获焦时 |
| 缩放重置 | Ctrl + 0 | |
| 缩放放大 | Ctrl + = | |
| 缩放缩小 | Ctrl + - | |

---

## 与 AI 二次优化的对话示例

### 示例 1：Foundation 层拓扑生成

```
用户：点击「AI 填充」→「Foundation 层」，输入「电商用户体系」
AI：→ 生成 Space[User] + Space[Address] + Space[PaymentMethod]
    + Item[普通用户/会员用户/游客] + Item[收货地址/工作地址]
    + 外键关系边 3 条 + CREATE TABLE DDL
    + 每个 Item 的 metadata.sqlFragment

用户：在 SQL 预览区「再细化一下...」输入「增加会员等级维度属性」
AI：→ 在 User Space 内追加 Item[会员等级] + ALTER TABLE DDL
    → 更新 SQL 预览，增加 WITH member_level_cte AS (...)
```

### 示例 2：Domains 层完整领域生成

```
用户：点击「AI 填充」→「Domains 层」，输入「金融风控领域」
AI：→ 生成 3 个 Space（交易域/设备域/账户域）
    + 8 个 Item（Transaction/Device/Account/Anomaly...）
    + 12 条关系边（TRANSACTS_WITH/ASSOCIATED_WITH...）
    + 完整 DDL + 种子数据 10 条
    + fraud_detection_view + risk_score_cte

用户：点击「再细化一下...」，输入「围绕异常检测展开更多实时监控节点」
AI：→ 在 Anomaly Item 周围追加 3 个新 Item（实时告警/人工审核/模型重训）
    → 追加 4 条新边
    → 追加实时滑动窗口 SQL 模板
```

### 示例 3：Methodology 层步骤式拓扑

```
用户：点击「AI 填充」→「Methodology 层」，输入「数据质量治理流程」
AI：→ 生成步骤式拓扑：
    Source[数据源盘点] → Transform[质量规则定义] → Transform[异常数据标记]
    → Transform[清洗规则生成] → Sink[质量报告输出]
    + 每个步骤含 SQL 片段建议

用户：选中第二个 Transform 节点，点击节点内「AI 辅助」
AI：→ 分析上下文（前序 Source + 后序 Transform）
    → 生成具体 SQL：
    WITH quality_rules AS (SELECT column_name, rule_type FROM metadata)
    SELECT * FROM source_data WHERE NOT EXISTS (...)
```

---

## 验收标准

1. ✅ Canvas 画布 MECE 层颜色语义统一，所有 Space/Item 严格遵循层色标注
2. ✅ 字体层级清晰，Space 标题 14px / Item 标签 12px / metadata 注释 10px
3. ✅ 工具栏按钮分组规范，分隔清晰，密度合理
4. ✅ Space/Item 间距对齐到 8px 网格，Item 最小尺寸 120×48px
5. ✅ Edge 使用贝塞尔曲线（k=0.4），线宽/颜色/箭头规范统一
6. ✅ 拖拽 ghost 透明度 0.6，释放后 8px 网格吸附 + 300ms 回弹动画
7. ✅ 缩放范围 0.1x~3.0x，步进 ±0.1，默认 1.0x
8. ✅ 空画布显示引导提示 + AI 一键填充按钮
9. ✅ 右键上下文菜单包含所有节点操作项
10. ✅ 支持多选（Ctrl+Click）+ 框选 + 批量操作
11. ✅ 撤销/重做支持 50 步快照，Ctrl+Z / Ctrl+Shift+Z
12. ✅ MECE 五层均提供 AI 填充入口，填充内容符合层定位
13. ✅ 清除按钮提供 L1/L2/L3 三级菜单，无选中时 L1/L2 不可见
14. ✅ CanvasHelpPanel 提供 MECE 层详情（定位/场景/错误/实践）
15. ✅ SQL 预览面板提供二次优化入口（再细化一下...）
16. ✅ 快捷键覆盖所有高频操作（AI 填充/清除/缩放/撤销）
17. ✅ 用户可在 3 次点击内完成任意操作

---

## 实施优先级

| 优先级 | 模块 | 理由 |
|--------|------|------|
| P0 | 格调统一（层色 + 字体层级 + 间距网格） | 视觉基础，影响全局体验 |
| P0 | AI 填充替换硬编码（调用 generateMeceCanvasLayout） | 核心功能，当前形同虚设 |
| P0 | L3 清除增强（覆盖 AI 状态 + 面板状态） | 迭代效率基础保障 |
| P1 | 拖拽/连接/缩放体验优化 | 高频操作，体验直接影响效率 |
| P1 | 空画布引导 + 右键上下文菜单 | 降低认知门槛 |
| P1 | 撤销/重做集成 | 操作安全性保障 |
| P1 | CanvasHelpPanel MECE 层详情 | 模块背景说明 |
| P2 | 多选/框选 + 批量操作 | 非核心但提升效率 |
| P2 | SQL 预览面板二次优化入口 | 用户迭代体验 |
| P3 | Edge 样式规范（贝塞尔曲线参数统一） | 细节打磨 |
