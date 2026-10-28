async (page) => {
  const result = await page.evaluate(async () => {
    const { loadDynamicGraphData } = await import('/DuckDB_Editor_Pro/components/Library/D3GraphView/D3GraphView.data.ts');
    const graph = await loadDynamicGraphData({ objectTypeTable: 'life_object_type', objectTable: 'life_object', linkTypeTable: 'life_link_type', linkTable: 'life_link', actionTable: 'life_action' });
    const counts = { types: graph.nodes.filter(n => n.group === 'typeHub').length,
      instances: graph.nodes.filter(n => n.group === 'instance').length,
      schemaEdges: graph.links.filter(l => l._isSchemaLink).length,
      instanceEdges: graph.links.filter(l => l._linkTypeId && !l._isSchemaLink).length };
    if (counts.types !== 2 || counts.instances !== 5 || counts.schemaEdges !== 1 || counts.instanceEdges !== 3) throw new Error(JSON.stringify(counts));
    return { verdict: 'PASS', ...counts };
  });
  return result;
}
