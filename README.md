# DuckDB Manager Pro

<p align="center">
  <img src="https://img.shields.io/badge/React-18.3-blue" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5.8-blue" alt="TypeScript">
  <img src="https://img.shields.io/badge/Vite-6.2-green" alt="Vite">
  <img src="https://img.shields.io/badge/DuckDB_WASM-1.32-orange" alt="DuckDB">
  <img src="https://img.shields.io/badge/pnpm-11-yellowgreen" alt="pnpm">
  <img src="https://img.shields.io/badge/Node-22+-brightgreen" alt="Node">
</p>

<p align="center">
  <strong>DuckDB Manager Pro</strong> 是一款纯浏览器端的 DuckDB SQL IDE 与数据工作台，基于
  <a href="https://github.com/duckdb/duckdb-wasm">DuckDB WASM</a> 构建。
  无需后端即可完成导入、查询、分析、知识沉淀与 AI 辅助建模；界面采用 Monokai 主题。
</p>

## ✨ 特性总览

应用按四大工作域组织导航：

| 域 | 说明 |
|----|------|
| **工程核心** | 仪表盘、数据浏览、Schema、SQL 工作台、数据流画布 |
| **分析洞察** | 指标、分析中心、查询历史、审计日志 |
| **知识沉淀** | 知识资产库、DuckDB 插件管理 |
| **AI 认知** | 本体图谱、AI 技能、能力库、组合推演 |

### 工程核心

- **仪表盘** — 工作区总览：KPI、最近表/查询、快捷入口
- **数据** — 分页表格、排序筛选、单元格编辑、批量删除、插入行、导出
- **Schema** — 表结构树、列增删改、统计、复制/删除表
- **SQL 工作台** — 多标签 CodeMirror 编辑器、结果集、Explain/Profiling、AI 助手、运行时中心
- **数据流画布** — React Flow 可视化管线，资产侧栏 + 算子 + 检查器，可回写 SQL

### 分析洞察

- **指标** — 语义指标构建、自然语言预览、图表生成并落到 SQL
- **分析中心** — 五个子工作台：
  - 数据体检
  - 透视聚合
  - 时序分析
  - 场景配方
  - SQL 模板
- **历史 / 审计** — 查询历史（卡片/表格）、收藏与重跑；操作审计日志

### 知识沉淀

- **知识资产** — Code / Metric / Note 三类资产：分类、标签、收藏、导入 Markdown/JSON、AI 助手
- **插件** — 加载与试用常见 DuckDB 扩展（json、httpfs、spatial、vss 等）

### AI 认知

- **本体图谱** — 知识图谱 / 数据视图 / 实体画布；CRUD、AI 草稿、SQL 模板下发
- **技能** — 技能流水线浏览与导入（含 DuckDB 指南）
- **能力库** — 生成 / 诊断 / 优化 / 洞察 / 质量 / Schema 等能力目录，可在 SQL 编辑器中执行
- **组合推演** — 多源语义重构、历史记录、Markdown 导出、插入 SQL

### 横切能力

- **命令面板** — `Ctrl+K` 快速导航、建表、导入导出、设置与本体操作
- **导入向导** — 本地文件 / URL / 粘贴；CSV、JSON、Parquet、Excel 等
- **存储** — 优先 **OPFS** 持久化工作区数据库；不可用时回退内存，并用 IndexedDB 缓存工作区快照
- **纯前端** — 数据留在本地浏览器，可离线使用（需自备 AI API Key 时除外）

## 🚀 快速开始

### 环境要求

- **Node.js** `>=22 <25`（推荐使用 `.nvmrc` 中的 `22`）
- **pnpm** `>=11 <12`（仓库锁定 `pnpm@11.13.0`）

### 安装与开发

```bash
git clone https://github.com/lovemoganna/DuckDB_Editor_Pro.git
cd DuckDB_Editor_Pro

pnpm install
pnpm dev
```

