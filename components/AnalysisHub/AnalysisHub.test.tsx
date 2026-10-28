// @vitest-environment jsdom

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalysisHubPanel } from './AnalysisHubPanel';
import { AnalysisProfiler } from './AnalysisProfiler';
import { useAppStore } from '../../hooks/store/useAppStore';
import type { ColumnInfo } from '../../types';
import {
  compileAnalysis,
  pivotConfigToSpec,
  timeSeriesConfigToSpec,
} from '../../services/analysis';

const mockReadQuery = vi.fn();
const mockQuery = vi.fn();
const mockGetTables = vi.fn();
const mockGetTableSchema = vi.fn();

vi.mock('../../services/duckdbService', () => ({
  duckDBService: {
    getCurrentCatalogAndSchema: vi.fn().mockResolvedValue({catalog:'memory',schema:'main'}),
    readQuery: (...args: any[]) => mockReadQuery(...args),
    query: (...args: any[]) => mockQuery(...args),
    getTables: (...args: any[]) => mockGetTables(...args),
    getTableSchema: (...args: any[]) => mockGetTableSchema(...args),
    listAnalysisContexts: vi.fn().mockResolvedValue([
      { id: 'main', label: 'Schema · main', kind: 'schema', isCurrent: true },
    ]),
    switchAnalysisContext: vi.fn().mockResolvedValue({ catalog: 'memory', schema: 'main' }),
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

vi.mock('react-chartjs-2', () => ({
  Bar: () => <div data-testid="mock-bar-chart">Bar Chart</div>,
  Line: () => <div data-testid="mock-line-chart">Line Chart</div>,
  Doughnut: () => <div data-testid="mock-doughnut-chart">Doughnut Chart</div>,
  Pie: () => <div data-testid="mock-pie-chart">Pie Chart</div>,
}));

describe('Analysis Kernel (via Hub adapters)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pivotConfigToSpec → compileAnalysis generates aggregation SQL', () => {
    const spec = pivotConfigToSpec({
      tableName: 'orders',
      rowDimensions: [{ column: 'category' }],
      metrics: [
        { column: 'amount', agg: 'sum', alias: '总销售额' },
        { column: undefined, agg: 'count', alias: '订单总数' },
      ],
      filters: [{ column: 'amount', op: '>', value: '50' }],
      limit: 10,
    });
    const { sql } = compileAnalysis(spec);

    expect(sql).toContain('SELECT');
    expect(sql).toContain('FROM "orders"');
    expect(sql).toContain('SUM(CAST("amount" AS DOUBLE))');
    expect(sql).toContain('COUNT(*)');
    expect(sql).toContain('"amount" > 50');
    expect(sql).toContain('GROUP BY 1');
    expect(sql).toContain('LIMIT 10');
  });

  it('timeSeriesConfigToSpec maps window modes to kernel calcs', () => {
    const raw = compileAnalysis(
      timeSeriesConfigToSpec({
        tableName: 'orders',
        timeColumn: 'order_date',
        granularity: 'month',
        valueColumn: 'amount',
        aggFunc: 'sum',
        windowMode: 'raw',
      }),
    ).sql;
    expect(raw).toContain("DATE_TRUNC('month'");
    expect(raw).toContain('FROM "orders"');

    const mom = compileAnalysis(
      timeSeriesConfigToSpec({
        tableName: 'orders',
        timeColumn: 'order_date',
        granularity: 'month',
        valueColumn: 'amount',
        aggFunc: 'sum',
        windowMode: 'mom',
      }),
    ).sql;
    expect(mom).toContain("INTERVAL '1 month'");
    expect(mom).toContain('环比%');

    const ma = compileAnalysis(
      timeSeriesConfigToSpec({
        tableName: 'orders',
        timeColumn: 'order_date',
        granularity: 'day',
        valueColumn: 'amount',
        aggFunc: 'avg',
        windowMode: 'moving_avg',
      }),
    ).sql;
    expect(ma).toContain('ROWS BETWEEN 6 PRECEDING AND CURRENT ROW');
    expect(ma).toContain('移动平均');
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
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('总记录行数')).toBeInTheDocument();
      expect(screen.getByText('1,000')).toBeInTheDocument();
    });

    expect(screen.queryByText('健康度评分')).not.toBeInTheDocument();
    expect(screen.getByText('数据完备率')).toBeInTheDocument();
    expect(screen.getAllByText('user_id').length).toBeGreaterThan(0);
    expect(screen.getAllByText('score').length).toBeGreaterThan(0);
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
    render(<AnalysisHubPanel />);

    expect(screen.getByText('分析中心')).toBeInTheDocument();
    expect(screen.getByText('数据体检')).toBeInTheDocument();
    expect(screen.getByRole('tab', {name:'透视表'})).toBeInTheDocument();
    expect(screen.getByText('时序分析')).toBeInTheDocument();
    expect(screen.getByText('场景配方')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', {name:'透视表'}));
    await waitFor(() => {
      expect(screen.getByRole('tab', {name:'透视表'})).toHaveAttribute('aria-selected','true');
    });

    fireEvent.click(screen.getByText('时序分析'));
    await waitFor(() => {
      expect(screen.getByText('时序走势与波动分析')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('场景配方'));
    await waitFor(() => {
      expect(screen.getByText('业务分析场景配方')).toBeInTheDocument();
    });
  });

  it('opens real-data import from an empty workspace without offering fabricated data', async () => {
    useAppStore.setState({
      tables: [],
      currentTable: null,
    });

    render(<AnalysisHubPanel />);

    expect(screen.getByText('暂无数据表可分析')).toBeInTheDocument();
    expect(screen.queryByText('载入示例数据集')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '导入 CSV / Parquet' }));
    expect(useAppStore.getState().showImportModal).toBe(true);
  });
});
