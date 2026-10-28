// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImportWizard } from './ImportWizard';

afterEach(cleanup);

describe('ImportWizard Studio UI/UX & Lifecycle tests', () => {
  it('names the import dialog, traps keyboard focus and restores the trigger', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger); trigger.focus();
    const close = vi.fn();
    const view = render(<ImportWizard isOpen onClose={close} onImportComplete={vi.fn()} onRefreshTables={vi.fn()} />);
    const dialog = screen.getByRole('dialog', {name: '数据导入'});
    expect(dialog.contains(document.activeElement)).toBe(true);
    const last = screen.getByRole('button', {name: '取消'});
    last.focus(); fireEvent.keyDown(last, {key: 'Tab'});
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document.activeElement!, {key: 'Escape'});
    expect(close).toHaveBeenCalledOnce();
    view.unmount(); expect(document.activeElement).toBe(trigger); trigger.remove();
  });

  it('keeps the latest file preview when an older request finishes last', async () => {
    const { dataImportService } = await import('../services/dataImportService');
    let finishOld!: (value: any) => void;
    const old = new Promise<any>(resolve => { finishOld = resolve; });
    const metadata = (name: string) => ({fileName:name,format:'CSV',fileSizeBytes:1,formattedSize:'1 B',rowCount:1,columnCount:1,
      encoding:'UTF-8',hasHeader:true,columns:[{index:1,sourceName:name,targetName:name,inferredType:'VARCHAR',nullable:true,sampleValue:'value'}],
      previewRows:[{[name]:'value'}],rawSqlSource:'SELECT 1'});
    const sniff = vi.spyOn(dataImportService, 'sniffSource').mockReturnValueOnce(old).mockResolvedValue(metadata('new.csv') as any);
    try {
      render(<ImportWizard isOpen onClose={vi.fn()} onImportComplete={vi.fn()} onRefreshTables={vi.fn()} />);
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, {target:{files:[new File(['old'], 'old.csv')]}});
      await vi.waitFor(() => expect(sniff).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getByTitle('移除文件'));
      const nextInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(nextInput, {target:{files:[new File(['new'], 'new.csv')]}});
      await screen.findByDisplayValue('new.csv');
      await act(async () => { finishOld(metadata('old.csv')); await old; });
      expect(screen.queryByDisplayValue('old.csv')).toBeNull();
      expect(screen.getByDisplayValue('new.csv')).toBeTruthy();
      expect(sniff).toHaveBeenCalledTimes(2);
    } finally { sniff.mockRestore(); }
  });

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

  it('supports uploading .duckdb files with multi-table preview and mount button', async () => {
    const { dataImportService } = await import('../services/dataImportService');
    const sniffSpy = vi.spyOn(dataImportService, 'sniffSource').mockResolvedValue({
      fileName: 'warehouse.duckdb',
      format: 'DuckDB',
      fileSizeBytes: 4096,
      formattedSize: '4.0 KB',
      rowCount: 50,
      columns: [
        { index: 1, sourceName: 'product_id', targetName: 'product_id', inferredType: 'INTEGER', nullable: false, sampleValue: '101' },
        { index: 2, sourceName: 'product_name', targetName: 'product_name', inferredType: 'VARCHAR', nullable: true, sampleValue: 'Widget' },
      ],
      previewRows: [{ product_id: 101, product_name: 'Widget' }],
      sheets: [
        {
          name: 'products',
          targetTableName: 'warehouse_products',
          rowCount: 50,
          columnCount: 2,
          columns: [
            { index: 1, sourceName: 'product_id', targetName: 'product_id', inferredType: 'INTEGER', nullable: false, sampleValue: '101' },
            { index: 2, sourceName: 'product_name', targetName: 'product_name', inferredType: 'VARCHAR', nullable: true, sampleValue: 'Widget' },
          ],
          previewRows: [{ product_id: 101, product_name: 'Widget' }],
          rawSqlSource: '"_import_db"."main"."products"',
          isEmpty: false,
          selected: true,
        },
      ],
      activeSheetName: 'products',
      rawSqlSource: '"_import_db"."main"."products"',
    });

    const header = new Uint8Array(32);
    header[8] = 68; header[9] = 85; header[10] = 67; header[11] = 75;
    const file = new File([header], 'warehouse.duckdb', { type: 'application/octet-stream' });

    render(
      <ImportWizard
        isOpen={true}
        onClose={vi.fn()}
        onImportComplete={vi.fn()}
        onRefreshTables={vi.fn()}
      />
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput.accept).toContain('.duckdb');

    fireEvent.change(fileInput, { target: { files: [file] } });

    await screen.findAllByText('warehouse.duckdb');
    expect(screen.getByText(/挂载为独立库 \(ATTACH\)/i)).toBeTruthy();
    expect(screen.getByText('products')).toBeTruthy();

    sniffSpy.mockRestore();
  });

  it('fetches existing tables and allows selecting a table from dropdown picker', async () => {
    const { duckDBService } = await import('../services/duckdbService');
    const getTableListSpy = vi.spyOn(duckDBService, 'getTableList').mockResolvedValue(['users', 'orders', 'transactions']);

    render(
      <ImportWizard
        isOpen={true}
        onClose={vi.fn()}
        onImportComplete={vi.fn()}
        onRefreshTables={vi.fn()}
      />
    );

    // Wait for table list fetch
    await vi.waitFor(() => expect(getTableListSpy).toHaveBeenCalled());

    // Table picker button should be present with table count
    const pickerBtn = await screen.findByRole('button', { name: /从已有表中选择 \(3\)/i });
    expect(pickerBtn).toBeTruthy();

    // Datalist should contain the existing tables
    const datalist = document.getElementById('target-existing-tables-list');
    expect(datalist).toBeTruthy();
    const options = datalist?.querySelectorAll('option');
    expect(options?.length).toBe(3);

    // Open table picker dropdown
    fireEvent.click(pickerBtn);
    expect(screen.getByText(/Schema "main" 中的已有表/)).toBeTruthy();

    // Click on 'orders' table in the picker
    const ordersItem = screen.getByRole('button', { name: /orders/i });
    fireEvent.click(ordersItem);

    // Input should be updated to 'orders'
    const tableInput = screen.getByPlaceholderText(/raw_events_imported/i) as HTMLInputElement;
    expect(tableInput.value).toBe('orders');

    // Should display existing table indicator badge
    expect(screen.getByText('已有同名表')).toBeTruthy();

    getTableListSpy.mockRestore();
  });

  it('supports filtering sheets with sheet search and clicking sheet in mapping drawer to switch preview', async () => {
    const { dataImportService } = await import('../services/dataImportService');
    const sniffSpy = vi.spyOn(dataImportService, 'sniffSource').mockResolvedValue({
      fileName: 'multisheet_search.xlsx',
      format: 'Excel',
      fileSize: 4096,
      formattedSize: '4.0 KB',
      rowCount: 40,
      activeSheetName: 'AlphaSheet',
      sheets: [
        {
          name: 'AlphaSheet',
          rowCount: 10,
          columns: [{ sourceName: 'col_a', targetName: 'col_a', inferredType: 'VARCHAR', nullable: true, sampleValue: 'a' }],
          previewRows: [{ col_a: 'a' }],
          selected: true,
          targetTableName: 'alpha_table',
          isEmpty: false,
          isHidden: false,
        },
        {
          name: 'BetaSheet',
          rowCount: 20,
          columns: [{ sourceName: 'col_b', targetName: 'col_b', inferredType: 'INTEGER', nullable: false, sampleValue: '1' }],
          previewRows: [{ col_b: 1 }],
          selected: true,
          targetTableName: 'beta_table',
          isEmpty: false,
          isHidden: false,
        },
        {
          name: 'GammaSheet',
          rowCount: 5,
          columns: [{ sourceName: 'col_g', targetName: 'col_g', inferredType: 'VARCHAR', nullable: true, sampleValue: 'g' }],
          previewRows: [{ col_g: 'g' }],
          selected: true,
          targetTableName: 'gamma_table',
          isEmpty: false,
          isHidden: false,
        },
        {
          name: 'DeltaSheet',
          rowCount: 5,
          columns: [{ sourceName: 'col_d', targetName: 'col_d', inferredType: 'VARCHAR', nullable: true, sampleValue: 'd' }],
          previewRows: [{ col_d: 'd' }],
          selected: true,
          targetTableName: 'delta_table',
          isEmpty: false,
          isHidden: false,
        },
      ],
      columns: [{ sourceName: 'col_a', targetName: 'col_a', inferredType: 'VARCHAR', nullable: true, sampleValue: 'a' }],
      previewRows: [{ col_a: 'a' }],
    });

    const file = new File(['dummy content'], 'multisheet_search.xlsx', {
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

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    await screen.findByText('AlphaSheet');
    expect(screen.getByText('BetaSheet')).toBeTruthy();

    // Open left drawer
    const drawerBtn = screen.getByText(/各工作表目标表名映射/);
    fireEvent.click(drawerBtn);

    // Click BetaSheet button in the drawer to switch active sheet preview
    const betaBtnInDrawer = screen.getByRole('button', { name: 'BetaSheet' });
    fireEvent.click(betaBtnInDrawer);

    // Active sheet should now be BetaSheet (which has col_b in preview and mapping table)
    const colBElements = await screen.findAllByText('col_b');
    expect(colBElements.length).toBeGreaterThanOrEqual(1);

    // Test sheet search filter
    const searchInput = screen.getByPlaceholderText('过滤工作表...');
    fireEvent.change(searchInput, { target: { value: 'Alpha' } });

    // In the sheet tabs, AlphaSheet should be present and BetaSheet filtered out
    expect(screen.getAllByText('AlphaSheet').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('20 行')).toBeNull(); // BetaSheet row count is 20, should be filtered out

    sniffSpy.mockRestore();
  });
});
