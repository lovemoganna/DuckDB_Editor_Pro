/**
 * DataFlowInspector - 右侧节点属性与执行配置面板
 *
 * 严格按照终态图右侧面板实现：
 * - 顶部 Tab：[节点配置] (Active), [数据预览], [执行记录]
 * - 聚合统计配置：节点名称、描述、输入上游标记、分组字段增删、聚合字段增删、过滤条件 SQL
 * - 实时 SQL 预览 (代码高亮 + 复制)
 * - 底部主按钮：[▶ 运行节点] (绿色高亮) + [重置]
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Sigma,
  Copy,
  Maximize2,
  Play,
  RotateCcw,
  CheckCircle2,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  Database,
  Link,
  Code,
  Table,
  Upload,
  Layers,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Zap,
  Trash2,
} from 'lucide-react';
import { useWorkflowStore } from '../../../services/dataflow/workflowStore';
import {
  compileNodeSql,
  resolveNodeInputs,
  getNodeViewName,
} from '../../../services/dataflow/workflowCompiler';
import { duckDBService } from '../../../services/duckdbService';
import { toastService } from '../../../services/toastService';
import { useConfirmDialog } from '../../ui/ConfirmDialog';
import {
  dfBtnPrimary,
  dfEmpty,
  dfEmptyHint,
  dfEmptyTitle,
  dfTabActive,
  dfTabBase,
  dfTabIdle,
  dfTabUnderline,
} from '../dataflowUi';
import type {
  AggregationField,
  AggregationFunction,
  AggregateNodeConfig,
  JoinNodeConfig,
  SqlTransformNodeConfig,
  SourceNodeConfig,
} from '../../../services/dataflow/workflowTypes';

export interface DataFlowInspectorProps {
  onOpenInSqlEditor?: (sql: string, title?: string) => void;
}

export const DataFlowInspector: React.FC<DataFlowInspectorProps> = ({
  onOpenInSqlEditor,
}) => {
  const { confirm } = useConfirmDialog();
  const {
    nodes,
    edges,
    selectedNodeId,
    selectNode,
    updateNodeConfig,
    updateNodeData,
    runNode,
    deleteNode,
    isExecuting,
    inspectorTab,
    setInspectorTab,
    runLogs,
    availableTables,
    refreshAvailableTables,
  } = useWorkflowStore();

  const [copied, setCopied] = useState(false);
  const [filterExpanded, setFilterExpanded] = useState(true);
  const [explainPlan, setExplainPlan] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState<boolean>(false);

  const selectedNode = useMemo(() => {
    return nodes.find(n => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  // 解析输入依赖
  const inputs = useMemo(() => {
    if (!selectedNode) return { all: [] };
    return resolveNodeInputs(selectedNode.id, edges, nodes);
  }, [selectedNode, edges, nodes]);

  // 找到直接上游节点
  const upstreamNodes = useMemo(() => {
    if (!selectedNode) return [];
    const inEdges = edges.filter(e => e.target === selectedNode.id);
    return inEdges
      .map(e => nodes.find(n => n.id === e.source))
      .filter(Boolean) as typeof nodes;
  }, [selectedNode, edges, nodes]);

  // 找到直接下游节点
  const downstreamNodes = useMemo(() => {
    if (!selectedNode) return [];
    const outEdges = edges.filter(e => e.source === selectedNode.id);
    return outEdges
      .map(e => nodes.find(n => n.id === e.target))
      .filter(Boolean) as typeof nodes;
  }, [selectedNode, edges, nodes]);

  // 实时编译该节点的 SQL
  const compiledSql = useMemo(() => {
    if (!selectedNode) return '';
    const { sql } = compileNodeSql(selectedNode, inputs);
    return sql;
  }, [selectedNode, inputs]);

  // 当切换到数据预览且暂无采样数据时，自动从 DuckDB 视图或物理表实时拉取前 50 行
  useEffect(() => {
    if (inspectorTab === 'preview' && selectedNode && (!selectedNode.data?.executionResult?.rows || selectedNode.data.executionResult.rows.length === 0)) {
      const isSourceTable = selectedNode.data.type === 'source' && selectedNode.data.config?.tableName;
      const targetRelation = isSourceTable ? selectedNode.data.config.tableName : getNodeViewName(selectedNode.id);
      
      duckDBService.query(`SELECT * FROM "${targetRelation}" LIMIT 50`).then(rows => {
        if (rows && rows.length > 0) {
          const columns = Object.keys(rows[0]).map(k => ({
            name: k,
            type: typeof rows[0][k] === 'number' ? 'DOUBLE' : 'VARCHAR',
            nullable: true,
          }));
          updateNodeData(selectedNode.id, {
            rowCount: selectedNode.data.rowCount || rows.length,
            columnCount: columns.length,
            status: 'success',
            executionResult: {
              status: 'success',
              executionTimeSec: 0.05,
              rowCount: selectedNode.data.rowCount || rows.length,
              columnCount: columns.length,
              columns,
              rows,
              outputRelation: targetRelation,
            },
          });
        }
      }).catch(() => {});
    }
  }, [inspectorTab, selectedNode?.id, updateNodeData]);

  if (!selectedNode) {
    return (
      <div className={dfEmpty}>
        <Layers className="h-9 w-9 stroke-[1.2] text-monokai-border-strong mb-1" />
        <p className={dfEmptyTitle}>请在画布中选中一个节点</p>
        <p className={dfEmptyHint}>查看并配置节点属性、输入及 SQL 规则</p>
      </div>
    );
  }

  const { data } = selectedNode;
  const config = data.config || {};

  // 聚合节点专用配置
  const aggConfig = (data.type === 'aggregate' ? config : {}) as AggregateNodeConfig;
  const groupBy = aggConfig.groupBy || [];
  const aggregations = aggConfig.aggregations || [];
  const filter = aggConfig.filter || '';

  const handleCopySql = () => {
    if (!compiledSql) return;
    navigator.clipboard.writeText(compiledSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleExplainSql = async () => {
    if (!compiledSql) return;
    if (explainPlan) {
      setExplainPlan(null);
      return;
    }
    setIsExplaining(true);
    try {
      const res = await duckDBService.query(`EXPLAIN ${compiledSql}`);
      const planText = res.map((r: any) => Object.values(r).join(' ')).join('\n');
      setExplainPlan(planText || '未获取到执行计划输出');
    } catch (err: any) {
      setExplainPlan(`EXPLAIN 执行失败: ${err.message}`);
    } finally {
      setIsExplaining(false);
    }
  };

  const handleOpenInSqlEditor = () => {
    if (!compiledSql) {
      toastService.warning('当前节点未生成有效 SQL');
      return;
    }
    const title = `${selectedNode.data.title || 'dataflow'}.sql`;
    if (onOpenInSqlEditor) {
      onOpenInSqlEditor(compiledSql, title);
    } else {
      window.dispatchEvent(new CustomEvent('duckdb_execute_sql', { detail: { sql: compiledSql, title } }));
    }
    toastService.success(`已在 SQL 工作台中打开查询: ${title}`);
  };

  const handleRunCurrentNode = () => {
    if (selectedNode) {
      runNode(selectedNode.id);
    }
  };

  // 聚合配置增删改
  const handleAddGroupBy = () => {
    const upstreamCols = upstreamNodes[0]?.data.executionResult?.columns?.map(c => c.name) || [];
    const remaining = upstreamCols.filter(c => !groupBy.includes(c));
    const nextCol = remaining[0] || (upstreamCols[0] ? `${upstreamCols[0]}_${groupBy.length + 1}` : `col_${groupBy.length + 1}`);
    updateNodeConfig(selectedNode.id, {
      groupBy: [...groupBy, nextCol],
      rawSql: undefined, // 用户显式修改了可视化配置，清除 rawSql 以采用编译 SQL
    });
  };

  const handleRemoveGroupBy = (index: number) => {
    const next = [...groupBy];
    next.splice(index, 1);
    updateNodeConfig(selectedNode.id, { groupBy: next, rawSql: undefined });
  };

  const handleAddAggregation = () => {
    const upstreamCols = upstreamNodes[0]?.data.executionResult?.columns || [];
    const numericCol = upstreamCols.find(c =>
      ['DOUBLE', 'FLOAT', 'BIGINT', 'INTEGER', 'INT', 'DECIMAL', 'NUMERIC', 'HUGEINT'].some(t =>
        c.type?.toUpperCase().includes(t)
      )
    );
    const targetCol = numericCol ? numericCol.name : (upstreamCols[0]?.name || '*');

    const newAgg: AggregationField = {
      id: `agg_${Date.now().toString(36)}`,
      alias: `metric_${aggregations.length + 1}`,
      func: 'SUM',
      column: targetCol,
    };
    updateNodeConfig(selectedNode.id, {
      aggregations: [...aggregations, newAgg],
      rawSql: undefined,
    });
  };

  const handleRemoveAggregation = (index: number) => {
    const next = [...aggregations];
    next.splice(index, 1);
    updateNodeConfig(selectedNode.id, { aggregations: next, rawSql: undefined });
  };

  const handleUpdateAggregation = (
    index: number,
    patch: Partial<AggregationField>
  ) => {
    const next = [...aggregations];
    next[index] = { ...next[index], ...patch };
    updateNodeConfig(selectedNode.id, { aggregations: next, rawSql: undefined });
  };

  return (
    <div className="flex h-full w-full flex-col bg-monokai-surface text-monokai-fg font-sans select-none border-l border-monokai-border">
      {/* ── 顶部选项卡 ── */}
      <div className="flex h-9 shrink-0 border-b border-monokai-border px-3 gap-5">
        <button
          type="button"
          onClick={() => setInspectorTab('config')}
          className={`${dfTabBase} ${inspectorTab === 'config' ? dfTabActive : dfTabIdle}`}
        >
          节点配置
          {inspectorTab === 'config' && <span className={dfTabUnderline} />}
        </button>
        <button
          type="button"
          onClick={() => setInspectorTab('preview')}
          className={`${dfTabBase} ${inspectorTab === 'preview' ? dfTabActive : dfTabIdle}`}
        >
          数据预览
          {inspectorTab === 'preview' && <span className={dfTabUnderline} />}
        </button>
        <button
          type="button"
          onClick={() => setInspectorTab('records')}
          className={`${dfTabBase} ${inspectorTab === 'records' ? dfTabActive : dfTabIdle}`}
        >
          执行记录
          {inspectorTab === 'records' && <span className={dfTabUnderline} />}
        </button>
      </div>

      {/* ── 主配置滚动区 ── */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
        {inspectorTab === 'preview' ? (
          /* 数据预览 Tab */
          <div className="space-y-3">
            <div className="text-xs font-semibold text-monokai-fg flex items-center justify-between">
              <span>节点数据实时采样 (前 50 行)</span>
              <span className="text-2xs text-monokai-comment font-mono">
                {data.rowCount?.toLocaleString() || 0} 行 · {data.columnCount || 0} 列
              </span>
            </div>
            {data.executionResult?.rows && data.executionResult.rows.length > 0 ? (
              <div className="max-h-[500px] overflow-auto rounded border border-monokai-border bg-monokai-bg">
                <table className="w-full text-left font-mono text-meta border-collapse">
                  <thead>
                    <tr className="border-b border-monokai-border bg-monokai-surface text-monokai-fg-muted">
                      {data.executionResult.columns.map(col => (
                        <th key={col.name} className="p-2 font-medium">
                          <div>{col.name}</div>
                          <div className="text-3xs text-monokai-comment font-normal">{col.type}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.executionResult.rows.map((row, idx) => (
                      <tr key={idx} className="border-b border-monokai-border/40 hover:bg-white/[0.02]">
                        {data.executionResult!.columns.map(col => (
                          <td key={col.name} className="p-2 text-monokai-fg truncate max-w-[140px]">
                            {String(row[col.name] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded border border-dashed border-monokai-border p-6 text-center text-xs text-monokai-comment">
                暂无采样数据。请先点击「运行节点」触发真实查询。
              </div>
            )}
          </div>
        ) : inspectorTab === 'records' ? (
          /* 执行记录 Tab */
          <div className="space-y-3">
            <div className="text-xs font-semibold text-monokai-fg">节点历史执行记录</div>
            <div className="space-y-2">
              {runLogs
                .filter(l => l.nodeId === selectedNode.id)
                .map(log => (
                  <div
                    key={log.id}
                    className="rounded border border-monokai-border bg-monokai-bg p-2.5 text-xs font-mono"
                  >
                    <div className="flex items-center justify-between text-monokai-comment text-2xs">
                      <span>{log.timestamp}</span>
                      <span className={log.status === 'success' ? 'text-monokai-accent' : 'text-monokai-pink'}>
                        {log.status === 'success' ? '✔ 成功' : '✖ 失败'}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-monokai-fg">
                      <span>耗时: {log.duration}</span>
                      <span>输出: {log.rows.toLocaleString()} 行</span>
                    </div>
                    <div className="mt-1 text-meta text-monokai-fg-muted">{log.message}</div>
                  </div>
                ))}
            </div>
          </div>
        ) : (
          /* 节点配置 Tab (默认) */
          <>
            {/* 标题与状态 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-monokai-yellow font-mono">
                  {data.type === 'aggregate' ? '∑' : data.type === 'join' ? '⋈' : data.type === 'source' ? '⛁' : data.type === 'result' ? '▦' : 'λ'}
                </span>
                <span className="text-xs font-semibold text-monokai-fg">{data.title}</span>
              </div>
              <div className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-2xs font-medium ${
                data.status === 'success'
                  ? 'border-monokai-accent/30 bg-monokai-accent/10 text-monokai-accent'
                  : data.status === 'error'
                  ? 'border-monokai-pink/30 bg-monokai-pink/10 text-monokai-pink'
                  : data.status === 'dirty'
                  ? 'border-monokai-orange/30 bg-monokai-orange/10 text-monokai-orange'
                  : 'border-monokai-border bg-monokai-surface text-monokai-comment'
              }`}>
                <CheckCircle2 className="h-3 w-3" />
                <span>{data.status === 'success' ? '已完成' : data.status === 'error' ? '错误' : data.status === 'dirty' ? '需重跑' : '已配置'}</span>
                {data.executionTimeSec !== undefined && (
                  <span className="font-mono text-monokai-comment">
                    {data.executionTimeSec}s
                  </span>
                )}
              </div>
            </div>

            {/* 节点名称 */}
            <div>
              <label className="block text-meta font-medium text-monokai-comment mb-1">
                节点名称
              </label>
              <input
                type="text"
                value={data.title}
                onChange={e => updateNodeData(selectedNode.id, { title: e.target.value })}
                className="w-full rounded-md border border-monokai-border bg-monokai-bg px-2 py-1 text-meta text-monokai-fg outline-none focus:border-monokai-accent"
              />
            </div>

            {/* 描述结构 */}
            <div>
              <label className="block text-meta font-medium text-monokai-comment mb-1">
                描述结构
              </label>
              <input
                type="text"
                value={data.subtitle || ''}
                placeholder="按国家和品类汇总销售额、订单量和客户数"
                onChange={e => updateNodeData(selectedNode.id, { subtitle: e.target.value })}
                className="w-full rounded-md border border-monokai-border bg-monokai-bg px-2 py-1 text-meta text-monokai-fg outline-none focus:border-monokai-accent"
              />
            </div>

            {/* ── 双向血缘关系卡片 (上游来源 + 下游去向) ── */}
            <div className="space-y-2">
              <label className="block text-meta font-medium text-monokai-comment">
                血缘拓扑关联 ({upstreamNodes.length} 个上游来源 · {downstreamNodes.length} 个下游去向)
              </label>

              {/* 上游来源列表 */}
              <div className="rounded border border-monokai-border bg-monokai-bg p-2 text-xs space-y-1.5">
                <div className="text-2xs text-monokai-comment font-mono flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-monokai-accent" />
                    <span>上游依赖来源</span>
                  </span>
                  <span>{upstreamNodes.length} 个</span>
                </div>
                {upstreamNodes.length > 0 ? (
                  <div className="space-y-1">
                    {upstreamNodes.map((un, i) => (
                      <button
                        key={un.id}
                        type="button"
                        onClick={() => selectNode(un.id)}
                        className="w-full flex items-center justify-between p-1.5 rounded bg-monokai-surface/80 hover:bg-monokai-elevated border border-monokai-border/70 cursor-pointer transition-colors text-left"
                        title="点击在画布中聚焦此上游节点"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="px-1 py-0.2 rounded bg-monokai-accent/15 text-monokai-accent text-3xs font-mono border border-monokai-accent/30">
                            {data.type === 'join' ? (i === 0 ? '左表' : '右表') : `输入 ${i + 1}`}
                          </span>
                          <span className="truncate font-mono text-meta text-monokai-fg font-medium">
                            {un.data.title}
                          </span>
                        </div>
                        <span className="text-2xs text-monokai-comment font-mono shrink-0 ml-1">
                          {un.data.rowCount?.toLocaleString() ?? 0} 行
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-2xs text-monokai-comment py-1 text-center font-mono">
                    根数据源 · 无前置依赖
                  </div>
                )}
              </div>

              {/* 下游去向列表 */}
              <div className="rounded border border-monokai-border bg-monokai-bg p-2 text-xs space-y-1.5">
                <div className="text-2xs text-monokai-comment font-mono flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-monokai-cyan" />
                    <span>下游去向节点</span>
                  </span>
                  <span>{downstreamNodes.length} 个</span>
                </div>
                {downstreamNodes.length > 0 ? (
                  <div className="space-y-1">
                    {downstreamNodes.map(dn => (
                      <button
                        key={dn.id}
                        type="button"
                        onClick={() => selectNode(dn.id)}
                        className="w-full flex items-center justify-between p-1.5 rounded bg-monokai-surface/80 hover:bg-monokai-elevated border border-monokai-border/70 cursor-pointer transition-colors text-left"
                        title="点击在画布中聚焦此下游节点"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="px-1 py-0.2 rounded bg-monokai-cyan/15 text-monokai-cyan text-3xs font-mono border border-monokai-cyan/30">
                            {dn.data.type}
                          </span>
                          <span className="truncate font-mono text-meta text-monokai-fg font-medium">
                            {dn.data.title}
                          </span>
                        </div>
                        <span className="text-2xs text-monokai-comment font-mono shrink-0 ml-1">
                          {dn.data.rowCount?.toLocaleString() ?? 0} 行
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-2xs text-monokai-comment py-1 text-center font-mono">
                    终端结果节点 · 无下游消费
                  </div>
                )}
              </div>
            </div>

            {/* ── 数据源节点专用配置 (深度绑定真实 DuckDB 工作区) ── */}
            {data.type === 'source' && (
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-meta font-medium text-monokai-comment">
                      选择 DuckDB 工作区数据表
                    </label>
                    <button
                      type="button"
                      onClick={refreshAvailableTables}
                      className="text-2xs text-monokai-comment hover:text-monokai-accent flex items-center gap-1 transition-colors"
                      title="刷新工作区数据表列表"
                    >
                      <RefreshCw className="h-2.5 w-2.5" />
                      <span>刷新表</span>
                    </button>
                  </div>
                  <select
                    value={(config as SourceNodeConfig)?.tableName || ''}
                    onChange={async (e) => {
                      const selectedTable = e.target.value;
                      if (!selectedTable) return;
                      try {
                        const countRes = await duckDBService.query(`SELECT COUNT(*) as cnt FROM "${selectedTable}"`);
                        const rowCount = Number(countRes[0]?.cnt ?? 0);
                        const descRes = await duckDBService.query(`DESCRIBE "${selectedTable}"`);
                        const columnCount = descRes.length;
                        updateNodeConfig(selectedNode.id, { tableName: selectedTable, filePath: undefined, fileType: undefined });
                        updateNodeData(selectedNode.id, {
                          title: selectedTable,
                          subtitle: `DuckDB 表 · ${columnCount} 字段`,
                          rowCount,
                          columnCount,
                          status: 'configured',
                        });
                        toastService.success(`已绑定表 ${selectedTable} (${rowCount} 行)`);
                      } catch (err: any) {
                        toastService.error(`读取表 ${selectedTable} 失败: ${err.message}`);
                      }
                    }}
                    className="w-full rounded-md border border-monokai-border bg-monokai-bg px-2 py-1 text-meta text-monokai-yellow font-mono outline-none cursor-pointer"
                  >
                    <option value="">-- 选择已挂载数据表或视图 --</option>
                    {availableTables.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {(config as SourceNodeConfig)?.tableName && (
                  <div className="rounded border border-monokai-border/60 bg-monokai-bg/70 p-2.5 text-xs font-mono space-y-1.5">
                    <div className="flex items-center justify-between text-monokai-fg">
                      <span className="text-monokai-comment">当前表:</span>
                      <span className="font-semibold text-monokai-accent">{(config as SourceNodeConfig).tableName}</span>
                    </div>
                    <div className="flex items-center justify-between text-monokai-comment text-meta">
                      <span>真实行数:</span>
                      <span className="text-monokai-fg">{data.rowCount?.toLocaleString() ?? 0} 行</span>
                    </div>
                    <div className="flex items-center justify-between text-monokai-comment text-meta">
                      <span>真实列数:</span>
                      <span className="text-monokai-fg">{data.columnCount ?? 0} 列</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── 查看 Schema 节点配置 ── */}
            {data.type === 'schema' && (
              <div className="space-y-2">
                <label className="block text-meta font-medium text-monokai-comment">
                  上游字段结构清单
                </label>
                {data.executionResult?.columns && data.executionResult.columns.length > 0 ? (
                  <div className="max-h-48 overflow-y-auto rounded border border-monokai-border bg-monokai-bg p-2 font-mono text-meta space-y-1 custom-scrollbar">
                    {data.executionResult.columns.map((col, idx) => (
                      <div key={idx} className="flex items-center justify-between py-0.5 border-b border-monokai-border/30 last:border-0">
                        <span className="text-monokai-fg truncate">{col.name}</span>
                        <span className="text-2xs text-monokai-comment">{col.type}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-meta text-monokai-comment p-2 rounded border border-dashed border-monokai-border text-center">
                    请连接上游数据节点并运行
                  </div>
                )}
              </div>
            )}

            {/* ── 聚合专用配置表单 ── */}
            {data.type === 'aggregate' && (
              <>
                {/* 分组字段 */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-meta font-medium text-monokai-comment">
                      分组字段
                    </label>
                  </div>
                  <div className="space-y-1">
                    {groupBy.map((col, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded border border-monokai-border bg-monokai-bg px-2 py-1 text-xs"
                      >
                        <div className="flex items-center gap-1.5 font-mono text-monokai-fg text-meta">
                          <Table className="h-3 w-3 text-monokai-comment" />
                          <span>{col}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-2xs text-monokai-comment">分组键</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveGroupBy(idx)}
                            className="text-monokai-comment hover:text-monokai-pink"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={handleAddGroupBy}
                      className="flex w-full items-center justify-center gap-1 rounded border border-dashed border-monokai-border py-1 text-meta text-monokai-comment hover:border-monokai-accent hover:text-monokai-accent transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      <span>添加分组字段</span>
                    </button>
                  </div>
                </div>

                {/* 聚合字段 */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-meta font-medium text-monokai-comment">
                      聚合字段
                    </label>
                  </div>
                  <div className="space-y-1">
                    {aggregations.map((agg, idx) => (
                      <div
                        key={agg.id || idx}
                        className="flex items-center gap-1.5 rounded border border-monokai-border bg-monokai-bg px-2 py-1 text-xs"
                      >
                        {/* 字段名或别名 */}
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                          <Table className="h-2.5 w-2.5 text-monokai-comment shrink-0" />
                          <input
                            type="text"
                            value={agg.alias}
                            onChange={e => handleUpdateAggregation(idx, { alias: e.target.value })}
                            className="w-full rounded bg-transparent font-mono text-meta text-monokai-fg outline-none focus:text-monokai-accent truncate"
                          />
                        </div>
                        {/* 聚合函数 */}
                        <select
                          value={agg.func}
                          onChange={e =>
                            handleUpdateAggregation(idx, {
                              func: e.target.value as AggregationFunction,
                            })
                          }
                          className="rounded border border-monokai-border/60 bg-monokai-surface px-1 py-0.5 font-mono text-2xs text-monokai-yellow outline-none cursor-pointer"
                        >
                          <option value="SUM">SUM</option>
                          <option value="COUNT">COUNT</option>
                          <option value="COUNT(DISTINCT)">COUNT(DISTINCT)</option>
                          <option value="AVG">AVG</option>
                          <option value="MIN">MIN</option>
                          <option value="MAX">MAX</option>
                        </select>
                        {/* 来源字段 */}
                        <input
                          type="text"
                          value={agg.column}
                          onChange={e => handleUpdateAggregation(idx, { column: e.target.value })}
                          className="w-24 rounded bg-transparent font-mono text-meta text-monokai-fg-muted outline-none focus:text-monokai-fg text-right"
                        />
                        {/* 移除 */}
                        <button
                          type="button"
                          onClick={() => handleRemoveAggregation(idx)}
                          className="p-0.5 text-monokai-comment hover:text-monokai-pink transition-colors ml-0.5"
                        >
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={handleAddAggregation}
                      className="flex w-full items-center justify-center gap-1 rounded border border-dashed border-monokai-border py-1 text-meta text-monokai-comment hover:border-monokai-accent hover:text-monokai-accent transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      <span>添加聚合字段</span>
                    </button>
                  </div>
                </div>

                {/* 过滤条件 (可选) */}
                <div>
                  <button
                    type="button"
                    onClick={() => setFilterExpanded(!filterExpanded)}
                    className="flex w-full items-center justify-between text-meta font-medium text-monokai-comment hover:text-monokai-fg mb-1"
                  >
                    <span className="flex items-center gap-1">
                      {filterExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      过滤条件 (可选)
                    </span>
                  </button>
                  {filterExpanded && (
                    <div className="flex rounded border border-monokai-border bg-monokai-bg overflow-hidden font-mono text-meta">
                      <div className="bg-monokai-surface/60 px-2 py-1 text-monokai-comment select-none text-right border-r border-monokai-border/40 text-2xs leading-relaxed">
                        <div>1</div>
                        <div>2</div>
                      </div>
                      <textarea
                        rows={2}
                        value={filter}
                        onChange={e => updateNodeConfig(selectedNode.id, { filter: e.target.value })}
                        placeholder="order_date >= '2024-01-01'&#10;AND order_date < '2025-01-01'"
                        className="flex-1 resize-none bg-transparent p-1.5 text-meta text-monokai-fg outline-none placeholder:text-monokai-comment leading-relaxed font-mono"
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── SQL 转换节点配置 ── */}
            {data.type === 'sql_transform' && (
              <div>
                <label className="block text-meta font-medium text-monokai-comment mb-1">
                  转换 SQL 表达式 (支持 {'{{input}}'} 占位符)
                </label>
                <div className="rounded border border-monokai-border bg-monokai-bg p-2 font-mono text-xs">
                  <textarea
                    rows={4}
                    value={(config as SqlTransformNodeConfig)?.sql || ''}
                    onChange={e => updateNodeConfig(selectedNode.id, { sql: e.target.value })}
                    className="w-full resize-none bg-transparent text-meta text-monokai-fg outline-none font-mono"
                  />
                </div>
              </div>
            )}

            {/* ── 表连接节点配置 ── */}
            {data.type === 'join' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-meta font-medium text-monokai-comment mb-1">
                    连接类型
                  </label>
                  <select
                    value={(config as JoinNodeConfig)?.joinType || 'INNER'}
                    onChange={e => updateNodeConfig(selectedNode.id, { joinType: e.target.value })}
                    className="w-full rounded border border-monokai-border bg-monokai-bg px-2 py-1.5 text-xs text-monokai-pink font-mono outline-none cursor-pointer"
                  >
                    <option value="INNER">INNER JOIN (内连接)</option>
                    <option value="LEFT">LEFT JOIN (左外连接)</option>
                    <option value="RIGHT">RIGHT JOIN (右外连接)</option>
                    <option value="FULL">FULL OUTER JOIN (全外连接)</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-meta font-medium text-monokai-comment">
                      关联键条件 (ON 左表 = 右表)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const currConds = (config as JoinNodeConfig)?.conditions || [];
                        const newId = `c_${Date.now()}`;
                        updateNodeConfig(selectedNode.id, {
                          conditions: [...currConds, { id: newId, leftColumn: '', rightColumn: '' }],
                        });
                      }}
                      className="text-2xs text-monokai-accent hover:underline flex items-center gap-0.5"
                    >
                      <Plus className="w-2.5 h-2.5" />
                      <span>添加条件</span>
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {((config as JoinNodeConfig)?.conditions || []).map((cond, idx) => (
                      <div key={cond.id || idx} className="flex items-center gap-1 rounded border border-monokai-border bg-monokai-bg p-1.5 text-xs font-mono">
                        <input
                          type="text"
                          value={cond.leftColumn}
                          placeholder="左表字段"
                          list="join-left-cols"
                          onChange={e => {
                            const newConds = [...(config as JoinNodeConfig).conditions];
                            newConds[idx] = { ...newConds[idx], leftColumn: e.target.value };
                            updateNodeConfig(selectedNode.id, { conditions: newConds });
                          }}
                          className="flex-1 rounded bg-monokai-surface px-1.5 py-0.5 text-meta text-monokai-cyan outline-none border border-monokai-border"
                        />
                        <span className="text-monokai-comment font-bold text-xs">=</span>
                        <input
                          type="text"
                          value={cond.rightColumn}
                          placeholder="右表字段"
                          list="join-right-cols"
                          onChange={e => {
                            const newConds = [...(config as JoinNodeConfig).conditions];
                            newConds[idx] = { ...newConds[idx], rightColumn: e.target.value };
                            updateNodeConfig(selectedNode.id, { conditions: newConds });
                          }}
                          className="flex-1 rounded bg-monokai-surface px-1.5 py-0.5 text-meta text-monokai-accent outline-none border border-monokai-border"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newConds = (config as JoinNodeConfig).conditions.filter((_, i) => i !== idx);
                            updateNodeConfig(selectedNode.id, { conditions: newConds });
                          }}
                          className="p-1 text-monokai-comment hover:text-monokai-pink transition-colors"
                          title="删除此关联条件"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <datalist id="join-left-cols">
                      {upstreamNodes[0]?.data.executionResult?.columns?.map(c => (
                        <option key={c.name} value={c.name} />
                      ))}
                    </datalist>
                    <datalist id="join-right-cols">
                      {upstreamNodes[1]?.data.executionResult?.columns?.map(c => (
                        <option key={c.name} value={c.name} />
                      ))}
                    </datalist>
                  </div>
                </div>
              </div>
            )}

            {/* ── SQL 预览模块 (双向打通 SQL 工作台与 EXPLAIN) ── */}
            <div>
              <div className="flex items-center justify-between text-meta font-medium text-monokai-comment mb-1">
                <span className="flex items-center gap-1 text-monokai-fg font-semibold">
                  <ChevronRight className="h-3 w-3 text-monokai-accent" />
                  <span>SQL 预览</span>
                  <span className="text-2xs text-monokai-comment font-normal">(工作台联动)</span>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleExplainSql}
                    disabled={isExplaining}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border text-2xs text-monokai-cyan transition-colors cursor-pointer"
                    title="查看此节点在 DuckDB 中的执行计划 (EXPLAIN)"
                  >
                    <Zap className="h-2.5 w-2.5" />
                    <span>{isExplaining ? '分析中' : '执行计划'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenInSqlEditor}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-monokai-accent/15 hover:bg-monokai-accent/30 border border-monokai-accent/40 text-2xs text-monokai-accent font-medium transition-colors cursor-pointer"
                    title="在 SQL 工作台中新建标签页并立即执行此 SQL"
                  >
                    <ExternalLink className="h-2.5 w-2.5" />
                    <span>在 SQL 中打开</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopySql}
                    className="text-monokai-comment hover:text-monokai-fg p-0.5 rounded"
                    title="复制完整 SQL"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {explainPlan && (
                <div className="mb-2 p-2 rounded border border-monokai-border bg-monokai-bg font-mono text-2xs text-monokai-cyan leading-relaxed max-h-36 overflow-y-auto custom-scrollbar">
                  <div className="text-2xs text-monokai-comment mb-1 flex items-center justify-between">
                    <span>⚡ DuckDB 执行计划 (EXPLAIN 输出):</span>
                    <button type="button" onClick={() => setExplainPlan(null)} className="text-monokai-comment hover:text-monokai-fg">✕ 关闭</button>
                  </div>
                  <pre className="whitespace-pre-wrap">{explainPlan}</pre>
                </div>
              )}

              <div className="relative rounded border border-monokai-border bg-monokai-bg p-2 font-mono text-2xs leading-relaxed text-monokai-fg-muted overflow-x-auto max-h-40 custom-scrollbar">
                {copied && (
                  <div className="absolute right-2 top-2 rounded bg-monokai-accent/20 px-1.5 py-0.5 text-3xs text-monokai-accent">
                    已复制
                  </div>
                )}
                {compiledSql ? (
                  compiledSql.split('\n').map((line, idx) => {
                    const tokens = line.split(/(\b(?:SELECT|FROM|WHERE|GROUP BY|ORDER BY|AS|AND|OR|INNER JOIN|LEFT JOIN|RIGHT JOIN|FULL JOIN|JOIN|ON|EXCLUDE)\b|\b(?:SUM|COUNT|AVG|MIN|MAX|ROUND|DISTINCT)\b|'[^']*'|\d+)/gi);
                    return (
                      <div key={idx} className="whitespace-pre">
                        {tokens.map((token, tIdx) => {
                          const upper = token.toUpperCase();
                          if (['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'AS', 'AND', 'OR', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'JOIN', 'ON', 'EXCLUDE'].includes(upper)) {
                            return <span key={tIdx} className="text-monokai-pink font-semibold">{token}</span>;
                          }
                          if (['SUM', 'COUNT', 'AVG', 'MIN', 'MAX', 'ROUND', 'DISTINCT'].includes(upper)) {
                            return <span key={tIdx} className="text-monokai-yellow">{token}</span>;
                          }
                          if (token.startsWith("'") && token.endsWith("'")) {
                            return <span key={tIdx} className="text-monokai-yellow">{token}</span>;
                          }
                          if (/^\d+$/.test(token)) {
                            return <span key={tIdx} className="text-monokai-amethyst">{token}</span>;
                          }
                          return <span key={tIdx} className="text-monokai-fg">{token}</span>;
                        })}
                      </div>
                    );
                  })
                ) : (
                  <span className="text-monokai-comment">暂无可执行 SQL</span>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── 底部操作栏 ── */}
      <div className="shrink-0 border-t border-monokai-border bg-monokai-surface p-3 space-y-2">
        {/* 运行节点 */}
        <button
          type="button"
          onClick={handleRunCurrentNode}
          disabled={isExecuting}
          className={`w-full ${dfBtnPrimary}`}
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          <span>{isExecuting ? '执行中...' : '运行节点'}</span>
        </button>

        {/* 重置 & 删除 */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (selectedNode) {
                // 重置为该节点类型的初始配置（清除 rawSql、聚合字段等）
                updateNodeConfig(selectedNode.id, {
                  groupBy: [],
                  aggregations: [],
                  filter: '',
                  rawSql: undefined,
                  conditions: [],
                });
                toastService.info(`节点 "${selectedNode.data.title}" 配置已重置`);
              }
            }}
            className="flex-1 flex items-center justify-center gap-1 rounded border border-monokai-border bg-monokai-elevated px-3 py-1.5 text-xs text-monokai-fg-muted hover:bg-monokai-border hover:text-monokai-fg transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            <span>重置配置</span>
          </button>
          <button
            type="button"
            onClick={async () => {
              if (selectedNode) {
                const confirmed = await confirm({
                  title: '删除节点',
                  message: `确认删除节点「${selectedNode.data.title}」？\n相关连线也将一并移除。`,
                  variant: 'danger',
                });
                if (confirmed) {
                  deleteNode(selectedNode.id);
                  toastService.info(`节点 "${selectedNode.data.title}" 已删除`);
                }
              }
            }}
            className="flex items-center justify-center gap-1 rounded border border-monokai-pink/40 bg-monokai-pink/10 px-3 py-1.5 text-xs text-monokai-pink hover:bg-monokai-pink/20 hover:border-monokai-pink/70 transition-colors cursor-pointer"
            title="从画布中删除此节点及相关连线"
          >
            <Trash2 className="h-3 w-3" />
            <span>删除节点</span>
          </button>
        </div>
      </div>
    </div>
  );
};
