// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImportWizard } from './ImportWizard';

afterEach(cleanup);

describe('ImportWizard Studio UI/UX & Lifecycle tests', () => {
  it('renders two-column studio with header, sources, parse options, target table, conflict strategies, and preview', () => {
    render(
      <ImportWizard
        isOpen={true}
        onClose={vi.fn()}
        onImportComplete={vi.fn()}
        onRefreshTables={vi.fn()}
      />
    );

    // Header elements
    expect(screen.getByText('DuckDB')).toBeTruthy();
    expect(screen.getByText('数据导入')).toBeTruthy();
    expect(screen.getByText('Import Data')).toBeTruthy();
    expect(screen.getByText('使用帮助')).toBeTruthy();

    // 1. Source tabs
    expect(screen.getByText('本地文件')).toBeTruthy();
    expect(screen.getByText('远程 URL')).toBeTruthy();
    expect(screen.getByText('粘贴文本')).toBeTruthy();

    // 2. Parse options
    expect(screen.getByText('2. 文件解析设置')).toBeTruthy();
    expect(screen.getAllByText('CSV').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('TSV').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('JSON').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Parquet')).toBeTruthy();
    expect(screen.getByText('Excel (.xlsx)')).toBeTruthy();
    expect(screen.getByText('分隔符')).toBeTruthy();
    expect(screen.getByText('引号')).toBeTruthy();
    expect(screen.getByText('首行是否表头')).toBeTruthy();
    expect(screen.getAllByText('编码').length).toBeGreaterThanOrEqual(1);

    // 3. Target table
    expect(screen.getByText('3. 目标表设置')).toBeTruthy();
    expect(screen.getByText('Schema')).toBeTruthy();
    expect(screen.getByText(/表名/)).toBeTruthy();

    // 4. Conflict strategies
    expect(screen.getByText('覆盖替换')).toBeTruthy();
    expect(screen.getByText('Drop & Replace')).toBeTruthy();
    expect(screen.getByText('追加行数据')).toBeTruthy();
    expect(screen.getByText('Append Rows')).toBeTruthy();
    expect(screen.getByText('存在即报错')).toBeTruthy();
    expect(screen.getByText('Fail If Exists')).toBeTruthy();

    // 5. Right panel: preview & schema mapping
    expect(screen.getByText('5. 数据预览')).toBeTruthy();
    expect(screen.getByText('文件信息与识别结果')).toBeTruthy();
    expect(screen.getByText('字段映射与类型推断')).toBeTruthy();
    expect(screen.getAllByText(/数据预览/).length).toBeGreaterThanOrEqual(1);

    // Footer actions
    expect(screen.getByText('取消')).toBeTruthy();
    expect(screen.getByText(/开始导入 Import/)).toBeTruthy();
  });

  it('switches between URL mode, presets, and Paste text mode', () => {
    render(
      <ImportWizard
        isOpen={true}
        onClose={vi.fn()}
        onImportComplete={vi.fn()}
        onRefreshTables={vi.fn()}
      />
    );

    // Switch to URL tab
    const urlTab = screen.getByRole('button', { name: /远程 URL/i });
    fireEvent.click(urlTab);

    // Preset datasets visible
    expect(screen.getByText(/常用公开测试数据集预设/i)).toBeTruthy();
    expect(screen.getByText(/Titanic 生存者数据集/i)).toBeTruthy();

    // Click Titanic preset
    fireEvent.click(screen.getByText(/Titanic 生存者数据集/i));

    // Target table set to titanic
    const tableInput = screen.getByPlaceholderText(/raw_events_imported/i) as HTMLInputElement;
    expect(tableInput.value).toBe('titanic');

    // Switch to Paste text mode
    const pasteTab = screen.getByRole('button', { name: /粘贴文本/i });
    fireEvent.click(pasteTab);

    expect(screen.getByPlaceholderText(/在此直接粘贴 CSV 或 TSV 文本/i)).toBeTruthy();
    expect(screen.getByText(/填入示例数据/i)).toBeTruthy();

    // Click sample data
    fireEvent.click(screen.getByText(/填入示例数据/i));
    expect(tableInput.value).toBe('raw_events_imported');
  });

  it('allows toggling conflict strategies and format pills', () => {
    render(
      <ImportWizard
        isOpen={true}
        onClose={vi.fn()}
        onImportComplete={vi.fn()}
        onRefreshTables={vi.fn()}
      />
    );

    // Click Append Rows conflict strategy
    const appendCard = screen.getByText('追加行数据').closest('button');
    expect(appendCard).toBeTruthy();
    fireEvent.click(appendCard!);

    // Click Fail If Exists conflict strategy
    const failCard = screen.getByText('存在即报错').closest('button');
    expect(failCard).toBeTruthy();
    fireEvent.click(failCard!);

    // Toggle format pill: Parquet
    const parquetBtn = screen.getByRole('button', { name: /^Parquet$/i });
    fireEvent.click(parquetBtn);
  });

  it('renders multi-sheet Excel studio with sheet tabs, empty/hidden badges, and batch import button', async () => {
    const { dataImportService } = await import('../services/dataImportService');
    const sniffSpy = vi.spyOn(dataImportService, 'sniffSource').mockResolvedValue({
      fileName: 'multisheet_sample.xlsx',
      format: 'Excel',
      fileSize: 4096,
      formattedSize: '4.0 KB',
      rowCount: 18,
      activeSheetName: 'Orders',
      sheets: [
        {
          name: 'Orders',
          rowCount: 10,
          columns: [{ sourceName: 'id', targetName: 'id', inferredType: 'INTEGER', nullable: false, sampleValue: '1' }],
          previewRows: [{ id: 1 }],
          selected: true,
          targetTableName: 'multisheet_orders',
          isEmpty: false,
          isHidden: false,
        },
        {
          name: 'Returns',
          rowCount: 5,
          columns: [{ sourceName: 'ret_id', targetName: 'ret_id', inferredType: 'VARCHAR', nullable: true, sampleValue: 'R1' }],
          previewRows: [{ ret_id: 'R1' }],
          selected: true,
          targetTableName: 'multisheet_returns',
          isEmpty: false,
          isHidden: false,
        },
        {
          name: 'BlankNotes',
          rowCount: 0,
          columns: [],
          previewRows: [],
          selected: false,
          targetTableName: 'multisheet_blanknotes',
          isEmpty: true,
          isHidden: false,
        },
        {
          name: 'HiddenConfig',
          rowCount: 3,
          columns: [{ sourceName: 'k', targetName: 'k', inferredType: 'VARCHAR', nullable: false, sampleValue: 'v' }],
          previewRows: [{ k: 'v' }],
          selected: true,
          targetTableName: 'multisheet_hiddenconfig',
          isEmpty: false,
          isHidden: true,
        },
      ],
      columns: [{ sourceName: 'id', targetName: 'id', inferredType: 'INTEGER', nullable: false, sampleValue: '1' }],
      previewRows: [{ id: 1 }],
    });

    const file = new File(['dummy xlsx content'], 'multisheet_sample.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    render(
      <ImportWizard
        isOpen={true}
        onClose={vi.fn()}
        onImportComplete={vi.fn()}
        onRefreshTables={vi.fn()}
      />
    );

    // Simulate selecting file
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Wait for sniffSource resolving and UI updating
    const sheetSection = await screen.findByText('工作表列表 (Sheets)');
    expect(sheetSection).toBeTruthy();

    // Check sheets and tags
    expect(screen.getByText('Orders')).toBeTruthy();
    expect(screen.getByText('Returns')).toBeTruthy();
    expect(screen.getByText('BlankNotes')).toBeTruthy();
    expect(screen.getByText('HiddenConfig')).toBeTruthy();
    expect(screen.getByText('空工作表')).toBeTruthy();
    expect(screen.getByText('隐藏表')).toBeTruthy();

    // Batch button reflects selected sheet count (3 out of 4)
    expect(screen.getByText('批量导入选中的 3 个工作表')).toBeTruthy();

    // Verify 仅选非空表 button exists
    const nonEmptyOnlyBtn = screen.getByText('仅选非空表');
    expect(nonEmptyOnlyBtn).toBeTruthy();
    fireEvent.click(nonEmptyOnlyBtn);

    // Click Returns sheet tab to switch active sheet
    const returnsSpan = screen.getByText('Returns');
    const returnsTab = returnsSpan.closest('div');
    expect(returnsTab).toBeTruthy();
    fireEvent.click(returnsTab!);

    // Check active tab or target name drawer
    const drawerBtn = screen.getByText(/各工作表目标表名映射/);
    expect(drawerBtn).toBeTruthy();
    fireEvent.click(drawerBtn);

    expect(screen.getByDisplayValue('multisheet_orders')).toBeTruthy();
    expect(screen.getByDisplayValue('multisheet_returns')).toBeTruthy();

    sniffSpy.mockRestore();
  });

  it('triggers batch import pipeline and passes createdTables to onImportComplete', async () => {
    const { dataImportService } = await import('../services/dataImportService');
    const sniffSpy = vi.spyOn(dataImportService, 'sniffSource').mockResolvedValue({
      fileName: 'excel_data.xlsx',
      format: 'Excel',
      fileSize: 2048,
      formattedSize: '2.0 KB',
      rowCount: 5,
      activeSheetName: 'SheetA',
      sheets: [
        {
          name: 'SheetA',
          rowCount: 5,
          columns: [{ sourceName: 'col1', targetName: 'col1', inferredType: 'VARCHAR', nullable: false, sampleValue: 'v1' }],
          previewRows: [{ col1: 'v1' }],
          selected: true,
          targetTableName: 'imported_sheeta',
          rawSqlSource: "read_csv_auto('sheet_a.csv')",
          isEmpty: false,
          isHidden: false,
        },
      ],
      columns: [{ sourceName: 'col1', targetName: 'col1', inferredType: 'VARCHAR', nullable: false, sampleValue: 'v1' }],
      previewRows: [{ col1: 'v1' }],
    });

    const batchSpy = vi.spyOn(dataImportService, 'executeBatchImport').mockResolvedValue({
      results: [{ schema: 'main', tableName: 'imported_sheeta', rowCount: 5, columnsCount: 1, verified: true, durationMs: 5, sampleRows: [] }],
      totalRows: 5,
      createdTables: ['imported_sheeta'],
    });

    const onImportCompleteMock = vi.fn();
    const onRefreshTablesMock = vi.fn().mockResolvedValue(undefined);

    const file = new File(['content'], 'excel_data.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    render(
      <ImportWizard
        isOpen={true}
        onClose={vi.fn()}
        onImportComplete={onImportCompleteMock}
        onRefreshTables={onRefreshTablesMock}
      />
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    const importBtn = await screen.findByRole('button', { name: /开始导入 Import/i });
    expect(importBtn).toBeTruthy();
    fireEvent.click(importBtn);

    await vi.waitFor(() => {
      expect(batchSpy).toHaveBeenCalled();
      expect(onImportCompleteMock).toHaveBeenCalledWith(['imported_sheeta']);
    });

    sniffSpy.mockRestore();
    batchSpy.mockRestore();
  });

  it('supports snake_case batch transformation for column mapping', async () => {
    const { dataImportService } = await import('../services/dataImportService');
    const sniffSpy = vi.spyOn(dataImportService, 'sniffSource').mockResolvedValue({
      fileName: 'users.csv',
      format: 'CSV',
      fileSize: 1024,
      formattedSize: '1.0 KB',
      rowCount: 3,
      columns: [
        { sourceName: 'User ID', targetName: 'User ID', inferredType: 'INTEGER', nullable: false, sampleValue: '1' },
        { sourceName: 'First Name', targetName: 'First Name', inferredType: 'VARCHAR', nullable: true, sampleValue: 'John' },
      ],
      previewRows: [{ 'User ID': 1, 'First Name': 'John' }],
    });

    const file = new File(['content'], 'users.csv', { type: 'text/csv' });

    render(
      <ImportWizard
        isOpen={true}
        onClose={vi.fn()}
        onImportComplete={vi.fn()}
        onRefreshTables={vi.fn()}
      />
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    await screen.findByDisplayValue('User ID');

    // Click 转蛇形 button
    const snakeCaseBtn = screen.getByRole('button', { name: /转蛇形/i });
    expect(snakeCaseBtn).toBeTruthy();
    fireEvent.click(snakeCaseBtn);

    expect(screen.getByDisplayValue('user_id')).toBeTruthy();
    expect(screen.getByDisplayValue('first_name')).toBeTruthy();

    sniffSpy.mockRestore();
  });
});

