// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExportModal } from './ExportModal';

afterEach(cleanup);

describe('ExportModal (BRD index6 R1 & R2)', () => {
  it('renders 3 export modes and Export Manifest preview', () => {
    render(<ExportModal isOpen={true} onClose={vi.fn()} />);

    // 3 Modes
    expect(screen.getByText('DuckDB 完整 SQL 备份')).toBeTruthy();
    expect(screen.getByText('可移植数据库包（JSON 清单）')).toBeTruthy();
    expect(screen.getByText('仅 Schema（DDL）')).toBeTruthy();

    // Export Manifest
    expect(screen.getByText('导出清单')).toBeTruthy();
    expect(screen.getByText('memory')).toBeTruthy();
    expect(screen.getByText('SQL Dump')).toBeTruthy();
  });

  it('switches export modes and updates manifest format', () => {
    render(<ExportModal isOpen={true} onClose={vi.fn()} />);

    const jsonModeBtn = screen.getByText('可移植数据库包（JSON 清单）');
    fireEvent.click(jsonModeBtn);

    expect(screen.getByText('JSON 清单')).toBeTruthy();

    const sqlModeBtn = screen.getByText('仅 Schema（DDL）');
    fireEvent.click(sqlModeBtn);

    expect(screen.getByText('SQL DDL')).toBeTruthy();
  });
});
