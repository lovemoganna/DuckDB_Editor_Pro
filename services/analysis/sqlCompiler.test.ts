/**
 * SQL / calc compiler snapshot tests (no DuckDB required).
 */

import { describe, it, expect } from 'vitest';
import { compileAnalysisSql } from './sqlCompiler';
import { validateCalcExpression, rewriteExprWithColumns, aggSql } from './calcCompiler';
import { createEmptySpec, emptyFilters, type AnalysisSpec } from './types';
import { pivotConfigToSpec, timeSeriesConfigToSpec } from './adapters/workbenchAdapter';
import { parseAndNormalize } from './aiIntent';
import {
  applyBrush,
  applyDrill,
  applyGlobalFilter,
  applyLinkageEvent,
  buildCascadeValuesSpec,
  swapDynamicField,
} from './linkage';
import {
  mapResultToChartSpec,
  chartSpecToChartConfig,
  getChartType,
  listChartTypes,
  mapRecipeResultToChartSpec,
} from './chartRegistry';
import type { AnalysisFieldCatalog } from './types';

const VALID_AGGS = new Set(['sum', 'avg', 'count', 'count_distinct', 'min', 'max']);
function isValidAgg(agg: string): boolean {
  return VALID_AGGS.has(agg);
}

function baseSpec(over?: Partial<AnalysisSpec>): AnalysisSpec {
  return createEmptySpec({
    id: 'test',
    dataset: { table: 'orders' },
    dimensions: [{ id: 'd0', column: 'region', alias: 'region' }],
    metrics: [{ id: 'm0', column: 'amount', agg: 'sum', alias: '总金额' }],
    calcs: [],
    filters: emptyFilters(),
    sort: [{ by: '总金额', order: 'desc' }],
    topN: { n: 20, by: '总金额' },
    visual: { chartType: 'bar', title: '区域销售额' },
    ...over,
  });
}

describe('validateCalcExpression', () => {
  it('allows arithmetic and whitelisted funcs', () => {
    expect(validateCalcExpression('amount * 1.1').ok).toBe(true);
    expect(validateCalcExpression('ROUND(amount, 2)').ok).toBe(true);
    expect(validateCalcExpression("CASE WHEN x > 0 THEN 1 ELSE 0 END").ok).toBe(true);
  });

  it('rejects injection / subqueries', () => {
    expect(validateCalcExpression('amount; DROP TABLE t').ok).toBe(false);
    expect(validateCalcExpression('(SELECT 1)').ok).toBe(false);
    expect(validateCalcExpression('evil_func(x)').ok).toBe(false);
  });
});

describe('rewriteExprWithColumns', () => {
  it('quotes known columns', () => {
    const out = rewriteExprWithColumns('amount / qty', ['amount', 'qty']);
    expect(out).toContain('"amount"');
    expect(out).toContain('"qty"');
  });
});

