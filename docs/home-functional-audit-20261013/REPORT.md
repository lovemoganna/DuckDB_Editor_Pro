# 首页仪表盘功能扫描、修复与验证报告

日期：2026-10-13（America/Los_Angeles）。业务背景：无。上限：3轮。仅首页仪表盘及直接相关模块；没有重设计、批量重构、业务数据删除或存储迁移。

## 结论与覆盖

已修复9项一级缺陷，剩余已证实的一级项0。二级/无法确认项2，仅记录。推导项0。范围内顶层页面1/1、13/13个源模块完成静态检查；范围内本地服务接口37/37完成调用及契约边界检查，HTTP业务端点0。详细名单及数据对象见[system-map.md](system-map.md)。这些数量只覆盖本次限定范围，不是全系统总数或全浏览器覆盖声明。

最终验收：26个测试文件、118项测试通过；类型检查退出0；生产构建退出0。参见acceptance-tests.txt、acceptance-typecheck.txt、acceptance-build.txt。构建保留已有大包/混合导入警告，未扩展到范围外处理。

运行层次：真实浏览器核查首页空状态、恢复后的已有持久库、真实数据集25行预览、图表绑定与实时记录数、分析库搜索和空结果、清除筛选、已加入标记、筛选弹窗取消、空白视图名称禁用。失败、重入、异步竞态、页码缩小和剪贴板拒绝使用组件/hook运行测试注入；不能将其解释成真实数据库端到端故障测试。未新增Mock数据到产品实现。

## 系统地图及八维扫描

| 维度 | 当前范围证据与结果 |
|---|---|
| 1 入口 | Dashboard→HomeHeader/HomeBoardCanvas→对象库、数据集、图表、筛选、设置、组件菜单均有处理；跨页入口核对App交接边界。速览入口可达性待确认C2。 |
| 2 未完成 | 当前挂载链未发现TODO/空函数/固定业务结果；真实COUNT预览25与图表预览25一致。历史未挂载展示模块不据此判通过。 |
| 3 流程 | 视图创建/重命名/复制、数据集创建/编辑、组件添加/设置/移除/当前页CSV有现有实现；未据此要求新建整板导出、删除视图等未获产品依据的能力。 |
| 4 数据链 | F2活动选择、F8引用标记已修；存储身份和单位/聚合口径不变；只核对首页图表适配边界。 |
| 5 状态 | F4/F6/F9补齐失败及恢复，F7纠正假成功；正常空、加载、按钮禁用及既有组件查询错误复核。系统没有可供首页执行的独立权限接口，权限不足效果未端到端确认。 |
| 6 输入 | F1阻止重入，F3校正越界页，F5转义标识符；现有名称trim校验、字段/只读SQL/筛选校验及长文本换行/滚动保留。 |
| 7 接口 | 服务调用、数据字段与导航参数边界检查37项；F8修正引用身份匹配。未改变服务参数、返回契约或持久化结构。 |
| 8 同类能力 | DatasetPreview页码恢复复用DashboardWidget现成做法。图表/指标/分析各自编辑入口由已有定义类型决定，未将正常差异改成一套强制业务流程。纯视觉见转UI审查。 |

## 已修复项

全部条目类型为“缺陷”，分级一级。按影响与修改成本执行；每项完整前后代码见[changes.diff](changes.diff)，修改前副本见before目录，文件校验值见changes.json。原工作区已有大量改动，未提交、重置或覆盖用户工作。services/analysisObjects.ts的副本由已知最小补丁逆向还原（复制前目录缺失），已核对diff只含helper提取；其余7份是修改前直接复制。

### F1

- 位置：`hooks/useDashboardWorkflow.ts:900`。
- 现象：重叠拖入文件会启动两次导入。
- 证据：handleImportFile原先每次直接调用导入服务，没有同步互斥；red-tests.txt中的重复drop用例失败。
- 根因：用State展示进度不能阻止同一时段的第二次调用。
- 修改内容：前：每次drop都开始导入。后：ref同步拒绝进行中的重入，finally释放；导入完成后仍允许下一次操作。
- 验证方法：Dashboard.test.tsx：延迟第一笔导入，连续drop两次仅调用一次；完成后再次drop调用第二次。
- 验证结果：组件运行测试通过；未在真实业务库重复导入文件。

