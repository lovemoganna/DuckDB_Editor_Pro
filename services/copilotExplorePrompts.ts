/**
 * Generate exploratory question chips for Copilot, based on selected tables + schema.
 * Prefers a short AI JSON response; falls back to schema-aware local heuristics.
 */

import { duckDBService } from './duckdbService';
import { aiService } from './aiService';

export interface TableSchemaSnapshot {
  table: string;
  columns: Array<{ name: string; type: string }>;
}

function isNumericType(type: string): boolean {
  return /int|decimal|numeric|double|float|real|hugeint|bigint/i.test(type);
}

function isTemporalType(type: string): boolean {
  return /date|time|timestamp/i.test(type);
}

function isTextType(type: string): boolean {
  return /varchar|char|text|string|uuid/i.test(type);
}

export async function loadSelectedTableSchemas(tableNames: string[]): Promise<TableSchemaSnapshot[]> {
  const unique = Array.from(new Set(tableNames.filter(Boolean)));
  const settled = await Promise.allSettled(
    unique.map(async (table) => {
      const cols = await duckDBService.getTableSchema(table);
      return {
        table,
        columns: (cols || []).map((c: any) => ({
          name: String(c.name ?? c.column_name ?? ''),
          type: String(c.type ?? c.column_type ?? 'UNKNOWN'),
        })).filter((c) => c.name),
      } satisfies TableSchemaSnapshot;
    }),
  );

  return settled.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
}

/** Local, schema-aware fallback — never returns the old hard-coded template strings. */
export function buildLocalExplorePrompts(schemas: TableSchemaSnapshot[]): string[] {
  if (schemas.length === 0) {
    return [
      '列出当前数据库中所有表，并概述各自用途',
      '给出一份适合 DuckDB 的数据质量体检清单',
      '推荐 3 条适合本地分析的开箱 SQL',
    ];
  }

  const prompts: string[] = [];
  const tableList = schemas.map((s) => s.table).join('、');

  if (schemas.length === 1) {
    const { table, columns } = schemas[0];
    const numeric = columns.filter((c) => isNumericType(c.type));
    const temporal = columns.filter((c) => isTemporalType(c.type));
    const textish = columns.filter((c) => isTextType(c.type) && !/id$/i.test(c.name));
    const colPreview = columns.slice(0, 8).map((c) => `${c.name}(${c.type})`).join(', ');

    prompts.push(`基于表 ${table} 的字段 [${colPreview}]，给出数据画像与值得优先探查的 3 个问题`);
    prompts.push(`检查 ${table} 各字段的空值比例、重复键与明显异常值`);

    if (numeric.length > 0) {
      const n = numeric.slice(0, 3).map((c) => c.name).join(', ');
      prompts.push(`对 ${table} 的数值列 (${n}) 做分布、分位数与极值分析，并给 DuckDB SQL`);
    }
    if (temporal.length > 0) {
      const t = temporal[0].name;
      prompts.push(`按 ${table}.${t} 做时间趋势汇总，指出高峰/低谷时段`);
    }
    if (textish.length > 0) {
      const cat = textish[0].name;
      prompts.push(`统计 ${table}.${cat} 的类别分布 TopN，并解释业务含义`);
    }
  } else {
    prompts.push(`对比表 ${tableList} 的字段重叠与可关联键，给出推荐 JOIN 路径`);
    prompts.push(`为 ${tableList} 设计 3 条跨表探查 SQL（含粒度对齐说明）`);
    prompts.push(`评估 ${tableList} 一起分析时的数据质量风险（空值、孤儿键、重复）`);

    const withNumeric = schemas.filter((s) => s.columns.some((c) => isNumericType(c.type)));
    if (withNumeric.length > 0) {
      const focus = withNumeric[0];
      const numCols = focus.columns.filter((c) => isNumericType(c.type)).slice(0, 2).map((c) => c.name).join(', ');
      prompts.push(`以 ${focus.table}(${numCols}) 为主度量，结合其余表做多维拆解`);
    }
  }

  // De-dupe & cap
  return Array.from(new Set(prompts)).slice(0, 5);
}

function parsePromptList(raw: string): string[] {
  const trimmed = raw.trim();
  // Prefer fenced JSON
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : trimmed;

  try {
    const parsed = JSON.parse(candidate);
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.prompts)
        ? parsed.prompts
        : Array.isArray(parsed?.questions)
          ? parsed.questions
          : null;
    if (list) {
      return list
        .map((item: unknown) => (typeof item === 'string' ? item : (item as any)?.text ?? (item as any)?.question ?? ''))
        .map((s: string) => String(s).trim())
        .filter((s: string) => s.length >= 6)
        .slice(0, 5);
    }
  } catch {
    // fall through to line parsing
  }

  return candidate
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*\d.、)]+\s*/, '').replace(/^["']|["']$/g, '').trim())
    .filter((line) => line.length >= 6 && !line.startsWith('{') && !line.startsWith('['))
    .slice(0, 5);
}

/**
 * Generate 3–5 exploratory prompts for the selected tables.
 * Uses AI when configured; otherwise (or on failure) uses local schema heuristics.
 */
export async function generateExplorePrompts(tableNames: string[]): Promise<string[]> {
  const schemas = await loadSelectedTableSchemas(tableNames);
  const local = buildLocalExplorePrompts(schemas);

  if (!aiService.isConfigured()) {
    return local;
  }

  const schemaText = schemas.length > 0
    ? schemas
      .map((s) => `Table ${s.table}: [${s.columns.map((c) => `${c.name} (${c.type})`).join(', ')}]`)
      .join('\n')
    : '（用户未选定具体表，可围绕整个数据库提问）';

  const focus = tableNames.length > 0 ? tableNames.join(', ') : '全部表';
  const userMessage = `你是 DuckDB 数据分析助手。请根据下列 Schema，为用户生成 4 条「可直接点击提问」的短探索问题。

【关注表】${focus}
【Schema】
${schemaText}

要求：
1. 必须紧扣真实字段名与表名，不要写空泛套话
2. 每条 15–40 个汉字为宜，可执行、可验证
3. 覆盖：画像/质量、分布或趋势、聚合洞察${tableNames.length > 1 ? '、跨表关联' : ''}
4. 只输出 JSON 数组字符串，例如 ["问题1","问题2","问题3","问题4"]，不要其它说明`;

  try {
    const raw = await aiService.sendChatMessage(
      userMessage,
      '你只输出合法 JSON 数组。不要 Markdown 解释。语言为简体中文。',
    );
    const parsed = parsePromptList(raw);
    if (parsed.length >= 2) return parsed;
  } catch {
    // fall back
  }

  return local;
}
