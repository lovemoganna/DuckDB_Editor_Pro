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
    expect(screen.getByText(/内存: 2\.1 GB/)).toBeInTheDocument();

    // Status badge
    expect(screen.getByText('运行正常')).toBeInTheDocument();

    // Refresh button still works
    const refreshBtn = screen.getByTitle('刷新运行时状态');
    expect(refreshBtn).toBeInTheDocument();
    fireEvent.click(refreshBtn);
    expect(onRefresh).toHaveBeenCalled();
  });
});
