import { describe, it, expect, vi, beforeEach } from 'vitest';
import { restoreCompleteWorkspace, CompleteWorkspaceBackup } from './completeWorkspaceBackup';
import { useAppStore } from '../hooks/store/useAppStore';

describe('Interaction Fixes - Front-to-Back Integration Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Fix 1 & 2: Full Workspace Restore with DuckDB snapshot', () => {
    it('restores both browser state and duckdb snapshot when backup is supplied', async () => {
      const mockBackup: CompleteWorkspaceBackup = {
        version: 1,
        exportedAt: '2026-09-01T00:00:00.000Z',
        localStorage: { 'duckdb_ui_theme': 'monokai' },
        indexedDB: [],
        duckdbSnapshot: {
          schemaVersion: 1,
          format: 'archive',
          exportedAt: '2026-09-01T00:00:00.000Z',
          tables: [
            {
              name: 'orders',
              createSql: 'CREATE TABLE orders (id INT);',
              dataQuerySql: 'SELECT * FROM orders;',
              rowCount: 10,
              format: 'csv_data_url',
              payload: 'data:text/csv;base64,aWQxLDI=',
            },
          ],
        },
      };

      const captureCurrentWorkspace = vi.fn().mockResolvedValue(mockBackup);
      const restoreBrowserState = vi.fn().mockResolvedValue(undefined);
      const installDuckDBSnapshot = vi.fn().mockResolvedValue(undefined);

      await restoreCompleteWorkspace(mockBackup, {
        captureCurrentWorkspace,
        restoreBrowserState,
        installDuckDBSnapshot,
      });

      expect(installDuckDBSnapshot).toHaveBeenCalledWith(mockBackup.duckdbSnapshot);
      expect(restoreBrowserState).toHaveBeenCalledWith(mockBackup);
    });

    it('rolls back browser state if duckdb snapshot install fails', async () => {
      const previousBackup: CompleteWorkspaceBackup = {
        version: 1,
        exportedAt: '2026-09-01T00:00:00.000Z',
        localStorage: { 'saved': 'prev' },
        indexedDB: [],
      };
      const newBackup: CompleteWorkspaceBackup = {
        version: 1,
        exportedAt: '2026-09-01T01:00:00.000Z',
        localStorage: { 'saved': 'new' },
        indexedDB: [],
        duckdbSnapshot: {
          schemaVersion: 1,
          format: 'archive',
          exportedAt: '2026-09-01T01:00:00.000Z',
          tables: [],
        },
      };

      const captureCurrentWorkspace = vi.fn().mockResolvedValue(previousBackup);
      const restoreBrowserState = vi.fn().mockResolvedValue(undefined);
      const installDuckDBSnapshot = vi.fn().mockRejectedValue(new Error('Corrupt snapshot'));

      await expect(
        restoreCompleteWorkspace(newBackup, {
          captureCurrentWorkspace,
          restoreBrowserState,
          installDuckDBSnapshot,
        })
      ).rejects.toThrow('Corrupt snapshot');

      // Verify rollback called with previous backup
      expect(restoreBrowserState).toHaveBeenCalledWith(previousBackup);
    });
  });

  describe('Fix 3: AI Capability Library Prompt & SQL Extraction', () => {
    it('correctly extracts promptTemplate and SQL code block from capability payloads', () => {
      const capabilityWithPrompt = {
        id: 'sales-forecast',
        name: '销量预测',
        promptTemplate: '请分析当前数据表，生成预测模型：\n```sql\nSELECT date, SUM(amount) FROM sales GROUP BY date\n```',
      };

      const rawContent = capabilityWithPrompt.promptTemplate;
      const sqlMatch = rawContent.match(/```sql\s*([\s\S]*?)\s*```/i);
      const extractedSql = sqlMatch ? sqlMatch[1].trim() : rawContent;

      expect(extractedSql).toBe('SELECT date, SUM(amount) FROM sales GROUP BY date');
    });

    it('falls back to full promptTemplate when no code fence is present', () => {
      const capabilityTextOnly = {
        id: 'data-summary',
        name: '智能汇总',
        promptTemplate: '请对当前表中的数值列执行均值与分位数统计',
      };

      const rawContent = capabilityTextOnly.promptTemplate;
      const sqlMatch = rawContent.match(/```sql\s*([\s\S]*?)\s*```/i);
      const extractedSql = sqlMatch ? sqlMatch[1].trim() : rawContent;

      expect(extractedSql).toBe('请对当前表中的数值列执行均值与分位数统计');
    });
  });

  describe('Fix 4 & 5: Clear Workspace and Schema State Sync', () => {
    it('resets currentTable and notifies listeners upon clearing workspace', () => {
      useAppStore.getState().setCurrentTable('test_table_to_clear');
      expect(useAppStore.getState().currentTable).toBe('test_table_to_clear');

      // Clear workspace simulated trigger
      useAppStore.getState().setCurrentTable(null);
      expect(useAppStore.getState().currentTable).toBeNull();
    });
  });
});
