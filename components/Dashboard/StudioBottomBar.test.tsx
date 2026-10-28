// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StudioBottomBar } from './StudioBottomBar';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('StudioBottomBar component', () => {
  it('renders system info bar and refresh button', () => {
    const onRefresh = vi.fn();
    const { container } = render(
      <StudioBottomBar
        onRefresh={onRefresh}
        queryStats={{ successCount: 128, errorCount: 3, canceledCount: 1 }}
      />,
    );

    // Version badge
    expect(container.textContent).toContain('DuckDB');

    // Memory / CPU info
    expect(screen.getByText('内存: 未采集')).toBeInTheDocument();
    expect(container.textContent).not.toContain('2.1 GB');

    // Status badge
    expect(screen.getByText('等待连接')).toBeInTheDocument();

    // Refresh button still works
    const refreshBtn = screen.getByTitle('刷新运行时状态');
    expect(refreshBtn).toBeInTheDocument();
    fireEvent.click(refreshBtn);
    expect(onRefresh).toHaveBeenCalled();
  });
  it('shows supplied runtime memory and engine readiness', () => {
    render(<StudioBottomBar runtimeInfo={{ ready: true, persistent: false, version: '1.33.1', currentDatabase: 'sales', memoryUsage: '12 MB / 512 MB' }} />);
    expect(screen.getByText('内存: 12 MB / 512 MB')).toBeInTheDocument();
    expect(screen.getByText('引擎就绪')).toBeInTheDocument();
    expect(screen.getByText('sales [WASM]')).toBeInTheDocument();
  });
});
