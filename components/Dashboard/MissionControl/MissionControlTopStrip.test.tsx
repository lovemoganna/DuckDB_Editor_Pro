// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MissionControlTopStrip } from './MissionControlTopStrip';
import { Tab } from '../../../types';
import { useSqlEditorStore } from '../../../hooks/store/useSqlEditorStore';
import { useCopilotStore } from '../../../hooks/store/useCopilotStore';

describe('MissionControlTopStrip Component', () => {
  const defaultProps = {
    metrics: {
      databaseName: 'duckdb_managed',
      databaseCount: 1,
      tableCount: 2,
      viewCount: 0,
      totalRows: 100,
      formattedTotalRows: '100 行',
      dataSize: '12 KB',
      rawSizeBytes: 12288,
      totalQueries: 5,
      avgLatencyMs: 15,
      formattedAvgLatency: '15 ms',
      successRatePct: 100,
      errorCount: 0,
      activeSessions: 1,
      memoryUsedGb: 0.01,
      memoryTotalGb: 2.0,
      memoryPercentage: 1,
      memoryPercentageDisplay: '1%',
      memoryUsageFormatted: '10 MiB',
      lastUpdated: '12:00:00',
      modeLabel: '内存模式',
      modeTag: 'RAM',
      isPersistent: false,
      storageMode: 'memory' as const,
    },
    tables: [
      {
        name: 'customers',
        rowCount: 50,
        formattedRowCount: '50 行',
        sizeBytes: 4096,
        formattedSize: '4 KB',
        updatedAt: '2026-09-28',
        type: 'table' as const,
      },
    ],
    runtimeInfo: { version: '1.33.1', persistent: false, ready: true },
    onNavigate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useSqlEditorStore.setState({
      tabs: [],
      activeTabId: '',
    });
    useCopilotStore.setState({
      isOpen: false,
    });
  });

  it('renders Studio Hero with task-oriented title and contextual status', () => {
    render(<MissionControlTopStrip {...defaultProps} />);

    expect(screen.getByText('仪表盘')).toBeInTheDocument();
    expect(screen.getByText(/从这里开始探查数据|导入数据或新建查询|继续上次的查询/)).toBeInTheDocument();
    expect(screen.getByText(/张表可用|拖入 CSV/)).toBeInTheDocument();
    expect(screen.getByText(/工作区就绪/)).toBeInTheDocument();
  });

  it('renders Current Project card with database name, path, mode, and 4 telemetry metrics', () => {
    render(<MissionControlTopStrip {...defaultProps} />);

    expect(screen.getByText('当前项目')).toBeInTheDocument();
    expect(screen.getByText('duckdb_managed')).toBeInTheDocument();
    expect(screen.getByText('/workspace/duckdb_managed')).toBeInTheDocument();
    expect(screen.getByText('内存临时沙盒模式')).toBeInTheDocument();
    expect(screen.getByText('DuckDB v1.33.1')).toBeInTheDocument();

    // 4 Metrics
    expect(screen.getByText('数据表')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('数据量')).toBeInTheDocument();
    expect(screen.getByText('12 KB')).toBeInTheDocument();
    expect(screen.getByText('SQL 查询')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('navigates to SQL editor when clicking 新建查询 button', () => {
    render(<MissionControlTopStrip {...defaultProps} />);

    const newQueryBtn = screen.getByRole('button', { name: /新建查询/i });
    fireEvent.click(newQueryBtn);

    expect(useSqlEditorStore.getState().tabs.length).toBe(1);
    expect(defaultProps.onNavigate).toHaveBeenCalledWith(Tab.SQL);
  });

  it('shows 继续编辑 when an active SQL tab already has content', () => {
    useSqlEditorStore.setState({
      tabs: [{
        id: 't1',
        title: '分析',
        code: 'SELECT 1;',
        history: [],
        historyIndex: -1,
        loading: false,
        viewMode: 'table',
        chartConfig: {} as any,
        page: 0,
        filterTerm: '',
      }],
      activeTabId: 't1',
    });

    render(<MissionControlTopStrip {...defaultProps} />);

    const resumeBtn = screen.getByRole('button', { name: /继续编辑/i });
    fireEvent.click(resumeBtn);

    expect(defaultProps.onNavigate).toHaveBeenCalledWith(Tab.SQL);
    expect(useSqlEditorStore.getState().tabs.length).toBe(1);
  });

  it('toggles Copilot sidebar when clicking 智能助手 button', () => {
    render(<MissionControlTopStrip {...defaultProps} />);

    const copilotBtn = screen.getByTitle(/切换独立 Copilot 协同助手/i);
    fireEvent.click(copilotBtn);

    expect(useCopilotStore.getState().isOpen).toBe(true);
  });

  it('calls onOpenAiChat callback when provided', () => {
    const onOpenAiChat = vi.fn();
    render(<MissionControlTopStrip {...defaultProps} onOpenAiChat={onOpenAiChat} />);

    const copilotBtn = screen.getByTitle(/切换独立 Copilot 协同助手/i);
    fireEvent.click(copilotBtn);

    expect(onOpenAiChat).toHaveBeenCalled();
  });

  it('triggers onRefresh callback when clicking 刷新 button', () => {
    const onRefresh = vi.fn();
    render(<MissionControlTopStrip {...defaultProps} onRefresh={onRefresh} />);

    const refreshBtn = screen.getByTitle('刷新工作区状态');
    fireEvent.click(refreshBtn);

    expect(onRefresh).toHaveBeenCalled();
  });
});
