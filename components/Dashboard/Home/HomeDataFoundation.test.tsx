import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HomeDataFoundation } from './HomeDataFoundation';
import type { AnalyticalCatalog } from '../../../types/analyticalCatalog';
import { Tab } from '../../../types';

const mockCatalog: AnalyticalCatalog = {
  builtAt: Date.now(),
  tableCount: 2,
  overallReadinessScore: 92,
  workspaceGaps: [],
  tables: [
    {
      tableName: 'orders',
      rowCount: 2000,
      columnCount: 6,
      fields: [],
      measures: [],
      timeDimensions: [],
      categoryDimensions: [],
      identifiers: [],
      readiness: {
        hasMeasure: true,
        hasTime: true,
        hasCategory: true,
        hasComparison: true,
        hasDrillTarget: true,
        hasLinkageKey: true,
        score: 95,
        missing: [],
      },
    },
  ],
  coreMetrics: [
    {
      id: 'orders__sum_profit',
      name: 'SUM(profit)',
      tableName: 'orders',
      measureColumn: 'profit',
      aggregation: 'sum',
      measureExpr: 'SUM("profit")',
      timeDimension: 'order_date',
      categoryDimensions: ['region', 'channel'],
      sql: 'SELECT SUM("profit") AS metric_value FROM "orders";',
      rationale: '真实表 orders 数值度量列 profit',
    },
  ],
  timeDimensions: [
    {
      tableName: 'orders',
      columnName: 'order_date',
      physicalType: 'DATE',
      suggestedGrain: 'day',
      score: 90,
      min: '2023-01-01',
      max: '2024-12-31',
    },
  ],
  categoryDimensions: [
    {
      tableName: 'orders',
      columnName: 'region',
      distinctCount: 4,
      sampleValues: ['North America', 'Europe', 'Asia Pacific', 'South America'],
      linkable: true,
      score: 85,
    },
  ],
  comparisonDimensions: [
    {
      tableName: 'orders',
      columnName: 'channel',
      kind: 'category_split',
      distinctCount: 5,
      sampleValues: ['Online', 'Store'],
      score: 80,
    },
  ],
  drillPaths: [
    {
      id: 'drill-hier-geographic-region-country',
      fromTable: 'orders',
      fromColumn: 'region',
      toTable: 'customers',
      toColumn: 'country',
      label: 'region → country',
      hierarchyType: 'geographic',
      detailSqlTemplate: 'SELECT "country", COUNT(*) FROM "customers" WHERE "region" = {{value}} GROUP BY 1;',
    },
  ],
  linkageFields: [
    {
      columnName: 'region',
      tables: ['orders', 'customers'],
      role: 'category',
      recommendedRole: 'primary_filter',
      filterOperator: 'IN',
      usableAsParam: true,
    },
  ],
};

describe('HomeDataFoundation Component', () => {
  it('renders all 6 data readiness pillars', () => {
    const onNavigate = vi.fn();
    render(
      <HomeDataFoundation
        catalog={mockCatalog}
        onNavigate={onNavigate}
      />
    );

    expect(screen.getByText('数据基础与完备度')).toBeDefined();
    expect(screen.getByText('核心指标')).toBeDefined();
    expect(screen.getByText('时间维度')).toBeDefined();
    expect(screen.getByText('分类维度')).toBeDefined();
    expect(screen.getByText('对比维度')).toBeDefined();
    expect(screen.getByText('可下钻明细')).toBeDefined();
    expect(screen.getByText('图表联动字段')).toBeDefined();
  });

  it('switches tabs and displays active pillar details', () => {
    const onNavigate = vi.fn();
    render(
      <HomeDataFoundation
        catalog={mockCatalog}
        onNavigate={onNavigate}
      />
    );

    // Click on "时间维度"
    const timeBtn = screen.getByText('时间维度').closest('button');
    if (timeBtn) fireEvent.click(timeBtn);
    expect(screen.getByText('时间维度明细（时间序列与聚合颗粒度）')).toBeDefined();
    expect(screen.getByText('order_date')).toBeDefined();

    // Click on "可下钻明细"
    const drillBtn = screen.getByText('可下钻明细').closest('button');
    if (drillBtn) fireEvent.click(drillBtn);
    expect(screen.getByText('可下钻明细路径（跨层级与外键穿透）')).toBeDefined();
    expect(screen.getByText('region → country')).toBeDefined();

    // Click on "图表联动字段"
    const linkBtn = screen.getByText('图表联动字段').closest('button');
    if (linkBtn) fireEvent.click(linkBtn);
    expect(screen.getByText('图表联动所需字段（跨组件筛选与参数交互）')).toBeDefined();
  });

  it('triggers SQL analysis callback when clicking action button', () => {
    const onNavigate = vi.fn();
    const onSelectQuery = vi.fn();
    render(
      <HomeDataFoundation
        catalog={mockCatalog}
        onNavigate={onNavigate}
        onSelectQuery={onSelectQuery}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '展开详情' }));
    const analyzeBtn = screen.getByText('分析指标');
    fireEvent.click(analyzeBtn);

    expect(onSelectQuery).toHaveBeenCalledWith(
      expect.stringContaining('SELECT SUM("profit")'),
      true
    );
    expect(onNavigate).toHaveBeenCalledWith(Tab.SQL);
  });
});
