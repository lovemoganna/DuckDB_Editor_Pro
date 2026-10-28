import React from 'react';
import { afterEach, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { DataFlowBottomDrawer } from './DataFlowBottomDrawer';
import { useWorkflowStore } from '../../../services/dataflow/workflowStore';
import type { DataFlowNode } from '../../../services/dataflow/workflowTypes';

afterEach(() => {
  cleanup();
  useWorkflowStore.setState({ nodes: [], edges: [], isExecuting: false });
});

it('updates feedback from pending to running, completed and failed using actual execution evidence', () => {
  const node: DataFlowNode = {
    id: 'result', type: 'dataFlowNode', position: { x: 0, y: 0 },
    data: { id: 'result', type: 'result', title: 'Result', status: 'success' },
  };
  useWorkflowStore.setState({ nodes: [node], edges: [], isExecuting: false, isBottomDrawerOpen: false, runLogs: [] });
  render(<DataFlowBottomDrawer />);
  expect(screen.getByText('流程待运行')).toBeInTheDocument();
  act(() => useWorkflowStore.setState({ isExecuting: true }));
  expect(screen.getByText('流程执行中')).toBeInTheDocument();
  act(() => useWorkflowStore.setState({
    isExecuting: false,
    nodes: [{ ...node, data: { ...node.data, executionResult: {
      status: 'success', executionTimeSec: 0.1, rowCount: 0, columnCount: 0, columns: [], rows: [], outputRelation: 'result',
    } } }],
  }));
  expect(screen.getByText('流程执行完成')).toBeInTheDocument();
  act(() => useWorkflowStore.setState({ nodes: [{ ...node, data: { ...node.data, status: 'error' } }] }));
  expect(screen.getByText('流程执行失败')).toBeInTheDocument();
});

it('uses Statement status for SQL completion without requiring per-operator metrics', () => {
  const leaf: DataFlowNode = { id: 'source', type: 'dataFlowNode', position: { x: 0, y: 0 }, data: { id: 'source', type: 'source', title: 'Source', status: 'success', executionStatus: 'success' } };
  const boundary: DataFlowNode = { ...leaf, id: 'boundary', type: 'logicalBoundary', data: { ...leaf.data, executionStatus: undefined, status: 'idle' } };
  useWorkflowStore.setState({ nodes: [boundary, leaf], edges: [], isExecuting: false, isBottomDrawerOpen: false });
  render(<DataFlowBottomDrawer />);
  expect(screen.getByText('流程执行完成')).toBeInTheDocument();
  expect(screen.getByText('1 个节点')).toBeInTheDocument();
  act(() => useWorkflowStore.setState({ nodes: [{ ...leaf, data: { ...leaf.data, executionStatus: 'cancelled' } }] }));
  expect(screen.getByText('流程已取消')).toBeInTheDocument();
});
