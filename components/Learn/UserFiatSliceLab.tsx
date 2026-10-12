/**
 * DuckDB Editor Pro · 真实业务本体切片实验（第 5 课）
 * 零 Mock、零新表、零数据缓存。输入用户名后，始终通过已有 duckDBService 查询当前本地 DuckDB。
 * 安装位置: components/Learn/UserFiatSliceLab.tsx
 */
import React, { useMemo, useRef, useState } from 'react';
import { duckDBService } from '../../services/duckdbService';

type SliceRow = {
  uid: string | number;
  user_name: string;
  relation: 'HAS_TRANSACTION' | null;
  fiat_order_id: string | null;
  amount: number | null;
  currency: string | null;
  status: string | null;
};

type SliceNode = {
  id: string;
  type: 'User' | 'FiatTransaction';
  label: string;
  uid?: string;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
};

type SliceEdge = { id: string; source: string; target: string; relation: 'HAS_TRANSACTION' };

type SliceGraph = { nodes: SliceNode[]; edges: SliceEdge[] };

export const lesson5Sql = (name: string) => {
  const safeName = name.trim().replace(/'/g, "''");
  // DuckDB Editor Pro 的真实表：main.users、main.fiat_transactions
  return `-- 输入用户名，查找真实 User 和所有法币交易（包括 pending / failed）
WITH target AS (
    SELECT '${safeName}' AS user_name
)
SELECT
    CAST(u.uid AS VARCHAR) AS uid,
    u.user_name,
    CASE WHEN f.fiat_order_id IS NOT NULL
         THEN 'HAS_TRANSACTION' ELSE NULL END AS relation,
    CAST(f.fiat_order_id AS VARCHAR) AS fiat_order_id,
    CAST(f.amount AS DOUBLE) AS amount,
    CAST(f.currency AS VARCHAR) AS currency,
    CAST(f.status AS VARCHAR) AS status
FROM main.users AS u
LEFT JOIN main.fiat_transactions AS f
    ON TRY_CAST(u.uid AS BIGINT) = TRY_CAST(f.uid AS BIGINT)
WHERE u.user_name = (SELECT user_name FROM target)
ORDER BY f.fiat_order_id NULLS LAST;`;
};

export const sliceRowsToGraph = (rows: SliceRow[]): SliceGraph => {
  const nodes = new Map<string, SliceNode>();
  const edges = new Map<string, SliceEdge>();

  for (const row of rows) {
    if (row.uid == null || row.user_name == null) throw new Error('缺少用户 UID 或名称');
    const userId = `User:${String(row.uid)}`;
    nodes.set(userId, { id: userId, type: 'User', label: String(row.user_name), uid: String(row.uid) });
    if (row.fiat_order_id == null) continue; // 用户有可能没有法币交易
    if (row.relation !== 'HAS_TRANSACTION') throw new Error('检测到非法关系类型');

    const orderId = `FiatTransaction:${String(row.fiat_order_id)}`;
    const existing = edges.get(orderId);
    if (existing && existing.source !== userId) throw new Error('相同订单号出现多个不同所有者，请检查数据');
    nodes.set(orderId, {
      id: orderId,
      type: 'FiatTransaction',
      label: String(row.fiat_order_id),
      amount: row.amount == null ? null : Number(row.amount),
      currency: row.currency,
      status: row.status,
    });
    edges.set(orderId, { id: `${userId}->${orderId}`, source: userId, target: orderId, relation: 'HAS_TRANSACTION' });
  }
  const graph: SliceGraph = { nodes: [...nodes.values()], edges: [...edges.values()] };
  const ids = new Set(graph.nodes.map(n => n.id));
  if (graph.edges.some(e => !ids.has(e.source) || !ids.has(e.target))) {
    throw new Error('子图存在无效引用');
  }
  return graph;
};

const amountText = (node: SliceNode) => {
  if (node.amount == null) return '金额未知';
  return `${Number(node.amount).toLocaleString('en-US')} ${node.currency ?? ''}`.trim();
};

export default function UserFiatSliceLab() {
  const [name, setName] = useState('Alice Chen');
  const [executedName, setExecutedName] = useState<string | null>(null);
  const [rows, setRows] = useState<SliceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const requestId = useRef(0);
  const graph = useMemo(() => sliceRowsToGraph(rows), [rows]);
  const selectedNode = graph.nodes.find(n => n.id === selectedNodeId) ?? null;
  const userNodes = graph.nodes.filter(n => n.type === 'User');
  const tradeNodes = graph.nodes.filter(n => n.type === 'FiatTransaction');
  const maxRadius = 160;
  const nodePositions = useMemo(() => {
    const locations = new Map<string, { x: number; y: number }>();
    const center = { x: 360, y: 235 };
    graph.nodes.filter(n => n.type === 'User').forEach((n, i, all) => {
      locations.set(n.id, { x: center.x + (i - (all.length - 1) / 2) * 220, y: center.y });
    });
    const tx = graph.nodes.filter(n => n.type === 'FiatTransaction');
    tx.forEach((n, i) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * i) / Math.max(tx.length, 1);
      const radius = Math.min(185, maxRadius + Math.min(tx.length, 10) * 2);
      locations.set(n.id, {
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
      });
    });
    return locations;
  }, [graph]);

  const onNameChange = (value: string) => {
    requestId.current += 1; // 当前输入改变时废弃旧查询，防止旧图残留
    setName(value);
    setExecutedName(null);
    setRows([]);
    setError(null);
    setSelectedNodeId(null);
    setLoading(false);
  };

  const run = async (event: React.FormEvent) => {
    event.preventDefault();
    const candidate = name.trim();
    if (!candidate) { setError('请输入用户名'); return; }
    if (candidate.length > 120) { setError('用户名过长'); return; }
    const id = ++requestId.current;
    setRows([]); setExecutedName(null); setError(null); setLoading(true); setSelectedNodeId(null);
    try {
      const result = await duckDBService.query(lesson5Sql(candidate));
      if (id !== requestId.current) return;
      if (!Array.isArray(result)) throw new Error('查询未返回结果行数组');
      const safeRows = result as SliceRow[];
      // 先进行强校验。验证失败，不把任何不完整节点传给图形层。
      sliceRowsToGraph(safeRows);
      setRows(safeRows);
      setExecutedName(candidate);
    } catch (err) {
      if (id !== requestId.current) return;
      setRows([]);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  return (
    <section className="rounded-xl border border-zinc-700 bg-zinc-950 p-4 text-zinc-100">
      <div className="mb-3">
        <h2 className="text-lg font-semibold">本体切片 · 真实 SQL 实验</h2>
        <p className="text-xs text-zinc-400">只读查询 main.users + main.fiat_transactions；图谱始终来自本次 SQL 返回行。</p>
      </div>
      <form onSubmit={run} className="flex gap-2 mb-3">
        <label htmlFor="lesson5-username" className="sr-only">用户名</label>
        <input id="lesson5-username" value={name} onChange={e => onNameChange(e.target.value)}
          placeholder="输入真实用户名，例如 Alice Chen" autoComplete="off"
          className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-cyan-500"/>
        <button disabled={loading} type="submit"
          className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {loading ? '查询中…' : '提取子图'}
        </button>
      </form>

      {error && <p role="alert" className="mb-3 rounded-md border border-red-800 bg-red-950 p-3 text-sm text-red-200">
        SQL 执行失败：{error}。请确认当前数据库存在 main.users 与 main.fiat_transactions，且两表已导入真实数据。
      </p>}
      {!loading && executedName && rows.length === 0 && !error && (
        <p className="rounded-md bg-zinc-900 p-3 text-sm">没有找到用户名“{executedName}”。图谱已清空。</p>
      )}
      {executedName && rows.length > 0 && (
        <>
          <div className="mb-3 flex flex-wrap gap-3 text-xs text-zinc-300">
            <span>当前用户：<strong>{executedName}</strong></span>
            <span>用户节点：<strong>{userNodes.length}</strong></span>
            <span>法币交易节点：<strong>{tradeNodes.length}</strong></span>
            <span>HAS_TRANSACTION：<strong>{graph.edges.length}</strong></span>
          </div>
          <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-[#101923]">
            <svg role="img" aria-label="根据当前 DuckDB SQL 结果生成的用户交易关系图"
              viewBox="0 0 720 470" width="100%" style={{ minWidth: 460, maxHeight: 520 }}>
              {graph.edges.map(edge => {
                const a = nodePositions.get(edge.source);
                const b = nodePositions.get(edge.target);
                if (!a || !b) return null;
                const active = selectedNodeId == null || selectedNodeId === edge.source || selectedNodeId === edge.target;
                return <g key={edge.id} opacity={active ? 0.9 : 0.16}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#5d90a9" strokeWidth={active ? 2 : 1}/>
                </g>;
              })}
              {graph.nodes.map(node => {
                const p = nodePositions.get(node.id)!;
                const isUser = node.type === 'User';
                const isSelected = selectedNodeId === node.id;
                const faded = selectedNodeId && !isSelected &&
                  !graph.edges.some(e => (e.source === selectedNodeId && e.target === node.id)
                    || (e.target === selectedNodeId && e.source === node.id));
                return <g key={node.id} transform={`translate(${p.x}, ${p.y})`}
                    opacity={faded ? 0.28 : 1} tabIndex={0} role="button"
                    aria-label={`${node.type} ${node.label}`}
                    onClick={() => setSelectedNodeId(isSelected ? null : node.id)}
                    onKeyDown={e => { if (e.key === 'Enter') setSelectedNodeId(isSelected ? null : node.id); }}
                    style={{ cursor: 'pointer' }}>
                  <rect x={-76} y={-27} width={152} height={54} rx={10}
                    stroke={isSelected ? '#facc15' : isUser ? '#60a5fa' : '#36b9a1'} strokeWidth={isSelected ? 3 : 1.5}
                    fill={isUser ? '#153350' : '#113d38'}/>
                  <text y={-8} textAnchor="middle" fill="#d4e4ec" fontSize="11" fontWeight="600">
                    {isUser ? 'User' : 'FiatTransaction'}
                  </text>
                  <text y={10} textAnchor="middle" fill="white" fontSize="12">
                    {isUser ? node.label.slice(0, 19) : `${amountText(node).slice(0, 19)}`}
                  </text>
                  <title>{node.id}{isUser ? '' : ` / ${node.status || '状态未知'}`}</title>
                </g>;
              })}
              {graph.nodes.length === 0 && <text x="360" y="235" textAnchor="middle" fill="#aaa">暂无可渲染节点</text>}
            </svg>
          </div>
          {selectedNode && <div className="mt-3 rounded-md border border-zinc-700 bg-zinc-900 p-3 text-xs">
            <strong>{selectedNode.type} · {selectedNode.id}</strong>
            {selectedNode.type === 'FiatTransaction' && <p className="mt-1">金额：{amountText(selectedNode)}　状态：{selectedNode.status ?? 'NULL'}</p>}
            {selectedNode.type === 'User' && <p className="mt-1">UID：{selectedNode.uid}</p>}
          </div>}
          <p className="mt-2 text-xs text-zinc-500">点击节点查看属性和关联。修改用户名后会立刻清空旧结果；点击“提取子图”重新查询 DuckDB。</p>
        </>
      )}
      <details className="mt-4 text-xs">
        <summary className="cursor-pointer text-zinc-400">查看实际执行的 SQL</summary>
        <pre className="mt-2 max-h-80 overflow-auto rounded-md bg-zinc-900 p-3 text-xs whitespace-pre-wrap">{lesson5Sql(name)}</pre>
      </details>
    </section>
  );
}