### F2

- 位置：`components/Dashboard/Home/HomeBoardCanvas.tsx:95`。
- 现象：异步刷新列表后不能采用新的活动数据集；已移除选择还使预览区域空白。
- 证据：red-states.txt两个HomeBoardCanvas.audit用例失败；旧effect未依赖datasets，找不到选择时只清store、不清本地选择。
- 根因：本地选择与异步数据集目录生命周期不同步；两个表现合并为一个根因。
- 修改内容：前：列表更新不触发活动选择同步，移除后仍保存selectedDataset。后：同步依赖包含datasets，失效选择同时清本地和store。
- 验证方法：HomeBoardCanvas.audit.test.tsx：延迟目录刷新+新活动选择；移除已选定义后恢复未选择并显示剩余数据集。
- 验证结果：两个组件运行用例通过；正常真实数据集预览见03截图。

### F3

- 位置：`components/Dashboard/Home/DatasetPreview.tsx:40`。
- 现象：翻到第二页后总量缩小，页面可停留在越界offset并失去上一页入口。
- 证据：red-tests.txt分页用例失败；原先直接采用COUNT和OFFSET结果，分页仅在total>50时显示。DashboardWidget已有lastPage纠正可复用。
- 根因：刷新没有校正当前页码。
- 修改内容：前：保留越界page。后：按COUNT计算lastPage，越界时先切页并重新查询，沿用DashboardWidget已有处理方式。
- 验证方法：DatasetPreview.requests.test.tsx：总量75、第二页→刷新25，验证最后一次查询OFFSET 0。
- 验证结果：组件运行测试通过。总量变化为故障注入，样本行读取真实data/crud-lab/baseline.duckdb；未删除实库记录。

### F4

- 位置：`components/Dashboard/Home/WorkspaceObjects.tsx:48`。
- 现象：内容库请求失败显示成暂无分析，错误位于抽屉外且无原地重试。
- 证据：red-states.txt：打开的dialog内找不到alert，加载失败仍满足objects.length===0空状态条件。
- 根因：加载、加载失败、真实空数据共用空列表；错误反馈不在当前操作层。
- 修改内容：前：失败后空列表+抽屉外error。后：独立loading/loadError，抽屉内反馈与重试，加载或失败时不宣称真空数据。
- 验证方法：WorkspaceObjects.test.tsx：首请求拒绝→dialog显示错误→原地重试→真实对象返回；旧请求覆盖测试继续通过。
- 验证结果：组件故障注入测试通过；正常搜索空结果/清除筛选浏览器检查通过，见05、06截图。

### F5

- 位置：`components/Dashboard/QuickTablePeekDrawer.tsx:77`。
- 现象：表名/列名含双引号时，速览、空值定位和快捷SQL生成非法标识符。
- 证据：before副本中SELECT/SUMMARIZE/IS NULL直接插值双引号；red-peek.txt标识符用例失败；databaseCatalog已有quoteIdent。
- 根因：显示名称未经过既有标识符转义。
- 修改内容：前：手动拼接双引号。后：样本、行数、画像、编辑器SQL、空值筛选与hook快捷查询统一调用既有quoteIdent；不改变查询含义。
- 验证方法：QuickTablePeekDrawer.audit.test.tsx验证quoted"table和quoted"column查询；Dashboard.test.tsx验证快捷查询转交SQL。
- 验证结果：组件与hook运行测试通过；速览当前无可达首页入口，未声称其浏览器端到端通过。

### F6

- 位置：`components/Dashboard/QuickTablePeekDrawer.tsx:54`。
- 现象：速览读取失败可被显示为表中暂无数据，统计画像失败被吞掉。
- 证据：旧catch仅toast/log，sampleRows为空进入空表提示；summary catch空；red-peek.txt失败状态用例失败。
- 根因：缺少独立请求错误状态和恢复入口。
- 修改内容：前：失败后渲染空表。后：区分核心错误/统计画像错误，当前抽屉显示原因与重试；核心失败时不显示空数据结论。
- 验证方法：QuickTablePeekDrawer.audit.test.tsx：schema拒绝→alert且无空表提示→重试后样本出现。
- 验证结果：组件运行测试通过；统计画像错误分支作静态核对，未独立注入SUMMARIZE失败。

