// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import type { ChartConfig } from '../types';
import { DashboardWidget } from './DashboardWidget';

const mocks = vi.hoisted(() => ({
  getQueries: vi.fn(),
  query: vi.fn(),
}));

vi.mock('../services/dbService', () => ({ dbService: { getQueries: mocks.getQueries } }));
vi.mock('../services/duckdbService', () => ({ duckDBService: { query: mocks.query } }));
vi.mock('../services/presetWidgets', () => ({ PRESET_WIDGETS: [] }));
vi.mock('../services/toastService', () => ({ toastService: { info: vi.fn(), warning: vi.fn(), success: vi.fn(), error: vi.fn() } }));
vi.mock('../hooks/store/useSqlEditorStore', () => ({ useSqlEditorStore: { getState: () => ({ updateActiveTab: vi.fn() }) } }));
vi.mock('react-chartjs-2', () => ({
  Bar: ({ options }: { options: { plugins: { legend: { display: boolean } } } }) =>
    <output data-testid="chart-legend">{String(options.plugins.legend.display)}</output>,
  Line: () => <div />,
  Pie: () => <div />,
  Doughnut: () => <div />,
  Scatter: () => <div />,
}));

const config: ChartConfig = {
  id: 'saved-legend',
  title: 'Recorded legend setting',
  type: 'bar',
  xKey: 'category',
  yKeys: ['amount'],
  aggregation: 'sum',
  showLegend: false,
};

beforeEach(() => {
  mocks.getQueries.mockResolvedValue([{
    id: 'saved-query',
    name: 'Saved chart',
    sql: 'SELECT category, amount FROM t',
    charts: [config],
    widgetType: 'chart',
    createdAt: 1,
  }]);
  mocks.query.mockResolvedValue([{ category: 'A', amount: 10 }]);
});

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('Saved dashboard legend setting', () => {
  it('honors showLegend:false in card and fullscreen', async () => {
    render(<DashboardWidget savedQueryId="saved-query" refreshTrigger={0} onRemove={vi.fn()} />);
    expect((await screen.findAllByTestId('chart-legend'))[0]).toHaveTextContent('false');
    // Fullscreen uses the same renderChart path.
    const controls = screen.getAllByRole('button');
    const fullscreenButton = controls.find(button => button.getAttribute('title')?.includes('全屏'));
    if (!fullscreenButton) throw new Error('Expected dashboard fullscreen control');
    fireEvent.click(fullscreenButton);
    expect(screen.getAllByTestId('chart-legend')).toHaveLength(2);
    expect(screen.getAllByTestId('chart-legend')[1]).toHaveTextContent('false');
  });
});
