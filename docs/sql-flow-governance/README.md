# SQL Logical Relation Flow 治理交付

实现日期：2026-10-05。SQL 原文是 SQL 模式的唯一结构事实源；保留工作台、Catalog 和 Custom 的现有交互。已有其他模块的未提交改动没有整理或提交。

## 语义契约

`FlowData.contractVersion = 2.0`，类型定义在 `services/dataflow/logicalRelationFlowTypes.ts`，机器可读约束在 `logicalRelationFlow.schema.json`。

| 实体 | 含义与约束 |
| --- | --- |
| Relation | 数据状态和来源；中间 Relation 独立保存，不为每个阶段新增 Result 卡片 |
| Operator | 有类型的输入、输出、Effect 和所属 Boundary；Join 保存 subtype、左右输入、条件 |
| Effect | Rows、Columns、Grain、Order、Shape、Uniqueness 的语义变化；未知使用 `unknown`，不是实测行数 |
| Boundary | Connection → Statement → Query、CTE、Subquery、Recursive CTE；原文范围和局部关系保留 |
| Object | Connection/Catalog、Schema、名称、版本、定义原文、创建/释放及运行状态；标量宏、Sequence、Index、Type 不充当 Relation |
| Edge | `relation_flow`、`reference`、`object_dependency`、`recursive_back`、`boundary_contains`；按类型及输入角色区分 |

Statement、节点和诊断范围统一采用 JavaScript UTF-16 半开区间 `[start,end)`。原文哈希、标签 ID、同步批次和运行 ID 共同约束异步提交。共享扫描器处理引号及转义、Unicode、嵌套括号、嵌套注释和字符串内分号；引擎 UTF-8 字节偏移转换函数有回归覆盖。引擎未提供结构化位置的错误定位到失败 Statement，不猜测某个表达式的位置。

## 支持矩阵

“支持”表示这里列出的逻辑结构映射已实现，不表示替代引擎进行完整 SQL 语法或类型检查。执行始终使用原 SQL 和真实 DuckDB。

| 类别 | 实现范围 | 限制及诊断 |
| --- | --- | --- |
| Query | SELECT、FROM-first、VALUES；表、CTE、表函数、文件和局部 Subquery | 外部对象通过只读 Catalog 元数据绑定，未确认对象标记未解析 |
| Query 阶段 | Source、Join、Sample、WHERE、Aggregate、HAVING、Window、QUALIFY、Projection、Output Modifier、Result | 表达式保存原文；不作为完整表达式类型检查器；`SELECT *` 不生成重复 Projection |
| Aggregate/Window | GROUP BY 与普通聚合合并；OVER 与命名 WINDOW 保留内部信息；窗口聚合与普通聚合区分 | 运行时聚合函数目录用于识别，不从窗口函数名称生成普通 Aggregate |
| Join | INNER、LEFT/RIGHT/FULL OUTER、CROSS、NATURAL、SEMI、ANTI、ASOF、POSITIONAL，ON/USING 条件，左右输入 | LATERAL 保留输入结构；不提供逐字段相关引用的血缘证明 |
| Set | UNION、INTERSECT、EXCEPT，ALL/DISTINCT、BY NAME，括号与 INTERSECT 优先级 | 各输入及边界分别保留 |
| Output | DISTINCT、DISTINCT ON、ORDER BY、LIMIT、OFFSET | DISTINCT ON 保存选行排序配置 |
| Reshape | 简化式及标准输入 PIVOT/UNPIVOT；ON、USING、GROUP BY、INTO 整体保存 | 不把内部关键字拆成虚假阶段 |
| CTE | 一次定义、多次引用、嵌套、MATERIALIZED/NOT MATERIALIZED、WITH RECURSIVE | 真实 anchor、自引用、递归项、累积输出和反馈关系；不生成占位自环 |
| 数据对象 | CREATE [TEMP] TABLE、CTAS、DROP、CREATE OR REPLACE、对象版本 | CTAS 消费 Query 输出；普通建表没有虚构 Relation 输出 |
| 保存定义 | VIEW、标量/表 MACRO、PREPARE、EXECUTE、DEALLOCATE | 定义时保存，引用/EXECUTE 时形成数据流；未引用的定义主体不做完整语法验证；脚本外定义只确认对象身份，不自动展开主体 |
| Catalog 对象 | SCHEMA、SEQUENCE、INDEX、TYPE、创建/释放、依赖 | 不伪装成数据源；对象运行状态区分 pending、defined、released、rolled_back、not_applied |
| Context | USE、search_path、ATTACH、DETACH、SET/RESET 与事务指令 | SQL 内部合法上下文切换继续同一运行；外部连接切换使绑定失效 |
| 未实现结构 | DML、COPY/EXPORT、PRAGMA、扩展命令及未列出的高级语法 | 返回有范围的诊断，状态为 partial/parse_error；不宣称完整支持，也不拼接猜测链路；实际执行能力由引擎决定 |