### 常用脚本

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动 Vite 开发服务器 |
| `pnpm build` | 复制文档到 `public/docs` 并构建生产包 |
| `pnpm preview` | 预览生产构建 |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm test` | Vitest 监视模式 |
| `pnpm test:run` | 单次跑测（CI 友好） |
| `pnpm test:coverage` | 带覆盖率跑测 |
| `pnpm check` | 生产依赖审计 + 类型检查 + 测试 + 构建 |

构建产物输出到 `dist/`。

## 📖 使用指南（简要）

### 导入数据

1. 命令面板或快捷操作打开 **导入数据**（`Ctrl+I`）
2. 选择本地文件、URL 或粘贴数据
3. 配置分隔符 / 类型推断等选项，指定表名后确认

### SQL 查询

1. 进入 **工程核心 → SQL**
2. 编写语句，点击 Run 或使用 `Ctrl+Enter` 执行
3. 在结果区分页、筛选；需要时用 Explain / Profiling 排查

### 分析

1. 进入 **分析洞察 → 分析**，选择表
2. 在数据体检 / 透视 / 时序 / 配方 / 模板之间切换
3. 可将生成的 SQL 插入编辑器或直接运行

### AI 与本体

1. 在设置中配置 AI Provider（如 Google Gemini）
2. 使用 **本体图谱 / 技能 / 能力 / 推演** 完成建模与下发 SQL
3. 通过命令面板可快速跳转相关动作

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + K` | 打开命令面板 |
| `Ctrl + Enter` | 执行 SQL 查询 |
| `Ctrl + N` | 新建数据表 |
| `Ctrl + I` | 导入数据 |
| `Ctrl + E` | 导出数据 |
| `Ctrl + S` | 保存当前查询 |
| `Escape` | 关闭弹窗 / 取消编辑 |

顶栏域内功能亦支持数字快捷键（如工程核心 `1`–`5` 切换子页）。

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 18、TypeScript 5.8 |
| 构建 | Vite 6、Tailwind CSS 3、pnpm 11 |
| 数据库 | `@duckdb/duckdb-wasm` 1.32（OPFS / 内存） |
| 编辑器 | CodeMirror 6（`@uiw/react-codemirror`） |
| 状态 | Zustand 5 |
| 图表 | Chart.js、Recharts |
| 画布 / 图 | React Flow、D3、dagre、PixiJS |
| AI | `@google/genai`（可配置 Provider） |
| 测试 | Vitest 4 + Testing Library |

## 📁 项目结构

```text
duckdb-editor/
├── App.tsx                 # 主应用与 Tab 宿主
├── index.tsx / index.html  # 入口
├── types.ts                # 全局类型（含 Tab 枚举）
├── components/
│   ├── layout/             # 顶栏、侧栏、全局弹层
│   ├── Dashboard/          # 仪表盘
│   ├── Workbench/          # SQL 工作台外壳
│   ├── SqlEditor/          # 编辑器与结果区
│   ├── DataFlow/           # 数据流画布
│   ├── AnalysisHub/        # 分析中心
│   ├── KnowledgeHub/       # 知识资产
│   ├── AiCapabilityLibrary/# AI 能力库
│   ├── Library/            # 本体 / 组合推演等
│   ├── skills/             # AI 技能面板
│   ├── History/            # 查询历史
│   └── ...
├── services/               # DuckDB、AI、导入导出、导航等服务
├── hooks/                  # Zustand stores 与领域 hooks
├── data/                   # 种子数据、教程元数据、模板
├── docs/ → public/docs/    # Markdown 文档（构建时 copy-docs）
├── snippets/               # 示例代码片段
├── scripts/                # copy-docs 等脚本
└── .github/                # CI、Dependabot、CODEOWNERS
```

## 🤝 贡献

欢迎 Issue 与 Pull Request。

1. Fork 仓库并创建特性分支
2. 本地执行 `pnpm check` 确保通过
3. 提交 PR 并简要说明动机与验证方式

## 🙏 致谢

- [DuckDB](https://duckdb.org/) / [DuckDB WASM](https://github.com/duckdb/duckdb-wasm)
- [CodeMirror](https://codemirror.net/)
- [React Flow](https://reactflow.dev/)
- [Vite](https://vitejs.dev/) / [Tailwind CSS](https://tailwindcss.com/)
