# SQL 切片接入主图谱

日期：2026-10-12。范围：本地实现与验证；未发布、提交或推送。

## 偏差及修正

早期方案只复用底层 GraphRenderer，另建弹窗、SVG、缩放和追溯界面，绕开了既有主图谱工作区。现已移除独立画布，SqlOntologySlice 只管理真实来源、条件、SQL 和映射；查询结果直接作为 OntologyPanel 内既有 D3GraphView 的临时数据源。

复用主图谱的布局控制中心、SVG / Canvas / WebGL 引擎、搜索、聚焦、图例、时间演进、对象信息面板与关系检查器。查询筛选可收起，返回本体后保留切片条件，重新进入可恢复结果。查询节点不写入本体对象仓库；禁用对临时节点的删除和补充数据操作，避免误改原本体。

SQL 结果在传入可变渲染引擎前复制节点和关系，保持实际表名、来源键、关联键及原始行索引。对象信息面板显示实际来源表和标识；关系检查器显示原始查询记录及两端对象来源。React 文本渲染防止查询内容成为 HTML。

## 已复现并修复的边界问题

1. Canvas 空结果仍出现旧节点：空数据分支提前返回，nodesRef 保留上一批节点。现清空节点缓存、停止旧仿真、重新绘制空 Canvas，并清空 Pixi 节点。新截图 empty-canvas-fixed.png 确认 0 行、0 节点、0 关系且画布无旧节点。
2. 返回未初始化本体仍显示 SQL 节点：原图谱加载因 initState 提前返回。现离开投影时先清空临时图数据，再执行原有本体加载。浏览器复查确认恢复未初始化状态且节点为 0。
3. 切片侧栏打开后，主图谱筛选和渲染器按钮拥挤：投影模式提前采用已有窄容器布局，沿用现有响应式规则。

## 真实数据与验证

工作簿：`C:/Users/luoyu/AppData/Roaming/.emacs.d/org-roam/pages/sql/exchange_funds_flow_dataset.xlsx`。只导入用户指定的 users、fiat_transactions、crypto_transactions、exchange_rates 四表，保留原始表名。浏览器原保存库 sql_funds_flow 重载后提示未挂载，因此本次重新从该工作簿导入内存库；没有用模拟数据替代，也没有声称修复保存库的挂载问题。

| 实际业务条件 | SQL 行数 | 主图谱对象 | 主图谱关系 |
| --- | ---: | ---: | ---: |
| fiat_transactions：status=completed、currency=USD，uid 关联 users.uid | 9 | 13 | 9 |
| crypto_transactions：status=completed、asset=USDT，uid 关联 users.uid | 15 | 22 | 15 |
| 美元条件改为 NO_MATCH | 0 | 0 | 0 |

浏览器验证：来源表切换清除旧图；筛选更新后自动重算；空结果后恢复查询；收起筛选；主布局控制；SVG、Canvas、WebGL 切换；Bob Miller 的 users.uid 与三条原始查询记录；关系检查器的一条查询记录；未初始化本体返回；浅色 / 深色切换保持 22 对象、15 关系。大规模性能未测试，不将 UI 中的推荐规模作为性能验收结论。

自动回归：8 个测试文件、78 项通过，包含原生 DuckDB 执行真实四表工作簿查询、映射、唯一键、只读约束、空值、异步旧响应、数据库切换、主图谱数据和布局工具及来源组件。日志：output/sql-slice-main-graph-tests.log。类型与构建日志：output/sql-slice-main-graph-types.log、output/sql-slice-main-graph-build.log。

最终 TypeScript 类型检查通过，Vite 生产构建通过（2 分 7 秒）。构建保留现有 DuckDB worker eval 与大 chunk 警告。本次没有运行全仓测试，也没有做大规模图性能压测。

截图目录：output/playwright/sql-slice-main-graph。当前有效证据包括 node-trace.png、edge-trace.png、empty-canvas-fixed.png、crypto-main.png、light-main.png、webgl-verified.png。早期 empty-canvas.png、webgl.png 截图是诊断过程记录，不代表最终通过状态。
