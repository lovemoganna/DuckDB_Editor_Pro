import React, { useState, useMemo } from 'react';
import {
  Workflow,
  Search,
  ArrowRight,
  Sparkles,
  Layers,
  FlaskConical,
  Copy,
  Check,
  Code2,
  Filter,
  RefreshCw,
  ExternalLink,
  ArrowUpDown,
  Target,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useOntologyStore, LifeObject, LifeLink } from '../../hooks/useOntologyStore';
import { ActionButton } from '../ui/Workbench';

interface MultiHopPath {
  nodes: LifeObject[];
  links: { link: LifeLink; typeName: string }[];
  hopCount: number;
}

interface MultiHopDeductionExplorerProps {
  onInsert?: (sql: string) => void;
  onOpenWorkbench?: () => void;
  onInspectNode?: (node: LifeObject) => void;
}

export const MultiHopDeductionExplorer: React.FC<MultiHopDeductionExplorerProps> = ({
  onInsert,
  onOpenWorkbench,
  onInspectNode,
}) => {
  const { state } = useOntologyStore();
  const { objects = [], links = [], objectTypes = [], linkTypes = [] } = state;

  const [sourceId, setSourceId] = useState<number | null>(null);
  const [targetId, setTargetId] = useState<number | null>(null);
  const [sourceSearch, setSourceSearch] = useState('');
  const [targetSearch, setTargetSearch] = useState('');
  const [maxDepth, setMaxDepth] = useState<number>(4);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [expandedSqlIndex, setExpandedSqlIndex] = useState<number | null>(null);

  const handleSwapSourceTarget = () => {
    const prevSource = sourceId;
    const prevSourceSearch = sourceSearch;
    setSourceId(targetId);
    setSourceSearch(targetSearch);
    setTargetId(prevSource);
    setTargetSearch(prevSourceSearch);
  };

  const handleHighlightPath = (path: MultiHopPath) => {
    const nodeIds = path.nodes.map(n => n.id);
    const linkIds = path.links.map(l => l.link.id);
    if ((window as any).__d3HighlightSubtree) {
      (window as any).__d3HighlightSubtree(nodeIds, linkIds);
    } else if ((window as any).__d3FocusNode && nodeIds.length > 0) {
      (window as any).__d3FocusNode(nodeIds[0], 'instance');
    }
  };

  // Map for fast lookups
  const objectMap = useMemo(() => new Map(objects.map(o => [o.id, o])), [objects]);
  const objectTypeMap = useMemo(() => new Map(objectTypes.map(ot => [ot.id, ot.name])), [objectTypes]);
  const linkTypeMap = useMemo(() => new Map(linkTypes.map(lt => [lt.id, lt.name])), [linkTypes]);

  // Build adjacency list (bidirectional)
  const adjacency = useMemo(() => {
    const adj = new Map<number, { targetId: number; link: LifeLink; typeName: string }[]>();
    for (const obj of objects) {
      adj.set(obj.id, []);
    }
    for (const link of links) {
      const typeName = linkTypeMap.get(link.link_type_id) || '关联';
      adj.get(link.source_object_id)?.push({ targetId: link.target_object_id, link, typeName });
      adj.get(link.target_object_id)?.push({ targetId: link.source_object_id, link, typeName });
    }
    return adj;
  }, [objects, links, linkTypeMap]);

  // Filtered source and target options
  const filteredSources = useMemo(() => {
    if (!sourceSearch.trim()) return objects.slice(0, 50);
    const q = sourceSearch.toLowerCase();
    return objects.filter(o => o.name.toLowerCase().includes(q) || (objectTypeMap.get(o.object_type_id) || '').toLowerCase().includes(q)).slice(0, 50);
  }, [objects, sourceSearch, objectTypeMap]);

  const filteredTargets = useMemo(() => {
    if (!targetSearch.trim()) return objects.slice(0, 50);
    const q = targetSearch.toLowerCase();
    return objects.filter(o => o.name.toLowerCase().includes(q) || (objectTypeMap.get(o.object_type_id) || '').toLowerCase().includes(q)).slice(0, 50);
  }, [objects, targetSearch, objectTypeMap]);

  // BFS Path Exploration
  const discoveredPaths = useMemo<MultiHopPath[]>(() => {
    if (sourceId === null || targetId === null || sourceId === targetId) return [];

    const results: MultiHopPath[] = [];
    const queue: {
      currentId: number;
      nodePath: number[];
      linkPath: { link: LifeLink; typeName: string }[];
    }[] = [{ currentId: sourceId, nodePath: [sourceId], linkPath: [] }];

    const visitedPaths = new Set<string>();

    while (queue.length > 0 && results.length < 15) {
      const { currentId, nodePath, linkPath } = queue.shift()!;

      if (nodePath.length > maxDepth + 1) continue;

      if (currentId === targetId && nodePath.length > 1) {
        const fullNodes = nodePath.map(id => objectMap.get(id)!).filter(Boolean);
        results.push({
          nodes: fullNodes,
          links: linkPath,
          hopCount: linkPath.length,
        });
        continue;
      }

      const neighbors = adjacency.get(currentId) || [];
      for (const n of neighbors) {
        if (!nodePath.includes(n.targetId)) {
          const nextNodePath = [...nodePath, n.targetId];
          const pathKey = nextNodePath.join('->');
          if (!visitedPaths.has(pathKey)) {
            visitedPaths.add(pathKey);
            queue.push({
              currentId: n.targetId,
              nodePath: nextNodePath,
              linkPath: [...linkPath, { link: n.link, typeName: n.typeName }],
            });
          }
        }
      }
    }

    return results;
  }, [sourceId, targetId, maxDepth, adjacency, objectMap]);

  // Generate SQL CTE for a path
  const generatePathCte = (path: MultiHopPath): string => {
    const nodeNames = path.nodes.map(n => n.name).join('_to_');
    const cteName = `deduction_${nodeNames.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
    const joins = path.links.map((item, idx) => {
      const prevNode = path.nodes[idx];
      const nextNode = path.nodes[idx + 1];
      return `  -- Hop ${idx + 1}: ${prevNode.name} -[${item.typeName}]-> ${nextNode.name}\n` +
        `  JOIN life_link l${idx + 1} ON (l${idx + 1}.source_object_id = o${idx + 1}.id OR l${idx + 1}.target_object_id = o${idx + 1}.id)\n` +
        `  JOIN life_object o${idx + 2} ON (o${idx + 2}.id = CASE WHEN l${idx + 1}.source_object_id = o${idx + 1}.id THEN l${idx + 1}.target_object_id ELSE l${idx + 1}.source_object_id END)`;
    }).join('\n');

    return `-- 业务语义多跳推演 CTE 生成 (${path.hopCount} 跳链路)
WITH ${cteName} AS (
  SELECT
    o1.id AS start_id,
    o1.name AS start_entity,
    o${path.nodes.length}.id AS end_id,
    o${path.nodes.length}.name AS end_entity,
    '${path.links.map(l => l.typeName).join(' -> ')}' AS semantic_path
  FROM life_object o1
${joins}
  WHERE o1.id = ${path.nodes[0]?.id}
    AND o${path.nodes.length}.id = ${path.nodes[path.nodes.length - 1]?.id}
)
SELECT * FROM ${cteName};`;
  };

  const handleCopySql = (sql: string, idx: number) => {
    navigator.clipboard.writeText(sql);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-4 p-4 text-monokai-fg">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-monokai-border">
        <div className="flex items-center gap-2">
          <Workflow className="w-4 h-4 text-monokai-cyan" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            多跳拓扑推演探查器
          </h3>
        </div>
        {onOpenWorkbench && (
          <ActionButton
            size="sm"
            variant="secondary"
            icon={FlaskConical}
            onClick={onOpenWorkbench}
          >
            深度推演台
          </ActionButton>
        )}
      </div>

      <p className="text-xs text-monokai-comment leading-relaxed">
        基于图谱真实实体与关联关系，探查跨节点间的隐式语义链条（最大 4 跳），支持一键编译为 SQL CTE 查询。
      </p>

      {/* Selectors */}
      <div className="grid grid-cols-1 gap-3 p-3 bg-monokai-surface rounded-xl border border-monokai-border">
        {/* Source Entity */}
        <div>
          <label className="block text-xs font-medium text-monokai-fg-muted mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-monokai-cyan inline-block" />
              <span>起点实体 (Source)</span>
            </span>
            {sourceId && (
              <span className="text-xs text-monokai-cyan font-mono">
                ID: {sourceId}
              </span>
            )}
          </label>
          <input
            type="text"
            placeholder="搜索起点实体..."
            value={sourceSearch}
            onChange={e => setSourceSearch(e.target.value)}
            className="w-full bg-monokai-bg border border-monokai-border rounded-lg px-3 py-1.5 text-xs text-white placeholder-monokai-comment mb-1.5 outline-none focus:border-monokai-accent transition-colors"
          />
          <select
            value={sourceId ?? ''}
            onChange={e => setSourceId(e.target.value ? Number(e.target.value) : null)}
            className="w-full bg-monokai-bg border border-monokai-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-monokai-accent transition-colors"
          >
            <option value="">-- 请选择起点实体 --</option>
            {filteredSources.map(o => (
              <option key={o.id} value={o.id}>
                {o.name} ({objectTypeMap.get(o.object_type_id) || '未知类型'})
              </option>
            ))}
          </select>
        </div>

        {/* Swap Button */}
        <div className="flex items-center justify-center -my-1">
          <button
            type="button"
            onClick={handleSwapSourceTarget}
            title="对调起点与终点方向"
            className="flex items-center gap-1 px-3 py-1 rounded-full bg-monokai-bg border border-monokai-border hover:border-monokai-cyan text-monokai-comment hover:text-monokai-cyan text-[11px] font-mono transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <ArrowUpDown className="w-3 h-3" />
            <span>对调方向</span>
          </button>
        </div>

        {/* Target Entity */}
        <div>
          <label className="block text-xs font-medium text-monokai-fg-muted mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              <span>目标实体 (Target)</span>
            </span>
            {targetId && (
              <span className="text-xs text-monokai-yellow font-mono">
                ID: {targetId}
              </span>
            )}
          </label>
          <input
            type="text"
            placeholder="搜索目标实体..."
            value={targetSearch}
            onChange={e => setTargetSearch(e.target.value)}
            className="w-full bg-monokai-bg border border-monokai-border rounded-lg px-3 py-1.5 text-xs text-white placeholder-monokai-comment mb-1.5 outline-none focus:border-monokai-accent transition-colors"
          />
          <select
            value={targetId ?? ''}
            onChange={e => setTargetId(e.target.value ? Number(e.target.value) : null)}
            className="w-full bg-monokai-bg border border-monokai-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-monokai-accent transition-colors"
          >
            <option value="">-- 请选择目标实体 --</option>
            {filteredTargets.map(o => (
              <option key={o.id} value={o.id}>
                {o.name} ({objectTypeMap.get(o.object_type_id) || '未知类型'})
              </option>
            ))}
          </select>
        </div>

        {/* Max Depth Option */}
        <div className="flex items-center justify-between pt-2 border-t border-monokai-border text-xs text-monokai-comment">
          <span>最大搜索跳数 (Max Hops):</span>
          <div className="flex gap-1">
            {[2, 3, 4].map(d => (
              <button
                key={d}
                type="button"
                onClick={() => setMaxDepth(d)}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                  maxDepth === d
                    ? 'bg-monokai-accent text-[#102022] font-bold'
                    : 'bg-monokai-surface text-monokai-comment hover:text-white'
                }`}
              >
                {d} 跳
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Discovered Paths Results */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-monokai-comment">
          <span className="font-semibold text-monokai-fg-muted">
            探查结果 ({discoveredPaths.length} 条可用链路)
          </span>
          {discoveredPaths.length > 0 && (
            <span className="text-monokai-accent flex items-center gap-1 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              连通有效
            </span>
          )}
        </div>

        {sourceId && targetId && discoveredPaths.length === 0 && (
          <div className="p-4 bg-monokai-surface rounded-xl border border-dashed border-monokai-border text-center text-xs text-monokai-comment">
            在 {maxDepth} 跳深度范围内未发现连通路径。可尝试调整最大跳数或选择其他目标实体。
          </div>
        )}

        {discoveredPaths.map((path, idx) => {
          const cteSql = generatePathCte(path);
          return (
            <div
              key={idx}
              className="p-3 bg-monokai-surface rounded-xl border border-monokai-border hover:border-monokai-border transition-colors space-y-2.5"
            >
              <div className="flex items-center justify-between text-xs flex-wrap gap-1.5">
                <span className="px-2 py-0.5 rounded bg-monokai-cyan/15 border border-monokai-cyan/30 text-monokai-cyan font-medium font-mono">
                  链路 #{idx + 1} · {path.hopCount} 跳
                </span>
                <div className="flex items-center gap-1">
                  <ActionButton
                    size="sm"
                    variant="ghost"
                    icon={Target}
                    onClick={() => handleHighlightPath(path)}
                    title="在知识图谱画布中高亮整条链路"
                  >
                    高亮
                  </ActionButton>
                  <ActionButton
                    size="sm"
                    variant="ghost"
                    icon={expandedSqlIndex === idx ? ChevronUp : Code2}
                    onClick={() => setExpandedSqlIndex(expandedSqlIndex === idx ? null : idx)}
                    title="展开/收起生成的推演 CTE SQL"
                  >
                    {expandedSqlIndex === idx ? '收起' : 'SQL'}
                  </ActionButton>
                  <ActionButton
                    size="sm"
                    variant="ghost"
                    icon={copiedIndex === idx ? Check : Copy}
                    onClick={() => handleCopySql(cteSql, idx)}
                    title="复制推演 CTE"
                  >
                    {copiedIndex === idx ? '已复制' : '复制'}
                  </ActionButton>
                  {onInsert && (
                    <ActionButton
                      size="sm"
                      variant="primary"
                      icon={Code2}
                      onClick={() => onInsert(cteSql)}
                      title="插入到 SQL 编辑器"
                    >
                      送入SQL
                    </ActionButton>
                  )}
                </div>
              </div>

              {/* Breadcrumb Steps: Flow Style */}
              <div className="flex flex-wrap items-center gap-1.5 p-2 bg-monokai-bg/60 rounded-lg border border-monokai-border/40 text-xs">
                {path.nodes.map((node, nIdx) => {
                  const link = path.links[nIdx];
                  const isStart = nIdx === 0;
                  const isEnd = nIdx === path.nodes.length - 1;
                  return (
                    <React.Fragment key={node.id}>
                      <button
                        type="button"
                        onClick={() => onInspectNode?.(node)}
                        className={`px-2 py-0.5 rounded font-medium transition-all cursor-pointer flex items-center gap-1 shadow-2xs ${
                          isStart
                            ? 'bg-monokai-cyan/20 text-monokai-cyan border border-monokai-cyan/40 hover:bg-monokai-cyan/30'
                            : isEnd
                            ? 'bg-monokai-yellow/20 text-monokai-yellow border border-monokai-yellow/40 hover:bg-monokai-yellow/30'
                            : 'bg-monokai-surface text-monokai-fg hover:bg-monokai-elevated border border-monokai-border'
                        }`}
                        title={`点击检视或聚焦实体: ${node.name}`}
                      >
                        <span className="truncate max-w-[120px]">{node.name}</span>
                      </button>
                      {link && (
                        <span className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-monokai-surface/80 text-monokai-comment text-[10px] font-mono border border-white/5">
                          <span>─</span>
                          <span className="text-monokai-green font-medium truncate max-w-[90px]">{link.typeName}</span>
                          <span>→</span>
                        </span>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Inline SQL CTE Preview Box */}
              {expandedSqlIndex === idx && (
                <div className="p-2.5 bg-monokai-bg rounded-lg border border-monokai-cyan/30 text-[11px] font-mono overflow-x-auto custom-scrollbar animate-in fade-in space-y-1.5">
                  <div className="flex items-center justify-between text-monokai-comment text-[10px]">
                    <span className="text-monokai-cyan font-bold">DuckDB 递归推演 CTE 语句:</span>
                    <button onClick={() => setExpandedSqlIndex(null)} className="hover:text-white cursor-pointer px-1">×</button>
                  </div>
                  <pre className="text-monokai-fg/90 whitespace-pre-wrap leading-relaxed text-[10.5px] bg-black/20 p-2 rounded border border-white/5">{cteSql}</pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};