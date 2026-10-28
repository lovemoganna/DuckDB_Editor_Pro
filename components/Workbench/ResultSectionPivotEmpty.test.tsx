import { describe, expect, it } from 'vitest';
import { widgetRowsToChartSpec } from '../../services/analysis/adapters/dashboardWidgetAdapter';

describe('SQL Workbench ResultSection Pivot empty areas support', () => {
  const rows = [
    { category: '电子', region: '华东', sales: 100 },
    { category: '电子', region: '华北', sales: 200 },
    { category: '日用', region: '华东', sales: 300 },
  ];

  it('renders pivot matrix with empty row dimension (collapses to 全部)', () => {
    const effectiveRow = '汇总范围';
    const effectiveVal = 'sales';
    const effectiveCol = 'region';
    const prepared = rows.map(r => ({ ...r, [effectiveRow]: '全部' }));

    const spec = widgetRowsToChartSpec(prepared, {
      id: 'pivot-empty-row', title: '透视表', type: 'pivot',
      xKey: effectiveRow, yKeys: [effectiveVal], rowKey: effectiveRow, colKey: effectiveCol, valKey: effectiveVal,
      aggFunc: 'sum', unit: '', format: { compact: false, thousandSeparator: true, decimals: 2 }
    });

    expect(spec.pivotTable).toBeDefined();
    expect(spec.pivotTable?.rowValues).toEqual(['全部']);
    expect(spec.pivotTable?.colValues).toContain('华东');
    expect(spec.pivotTable?.colValues).toContain('华北');
    expect(spec.pivotTable?.matrix['全部']['华东']).toBe(400);
    expect(spec.pivotTable?.matrix['全部']['华北']).toBe(200);
    expect(spec.pivotTable?.grandTotal).toBe(600);
  });

  it('renders pivot matrix with empty col dimension (single column summary)', () => {
    const effectiveRow = 'category';
    const effectiveVal = 'sales';
    const effectiveCol = '';
    const prepared = rows;

    const spec = widgetRowsToChartSpec(prepared, {
      id: 'pivot-empty-col', title: '透视表', type: 'pivot',
      xKey: effectiveRow, yKeys: [effectiveVal], rowKey: effectiveRow, colKey: effectiveCol, valKey: effectiveVal,
      aggFunc: 'sum', unit: '', format: { compact: false, thousandSeparator: true, decimals: 2 }
    });

    expect(spec.pivotTable).toBeDefined();
    expect(spec.pivotTable?.rowValues).toEqual(['电子', '日用']);
    expect(spec.pivotTable?.colValues).toEqual(['汇总']);
    expect(spec.pivotTable?.matrix['电子']['汇总']).toBe(300);
    expect(spec.pivotTable?.matrix['日用']['汇总']).toBe(300);
  });

  it('renders pivot matrix with empty value dimension (counts records)', () => {
    const effectiveRow = 'category';
    const effectiveVal = '记录数';
    const effectiveCol = 'region';
    const prepared = rows.map(r => ({ ...r, [effectiveVal]: 1 }));

    const spec = widgetRowsToChartSpec(prepared, {
      id: 'pivot-empty-val', title: '透视表', type: 'pivot',
      xKey: effectiveRow, yKeys: [effectiveVal], rowKey: effectiveRow, colKey: effectiveCol, valKey: effectiveVal,
      aggFunc: 'count', unit: '个', format: { compact: false, thousandSeparator: true, decimals: 0 }
    });

    expect(spec.pivotTable).toBeDefined();
    expect(spec.pivotTable?.matrix['电子']['华东']).toBe(1);
    expect(spec.pivotTable?.matrix['电子']['华北']).toBe(1);
    expect(spec.pivotTable?.matrix['日用']['华东']).toBe(1);
    expect(spec.pivotTable?.grandTotal).toBe(3);
  });

  it('renders 1x1 summary cell when row, col, and value are all empty', () => {
    const effectiveRow = '汇总范围';
    const effectiveVal = '记录数';
    const effectiveCol = '';
    const prepared = rows.map(r => ({ ...r, [effectiveRow]: '全部', [effectiveVal]: 1 }));

    const spec = widgetRowsToChartSpec(prepared, {
      id: 'pivot-all-empty', title: '透视表', type: 'pivot',
      xKey: effectiveRow, yKeys: [effectiveVal], rowKey: effectiveRow, colKey: effectiveCol, valKey: effectiveVal,
      aggFunc: 'count', unit: '个', format: { compact: false, thousandSeparator: true, decimals: 0 }
    });

    expect(spec.pivotTable).toBeDefined();
    expect(spec.pivotTable?.rowValues).toEqual(['全部']);
    expect(spec.pivotTable?.colValues).toEqual(['汇总']);
    expect(spec.pivotTable?.matrix['全部']['汇总']).toBe(3);
    expect(spec.pivotTable?.grandTotal).toBe(3);
  });

  it('supports count_distinct aggregation in pivot computation', () => {
    const rawData = [
      { category: '电子', user: 'u1' },
      { category: '电子', user: 'u1' }, // duplicate user
      { category: '电子', user: 'u2' },
      { category: '日用', user: 'u3' },
    ];
    const spec = widgetRowsToChartSpec(rawData, {
      id: 'pivot-distinct', title: '透视表', type: 'pivot',
      xKey: 'category', yKeys: ['user'], rowKey: 'category', colKey: '', valKey: 'user',
      aggFunc: 'count_distinct', unit: '个', format: { compact: false, thousandSeparator: true, decimals: 0 }
    });

    expect(spec.pivotTable).toBeDefined();
    expect(spec.pivotTable?.matrix['电子']['汇总']).toBe(2); // u1, u2
    expect(spec.pivotTable?.matrix['日用']['汇总']).toBe(1); // u3
    expect(spec.pivotTable?.grandTotal).toBe(3);
  });

  it('supports median aggregation in pivot computation', () => {
    const rawData = [
      { category: '电子', score: 10 },
      { category: '电子', score: 20 },
      { category: '电子', score: 90 }, // median of [10, 20, 90] is 20
      { category: '日用', score: 50 },
      { category: '日用', score: 70 }, // median of [50, 70] is 60
    ];
    const spec = widgetRowsToChartSpec(rawData, {
      id: 'pivot-median', title: '透视表', type: 'pivot',
      xKey: 'category', yKeys: ['score'], rowKey: 'category', colKey: '', valKey: 'score',
      aggFunc: 'median', unit: '', format: { compact: false, thousandSeparator: true, decimals: 2 }
    });

    expect(spec.pivotTable).toBeDefined();
    expect(spec.pivotTable?.matrix['电子']['汇总']).toBe(20);
    expect(spec.pivotTable?.matrix['日用']['汇总']).toBe(60);
  });
});
