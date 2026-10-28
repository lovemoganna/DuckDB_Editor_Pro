// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DataAssetTopologyView } from './DataAssetTopologyView';
import type { TableDetail } from '../../../types';

describe('DataAssetTopologyView', () => {
  const sampleTables: TableDetail[] = [
    {
      name: 'orders',
      schema: 'main',
      rowCount: 50000,
      formattedRowCount: '50,000',
      sizeBytes: 1048576,
      formattedSize: '1.0 MB',
      updatedAt: '2026-09-27',
      type: 'table',
      columnCount: 10,
      hasPrimaryKey: true,
    },
    {
      name: 'customers',
      schema: 'main',
      rowCount: 12000,
      formattedRowCount: '12,000',
      sizeBytes: 524288,
      formattedSize: '512 KB',
      updatedAt: '2026-09-27',
      type: 'table',
      columnCount: 6,
      hasPrimaryKey: true,
    },
    {
      name: 'v_order_summary',
      schema: 'main',
      rowCount: 1000,
      formattedRowCount: '1,000',
      sizeBytes: 0,
      formattedSize: '—',
      updatedAt: '2026-09-27',
      type: 'view',
      columnCount: 4,
      hasPrimaryKey: false,
    },
  ];

  it('defaults to dataset list view', () => {
    render(<DataAssetTopologyView tables={sampleTables} onSelectTable={() => {}} />);
    expect(screen.getByText('表与视图')).toBeInTheDocument();
    expect(screen.getByText('orders')).toBeInTheDocument();
    expect(screen.getByText('近期数据导入与挂载记录')).toBeInTheDocument();
  });

  it('renders SVG connection curves with purely numeric path data on ER tab', () => {
    const { container } = render(
      <DataAssetTopologyView
        tables={sampleTables}
        onSelectTable={() => {}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^ER$/i }));

    const svg = container.querySelector('svg[viewBox="0 0 100 100"]');
    expect(svg).toBeInTheDocument();
    expect(svg?.getAttribute('preserveAspectRatio')).toBe('none');
    expect(svg?.classList.contains('pointer-events-none')).toBe(true);

    const paths = svg?.querySelectorAll('path') ?? [];
    expect(paths.length).toBeGreaterThan(0);

    paths.forEach((path) => {
      const d = path.getAttribute('d');
      expect(d).toBeTruthy();
      expect(d).not.toContain('%');
      expect(d).toMatch(/^M\s+[\d.-]+\s+[\d.-]+\s+Q\s+[\d.-]+\s+[\d.-]+,\s+[\d.-]+\s+[\d.-]+$/);
    });
  });
});
