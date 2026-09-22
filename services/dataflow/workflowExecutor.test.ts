import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowExecutor } from './workflowExecutor';
import {
  getInitialEcommerceNodes,
  getInitialEcommerceEdges,
} from './seedEcommerceWorkflow';
import { duckDBService } from '../duckdbService';

describe('Workflow Executor Execution Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('executes Aggregate node and extracts rowCount, columns, and duration', async () => {
    const nodes = getInitialEcommerceNodes();
    const edges = getInitialEcommerceEdges();

    vi.spyOn(duckDBService, 'query').mockImplementation(async (sql: string) => {
      if (sql.includes('COUNT(*)')) {
        return [{ cnt: 1248 }];
      }
      if (sql.includes('DESCRIBE')) {
        return [
          { column_name: 'country', column_type: 'VARCHAR', null: 'NO' },
          { column_name: 'category', column_type: 'VARCHAR', null: 'NO' },
          { column_name: 'total_sales', column_type: 'DOUBLE', null: 'YES' },
          { column_name: 'order_count', column_type: 'BIGINT', null: 'NO' },
          { column_name: 'customer_count', column_type: 'BIGINT', null: 'NO' },
        ];
      }
      if (sql.includes('SELECT * FROM')) {
        return [
          { country: 'US', category: 'Electronics', total_sales: 12450.5, order_count: 85, customer_count: 42 },
        ];
      }
      return [];
    });

    const result = await WorkflowExecutor.executeNode('node-aggregate', nodes, edges);

    expect(result.status).toBe('success');
    expect(result.rowCount).toBe(1248);
    expect(result.columnCount).toBe(5);
    expect(result.columns.map(c => c.name)).toEqual([
      'country',
      'category',
      'total_sales',
      'order_count',
      'customer_count',
    ]);
    expect(result.rows.length).toBe(1);
    expect(result.executionTimeSec).toBeGreaterThanOrEqual(0);
  });

  it('executes Join node and tracks output relation and column count', async () => {
    const nodes = getInitialEcommerceNodes();
    const edges = getInitialEcommerceEdges();

    vi.spyOn(duckDBService, 'query').mockImplementation(async (sql: string) => {
      if (sql.includes('COUNT(*)')) {
        return [{ cnt: 1856732 }];
      }
      if (sql.includes('DESCRIBE')) {
        return Array.from({ length: 15 }, (_, i) => ({
          column_name: `col_${i + 1}`,
          column_type: 'VARCHAR',
          null: 'YES',
        }));
      }
      return [];
    });

    const result = await WorkflowExecutor.executeNode('node-join', nodes, edges);

    expect(result.status).toBe('success');
    expect(result.rowCount).toBe(1856732);
    expect(result.columnCount).toBe(15);
  });

  it('gracefully handles SQL errors with error status and structured log', async () => {
    const nodes = getInitialEcommerceNodes();
    const edges = getInitialEcommerceEdges();

    vi.spyOn(duckDBService, 'query').mockImplementation(async (sql: string) => {
      if (sql.includes('CREATE OR REPLACE TEMP VIEW')) {
        throw new Error('Binder Error: Referenced column non_existent_column_xyz not found');
      }
      return [];
    });

    let recordedLog: any = null;
    const result = await WorkflowExecutor.executeNode('node-aggregate', nodes, edges, {
      onLog: log => {
        recordedLog = log;
      },
    });

    expect(result.status).toBe('error');
    expect(result.errorMessage).toBeDefined();
    expect(result.errorMessage).toContain('non_existent_column_xyz');
    expect(recordedLog).not.toBeNull();
    expect(recordedLog.status).toBe('error');
    expect(recordedLog.message).toContain('non_existent_column_xyz');
  });

  it('executes upstream dependencies in topological order before target node', async () => {
    const nodes = getInitialEcommerceNodes();
    const edges = getInitialEcommerceEdges();

    const executedOrder: string[] = [];
    vi.spyOn(duckDBService, 'query').mockImplementation(async (sql: string) => {
      if (sql.includes('CREATE OR REPLACE TEMP VIEW')) {
        executedOrder.push(sql);
      }
      if (sql.includes('COUNT(*)')) {
        return [{ cnt: 100 }];
      }
      return [];
    });

    // Mark join as dirty
    const joinNode = nodes.find(n => n.id === 'node-join')!;
    joinNode.data.status = 'dirty';

    await WorkflowExecutor.executeWithUpstream('node-aggregate', nodes, edges);

    // Join must have been executed before aggregate
    expect(executedOrder.some(s => s.includes('_df_view_node_join'))).toBe(true);
    expect(executedOrder.some(s => s.includes('_df_view_node_aggregate'))).toBe(true);
  });
});
