# checks/ — 自检清单

> AI 每次开始工作时，按此清单做预检。发现问题先处理再开工。

## 开始工作前（每次）

```
□ 已读取 attention.md
□ 任务涉及 Ontology 模块？已读取 .codestable/architecture/ontology.md
□ 任务涉及 AI Skills？已读取 skillExecutor.ts 作为参考
□ 任务涉及类型定义？已读取 types.ts 相关段落
□ 任务涉及 DuckDB WASM？已知 duckDBService.flushCatalog() workaround
□ 硬禁止操作已确认不在范围内
□ 涉及文件已通过 grep 确认 import 路径正确
```

## 生成代码后（每次）

```
□ tsc --noEmit — 0 errors
□ 没有引入新的 console.error/warning
□ 没有破坏现有 import 链
□ 没有绕过 useOntologyStore 直接读写 DuckDB 本体数据
□ 没有单独改动 D3GraphView 或 OntologyCanvas 之一而不考虑另一个
□ 数据迁移类修改已验证两端一致性
```

## 涉及大文件修改时

```
□ 文件超过 300 行？考虑拆分而非原地大改
□ 内联数据对象超过 100 行？迁移到 data/ 目录
□ 需要 str_replace 大段内容（200+ 行）？改用 Write 工具重建文件或用子代理
□ Windows 路径格式（反斜杠）≠ 实际文件路径
```

## 涉及 import 路径时

```
□ 组件在 components/ 下 → data/ 为 ../data/
□ 组件在 components/Library/ 下 → data/ 为 ../../data/
□ 组件在 components/Abstraction/ 下 → data/ 为 ../../data/
□ hooks/ 下 → data/ 为 ../data/
□ src/ 下 → data/ 为 ../data/
□ services/ 下 → data/ 为 ../data/
```

## 涉及模块边界时

```
□ Abstraction 模块 ≠ Library 模块（职责完全不同）
□ Abstraction 在 AnalysisHub 下（Tab.ANALYSIS → AnalysisHubPanel）
□ Library 是独立 Tab（Tab.LIBRARY）
□ Ontology 在独立 Tab（Tab.ONTOLOGY）
□ useAbstractionStore 已废弃，应使用 useAnalysisHubStore
□ abstractionStore 别名已移除
```

## 测试相关

```
□ 核心 CRUD 逻辑已写测试
□ 新增的 data/*.ts 工具函数已写测试
□ 迁移的代码已更新或保留测试
□ 运行 npm test 确认无新失败（允许已有的 skillExecutor.test.ts 失败）
```
