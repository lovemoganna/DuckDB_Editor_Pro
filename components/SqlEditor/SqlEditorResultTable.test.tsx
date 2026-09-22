// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SqlEditorResultTable } from './SqlEditorResultTable';

afterEach(cleanup);

describe('SqlEditorResultTable controls', () => {
  it('owns one filter and one complete export entry', () => {
    render(
      <SqlEditorResultTable
        result={{ columns: ['id', 'name'], rows: [{ id: 1, name: 'Ada' }], executionTime: 12 }}
        filterTerm=""
        page={0}
        onFilterTermChange={vi.fn()}
        onPageChange={vi.fn()}
        onExportParquet={vi.fn()}
        onExportHtml={vi.fn()}
      />,
    );

    expect(screen.getAllByPlaceholderText(/筛选结果|Filter results/)).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /导出 \/ 复制/ })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /导出 \/ 复制/ }));
    for (const label of ['CSV (.csv)', 'JSON (.json)', 'Markdown (.md)', 'Excel (.xlsx)', 'Parquet (.parquet)', 'HTML Report (.html)', 'Copy TSV (Excel)', 'Copy Markdown', 'Copy HTML']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('renders data type headers and formats cells strictly based on DuckDB type metadata', () => {
    const mockResult = {
      columns: ['id', 'name', 'created_at', 'age'],
      columnTypes: ['BIGINT', 'VARCHAR', 'TIMESTAMP', 'INTEGER'],
      columnTypeMap: {
        id: 'BIGINT',
        name: 'VARCHAR',
        created_at: 'TIMESTAMP',
        age: 'INTEGER',
      },
      rows: [
        {
          id: 1001,
          name: '张三',
          created_at: '2026-08-29 22:53:09.808',
          age: 20,
        },
      ],
      executionTime: 5,
    };

    render(
      <SqlEditorResultTable
        result={mockResult}
        filterTerm=""
        page={0}
        onFilterTermChange={vi.fn()}
        onPageChange={vi.fn()}
      />
    );

    // Check headers with column types
    expect(screen.getByText('BIGINT')).toBeTruthy();
    expect(screen.getByText('VARCHAR')).toBeTruthy();
    expect(screen.getByText('TIMESTAMP')).toBeTruthy();
    expect(screen.getByText('INTEGER')).toBeTruthy();

    // Check formatted values: 1001 | 张三 | 2026-08-29 22:53:09.808 | 20
    expect(screen.getByText('1001')).toBeTruthy();
    expect(screen.getByText('张三')).toBeTruthy();
    expect(screen.getByText('2026-08-29 22:53:09.808')).toBeTruthy();
    expect(screen.getByText('20')).toBeTruthy();

    // Check that prohibited comma formatted values are absent
    expect(screen.queryByText('1,001')).toBeNull();
    expect(screen.queryByText('1,788,015,989,808')).toBeNull();
  });

  it('preserves raw BIGINT value even if column name is created_at without guessing timestamp', () => {
    const mockResult = {
      columns: ['id', 'created_at'],
      columnTypes: ['BIGINT', 'BIGINT'],
      columnTypeMap: {
        id: 'BIGINT',
        created_at: 'BIGINT',
      },
      rows: [
        {
          id: 1001,
          created_at: 1788015989808,
        },
      ],
      executionTime: 5,
    };

    render(
      <SqlEditorResultTable
        result={mockResult}
        filterTerm=""
        page={0}
        onFilterTermChange={vi.fn()}
        onPageChange={vi.fn()}
      />
    );

    // created_at is BIGINT -> should display 1788015989808, NOT converted to date or comma formatted
    expect(screen.getByText('1788015989808')).toBeTruthy();
    expect(screen.queryByText('1,788,015,989,808')).toBeNull();
  });
});
