import { useState, useCallback, useEffect } from 'react';
import { Node, Edge, MarkerType } from 'reactflow';
import { duckDBService } from '../../services/duckdbService';
import { getNodeColor } from './CustomCanvasNodes';
import { MECELayer } from '../../services/ontologyAiService';

export function useCanvasPersistence(
  nodes: Node[],
  edges: Edge[],
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>,
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>,
  activeLayer: MECELayer,
  initHistory: (initialNodes: Node[], initialEdges: Edge[]) => void,
  handleDeleteNode: (id: string) => void
) {
  const [loading, setLoading] = useState(true);

  // ── Database Loader ──
  const loadCanvas = useCallback(async () => {
    try {
      await duckDBService.query(
        'CREATE TABLE IF NOT EXISTS life_canvas_state (id VARCHAR PRIMARY KEY, space_id VARCHAR, object_id INTEGER, title VARCHAR, color VARCHAR, x DECIMAL, y DECIMAL, width DECIMAL, height DECIMAL, node_type VARCHAR, metadata JSON)'
      );
      await duckDBService.query(
        'CREATE TABLE IF NOT EXISTS life_canvas_edge (id VARCHAR PRIMARY KEY, source_id VARCHAR, target_id VARCHAR)'
      );

      const rows = await duckDBService.query('SELECT * FROM life_canvas_state');
      const edgeRows = await duckDBService.query('SELECT * FROM life_canvas_edge');

      const loadedNodes: Node[] = [];

      // Load groups/spaces first
      (rows as any[]).forEach(row => {
        if (row.space_id && row.id === row.space_id) {
          loadedNodes.push({
            id: row.id,
            type: 'groupSpace',
            position: { x: Number(row.x), y: Number(row.y) },
            style: { width: Number(row.width) || 300, height: Number(row.height) || 300 },
            data: {
              title: row.title || '分组空间',
              color: row.color || '#a78bfa',
              onDelete: handleDeleteNode
            }
          });
        }
      });

      // Load items
      (rows as any[]).forEach(row => {
        if (row.id !== row.space_id) {
          const absoluteX = Number(row.x);
          const absoluteY = Number(row.y);

          let parentId = row.space_id || undefined;
          let relX = absoluteX;
          let relY = absoluteY;

          // Convert absolute coordinates back to relative for react-flow if inside group
          if (parentId) {
            const parent = loadedNodes.find(n => n.id === parentId);
            if (parent) {
              relX = absoluteX - parent.position.x;
              relY = absoluteY - parent.position.y;
            } else {
              parentId = undefined; // Parent space does not exist
            }
          }

          loadedNodes.push({
            id: row.id,
            type: row.node_type || 'Source',
            position: { x: relX, y: relY },
            parentId,
            extent: parentId ? 'parent' : undefined,
            data: {
              objectId: row.object_id,
              name: row.title || '节点',
              tableName: row.title || 'unknown_table',
              sqlFragment: row.metadata ? JSON.parse(row.metadata).sqlFragment : '',
              metadata: row.metadata ? JSON.parse(row.metadata) : {},
              onDelete: handleDeleteNode
            }
          });
        }
      });

      const loadedEdges: Edge[] = (edgeRows as any[]).map(e => ({
        id: e.id,
        source: e.source_id,
        target: e.target_id,
        animated: true,
        style: { stroke: '#64748b', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' }
      }));

      setNodes(loadedNodes);
      setEdges(loadedEdges);
      initHistory(loadedNodes, loadedEdges);
    } catch (e) {
      console.error('[Canvas Loader] Loading failed:', e);
    } finally {
      setLoading(false);
    }
  }, [setNodes, setEdges, initHistory, handleDeleteNode]);

  // ── Database Saver ──
  const saveCanvas = useCallback(async () => {
    if (loading) return;
    try {
      await duckDBService.query('BEGIN TRANSACTION');
      await duckDBService.query('DELETE FROM life_canvas_state');
      await duckDBService.query('DELETE FROM life_canvas_edge');

      for (const node of nodes) {
        if (node.type === 'groupSpace') {
          // Saving Group
          await duckDBService.query(
            `INSERT INTO life_canvas_state VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
            [
              node.id,
              node.id,
              node.data.title,
              node.data.color,
              node.position.x,
              node.position.y,
              node.style?.width || 300,
              node.style?.height || 300
            ]
          );
        } else {
          // Saving node. Compute absolute coordinate from parent if inside group
          let absX = node.position.x;
          let absY = node.position.y;
          if (node.parentId) {
            const parent = nodes.find(n => n.id === node.parentId);
            if (parent) {
              absX += parent.position.x;
              absY += parent.position.y;
            }
          }

          const metaStr = JSON.stringify({
            sqlFragment: node.data.sqlFragment || '',
            tableName: node.data.tableName || '',
            layerTag: activeLayer
          });

          await duckDBService.query(
            `INSERT INTO life_canvas_state VALUES (?, ?, ?, ?, NULL, ?, ?, NULL, NULL, ?, ?)`,
            [
              node.id,
              node.parentId || null,
              node.data.objectId || 0,
              node.data.name,
              absX,
              absY,
              node.type,
              metaStr
            ]
          );
        }
      }

      for (const edge of edges) {
        await duckDBService.query(
          `INSERT INTO life_canvas_edge VALUES (?, ?, ?)`,
          [edge.id, edge.source, edge.target]
        );
      }
      await duckDBService.query('COMMIT');
    } catch (e) {
      console.error('[Canvas Saver] Auto-save failed, rolling back:', e);
      try {
        await duckDBService.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('[Canvas Saver] Transaction rollback failed:', rollbackErr);
      }
    }
  }, [nodes, edges, loading, activeLayer]);

  useEffect(() => {
    loadCanvas();
  }, [loadCanvas]);

  // Debounced auto-save on nodes/edges changes
  useEffect(() => {
    const timer = setTimeout(saveCanvas, 2000);
    return () => clearTimeout(timer);
  }, [nodes, edges, saveCanvas]);

  return {
    loading,
    saveCanvas,
    loadCanvas,
  };
}
