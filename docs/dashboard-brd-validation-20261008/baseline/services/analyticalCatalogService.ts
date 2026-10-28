/**
 * Build an analytical field catalog from live DuckDB tables.
 * No mock / static business values — only introspection + SUMMARIZE + constraints.
 */

import { duckDBService } from './duckdbService';
import { classifySemanticType } from './analysis/semantic';
import type {
  AnalyticalCatalog,
  AnalyticalField,
  CategoryDimensionRef,
  ComparisonDimensionRef,
  CoreMetricProposal,
  DrillPathRef,
  FieldRole,
  HierarchyDomain,
  LinkageFieldRef,
  LinkageRole,
  MetricAgg,
  TableAnalyticalSummary,
  TableDataReadiness,
  TimeDimensionRef,
} from '../types/analyticalCatalog';

const SYSTEM_SCHEMAS = new Set(['information_schema', 'pg_catalog', 'duckdb_catalog']);

function escapeIdent(name: string): string {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function inferSuggestedGrain(colName: string): 'day' | 'week' | 'month' | 'quarter' | 'year' {
  const n = colName.toLowerCase();
  if (n.includes('quarter')) return 'quarter';
  if (n.includes('year_month') || n.includes('month')) return 'month';
  if (n.includes('year') && !n.includes('month') && !n.includes('quarter')) return 'year';
  if (n.includes('week')) return 'week';
  return 'day';
}

function inferLinkageRole(colName: string, role: FieldRole): LinkageRole {
  const n = colName.toLowerCase();
  if (role === 'identifier' || n.endsWith('_id') || n === 'id') {
    return 'drill_bridge';
  }
  if (
    role === 'category' ||
    /region|channel|status|category|country|city|segment|tier|brand|type|method/i.test(n)
  ) {
    return 'primary_filter';
  }
  if (role === 'time') {
    return 'primary_filter';
  }
  if (role === 'attribute') {
    return 'cross_highlight';
  }
  return 'secondary_filter';
}

const HIERARCHY_DEFINITIONS: Array<{
  domain: HierarchyDomain;
  from: string;
  to: string;
}> = [
  { domain: 'geographic', from: 'region', to: 'country' },
  { domain: 'geographic', from: 'country', to: 'city' },
  { domain: 'product', from: 'category', to: 'subcategory' },
  { domain: 'product', from: 'subcategory', to: 'brand' },
  { domain: 'temporal', from: 'order_year', to: 'fiscal_quarter' },
  { domain: 'temporal', from: 'fiscal_quarter', to: 'order_month' },
  { domain: 'temporal', from: 'order_month', to: 'order_date' },
  { domain: 'entity', from: 'customer_segment', to: 'loyalty_tier' },
];

function inferHierarchicalDrillPaths(tables: TableAnalyticalSummary[]): DrillPathRef[] {
  const paths: DrillPathRef[] = [];
  const seen = new Set<string>();

  for (const def of HIERARCHY_DEFINITIONS) {
    for (const t of tables) {
      const colNames = t.fields.map((f) => f.columnName.toLowerCase());
      const hasFrom = colNames.includes(def.from.toLowerCase());
      const hasTo = colNames.includes(def.to.toLowerCase());

      if (hasFrom && hasTo) {
        const fromActual = t.fields.find((f) => f.columnName.toLowerCase() === def.from.toLowerCase())!.columnName;
        const toActual = t.fields.find((f) => f.columnName.toLowerCase() === def.to.toLowerCase())!.columnName;
        const key = `${def.domain}:${t.tableName}:${fromActual}->${toActual}`;
        if (!seen.has(key)) {
          seen.add(key);
          paths.push({
            id: `drill-hier-${def.domain}-${t.tableName}-${fromActual}-${toActual}`,
            fromTable: t.tableName,
            fromColumn: fromActual,
            toTable: t.tableName,
            toColumn: toActual,
            label: `${fromActual} → ${toActual}`,
            hierarchyType: def.domain,
            detailSqlTemplate: `SELECT ${escapeIdent(toActual)}, COUNT(*) AS count FROM ${escapeIdent(t.tableName)} WHERE ${escapeIdent(fromActual)} = {{value}} GROUP BY 1 ORDER BY 2 DESC;`,
          });
        }
      }
    }

    // Cross-table hierarchies if not present within a single table
    if (!paths.some((p) => p.hierarchyType === def.domain && p.fromColumn.toLowerCase() === def.from.toLowerCase() && p.toColumn.toLowerCase() === def.to.toLowerCase())) {
      const fromTables = tables.filter((t) => t.fields.some((f) => f.columnName.toLowerCase() === def.from.toLowerCase()));
      const toTables = tables.filter((t) => t.fields.some((f) => f.columnName.toLowerCase() === def.to.toLowerCase()));
      for (const ft of fromTables) {
        for (const tt of toTables) {
          const fromActual = ft.fields.find((f) => f.columnName.toLowerCase() === def.from.toLowerCase())!.columnName;
          const toActual = tt.fields.find((f) => f.columnName.toLowerCase() === def.to.toLowerCase())!.columnName;
          const key = `${def.domain}:${ft.tableName}.${fromActual}->${tt.tableName}.${toActual}`;
          if (!seen.has(key)) {
            seen.add(key);
            paths.push({
              id: `drill-hier-${def.domain}-${ft.tableName}-${tt.tableName}-${fromActual}-${toActual}`,
              fromTable: ft.tableName,
              fromColumn: fromActual,
              toTable: tt.tableName,
              toColumn: toActual,
              label: `${fromActual} → ${toActual}`,
              hierarchyType: def.domain,
              detailSqlTemplate: `SELECT ${escapeIdent(toActual)}, COUNT(*) AS count FROM ${escapeIdent(tt.tableName)} WHERE ${escapeIdent(fromActual)} = {{value}} GROUP BY 1 ORDER BY 2 DESC;`,
            });
          }
        }
      }
    }
  }

  return paths;
}

function scoreTimeColumn(name: string, type: string): number {
  const n = name.toLowerCase();
  let s = 40;
  if (/date|time|timestamp|_at$|_on$/.test(n)) s += 30;
  if (/^order_|^tx_|^event_|^created|^updated|^signup|^request/.test(n)) s += 15;
  if (/year|quarter|month|week|day/.test(n)) s += 20;
  if (/DATE|TIMESTAMP|TIME/i.test(type)) s += 20;
  if (/id$|uuid/.test(n)) s -= 40;
  return s;
}

function scoreCategoryColumn(
  name: string,
  distinct: number | null,
  rowCount: number,
): number {
  const n = name.toLowerCase();
  let s = 30;
  if (/status|region|category|subcategory|brand|type|channel|method|source|platform|segment|level|grade|country|state|city|tier/.test(n)) {
    s += 35;
  }
  if (distinct != null && rowCount > 0) {
    if (distinct >= 2 && distinct <= 30) s += 25;
    else if (distinct <= 100) s += 10;
    else if (distinct > rowCount * 0.5) s -= 30;
  }
  if (/id$|uuid|email|title|desc|comment|url|path/.test(n)) s -= 20;
  return s;
}

function scoreMeasureColumn(name: string, type: string): number {
  const n = name.toLowerCase();
  let s = 35;
  if (/amount|revenue|sales|price|qty|quantity|count|total|cost|fee|profit|margin|score|rate|pct|percent|latency|duration|value|sum|avg|aov/.test(n)) {
    s += 40;
  }
  if (/INT|DOUBLE|FLOAT|DECIMAL|NUMERIC|REAL|HUGEINT/i.test(type)) s += 15;
  if (/_id$|^id$|uuid|year|month|day|hour|code/.test(n)) s -= 45;
  return s;
}

function mapRole(
  colName: string,
  colType: string,
  distinct: number | null,
  rowCount: number,
  isPk: boolean,
): { role: FieldRole; confidence: number } {
  const n = colName.toLowerCase();
  const semantic = classifySemanticType(colName, colType);
  if ((isPk && semantic !== 'temporal') || semantic === 'identifier') {
    return { role: 'identifier', confidence: isPk ? 95 : 80 };
  }
  if (
    semantic === 'temporal' ||
    /date|time|timestamp|_at$|_on$|year_month|fiscal_quarter|order_month|order_week|order_year|full_date/.test(n)
  ) {
    return { role: 'time', confidence: Math.min(98, scoreTimeColumn(colName, colType)) };
  }
  if (semantic === 'boolean' || /^is_|^has_/.test(n)) {
    return { role: 'boolean', confidence: 90 };
  }
  if (semantic === 'numeric') {
    if (/year|month|day|quarter|week/.test(n) && !/amount|revenue|cost|price|count|sum|avg|profit|rate|score|qty|units/.test(n)) {
      return { role: 'time', confidence: 85 };
    }
    const ms = scoreMeasureColumn(colName, colType);
    if (ms >= 50) return { role: 'measure', confidence: Math.min(95, ms) };
    // High-cardinality numeric often still measure; low-card may be coded category
    if (distinct != null && distinct > 0 && distinct <= 20 && rowCount > distinct * 3) {
      return { role: 'category', confidence: 55 };
    }
    return { role: 'measure', confidence: Math.max(40, ms) };
  }
  // categorical / text
  const cs = scoreCategoryColumn(colName, distinct, rowCount);
  if (cs >= 45) {
    if (distinct == null || (distinct >= 1 && distinct <= Math.max(100, rowCount * 0.5))) {
      return { role: 'category', confidence: Math.min(92, cs) };
    }
  }
  if (semantic === 'categorical') {
    if (distinct == null || distinct <= Math.max(100, rowCount * 0.5)) {
      return { role: 'category', confidence: 75 };
    }
  }
  return { role: 'attribute', confidence: 40 };
}

function suggestedAggsFor(role: FieldRole, name: string): MetricAgg[] | undefined {
  if (role !== 'measure') return undefined;
  const n = name.toLowerCase();
  if (/rate|pct|percent|ratio|score|avg|price/.test(n)) return ['avg', 'min', 'max'];
  if (/qty|quantity|count|orders?/.test(n)) return ['sum', 'avg', 'count'];
  return ['sum', 'avg', 'min', 'max'];
}

function readinessForTable(
  summary: Omit<TableAnalyticalSummary, 'readiness'>,
  drillPaths: DrillPathRef[],
  linkageFields: LinkageFieldRef[],
): TableDataReadiness {
  const hasMeasure = summary.measures.length > 0 || summary.rowCount >= 0;
  const hasTime = summary.timeDimensions.length > 0;
  const hasCategory = summary.categoryDimensions.length > 0;
  const hasComparison =
    summary.categoryDimensions.some((f) => (f.distinctCount ?? 99) <= 20 || /status|channel|segment|tier|type|method|region|brand|price_tier/i.test(f.columnName)) ||
    summary.timeDimensions.length > 0;
  const hasDrillTarget = drillPaths.some(
    (d) => d.fromTable === summary.tableName || d.toTable === summary.tableName,
  );
  const hasLinkageKey = linkageFields.some((l) => l.tables.includes(summary.tableName));

  const missing: string[] = [];
  if (summary.measures.length === 0) missing.push('核心度量列（数值指标）');
  if (!hasTime) missing.push('时间维度');
  if (!hasCategory) missing.push('分类维度');
  if (!hasComparison) missing.push('对比维度（低基数分类或时间）');
  if (!hasDrillTarget) missing.push('可下钻关联（外键/同名键）');
  if (!hasLinkageKey) missing.push('图表联动字段');

  let score = 0;
  if (summary.measures.length > 0) score += 25;
  else if (summary.rowCount > 0) score += 10; // COUNT(*) still a metric
  if (hasTime) score += 20;
  if (hasCategory) score += 20;
  if (hasComparison) score += 15;
  if (hasDrillTarget) score += 10;
  if (hasLinkageKey) score += 10;
  if (summary.rowCount <= 0) {
    missing.push('表无数据行');
    score = Math.min(score, 15);
  }

  const finalScore = Math.min(100, score);
  const tier: TableDataReadiness['tier'] =
    finalScore >= 80 ? 'complete' : finalScore >= 50 ? 'partial' : finalScore > 0 ? 'minimal' : 'empty';

  return {
    hasMeasure: summary.measures.length > 0,
    hasTime,
    hasCategory,
    hasComparison,
    hasDrillTarget,
    hasLinkageKey,
    score: finalScore,
    missing,
    tier,
    checklist: [
      hasMeasure ? '✓ 核心度量' : '✗ 缺失度量',
      hasTime ? '✓ 时间序列' : '✗ 缺失时间',
      hasCategory ? '✓ 分类维度' : '✗ 缺失分类',
      hasComparison ? '✓ 对比维度' : '✗ 缺失对比',
      hasDrillTarget ? '✓ 下钻路径' : '✗ 缺失下钻',
      hasLinkageKey ? '✓ 联动字段' : '✗ 缺失联动',
    ],
  };
}

interface SummarizeRow {
  column_name?: string;
  column_type?: string;
  min?: any;
  max?: any;
  approx_unique?: number;
  count?: number;
  null_percentage?: number | string;
}

async function profileTable(tableName: string): Promise<TableAnalyticalSummary> {
  const schema = await duckDBService.getTableSchema(tableName);
  let rowCount = 0;
  try {
    const cnt = await duckDBService.readQuery(
      `SELECT COUNT(*) AS c FROM ${escapeIdent(tableName)}`,
    );
    rowCount = Number(cnt?.[0]?.c || 0);
  } catch {
    rowCount = 0;
  }

  let summarize: SummarizeRow[] = [];
  if (rowCount > 0 && schema.length > 0) {
    try {
      summarize = (await duckDBService.readQuery(`SUMMARIZE ${escapeIdent(tableName)}`)) || [];
    } catch {
      summarize = [];
    }
  }

  const byName = new Map<string, SummarizeRow>();
  for (const row of summarize) {
    const n = String(row.column_name || '');
    if (n) byName.set(n, row);
  }

  const fields: AnalyticalField[] = (schema || []).map((col: any) => {
    const name = String(col.name || '');
    const type = String(col.type || 'UNKNOWN');
    const sum = byName.get(name);
    const distinct =
      sum?.approx_unique != null ? Number(sum.approx_unique) : null;
    const nullPct =
      sum?.null_percentage != null ? Number(sum.null_percentage) : null;
    const { role, confidence } = mapRole(
      name,
      type,
      distinct,
      rowCount,
      Boolean(col.pk),
    );
    return {
      tableName,
      columnName: name,
      physicalType: type,
      role,
      confidence,
      nullRate: nullPct,
      distinctCount: distinct,
      cardinalityRate:
        rowCount > 0 && distinct != null
          ? Math.round((distinct / rowCount) * 1000) / 10
          : null,
      min: sum?.min ?? null,
      max: sum?.max ?? null,
      suggestedAggs: suggestedAggsFor(role, name),
    };
  });

  const base = {
    tableName,
    rowCount,
    columnCount: fields.length,
    fields,
    measures: fields.filter((f) => f.role === 'measure'),
    timeDimensions: fields.filter((f) => f.role === 'time'),
    categoryDimensions: fields.filter((f) => f.role === 'category'),
    identifiers: fields.filter((f) => f.role === 'identifier'),
  };

  return {
    ...base,
    readiness: readinessForTable(base, [], []),
  };
}

async function loadForeignKeys(
  tableNames: string[],
): Promise<Array<{ fromTable: string; fromCol: string; toTable: string; toCol: string }>> {
  const out: Array<{ fromTable: string; fromCol: string; toTable: string; toCol: string }> = [];
  try {
    const rows = await duckDBService.readQuery(
      `SELECT table_name, constraint_column_names, constraint_text
       FROM duckdb_constraints()
       WHERE constraint_type = 'FOREIGN KEY' AND database_name = current_database() AND schema_name = current_schema()`,
    );
    for (const fk of rows || []) {
      const fromTable = String(fk.table_name || '');
      if (!tableNames.includes(fromTable)) continue;
      const fromCols = fk.constraint_column_names;
      const fromCol = Array.isArray(fromCols)
        ? String(fromCols[0] || '')
        : String(fromCols || '')
            .replace(/[{}]/g, '')
            .split(',')[0]
            ?.trim() || '';
      const text = String(fk.constraint_text || '');
      const refTable = text.match(/REFERENCES\s+"?([\w.]+)"?/i)?.[1] || '';
      const refCols =
        text
          .match(/REFERENCES\s+[\w."]+\s*\(([^)]+)\)/i)?.[1]
          ?.split(',')
          .map((s: string) => s.trim().replace(/"/g, '')) || [];
      const toTable = refTable.includes('.') ? refTable.split('.').pop()! : refTable;
      if (fromTable && fromCol && toTable) {
        out.push({
          fromTable,
          fromCol,
          toTable,
          toCol: refCols[0] || fromCol,
        });
      }
    }
  } catch {
    // FK catalog optional
  }

  return out;
}

function inferNameBasedLinks(
  tables: TableAnalyticalSummary[],
): Array<{ fromTable: string; fromCol: string; toTable: string; toCol: string }> {
  const links: Array<{ fromTable: string; fromCol: string; toTable: string; toCol: string }> = [];
  for (const t of tables) {
    for (const f of t.identifiers) {
      const n = f.columnName.toLowerCase();
      if (n === 'id') continue;
      const maybe = n.replace(/_id$/, '');
      for (const other of tables) {
        if (other.tableName === t.tableName) continue;
        const otherBase = other.tableName.toLowerCase().replace(/s$/, '');
        if (maybe === otherBase || maybe === other.tableName.toLowerCase()) {
          const pk =
            other.identifiers.find((c) => c.columnName.toLowerCase() === 'id') ||
            other.identifiers[0];
          if (pk) {
            links.push({
              fromTable: t.tableName,
              fromCol: f.columnName,
              toTable: other.tableName,
              toCol: pk.columnName,
            });
          }
        }
      }
    }
  }
  return links;
}

function buildCoreMetrics(tables: TableAnalyticalSummary[]): CoreMetricProposal[] {
  const metrics: CoreMetricProposal[] = [];

  for (const t of tables) {
    if (t.rowCount <= 0) continue;
    const time =
      [...t.timeDimensions].sort(
        (a, b) =>
          scoreTimeColumn(b.columnName, b.physicalType) -
          scoreTimeColumn(a.columnName, a.physicalType),
      )[0]?.columnName;
    const unitDimension = t.fields.find((field) => /^(currency|asset)$/i.test(field.columnName)
      && !/INT|DOUBLE|FLOAT|DECIMAL|NUMERIC/i.test(field.physicalType))?.columnName;
    const rankedCats = [...t.categoryDimensions]
      .sort(
        (a, b) =>
          scoreCategoryColumn(b.columnName, b.distinctCount, t.rowCount) -
          scoreCategoryColumn(a.columnName, a.distinctCount, t.rowCount),
      )
      .slice(0, 3)
      .map((c) => c.columnName);
    const cats = unitDimension ? [unitDimension, ...rankedCats.filter((name) => name !== unitDimension)].slice(0, 3) : rankedCats;
    const comparison = cats.find((c) => {
      const f = t.categoryDimensions.find((x) => x.columnName === c);
      return (f?.distinctCount ?? 99) <= 20;
    });

    // Volume metric always available when table has rows
    {
      metrics.push({
        id: `${t.tableName}__row_count`,
        name: `${t.tableName} 行数`,
        tableName: t.tableName,
        measureColumn: null,
        aggregation: 'count',
        measureExpr: 'COUNT(*)',
        timeDimension: time,
        categoryDimensions: cats,
        comparisonDimension: comparison,
        sql: `SELECT COUNT(*) AS metric_value FROM ${escapeIdent(t.tableName)};`,
        rationale: '表有真实数据行，COUNT(*) 可作为基础核心指标',
      });
    }

    const measures = [...t.measures].sort(
      (a, b) =>
        scoreMeasureColumn(b.columnName, b.physicalType) -
        scoreMeasureColumn(a.columnName, a.physicalType),
    );

    for (const m of measures.slice(0, 10)) {
      const aggs = m.suggestedAggs || ['sum', 'avg'];
      for (const agg of aggs.slice(0, 2)) {
        const expr = `${agg.toUpperCase()}(${escapeIdent(m.columnName)})`;
        const selectDims = [time, cats[0]].filter(Boolean) as string[];
        const selectList = [
          ...selectDims.map((d) => escapeIdent(d)),
          `CAST(${expr} AS DOUBLE) AS metric_value`,
        ].join(', ');
        const groupBy =
          selectDims.length > 0
            ? ` GROUP BY ${selectDims.map((d) => escapeIdent(d)).join(', ')}`
            : '';
        const order =
          time != null
            ? ` ORDER BY ${escapeIdent(time)}`
            : ` ORDER BY metric_value DESC`;
        metrics.push({
          id: `${t.tableName}__${agg}_${m.columnName}`,
          name: `${agg.toUpperCase()}(${m.columnName})${unitDimension ? ` · 按 ${unitDimension}` : ''}`,
          tableName: t.tableName,
          measureColumn: m.columnName,
          aggregation: agg,
          measureExpr: expr,
          timeDimension: time,
          categoryDimensions: cats,
          comparisonDimension: comparison,
          sql: `SELECT ${selectList} FROM ${escapeIdent(t.tableName)}${groupBy}${order} LIMIT 500;`,
          rationale: `列 ${m.columnName}（${m.physicalType}）被识别为度量，置信度 ${m.confidence}`,
        });
      }
    }
  }

  return metrics;
}

function buildWorkspaceGaps(catalog: Omit<AnalyticalCatalog, 'workspaceGaps' | 'overallReadinessScore'>): {
  gaps: string[];
  score: number;
} {
  const gaps: string[] = [];
  if (catalog.tableCount === 0) {
    return { gaps: ['工作区无数据表 — 请先导入或创建表'], score: 0 };
  }
  const withRows = catalog.tables.filter((t) => t.rowCount > 0);
  if (withRows.length === 0) {
    gaps.push('所有表均为空 — 需要真实数据行才能分析');
  }
  if (catalog.coreMetrics.filter((m) => m.measureColumn).length === 0) {
    gaps.push('缺少核心度量列（数值指标）— 仅有行数统计');
  }
  if (catalog.timeDimensions.length === 0) {
    gaps.push('缺少时间维度 — 无法做趋势/同比环比');
  }
  if (catalog.categoryDimensions.length === 0) {
    gaps.push('缺少分类维度 — 无法分组对比与联动筛选');
  }
  if (catalog.comparisonDimensions.length === 0) {
    gaps.push('缺少对比维度 — 低基数分类或时间序列不足');
  }
  if (catalog.drillPaths.length === 0) {
    gaps.push('缺少下钻路径 — 未检测到外键或表间同名关联键');
  }
  if (catalog.linkageFields.length === 0) {
    gaps.push('缺少联动字段 — 跨表/跨图共用维度不足');
  }

  const scores = catalog.tables.map((t) => t.readiness.score);
  const avg =
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  // Penalize workspace-level gaps
  const penalty = Math.min(40, gaps.length * 8);
  return { gaps, score: Math.max(0, avg - penalty) };
}

export async function buildAnalyticalCatalog(
  tableNames?: string[],
): Promise<AnalyticalCatalog> {
  let names = tableNames;
  if (!names || names.length === 0) {
    names = await duckDBService.getTables();
  }
  // Exclude stuff that looks like system
  names = names.filter((n) => !SYSTEM_SCHEMAS.has(n.split('.')[0]?.toLowerCase()));

  const tables: TableAnalyticalSummary[] = [];
  for (const name of names) {
    try {
      tables.push(await profileTable(name));
    } catch (e) {
      console.warn(`[analyticalCatalog] skip ${name}`, e);
    }
  }

  const fkLinks = await loadForeignKeys(names);
  const nameLinks = inferNameBasedLinks(tables);
  const allLinks = [...fkLinks, ...nameLinks];

  // Dedupe links
  const linkKey = (l: { fromTable: string; fromCol: string; toTable: string; toCol: string }) =>
    `${l.fromTable}.${l.fromCol}->${l.toTable}.${l.toCol}`;
  const seen = new Set<string>();
  const uniqueLinks = allLinks.filter((l) => {
    const k = linkKey(l);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const relationalDrillPaths: DrillPathRef[] = uniqueLinks.map((l, i) => ({
    provenance: fkLinks.some(fk => linkKey(fk) === linkKey(l)) ? 'foreign_key' : 'inferred',
    id: `drill-${i}-${l.fromTable}-${l.toTable}`,
    fromTable: l.fromTable,
    fromColumn: l.fromCol,
    toTable: l.toTable,
    toColumn: l.toCol,
    label: `${fkLinks.some(fk => linkKey(fk) === linkKey(l)) ? '外键' : '推断关联'} · ${l.fromTable}.${l.fromCol} → ${l.toTable}`,
    hierarchyType: 'relational',
    detailSqlTemplate: `SELECT * FROM ${escapeIdent(l.toTable)} WHERE ${escapeIdent(l.toCol)} = {{value}} LIMIT 200;`,
  }));

  const hierarchicalDrillPaths = inferHierarchicalDrillPaths(tables);
  const drillPaths: DrillPathRef[] = [...relationalDrillPaths, ...hierarchicalDrillPaths];

  // Rebuild readiness with drill/linkage context
  const colOwners = new Map<string, { tables: string[]; role: FieldRole }>();
  for (const t of tables) {
    for (const f of t.fields) {
      if (f.role === 'attribute' || f.role === 'measure') continue;
      const key = f.columnName.toLowerCase();
      const cur = colOwners.get(key) || { tables: [], role: f.role };
      if (!cur.tables.includes(t.tableName)) cur.tables.push(t.tableName);
      if (f.role === 'category' || f.role === 'time' || f.role === 'identifier') {
        cur.role = f.role;
      }
      colOwners.set(key, cur);
    }
  }

  const linkageFields: LinkageFieldRef[] = [];
  for (const [columnName, info] of colOwners) {
    const multi = info.tables.length >= 2;
    const inFk = uniqueLinks.some(
      (l) =>
        l.fromCol.toLowerCase() === columnName || l.toCol.toLowerCase() === columnName,
    );
    if (!multi && !inFk) continue;
    if (info.role === 'identifier' && !inFk && !multi) continue;
    const recommendedRole = inferLinkageRole(columnName, info.role);
    const filterOperator =
      recommendedRole === 'drill_bridge'
        ? '='
        : info.role === 'time'
          ? 'BETWEEN'
          : recommendedRole === 'primary_filter'
            ? 'IN'
            : 'LIKE';

    linkageFields.push({
      columnName,
      tables: info.tables,
      role: info.role,
      recommendedRole,
      filterOperator,
      usableAsParam: info.role === 'category' || info.role === 'time' || inFk || recommendedRole === 'drill_bridge',
    });
  }

  const tablesWithReadiness = tables.map((t) => {
    const base = {
      tableName: t.tableName,
      rowCount: t.rowCount,
      columnCount: t.columnCount,
      fields: t.fields,
      measures: t.measures,
      timeDimensions: t.timeDimensions,
      categoryDimensions: t.categoryDimensions,
      identifiers: t.identifiers,
    };
    return {
      ...base,
      readiness: readinessForTable(base, drillPaths, linkageFields),
    };
  });

  const timeDimensions: TimeDimensionRef[] = [];
  for (const t of tablesWithReadiness) {
    for (const f of t.timeDimensions) {
      timeDimensions.push({
        tableName: t.tableName,
        columnName: f.columnName,
        physicalType: f.physicalType,
        min: f.min,
        max: f.max,
        suggestedGrain: inferSuggestedGrain(f.columnName),
        score: scoreTimeColumn(f.columnName, f.physicalType),
      });
    }
  }
  timeDimensions.sort((a, b) => b.score - a.score);

  const categoryDimensions: CategoryDimensionRef[] = [];
  for (const t of tablesWithReadiness) {
    for (const f of t.categoryDimensions) {
      const score = scoreCategoryColumn(f.columnName, f.distinctCount, t.rowCount);
      categoryDimensions.push({
        tableName: t.tableName,
        columnName: f.columnName,
        distinctCount: f.distinctCount,
        sampleValues: f.sampleValues || [],
        linkable: (f.distinctCount ?? 0) >= 2 && (f.distinctCount ?? 999) <= 50,
        score,
      });
    }
  }
  categoryDimensions.sort((a, b) => b.score - a.score);

  const comparisonDimensions: ComparisonDimensionRef[] = [];
  for (const c of categoryDimensions) {
    const isLowDistinct = c.distinctCount != null && c.distinctCount >= 2 && c.distinctCount <= 20;
    const isKeyword = c.distinctCount == null && /status|channel|segment|tier|type|method|region|brand|price_tier|is_/i.test(c.columnName);
    if (isLowDistinct || isKeyword) {
      comparisonDimensions.push({
        tableName: c.tableName,
        columnName: c.columnName,
        kind: 'category_split',
        distinctCount: c.distinctCount,
        sampleValues: c.sampleValues,
        score: c.score + 10,
      });
    }
  }
  for (const t of timeDimensions.slice(0, 8)) {
    comparisonDimensions.push({
      tableName: t.tableName,
      columnName: t.columnName,
      kind: 'time_period',
      distinctCount: null,
      sampleValues: [],
      score: t.score,
    });
  }
  comparisonDimensions.sort((a, b) => b.score - a.score);

  const coreMetrics = buildCoreMetrics(tablesWithReadiness);

  const partial = {
    builtAt: Date.now(),
    tableCount: tablesWithReadiness.length,
    tables: tablesWithReadiness,
    coreMetrics,
    timeDimensions,
    categoryDimensions,
    comparisonDimensions,
    drillPaths,
    linkageFields,
  };

  const { gaps, score } = buildWorkspaceGaps(partial);

  return {
    ...partial,
    workspaceGaps: gaps,
    overallReadinessScore: score,
  };
}

/** Pure helpers exported for unit tests (no DuckDB). */
export const analyticalCatalogRules = {
  mapRole,
  scoreTimeColumn,
  scoreCategoryColumn,
  scoreMeasureColumn,
  classifySemanticType,
  buildCoreMetrics,
  readinessForTable,
  inferSuggestedGrain,
  inferLinkageRole,
  inferHierarchicalDrillPaths,
};
