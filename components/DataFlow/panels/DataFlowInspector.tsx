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
  AlertCircle,
  Compass,
  Clock,
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
  dfBtnDanger,
  dfBtnPrimary,
  dfBtnSecondary,
  dfEmpty,
  dfEmptyHint,
  dfEmptyTitle,
  dfInput,
  dfLabel,
  dfSelect,
  dfTabActive,
  dfTabBase,
  dfTabIdle,
  dfTabUnderline,
  dfTextarea,
} from '../dataflowUi';
import type {
  AggregationField,
  AggregationFunction,
  AggregateNodeConfig,
  ExportNodeConfig,
  JoinNodeConfig,
  ResultNodeConfig,
  SqlTransformNodeConfig,
  SourceNodeConfig,
} from '../../../services/dataflow/workflowTypes';
import {
  dispatchDataflowCenterNode,
  dispatchFocusSqlEditor,
} from '../../../services/dataflow/dataflowEvents';

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
    dataFlowMode,
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
    if (inspectorTab !== 'preview' || !selectedNode) return;
    if (selectedNode.data?.executionResult?.rows && selectedNode.data.executionResult.rows.length > 0) return;

    const isSourceTable = selectedNode.data.type === 'source' && selectedNode.data.config?.tableName;
    const targetRelation = isSourceTable
      ? selectedNode.data.config.tableName
      : getNodeViewName(selectedNode.id);
    let cancelled = false;

    duckDBService
      .query(`SELECT * FROM "${targetRelation}" LIMIT 50`)
      .then(rows => {
        if (cancelled || !rows || rows.length === 0) return;
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
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : '预览查询失败';
        toastService.info(`暂无法自动预览：${msg}。可点击「运行节点」生成采样。`);
      });

    return () => {
      cancelled = true;
    };
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
    <div className="flex h-full w-full flex-col bg-monokai-surface text-monokai-fg font-sans select-none">
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
              <div className={dfEmpty}>
                <Table className="h-8 w-8 stroke-[1.2] text-monokai-border-strong mb-1" />
                <p className={dfEmptyTitle}>暂无采样数据</p>
                <p className={dfEmptyHint}>切换到此页会尝试自动拉取；若关系尚未创建，请先点击底部「运行节点」。</p>
              </div>
            )}
          </div>
        ) : inspectorTab === 'records' ? (
          /* 执行记录 Tab */
          <div className="space-y-3">
            <div className="text-xs font-semibold text-monokai-fg">节点历史执行记录</div>
            <div className="space-y-2">
              {runLogs.filter(l => l.nodeId === selectedNode.id).length === 0 ? (
                <div className={dfEmpty}>
                  <Clock className="h-8 w-8 stroke-[1.2] text-monokai-border-strong mb-1" />
                  <p className={dfEmptyTitle}>尚无执行记录</p>
                  <p className={dfEmptyHint}>点击底部「运行节点」后，耗时与行数将出现在此。</p>
                </div>
              ) : (
                runLogs
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
                  ))
              )}
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

            {/* 1. 若存在 Bug 或逻辑异常，展示醒目 Bug 溯源诊断卡片 */}
            {data.bugInfo && (
              <div className={`p-3 rounded-lg border space-y-2 ${
                data.bugInfo.hasBug || data.status === 'error'
                  ? 'bg-monokai-pink/10 border-monokai-pink/40 text-monokai-pink'
                  : 'bg-monokai-orange/10 border-monokai-orange/40 text-monokai-orange'
              }`}>
                <div className="flex items-center justify-between font-mono font-semibold text-xs">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{data.bugInfo.title}</span>
                  </div>
                  {data.bugInfo.suggestion && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(data.bugInfo!.suggestion);
                        toastService.success('已复制修复建议');
                      }}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-white/10 hover:bg-white/20 transition-colors cursor-pointer text-monokai-fg"
                      title="复制修复建议"
                    >
                      <Copy className="w-2.5 h-2.5" />
                      <span>复制建议</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] leading-relaxed text-monokai-fg/90">
                  {data.bugInfo.detail}
                </p>
                {data.bugInfo.suggestion && (
                  <div className="p-2 rounded bg-monokai-bg/80 border border-monokai-border text-[10.5px] font-mono text-monokai-accent leading-relaxed">
                    {data.bugInfo.suggestion}
                  </div>
                )}
                {data.sqlRange && (
                  <button
                    type="button"
                    onClick={() => {
                      useWorkflowStore.setState({ activeSqlRange: data.sqlRange });
                      dispatchFocusSqlEditor({ sqlRange: data.sqlRange });
                      toastService.info(`已定位并高亮 SQL 编辑器中对应错误行 (第 ${data.sqlRange!.startLine} 行)`);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded bg-monokai-pink/20 hover:bg-monokai-pink/30 border border-monokai-pink/50 text-xs font-bold text-monokai-pink transition-colors cursor-pointer"
                  >
                    <Code className="w-3.5 h-3.5" />
                    <span>返回 SQL 错误行修正 (第 {data.sqlRange.startLine} 行)</span>
                  </button>
                )}
                {data.bugInfo.fixedSql && (
                  <button
                    type="button"
                    onClick={() => {
                      useWorkflowStore.getState().syncFromSql(data.bugInfo!.fixedSql!, '修复后的 SQL', true);
                      dispatchFocusSqlEditor({
                        replaceSql: data.bugInfo!.fixedSql!,
                        sqlRange: data.sqlRange,
                      });
                      if (onOpenInSqlEditor) onOpenInSqlEditor(data.bugInfo!.fixedSql!, '修复后的 SQL');
                      toastService.success('已自动应用一键修复至当前 SQL 工作台');
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded bg-monokai-accent/15 hover:bg-monokai-accent/25 border border-monokai-accent/40 text-xs font-semibold text-monokai-accent transition-colors cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>一键应用修复至当前 SQL</span>
                  </button>
                )}
              </div>
            )}

            {/* 1.2 物理执行计划真实上下文剖析 (Real Execution Plan Context) */}
            <div className="p-3 rounded-lg bg-monokai-bg/70 border border-monokai-border space-y-2 text-xs font-sans">
              <div className="flex items-center justify-between text-monokai-fg font-semibold border-b border-monokai-border/60 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-monokai-yellow" />
                  <span>真实物理执行上下文</span>
                </div>
                <span className="font-mono text-[10.5px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-monokai-cyan">
                  {data.config?.operatorName || data.subtitle || data.type?.toUpperCase() || ''}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                {data.tableName && (
                  <div className="col-span-2 flex items-center justify-between p-1.5 rounded bg-monokai-surface/60 border border-white/5">
                    <span className="text-monokai-comment font-sans">输入数据源:</span>
                    <span className="text-monokai-blue font-bold truncate">{data.tableName}</span>
                  </div>
                )}

                <div className="flex flex-col p-1.5 rounded bg-monokai-surface/60 border border-white/5">
                  <span className="text-[10px] text-monokai-comment font-sans">数据吞吐变化</span>
                  <span className="text-monokai-fg font-bold mt-0.5">
                    {data.inputRowCount !== undefined ? `${data.inputRowCount.toLocaleString()} ➔ ` : ''}
                    {data.rowCount !== undefined ? `${data.rowCount.toLocaleString()} 行` : '—'}
                  </span>
                  {data.filterRatio !== undefined && (
                    <span className={`text-[9.5px] font-bold ${data.filterRatio >= 0 ? 'text-monokai-accent' : 'text-monokai-pink'}`}>
                      {data.filterRatio >= 0 ? `初筛削减 ↓${data.filterRatio}%` : `数据膨胀 ↑${Math.abs(data.filterRatio)}%`}
                    </span>
                  )}
                </div>

                <div className="flex flex-col p-1.5 rounded bg-monokai-surface/60 border border-white/5">
                  <span className="text-[10px] text-monokai-comment font-sans">物理耗时 / 占比</span>
                  <span className="text-monokai-fg font-bold mt-0.5">
                    {data.executionTimeSec !== undefined ? `${(data.executionTimeSec * 1000).toFixed(1)} ms` : '—'}
                  </span>
                  {data.config?.costPercent !== undefined && (
                    <span className={`text-[9.5px] font-bold ${data.config.isBottleneck ? 'text-monokai-pink animate-pulse' : 'text-monokai-yellow'}`}>
                      {data.config.isBottleneck ? '🔥 耗时瓶颈 ' : '开销占比 '}{data.config.costPercent}%
                    </span>
                  )}
                </div>
              </div>

              {/* 条件与谓词 */}
              {(data.predicate || data.joinSummary || data.groupBySummary) && (
                <div className="space-y-1 pt-1 border-t border-monokai-border/40 text-[10.5px] font-mono">
                  {data.predicate && (
                    <div className="p-1.5 rounded bg-monokai-orange/10 border border-monokai-orange/20 text-monokai-orange break-all">
                      <span className="font-bold mr-1">[下推初筛]</span>
                      {data.predicate}
                    </div>
                  )}
                  {data.joinSummary && (
                    <div className="p-1.5 rounded bg-monokai-pink/10 border border-monokai-pink/20 text-monokai-pink break-all">
                      <span className="font-bold mr-1">[连接条件]</span>
                      {data.joinSummary}
                    </div>
                  )}
                  {data.groupBySummary && (
                    <div className="p-1.5 rounded bg-monokai-yellow/10 border border-monokai-yellow/20 text-monokai-yellow break-all">
                      <span className="font-bold mr-1">[聚合分组]</span>
                      {data.groupBySummary}
                    </div>
                  )}
                </div>
              )}

              {/* 代码定位与一键跳转 */}
              {data.sqlRange && (
                <div className="pt-1 flex items-center justify-between">
                  <span className="text-monokai-comment text-[10px] font-mono">
                    对应代码: 第 {data.sqlRange.startLine} ~ {data.sqlRange.endLine} 行
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      useWorkflowStore.setState({ activeSqlRange: data.sqlRange });
                      window.dispatchEvent(new CustomEvent('focus_sql_editor', { detail: { sqlRange: data.sqlRange } }));
                      toastService.info(`已高亮定位至 SQL 第 ${data.sqlRange!.startLine} 行`);
                    }}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-monokai-cyan/15 hover:bg-monokai-cyan/25 border border-monokai-cyan/40 text-monokai-cyan text-[10.5px] font-semibold transition-colors cursor-pointer"
                    title="在 SQL 编辑器中高亮聚焦此步骤代码"
                  >
                    <Code className="w-3 h-3" />
                    <span>在编辑器高亮</span>
                  </button>
                </div>
              )}

              {/* 反向追溯数据流源头 */}
              <div className="pt-1.5 border-t border-monokai-border/40">
                <button
                  type="button"
                  onClick={() => {
                    useWorkflowStore.getState().traceReverseLineage(selectedNode.id);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded bg-monokai-accent/15 hover:bg-monokai-accent/25 border border-monokai-accent/40 text-xs font-semibold text-monokai-accent transition-colors cursor-pointer"
                  title="以当前算子为终点，反向高亮其所有依赖的底层数据源与流转路径"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>反向追溯此步骤的全部上游数据源</span>
                </button>
              </div>
            </div>

            {/* 1.5 阶段字段演变透镜卡片 */}
            {data.schemaEvolution && (
              <div className="p-3 rounded-lg bg-monokai-bg/60 border border-white/5 space-y-2 font-mono">
                <div className="flex items-center justify-between text-xs text-monokai-comment">
                  <span className="font-semibold text-monokai-cyan flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5" />
                    <span>阶段字段集演变透镜</span>
                  </span>
                  <span className="text-[10.5px] text-monokai-fg font-bold">
                    {data.schemaEvolution.inputColumns.length} 进 ➔ {data.schemaEvolution.outputColumns.length} 出
                  </span>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-start gap-1 text-monokai-comment">
                    <span className="shrink-0 text-monokai-fg-muted font-semibold">输入字段:</span>
                    <span className="text-monokai-fg truncate">{data.schemaEvolution.inputColumns.join(', ')}</span>
                  </div>
                  <div className="flex items-start gap-1 text-monokai-comment">
                    <span className="shrink-0 text-monokai-accent font-semibold">产出字段:</span>
                    <span className="text-monokai-fg truncate">{data.schemaEvolution.outputColumns.join(', ')}</span>
                  </div>
                  {data.schemaEvolution.droppedColumns && data.schemaEvolution.droppedColumns.length > 0 && (
                    <div className="flex items-start gap-1 text-[10px] text-monokai-pink bg-monokai-pink/10 p-1.5 rounded">
                      <span className="shrink-0 font-semibold">注销字段:</span>
                      <span>{data.schemaEvolution.droppedColumns.join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. SQL 运行套路与避坑指南卡片 */}
            {data.paradigm && (
              <div className="p-3 rounded-lg bg-monokai-surface border border-monokai-yellow/30 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-monokai-yellow font-mono">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>SQL 运行套路法则</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-monokai-yellow/15 border border-monokai-yellow/30 font-normal">
                    时序: Step {data.paradigm.executionOrder} / 7
                  </span>
                </div>
                <div className="text-[11px] text-monokai-fg/90 leading-relaxed">
                  <span className="font-semibold text-monokai-accent">【运行机制】</span>
                  {data.paradigm.mentalModel}
                </div>
                <div className="text-[11px] text-monokai-orange leading-relaxed bg-monokai-orange/10 p-2 rounded border border-monokai-orange/20">
                  <span className="font-semibold text-monokai-orange">【避坑实践】</span>
                  {data.paradigm.pitfallWarning}
                </div>
              </div>
            )}

            {/* 自由编排模式专属：节点名称与描述编辑 */}
            {dataFlowMode === 'custom' && (
              <>
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
              </>
            )}

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

            {/* ── 自由编排模式专属配置表单 (数据源选择 / 聚合增删 / 连接规则 / SQL 转换) ── */}
            {dataFlowMode === 'custom' && (
              <>
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
          </>
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

        {/* 重置 & 删除 (仅自由编排模式提供，真实 SQL 执行路径不暴露破坏性重置与删除) */}
        {dataFlowMode === 'custom' && (
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
        )}
      </div>
    </div>
  );
};
