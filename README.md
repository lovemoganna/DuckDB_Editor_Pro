# DuckDB Manager Pro

<p align="center">
  <img src="https://img.shields.io/badge/React-18.3-blue" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5.8-blue" alt="TypeScript">
  <img src="https://img.shields.io/badge/Vite-6.2-green" alt="Vite">
  <img src="https://img.shields.io/badge/DuckDB-WASM-orange" alt="DuckDB">
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License">
</p>

<p align="center">
  <strong>DuckDB Manager Pro</strong> 是一款功能强大的 Web 版 DuckDB 数据库管理工具，基于 <a href="https://github.com/duckdb/duckdb-wasm">DuckDB WASM</a> 构建，提供本地离线数据处理能力。界面采用经典的 Monokai 主题设计，集成 AI 智能分析功能，让数据探索和 SQL 开发更加高效便捷。
</p>

![DuckDB Manager Pro](docs/preview.png)

## ✨ 特性

### 核心功能
- 📊 **SQL 编辑器** - 基于 CodeMirror 的专业 SQL 编辑器，支持语法高亮、代码补全
- 🌲 **表结构浏览器** - 树形视图展示所有表及其列结构，点击即可插入表名/列名
- 📥 **数据导入** - 支持 CSV、JSON、Parquet 等多种格式的本地/远程数据导入
- 📈 **数据可视化** - 集成 Chart.js，支持折线图、柱状图、饼图、散点图等多种图表类型
- 📋 **查询历史** - 完整的查询历史记录，支持保存常用查询

### AI 智能分析
- 🤖 **AI Schema 分析** - 自动分析数据表语义，识别维度列、度量列、时间列等
- 📉 **质量报告** - 多维度数据质量评估（完整性、一致性、准确性、时效性、唯一性）
- 🔮 **深度洞察** - AI 驱动的数据洞察发现，包括驱动因素分析、相关性分析、异常检测
- 📊 **指标生成** - 自动从数据中生成业务指标和记分卡
- 🔗 **因果分析** - 生成因果关系图谱，探索数据间的因果关系
- 🛠️ **特征工程** - AI 推荐的特征工程建议和 SQL 实现

### 高级功能
- 📊 **仪表板** - 可拖拽的响应式仪表板，支持多图表组件
- 🔀 **ER 图生成器** - 自动从数据库模式生成实体关系图
- 📚 **学习中心** - 内置 DuckDB 教程和文档系统
- 📝 **命令面板** - `Ctrl+K` 快速访问所有功能
- 🔌 **扩展管理** - DuckDB 扩展加载与管理
- 📝 **审计日志** - 完整的操作审计记录

### 技术特性
- 💾 **本地存储** - 所有数据保存在浏览器本地 IndexedDB，安全隐私
- 🌐 **离线运行** - 无需服务器，纯前端运行
- 🎨 **Monokai 主题** - 经典优雅的暗色主题设计
- 📱 **响应式设计** - 适配不同屏幕尺寸

## 🚀 快速开始

### 安装

```bash
# 克隆项目
git clone https://github.com/yourusername/duckdb-editor.git
cd duckdb-editor

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 构建生产版本

```bash
npm run build
```

构建产物将输出到 `dist` 目录。

## 📖 使用指南

### 数据导入

1. 点击侧边栏的 **Import Data** 按钮
2. 选择导入方式：
   - **本地文件** - 选择 CSV、JSON、Parquet 等文件
   - **URL** - 从远程 URL 导入数据
   - **粘贴数据** - 直接粘贴 CSV/JSON 数据
3. 配置导入选项（分隔符、日期格式等）
4. 指定表名并确认导入

### SQL 查询

1. 在左侧表树中点击表名，自动插入表名到编辑器
2. 编写 SQL 查询语句
3. 点击 **Run** 或使用 `Ctrl+Enter` 执行
4. 结果将显示在下方表格中，支持分页和筛选

### AI 分析

1. 切换到 **Schema Generator** 或 **Metrics** 标签页
2. 选择要分析的数据表
3. 点击 **Analyze** 开始 AI 分析
4. 查看分析结果：语义标注、质量报告、洞察建议等

### 创建仪表板

1. 切换到 **Dashboard** 标签页
2. 点击 **Add Widget** 添加小组件
3. 选择数据源和图表类型
4. 拖拽调整组件大小和位置

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + K` | 打开命令面板 |
| `Ctrl + Enter` | 执行 SQL 查询 |
| `Ctrl + S` | 保存当前查询 |
| `Ctrl + L` | 清除编辑器内容 |
| `Escape` | 关闭弹窗/取消编辑 |

## 🛠️ 技术栈

- **前端框架**: [React 18](https://react.dev/)
- **构建工具**: [Vite 6](https://vitejs.dev/)
- **语言**: [TypeScript 5.8](https://www.typescriptlang.org/)
- **样式**: [Tailwind CSS 3](https://tailwindcss.com/)
- **数据库引擎**: [DuckDB WASM](https://github.com/duckdb/duckdb-wasm)
- **SQL 编辑器**: [CodeMirror 6](https://codemirror.net/)
- **图表库**: [Chart.js](https://www.chartjs.org/)
- **流程图**: [React Flow](https://reactflow.dev/)
- **AI 集成**: [Google Gemini](https://gemini.google.com/)

## 📁 项目结构

```text
duckdb-editor/
├── components/              # React 组件
│   ├── SqlEditor.tsx        # SQL 编辑器
│   ├── TableTree.tsx        # 表结构树
│   ├── Dashboard.tsx        # 仪表板
│   ├── ERDiagram.tsx        # ER 图
│   ├── MetricManager.tsx   # 指标管理
│   ├── SchemaGenerator.tsx # Schema 生成器
│   └── Learn/              # 学习中心组件
├── services/                # 业务逻辑服务
│   ├── duckdbService.ts    # DuckDB 核心服务
│   ├── aiService.ts         # AI 分析服务
│   ├── metricAnalyzer.ts   # 指标分析
│   └── ...
├── types.ts                 # TypeScript 类型定义
├── App.tsx                  # 主应用组件
└── index.html               # 入口 HTML
```

## 🤝 贡献指南

欢迎提交 Pull Request 或创建 Issue！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送分支 (`git push origin feature/amazing-feature`)
5. 打开 Pull Request

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件。

## 🙏 致谢

- [DuckDB](https://duckdb.org/) - 强大的嵌入式分析数据库
- [DuckDB WASM](https://github.com/duckdb/duckdb-wasm) - WebAssembly 版本的 DuckDB
- [CodeMirror](https://codemirror.net/) - 优秀的 Web 编辑器
- [Tailwind CSS](https://tailwindcss.com/) - 实用优先的 CSS 框架
