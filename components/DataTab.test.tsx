import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { duckDBService } from '../services/duckdbService';
import { DataTab } from './DataTab';
import { ColumnInfo } from '../types';

describe('DataTab Component - Comprehensive Suite', () => {
  const mockTables = ['users', 'orders'];
  const mockSchema: ColumnInfo[] = [
    { name: 'id', type: 'INTEGER', pk: true, notnull: true, dflt_value: null },
    { name: 'name', type: 'VARCHAR', pk: false, notnull: true, dflt_value: null },
    { name: 'age', type: 'INTEGER', pk: false, notnull: false, dflt_value: null },
  ];

  const mockData = [
    { id: 1, name: 'Alice', age: 25 },
    { id: 2, name: 'Bob', age: 30 },
  ];

  const defaultProps = {
    currentTable: 'users',
    tableData: mockData,
    tableColumns: ['id', 'name', 'age'],
    schema: mockSchema,
    hiddenColumns: new Set<string>(),
    loadingData: false,
    pagination: { limit: 50, offset: 0, total: 2 },
    sortConfig: [] as { key: string; direction: 'ASC' | 'DESC' }[],
    filterQuery: '',
    selectedRows: new Set(),
    dataViewMode: 'grid' as const,
    profileData: [
      {
        column_name: 'id',
        column_type: 'INTEGER',
        null_percentage: '0.0',
        approx_unique: 2,
        min: '1',
        max: '2',
        avg: '1.5',
        q50: '1.5',
      },
      {
        column_name: 'name',
        column_type: 'VARCHAR',
        null_percentage: '0.0',
        approx_unique: 2,
        min: 'Alice',
        max: 'Bob',
      },
    ],
    editingCell: null,
    showColMenu: false,
    pkColumn: mockSchema[0],
    expandedRowIdx: null as number | null,

    onToggleColumnVisibility: vi.fn(),
    onSetShowColMenu: vi.fn(),
    onSetHiddenColumns: vi.fn(),
    onSetDataViewMode: vi.fn(),
    onFetchProfileData: vi.fn(),
    onFetchTableData: vi.fn(),
    onSetFilterQuery: vi.fn(),
    onSetEditingCell: vi.fn(),
    onSaveCellEdit: vi.fn(),
    onHandleSelectRow: vi.fn(),
    onHandleSelectAll: vi.fn(),
    onHandleBulkDelete: vi.fn(),
    onHandlePageChange: vi.fn(),
    onHandleSort: vi.fn(),
    onHandleApplyFilter: vi.fn(),
    onDownloadData: vi.fn(),
    onHandleInsertRow: vi.fn(),
    onShowCreateModal: vi.fn(),
    onShowImportModal: vi.fn(),
    onLoadDemo: vi.fn(),
    onSetExpandedRowIdx: vi.fn(),
    onAddNotification: vi.fn(),
    onNavigateToDashboard: vi.fn(),
    tables: mockTables,
    onSelectTable: vi.fn(),
    onNavigateToStructure: vi.fn(),
    onNavigateToAnalysis: vi.fn(),
    onNavigateToMetrics: vi.fn(),
    onNavigateToSql: vi.fn(),
    onNavigateToDataFlow: vi.fn(),
    onShowExportModal: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => vi.restoreAllMocks());

  it('preserves healthy metadata when one table fails and supports retry', async () => {
    let failOrders = true;
    vi.spyOn(duckDBService, 'getTableSchema').mockImplementation(async name => {
      if (name === 'orders' && failOrders) throw new Error('unavailable');
      return mockSchema;
    });
    vi.spyOn(duckDBService, 'readQuery').mockImplementation(async sql => {
      if (sql.includes('COUNT(*)')) {
        if (sql.includes('orders') && failOrders) throw new Error('unavailable');
        return [{ total: 0 }];
      }
      return [];
    });
    render(<DataTab {...defaultProps} currentTable={null} />);
    await waitFor(() => expect(screen.getByText('元数据未完整载入')).toBeDefined());
    expect(screen.getByText('0 行')).toBeDefined();
    expect(screen.getByText('-- 行')).toBeDefined();
    expect(screen.getByText('3 列')).toBeDefined();
    failOrders = false;
    fireEvent.click(screen.getByRole('button', { name: '重试元数据' }));
    await waitFor(() => expect(screen.queryByText('元数据未完整载入')).toBeNull());
    await waitFor(() => expect(screen.getAllByText('0 行')).toHaveLength(2));
  });

  it('renders table data rows and columns accurately in grid mode', () => {
    render(<DataTab {...defaultProps} />);

    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.getByText('Bob')).toBeDefined();
    expect(screen.getByText('共 2 条记录')).toBeDefined();
  });

  it('renders Multi-Table Hub properly when no currentTable is selected but tables exist', () => {
    render(<DataTab {...defaultProps} currentTable={null} />);

    expect(screen.getByText('数据资源工作台')).toBeDefined();
    expect(screen.getByText('users')).toBeDefined();
    expect(screen.getByText('orders')).toBeDefined();
    expect(screen.getAllByText('浏览数据 ↗').length).toBe(2);
  });

  it('filters tables by search query in Multi-Table Hub', () => {
    render(<DataTab {...defaultProps} currentTable={null} />);

    const searchInput = screen.getByPlaceholderText('搜索表名 / 字段名…');
    fireEvent.change(searchInput, { target: { value: 'order' } });

    expect(screen.getByText('orders')).toBeDefined();
    expect(screen.queryByText('users')).toBeNull();
  });

  it('selects table when clicking browse button in Multi-Table Hub', () => {
    render(<DataTab {...defaultProps} currentTable={null} />);

    const browseButtons = screen.getAllByText('浏览数据 ↗');
    fireEvent.click(browseButtons[0]);

    expect(defaultProps.onSelectTable).toHaveBeenCalledWith('users');
  });

  it('switches between grid and list views in Multi-Table Hub', () => {
    render(<DataTab {...defaultProps} currentTable={null} />);

    const listBtn = screen.getByTitle('紧凑表格列表视图');
    fireEvent.click(listBtn);

    expect(screen.getByText('估算行数')).toBeDefined();
    expect(screen.getByText('字段概览')).toBeDefined();
  });

  it('renders zero-tables empty state properly when database has no tables', () => {
    render(<DataTab {...defaultProps} currentTable={null} tables={[]} />);

    expect(screen.getByText('未找到可浏览的数据表')).toBeDefined();
    expect(screen.getByText('加载示例数据')).toBeDefined();
  });

  it('renders in-table empty placeholder when tableData is empty', () => {
    render(<DataTab {...defaultProps} tableData={[]} pagination={{ limit: 50, offset: 0, total: 0 }} />);

    expect(screen.getByText('当前数据表尚无记录')).toBeDefined();
    expect(screen.getByText('插入新数据行')).toBeDefined();
  });

  it('renders filter empty placeholder when filter matches 0 rows', () => {
    render(
      <DataTab
        {...defaultProps}
        tableData={[]}
        filterQuery="age > 100"
        pagination={{ limit: 50, offset: 0, total: 0 }}
      />
    );

    expect(screen.getByText('未找到符合过滤条件的记录')).toBeDefined();
    expect(screen.getByText('清除过滤条件')).toBeDefined();
  });

  it('triggers onSetExpandedRowIdx when expand button is clicked', () => {
    render(<DataTab {...defaultProps} />);

    const expandButtons = screen.getAllByTitle('在抽屉中查看该行完整详情');
    expect(expandButtons.length).toBe(2);
    fireEvent.click(expandButtons[0]);

    expect(defaultProps.onSetExpandedRowIdx).toHaveBeenCalledWith(0);
  });

  it('renders RowDetailPanel when expandedRowIdx is set', () => {
    render(<DataTab {...defaultProps} expandedRowIdx={0} />);

    expect(screen.getByText('行记录明细')).toBeDefined();
    expect(screen.getByText('#1 / 共 2 行')).toBeDefined();
    expect(screen.getByText('复制 JSON')).toBeDefined();
  });

  it('renders context menu on right click with filter, exclusion, and sort actions', () => {
    render(<DataTab {...defaultProps} />);

    const aliceCell = screen.getByText('Alice').closest('td');
    expect(aliceCell).not.toBeNull();
    fireEvent.contextMenu(aliceCell!);

    expect(screen.getByText('复制单元格值')).toBeDefined();
    expect(screen.getByText('以此值快速过滤 (=)')).toBeDefined();
    expect(screen.getByText('排除此值过滤 (!=)')).toBeDefined();
    expect(screen.getByText('此列升序排列 (ASC)')).toBeDefined();
    expect(screen.getByText('此列降序排列 (DESC)')).toBeDefined();
    expect(screen.getByText('查看此列画像分布')).toBeDefined();
    expect(screen.getByText('隐藏此列')).toBeDefined();
  });

  it('renders cross-module navigation jump chips including DataFlow', () => {
    render(<DataTab {...defaultProps} />);

    expect(screen.getByText('结构设计 ↗')).toBeDefined();
    expect(screen.getByText('分析中心 ↗')).toBeDefined();
    expect(screen.getByText('指标建模 ↗')).toBeDefined();
    expect(screen.getByText('在 SQL 中查询 ↗')).toBeDefined();
    expect(screen.getByText('数据流 ↗')).toBeDefined();
  });

  it('renders advanced export button when onShowExportModal is provided', () => {
    render(<DataTab {...defaultProps} />);

    const advExportBtn = screen.getByTitle('打开高级数据导出配置面板');
    expect(advExportBtn).toBeDefined();
    fireEvent.click(advExportBtn);
    expect(defaultProps.onShowExportModal).toHaveBeenCalled();
  });

  it('displays active sort badge with clear button when sortConfig is not empty', () => {
    render(
      <DataTab
        {...defaultProps}
        sortConfig={[{ key: 'age', direction: 'DESC' }]}
      />
    );

    expect(screen.getByText('age DESC')).toBeDefined();
    const clearSortBtn = screen.getByTitle('清除所有排序');
    expect(clearSortBtn).toBeDefined();
    fireEvent.click(clearSortBtn);
    expect(defaultProps.onFetchTableData).toHaveBeenCalledWith('users', 0, 50, [], '');
  });

  it('switches to Profile view and renders telemetry cards', () => {
    render(<DataTab {...defaultProps} dataViewMode="profile" />);

    expect(screen.getByText(/SCHEMA SCOPE/i)).toBeDefined();
    expect(screen.getByText(/HEALTH SCORE/i)).toBeDefined();
    expect(screen.getByText(/CONSTRAINTS & KEYS/i)).toBeDefined();
  });

  it('renders cross-module navigation actions in Multi-Table Hub list view', () => {
    render(<DataTab {...defaultProps} currentTable={null} />);

    // Switch to list view
    const listBtn = screen.getByTitle('紧凑表格列表视图');
    fireEvent.click(listBtn);

    expect(screen.getAllByTitle('查看结构定义').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTitle('在分析中心探查').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTitle('在指标建模中定义').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTitle('在 SQL 中查询').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTitle('查看数据流血缘').length).toBeGreaterThanOrEqual(1);
  });
});
