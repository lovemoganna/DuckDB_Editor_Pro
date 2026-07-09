import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { RefreshCw, Loader2, Network, Table2, Eye, ChevronRight } from 'lucide-react';
import { duckDBService } from '../../services/duckdbService';
import type { LifeObject } from '../../hooks/useOntologyStore';

interface SchemaGraphViewProps {
  selectedTables?: string[];
  /** Highlight/highlight the node for a table selected via cross-selection store */
  selectedSchemaTable?: string | null;
  /** Pre-computed ontology objects grouped by _sourceTable (from OntologyPanel) */
  ontologyObjectsByTable?: Record<string, LifeObject[]>;
  /** Called when a node is clicked — informs OntologyPanel to update cross-selection state */
  onSchemaNodeClick?: (tableName: string) => void;
  /** Called when "查看本体图谱" is clicked — triggers tab switch to D3GraphView */
  onViewOntologyGraph?: (tableName: string) => void;
}

interface TableInfo {
  name: string;
  columns: { name: string; type: string; pk?: boolean; notnull?: boolean }[];
}

interface SchemaNode {
  id: string;
  label: string;
  color: string;
  size: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  _tableName: string;
  _columnCount: number;
  _ontologyCount?: number;
  _ontologyObjects?: LifeObject[];
}

interface SchemaLink {
  source: string | SchemaNode;
  target: string | SchemaNode;
  color: string;
  weight: number;
  _fromCol: string;
  _toCol: string;
}

const TABLE_COLORS = [
  '#5ab0d0', '#c77dff', '#7dd87d', '#ffa040', '#ff6b9d',
  '#60c0e0', '#ffe066', '#ff8860', '#88ddff', '#d06080',
];

const LINK_COLOR = '#66c0e8';

