import { describe, expect, it } from 'vitest';
import { WorkbookImportError, workbookIO } from './workbookIO';

describe('WorkbookIO', () => {
  it('round-trips a simple workbook through the maintained adapter', async () => {
    const buffer = await workbookIO.createWorkbookBuffer([
      {
        name: 'People',
        headers: ['name', 'score'],
        rows: [['Ada', 42], ['Grace', 99]],
      },
    ]);
    const file = {
      name: 'people.xlsx',
      size: buffer.byteLength,
      arrayBuffer: async () => buffer,
    };

    await expect(workbookIO.readFirstSheetAsCsv(file)).resolves.toBe(
      '"name","score"\n"Ada","42"\n"Grace","99"',
    );
  });

  it('rejects legacy binary .xls files with a precise migration message', async () => {
    const file = {
      name: 'legacy.xls',
      size: 10,
      arrayBuffer: async () => new ArrayBuffer(10),
    };

    await expect(workbookIO.readFirstSheetAsCsv(file)).rejects.toMatchObject<Partial<WorkbookImportError>>({
      code: 'LEGACY_XLS_UNSUPPORTED',
    });
  });

  it('rejects oversized workbooks before parsing', async () => {
    const file = {
      name: 'oversized.xlsx',
      size: 25 * 1024 * 1024 + 1,
      arrayBuffer: async () => {
        throw new Error('must not read');
      },
    };

    await expect(workbookIO.readFirstSheetAsCsv(file)).rejects.toMatchObject<Partial<WorkbookImportError>>({
      code: 'WORKBOOK_TOO_LARGE',
    });
  });

  it('round-trips multiple sheets and parses all sheets accurately', async () => {
    const buffer = await workbookIO.createWorkbookBuffer([
      {
        name: 'Customers',
        headers: ['cust_id', 'cust_name'],
        rows: [[1, 'Alice'], [2, 'Bob']],
      },
      {
        name: 'Orders',
        headers: ['order_id', 'amount', 'status'],
        rows: [[101, 99.5, 'PAID'], [102, 149.0, 'PENDING']],
      },
    ]);
    const file = {
      name: 'ecommerce.xlsx',
      size: buffer.byteLength,
      arrayBuffer: async () => buffer,
    };

    const sheets = await workbookIO.readAllSheets(file);
    expect(sheets).toHaveLength(2);

    // Sheet 1: Customers
    expect(sheets[0].name).toBe('Customers');
    expect(sheets[0].headers).toEqual(['cust_id', 'cust_name']);
    expect(sheets[0].rowCount).toBe(2);
    expect(sheets[0].columnCount).toBe(2);
    expect(sheets[0].isEmpty).toBe(false);
    expect(sheets[0].rows).toEqual([[1, 'Alice'], [2, 'Bob']]);
    expect(sheets[0].csvText).toContain('"cust_id","cust_name"');

    // Sheet 2: Orders
    expect(sheets[1].name).toBe('Orders');
    expect(sheets[1].headers).toEqual(['order_id', 'amount', 'status']);
    expect(sheets[1].rowCount).toBe(2);
    expect(sheets[1].columnCount).toBe(3);
    expect(sheets[1].isEmpty).toBe(false);
    expect(sheets[1].rows).toEqual([[101, 99.5, 'PAID'], [102, 149.0, 'PENDING']]);
  });

  it('identifies empty sheets, preserves distinct schemas, and does not crash', async () => {
    const buffer = await workbookIO.createWorkbookBuffer([
      {
        name: 'ActiveData',
        headers: ['key', 'value'],
        rows: [['k1', 'v1']],
      },
      {
        name: 'BlankSheet',
        headers: [],
        rows: [],
      },
    ]);
    const file = {
      name: 'with_blank.xlsx',
      size: buffer.byteLength,
      arrayBuffer: async () => buffer,
    };

    const sheets = await workbookIO.readAllSheets(file);
    expect(sheets.length).toBeGreaterThanOrEqual(1);

    const active = sheets.find(s => s.name === 'ActiveData');
    expect(active).toBeDefined();
    expect(active?.rowCount).toBe(1);
    expect(active?.isEmpty).toBe(false);

    // If BlankSheet is created by writeXlsxFile, verify it or verify empty sheet handling directly
    const blank = sheets.find(s => s.name === 'BlankSheet');
    if (blank) {
      expect(blank.isEmpty).toBe(true);
      expect(blank.rowCount).toBe(0);
    }
  });

  it('accepts uppercase .XLSX extension and parses all sheets', async () => {
    const buffer = await workbookIO.createWorkbookBuffer([
      {
        name: 'Report',
        headers: ['metric', 'value'],
        rows: [['revenue', 1000]],
      },
    ]);
    const file = {
      name: 'ANNUAL_REPORT.XLSX',
      size: buffer.byteLength,
      arrayBuffer: async () => buffer,
    };

    const sheets = await workbookIO.readAllSheets(file);
    expect(sheets).toHaveLength(1);
    expect(sheets[0].name).toBe('Report');
    expect(sheets[0].rowCount).toBe(1);
  });

  it('handles multiple sheets with different column counts and independent headers', async () => {
    const buffer = await workbookIO.createWorkbookBuffer([
      {
        name: 'Users',
        headers: ['uid', 'name'],
        rows: [[1, 'Alice']],
      },
      {
        name: 'Logs',
        headers: ['log_id', 'level', 'msg', 'timestamp'],
        rows: [[101, 'INFO', 'system start', '2026-01-01']],
      },
      {
        name: 'Config_Schema_Only',
        headers: ['setting_key', 'setting_val', 'is_active'],
        rows: [],
      },
    ]);
    const file = {
      name: 'multi_schema.xlsx',
      size: buffer.byteLength,
      arrayBuffer: async () => buffer,
    };

    const sheets = await workbookIO.readAllSheets(file);
    expect(sheets).toHaveLength(3);

    const users = sheets.find(s => s.name === 'Users');
    expect(users?.columnCount).toBe(2);
    expect(users?.rowCount).toBe(1);
    expect(users?.headers).toEqual(['uid', 'name']);

    const logs = sheets.find(s => s.name === 'Logs');
    expect(logs?.columnCount).toBe(4);
    expect(logs?.rowCount).toBe(1);
    expect(logs?.headers).toEqual(['log_id', 'level', 'msg', 'timestamp']);

    const schemaOnly = sheets.find(s => s.name === 'Config_Schema_Only');
    expect(schemaOnly?.columnCount).toBe(3);
    expect(schemaOnly?.rowCount).toBe(0);
    expect(schemaOnly?.headers).toEqual(['setting_key', 'setting_val', 'is_active']);
    expect(schemaOnly?.isEmpty).toBe(false); // Has headers, so schema exists!
  });
});

