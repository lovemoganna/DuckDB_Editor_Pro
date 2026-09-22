import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StructureTab, getTypeBadgeStyle } from './StructureTab';
import { ColumnInfo, ColumnStats } from '../types';

describe('StructureTab Component', () => {
  const mockTables = ['users', 'orders'];
  const mockSchema: ColumnInfo[] = [
    { name: 'id', type: 'INTEGER', pk: true, notnull: true, dflt_value: null },
    { name: 'username', type: 'VARCHAR', pk: false, notnull: true, dflt_value: null },
    { name: 'created_at', type: 'TIMESTAMP', pk: false, notnull: false, dflt_value: null },
    { name: 'metadata', type: 'JSON', pk: false, notnull: false, dflt_value: null },
    { name: 'is_active', type: 'BOOLEAN', pk: false, notnull: false, dflt_value: null },
  ];

  const mockFullSchemaTree: Record<string, ColumnInfo[]> = {
    users: mockSchema,
    orders: [
      { name: 'order_id', type: 'INTEGER', pk: true, notnull: true, dflt_value: null },
      { name: 'user_id', type: 'INTEGER', pk: false, notnull: true, dflt_value: null },
      { name: 'total_amount', type: 'DECIMAL', pk: false, notnull: true, dflt_value: null },
    ],
  };

  const defaultProps = {
    tables: mockTables,
    currentTable: 'users',
    schema: mockSchema,
    fullSchemaTree: mockFullSchemaTree,
    structureViewMode: 'list' as const,
    editColumnMode: null,
    newColName: '',
    newColType: 'VARCHAR',
    selectedColStats: null,
    isRenaming: false,
    renameTableName: '',
    onSetStructureViewMode: vi.fn(),
    onSetEditColumnMode: vi.fn(),
    onSetNewColName: vi.fn(),
    onSetNewColType: vi.fn(),
    onSetSelectedColStats: vi.fn(),
    onSetIsRenaming: vi.fn(),
    onSetRenameTableName: vi.fn(),
    onHandleRenameTable: vi.fn(),
    onHandleAddColumn: vi.fn(),
    onHandleDropColumn: vi.fn(),
    onHandleSaveColumnEdit: vi.fn(),
    onShowColumnStats: vi.fn(),
    onHandleCopySchema: vi.fn(),
    onHandleDuplicateTable: vi.fn(),
    onHandleDropTable: vi.fn(),
    onAddNotification: vi.fn(),
    onSelectTable: vi.fn(),
  };

  it('renders page header and columns list properly', () => {
    render(<StructureTab {...defaultProps} />);

    expect(screen.getByText('Schema 架构体系')).toBeInTheDocument();
    expect(screen.getAllByText('users').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('username')).toBeInTheDocument();
    expect(screen.getByText('created_at')).toBeInTheDocument();
    expect(screen.getByText('metadata')).toBeInTheDocument();
  });

  it('renders empty state when no tables exist', () => {
    render(<StructureTab {...defaultProps} tables={[]} />);
    expect(screen.getByText('未找到可分析的数据表')).toBeInTheDocument();
  });

  it('filters columns based on search input', () => {
    render(<StructureTab {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText('搜索字段名或数据类型...');
    fireEvent.change(searchInput, { target: { value: 'user' } });

    expect(screen.getByText('username')).toBeInTheDocument();
    expect(screen.queryByText('created_at')).not.toBeInTheDocument();
  });

  it('handles inline editing of column', () => {
    const editProps = {
      ...defaultProps,
      editColumnMode: { colName: 'username', newName: 'user_full_name', newType: 'VARCHAR' },
    };
    render(<StructureTab {...editProps} />);

    const nameInput = screen.getByDisplayValue('user_full_name');
    expect(nameInput).toBeInTheDocument();

    fireEvent.change(nameInput, { target: { value: 'display_name' } });
    expect(defaultProps.onSetEditColumnMode).toHaveBeenCalledWith({
      colName: 'username',
      newName: 'display_name',
      newType: 'VARCHAR',
    });
  });

  it('renders column profiling stats in the contextual inspector when selected', () => {
    const mockStats: ColumnStats = {
      total_count: 1000,
      null_count: 5,
      distinct_count: 850,
      min: 'alice',
      max: 'zoe',
      top_k: [{ value: 'admin', count: 50 }, { value: 'guest', count: 20 }],
    };

    const statsProps = {
      ...defaultProps,
      selectedColStats: { col: 'username', stats: mockStats },
    };

    render(<StructureTab {...statsProps} />);

    expect(screen.getAllByText('username').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('1,000')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('850')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('Top 5 高频值分布')).toBeInTheDocument();
  });

  it('renders ER graph view when structureViewMode is graph', () => {
    const graphProps = {
      ...defaultProps,
      structureViewMode: 'graph' as const,
    };

    render(<StructureTab {...graphProps} />);

    expect(screen.getByPlaceholderText('在图谱中搜索表名或字段...')).toBeInTheDocument();
    expect(screen.getByText(/2 张表/)).toBeInTheDocument();
    expect(screen.getByText('orders')).toBeInTheDocument();
  });

  it('maps data types to correct Monokai Pro semantic tokens', () => {
    expect(getTypeBadgeStyle('INTEGER')).toContain('text-monokai-cyan');
    expect(getTypeBadgeStyle('VARCHAR')).toContain('text-monokai-green');
    expect(getTypeBadgeStyle('TIMESTAMP')).toContain('text-monokai-yellow');
    expect(getTypeBadgeStyle('BOOLEAN')).toContain('text-monokai-amethyst');
    expect(getTypeBadgeStyle('JSON')).toContain('text-monokai-orange');
  });

  it('renders column DEFAULT value when defined in schema', () => {
    const schemaWithDefault: ColumnInfo[] = [
      { name: 'id', type: 'INTEGER', pk: true, notnull: true, dflt_value: null },
      { name: 'status', type: 'VARCHAR', pk: false, notnull: false, dflt_value: "'active'" },
    ];
    render(<StructureTab {...defaultProps} schema={schemaWithDefault} />);

    expect(screen.getByText('DEFAULT: \'active\'')).toBeInTheDocument();
  });

  it('calculates and displays null percentage and distinct cardinality ratio in profiler', () => {
    const mockStats: ColumnStats = {
      total_count: 200,
      null_count: 10,
      distinct_count: 50,
      min: 'A',
      max: 'Z',
      top_k: [{ value: 'A', count: 40 }],
    };

    render(
      <StructureTab
        {...defaultProps}
        selectedColStats={{ col: 'username', stats: mockStats }}
      />
    );

    // 10 / 200 = 5.0%
    expect(screen.getByText('5.0%')).toBeInTheDocument();
    // 50 / 200 = 25.0%
    expect(screen.getByText('基数比: 25.0%')).toBeInTheDocument();
  });

  it('supports ER graph zoom controls and jumps to list view on node detail click', () => {
    const onSetStructureViewMode = vi.fn();
    const onSelectTable = vi.fn();

    render(
      <StructureTab
        {...defaultProps}
        structureViewMode="graph"
        onSetStructureViewMode={onSetStructureViewMode}
        onSelectTable={onSelectTable}
      />
    );

    // Zoom in and out buttons exist
    const zoomInBtn = screen.getByTitle('放大画布');
    const zoomOutBtn = screen.getByTitle('缩小画布');
    expect(zoomInBtn).toBeInTheDocument();
    expect(zoomOutBtn).toBeInTheDocument();

    // Click zoom in
    fireEvent.click(zoomInBtn);
    expect(screen.getByText('115%')).toBeInTheDocument();

    // Click "详情" on orders card
    const detailButtons = screen.getAllByTitle('切换到列表视图深度查看此表');
    expect(detailButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(detailButtons[0]);

    expect(onSetStructureViewMode).toHaveBeenCalledWith('list');
  });

  it('validates against duplicate column name when adding column', () => {
    render(
      <StructureTab
        {...defaultProps}
        initialInspectorTab="add"
        newColName="username"
      />
    );

    expect(screen.getByText('该字段名在当前表中已存在')).toBeInTheDocument();
    const submitBtn = screen.getByText('确认添加字段').closest('button');
    expect(submitBtn).toBeDisabled();
  });

  it('passes NOT NULL and DEFAULT overrides when adding a column', () => {
    const onHandleAddColumn = vi.fn();
    render(
      <StructureTab
        {...defaultProps}
        initialInspectorTab="add"
        newColName="status"
        newColType="VARCHAR"
        onHandleAddColumn={onHandleAddColumn}
      />
    );

    fireEvent.click(screen.getByLabelText('非空约束 (NOT NULL)'));
    fireEvent.change(screen.getByPlaceholderText("例如: 0, 'active', CURRENT_TIMESTAMP"), {
      target: { value: "'active'" },
    });
    fireEvent.click(screen.getByText('确认添加字段'));

    expect(onHandleAddColumn).toHaveBeenCalledWith({
      name: 'status',
      type: "VARCHAR NOT NULL DEFAULT 'active'",
    });
  });
});