### F7

- 位置：`components/Dashboard/QuickTablePeekDrawer.tsx:131`。
- 现象：剪贴板写入拒绝时仍提示复制成功，并产生未处理的Promise拒绝。
- 证据：旧writeText调用被void丢弃，之后立即setCopied和success；red-peek.txt剪贴板拒绝用例失败。
- 根因：未等待异步结果就报告成功。
- 修改内容：前：发起复制立即报告成功。后：await写入成功再提示，失败清成功标志并展示失败原因。
- 验证方法：QuickTablePeekDrawer.audit.test.tsx：剪贴板拒绝，断言error且success未被调用。
- 验证结果：组件运行测试通过；未读取或修改用户剪贴板。

### F8

- 位置：`components/Dashboard/Home/WorkspaceObjects.tsx:365`。
- 现象：已有看板引用没有已在看板标记。
- 证据：saveObjectReference保存analysis-ref:kind:id，旧UI只比较裸object.id；red-reference.txt用例失败；浏览器05截图显示修复后的标记。
- 根因：来源对象ID与保存查询引用ID混用。
- 修改内容：前：裸ID比较。后：抽出现有ID表达式为objectReferenceQueryId，保存与比较共用；已有ID编码、存储字段与允许重复放置规则均未改变。
- 验证方法：WorkspaceObjects.test.tsx：带canonical savedQueryId的放置实例显示已在看板；浏览器当前持久库验证标记。
- 验证结果：组件测试和浏览器检查通过。

### F9

- 位置：`hooks/useDashboardWorkflow.ts:423`。
- 现象：整批元数据读取失败仅记录日志，首页可能误显示没有数据。
- 证据：旧refreshTableDetails最外层catch只有console.error；red-metadata.txt模拟catalog读取拒绝时找不到alert。
- 根因：整个元数据快照缺少可传递的错误状态。
- 修改内容：前：异常无可见反馈。后：hook提供tableDetailsError，经Dashboard传入现有首页组件，显示原因及重试；错误时不显示无数据结论，已有数据仍保留。
- 验证方法：Dashboard.test.tsx：catalog拒绝后错误可见且没有导入数据开始分析提示；正常空状态原用例继续通过。
- 验证结果：组件故障注入测试通过；相关类型检查和构建通过。

## 待确认项（未自动修改）

### C1 零记录时是否应保留工作台能力（二级，无法确认）

- 位置：components/Dashboard/MissionControl/DataIdeMissionControl.tsx的hasData和HomeBoardCanvas显示条件。
- 现象：所有已识别数据集rowCount均为0且元数据可用时，页面只显示“数据集暂无记录”和导入入口，已有视图/图表入口不出现。
- 证据：hasData使用tables.some(rowCount > 0)或元数据不可用；HomeBoardCanvas以hasData为显示门槛。
- 建议处理：先确定空数据业务展示规则；不能擅自改动这一判定。
- 需要确认：空表是否仍应可浏览字段、编辑已有分析和展示记录数0，还是当前空态就是预期。缺少明确产品验收规则；以该规则和一个全空表库的端到端验收确认。

### C2 快速查看抽屉的产品入口（无法确认，按二级保留）

- 位置：Dashboard.tsx的handleOpenPeek/peekTableName和DataIdeMissionControl.tsx的onPeekTable参数。
- 现象：首页仍引用并可挂载QuickTablePeekDrawer，但当前HomeHeader/HomeBoardCanvas挂载链中没有可见控件调用onPeekTable。
- 证据：Dashboard向DataIdeMissionControl传递onPeekTable；后者接受参数但未调用或继续传递，HomeBoardCanvasProps不含peek回调。
- 建议处理：保留组件；本次只修现存实现缺陷，不添加没有指定位置的新入口，也不删除能力。
- 需要确认：它是保留兼容能力，还是应在哪个现有控件打开。缺少入口位置/交互验收依据；给出预期路径后才能浏览器验证。