describe('compileAnalysisSql', () => {
  it('emits CTE layers for simple pivot', () => {
    const { sql, dimAliases, metricAliases } = compileAnalysisSql(baseSpec());
    expect(sql).toContain('WITH');
    expect(sql).toContain('base AS');
    expect(sql).toContain('filtered AS');
    expect(sql).toContain('aggregated AS');
    expect(sql).toContain('FROM "orders"');
    expect(sql).toContain('SUM(CAST("amount" AS DOUBLE))');
    expect(sql).toContain('GROUP BY 1');
    expect(sql).toContain('LIMIT 20');
    expect(dimAliases).toEqual(['region']);
    expect(metricAliases).toEqual(['总金额']);
  });

  it('compiles dateTrunc dimensions', () => {
    const { sql } = compileAnalysisSql(
      baseSpec({
        dimensions: [
          { id: 't', column: 'order_date', dateTrunc: 'month', alias: 'order_date_month' },
        ],
      }),
    );
    expect(sql).toContain("DATE_TRUNC('month'");
    expect(sql).toContain('"order_date_month"');
  });

  it('compiles filters global + interactive', () => {
    const { sql } = compileAnalysisSql(
      baseSpec({
        filters: {
          global: [{ column: 'status', op: '=', value: 'paid' }],
          cascade: [],
          interactive: [{ column: 'region', op: 'in', value: ['East', 'West'] }],
        },
      }),
    );
    expect(sql).toContain("\"status\" = 'paid'");
    expect(sql).toContain("\"region\" IN ('East', 'West')");
  });

  it('compiles mom / cumulative / rank / ratio / moving calcs', () => {
    const { sql, calcAliases } = compileAnalysisSql(
      baseSpec({
        dimensions: [{ id:'date',column:'order_date',dateTrunc:'month',alias:'period' }],
        calcs: [
          { id: 'c1', kind: 'mom', alias: '环比%', sourceMetricId: '总金额' },
          { id: 'c2', kind: 'cumulative', alias: '累计', sourceMetricId: '总金额' },
          { id: 'c3', kind: 'rank', alias: '排名', sourceMetricId: '总金额', rankFn: 'dense_rank' },
          { id: 'c4', kind: 'ratio', alias: '占比', sourceMetricId: '总金额' },
          {
            id: 'c5',
            kind: 'moving',
            alias: 'MA7',
            sourceMetricId: '总金额',
            windowSize: 7,
            movingAgg: 'avg',
          },
        ],
        topN: undefined,
      }),
    );
    expect(sql).toContain('calcs AS');
    expect(sql).toContain("INTERVAL '1 month'");
    expect(sql).toContain('DENSE_RANK()');
    expect(sql).toContain('ROWS BETWEEN UNBOUNDED PRECEDING');
    expect(sql).toContain('ROWS BETWEEN 6 PRECEDING');
    expect(calcAliases).toContain('环比%');
    expect(calcAliases).toContain('占比');
  });

  it('compiles yoy with a calendar-year lookup', () => {
    const { sql } = compileAnalysisSql(
      baseSpec({
        dimensions: [
          { id: 't', column: 'order_date', dateTrunc: 'month', alias: 'order_date_month' },
        ],
        calcs: [{ id: 'y', kind: 'yoy', alias: '同比%', sourceMetricId: '总金额' }],
        topN: undefined,
      }),
    );
    expect(sql).toContain("INTERVAL '1 year'");
    expect(sql).toContain('FROM aggregated previous');
  });

  it('compiles lod_fixed CTE join', () => {
    const { sql } = compileAnalysisSql(
      baseSpec({
        calcs: [
          {
            id: 'lod1',
            kind: 'lod_fixed',
            alias: '区域总额',
            lodDimensions: ['region'],
            lodColumn: 'amount',
            lodAgg: 'sum',
          },
        ],
        topN: undefined,
      }),
    );
    expect(sql).toMatch(/lod_/);
    expect(sql).toContain('LEFT JOIN');
  });

  it('compiles lod_exclude window', () => {
    const { sql } = compileAnalysisSql(
      baseSpec({
        dimensions: [
          { id: 'd0', column: 'region', alias: 'region' },
          { id: 'd1', column: 'city', alias: 'city' },
        ],
        calcs: [
          {
            id: 'ex',
            kind: 'lod_exclude',
            alias: '去城市',
            sourceMetricId: '总金额',
            lodDimensions: ['city'],
          },
        ],
        topN: undefined,
      }),
    );
    expect(sql).toContain('PARTITION BY "region"');
  });
});

describe('workbench adapters', () => {
  it('pivotConfigToSpec maps config', () => {
    const spec = pivotConfigToSpec({
      tableName: 't',
      rowDimensions: [{ column: 'a' }],
      metrics: [{ column: 'b', agg: 'sum', alias: 'sb' }],
      filters: [{ column: 'c', op: '=', value: 'x' }],
      sortMetric: 'sb',
      sortOrder: 'asc',
      limit: 10,
    });
    expect(spec.dataset.table).toBe('t');
    expect(spec.dimensions[0].column).toBe('a');
    expect(spec.metrics[0].agg).toBe('sum');
    expect(spec.filters.global).toHaveLength(1);
    expect(spec.topN?.n).toBe(10);
    const { sql } = compileAnalysisSql(spec);
    expect(sql).toContain('FROM "t"');
  });

  it('timeSeriesConfigToSpec maps windowMode to calcs', () => {
    const spec = timeSeriesConfigToSpec({
      tableName: 't',
      timeColumn: 'dt',
      valueColumn: 'v',
      granularity: 'month',
      aggFunc: 'sum',
      windowMode: 'moving_avg',
    });
    expect(spec.calcs[0].kind).toBe('moving');
    expect(spec.visual.chartType).toBe('line');
  });
});