const SchemaGraphView: React.FC<SchemaGraphViewProps> = ({
  selectedTables,
  selectedSchemaTable,
  ontologyObjectsByTable,
  onSchemaNodeClick,
  onViewOntologyGraph,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<SchemaNode, SchemaLink> | null>(null);
  const nodesRef = useRef<SchemaNode[]>([]);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const loadedTablesRef = useRef<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [nodes, setNodes] = useState<SchemaNode[]>([]);
  const [links, setLinks] = useState<SchemaLink[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodeInfo, setNodeInfo] = useState<{
    table: string;
    columns: any[];
    ontologyCount?: number;
    ontologyObjects?: LifeObject[];
  } | null>(null);

  const loadSchemaGraph = useCallback(async () => {
    const effective = selectedTables ?? [];
    if (effective.length === 0) {
      setNodes([]);
      setLinks([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const tableInfos: TableInfo[] = [];
      for (const name of effective) {
        const cols = await duckDBService.getTableSchema(name);
        tableInfos.push({
          name,
          columns: cols.map((c: any) => ({
            name: c.name,
            type: c.type || 'VARCHAR',
            pk: !!c.pk,
            notnull: !!c.notnull,
          })),
        });
      }

      const schemas = tableInfos.map(t => ({
        table: t.name,
        columns: t.columns.map(c => ({ name: c.name, type: c.type })),
      }));
      const rels = await duckDBService.inferRelationships(schemas);

      const schemaNodes: SchemaNode[] = tableInfos.map((t, i) => ({
        id: `tbl::${t.name}`,
        label: t.name,
        color: TABLE_COLORS[i % TABLE_COLORS.length],
        size: Math.max(22, 36 - Math.min(t.columns.length * 1.5, 18)),
        _tableName: t.name,
        _columnCount: t.columns.length,
        _ontologyCount: ontologyObjectsByTable?.[t.name]?.length ?? 0,
        _ontologyObjects: ontologyObjectsByTable?.[t.name] || [],
      }));

      const schemaLinks: SchemaLink[] = rels
        .filter(r => effective.includes(r.fromTable) && effective.includes(r.toTable))
        .map(r => ({
          source: `tbl::${r.fromTable}`,
          target: `tbl::${r.toTable}`,
          color: LINK_COLOR,
          weight: 0.5,
          _fromCol: r.fromCol,
          _toCol: r.toCol,
        }));

      // Radial layout for initial positions
      const W = containerRef.current?.clientWidth ?? 800;
      const H = containerRef.current?.clientHeight ?? 600;
      const cx = W / 2;
      const cy = H / 2;
      const radius = Math.min(W, H) * 0.3;
      schemaNodes.forEach((n, i) => {
        const angle = (i / Math.max(schemaNodes.length, 1)) * 2 * Math.PI - Math.PI / 2;
        n.x = cx + radius * Math.cos(angle);
        n.y = cy + radius * Math.sin(angle);
      });

      nodesRef.current = schemaNodes;
      loadedTablesRef.current = effective;
      setNodes([...schemaNodes]);
      setLinks([...schemaLinks]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedTables, ontologyObjectsByTable]);

  // React to prop changes — no more polling
  useEffect(() => {
    const effective = selectedTables ?? (window as any).__schemaSelectedTables ?? [];
    if (effective.length > 0) {
      loadSchemaGraph();
    } else {
      setNodes([]);
      setLinks([]);
    }
  }, [selectedTables, loadSchemaGraph]);

  // D3 Rendering
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const W = container.clientWidth;
    const H = container.clientHeight;

    const svg = d3.select(svgRef.current).attr('width', W).attr('height', H);
    svg.selectAll('*').remove();

    const styleId = 'sg-styles-' + Date.now();
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = `
      .sg-node { cursor: move; }
      .sg-node:hover { filter: drop-shadow(0 2px 10px rgba(0,0,0,0.6)); }
      .sg-node-label { font-size: 11px; font-weight: 600; fill: #e8f4ff; text-anchor: start; pointer-events: none;
        text-shadow: 0 0 4px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.95);
        stroke: #0d0d14; stroke-width: 0.5px; paint-order: stroke fill; }
      .sg-node-sublabel { font-size: 9px; fill: rgba(200,200,220,0.6); text-anchor: start; pointer-events: none; }
      .sg-link { stroke-width: 1.8px; opacity: 0.7; fill: none; }
      .sg-link-label { font-size: 9px; fill: rgba(150,200,220,0.8); text-anchor: middle; pointer-events: none;
        text-shadow: 0 0 3px rgba(0,0,0,0.8); }
      .sg-selected-pulse { animation: sg-pulse 2s ease-out infinite; }
      @keyframes sg-pulse { 0% { opacity: 0.85; } 50% { opacity: 1; } 100% { opacity: 0.85; } }
      .sg-highlight { filter: drop-shadow(0 0 8px rgba(90,176,208,0.8)); }
      .sg-node-cross-selected { stroke: #66d9ef !important; stroke-width: 3px !important; stroke-opacity: 0.95 !important; }
    `;
    document.head.appendChild(styleEl);

    const g = svg.append('g').attr('class', 'sg-graph');

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 8])
      .on('zoom', e => { g.attr('transform', e.transform); });
    svg.call(zoom).on('dblclick.zoom', null);
    zoomRef.current = zoom;

    svg.attr('style', 'display:block;cursor:grab;');
    svg.on('wheel', (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
    }, { passive: false });

    if (nodes.length === 0) {
      return () => {
        const el = document.getElementById(styleId);
        if (el) el.remove();
      };
    }

    const sim = d3.forceSimulation<SchemaNode, SchemaLink>(nodes)
      .alpha(0.8)
      .alphaDecay(0.04)
      .force('link', d3.forceLink<SchemaNode, SchemaLink>(links).id(d => d.id).distance(120).strength(0.4))
      .force('charge', d3.forceManyBody().strength(-500))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide<SchemaNode>().radius(d => (d.size || 20) + 20))
      .force('x', d3.forceX(W / 2).strength(0.05))
      .force('y', d3.forceY(H / 2).strength(0.05));
    simulationRef.current = sim;

    // Arrow marker
    const defs = svg.append('defs').style('display', 'none');
    defs.append('marker')
      .attr('id', 'sg-arrow')
      .attr('markerWidth', 8).attr('markerHeight', 6)
      .attr('refX', 8).attr('refY', 3).attr('orient', 'auto')
      .append('polygon')
      .attr('points', '0 0, 8 3, 0 6')
      .attr('fill', LINK_COLOR);

    // Links
    const linkGroup = g.append('g').attr('class', 'sg-links');
    const linkEls = linkGroup.selectAll<SVGLineElement, SchemaLink>('line')
      .data(links)
      .enter().append('line')
      .attr('class', 'sg-link')
      .style('stroke', LINK_COLOR)
      .attr('marker-end', 'url(#sg-arrow)');

    // Link labels
    const linkLabelGroup = g.append('g').attr('class', 'sg-link-labels');
    const linkLabelEls = linkLabelGroup.selectAll<SVGTextElement, SchemaLink>('text')
      .data(links)
      .enter().append('text')
      .attr('class', 'sg-link-label')
      .text(d => `${d._fromCol} → ${d._toCol}`);

    // Nodes
    const nodeGroup = g.append('g').attr('class', 'sg-nodes');
    const nodeEls = nodeGroup.selectAll<SVGGElement, SchemaNode>('.sg-node')
      .data(nodes)
      .enter().append('g')
      .attr('class', 'sg-node')
      .style('cursor', 'pointer')
      .call(d3.drag<SVGGElement, SchemaNode>()
        .on('start', (event, d) => {
          if (!event.active) sim.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event, d) => {
          if (!event.active) sim.alphaTarget(0);
        })
      );

    nodeEls.append('circle')
      .attr('r', d => (d.size || 20) + 8)
      .style('fill', 'none')
      .style('stroke', d => d.color)
      .style('stroke-width', 1.5)
      .style('opacity', 0.3);

    nodeEls.append('circle')
      .attr('r', d => d.size || 20)
      .style('fill', d => d.color)
      .style('stroke', 'rgba(200,220,255,0.7)')
      .style('stroke-width', 1.5);

    // Table icon (simple grid)
    nodeEls.append('text')
      .text('⬛')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('font-size', d => `${(d.size || 20) * 0.7}px`)
      .style('pointer-events', 'none')
      .style('opacity', 0.25);

    // Node labels
    const labelGroup = g.append('g').attr('class', 'sg-labels');
    const labelEls = labelGroup.selectAll<SVGTextElement, SchemaNode>('text')
      .data(nodes)
      .enter().append('text')
      .attr('class', 'sg-node-label')
      .text(d => d.label)
      .style('font-size', '11px');

    const subLabelGroup = g.append('g').attr('class', 'sg-sub-labels');
    const subLabelEls = subLabelGroup.selectAll<SVGTextElement, SchemaNode>('text')
      .data(nodes)
      .enter().append('text')
      .attr('class', 'sg-node-sublabel')
      .text(d => `${d._columnCount} 列`)
      .style('font-size', '9px');

    // Fit all on end
    (window as any).__schemaFitAll = () => {
      const ns = nodesRef.current;
      if (!ns.length) return;
      const xs = ns.map(n => n.x || 0);
      const ys = ns.map(n => n.y || 0);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const bw = maxX - minX || 1, bh = maxY - minY || 1;
      const scale = Math.max(0.3, Math.min(0.8 * W / bw, 0.8 * H / bh, 3));
      const tx = W / 2 - ((minX + maxX) / 2) * scale;
      const ty = H / 2 - ((minY + maxY) / 2) * scale;
      svg.transition().duration(600)
        .call(zoom.transform as any, d3.zoomIdentity.translate(tx, ty).scale(scale));
    };

    // Tick
    sim.on('tick', () => {
      linkEls
        .attr('x1', d => (d.source as SchemaNode).x || 0)
        .attr('y1', d => (d.source as SchemaNode).y || 0)
        .attr('x2', d => {
          const src = d.source as SchemaNode, tgt = d.target as SchemaNode;
          const dx = (tgt.x || 0) - (src.x || 0);
          const dy = (tgt.y || 0) - (src.y || 0);
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          return (tgt.x || 0) - (dx / dist) * ((tgt.size || 20) + 8);
        })
        .attr('y2', d => {
          const src = d.source as SchemaNode, tgt = d.target as SchemaNode;
          const dx = (tgt.x || 0) - (src.x || 0);
          const dy = (tgt.y || 0) - (src.y || 0);
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          return (tgt.y || 0) - (dy / dist) * ((tgt.size || 20) + 8);
        });

      linkLabelEls
        .attr('x', d => (((d.source as SchemaNode).x || 0) + ((d.target as SchemaNode).x || 0)) / 2)
        .attr('y', d => (((d.source as SchemaNode).y || 0) + ((d.target as SchemaNode).y || 0)) / 2 - 5);

      nodeEls.attr('transform', d => `translate(${d.x || 0},${d.y || 0})`);
      labelEls
        .attr('x', d => (d.x || 0) + (d.size || 20) + 6)
        .attr('y', d => (d.y || 0) - 3);
      subLabelEls
        .attr('x', d => (d.x || 0) + (d.size || 20) + 6)
        .attr('y', d => (d.y || 0) + 9);
    });

    sim.on('end', () => { (window as any).__schemaFitAll?.(); });

    // Click to show info
    nodeEls.on('click', (event, d) => {
      event.stopPropagation();
      setSelectedNodeId(d.id);
      setNodeInfo({
        table: d._tableName,
        columns: [],
        ontologyCount: d._ontologyCount,
        ontologyObjects: d._ontologyObjects || [],
      });
      onSchemaNodeClick?.(d._tableName);
    });

    svg.on('click', () => {
      setSelectedNodeId(null);
      setNodeInfo(null);
    });

    // ResizeObserver
    const ro = new ResizeObserver(() => {
      if (!containerRef.current || !simulationRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      svg.attr('width', w).attr('height', h);
      simulationRef.current.force('center', d3.forceCenter(w / 2, h / 2));
      simulationRef.current.alpha(0.1).restart();
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      simulationRef.current?.stop();
      const el = document.getElementById(styleId);
      if (el) el.remove();
      delete (window as any).__schemaFitAll;
    };
  }, [nodes, links]);

  // ── Cross-selection: highlight node when selectedSchemaTable changes ──
  useEffect(() => {
    if (!svgRef.current || !nodes.length) return;
    const svg = d3.select(svgRef.current);
    if (selectedSchemaTable) {
      const targetId = `tbl::${selectedSchemaTable}`;
      svg.selectAll<SVGGElement, SchemaNode>('.sg-node')
        .classed('sg-node-cross-selected', (d: SchemaNode) => d.id === targetId);
    } else {
      svg.selectAll('.sg-node').classed('sg-node-cross-selected', false);
    }
  }, [selectedSchemaTable, nodes]);

  const effectiveSelectedTables: string[] = selectedTables ?? [];

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', background: '#0d0d14', position: 'relative', overflow: 'hidden' }}
    >
      <svg
        ref={svgRef}
        style={{ width: '100%', height: '100%', display: 'block', background: '#0d0d14' }}
        role="img"
        aria-label={`Schema 图谱：${nodes.length} 张表，${links.length} 条外键关系`}
        tabIndex={0}
      />

      {/* Empty state */}
      {!loading && nodes.length === 0 && !error && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 100,
        }}>
          <Network className="w-12 h-12" style={{ color: '#64748b' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, color: '#7ee8fa', fontWeight: 'bold', marginBottom: 8 }}>
              Schema 图谱
            </div>
            <div style={{ fontSize: 13, color: '#aaa', maxWidth: 380, lineHeight: 1.7 }}>
              {effectiveSelectedTables.length > 0
                ? '正在加载...'
                : <>请在左侧「我的 Schema」Tab 中<br />勾选要可视化的表</>
              }
            </div>
            <button
              onClick={loadSchemaGraph}
              style={{
                marginTop: 14, padding: '6px 16px', borderRadius: 8,
                border: '1px solid rgba(166,226,46,0.3)', background: 'rgba(39,40,34,0.88)',
                color: '#a6e22e', cursor: 'pointer', fontSize: 12,
              }}
            >
              刷新图谱
            </button>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div style={{
          position: 'absolute', bottom: 16, left: 16, zIndex: 200,
          padding: '10px 16px', borderRadius: 8, background: 'rgba(249,56,29,0.15)',
          border: '1px solid rgba(249,56,29,0.3)', color: '#f9a825', fontSize: 12,
        }}>
          错误: {error}
        </div>
      )}

      {/* Node info panel */}
      {nodeInfo && (
        <div style={{
          position: 'absolute', top: 16, right: 16, zIndex: 200,
          background: 'rgba(39,40,34,0.95)', border: '1px solid rgba(245,239,224,0.12)',
          borderRadius: 10, padding: 14, minWidth: 240, maxWidth: 320,
          fontFamily: 'Arial,sans-serif', fontSize: 12, color: '#f8f8f2', maxHeight: '70vh',
          overflowY: 'auto',
        }}>
          <div style={{ fontWeight: 'bold', color: '#7ee8fa', marginBottom: 10, fontSize: 13 }}>
            <Table2 className="inline w-4 h-4 mr-2" style={{ verticalAlign: 'middle' }} />
            {nodeInfo.table}
          </div>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>
            双击节点固定位置，滚轮缩放
          </div>

          {/* Ontology objects section */}
          {nodeInfo.ontologyCount !== undefined && nodeInfo.ontologyCount > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, marginBottom: 6, padding: '6px 10px', borderRadius: 6, background: 'rgba(189,174,255,0.1)', border: '1px solid rgba(189,174,255,0.2)' }}>
                <span style={{ color: '#c77dff', fontWeight: 600 }}>本体映射: </span>
                <span style={{ color: '#e8f4ff', fontWeight: 600 }}>{nodeInfo.ontologyCount}</span>
                <span style={{ color: '#888' }}> 个对象</span>
              </div>
              {nodeInfo.ontologyObjects && nodeInfo.ontologyObjects.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 140, overflowY: 'auto' }}>
                  {nodeInfo.ontologyObjects.map(obj => (
                    <div key={obj.id} style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px',
                      borderRadius: 6, background: 'rgba(189,174,255,0.06)',
                      border: '1px solid rgba(189,174,255,0.12)', fontSize: 11,
                    }}>
                      <ChevronRight className="w-3 h-3 text-monokai-purple shrink-0" style={{ color: '#c77dff' }} />
                      <span style={{ color: '#e8f4ff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {obj.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => onViewOntologyGraph?.(nodeInfo.table)}
                style={{
                  marginTop: 8, width: '100%', padding: '6px 10px', borderRadius: 6,
                  border: '1px solid rgba(90,176,208,0.25)', background: 'rgba(90,176,208,0.08)',
                  color: '#7ee8fa', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Eye className="w-3.5 h-3.5" style={{ verticalAlign: 'middle' }} />
                查看本体图谱
              </button>
            </div>
          )}

          {nodeInfo.ontologyCount === 0 && (
            <div style={{ fontSize: 11, color: '#666', marginBottom: 8, padding: '6px 10px', borderRadius: 6, background: 'rgba(0,0,0,0.2)' }}>
              尚未为此表创建本体对象
            </div>
          )}

          <button
            onClick={() => { setSelectedNodeId(null); setNodeInfo(null); }}
            style={{
              marginTop: 4, padding: '4px 10px', borderRadius: 6,
              border: '1px solid rgba(245,239,224,0.12)', background: 'transparent',
              color: '#888', cursor: 'pointer', fontSize: 11,
            }}
          >
            关闭
          </button>
        </div>
      )}

      {/* Controls */}
      {nodes.length > 0 && (
        <div style={{
          position: 'absolute', bottom: 16, right: 16, zIndex: 200,
          display: 'flex', gap: 8,
        }}>
          <button
            onClick={() => { (window as any).__schemaFitAll?.(); }}
            title="适应画布"
            style={{
              padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(245,239,224,0.12)',
              background: 'rgba(39,40,34,0.88)', color: '#f8f8f2', cursor: 'pointer', fontSize: 11,
            }}
          >
            适应画布
          </button>
          <button
            onClick={loadSchemaGraph}
            title="刷新"
            style={{
              padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(245,239,224,0.12)',
              background: 'rgba(39,40,34,0.88)', color: '#f8f8f2', cursor: 'pointer', fontSize: 11,
            }}
          >
            <RefreshCw className="inline w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Stats */}
      {nodes.length > 0 && (
        <div style={{
          position: 'absolute', top: 16, left: 16, zIndex: 200,
          padding: '8px 14px', borderRadius: 8,
          background: 'rgba(39,40,34,0.88)', border: '1px solid rgba(245,239,224,0.12)',
          fontFamily: 'Arial,sans-serif', fontSize: 11, color: '#aaa',
        }}>
          <span style={{ color: '#7ee8fa', fontWeight: 'bold' }}>{nodes.length}</span> 张表
          {' · '}
          <span style={{ color: '#66c0e8', fontWeight: 'bold' }}>{links.length}</span> 条关系
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 3000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)',
        }}>
          <div style={{
            background: 'rgba(39,40,34,0.96)', border: '1px solid rgba(245,239,224,0.12)',
            borderRadius: 8, padding: '16px 32px', textAlign: 'center',
          }}>
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" style={{ color: '#5ab0d0' }} />
            <div style={{ color: '#ccc', fontSize: 13 }}>正在构建 Schema 图谱...</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchemaGraphView;