来源输入：附件完整 SQL 块、[Glossary 看板](https://docs.google.com/spreadsheets/d/1ivHFGOZy1eDFvSxFJo2ARNm81HoK9TA76TkU7J-1sto/edit) 的 67 个案例，以及当前工作台的 4 个快捷查询。固定在 `services/dataflow/fixtures/`，Glossary 案例记录来源行、分类、语法及预期语义。测试另外覆盖改名、空白、注释、字符串内关键字、Unicode、多 Statement、重复引用和同名对象。

## 布局与执行

布局菜单提供自动、横向、纵向、树形、力导向。横向/纵向使用 ELK 分层；树形采用居中分支与较宽层间距，共享输入仍保留真实 DAG，不复制成树节点。力导向在各真实 Boundary 内进行固定种子的有限次物理模拟，按实测节点尺寸防碰撞；正交连线在全部叶节点障碍物之间寻路。切换仅更新几何，保留节点/边身份、执行状态、选择和 SQL；快速切换由独立布局批次屏蔽迟到结果。手动方向不会因分屏宽度变化被自动模式覆盖。大型力导向图仍需平移，布局不保证箭头都朝同一方向。

连接层级复核修复了 JOIN 条件子查询缺少依赖的问题：子查询输出连接 JOIN 的依赖端口，左右数据输入保持独立；递归反馈的外围路线遇到其他分支时会重新避障，并明确标注“递归反馈”。字段级相关引用仍遵循支持矩阵中的限制。

本次回归：67 个 Glossary 案例 × 四种手动布局，核对节点/边身份、Boundary 包含、正交路由、端口、节点碰撞与无关节点穿越；另验证稳定排布、真实生产者、JOIN 输入角色、快速切换与执行中状态。`../sql-flow-multilayout-related.log` 保存 16 个相关文件、634 项检查；类型检查和构建日志为 `../sql-flow-multilayout-typecheck.log`、`../sql-flow-multilayout-build.log`。`layout-horizontal.png`、`layout-vertical.png`、`layout-tree.png`、`layout-force.png` 及 `layout-switch-state.json` 保存真实 DuckDB 查询的切换证据。

SQL 画布使用 ELK Layered、显式端口、复合 Boundary 和正交折点。短链横排；长链依据实测画布宽度转为 DOWN 纵向分层，分支在相同层并排汇合，输入/输出端口随方向切换。叶节点采用当前组件的固定尺寸，重新布局时读取 React Flow 实测尺寸。独立 Statement 组件按代码顺序重新排列，组件内部与跨边界路由使用 ELK 结果；递归强连通分量的真实反馈边使用外围通道。没有具体 SQL 特判、固定网格或删边。主流实线，引用/对象依赖虚线。ResizeObserver 在内容区宽度变化后重新布局，且保留执行状态。默认缩放不低于 85%，超长图从起点展示并允许平移；显式 Fit View 仍可查看全图。

共享执行器持有同一个连接队列，逐 Statement await。普通多语句脚本内部 BEGIN/COMMIT，失败或取消确认时 ROLLBACK；已有事务和显式事务不嵌套包装。内部语句不显示为用户步骤。队列不会因界面超时而提前释放仍在工作的连接。

事件包含 runId、tabId、原文哈希、同步批次、connectionId、statementId、原文范围及 queued/running/success/failed/cancelled/skipped 状态。一次更新同时写入节点状态和编辑器范围。运行中点击节点只查看详情。只有顶层 Statement Result 接收真实 rows、耗时及结果；没有逐逻辑节点执行、物化预览或补跑 nextval/random/写操作。

取消目前为 Statement 边界取消：等待当前引擎调用返回才确认 cancelled，不启动下一条。不能即时中断一个仍在运行的 DuckDB WASM 调用。事务范围跨多个历史运行时，当前运行可正确避免嵌套包装，但不会回写已经解除绑定的旧画布；历史结果保留在历史区。

## 验证证据

布局可读性补测：`../sql-flow-responsive-layout-tests.log`（357 项通过，包含 67 个 Glossary 案例在 440px/1000px 两种画布宽度的无重叠及连线避障检查）、`../sql-flow-responsive-typecheck.log`、`../sql-flow-responsive-build.log`。UI 截图与尺寸证据使用 `responsive-*.png/json`。

- `../sql-flow-governance-typecheck.log`：最后修改后的 TypeScript 检查通过。
- `../sql-flow-governance-clean-full.log`：222 个测试文件、1870 项全量回归通过。
- `../sql-flow-governance-mode-regression.log`：最后界面修正后的 14 个文件、106 项补测通过（含新增全屏/分屏及 Statement 完成状态测试）。
- `../sql-flow-governance-final-related.log`：重跑指标清理修正后的 20 个相关文件、340 项回归通过。
- `../sql-flow-governance-build.log`：最后修改后的生产构建通过。现有大包和 DuckDB worker eval 警告仍存在。
- `engine-results.txt`：独立真实 DuckDB 内存连接的 12 项检查，全部通过。真实 CSV 注册、Parquet 写入及 100% 可验证抽样，未用替代结果。
- `running-state.json`、`running-dark.png`、`running-light.png`：运行中第一条 success、第二条 running、第三条 queued，编辑器精确高亮第二条。
- `click-during-run.json`：查看已完成节点后运行高亮仍保持第二条。
- `cancel-state.json`：引擎确认后 cancelled、后续 skipped，已完成部分标记回滚。
- `browser-states.json`、`final-dark.png`、`final-light.png`：真实界面模式、主题、视口与迟到事件验收。

独立真实引擎回归入口为 Vite 开发路径 `test/sql-flow-engine.html`，不访问工作台数据。结构测试、几何测试与真实执行检查分别验证不同契约；结束截图不能替代运行中的事件证据。

实现选择依据：[ELK Layered 文档](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html)。[DuckDB SQL JSON 序列化](https://duckdb.org/docs/current/data/json/sql_to_and_from_json)仅用于 SELECT 结构交叉验证，未作为全部 SQL 的解析入口。
