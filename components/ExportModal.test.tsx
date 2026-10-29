// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExportModal } from './ExportModal';

afterEach(cleanup);

describe('ExportModal (BRD index6 R1 & R2)', () => {
  it('renders all export modes including raw duckdb and Export Manifest preview', () => {
    render(<ExportModal isOpen={true} onClose={vi.fn()} />);

    // 4 Modes
    expect(screen.getByText('DuckDB 完整 SQL 备份')).toBeTruthy();
    expect(screen.getByText('便携数据库包 (.zip)')).toBeTruthy();
    expect(screen.getByText('原生 DuckDB 二进制文件')).toBeTruthy();
    expect(screen.getByText('仅 Schema（DDL）')).toBeTruthy();

    // Export Manifest
    expect(screen.getByText('导出清单')).toBeTruthy();
    expect(screen.getByText('memory')).toBeTruthy();
    expect(screen.getByText('SQL Dump')).toBeTruthy();
  });

  it('switches export modes and updates manifest format', () => {
    render(<ExportModal isOpen={true} onClose={vi.fn()} />);

    const zipModeBtn = screen.getByText('便携数据库包 (.zip)');
    fireEvent.click(zipModeBtn);
    expect(screen.getByText('ZIP 归档')).toBeTruthy();

    const rawModeBtn = screen.getByText('原生 DuckDB 二进制文件');
    fireEvent.click(rawModeBtn);
    expect(screen.getByText('DuckDB Binary')).toBeTruthy();

    const sqlModeBtn = screen.getByText('仅 Schema（DDL）');
    fireEvent.click(sqlModeBtn);
    expect(screen.getByText('SQL DDL')).toBeTruthy();
  });
});
