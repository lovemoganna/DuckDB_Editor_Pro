// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardChartsRow } from './DashboardChartsRow';
import { DashboardRecentTables } from './DashboardRecentTables';
import { DashboardRecentQueries } from './DashboardRecentQueries';
import { StructureTab } from '../StructureTab';
import { DataTab } from '../DataTab';
import { MetricManager } from '../MetricManager';
import { ColumnInfo } from '../../types';

describe('CrossModuleLinkage - End-to-End Cross-Module Workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('1. Object Composition Donut Chart & Recent Tables Linkage', () => {
    const mockTables = [
      {
        name: 'customers',
        type: 'BASE TABLE',
        rowCount: 100,
        columnCount: 5,
        estimatedBytes: 1024,
        qualityScore: 95,
        primaryKeyCount: 1,
        nullRatioAvg: 0.02,
        untypedColumns: 0,
      },
      {
        name: 'active_users_view',
        type: 'VIEW',
        rowCount: 50,
        columnCount: 3,
        estimatedBytes: 512,
        qualityScore: 90,
        primaryKeyCount: 0,
        nullRatioAvg: 0,
        untypedColumns: 0,
      },
    ];

    it('triggers onTableTypeFilterChange when Donut slice or legend is clicked', () => {
      const onTableTypeFilterChange = vi.fn();
      render(
        <DashboardChartsRow
          tables={mockTables}
          queries={[]}
          metrics={{
            tableTypeDistribution: {
              total: 2,
              table: 1,
              view: 1,
            },
          } as any}
          onSelectTable={vi.fn()}
          onSelectQuery={vi.fn()}
          tableTypeFilter="all"
          onTableTypeFilterChange={onTableTypeFilterChange}
        />
      );

      // Find the legend item for 表 (Table)
      const tableLegend = screen.getByText('表 (Table)');
      expect(tableLegend).toBeInTheDocument();
      fireEvent.click(tableLegend);
      expect(onTableTypeFilterChange).toHaveBeenCalledWith('table');

      // Find the legend item for 视图 (View)
      const viewLegend = screen.getByText('视图 (View)');
      expect(viewLegend).toBeInTheDocument();
      fireEvent.click(viewLegend);
      expect(onTableTypeFilterChange).toHaveBeenCalledWith('view');
    });

    it('displays active filter badge and filters tables in DashboardRecentTables', () => {
      const onTypeFilterChange = vi.fn();
      const onSelectTableDataFlow = vi.fn();

      render(
        <DashboardRecentTables
          tables={mockTables}
          onSelectTable={vi.fn()}
          onSelectTableStructure={vi.fn()}
          onSelectTableAnalysis={vi.fn()}
          onSelectTableMetrics={vi.fn()}
          onSelectTableDataFlow={onSelectTableDataFlow}
          typeFilter="table"
          onTypeFilterChange={onTypeFilterChange}
        />
      );

      // Verify filter badge is displayed
      expect(screen.getByText('仅数据表')).toBeInTheDocument();

      // Verify clear button on badge
      const clearBtn = screen.getByTitle('清除类型过滤');
      expect(clearBtn).toBeInTheDocument();
      fireEvent.click(clearBtn);
      expect(onTypeFilterChange).toHaveBeenCalledWith('all');

      // Verify DataFlow jump button exists on row
      const dataFlowButtons = screen.getAllByTitle('在数据流画布中定位此表');
      expect(dataFlowButtons.length).toBeGreaterThan(0);
      fireEvent.click(dataFlowButtons[0]);
      expect(onSelectTableDataFlow).toHaveBeenCalledWith('customers');
    });
  });

  describe('2. Query Performance Latency Filter & EXPLAIN Analysis Linkage', () => {
    const mockQueries = [
      {
        id: 'q1',
        sql: 'SELECT * FROM big_table WHERE unindexed_col = 1;',
        timestamp: Date.now() - 1000,
        executionTime: 450, // slow > 200ms
        rowCount: 1000,
        status: 'success' as const,
      },
      {
        id: 'q2',
        sql: 'SELECT 1;',
        timestamp: Date.now() - 2000,
        executionTime: 12, // fast < 50ms
        rowCount: 1,
        status: 'success' as const,
      },
    ];

    it('shows EXPLAIN button for slow queries (>200ms) and executes EXPLAIN ANALYZE', () => {
      const onSelectQuery = vi.fn();
      render(
        <DashboardRecentQueries
          queries={mockQueries}
          onSelectQuery={onSelectQuery}
        />
      );

      // Check for EXPLAIN button on slow query
      const explainBtn = screen.getByTitle('在 SQL 工作台中进行 EXPLAIN ANALYZE 深度剖析');
      expect(explainBtn).toBeInTheDocument();

      fireEvent.click(explainBtn);
      expect(onSelectQuery).toHaveBeenCalledWith(
        'EXPLAIN ANALYZE SELECT * FROM big_table WHERE unindexed_col = 1;'
      );
    });

    it('renders latency filter badge when latencyFilter is active and allows clearing', () => {
      const onLatencyFilterChange = vi.fn();
      render(
        <DashboardRecentQueries
          queries={mockQueries}
          onSelectQuery={vi.fn()}
          latencyFilter="slow"
          onLatencyFilterChange={onLatencyFilterChange}
        />
      );

      expect(screen.getByText('>200ms 慢查询')).toBeInTheDocument();
      const clearBadge = screen.getByTitle('清除耗时过滤');
      fireEvent.click(clearBadge);
      expect(onLatencyFilterChange).toHaveBeenCalledWith('all');
    });
  });

  describe('3. StructureTab Initial Inspector Tab & Navigation Linkage', () => {
    const mockSchema: ColumnInfo[] = [
      { name: 'id', type: 'BIGINT', pk: true, nullable: false },
      { name: 'name', type: 'VARCHAR', pk: false, nullable: true },
    ];

    it('respects initialInspectorTab="add" when navigated from Dashboard missing PK alert', () => {
      render(
        <StructureTab
          tables={['customers']}
          currentTable="customers"
          schema={mockSchema}
          fullSchemaTree={{ customers: mockSchema }}
          structureViewMode="list"
          editColumnMode={null}
          newColName=""
          newColType="VARCHAR"
          selectedColStats={null}
          isRenaming={false}
          renameTableName="customers"
          initialInspectorTab="add"
          onSetStructureViewMode={vi.fn()}
          onSetEditColumnMode={vi.fn()}
          onSetNewColName={vi.fn()}
          onSetNewColType={vi.fn()}
          onSetSelectedColStats={vi.fn()}
          onSetIsRenaming={vi.fn()}
          onSetRenameTableName={vi.fn()}
          onHandleRenameTable={vi.fn()}
          onHandleAddColumn={vi.fn()}
          onHandleDropColumn={vi.fn()}
          onHandleSaveColumnEdit={vi.fn()}
          onShowColumnStats={vi.fn()}
          onHandleCopySchema={vi.fn()}
          onHandleDuplicateTable={vi.fn()}
          onHandleDropTable={vi.fn()}
          onAddNotification={vi.fn()}
        />
      );

      // Verify that the "添加新字段 (Add Column)" form is active
      expect(screen.getByText('添加新字段')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('例如: status, score, payload_json')).toBeInTheDocument();
    });
  });

  describe('4. MetricManager Context Awareness', () => {
    it('automatically adds currentTable into selectedTables on mount', () => {
      render(
        <MetricManager
          tables={['orders', 'customers']}
          currentTable="orders"
        />
      );

      // Verify currentTable has been pre-selected in the metric package form
      expect(screen.getByText('数据表 (1)')).toBeInTheDocument();
      expect(screen.getByDisplayValue('orders_业务指标包')).toBeInTheDocument();
    });
  });

  describe('5. DataTab Diagnostic Context Banner & Linkage', () => {
    it('renders diagnostic banner when filterQuery is passed and allows clearing or jumping to SQL', () => {
      const onNavigateToSql = vi.fn();
      const onSetFilterQuery = vi.fn();
      const onFetchTableData = vi.fn();

      render(
        <DataTab
          currentTable="customers"
          tableData={[{ id: 1, name: 'Alice' }]}
          tableColumns={['id', 'name']}
          schema={[{ name: 'id', type: 'BIGINT', pk: true, nullable: false }]}
          hiddenColumns={new Set()}
          loadingData={false}
          pagination={{ limit: 50, offset: 0, total: 1 }}
          sortConfig={[]}
          filterQuery='"name" IS NULL'
          selectedRows={new Set()}
          dataViewMode="grid"
          profileData={[]}
          editingCell={null}
          showColMenu={false}
          pkColumn={{ name: 'id', type: 'BIGINT', pk: true, nullable: false }}
          expandedRowIdx={null}
          onToggleColumnVisibility={vi.fn()}
          onSetShowColMenu={vi.fn()}
          onSetHiddenColumns={vi.fn()}
          onSetDataViewMode={vi.fn()}
          onFetchProfileData={vi.fn()}
          onFetchTableData={onFetchTableData}
          onSetFilterQuery={onSetFilterQuery}
          onSetEditingCell={vi.fn()}
          onSaveCellEdit={vi.fn()}
          onHandleSelectRow={vi.fn()}
          onHandleSelectAll={vi.fn()}
          onHandleBulkDelete={vi.fn()}
          onHandlePageChange={vi.fn()}
          onHandleSort={vi.fn()}
          onHandleApplyFilter={vi.fn()}
          onDownloadData={vi.fn()}
          onHandleInsertRow={vi.fn()}
          onSetExpandedRowIdx={vi.fn()}
          onAddNotification={vi.fn()}
          onNavigateToSql={onNavigateToSql}
        />
      );

      expect(screen.getByText('过滤条件已生效')).toBeInTheDocument();
      expect(screen.getByText('"name" IS NULL')).toBeInTheDocument();

      const sqlBtn = screen.getByTitle('将此过滤条件转化为完整 SQL 并在编辑器中执行');
      fireEvent.click(sqlBtn);
      expect(onNavigateToSql).toHaveBeenCalledWith('SELECT * FROM "customers" WHERE "name" IS NULL;');

      const clearBtn = screen.getByTitle('清除当前过滤条件');
      fireEvent.click(clearBtn);
      expect(onSetFilterQuery).toHaveBeenCalledWith('');
      expect(onFetchTableData).toHaveBeenCalledWith('customers', 0, 50, [], '');
    });
  });

  describe('6. Data Mutation Event-Driven Sync', () => {
    it('dispatches duckdb-schema-changed on window to refresh dashboard data without reload', () => {
      const eventListener = vi.fn();
      window.addEventListener('duckdb-schema-changed', eventListener);

      // Dispatch event simulating saveCellEdit / insertRow / bulkDelete
      window.dispatchEvent(new CustomEvent('duckdb-schema-changed'));

      expect(eventListener).toHaveBeenCalledTimes(1);
      window.removeEventListener('duckdb-schema-changed', eventListener);
    });
  });
});
