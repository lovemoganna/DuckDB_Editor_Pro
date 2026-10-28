// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  KpiPortalTooltip,
  TableDistributionMiniChart,
  TableRowVolumeMiniChart,
  QueryTimelineSparkline,
  LatencyTrendSparkline,
  WasmWorkerTelemetryMiniChart,
  MemoryGaugeMiniChart,
  type KpiTooltipData,
} from './KpiDynamicMiniCharts';
import { MissionControlKpis } from './MissionControl/MissionControlKpis';
import { PerformanceTrendStrip } from './MissionControl/PerformanceTrendStrip';
import { SystemHealthGauges } from './MissionControl/SystemHealthGauges';

const mockTables: any = [
  {
    name: 'thinker_schools',
    rowCount: 6,
    formattedRowCount: '6 行',
    sizeBytes: 12288,
    formattedSize: '12 KB',
    updatedAt: '2026-09-28 06:30',
    type: 'table',
    schema: 'main',
  },
  {
    name: 'life_action',
    rowCount: 3,
    formattedRowCount: '3 行',
    sizeBytes: 4096,
    formattedSize: '4 KB',
    updatedAt: '2026-09-28 06:15',
    type: 'table',
    schema: 'main',
  },
];

const mockHistoryItems: any = [
  {
    id: 'q-2',
    sql: 'SELECT * FROM invalid_table;',
    timestamp: Date.now(),
    status: 'error',
    executionTime: 3.2,
    error: 'Table not found',
  },
  {
    id: 'q-1',
    sql: 'SELECT count(*) FROM thinker_schools;',
    timestamp: Date.now() - 60000,
    status: 'success',
    executionTime: 14.5,
    affectedRows: 1,
  },
];

describe('KpiDynamicMiniCharts & Dynamic Tooltips Suite', () => {

  it('renders TableDistributionMiniChart and fires tooltip with dimension and metric data', () => {
    const onTooltip = vi.fn();
    const { container } = render(
      <TableDistributionMiniChart tables={mockTables} onTooltip={onTooltip} />
    );

    const bars = container.querySelectorAll('.group\\/bar');
    expect(bars.length).toBe(2);

    // Hover first bar
    fireEvent.mouseEnter(bars[0]);
    expect(onTooltip).toHaveBeenCalledTimes(1);
    const tooltipData = onTooltip.mock.calls[0][0] as KpiTooltipData;
    expect(tooltipData.title).toBe('thinker_schools');
    expect(tooltipData.items.some((i) => i.value.includes('6 行'))).toBe(true);
    expect(tooltipData.items.some((i) => i.value === '12 KB')).toBe(true);
  });

  it('renders TableRowVolumeMiniChart and calculates percentage breakdown', () => {
    const onTooltip = vi.fn();
    const { container } = render(
      <TableRowVolumeMiniChart tables={mockTables} totalRows={9} onTooltip={onTooltip} />
    );

    const volBars = container.querySelectorAll('.group\\/vol');
    expect(volBars.length).toBe(2);

    fireEvent.mouseEnter(volBars[0]);
    expect(onTooltip).toHaveBeenCalled();
    const tooltipData = onTooltip.mock.calls[0][0] as KpiTooltipData;
    expect(tooltipData.title).toBe('thinker_schools');
    expect(tooltipData.badge?.label).toContain('占比 66.7%');
  });

  it('renders QueryTimelineSparkline with real success and error dots', () => {
    const onTooltip = vi.fn();
    const { container } = render(
      <QueryTimelineSparkline
        historyItems={mockHistoryItems}
        totalQueries={2}
        successRatePct={50}
        onTooltip={onTooltip}
      />
    );

    const hitAreas = container.querySelectorAll('circle.cursor-pointer');
    expect(hitAreas.length).toBe(2);

    // Hover success query
    fireEvent.mouseEnter(hitAreas[0]);
    expect(onTooltip).toHaveBeenCalled();
    const tooltipData = onTooltip.mock.calls[0][0] as KpiTooltipData;
    expect(tooltipData.title).toBe('SQL 查询成功');
    expect(tooltipData.badge?.tone).toBe('ok');
    expect(tooltipData.items.some((i) => i.value.includes('14.5 ms'))).toBe(true);

    // Hover error query
    fireEvent.mouseEnter(hitAreas[1]);
    const errTooltip = onTooltip.mock.calls[1][0] as KpiTooltipData;
    expect(errTooltip.title).toBe('SQL 查询报错');
    expect(errTooltip.badge?.tone).toBe('danger');
  });

  it('renders LatencyTrendSparkline and shows delta vs average', () => {
    const onTooltip = vi.fn();
    const { container } = render(
      <LatencyTrendSparkline
        historyItems={mockHistoryItems}
        avgLatencyMs={10.0}
        onTooltip={onTooltip}
      />
    );

    const hitAreas = container.querySelectorAll('circle.cursor-pointer');
    expect(hitAreas.length).toBe(2);

    fireEvent.mouseEnter(hitAreas[0]);
    expect(onTooltip).toHaveBeenCalled();
    const tooltipData = onTooltip.mock.calls[0][0] as KpiTooltipData;
    expect(tooltipData.title).toBe('查询执行耗时');
    expect(tooltipData.items.some((i) => i.value.includes('+4.5 ms vs 均值'))).toBe(true);
  });

  it('renders WasmWorkerTelemetryMiniChart with 4 subsystem status bars', () => {
    const onTooltip = vi.fn();
    const { container } = render(
      <WasmWorkerTelemetryMiniChart activeSessions={1} onTooltip={onTooltip} />
    );

    const bars = container.querySelectorAll('.cursor-pointer');
    expect(bars.length).toBe(4);

    fireEvent.mouseEnter(bars[0]);
    expect(onTooltip).toHaveBeenCalled();
    const tooltipData = onTooltip.mock.calls[0][0] as KpiTooltipData;
    expect(tooltipData.title).toBe('Worker 主线程');
    expect(tooltipData.badge?.label).toBe('运行中');
  });

  it('renders MemoryGaugeMiniChart and opens tooltip on hover', () => {
    const onTooltip = vi.fn();
    const { container } = render(
      <MemoryGaugeMiniChart
        memoryPercentage={4}
        memoryUsageFormatted="8.1 MiB"
        memoryTotalGb={2.0}
        onTooltip={onTooltip}
      />
    );

    const track = container.querySelector('.group\\/meter');
    expect(track).toBeInTheDocument();

    fireEvent.mouseEnter(track!);
    expect(onTooltip).toHaveBeenCalled();
    const tooltipData = onTooltip.mock.calls[0][0] as KpiTooltipData;
    expect(tooltipData.title).toBe('DuckDB 内存缓冲池');
    expect(tooltipData.items.some((i) => i.value === '8.1 MiB')).toBe(true);
  });

  it('renders KpiPortalTooltip in document.body when active', () => {
    const tooltipData: KpiTooltipData = {
      x: 300,
      y: 200,
      title: '测试指标卡',
      badge: { label: '实时', tone: 'ok' },
      items: [
        { label: '字段 A', value: '100' },
        { label: '字段 B', value: '200' },
      ],
      footer: '测试页脚说明',
    };

    const { rerender } = render(<KpiPortalTooltip tooltip={null} />);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    rerender(<KpiPortalTooltip tooltip={tooltipData} />);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByText('测试指标卡')).toBeInTheDocument();
    expect(screen.getByText('实时')).toBeInTheDocument();
    expect(screen.getByText('测试页脚说明')).toBeInTheDocument();
  });
});

