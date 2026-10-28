# 工作区写入与 DuckDB 导入预览修复

## 原始故障

用户提供的控制台日志包含两项实际错误：

1. `CREATE SCHEMA ... duckdb_manager_workspace.__studio` 提交时报 `File is not opened in write mode`，影响首页看板及数据流元数据。
2. DuckDB 导入预览查询到表名后，临时 `_import_db_*` 被 DETACH，随后 DESCRIBE 报 `Catalog ... does not exist`。

React DevTools、Vite 连接及浏览器缺少 Tauri metadata 的提示不是这两项故障。

## 根因及修改

- 主工作区通过未注册的 `opfs://` 路径打开，与其他可写域库的文件句柄路径不一致；零字节文件可以表现为打开成功，却不能提交写入。现在仅为新建/零字节工作区写入已校验的现有空数据库模板，然后复用 BROWSER_FSACCESS 可写句柄注册，以返回的 VFS 路径打开。已有非空工作区绝不覆盖；权限、锁或损坏文件仍保留明确的持久化错误。
- 文件选择同时启动即时预览与延迟 effect 预览；共享临时资源集合使后一次清理破坏前一次读取。现在单一 effect 触发预览，服务统一串行管理预览与资源清理，页面使用请求版本号忽略过期返回/错误/加载结束通知。关闭/重置使旧请求失效。

修改复用现有 runtime、OPFS 文件工具、导入服务和 ImportWizard，不更换引擎，不清理用户数据。此次没有把显式 READ_ONLY 挂载改成可写，也没有以内存回退作为持久化通过条件。

## 复测

| 案例 | 预期 | 实际/证据 | 结果 |
| --- | --- | --- | --- |
| 两次重叠预览，第一项停在目录读取 | 第一项完成前不得 DETACH | 修复前1次提前DETACH，`output/import-race-before.log`：1失败/10通过；修复后相同断言通过 | PASS |
| 旧预览晚于新文件完成 | 新预览保留，旧结果不覆盖，无重复调用 | ImportWizard组件测试等待旧Promise完成并刷新React后验证 | PASS |
| 零字节/非空工作区 | 仅零字节初始化，非空不下载模板/不写入 | OPFS工具测试；模板合法性及注册顺序测试 | PASS |
| 实际主工作区写入 | 必须为persistent，CREATE/INSERT/SELECT成功 | 独立生产浏览器主库可写、读回42；`output/workspace-write-final.log` | PASS |
| 刷新后的持久化 | 必须仍为persistent，刷新后读回原写入值 | 实际读回104270，并清理专用测试表；`output/workspace-persistence-final.log` | PASS |
| 真实文件生产界面预览 | baseline.duckdb，两个schema，8表/136行，无丢失catalog | 上传后READY，main与lab_baseline表信息存在，无pageerror；`output/import-preview-final.log`、`output/playwright/import-preview-fixed.png` | PASS |
| 关联保护 | runtime/OPFS/导入/事务/看板保存/界面现有功能不回归 | 9文件86项通过，`output/import-bug-final-regression.log` | PASS |
| 类型检查/构建 | 无类型/构建错误 | `output/import-bug-typecheck-final.log`；`output/import-storage-build.log`构建成功，既有WASM eval及chunk警告保留 | PASS |

浏览器测试使用独立会话，不操作用户现有浏览器数据库。仅写入测试专用表并删除；原始 baseline 文件没有改变。开发热更新中断上传、探针错误地重新导入另一份带不同Vite时间戳的服务模块，均作为测试环境问题修正后重跑，没有将内存降级或中断运行计为PASS。

复测命令（项目根目录）：

```powershell
pnpm exec vitest run services/duckdbRuntime.test.ts services/opfsDatabaseFiles.test.ts services/localDuckdbImport.test.ts services/duckdbService.persistence.test.ts services/duckdbService.viewsMacros.test.ts services/dataImportService.test.ts services/excelMultiSheetIntegration.test.ts components/ImportWizard.test.tsx services/dbService.dashboard.test.ts --maxWorkers=1 --no-file-parallelism
pnpm typecheck
pnpm build
```

浏览器重跑 `test/workspace-write-browser.js`、`test/workspace-persistence-browser.js`、`test/import-preview-browser.js`。这些操作验证日志中的两个故障，不代表上一份全局可视化BRD的全部遗留项已完成；本轮未重新执行整个2443项项目测试集。
