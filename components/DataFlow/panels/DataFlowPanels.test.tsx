import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useWorkflowStore } from '../../../services/dataflow/workflowStore';
import { DataFlowNodeConfig } from './DataFlowNodeConfig';
import { DataFlowBottomDrawer } from './DataFlowBottomDrawer';
import { DataFlowInspector } from './DataFlowInspector';
import { duckDBService } from '../../../services/duckdbService';

const source = { id: 'src', type: 'dataFlowNode', position: { x: 0, y: 0 }, data: { id: 'src', title: 'Source', type: 'source' as const, status: 'success' as const, config: { tableName: 'orders', fileType: 'table' } } };
describe('DataFlow panel behavior', () => {
  beforeEach(() => {
    localStorage.removeItem('dataflow_drawer_height');
    useWorkflowStore.setState({ nodes: [source], edges: [], selectedNodeId: 'src', dataFlowMode: 'custom', isExecuting: false, runLogs: [], availableTables: ['orders', 'customers'], bottomDrawerTab: 'preview', isBottomDrawerOpen: true, inspectorTab: 'config' });
  });
  it('edits a real source config and marks downstream output dirty', () => {
    useWorkflowStore.setState({ nodes: [source, { ...source, id: 'output', data: { ...source.data, id: 'output', type: 'result', config: { limit: 100 } } }], edges: [{ id: 'edge', source: 'src', target: 'output' }] });
    render(<DataFlowNodeConfig nodeId="src" data={source.data} />);
    fireEvent.change(screen.getByLabelText('数据表'), { target: { value: 'customers' } });
    const nodes = useWorkflowStore.getState().nodes;
    expect(nodes[0].data.config.tableName).toBe('customers');
    expect(nodes.map(n => n.data.status)).toEqual(['dirty', 'dirty']);
  });
  it('keeps SQL-generated graph configuration read-only', () => {
    useWorkflowStore.setState({ dataFlowMode: 'sql' });
    render(<DataFlowNodeConfig nodeId="src" data={source.data} />);
    expect(screen.queryByLabelText('数据表')).not.toBeInTheDocument();
  });
  it('shows a successful zero-row result with its columns', () => {
    useWorkflowStore.setState({ nodes: [{ ...source, data: { ...source.data, executionResult: { status: 'success', rows: [], columns: [{ name: 'customer_id', type: 'INTEGER' }], rowCount: 0, columnCount: 1, executionTimeSec: 0.01, outputRelation: 'orders' } } }] });
    render(<DataFlowBottomDrawer />);
    expect(screen.getByText('customer_id')).toBeInTheDocument();
    expect(screen.getByText(/展示 0 \/ 0 行 · 1 列/)).toBeInTheDocument();
    expect(screen.queryByText('自动滚动')).not.toBeInTheDocument();
  });
  it('recovers invalid saved drawer height and supports keyboard resizing', () => {
    localStorage.setItem('dataflow_drawer_height', 'NaN');
    render(<DataFlowBottomDrawer />);
    const separator = screen.getByRole('separator');
    expect(separator).toHaveAttribute('aria-valuenow', '210');
    fireEvent.keyDown(separator, { key: 'ArrowUp' });
    expect(separator).toHaveAttribute('aria-valuenow', '230');
  });
  it('does not execute queries merely by opening the preview', () => {
    useWorkflowStore.setState({ inspectorTab: 'preview' });
    const query = vi.spyOn(duckDBService, 'query');
    render(<DataFlowInspector />);
    expect(query).not.toHaveBeenCalled();
    expect(screen.getByText('立即运行并采样')).toBeInTheDocument();
    query.mockRestore();
  });
});
