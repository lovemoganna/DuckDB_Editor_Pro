import React from 'react';
import { Zap, ArrowRight, Table, Database, HardDrive, Sparkles } from 'lucide-react';

interface InstantQueryScratchpadProps {
  tables: string[];
  onRunSqlTemplate: (sql: string) => void;
}

export const InstantQueryScratchpad: React.FC<InstantQueryScratchpadProps> = ({
  tables,
  onRunSqlTemplate,
}) => {
  const firstTable = tables[0] || 'your_table';

  const operators = [
    {
      title: '🔍 全库数据量与元数据扫描',
      desc: '查询 duckdb_tables() 查看容量预估与架构',
      sql: `-- DuckDB 元数据全景扫描\nSELECT table_schema, table_name, estimated_size, column_count\nFROM duckdb_tables();`,
      color: 'hover:border-monokai-border-strong',
      tag: 'SCHEMA SCAN',
    },
    {
      title: '📊 字段类型与架构全景剖析',
      desc: '查询 duckdb_columns() 审查字段拓扑',
      sql: `-- 跨表关联分析与聚合探查\nSELECT *\nFROM duckdb_columns()\nORDER BY table_name, column_index;`,
      color: 'hover:border-monokai-border-strong',
      tag: 'COLUMN METRICS',
    },
    {
      title: '💾 零拷贝 Parquet 高速导出模板',
      desc: `COPY ... TO 'export.parquet' (FORMAT PARQUET)`,
      sql: `-- 零拷贝导出为 Parquet 格式\nCOPY (SELECT * FROM "${firstTable}") TO 'export_${firstTable}.parquet' (FORMAT PARQUET);`,
      color: 'hover:border-monokai-border-strong',
      tag: 'FAST EXPORT',
    },
    {
      title: '⚡ 智能数据画像全景探查 (SUMMARIZE)',
      desc: `SUMMARIZE "${firstTable}" 查看统计分布与空值率`,
      sql: `-- 统计画像探查\nSUMMARIZE "${firstTable}";`,
      color: 'hover:border-monokai-border-strong',
      tag: 'PROFILING',
    },
  ];

  return (
    <div className="flex flex-col rounded-md border border-monokai-border bg-monokai-surface overflow-hidden font-sans">
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-monokai-border bg-monokai-elevated">
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-monokai-yellow" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-monokai-fg">
            高频 DuckDB 分析算子
          </h3>
        </div>
        <span className="text-2xs font-mono text-monokai-comment">1-CLICK EXECUTE</span>
      </div>

      <div className="p-2.5 space-y-1.5 font-mono text-xs">
        {operators.map((op, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onRunSqlTemplate(op.sql)}
            className={`w-full text-left flex items-center justify-between p-2 rounded-md bg-monokai-bg hover:bg-monokai-elevated border border-monokai-border/40 ${op.color} transition-colors cursor-pointer group`}
          >
            <div className="min-w-0 flex-1 pr-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-monokai-fg truncate">{op.title}</span>
                <span className="text-2xs px-1 py-0.2 rounded border border-monokai-border/60 bg-monokai-surface text-monokai-comment shrink-0">
                  {op.tag}
                </span>
              </div>
              <div className="text-2xs text-monokai-comment truncate mt-0.5">
                {op.desc}
              </div>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-monokai-comment group-hover:text-monokai-fg transition-transform group-hover:translate-x-0.5 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
};
