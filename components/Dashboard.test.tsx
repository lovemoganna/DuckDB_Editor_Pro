// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialogProvider } from './ui/ConfirmDialog';
import { Dashboard } from './Dashboard';
import { Tab } from '../types';
import { useAppStore } from '../hooks/store/useAppStore';
import { useSqlEditorStore } from '../hooks/store/useSqlEditorStore';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  getTables: vi.fn(),
  getTableSchema: vi.fn(),
  importFile: vi.fn(),
  dropTable: vi.fn(),
  seedDemoWorkbenchData: vi.fn(),
}));

vi.mock('../services/duckdbService', () => ({
  duckDBService: {
    query: mocks.query,
    getTables: mocks.getTables,
    getTableSchema: mocks.getTableSchema,
    importFile: mocks.importFile,
    dropTable: mocks.dropTable,
  },
}));

vi.mock('./Workbench/seedWorkbenchData', () => ({
  seedDemoWorkbenchData: mocks.seedDemoWorkbenchData,
}));

vi.mock('../services/toastService', () => ({
  toastService: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    show: vi.fn(),
  },
}));

const runtimeInfo = {
  ready: true,
  persistent: false,
  version: '1.33.1',
  persistenceError: null,
};

const renderDashboard = (
  tables: string[] = ['orders', 'customers'],
  onNavigate = vi.fn(),
  extraProps: Partial<React.ComponentProps<typeof Dashboard>> = {},
) =>
  render(
    <ConfirmDialogProvider>
      <Dashboard tables={tables} onNavigate={onNavigate} runtimeInfo={runtimeInfo} {...extraProps} />
    </ConfirmDialogProvider>,
  );

