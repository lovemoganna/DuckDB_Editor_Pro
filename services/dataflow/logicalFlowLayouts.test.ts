import { it, expect } from 'vitest';
import { parseLogicalRelationFlow, logicalFlowToCanvas } from './logicalRelationFlowParser';
import { layoutLogicalFlow, type LogicalFlowLayoutMode } from './logicalFlowLayout';
import { useWorkflowStore } from './workflowStore';
import { hashSql } from './sqlHash';
import glossary from './fixtures/glossaryFlowCases.json';

const modes: LogicalFlowLayoutMode[] = ['horizontal','vertical','tree','force'];
it.each(glossary.cases.flatMap(c => modes.map(mode => ({ ...c, mode }))))('$name / $mode preserves hierarchy and routes without collisions', async ({ sql, mode }) => {
  const flow = parseLogicalRelationFlow(sql), original = logicalFlowToCanvas(flow);
  const graph = await layoutLogicalFlow(flow, new Map(), 600, mode);
  expect(graph.nodes.filter(n => n.type !== 'logicalBoundary').map(n => n.id).sort()).toEqual(original.nodes.map(n => n.id).sort());
  const semanticEdges = (edges: typeof graph.edges) => edges.map(e => [e.id,e.source,e.target,e.sourceHandle,e.targetHandle,e.data?.flowKind,e.data?.inputRole]);
  expect(semanticEdges(graph.edges)).toEqual(semanticEdges(original.edges));
  const box = (id: string): { x:number; y:number; width:number; height:number } => {
    const n=graph.nodes.find(n=>n.id===id)!;
    const p=n.parentNode ? box(n.parentNode) : { x:0,y:0 };
    return { x:p.x+n.position.x, y:p.y+n.position.y, width:n.width || Number(n.style?.width), height:n.height || Number(n.style?.height) };
  };
  const leaves = graph.nodes.filter(n => n.type !== 'logicalBoundary');
  for (const n of graph.nodes) if (n.parentNode) {
    const p=box(n.parentNode), b=box(n.id);
    expect(b.x>=p.x && b.y>=p.y && b.x+b.width<=p.x+p.width+.02 && b.y+b.height<=p.y+p.height+.02, `boundary contains ${n.id}`).toBe(true);
  }
  for (let i=0;i<leaves.length;i++) for(let j=i+1;j<leaves.length;j++) {
    const a=box(leaves[i].id), b=box(leaves[j].id);
    expect(a.x+a.width<=b.x || b.x+b.width<=a.x || a.y+a.height<=b.y || b.y+b.height<=a.y, 'node overlap').toBe(true);
  }
  for(const e of graph.edges) {
    const route=e.data?.routePoints!;
    expect(route?.length).toBeGreaterThanOrEqual(2);
    const a=box(e.source), b=box(e.target), vertical=mode==='vertical'||mode==='tree';
    const fraction=e.targetHandle==='left'?.35:e.targetHandle==='right'?.65:.5;
    if(mode!=='force' && e.data?.flowKind==='relation_flow') expect(vertical ? b.y>=a.y+a.height-.51 : b.x>=a.x+a.width-.51,'downstream advances a layer').toBe(true);
    // ELK rounds port coordinates to pixels; allow at most half a pixel.
    expect(Math.abs(route[0].x-(vertical ? a.x+a.width/2 : a.x+a.width))).toBeLessThanOrEqual(.51);
    expect(Math.abs(route[0].y-(vertical ? a.y+a.height : a.y+a.height/2))).toBeLessThanOrEqual(.51);
    expect(Math.abs(route.at(-1)!.x-(vertical ? b.x+b.width*fraction : b.x))).toBeLessThanOrEqual(.51);
    expect(Math.abs(route.at(-1)!.y-(vertical ? b.y : b.y+b.height*fraction))).toBeLessThanOrEqual(.51);
    for(let i=1;i<route.length;i++) {
      const a=route[i-1],b=route[i];
      expect(a.x===b.x||a.y===b.y,'orthogonal route').toBe(true);
      for(const n of leaves.filter(n=>n.id!==e.source && n.id!==e.target)) {
        const o=box(n.id);
        const crosses=a.x===b.x ? a.x>o.x+.01&&a.x<o.x+o.width-.01&&Math.max(a.y,b.y)>o.y+.01&&Math.min(a.y,b.y)<o.y+o.height-.01 : a.y>o.y+.01&&a.y<o.y+o.height-.01&&Math.max(a.x,b.x)>o.x+.01&&Math.min(a.x,b.x)<o.x+o.width-.01;
        expect(crosses,`${e.id} crosses ${n.data.title}`).toBe(false);
      }
    }
  }
},15000);