describe('linkage', () => {
  it('applyGlobalFilter / applyBrush / applyDrill', () => {
    let spec = baseSpec();
    spec = applyGlobalFilter(spec, { column: 'status', op: '=', value: 'ok' });
    expect(spec.filters.global).toHaveLength(1);
    spec = applyBrush(spec, 'region', ['East']);
    expect(spec.filters.interactive.some((f) => f.id === 'brush:region')).toBe(true);
    spec = {
      ...spec,
      drill: { path: ['region', 'city'], currentLevel: 0 },
    };
    spec = applyDrill(spec, 'East');
    expect(spec.drill?.currentLevel).toBe(1);
    expect(spec.filters.interactive.some((f) => String(f.id).startsWith('drill:'))).toBe(true);
  });

  it('swapDynamicField swaps dimension column', () => {
    const spec = swapDynamicField(baseSpec(), { kind: 'dimension', index: 0 }, 'city');
    expect(spec.dimensions[0].column).toBe('city');
    expect(spec.dimensions[0].dynamic).toBe(true);
  });
});

describe('aiIntent.parseAndNormalize', () => {
  it('normalizes intent JSON to Spec', () => {
    const spec = parseAndNormalize({
      table: 'orders',
      dimensions: [{ column: 'region' }],
      metrics: [{ column: 'amount', agg: 'sum', alias: '销售额' }],
      chartType: 'bar',
      title: '测试',
    });
    expect(spec.version).toBe(1);
    expect(spec.dataset.table).toBe('orders');
    expect(spec.metrics[0].alias).toBe('销售额');
  });

  it('parses fenced JSON and rejects bad agg', () => {
    expect(() =>
      parseAndNormalize('```json\n{"table":"t","dimensions":[{"column":"a"}],"metrics":[{"agg":"median"}]}\n```'),
    ).toThrow(/非法聚合/);
  });

  it('defaults metrics to count when empty', () => {
    const spec = parseAndNormalize({
      table: 't',
      dimensions: [{ column: 'x' }],
    });
    expect(spec.metrics[0].agg).toBe('count');
  });
});

describe('chartRegistry', () => {
  it('maps result to ChartSpec and ChartConfig', () => {
    const spec = baseSpec();
    const compiled = {
      roles: { region: 'dimension' as const, 总金额: 'metric' as const },
      dimAliases: ['region'],
      metricAliases: ['总金额'],
      calcAliases: [] as string[],
    };
    const chart = mapResultToChartSpec(
      [{ region: 'East', 总金额: 100 }],
      ['region', '总金额'],
      spec,
      compiled,
    );
    expect(chart.chartType).toBe('bar');
    expect(chart.xKey).toBe('region');
    expect(chart.yKeys).toContain('总金额');
    const cfg = chartSpecToChartConfig(chart);
    expect(cfg.type).toBe('bar');
    expect(getChartType('kpi').id).toBe('kpi');
  });

  it('listChartTypes returns registered set', () => {
    const ids = listChartTypes().map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining(['bar', 'line', 'area', 'doughnut', 'kpi', 'table']));
  });

  it('mapRecipeResultToChartSpec encodes recipe rows', () => {
    const chart = mapRecipeResultToChartSpec(
      [{ 区间范围: '0~10', 样本频次: 5 }],
      ['区间范围', '样本频次'],
      { recipeId: 'histogram', title: '分箱' },
    );
    expect(chart.xKey).toBe('区间范围');
    expect(chart.yKeys).toContain('样本频次');
    // Semantic type preserved; Chart Adapter maps histogram → Chart.js bar
    expect(chart.chartType).toBe('histogram');
    expect(chartSpecToChartConfig(chart).type).toBe('histogram');
  });
});