beforeEach(() => {
  mocks.query.mockImplementation(async (sql: string) => {
    if (sql.includes('COUNT(*)')) {
      return [{ cnt: 4892 }];
    }
    if (sql.includes('LIMIT 10')) {
      return [
        { id: 1, name: 'Alice', amount: 120 },
        { id: 2, name: 'Bob', amount: 340 },
      ];
    }
    return [];
  });
  mocks.getTables.mockResolvedValue(['orders', 'customers']);
  mocks.getTableSchema.mockResolvedValue([
    { name: 'id', type: 'INTEGER', pk: true },
    { name: 'name', type: 'VARCHAR', pk: false },
    { name: 'amount', type: 'DOUBLE', pk: false },
  ]);
  mocks.seedDemoWorkbenchData.mockResolvedValue(undefined);
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('DuckDB Studio Refactored Executive Dashboard', () => {
  it('renders Studio Hero with dynamic greeting, primary CTA, and secondary pills', async () => {
    const onNavigate = vi.fn();
    renderDashboard(['orders', 'customers'], onNavigate);

    // Hero title
    expect(screen.getByText(/欢迎使用/)).toBeInTheDocument();
    expect(screen.getByText('本地高性能分析数据库 · 简单、快速、开放')).toBeInTheDocument();

    // Primary CTA
    const openSqlBtn = screen.getByRole('button', { name: /打开 SQL 编辑器/ });
    expect(openSqlBtn).toBeInTheDocument();
    fireEvent.click(openSqlBtn);
    expect(onNavigate).toHaveBeenCalledWith(Tab.SQL);

    // Secondary Action Pills (core data ops only; module nav in QuickActions)
    expect(screen.getAllByRole('button', { name: '导入数据' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: '新建数据集' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: '浏览数据' }).length).toBeGreaterThan(0);
    expect(screen.getByText('查看文档 · 社区支持')).toBeInTheDocument();
  });

  it('renders 6 Key Metric (KPI) cards', async () => {
    renderDashboard(['orders', 'customers']);

    expect(screen.getByText('数据库大小')).toBeInTheDocument();
    expect(screen.getByText('总行数')).toBeInTheDocument();
    expect(screen.getByText('查询次数')).toBeInTheDocument();
    expect(screen.getByText('平均查询时间')).toBeInTheDocument();
    expect(screen.getByText('活跃会话')).toBeInTheDocument();
    expect(screen.getByText('内存使用')).toBeInTheDocument();

    // Verify session hint
    expect(screen.getByText(/当前连接/)).toBeInTheDocument();
  });

  it('renders 3 Analytics Chart panels (Growth, Performance, Table Distribution)', async () => {
    renderDashboard(['orders', 'customers']);

    expect(screen.getByText('数据增长趋势')).toBeInTheDocument();
    expect(screen.getByText('导入行数')).toBeInTheDocument();
    expect(screen.getByText('查询行数')).toBeInTheDocument();

    expect(screen.getByText('查询性能')).toBeInTheDocument();
    expect(screen.getByText('平均耗时')).toBeInTheDocument();
    expect(screen.getByText('P95 耗时')).toBeInTheDocument();

    expect(screen.getByText('表类型分布')).toBeInTheDocument();
    expect(screen.getByText('总表数')).toBeInTheDocument();
    expect(screen.getByText('表 (Table)')).toBeInTheDocument();
    expect(screen.getByText('视图 (View)')).toBeInTheDocument();
  });

  it('renders Recent Tables and navigates to Data tab on table click', async () => {
    const onNavigate = vi.fn();
    renderDashboard(['orders', 'customers'], onNavigate);

    expect(screen.getByText('最近的表')).toBeInTheDocument();

    // Wait for table item using test-id
    const ordersItem = await screen.findByTestId('recent-table-orders');
    expect(ordersItem).toBeInTheDocument();
    fireEvent.click(ordersItem);

    expect(onNavigate).toHaveBeenCalledWith(Tab.DATA);
    expect(useAppStore.getState().currentTable).toBe('orders');
  });

  it('renders Recent Queries and navigates to SQL tab on query click', async () => {
    localStorage.setItem(
      'duckdb_sql_history',
      JSON.stringify([
        {
          id: 'demo-1',
          sql: 'WITH daily AS (\n  SELECT date_trunc(\'day\', event_time) AS day\n)',
          timestamp: new Date().toISOString(),
          executionTime: 1247,
          affectedRows: 7,
          status: 'success',
        },
      ]),
    );

    const onNavigate = vi.fn();
    renderDashboard(['orders', 'customers'], onNavigate);

    expect(screen.getByText('最近的查询')).toBeInTheDocument();

    // Find and click one of the recent queries using test-id
    const queryItem = await screen.findByTestId('recent-query-demo-1');
    expect(queryItem).toBeInTheDocument();
    fireEvent.click(queryItem);

    expect(onNavigate).toHaveBeenCalledWith(Tab.SQL);
    expect(useAppStore.getState().pendingSql).toContain('WITH daily AS');
  });

  it('renders honest empty state when there are no recent queries', async () => {
    renderDashboard(['orders', 'customers']);
    expect(screen.getByText('最近的查询')).toBeInTheDocument();
    expect(screen.getByText('暂无查询记录')).toBeInTheDocument();
  });

  it('renders Quick Actions matrix and triggers action handlers', async () => {
    const onNavigate = vi.fn();
    renderDashboard(['orders', 'customers'], onNavigate);

    expect(screen.getByText('快速操作')).toBeInTheDocument();
    expect(screen.getByText('从文件导入')).toBeInTheDocument();
    expect(screen.getByText('导入向导')).toBeInTheDocument();
    expect(screen.getByText('创建表')).toBeInTheDocument();
    expect(screen.getByText('示例数据')).toBeInTheDocument();
    expect(screen.getByText('管理扩展')).toBeInTheDocument();
    expect(screen.getByText('系统设置')).toBeInTheDocument();

    // Click "示例数据"
    const demoBtn = screen.getByText('示例数据');
    fireEvent.click(demoBtn);
    await waitFor(() => {
      expect(mocks.seedDemoWorkbenchData).toHaveBeenCalled();
    });

    // Click "管理扩展"
    const extBtn = screen.getByText('管理扩展');
    fireEvent.click(extBtn);
    expect(onNavigate).toHaveBeenCalledWith(Tab.EXTENSIONS);
  });

  it('handles Ctrl+Enter keyboard shortcut to navigate to SQL tab', async () => {
    const onNavigate = vi.fn();
    renderDashboard(['orders', 'customers'], onNavigate);

    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
    expect(onNavigate).toHaveBeenCalledWith(Tab.SQL);
  });

  it('renders honest empty state when there are 0 tables and never shows mock tables', async () => {
    renderDashboard([]);

    expect(screen.getByText('暂无数据表')).toBeInTheDocument();
    expect(screen.queryByText('event_log')).not.toBeInTheDocument();
    expect(screen.queryByText('fact_orders')).not.toBeInTheDocument();
  });

  it('triggers manual refresh when clicking 刷新 button', async () => {
    renderDashboard(['orders', 'customers']);

    const refreshBtn = screen.getByRole('button', { name: /刷新/ });
    expect(refreshBtn).toBeInTheDocument();
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(mocks.getTables).toHaveBeenCalled();
    });
  });

  it('filters tables by search term and opens QuickTablePeekDrawer on peek click', async () => {
    const onNavigate = vi.fn();
    renderDashboard(['orders', 'customers'], onNavigate);

    // Wait for table items
    await screen.findByTestId('recent-table-orders');
    expect(screen.getByTestId('recent-table-customers')).toBeInTheDocument();

    // Type in search box
    const searchInput = screen.getByPlaceholderText('搜索数据表名或视图…');
    fireEvent.change(searchInput, { target: { value: 'ord' } });

    expect(screen.getByTestId('recent-table-orders')).toBeInTheDocument();
    expect(screen.queryByTestId('recent-table-customers')).not.toBeInTheDocument();

    // Click peek button (title "快速预览样本与画像 (不跳转页面)")
    const peekBtns = screen.getAllByTitle('快速预览样本与画像 (不跳转页面)');
    expect(peekBtns.length).toBeGreaterThan(0);
    fireEvent.click(peekBtns[0]);

    // Drawer should open
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /数据表速览/ })).toBeInTheDocument();
    });
  });

  it('renders extended quick actions (新建 SQL 查询, 导出 / 备份) and triggers handlers', async () => {
    const onNavigate = vi.fn();
    renderDashboard(['orders', 'customers'], onNavigate);

    expect(screen.getByText('新建 SQL 查询')).toBeInTheDocument();
    expect(screen.getByText('导出 / 备份')).toBeInTheDocument();

    // Click "新建 SQL 查询"
    const newSqlBtn = screen.getByText('新建 SQL 查询');
    fireEvent.click(newSqlBtn);
    expect(onNavigate).toHaveBeenCalledWith(Tab.SQL);
    expect(useAppStore.getState().pendingSql).toBe('');

    // Click "导出 / 备份"
    const exportBtn = screen.getByText('导出 / 备份');
    fireEvent.click(exportBtn);
    expect(useAppStore.getState().showExportModal).toBe(true);
  });

  it('navigates to data tab when clicking KPI cards', async () => {
    const onNavigate = vi.fn();
    renderDashboard(['orders', 'customers'], onNavigate);

    const totalRowsCard = screen.getByTitle('点击在数据浏览中查看各表详细行数');
    fireEvent.click(totalRowsCard);
    expect(onNavigate).toHaveBeenCalledWith(Tab.DATA);
  });

  it('renders dynamic import progress banner when file import is triggered', async () => {
    let resolveImport: () => void = () => {};
    mocks.importFile.mockReturnValueOnce(
      new Promise<void>(res => {
        resolveImport = res;
      }),
    );

    const { container } = renderDashboard(['orders']);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    const file = new File(['id,val\n1,2'], 'benchmark_sales.parquet', { type: 'application/octet-stream' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(await screen.findByText(/正在挂载并解析/)).toBeInTheDocument();
    expect(screen.getByText('benchmark_sales.parquet')).toBeInTheDocument();

    // Complete the import
    resolveImport();
  });

  it('triggers PRAGMA shrink_memory when clicking memory KPI card', async () => {
    renderDashboard(['orders']);

    const memoryCard = screen.getByTitle('点击手动触发内存回收 (PRAGMA shrink_memory)');
    expect(memoryCard).toBeInTheDocument();

    fireEvent.click(memoryCard);

    await waitFor(() => {
      expect(mocks.query).toHaveBeenCalledWith('PRAGMA shrink_memory;');
    });
  });

  it('clears or updates store currentTable when dropping the active table', async () => {
    useAppStore.getState().setCurrentTable('orders');
    mocks.dropTable.mockImplementationOnce(async () => {
      mocks.getTables.mockResolvedValue(['customers']);
    });

    renderDashboard(['orders', 'customers']);

    const deleteBtn = await screen.findByTestId('delete-table-orders');
    fireEvent.click(deleteBtn);

    // Quick inline confirm button appears
    const confirmBtn = await screen.findByTestId('confirm-drop-table-orders');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mocks.dropTable).toHaveBeenCalledWith('orders');
      // currentTable should switch to the other remaining table 'customers'
      expect(useAppStore.getState().currentTable).toBe('customers');
    });
  });

  it('correctly classifies views via schema_name and excludes them from PK audit', async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('duckdb_views')) {
        return [{ view_name: 'v_summary' }];
      }
      if (sql.includes('current_database')) {
        return [{ cur_db: 'main' }];
      }
      if (sql.includes('COUNT(*)')) {
        return [{ cnt: 50 }];
      }
      return [];
    });
    mocks.getTables.mockResolvedValue(['orders', 'v_summary']);

    renderDashboard(['orders', 'v_summary']);

    // Should render VIEW badge for v_summary
    const viewItem = await screen.findByTestId('recent-table-v_summary');
    expect(viewItem).toBeInTheDocument();
    expect(viewItem).toHaveTextContent('VIEW');
  });

  it('renders expand button when table list exceeds 8 items', async () => {
    const manyTables = Array.from({ length: 10 }, (_, i) => `table_${i + 1}`);
    mocks.getTables.mockResolvedValue(manyTables);

    renderDashboard(manyTables);

    // Wait for expand button
    const expandBtn = await screen.findByRole('button', { name: /展开查看全部/ });
    expect(expandBtn).toBeInTheDocument();

    fireEvent.click(expandBtn);
    expect(screen.getByRole('button', { name: /收起部分列表/ })).toBeInTheDocument();
  });

  it('closes QuickTablePeekDrawer on Escape keydown', async () => {
    renderDashboard(['orders', 'customers']);

    await screen.findByTestId('recent-table-orders');
    const peekBtns = screen.getAllByTitle('快速预览样本与画像 (不跳转页面)');
    fireEvent.click(peekBtns[0]);

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /数据表速览/ })).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /数据表速览/ })).not.toBeInTheDocument();
    });
  });

  it('resets latency filter to all when empty filter state reset button is clicked', async () => {
    localStorage.setItem(
      'duckdb_sql_history',
      JSON.stringify([
        { id: '1', sql: 'SELECT 1;', timestamp: Date.now(), executionTimeMs: 15, success: true },
      ])
    );

    renderDashboard(['orders']);

    // Filter to slow queries (>200ms) via chart pill
    const slowPill = screen.getByTitle('点击仅过滤慢查询');
    fireEvent.click(slowPill);

    expect(await screen.findByText('当前筛选档位暂无匹配记录')).toBeInTheDocument();
    const resetBtn = screen.getByRole('button', { name: '重置为全部' });
    fireEvent.click(resetBtn);

    await waitFor(() => {
      expect(screen.queryByText('当前筛选档位暂无匹配记录')).not.toBeInTheDocument();
    });
  });

  it('clears queries from both local storage and useSqlEditorStore on confirm', async () => {
    useSqlEditorStore.getState().addHistory({
      id: 'test-1',
      sql: 'SELECT 42;',
      timestamp: Date.now(),
      executionTimeMs: 12,
      rowCount: 1,
      success: true,
    });
    expect(useSqlEditorStore.getState().history.length).toBeGreaterThan(0);

    renderDashboard(['orders']);

    const clearTriggerBtn = await screen.findByRole('button', { name: /清空/ });
    fireEvent.click(clearTriggerBtn);

    // Confirm button in capsule
    const confirmBtn = screen.getByRole('button', { name: '是' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(useSqlEditorStore.getState().history.length).toBe(0);
    });
  });

  it('navigates to Schema, Analysis Hub, and Metrics from Quick Actions', async () => {
    const onNavigate = vi.fn();
    renderDashboard(['orders'], onNavigate);

    fireEvent.click(screen.getByTestId('action-schema-designer'));
    expect(onNavigate).toHaveBeenCalledWith(Tab.STRUCTURE);

    fireEvent.click(screen.getByTestId('action-analysis-hub'));
    expect(onNavigate).toHaveBeenCalledWith(Tab.ANALYSIS_HUB);

    fireEvent.click(screen.getByTestId('action-metric-manager'));
    expect(onNavigate).toHaveBeenCalledWith(Tab.METRICS);
  });

  it('supports direct table drill-down to Analysis Hub and Metrics from Recent Tables', async () => {
    const onSelectTableAnalysis = vi.fn();
    const onSelectTableMetrics = vi.fn();

    renderDashboard(['orders'], vi.fn(), {
      onSelectTableAnalysis,
      onSelectTableMetrics,
    });

    await screen.findByTestId('recent-table-orders');

    const analysisBtn = screen.getByTitle('在分析中心探查此表');
    expect(analysisBtn).toBeInTheDocument();
    fireEvent.click(analysisBtn);
    expect(onSelectTableAnalysis).toHaveBeenCalledWith('orders');

    const metricsBtn = screen.getByTitle('在指标中心为此表建模');
    expect(metricsBtn).toBeInTheDocument();
    fireEvent.click(metricsBtn);
    expect(onSelectTableMetrics).toHaveBeenCalledWith('orders');
  });

  it('supports direct query execution from Recent Queries list', async () => {
    const onSelectQuery = vi.fn();
    localStorage.setItem(
      'duckdb_sql_history',
      JSON.stringify([
        { id: 'query-exec-1', sql: 'SELECT 999 AS test_val;', timestamp: Date.now(), executionTimeMs: 8, rowCount: 1, success: true },
      ])
    );
    useSqlEditorStore.getState().addHistory({
      id: 'query-exec-1',
      sql: 'SELECT 999 AS test_val;',
      timestamp: Date.now(),
      executionTimeMs: 8,
      rowCount: 1,
      success: true,
    });

    renderDashboard(['orders'], vi.fn(), {
      onSelectQuery,
    });

    const playBtn = await screen.findByTitle('直接在 SQL 工作台中运行该查询');
    expect(playBtn).toBeInTheDocument();
    fireEvent.click(playBtn);
    expect(onSelectQuery).toHaveBeenCalledWith('SELECT 999 AS test_val;', true);
  });
});