describe('MissionControlKpis & Telemetry Integration', () => {
  const mockMetrics: any = {
    databaseName: 'duckdb_managed',
    databaseCount: 1,
    tableCount: 12,
    viewCount: 0,
    totalRows: 29,
    formattedTotalRows: '29',
    dataSize: '14.1 KB',
    rawSizeBytes: 14438,
    totalQueries: 8,
    avgLatencyMs: 29,
    formattedAvgLatency: '29 ms',
    successRatePct: 100,
    errorCount: 0,
    activeSessions: 1,
    memoryUsedGb: 0.01,
    memoryTotalGb: 2.0,
    memoryPercentage: 1,
    memoryPercentageDisplay: '< 1%',
    memoryUsageFormatted: '8.1 MiB',
  };

  it('renders MissionControlKpis with compact metric strip', () => {
    render(<MissionControlKpis metrics={mockMetrics} tables={[]} allHistoryItems={[]} />);

    expect(screen.getByTestId('studio-metric-strip')).toBeInTheDocument();
    expect(screen.getByText('表')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('行数')).toBeInTheDocument();
    expect(screen.getByText('29')).toBeInTheDocument();
    expect(screen.getByText('查询')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('内存')).toBeInTheDocument();
    expect(screen.getByText('8.1 MiB')).toBeInTheDocument();
    expect(screen.queryByText('平均查询时间')).not.toBeInTheDocument();
    expect(screen.queryByText('活跃会话')).not.toBeInTheDocument();
  });

  it('renders honest zero-state indicator when no tables exist', () => {
    const onTooltip = vi.fn();
    const { container } = render(
      <TableDistributionMiniChart tables={[]} onTooltip={onTooltip} />
    );

    expect(container.querySelectorAll('.group\\/bar').length).toBe(0);
    const emptyTrack = container.querySelector('.cursor-help');
    expect(emptyTrack).toBeInTheDocument();
    fireEvent.mouseEnter(emptyTrack!);
    expect(onTooltip).toHaveBeenCalledTimes(1);
    const tooltipData = onTooltip.mock.calls[0][0] as KpiTooltipData;
    expect(tooltipData.title).toBe('数据表资产');
    expect(tooltipData.badge?.label).toBe('空库状态');
  });

  it('renders PerformanceTrendStrip with interactive visualizers and tooltips', () => {
    render(
      <PerformanceTrendStrip
        metrics={mockMetrics}
        allHistoryItems={mockHistoryItems}
        recentImports={[]}
      />
    );

    expect(screen.getByText('性能趋势')).toBeInTheDocument();
    expect(screen.getByText('查询次数')).toBeInTheDocument();
    expect(screen.getByText('平均查询时间')).toBeInTheDocument();
    expect(screen.getByText('内存使用')).toBeInTheDocument();
    expect(screen.getByText('成功导入累计行数')).toBeInTheDocument();
    expect(screen.getByText('当前采样 · 无历史曲线')).toBeInTheDocument();
  });

  it('renders SystemHealthGauges with live telemetry circular gauges', () => {
    render(
      <SystemHealthGauges
        metrics={mockMetrics}
      />
    );

    expect(screen.getByText('系统状态')).toBeInTheDocument();
    expect(screen.getByText('引擎')).toBeInTheDocument();
    expect(screen.getByText('内存')).toBeInTheDocument();
    expect(screen.getByText('磁盘')).toBeInTheDocument();
    expect(screen.getByText('查询成功率')).toBeInTheDocument();
  });
});

