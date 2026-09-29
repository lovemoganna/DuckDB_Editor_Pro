import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataIdeMissionControl } from './DataIdeMissionControl';
import { MissionControlTopStrip } from './MissionControlTopStrip';
import { MissionControlKpis } from './MissionControlKpis';
import { CyberGridBackground, HeroDeepSpaceIllustration, KpiWatermark, EmptyCockpitIllustration } from './DashboardSvgIllustrations';
import { Tab } from '../../../types';

describe('Modern Cyber Dashboard Components', () => {
  it('renders Cyber SVG illustrations correctly', () => {
    const { container: gridContainer } = render(<CyberGridBackground />);
    expect(gridContainer.querySelector('svg')).toBeTruthy();
    expect(gridContainer.querySelector('pattern#cyber-grid-pattern')).toBeTruthy();

    const { container: heroContainer } = render(<HeroDeepSpaceIllustration />);
    expect(heroContainer.querySelector('svg')).toBeTruthy();
    expect(heroContainer.querySelector('linearGradient#hero-stream-cyan')).toBeTruthy();

    const { container: watermarkContainer } = render(<KpiWatermark type="tables" />);
    expect(watermarkContainer.querySelector('svg')).toBeTruthy();

    const { container: emptyContainer } = render(<EmptyCockpitIllustration />);
    expect(emptyContainer.querySelector('svg')).toBeTruthy();
  });

  it('renders MissionControlTopStrip with integrated greeting, CTAs, and diagnostics', () => {
    const onNavigate = vi.fn();
    const onRefresh = vi.fn();
    const onFilterError = vi.fn();

    render(
      <MissionControlTopStrip
        metrics={{
          tableCount: 3,
          dataSize: '1.2 MB',
          totalRows: 5000,
          formattedTotalRows: '5,000',
          totalQueries: 10,
          avgLatencyMs: 25,
          formattedAvgLatency: '25.0ms',
          successRatePct: 90,
          errorCount: 1,
          qualityIssues: { missingPkCount: 1 },
          latencyDistribution: { slowCount: 1 },
        } as any}
        tables={[{ name: 'orders', rowCount: 5000, size: '1.2 MB', type: 'table' } as any]}
        onNavigate={onNavigate}
        onRefresh={onRefresh}
        onFilterErrorQueries={onFilterError}
      />
    );

    // Header identity
    expect(screen.getByText(/DuckDB Studio/i)).toBeTruthy();

    // Primary CTA
    const primaryCta = screen.getByText(/新建查询|继续编辑/i);
    expect(primaryCta).toBeTruthy();
    fireEvent.click(primaryCta);
    expect(onNavigate).toHaveBeenCalledWith(Tab.SQL);

    // Refresh action
    const refreshBtn = screen.getByRole('button', { name: /刷新/i });
    fireEvent.click(refreshBtn);
    expect(onRefresh).toHaveBeenCalled();

    // Diagnostic pills
    const errorPill = screen.getByText(/1 条查询失败/i);
    expect(errorPill).toBeTruthy();
    fireEvent.click(errorPill);
    expect(onFilterError).toHaveBeenCalled();
  });

  it('renders MissionControlKpis with 6 metric cards and watermarks', () => {
    const onNavigate = vi.fn();
    render(
      <MissionControlKpis
        metrics={{
          tableCount: 4,
          dataSize: '2.5 MB',
          totalRows: 10000,
          formattedTotalRows: '10,000',
          totalQueries: 42,
          avgLatencyMs: 12,
          formattedAvgLatency: '12.0ms',
          successRatePct: 100,
          errorCount: 0,
          activeSessions: 1,
          memoryUsageFormatted: '18.4 MiB',
          memoryPercentage: 15,
          memoryPercentageDisplay: '15%',
          memoryTotalGb: 4,
        } as any}
        tables={[]}
        allHistoryItems={[]}
        onNavigate={onNavigate}
      />
    );

    expect(screen.getByText('数据表')).toBeTruthy();
    expect(screen.getByText('总行数')).toBeTruthy();
    expect(screen.getByText('查询次数')).toBeTruthy();
    expect(screen.getByText('平均查询时间')).toBeTruthy();
    expect(screen.getByText('活跃会话')).toBeTruthy();
    expect(screen.getByText('内存使用')).toBeTruthy();
    expect(screen.getByText('10,000')).toBeTruthy();
  });

  it('renders full DataIdeMissionControl with grid background and 3-column split', () => {
    const onNavigate = vi.fn();
    const onOpenImport = vi.fn();
    const onOpenCreate = vi.fn();

    const { container } = render(
      <DataIdeMissionControl
        metrics={{
          tableCount: 1,
          dataSize: '100 KB',
          totalRows: 200,
          formattedTotalRows: '200',
          totalQueries: 5,
          avgLatencyMs: 8,
          formattedAvgLatency: '8.0ms',
          successRatePct: 100,
          errorCount: 0,
        } as any}
        tables={[{ name: 'users', rowCount: 200, size: '100 KB', type: 'table' } as any]}
        queries={[]}
        onNavigate={onNavigate}
        onOpenImport={onOpenImport}
        onOpenCreate={onOpenCreate}
        onOpenSettings={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    // Global background pattern
    expect(container.querySelector('pattern#cyber-grid-pattern')).toBeTruthy();

    // Key components are present
    expect(screen.getByText(/DuckDB Studio/i)).toBeTruthy();
    expect(screen.getByText('数据资产概览')).toBeTruthy();
    expect(screen.getByText('最近查询动态')).toBeTruthy();
    expect(screen.getByText('快捷操作')).toBeTruthy();
  });
});
