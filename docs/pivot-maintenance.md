# 透视分析的行为契约与回归门禁

透视编辑位于分析洞察，首页展示保存的分析引用。编辑器、首页卡片、全屏共用矩阵组件；变更其中一处时，必须检查其他入口。

## 状态与职责

- `pivotDefinitionKey` 比较完整可保存定义；`pivotQueryKey` 仅包含会改变查询的字段。标题、展示类型、已计算度量选择、小数位和空单元格显示不触发数据库查询。
- 查询更新保留上一结果并标明状态；过期请求在进入引擎队列前再次校验。不强行终止共享引擎里已经执行的任务。
- 手动应用模式将编辑中的配置与已应用配置分离；未应用配置不能保存或钻取旧结果。
- 来源加载的重试有独立版本；已保存分析不依赖当前选中来源的异步加载。来源校验返回的新字段必须被采用。
- 草稿只保存在当前页面会话，缓存最多40项，刷新不承诺恢复。离开保护不能被误称为自动持久保存。

## 数值与口径

- 透视 SUM/AVG 使用 DuckDB 原生数值聚合，不预先 CAST DOUBLE；其他分析路径的原有转换策略独立保留。
- 聚合值及来源总计以 VARCHAR 跨越 Arrow/JavaScript 边界；不能通过 `Number()` 再求和来源总计。保留不能安全往返的精确字符串。
- 每个度量可以配置小数位。微量非零值保留有效数字；精确大数文本保留全部位数。AVG遵循DuckDB原生返回类型，不能承诺有理数无限精度。
- 图形坐标使用近似数值；精确结果以透视表和CSV为准。
- 来源总计不受矩阵查找、排序、分页影响。AVG和去重计数不能用单元格相加计算总计。
- SQL配置排序决定Top N组合，矩阵排序决定显示行序；两者必须在界面上区分。
- “导出长表CSV”导出全部已加载组合，包含查找隐藏项，不含来源总计；“导出当前交叉表”导出当前查找和排序下全部已加载行列，包含页外项及明确标注的总计。导出保持原始值，不把显示舍入写回数据。
- 明细包含完整来源、追加条件、计量资产及行列约束，按全部输出字段排序。实时来源翻页不是快照；来源发生变化时须重新打开明细。

## 保存一致性

- `linked-analyses` 所有读改写通过 `mutateDomainSetting`，禁止读取旧快照后直接覆盖。
- 同页面队列与同源Web Locks保护整个读取—修改—写回，覆盖DuckDB元数据和只读库IndexedDB sidecar。没有Web Locks的旧环境只有页面内串行保障；应用外直接改元数据不在此锁协议内。
- 编辑器保存传递`expectedSavedAt`。更新冲突和已删除记录必须显式失败，不能复活旧记录；版本时间须单调递增。
- 保存分析和加入首页是两个阶段；后者失败时分析仍然已保存，重试仅发布首页引用。发布前重新校验catalog/schema。
- 旧透视记录读取时补充安全格式；新增可选字段向后兼容，不要求重建已有资产ID。

## 回归命令与案例

运行 `pnpm typecheck`；修改共享层后运行项目完整测试和构建。针对透视的核心文件：

```powershell
pnpm exec vitest run --pool=threads --maxWorkers=1 --no-file-parallelism components/AnalysisHub/PivotEditor.test.tsx components/charts/PivotTableView.test.tsx services/analysis/pivotExperience.test.ts services/analysis/pivotRepair.test.ts services/analysis/pivotPrecision.integration.test.ts services/domainSettingMutation.test.ts components/DashboardWidget.requests.test.tsx services/analysis/sqlCompiler.test.ts services/analysis/chartDisplay.test.ts utils/chartFormat.test.ts services/databaseAnalysis.test.ts services/dbService.governance.test.ts services/dbService.dashboard.test.ts
```

原生精度集成测试沿用项目现有DuckDB CLI依赖，只操作内存查询，不打开用户数据库。它必须验证：大DECIMAL、微小DECIMAL、聚合的数值排序和全NULL最大值。

真实浏览器额外检查：改名/切视图0查询；搜索与隐藏行值连续；方向键和抽屉焦点返回；故障解除后重试；两个窗口并发追加；资产候选第201条之后及重开；保存→首页→全屏→返回编辑；来源字段增删；浅色/深色主题。

布局门禁：配置关闭后的结果模式，1024×768直接可见至少6行，768×900至少8行，390×844至少4行；页面宽度不能溢出。配置面板在 768px 以下独占任务区域；平板及桌面采用结果上方的紧凑配置区，可收起以专注结果。字段目录和高级选项默认折叠，常用行列、值、筛选直接可见。

## 性能与维护

默认Top N控制加载量，高基数配置提供手动应用。矩阵查找只操作已计算的标签/矩阵，不重新聚合或改来源总计。

基准须记录构建模式、设备、冷热状态、组合数、SQL时间、转换时间、输入到绘制时间和内存。开发模式3次采样不能充当生产p95；精确值传输的成本要与准确性一起报告。当前没有证明必须更换网格库或引入Worker。

每个缺陷保留：旧实现失败用例→最早失效点→最小修复→相同输入回放→邻近入口回归。多级维度、并排多度量、跨页快照及服务端窗口作为独立能力设计，不能用隐藏数值冒充层次折叠。

2026-10-14扫描和修复的完整运行证据在`output/pivot-audit-20261014`及`output/pivot-repair-20261014`；这些目录通常被Git忽略，归档时需显式保存。稳定的契约测试和本文件随项目版本管理。
