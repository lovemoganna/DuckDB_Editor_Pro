// @vitest-environment jsdom

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalysisHubPanel } from './AnalysisHubPanel';
import { AnalysisProfiler } from './AnalysisProfiler';
import { AnalysisPivotWorkbench } from './AnalysisPivotWorkbench';
import { AnalysisTimeSeries } from './AnalysisTimeSeries';
import { AnalysisRecipeCenter } from './AnalysisRecipeCenter';
import { analysisEngine } from './analysisEngine';
import { useAppStore } from '../../hooks/store/useAppStore';
import type { ColumnInfo } from '../../types';

// Mock duckdbService
const mockReadQuery = vi.fn();
const mockQuery = vi.fn();
const mockGetTables = vi.fn();
const mockGetTableSchema = vi.fn();

vi.mock('../../services/duckdbService', () => ({
  duckDBService: {
    readQuery: (...args: any[]) => mockReadQuery(...args),
    query: (...args: any[]) => mockQuery(...args),
    getTables: (...args: any[]) => mockGetTables(...args),
    getTableSchema: (...args: any[]) => mockGetTableSchema(...args),
  },
}));

vi.mock('../../services/toastService', () => ({
  toastService: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('../Workbench/seedWorkbenchData', () => ({
  seedDemoWorkbenchData: vi.fn().mockResolvedValue(undefined),
}));

// Mock react-chartjs-2 to avoid canvas issues in jsdom
vi.mock('react-chartjs-2', () => ({
  Bar: () => <div data-testid="mock-bar-chart">Bar Chart</div>,
  Line: () => <div data-testid="mock-line-chart">Line Chart</div>,
  Doughnut: () => <div data-testid="mock-doughnut-chart">Doughnut Chart</div>,
  Pie: () => <div data-testid="mock-pie-chart">Pie Chart</div>,
}));

describe('AnalysisEngine (Unit Tests)', () => {
  const sampleSchema: ColumnInfo[] = [
    { name: 'order_id', type: 'BIGINT', notnull: true, dflt_value: null, pk: true },
    { name: 'customer_id', type: 'BIGINT', notnull: true, dflt_value: null, pk: false },
    { name: 'order_date', type: 'DATE', notnull: true, dflt_value: null, pk: false },
    { name: 'category', type: 'VARCHAR', notnull: false, dflt_value: null, pk: false },
    { name: 'amount', type: 'DOUBLE', notnull: true, dflt_value: null, pk: false },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('buildPivotSql generates standard DuckDB aggregation query', () => {
    const sql = analysisEngine.buildPivotSql({
      tableName: 'orders',
      rowDimensions: [{ column: 'category' }],
      metrics: [
        { column: 'amount', agg: 'sum', alias: '总销售额' },
        { column: undefined, agg: 'count', alias: '订单总数' },
      ],
      filters: [{ column: 'amount', op: '>', value: '50' }],
      limit: 10,
    });

    expect(sql).toContain('SELECT');
    expect(sql).toContain('"category" AS "category"');
    expect(sql).toContain('ROUND(COALESCE(SUM(CAST("amount" AS DOUBLE)), 0), 2) AS "总销售额"');
    expect(sql).toContain('COUNT(*) AS "订单总数"');
    expect(sql).toContain('FROM "orders"');
    expect(sql).toContain('WHERE "amount" > 50');
    expect(sql).toContain('GROUP BY 1');
    expect(sql).toContain('LIMIT 10');
  });

  it('buildTimeSeriesSql supports daily, monthly, and window LAG calculation', () => {
    const rawSql = analysisEngine.buildTimeSeriesSql({
      tableName: 'orders',
      timeColumn: 'order_date',
      granularity: 'month',
      valueColumn: 'amount',
      aggFunc: 'sum',
      windowMode: 'raw',
    });
    expect(rawSql).toContain("DATE_TRUNC('month', CAST(\"order_date\" AS DATE))");
    expect(rawSql).toContain('ROUND(SUM(CAST("amount" AS DOUBLE)), 2) AS base_value');

    const momSql = analysisEngine.buildTimeSeriesSql({
      tableName: 'orders',
      timeColumn: 'order_date',
      granularity: 'month',
      valueColumn: 'amount',
      aggFunc: 'sum',
      windowMode: 'mom',
    });
    expect(momSql).toContain('LAG(base_value, 1) OVER (ORDER BY period)');
    expect(momSql).toContain('环比增长率_百分比');

    const maSql = analysisEngine.buildTimeSeriesSql({
      tableName: 'orders',
      timeColumn: 'order_date',
      granularity: 'day',
      valueColumn: 'amount',
      aggFunc: 'avg',
      windowMode: 'moving_avg',
    });
    expect(maSql).toContain('ROWS BETWEEN 6 PRECEDING AND CURRENT ROW');
    expect(maSql).toContain('7周期平滑均线');
  });
});

describe('AnalysisProfiler Component', () => {
  const sampleSchema: ColumnInfo[] = [
    { name: 'user_id', type: 'BIGINT', notnull: true, dflt_value: null, pk: true },
    { name: 'score', type: 'DOUBLE', notnull: true, dflt_value: null, pk: false },
    { name: 'created_at', type: 'TIMESTAMP', notnull: true, dflt_value: null, pk: false },
    { name: 'country', type: 'VARCHAR', notnull: false, dflt_value: null, pk: false },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockReadQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('COUNT(*) AS total_rows')) {
        return [{ total_rows: 1000 }];
      }
      if (sql.includes('_nulls')) {
        return [{ user_id_nulls: 0, score_nulls: 0, created_at_nulls: 0, country_nulls: 50 }];
      }
      if (sql.includes('MEDIAN')) {
        return [{ non_null_count: 1000, distinct_count: 850, min_val: 10, max_val: 99, avg_val: 55.4, median_val: 54 }];
      }
      if (sql.includes('val,') && sql.includes('GROUP BY 1')) {
        return [
          { val: 'CN', cnt: 400 },
          { val: 'US', cnt: 300 },
          { val: 'JP', cnt: 150 },
        ];
      }
      return [{ non_null_count: 950, distinct_count: 50, min_val: 'A', max_val: 'Z' }];
    });
  });

  it('renders table overview scorecard and column items', async () => {
    const onPivot = vi.fn();
    const onTimeSeries = vi.fn();

    render(
      <AnalysisProfiler
        currentTable="users"
        schema={sampleSchema}
        onNavigateToPivot={onPivot}
        onNavigateToTimeSeries={onTimeSeries}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('总记录行数')).toBeInTheDocument();
      expect(screen.getByText('1,000')).toBeInTheDocument();
    });

    expect(screen.getByText('全表健康度评分')).toBeInTheDocument();
    expect(screen.getByText('user_id')).toBeInTheDocument();
    expect(screen.getByText('score')).toBeInTheDocument();
  });
});