it.each(modes)('%s is deterministic, including repeated CTE inputs', async mode => {
  const flow=parseLogicalRelationFlow('WITH q AS (SELECT id FROM a WHERE id>0) SELECT * FROM q x JOIN q y USING(id)');
  expect(await layoutLogicalFlow(flow,new Map(),600,mode)).toEqual(await layoutLogicalFlow(flow,new Map(),600,mode));
});

it('maps each data input to its true producer and JOIN role', () => {
  const flow=parseLogicalRelationFlow('WITH q AS (SELECT id FROM a) SELECT * FROM q x LEFT JOIN (SELECT id FROM b WHERE id>0) y USING(id) JOIN c USING(id) WHERE x.id>1');
  expect(flow.diagnostics).toEqual([]);
  for(const node of flow.nodes.filter(n=>n.operator)) for(const [index,relationId] of node.operator!.inputRelationIds.entries()) {
    const edge=flow.edges.find(e=>e.to===node.id && e.kind==='relation_flow' && e.relationId===relationId)!;
    expect(edge).toBeDefined();
    const producer=flow.nodes.find(n=>n.id===edge.from)!;
    expect(producer.relation?.id===relationId || producer.operator?.outputRelationIds.includes(relationId)).toBe(true);
    if(node.operator!.type==='join') {
      expect(edge.inputRole).toBe(String(index));
      expect(logicalFlowToCanvas(flow).edges.find(e=>e.id===edge.id)?.targetHandle).toBe(index===0?'left':'right');
    }
  }
  const definitions=flow.nodes.filter(n=>n.relation?.name==='a');
  expect(definitions).toHaveLength(1);
  const reference=flow.edges.find(e=>e.kind==='reference')!;
  expect(flow.nodes.find(n=>n.id===reference.from)?.operator?.outputRelationIds).toContain(reference.relationId);
});

it('binds a JOIN condition subquery to its dependency port, separate from its two row inputs', () => {
  const flow=parseLogicalRelationFlow('SELECT * FROM a JOIN b ON a.id=b.id AND EXISTS (SELECT * FROM c WHERE c.id=b.id)');
  const join=flow.nodes.find(n=>n.operator?.type==='join')!;
  expect(flow.edges.filter(e=>e.to===join.id && e.kind==='relation_flow')).toHaveLength(2);
  const reference=flow.edges.find(e=>e.to===join.id && e.kind==='reference')!;
  expect(reference).toBeDefined();
  expect(logicalFlowToCanvas(flow).edges.find(e=>e.id===reference.id)?.targetHandle).toBe('input');
});

it('keeps the latest layout and live execution/selection during rapid switches',async()=>{
  const sql='SELECT a,count(*) FROM t WHERE a>0 GROUP BY a ORDER BY a LIMIT 10';
  useWorkflowStore.setState({dataFlowMode:'sql',sqlLayoutMode:'auto'});
  await useWorkflowStore.getState().syncFromSql(sql,'modes',false,'modes');
  const nodeId=useWorkflowStore.getState().nodes.find(n=>n.type!=='logicalBoundary')!.id;
  useWorkflowStore.getState().selectNode(nodeId);
  const first=useWorkflowStore.getState().setSqlLayoutMode('horizontal');
  const second=useWorkflowStore.getState().setSqlLayoutMode('vertical');
  useWorkflowStore.getState().applyExecutionEvent({runId:'modes-run',tabId:'modes',documentVersion:hashSql(sql),connectionId:'writer',statementId:'statement_0_0',sourceSpan:{start:0,end:sql.length,startLine:1,endLine:1},status:'running'});
  await Promise.all([first,second]);
  expect(useWorkflowStore.getState().sqlLayoutMode).toBe('vertical');
  expect(useWorkflowStore.getState().selectedNodeId).toBe(nodeId);
  expect(useWorkflowStore.getState().nodes.filter(n=>n.type!=='logicalBoundary').every(n=>n.data.flowDirection==='DOWN' && n.data.executionStatus==='running')).toBe(true);
  useWorkflowStore.setState({sqlLayoutMode:'auto'});
});
