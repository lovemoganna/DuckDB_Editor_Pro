export type NodeType = 'Source' | 'Transform' | 'Control' | 'Sink';

export interface CanvasEdge {
  id: string;
  sourceId: string;
  targetId: string;
}

export interface CanvasNodeMetadata {
  sqlFragment?: string;
  joinCondition?: string;
  tableName?: string;
  condition?: string;
  action?: string;
}

// Frontend compiler: Topology to SQL
// Extracts a linear or DAG DAG from canvas state and generates a DuckDB CTE
export class CanvasTopologyManager {
  static compileToSql(
    items: { id: string; nodeType: NodeType; metadata?: CanvasNodeMetadata; objectId: number }[],
    edges: CanvasEdge[],
    objects: { id: number; name: string }[]
  ): string {
    if (items.length === 0) return '-- 拓扑为空，无法生成 SQL';

    let sql = '-- AI 自动生成的拓扑 SQL 预览\n';
    const ctes: string[] = [];

    // Find sources
    const sources = items.filter(i => i.nodeType === 'Source');
    sources.forEach((s, i) => {
      const obj = objects.find(o => o.id === s.objectId);
      const tableName = s.metadata?.tableName || obj?.name || 'unknown_table';
      let statement = `SELECT * FROM "${tableName}"`;
      if (s.metadata?.sqlFragment) {
        statement += ` \n  ${s.metadata.sqlFragment}`;
      }
      ctes.push(`source_${i} AS (\n  ${statement}\n)`);
    });

    // Find Transforms
    const transforms = items.filter(i => i.nodeType === 'Transform');
    transforms.forEach((t, i) => {
      // Find what connects to this transform
      const inEdges = edges.filter(e => e.targetId === t.id);
      const sourceAliases = inEdges.map(e => `source_node_${e.sourceId.replace(/[^a-zA-Z0-9]/g, '_')}`);
      let statement = `SELECT * FROM ${sourceAliases.join(', ') || 'unknown_input'}`;
      
      if (t.metadata?.sqlFragment) {
        statement = t.metadata.sqlFragment;
      }
      ctes.push(`transform_${i} AS (\n  ${statement}\n)`);
    });

    // Find Sinks
    const sinks = items.filter(i => i.nodeType === 'Sink');
    
    if (ctes.length > 0) {
      sql += 'WITH ' + ctes.join(',\n') + '\n';
    }

    if (sinks.length > 0) {
      const sink = sinks[0];
      const inEdges = edges.filter(e => e.targetId === sink.id);
      const sourceAlias = inEdges.length > 0 ? `transform_node_${inEdges[0].sourceId.replace(/[^a-zA-Z0-9]/g, '_')}` : '*';
      sql += `SELECT * FROM ${sourceAlias};\n`;
    } else if (ctes.length > 0) {
      // If no sink, just select from the last CTE
      const lastCte = ctes[ctes.length - 1].split(' AS')[0];
      sql += `SELECT * FROM ${lastCte};\n`;
    } else {
      sql += 'SELECT 1;';
    }

    return sql;
  }
}