## 正常业务差异和未认定问题

- 同一对象允许多个组件实例：addObjectToDashboard每次创建独立放置ID，WidgetSettings支持独立设置，WidgetInstanceEditor说明明确。已有55个组件里可见重复标题，仅凭相同标题不能认定重复写入，更不能删除或去重。
- 数据集下拉可浏览已挂载的其他catalog：loadDatasets枚举DuckDB catalog并生成限定来源SQL。与首页头部当前库统计不同是代码支持的跨库分析能力，不擅自限制。
- 图表配置刚打开时短暂显示未选择，稳定后正确绑定crud_lab.main.fiat_transactions并显示25；不是缺口。
- 整库字段大小/更新时间显示未知是没有可靠测量来源的诚实状态，未填写静态数值。
- 无业务背景，不新增推导项；整板导出、权限设计、视图删除等不能仅凭泛化CRUD预期列为功能缺口。

## 三轮、自我核查与停止

1. 第一轮：F1–F4，先复现再修；已有基线57项通过，首轮修后62项通过。该轮仅4项，抽查覆盖全部4项。
2. 第二轮：F5–F8；标识符/错误/剪贴板3项原用例全部失败，引用标记新增用例失败，随后修复。中间final-regression.txt含尚未修复F8用例的一次失败，已由最终acceptance-tests.txt替代，不当作最终通过证据。
3. 第三轮：F9；red-metadata.txt先证明失败，再修；最终118项通过。到达3轮上限，交付前再次核对没有新增已证实一级项。停止依据是轮数上限和本次已知一级项均有验证，不宣称系统不存在未知问题。

随机抽查在交付前按各轮修复集合补做，而非声称已在前两轮结束当时完成。可复现随机种子2026101301/02/03：第一轮F4/F1/F3/F2，第二轮F7/F1/F4/F5/F3，第三轮F6/F4/F8/F9/F1。均回读证据、修改前后diff和验证断言，全部对应；另通读changes.diff重核9项，未发现条目错配。未将业务差异当缺口、未用推测作事实、未修改二级项；范围内模块静态覆盖完整，浏览器未覆盖项目逐项明确，不外推通过。

## 转UI审查

UI-1：截图03/08可见紧凑指标卡内部有滚动条，标题/单位密度偏高。这里只记录视觉可读性，未调整卡片尺寸、样式或保存布局。未开展全系统UI审查。

## 浏览器步骤与证据限制

| 步骤 | 结果 | 截图 |
|---|---|---|
| 1 首页空状态与导入入口 | 空态可见、点击打开导入；未执行导入写入 | 01-empty-before.png（空态；导入弹窗仅DOM观察，未接受弹窗截图） |
| 2 已有库恢复首页 | 有7个当前库数据集和55个既有组件；不推断组件生成原因 | 02-restored-home-before.png |
| 3 选择真实数据集 | 10字段、25行、NULL/日期/金额展示可见 | 03-real-preview.png |
| 4 从预览创建图表 | 正确带入数据集，实时COUNT为25；取消返回，未保存 | 04-chart-builder.png |
| 5 添加分析内容库 | 45个对象、已有对象正确标记 | 05-library-linked.png |
| 6 搜索无匹配与清除 | 0/45、明确空结果；清除恢复45/45 | 06-library-empty-search.png |
| 7 筛选配置 | 不完整条件按钮禁用，取消关闭 | 07-filter-config.png |
| 8 视图管理空白名称 | 创建/重命名/复制均禁用；恢复并折叠 | 08-view-validation.png |

八张保存截图均重新打开核对；开发热更新关闭弹窗后的错名捕获已重新命名或重拍，不用错状态作为证据。未对现有业务库做删除、导入或新增图表操作。组件写入/并发/版本保护通过现有dbService与首页服务测试验证，不等同于所有真实库均已测试。

## 回退说明

changes.diff仅含本次8个产品文件的变更；before保存修改前内容，changes.json用于检测交付后漂移。可按F编号对应diff块逆向回退；若用户后来编辑同文件，应人工合并指定块，不能整仓库回滚。新增/补充测试保留为回归证据。报告和截图在本目录，未发布到外部服务。
