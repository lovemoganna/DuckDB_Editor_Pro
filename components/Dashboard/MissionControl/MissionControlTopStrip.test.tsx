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

  it('renders flat workspace header with db identity and context', () => {
    render(<MissionControlTopStrip {...defaultProps} />);

    expect(screen.getByText('工作台')).toBeInTheDocument();
    expect(screen.getByText('duckdb_managed')).toBeInTheDocument();
    expect(screen.getByText(/1 张表|空工作区|继续/)).toBeInTheDocument();
    expect(screen.queryByText('当前项目')).not.toBeInTheDocument();
    expect(screen.queryByText('/workspace/duckdb_managed')).not.toBeInTheDocument();
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

  it('toggles Copilot sidebar when clicking 助手 button', () => {
    render(<MissionControlTopStrip {...defaultProps} />);

    const copilotBtn = screen.getByTitle(/切换 Copilot/i);
    fireEvent.click(copilotBtn);

    expect(useCopilotStore.getState().isOpen).toBe(true);
  });

  it('calls onOpenAiChat callback when provided', () => {
    const onOpenAiChat = vi.fn();
    render(<MissionControlTopStrip {...defaultProps} onOpenAiChat={onOpenAiChat} />);

    const copilotBtn = screen.getByTitle(/切换 Copilot/i);
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
