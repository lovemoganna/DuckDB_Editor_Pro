/**
 * DataFlowInspector - 右侧节点属性抽屉
 *
 * 布局与交互对齐【本体图谱-实体画布】属性面板：
 * - 绝对覆盖式抽屉头部（图标 + 标题 + 快捷按钮 + 关闭）
 * - 分区标题 uppercase tracking-wider
 * - 三格快捷操作：运行 / 打开 SQL / 反向追溯
 * - Tab：节点配置 / 数据预览 / 执行记录
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Copy,
  Play,
  CheckCircle2,
  Code,
  Table,
  Layers,
  ExternalLink,
  Zap,
  AlertCircle,
  Compass,
  Clock,
  X,
  Maximize2,
} from 'lucide-react';
import { useWorkflowStore } from '../../../services/dataflow/workflowStore';
import { DataFlowNodeConfig } from './DataFlowNodeConfig';
import { LogicalFlowInspector } from './LogicalFlowInspector';
import {
  compileNodeSql,
  resolveNodeInputs,
  getNodeViewName,
} from '../../../services/dataflow/workflowCompiler';
import { duckDBService } from '../../../services/duckdbService';
import { toastService } from '../../../services/toastService';
import {
  DF_STATUS_LABEL,
  dfBtnPrimary,
  dfDrawerActionTile,
  dfDrawerSectionLabel,
  dfEmpty,
  dfEmptyHint,
  dfEmptyTitle,
  dfPanelHeader,
  dfPanelTitle,
  dfTabActive,
  dfTabBase,
  dfTabIdle,
  dfTabUnderline,
  dfTable,
  dfTableHead,
  dfTableRow,
} from '../dataflowUi';
import {
  dispatchDataflowCenterNode,
  dispatchFocusSqlEditor,
} from '../../../services/dataflow/dataflowEvents';

export interface DataFlowInspectorProps {
  onOpenInSqlEditor?: (sql: string, title?: string) => void;
  onClose?: () => void;
}

export const DataFlowInspector: React.FC<DataFlowInspectorProps> = ({
  onOpenInSqlEditor,
  onClose,
}) => {
  const {
    nodes,
    edges,
    selectedNodeId,
    selectNode,
    runNode,
    isExecuting,
    inspectorTab,
    setInspectorTab,
    runLogs,
  } = useWorkflowStore();

  const [copied, setCopied] = useState(false);
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

  // 实时编译该节点的真实 SQL（保证为完整可执行的查询语句）
  const compiledSql = useMemo(() => {
    if (!selectedNode) return '';
    const tableName = (selectedNode.data.config as any)?.tableName || selectedNode.data.tableName;
    if (selectedNode.data.type === 'source' && tableName) {
      return `SELECT * FROM "${tableName.replace(/"/g, '""')}"`;
    }
    const { sql, error } = compileNodeSql(selectedNode, inputs);
    if (useWorkflowStore.getState().dataFlowMode === 'custom' && error) return '';
    if (sql && /^\s*(SELECT|WITH|DESCRIBE|EXPLAIN)\b/i.test(sql)) {
      return sql.trim();
    }
    if (selectedNode.data.sqlSnippet && /^\s*(SELECT|WITH)\b/i.test(selectedNode.data.sqlSnippet)) {
      return selectedNode.data.sqlSnippet.trim();
    }
    if (tableName) {
      return `SELECT * FROM "${tableName.replace(/"/g, '""')}"`;
    }
    return (useWorkflowStore.getState().activeSql || '').trim();
  }, [selectedNode, inputs]);

  // Reset transient feedback when changing nodes; never show another node's EXPLAIN.
  useEffect(() => {
    setCopied(false);
    setExplainPlan(null);
    setIsExplaining(false);
  }, [selectedNodeId]);

  const typeLabel = useMemo(() => {
    if (!selectedNode) return '算子';
    const t = selectedNode.data.type as string;
    if (t === 'aggregate') return '聚合统计';
    if (t === 'join') return '表连接';
    if (t === 'source') return '数据源';
    if (t === 'result') return '结果输出';
    if (t === 'filter' || selectedNode.data.sqlStage === 'where') return '条件过滤';
    if (t === 'sort') return '结果排序';
    if (t === 'window') return '开窗分析';
    return '数据转换';
  }, [selectedNode]);

  const opSymbol = useMemo(() => {
    if (!selectedNode) return 'λ';
    const t = selectedNode.data.type as string;
    if (t === 'aggregate') return '∑';
    if (t === 'join') return '⋈';
    if (t === 'source') return '⛁';
    if (t === 'result') return '▦';
    if (t === 'filter' || selectedNode.data.sqlStage === 'where') return 'σ';
    if (t === 'sort') return '⇅';
    if (t === 'window') return '⊞';
    return 'λ';
  }, [selectedNode]);

  if(selectedNode?.data.logicalKind&&useWorkflowStore.getState().dataFlowMode==='sql')return <LogicalFlowInspector node={selectedNode} onClose={onClose}/>;
  if (!selectedNode) {
    return (
      <div className="flex h-full w-full flex-col bg-monokai-bg/95 text-monokai-fg font-sans select-none">
        <div className={dfPanelHeader}>
          <div className={dfPanelTitle}>
            <Layers className="w-3.5 h-3.5 text-monokai-cyan shrink-0" />
            <span>属性详情</span>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded hover:bg-monokai-surface text-monokai-comment hover:text-monokai-fg transition-colors cursor-pointer"
              title="关闭属性抽屉"
              aria-label="关闭属性抽屉"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className={dfEmpty}>
          <div className="w-10 h-10 rounded-full bg-monokai-surface flex items-center justify-center mb-2">
            <Layers className="h-5 w-5 text-monokai-comment" />
          </div>
          <p className={dfEmptyTitle}>请在画布中选中一个节点</p>
          <p className={dfEmptyHint}>查看算子属性、血缘关联与 SQL 执行上下文</p>
        </div>
      </div>
    );
  }

  const { data } = selectedNode;


  const handleCopySql = async () => {
    if (!compiledSql) return;
    try {
      await navigator.clipboard.writeText(compiledSql);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toastService.error('复制失败，请选中 SQL 手动复制');
    }
  };

  const handleExplainSql = async () => {
    if (!compiledSql) return;
    if (explainPlan) {
      setExplainPlan(null);
      return;
    }
    const explainingNodeId = selectedNode.id;
    setIsExplaining(true);
    try {
      const res = await duckDBService.query(`EXPLAIN ${compiledSql}`);
      if (useWorkflowStore.getState().selectedNodeId !== explainingNodeId) return;
      const planText = res.map((r: any) => Object.values(r).join(' ')).join('\n');
      setExplainPlan(planText || '未获取到执行计划输出');
    } catch (err: any) {
      if (useWorkflowStore.getState().selectedNodeId === explainingNodeId) setExplainPlan(`EXPLAIN 执行失败: ${err.message}`);
    } finally {
      if (useWorkflowStore.getState().selectedNodeId === explainingNodeId) setIsExplaining(false);
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
      window.dispatchEvent(new CustomEvent('duckdb_execute_sql', { detail: { sql: compiledSql, title, autoRun: false } }));
    }
    toastService.success(`已在 SQL 工作台中打开查询: ${title}`);
  };

  const handleRunCurrentNode = () => {
    if (selectedNode) {
      runNode(selectedNode.id);
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-monokai-bg/95 text-monokai-fg font-sans select-none">
      {/* ── 头部：统一 36px 高度，对齐 DataFlow 侧栏与顶栏 ── */}
      <div className={dfPanelHeader}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded-md bg-monokai-surface border border-monokai-border flex items-center justify-center font-bold text-monokai-yellow font-mono text-xs shrink-0">
            {opSymbol}
          </div>
          <span className="text-xs font-bold text-monokai-fg truncate max-w-[130px] font-mono" title={data.title}>
            {data.title || '节点属性'}
          </span>
          <span className="text-3xs font-mono px-1.5 py-0.5 rounded bg-monokai-surface border border-monokai-border text-monokai-cyan shrink-0 font-semibold">
            {typeLabel}
          </span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={handleCopySql}
            disabled={!compiledSql}
            className="p-1 rounded hover:bg-monokai-surface text-monokai-comment hover:text-monokai-fg transition-colors cursor-pointer disabled:opacity-40"
            title="复制节点 SQL"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-monokai-accent" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => {
              dispatchDataflowCenterNode({ nodeId: selectedNode.id });
            }}
            className="p-1 rounded hover:bg-monokai-surface text-monokai-comment hover:text-monokai-fg transition-colors cursor-pointer"
            title="聚焦到节点"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded hover:bg-monokai-surface text-monokai-comment hover:text-monokai-fg transition-colors cursor-pointer"
              title="关闭属性抽屉"
              aria-label="关闭属性抽屉"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── 顶部选项卡 ── */}
      <div className="flex h-9 shrink-0 border-b border-monokai-border px-4 gap-5 bg-monokai-bg/40">
        <button
          type="button"
          aria-pressed={inspectorTab === 'config'}
          onClick={() => setInspectorTab('config')}
          className={`${dfTabBase} ${inspectorTab === 'config' ? dfTabActive : dfTabIdle}`}
        >
          节点配置
          {inspectorTab === 'config' && <span className={dfTabUnderline} />}
        </button>
        <button
          type="button"
          aria-pressed={inspectorTab === 'preview'}
          onClick={() => setInspectorTab('preview')}
          className={`${dfTabBase} ${inspectorTab === 'preview' ? dfTabActive : dfTabIdle}`}
        >
          数据预览
          {inspectorTab === 'preview' && <span className={dfTabUnderline} />}
        </button>
        <button
          type="button"
          aria-pressed={inspectorTab === 'records'}
          onClick={() => setInspectorTab('records')}
          className={`${dfTabBase} ${inspectorTab === 'records' ? dfTabActive : dfTabIdle}`}
        >
          执行记录
          {inspectorTab === 'records' && <span className={dfTabUnderline} />}
        </button>
      </div>

      {/* ── 主配置滚动区 ── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3 min-h-0 select-text">
        {inspectorTab === 'preview' ? (
          /* 数据预览 Tab */
          <div className="space-y-3">
            {data.status === 'dirty' && <p role="status" className="text-meta text-monokai-orange">配置已修改，下方为上次执行结果，请重新运行。</p>}
            <div className="flex items-center justify-between">
              <span className={dfDrawerSectionLabel}>节点数据采样</span>
              <span className="text-[10px] text-monokai-comment font-mono">
                {data.rowCount?.toLocaleString() ?? '—'} 行 · {data.columnCount ?? '—'} 列
              </span>
            </div>
            {data.executionResult?.status === 'success' ? (
              <div className="max-h-[500px] overflow-auto rounded border border-monokai-border bg-monokai-bg">
                <table className={dfTable}>
                  <thead>
                    <tr className={dfTableHead}>
                      {data.executionResult.columns.map(col => (
                        <th key={col.name} className="p-2 font-medium">
                          <div>{col.name}</div>
                          <div className="text-3xs text-monokai-comment font-normal">{col.type}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.executionResult.rows.slice(0, 50).map((row, idx) => (
                      <tr key={idx} className={dfTableRow}>
                        {data.executionResult!.columns.map(col => (
                          <td key={col.name} className="p-2 text-monokai-fg truncate max-w-[140px]">
                            {row[col.name] == null ? <span className="text-monokai-comment italic">NULL</span> : String(row[col.name])}
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
                <p className={dfEmptyTitle}>{data.executionResult?.status === 'error' ? '采样执行失败' : '暂无采样数据'}</p>
                <p className={dfEmptyHint}>{data.executionResult?.errorMessage || '运行当前节点后显示真实查询结果，最多展示 50 行。'}</p>
                <button
                  type="button"
                  onClick={handleRunCurrentNode}
                  disabled={isExecuting}
                  className={`mt-2 ${dfBtnPrimary}`}
                >
                  <Play className="h-3 w-3 fill-current" />
                  <span>{isExecuting ? '采样计算中...' : '立即运行并采样'}</span>
                </button>
              </div>
            )}
          </div>
        ) : inspectorTab === 'records' ? (
          /* 执行记录 Tab */
          <div className="space-y-3">
            <span className={dfDrawerSectionLabel}>节点历史执行记录</span>
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
                  .slice().reverse()
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
                        <span>输出: {log.rows?.toLocaleString() ?? '—'} 行</span>
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
            <DataFlowNodeConfig nodeId={selectedNode.id} data={data} />
            {/* 算子类型（对齐实体画布「实体类型」区块） */}
            <div className="space-y-1">
              <span className={dfDrawerSectionLabel}>算子类型</span>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs font-mono font-bold tracking-wider px-2 py-0.5 rounded-lg bg-monokai-surface border border-monokai-border text-monokai-cyan">
                  {typeLabel}
                </span>
                {data.subtitle && (
                  <span className="text-xs text-monokai-comment italic truncate" title={data.subtitle}>
                    {data.subtitle}
                  </span>
                )}
                <span className={`ml-auto flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium shrink-0 ${
                  data.status === 'success'
                    ? 'border-monokai-accent/30 bg-monokai-accent/10 text-monokai-accent'
                    : data.status === 'error'
                    ? 'border-monokai-pink/30 bg-monokai-pink/10 text-monokai-pink'
                    : data.status === 'dirty'
                    ? 'border-monokai-orange/30 bg-monokai-orange/10 text-monokai-orange'
                    : 'border-monokai-border bg-monokai-surface text-monokai-comment'
                }`}>
                  {data.status === 'error' || data.status === 'blocked'
                    ? <AlertCircle className="h-3 w-3" />
                    : data.status === 'success' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                  <span>
                    {DF_STATUS_LABEL[data.status] || '待执行'}
                  </span>
                  {data.executionTimeSec !== undefined && (
                    <span className="font-mono text-monokai-comment">
                      {(data.executionTimeSec * 1000).toFixed(1)}ms
                    </span>
                  )}
                </span>
              </div>
              <div className="text-[10px] text-monokai-comment font-mono mt-1 truncate">
                步骤 {data.stepIndex || 1}
                {data.tableName ? ` · ${data.tableName}` : ''}
              </div>
            </div>

            {/* 节点操作（对齐实体画布 3 格快捷操作） */}
            <div className="space-y-2">
              <span className={dfDrawerSectionLabel}>节点操作</span>
              <div className="grid grid-cols-3 gap-1.5 mt-1">
                <button
                  type="button"
                  onClick={handleRunCurrentNode}
                  disabled={isExecuting}
                  className={dfDrawerActionTile}
                  title="运行当前节点"
                >
                  <Play className="w-4 h-4 text-monokai-accent fill-current" />
                  <span>{isExecuting ? '执行中' : '立即执行'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenInSqlEditor}
                  disabled={!compiledSql}
                  className={dfDrawerActionTile}
                  title="在 SQL 工作台打开"
                >
                  <ExternalLink className="w-4 h-4 text-monokai-cyan" />
                  <span>打开 SQL</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    useWorkflowStore.getState().traceReverseLineage(selectedNode.id);
                  }}
                  className={dfDrawerActionTile}
                  title="反向追溯上游数据源"
                >
                  <Compass className="w-4 h-4 text-monokai-yellow" />
                  <span>反向追溯</span>
                </button>
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
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-monokai-elevated hover:bg-monokai-surface transition-colors cursor-pointer text-monokai-fg"
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

            {/* 物理执行上下文：只展示当前算子真实有用字段 */}
            <div className="space-y-2">
              <span className={dfDrawerSectionLabel}>执行上下文</span>
              <div className="p-3 rounded-lg bg-monokai-bg/40 border border-monokai-border space-y-2 text-xs">
              <div className="flex items-center justify-between text-monokai-fg font-semibold border-b border-monokai-border/60 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-monokai-yellow" />
                  <span>算子</span>
                </div>
                <span className="font-mono text-[10.5px] px-1.5 py-0.5 rounded bg-monokai-elevated border border-monokai-border text-monokai-cyan">
                  {data.config?.operatorName || data.subtitle || data.type?.toUpperCase() || ''}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                {data.tableName && (
                  <div className="col-span-2 flex items-center justify-between p-1.5 rounded bg-monokai-surface/60 border border-monokai-border/60">
                    <span className="text-monokai-comment font-sans">数据源</span>
                    <span className="text-monokai-blue font-bold truncate">{data.tableName}</span>
                  </div>
                )}

                <div className="flex flex-col p-1.5 rounded bg-monokai-surface/60 border border-monokai-border/60">
                  <span className="text-[10px] text-monokai-comment font-sans">行数</span>
                  <span className="text-monokai-fg font-bold mt-0.5">
                    {data.inputRowCount !== undefined ? `${data.inputRowCount.toLocaleString()} → ` : ''}
                    {data.rowCount !== undefined ? `${data.rowCount.toLocaleString()}` : '—'}
                  </span>
                  {data.filterRatio !== undefined && (
                    <span className={`text-[9.5px] font-bold ${data.filterRatio >= 0 ? 'text-monokai-accent' : 'text-monokai-pink'}`}>
                      {data.filterRatio >= 0 ? `↓${data.filterRatio}%` : `↑${Math.abs(data.filterRatio)}%`}
                    </span>
                  )}
                </div>

                <div className="flex flex-col p-1.5 rounded bg-monokai-surface/60 border border-monokai-border/60">
                  <span className="text-[10px] text-monokai-comment font-sans">耗时</span>
                  <span className="text-monokai-fg font-bold mt-0.5">
                    {data.executionTimeSec !== undefined ? `${(data.executionTimeSec * 1000).toFixed(1)} ms` : '—'}
                  </span>
                  {data.config?.costPercent !== undefined && (
                    <span className={`text-[9.5px] font-bold ${data.config.isBottleneck ? 'text-monokai-pink' : 'text-monokai-yellow'}`}>
                      {data.config.isBottleneck ? '瓶颈 ' : ''}{data.config.costPercent}%
                    </span>
                  )}
                </div>
              </div>

              {(data.predicate || data.joinSummary || data.groupBySummary) && (
                <div className="space-y-1 pt-1 border-t border-monokai-border/40 text-[10.5px] font-mono">
                  {data.predicate && (
                    <div className="p-1.5 rounded bg-monokai-orange/10 border border-monokai-orange/20 text-monokai-orange break-all">
                      <span className="font-bold mr-1">{data.sqlStage === 'where' ? 'WHERE' : '上下文'}</span>
                      {data.predicate}
                    </div>
                  )}
                  {data.joinSummary && (
                    <div className="p-1.5 rounded bg-monokai-pink/10 border border-monokai-pink/20 text-monokai-pink break-all">
                      <span className="font-bold mr-1">JOIN</span>
                      {data.joinSummary}
                    </div>
                  )}
                  {data.groupBySummary && (
                    <div className="p-1.5 rounded bg-monokai-yellow/10 border border-monokai-yellow/20 text-monokai-yellow break-all">
                      <span className="font-bold mr-1">GROUP BY</span>
                      {data.groupBySummary}
                    </div>
                  )}
                </div>
              )}

              {data.sqlRange && (
                <div className="pt-1 flex items-center justify-between">
                  <span className="text-monokai-comment text-[10px] font-mono">
                    SQL L{data.sqlRange.startLine}–{data.sqlRange.endLine}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      useWorkflowStore.setState({ activeSqlRange: data.sqlRange });
                      dispatchFocusSqlEditor({ sqlRange: data.sqlRange });
                      toastService.info(`已定位至 SQL 第 ${data.sqlRange!.startLine} 行`);
                    }}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-monokai-cyan/15 hover:bg-monokai-cyan/25 border border-monokai-cyan/40 text-monokai-cyan text-[10.5px] font-semibold transition-colors cursor-pointer"
                    title="在 SQL 编辑器中定位"
                  >
                    <Code className="w-3 h-3" />
                    <span>定位 SQL</span>
                  </button>
                </div>
              )}
              </div>
            </div>

            {/* 血缘拓扑 */}
            <div className="space-y-2">
              <span className={dfDrawerSectionLabel}>
                血缘 ({upstreamNodes.length} 上游 · {downstreamNodes.length} 下游)
              </span>
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
                        onClick={() => {
                          selectNode(un.id);
                          dispatchDataflowCenterNode({ nodeId: un.id });
                        }}
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
                          {un.data.rowCount?.toLocaleString() ?? '—'} 行
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
                        onClick={() => {
                          selectNode(dn.id);
                          dispatchDataflowCenterNode({ nodeId: dn.id });
                        }}
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
                          {dn.data.rowCount?.toLocaleString() ?? '—'} 行
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

            {/* ── 阶段字段结构 (Output Schema) ── */}
            {data.executionResult?.columns && data.executionResult.columns.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-meta font-medium text-monokai-comment">
                  <span className="flex items-center gap-1 text-monokai-fg">
                    <Table className="h-3 w-3 text-monokai-cyan" />
                    <span>字段结构清单 ({data.executionResult.columns.length} 个字段)</span>
                  </span>
                </div>
                <div className="max-h-40 overflow-y-auto rounded border border-monokai-border bg-monokai-bg p-2 font-mono text-meta space-y-1 custom-scrollbar">
                  {data.executionResult.columns.map((col, idx) => (
                    <div key={idx} className="flex items-center justify-between py-0.5 border-b border-monokai-border/30 last:border-0">
                      <span className="text-monokai-fg truncate font-medium">{col.name}</span>
                      <span className="text-2xs text-monokai-comment">{col.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── SQL 预览 ── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className={dfDrawerSectionLabel}>SQL 预览</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleExplainSql}
                    disabled={isExplaining || !compiledSql}
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
      <div className="shrink-0 border-t border-monokai-border bg-monokai-bg/80 p-3">
        <button
          type="button"
          onClick={handleRunCurrentNode}
          disabled={isExecuting}
          className={`w-full ${dfBtnPrimary}`}
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          <span>{isExecuting ? '执行中...' : '运行节点'}</span>
        </button>
      </div>
    </div>
  );
};