describe('AnalysisHubPanel Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      tables: ['orders', 'customers'],
      currentTable: 'orders',
    });
    mockGetTableSchema.mockResolvedValue([
      { name: 'order_id', type: 'BIGINT', notnull: true, dflt_value: null, pk: true },
      { name: 'revenue', type: 'DOUBLE', notnull: true, dflt_value: null, pk: false },
    ]);
    mockReadQuery.mockResolvedValue([{ total_rows: 500 }]);
  });

  it('renders analysis hub header and switches subviews', async () => {
    render(
      <AnalysisHubPanel />
    );

    expect(screen.getByText(/分析中心 \(Analysis Hub\)/)).toBeInTheDocument();
    expect(screen.getByText('数据体检')).toBeInTheDocument();
    expect(screen.getByText('透视聚合')).toBeInTheDocument();
    expect(screen.getByText('时序分析')).toBeInTheDocument();
    expect(screen.getByText('场景配方')).toBeInTheDocument();

    // Click "透视聚合"
    fireEvent.click(screen.getByText('透视聚合'));
    await waitFor(() => {
      expect(screen.getByText('多维透视与切片聚合')).toBeInTheDocument();
    });

    // Click "时序分析"
    fireEvent.click(screen.getByText('时序分析'));
    await waitFor(() => {
      expect(screen.getByText('时序走势与波动分析')).toBeInTheDocument();
    });

    // Click "场景配方"
    fireEvent.click(screen.getByText('场景配方'));
    await waitFor(() => {
      expect(screen.getByText('业务分析场景配方库')).toBeInTheDocument();
    });
  });

  it('renders zero-state empty view when tables is empty with 1-click demo button', async () => {
    useAppStore.setState({
      tables: [],
      currentTable: null,
    });

    render(
      <AnalysisHubPanel />
    );

    expect(screen.getByText('当前 DuckDB 数据库中暂无数据表')).toBeInTheDocument();
    expect(screen.getByText('1秒载入全真电商分析数据集')).toBeInTheDocument();
  });
});
