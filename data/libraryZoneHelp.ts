/**
 * data/libraryZoneHelp.ts — LibraryApp Tab Zone 帮助内容数据
 *
 * 从 components/Library/LibraryApp.tsx 中迁移而来（2026-06-08）。
 * 作为纯数据文件，便于独立维护和编辑。
 */

export type LibraryTab =
  | 'meta'
  | 'ddl'
  | 'dml'
  | 'dql'
  | 'functions'
  | 'dcl'
  | 'optimization';

export interface ZoneDescription {
  title: string;
  description: string;
  scenarios: string[];
  warnings: string[];
}

export const ZONE_DESCRIPTIONS: Record<LibraryTab, ZoneDescription> = {
  meta: {
    title: '元知识区',
    description: 'SQL 基础概念总览：语言分类(DDL/DML/DQL/DCL/TCL)、OLTP 与 OLAP 引擎区别、查询逻辑执行顺序、数据类型体系、方言差异速查、SQL 标准演进。',
    scenarios: ['理解 SQL 全貌与分类', '查询执行顺序导致的语法限制', '选择合适的数据库引擎', '跨方言语法转换'],
    warnings: ['此区偏理论，理解为主', '具体语法请参考对应分区'],
  },
  ddl: {
    title: 'DDL 区',
    description: '数据定义语言：库表创建删除、临时表、ALTER TABLE 修改结构、约束体系(主键/外键/唯一/检查/默认)、索引管理，普通视图与物化视图、触发器、序列、表分区策略。',
    scenarios: ['新建数据库表结构', '修改已有表结构', '创建索引优化查询', '使用物化视图预计算报表'],
    warnings: ['DDL 操作通常不可回滚', '删除表前请确认数据已备份'],
  },
  dml: {
    title: 'DML 区',
    description: '数据操纵语言：INSERT 单行/多行插入、UPDATE 条件更新、DELETE 条件删除、TRUNCATE 清空表、MERGE/UPSERT 合并操作、SELECT INTO 导出结果。',
    scenarios: ['批量导入数据', '按条件更新记录', '实现"存在则更新、不存在则插入"', '数据归档与清理'],
    warnings: ['UPDATE/DELETE 无 WHERE 会影响全表', '建议先 SELECT 确认影响范围'],
  },
  dql: {
    title: 'DQL 区',
    description: '数据查询语言：基础检索与排序、条件过滤(WHERE/LIKE/IN/BETWEEN)、多表关联(INNER/LEFT/RIGHT/FULL/CROSS/SELF/LATERAL/ASOF)、聚合分组(GROUP BY/HAVING/ROLLUP/CUBE)、子查询与 CTE、窗口函数(排名/偏移/聚合/QUALIFY)。',
    scenarios: ['日常数据查询', '复杂多表关联分析', '分组统计与报表', '时间序列分析', '累计计算与移动平均'],
    warnings: ['窗口函数不在 GROUP BY 中折叠行', 'QUALIFY 子句仅现代 OLAP 引擎支持'],
  },
  functions: {
    title: '函数库',
    description: '内置函数大全：字符串函数(CONCAT/SUBSTRING/REPLACE/TRIM)、数值函数(ROUND/CEIL/FLOOR/POWER)、日期时间函数(NOW/DATEADD/DATEDIFF)、空值处理(COALESCE/IFNULL/NULLIF)、类型转换(CAST/::)、条件分支(CASE/IF)、JSON 函数、数组函数、序列生成。',
    scenarios: ['数据清洗与格式化', '日期时间计算', 'JSON 嵌套数据提取', '类型转换与校验'],
    warnings: ['不同数据库函数名可能不同', '注意各方言函数差异表'],
  },
  dcl: {
    title: 'DCL/TCL 区',
    description: '权限与事务控制：GRANT/REVOKE 权限管理、角色创建、事务控制(BEGIN/COMMIT/ROLLBACK)、ACID 特性、隔离级别(READ UNCOMMITTED/READ COMMITTED/REPEATABLE READ/SERIALIZABLE)、保存点、SQL 注入防御。',
    scenarios: ['数据库用户权限管理', '确保数据一致性', '处理并发事务', '应用安全防护'],
    warnings: ['生产环境遵循最小权限原则', '事务不宜过长以免锁表'],
  },
  optimization: {
    title: '性能优化区',
    description: '查询性能优化：执行计划解读(EXPLAIN/ANALYZE)、索引类型(聚集/非聚集/复合/覆盖/全文)、复合索引最左前缀原则、索引失效场景、查询改写与反模式(N+1/SELECT */OFFSET 分页)、统计信息与优化器、行存储 vs 列存优化思路。',
    scenarios: ['分析慢查询原因', '优化大表分页', '选择合适的索引策略', '理解行列存储差异'],
    warnings: ['索引不是越多越好', '先 EXPLAIN 再优化'],
  },
};
