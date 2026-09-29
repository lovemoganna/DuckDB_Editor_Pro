// @vitest-environment jsdom
import React from 'react';
import { render } from '@testing-library/react';
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

  it('renders SVG connection curves with purely numeric path data (no percentage units)', () => {
    const { container } = render(
      <DataAssetTopologyView
        tables={sampleTables}
        onSelectTable={() => {}}
      />
    );

    const svg = container.querySelector('svg.pointer-events-none');
    expect(svg).toBeInTheDocument();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 100 100');
    expect(svg?.getAttribute('preserveAspectRatio')).toBe('none');

    const paths = svg?.querySelectorAll('path') ?? [];
    expect(paths.length).toBeGreaterThan(0);

    paths.forEach((path) => {
      const d = path.getAttribute('d');
      expect(d).toBeTruthy();
      // Ensure SVG path d does not contain '%' which triggers DOM parsing errors
      expect(d).not.toContain('%');
      // Should match valid SVG path syntax e.g. M 50 16 Q 50 16, 50 48
      expect(d).toMatch(/^M\s+[\d.-]+\s+[\d.-]+\s+Q\s+[\d.-]+\s+[\d.-]+,\s+[\d.-]+\s+[\d.-]+$/);
    });
  });
});
