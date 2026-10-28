import { it, expect, vi } from 'vitest';
import { parseLogicalRelationFlow } from './logicalRelationFlowParser';
import { layoutLogicalFlow } from './logicalFlowLayout';
import { readableFlowViewport } from './logicalFlowViewport';
import { useWorkflowStore } from './workflowStore';
import { hashSql } from './sqlHash';

it('adapts the same chain to narrow and wide canvases without changing relationships', async () => {
  const flow = parseLogicalRelationFlow('SELECT a, count(*) FROM t WHERE a>0 GROUP BY a HAVING count(*)>1 ORDER BY a LIMIT 10');
  const narrow = await layoutLogicalFlow(flow, new Map(), 500);
  const wide = await layoutLogicalFlow(flow, new Map(), 3000);
  const leaves = narrow.nodes.filter(n=>n.type!=='logicalBoundary');
  expect(leaves.every(n=>n.data.flowDirection==='DOWN')).toBe(true);
  expect(wide.nodes.filter(n=>n.type!=='logicalBoundary').every(n=>n.data.flowDirection==='RIGHT')).toBe(true);
  expect(narrow.edges.map(e=>[e.id,e.source,e.target,e.data?.flowKind])).toEqual(wide.edges.map(e=>[e.id,e.source,e.target,e.data?.flowKind]));
  expect(Math.max(...leaves.map(n=>n.position.x+n.width!))-Math.min(...leaves.map(n=>n.position.x))).toBeLessThan(500);
  for (const edge of narrow.edges) {
    expect(edge.data?.routePoints!.at(1)!.y).toBeGreaterThanOrEqual(edge.data?.routePoints![0].y!);
  }
  const viewport = readableFlowViewport(narrow.nodes,500,380)!;
  expect(viewport.zoom).toBeGreaterThanOrEqual(.85);
  expect(narrow.nodes.find(n=>n.type==='logicalBoundary')!.position.y*viewport.zoom+viewport.y).toBeGreaterThanOrEqual(0);
});

it('keeps a short passthrough horizontal and text readable even in split view', async () => {
  const graph = await layoutLogicalFlow(parseLogicalRelationFlow('SELECT * FROM t'),new Map(),400);
  expect(graph.nodes.filter(n=>n.type!=='logicalBoundary').every(n=>n.data.flowDirection==='RIGHT')).toBe(true);
  expect(readableFlowViewport(graph.nodes,400,300)?.zoom).toBeGreaterThanOrEqual(.85);
});

it('preserves a running Statement when a resize layout finishes after a new execution event', async () => {
  const sql = 'SELECT a,count(*) FROM t WHERE a>0 GROUP BY a ORDER BY a LIMIT 10';
  useWorkflowStore.setState({ dataFlowMode: 'sql', canvasWidth: 440 });
  await useWorkflowStore.getState().syncFromSql(sql,'resize',false,'resize');
  useWorkflowStore.setState({ canvasWidth: 3000 });
  useWorkflowStore.getState().autoLayout();
  useWorkflowStore.getState().applyExecutionEvent({ runId:'resize-run', tabId:'resize', documentVersion:hashSql(sql), connectionId:'writer', statementId:'statement_0_0', sourceSpan:{start:0,end:sql.length,startLine:1,endLine:1}, status:'running' });
  await vi.waitFor(() => {
    const leaves = useWorkflowStore.getState().nodes.filter(n=>n.type!=='logicalBoundary');
    expect(leaves.every(n=>n.data.flowDirection==='RIGHT')).toBe(true);
    expect(leaves.every(n=>n.data.executionStatus==='running')).toBe(true);
  });
});