describe('aggregations', () => {
  it('emits all six agg SQL forms', () => {
    const cases: Array<{ agg: 'sum' | 'avg' | 'count' | 'count_distinct' | 'min' | 'max'; expect: RegExp }> = [
      { agg: 'sum', expect: /SUM\(CAST\("amount"/ },
      { agg: 'avg', expect: /AVG\(CAST\("amount"/ },
      { agg: 'count', expect: /COUNT\("amount"\)/ },
      { agg: 'count_distinct', expect: /COUNT\(DISTINCT "amount"\)/ },
      { agg: 'min', expect: /MIN\("amount"\)/ },
      { agg: 'max', expect: /MAX\("amount"\)/ },
    ];
    for (const c of cases) {
      expect(isValidAgg(c.agg)).toBe(true);
      const { sql } = compileAnalysisSql(
        baseSpec({
          metrics: [{ id: 'm0', column: 'amount', agg: c.agg, alias: 'v' }],
          sort: [{ by: 'v', order: 'desc' }],
          topN: undefined,
        }),
      );
      expect(sql).toMatch(c.expect);
    }
  });

  it('aggSql helpers cover count_distinct', () => {
    expect(aggSql('count_distinct', '"x"')).toContain('COUNT(DISTINCT');
  });
});

describe('calcId metric', () => {
  it('aggregates expr calc via metric.calcId', () => {
    const { sql, metricAliases } = compileAnalysisSql(
      baseSpec({
        calcs: [{ id: 'cx', kind: 'expr', alias: '净额', expression: 'amount * 0.9' }],
        metrics: [{ id: 'm0', agg: 'sum', alias: '净额合计', calcId: 'cx' }],
        sort: [{ by: '净额合计', order: 'desc' }],
        topN: undefined,
      }),
    );
    expect(metricAliases).toContain('净额合计');
    expect(sql).toMatch(/SUM\(CAST\(/);
    expect(sql).toContain('0.9');
  });
});

describe('cascade and topN othersBucket', () => {
  it('compiles cascade parent as equality filter', () => {
    const { sql } = compileAnalysisSql(
      baseSpec({
        filters: {
          global: [],
          cascade: [{ parentColumn: 'region', childColumn: 'city', parentValue: 'East' }],
          interactive: [],
        },
        topN: undefined,
      }),
    );
    expect(sql).toContain("\"region\" = 'East'");
  });

  it('buildCascadeValuesSpec prepares distinct child query', () => {
    const cascadeSpec = buildCascadeValuesSpec(baseSpec(), 'city');
    expect(cascadeSpec.dimensions[0].column).toBe('city');
    const { sql } = compileAnalysisSql(cascadeSpec);
    expect(sql).toContain('"city"');
    expect(sql).toContain('LIMIT 200');
  });

  it('compiles TopN othersBucket UNION', () => {
    const { sql } = compileAnalysisSql(
      baseSpec({
        topN: { n: 5, by: '总金额', othersBucket: true },
      }),
    );
    expect(sql).toContain('UNION ALL');
    expect(sql).toContain("'其他'");
    expect(sql).toContain('__rn');
  });
});

describe('applyLinkageEvent', () => {
  it('applies brush when listen includes field', () => {
    const spec = baseSpec({
      linkage: { listen: ['region'], emit: ['region'] },
    });
    const next = applyLinkageEvent(spec, { type: 'brush', field: 'region', values: ['East'] });
    expect(next.filters.interactive.some((f) => f.id === 'brush:region')).toBe(true);
  });

  it('ignores brush when listen excludes field', () => {
    const spec = baseSpec({
      linkage: { listen: ['city'], emit: ['region'] },
    });
    const next = applyLinkageEvent(spec, { type: 'brush', field: 'region', values: ['East'] });
    expect(next.filters.interactive).toHaveLength(0);
  });
});

describe('aiIntent strict catalog', () => {
  const catalog: AnalysisFieldCatalog = {
    table: 'orders',
    builtAt: 0,
    rowCount: 10,
    fields: [
      {
        column: 'region',
        physicalType: 'VARCHAR',
        role: 'category',
        semanticType: 'categorical',
        defaultAgg: 'count',
        suggestedAggs: ['count', 'count_distinct'],
        confidence: 80,
        nullRate: 0,
        distinctCount: 4,
      },
      {
        column: 'amount',
        physicalType: 'DOUBLE',
        role: 'measure',
        semanticType: 'numeric',
        defaultAgg: 'sum',
        suggestedAggs: ['sum', 'avg', 'min', 'max', 'count'],
        confidence: 90,
        nullRate: 0,
        distinctCount: 100,
      },
    ],
    dimensions: [],
    measures: [],
    timeFields: [],
  };
  catalog.dimensions = [catalog.fields[0]];
  catalog.measures = [catalog.fields[1]];

  it('rejects mismatched table in strict mode', () => {
    expect(() =>
      parseAndNormalize(
        { table: 'other', dimensions: [{ column: 'region' }], metrics: [{ column: 'amount', agg: 'sum' }] },
        catalog,
        { strict: true },
      ),
    ).toThrow(/不一致/);
  });

  it('accepts matching catalog table', () => {
    const spec = parseAndNormalize(
      {
        table: 'orders',
        dimensions: [{ column: 'region' }],
        metrics: [{ column: 'amount', agg: 'sum', alias: '销售额' }],
      },
      catalog,
      { strict: true },
    );
    expect(spec.dataset.table).toBe('orders');
    expect(spec.metrics[0].alias).toBe('销售额');
  });
});
describe('lod_include compile', () => {
  it('emits PARTITION BY with include dims', () => {
    const { sql } = compileAnalysisSql(
      baseSpec({
        calcs: [
          {
            id: 'inc',
            kind: 'lod_include',
            alias: '含城',
            sourceMetricId: '总金额',
            lodDimensions: [],
          },
        ],
        topN: undefined,
      }),
    );
    expect(sql).toContain('PARTITION BY "region"');
  });
});
