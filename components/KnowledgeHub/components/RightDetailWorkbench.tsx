import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Star, 
  Trash2, 
  Edit3, 
  Sparkles, 
  Layers, 
  BookMarked,
  Share2,
  PanelLeftOpen,
  Compass,
  Network,
  GripVertical,
  Play,
  CheckCircle2,
  Target,
  X,
  Loader2
} from 'lucide-react';
import { KnowledgeAsset, CodeAsset, MetricAsset, NoteAsset } from '../types';
import { CodeAssetDetail } from './CodeAssetDetail';
import { MetricAssetDetail } from './MetricAssetDetail';
import { NoteAssetDetail } from './NoteAssetDetail';
import D3GraphView from '../../Library/D3GraphView';
import RightInspector from '../../Library/OntologyPanelRightInspector';
import type { EditMode } from '../../Library/OntologyPanel.types';
import { 
  synthesizeBaselineOntology, 
  synthesizeOntologyFromSingleBlock,
  type DynamicSynthesizedOntology,
  type SqlBlockExecutionResult
} from '../../../services/ontology/ontologySynthesisEngine';
import { toastService } from '../../../services/toastService';
import { useContainerWidth } from '../../ui/useContainerWidth';

interface RightDetailWorkbenchProps {
  asset: KnowledgeAsset | null;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  onTryCode?: (sql: string) => void;
  onNavigateToMetrics?: (metricName: string) => void;
  onNavigateToOntology?: (conceptId: string) => void;
  onToggleFavorite: (id: string) => void;
  onEditAsset: (asset: KnowledgeAsset) => void;
  onDeleteAsset: (id: string) => void;
  onUpdateNoteContent?: (id: string, newContent: string) => void;
  onOpenAiAssistant?: (asset?: KnowledgeAsset) => void;
}

const RightDetailWorkbenchInner: React.FC<RightDetailWorkbenchProps> = ({
  asset,
  isSidebarCollapsed,
  onToggleSidebar,
  onTryCode,
  onNavigateToMetrics,
  onNavigateToOntology,
  onToggleFavorite,
  onEditAsset,
  onDeleteAsset,
  onUpdateNoteContent,
  onOpenAiAssistant,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const availableWidth = useContainerWidth(containerRef, Boolean(asset));
  const stacked = availableWidth !== null && availableWidth < 700;

  // 左右分栏宽度持久化（参考工程核心 - SQL 工作台标准）
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('duckdb_knowledge_hub_left_width');
      if (saved) {
        const num = parseInt(saved, 10);
        if (!isNaN(num) && num >= 320 && num <= 1600) return num;
      }
    } catch {}
    return typeof window !== 'undefined' ? Math.round(window.innerWidth * 0.52) : 600;
  });

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isGraphCollapsed, setIsGraphCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('duckdb_knowledge_graph_collapsed');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  // 动态合成的本体状态
  const [synthesizedOntology, setSynthesizedOntology] = useState<DynamicSynthesizedOntology | null>(null);
  const [currentOntologyState, setCurrentOntologyState] = useState<any>(null);

  // 属性检视器抽屉状态 (复用 AI 认知 - 本体图谱规范)
  const [inspectorMode, setInspectorMode] = useState<EditMode>('none');
  const [inspectorTarget, setInspectorTarget] = useState<any>(null);
  const [isExecutingAll, setIsExecutingAll] = useState<boolean>(false);

  // 控制显示跳数调节器（默认二跳，展示一级实体类型与二级业务实例）
  const [hopLimit, setHopLimit] = useState<'1' | '2' | '3' | 'all'>('2');

  // 当切换资产或内容修改时，自动生成该资产的专属基线图谱
  useEffect(() => {
    setIsExecutingAll(false);
    if (asset) {
      const baseline = synthesizeBaselineOntology(asset);
      setSynthesizedOntology(baseline);
      setCurrentOntologyState(baseline.storeState);
      setInspectorMode('none');
      setInspectorTarget(null);
    } else {
      setSynthesizedOntology(null);
      setCurrentOntologyState(null);
    }
  }, [asset?.id, (asset as any)?.content, (asset as any)?.sql, (asset as any)?.sqlExpression]);

  // 监听真实运行生成的本体图谱事件与单块执行/批量完成通知
  useEffect(() => {
    const handleSynthesized = (e: any) => {
      setIsExecutingAll(false);
      // 严格校验资产 ID，不属于当前教程的事件直接忽略，杜绝数据残留
      if (e?.detail?.assetId && asset && e.detail.assetId !== asset.id) {
        return;
      }
      if (e?.detail?.dynamicOntology) {
        const dyn = e.detail.dynamicOntology as DynamicSynthesizedOntology;
        setSynthesizedOntology(dyn);
        if (dyn.storeState) {
          setCurrentOntologyState(dyn.storeState);
        }
      }
    };

    const handleRunAllCompleted = (e: any) => {
      if (e?.detail?.assetId && asset && e.detail.assetId !== asset.id) {
        return;
      }
      setIsExecutingAll(false);
    };

    const handleBlockExecuted = (e: any) => {
      if (!asset) return;
      setIsExecutingAll(false);
      const { sql, rows, columns, rowCount, durationMs, success, error } = e.detail || {};
      if (!sql) return;

      const singleResult: SqlBlockExecutionResult = {
        index: 1,
        sql,
        durationMs: durationMs || 10,
        success: success !== false,
        rows,
        columns,
        rowCount,
        error,
      };

      setSynthesizedOntology((prev) => {
        const base = prev || synthesizeBaselineOntology(asset);
        const updated = synthesizeOntologyFromSingleBlock(asset, base, singleResult);
        if (updated.storeState) {
          setCurrentOntologyState(updated.storeState);
        }
        return updated;
      });
    };

    window.addEventListener('duckdb_ontology_synthesized', handleSynthesized);
    window.addEventListener('duckdb_run_all_completed', handleRunAllCompleted);
    window.addEventListener('duckdb_sql_block_executed', handleBlockExecuted);
    return () => {
      window.removeEventListener('duckdb_ontology_synthesized', handleSynthesized);
      window.removeEventListener('duckdb_run_all_completed', handleRunAllCompleted);
      window.removeEventListener('duckdb_sql_block_executed', handleBlockExecuted);
    };
  }, [asset?.id]);

  // 左右拖拽交互处理
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const minLeft = 360;
      const maxLeft = Math.max(minLeft, rect.width - 340);
      const newWidth = Math.max(minLeft, Math.min(maxLeft, e.clientX - rect.left));
      setLeftWidth(newWidth);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!containerRef.current || e.touches.length === 0) return;
      const rect = containerRef.current.getBoundingClientRect();
      const minLeft = 360;
      const maxLeft = Math.max(minLeft, rect.width - 340);
      const newWidth = Math.max(minLeft, Math.min(maxLeft, e.touches[0].clientX - rect.left));
      setLeftWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      try {
        localStorage.setItem('duckdb_knowledge_hub_left_width', String(leftWidth));
      } catch {}
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, leftWidth]);

  const toggleGraphCollapse = () => {
    setIsGraphCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('duckdb_knowledge_graph_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const handleTriggerRunAll = () => {
    setIsExecutingAll(true);
    window.dispatchEvent(new CustomEvent('duckdb_trigger_run_all'));
    // 安全兜底超期重置
    setTimeout(() => {
      setIsExecutingAll(false);
    }, 10000);
  };

  const handleLocateCode = (target: any) => {
    let sourceBlockIndex = 1;
    let snippet = '';
    let tutorialAnchor = '';
    if (target?.properties) {
      try {
        const p = typeof target.properties === 'string' ? JSON.parse(target.properties) : target.properties;
        sourceBlockIndex = p.sourceBlockIndex || 1;
        snippet = p.lastExecutedSql || p._sourceCodeSnippet || '';
        tutorialAnchor = p.tutorialAnchor || '';
      } catch {}
    }
    window.dispatchEvent(
      new CustomEvent('duckdb_locate_tutorial_code', {
        detail: {
          sourceBlockIndex,
          snippet,
          tutorialAnchor,
          keyword: target?.name,
        },
      })
    );
  };

  if (!asset) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-monokai-bg p-8 text-center text-monokai-comment relative">
        {isSidebarCollapsed && onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            title="展开知识文献库侧边栏 (Ctrl+B)"
            aria-label="展开知识文献库侧边栏"
            className="absolute top-3 left-4 flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-monokai-accent bg-monokai-elevated hover:bg-monokai-hover border border-monokai-border transition-colors cursor-pointer"
          >
            <PanelLeftOpen className="w-3.5 h-3.5" />
            <span>展开侧边</span>
          </button>
        )}
        <div className="w-16 h-16 rounded-2xl bg-monokai-elevated border border-monokai-border flex items-center justify-center mb-4 text-monokai-comment">
          <Layers className="w-8 h-8" />
        </div>
        <h3 className="text-sm font-semibold text-monokai-fg-muted">请选择一项知识资产</h3>
        <p className="text-xs text-monokai-comment mt-1 max-w-sm">
          在左侧列表浏览或搜索，点击任意 SQL 片段、业务口径或知识笔记查看详情并进行实战操作
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 flex flex-col h-full bg-monokai-bg overflow-hidden select-none">
      {/* 顶部操作工具栏 */}
      <div className="px-5 py-2 border-b border-monokai-border bg-monokai-surface flex flex-wrap gap-2 items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 text-xs text-monokai-comment min-w-0">
          {isSidebarCollapsed && onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              title="展开知识文献库侧边栏 (Ctrl+B)"
              aria-label="展开知识文献库侧边栏"
              className="flex items-center gap-1.5 px-2 py-1 -ml-2 mr-1 rounded bg-monokai-elevated hover:bg-monokai-hover text-monokai-accent text-[11px] font-medium border border-monokai-border transition-colors cursor-pointer shrink-0"
            >
              <PanelLeftOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">展开侧边</span>
            </button>
          )}
          <span className="font-mono px-2 py-0.5 rounded bg-monokai-elevated text-monokai-accent border border-monokai-border text-[10.5px] font-semibold shrink-0">
            {asset.type === 'code' ? 'SQL' : asset.type === 'note' ? 'DOC' : 'METRIC'}
          </span>
          <span className="text-monokai-comment">/</span>
          <span className="text-monokai-fg-muted font-semibold truncate max-w-md">
            {asset.type === 'metric' ? asset.name : asset.title}
          </span>
          <span className="text-monokai-comment hidden sm:inline">·</span>
          <span className="text-monokai-comment font-mono text-[10.5px] hidden sm:inline">
            更新: {asset.updatedAt.slice(0, 10)}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* 本体图谱分栏开关 */}
          <button
            type="button"
            onClick={toggleGraphCollapse}
            title={isGraphCollapsed ? '展开右侧本体图谱' : '收起右侧本体图谱，专注阅读'}
            aria-label="切换本体图谱面板"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
              !isGraphCollapsed
                ? 'bg-monokai-cyan/20 border-monokai-cyan/60 text-monokai-cyan shadow-sm'
                : 'bg-monokai-elevated border-monokai-border text-monokai-fg-muted hover:text-white hover:bg-monokai-hover'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isGraphCollapsed ? '展开图谱' : '本体图谱'}</span>
          </button>

          {/* AI 润色 */}
          {onOpenAiAssistant && (
            <button
              type="button"
              onClick={() => onOpenAiAssistant(asset)}
              title="使用 AI 提炼/润色此项资产"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-monokai-accent bg-monokai-elevated hover:bg-monokai-border border border-monokai-border transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI 润色</span>
            </button>
          )}

          {/* 收藏 */}
          <button
            type="button"
            onClick={() => onToggleFavorite(asset.id)}
            title={asset.isFavorite ? '取消收藏' : '加入收藏'}
            className={`p-1.5 rounded-md hover:bg-monokai-elevated transition-colors cursor-pointer ${
              asset.isFavorite ? 'text-yellow-400' : 'text-monokai-comment hover:text-monokai-fg-muted'
            }`}
          >
            <Star className={`w-4 h-4 ${asset.isFavorite ? 'fill-yellow-400' : ''}`} />
          </button>

          {/* 编辑 */}
          <button
            type="button"
            onClick={() => onEditAsset(asset)}
            title="编辑资产属性"
            className="p-1.5 rounded-md text-monokai-comment hover:text-monokai-fg-muted hover:bg-monokai-elevated transition-colors cursor-pointer"
          >
            <Edit3 className="w-4 h-4" />
          </button>

          {/* 删除 */}
          <button
            type="button"
            onClick={() => onDeleteAsset(asset.id)}
            title="删除资产"
            className="p-1.5 rounded-md text-monokai-comment hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 核心双栏交互工作台：左侧教程/代码 + 中间拖拽分界 + 右侧本体图谱 */}
      <div ref={containerRef} className={`flex-1 min-h-0 min-w-0 overflow-hidden flex ${stacked ? 'flex-col' : 'flex-row'} relative select-text`}>
        {/* 左侧：教程阅读与代码执行 */}
        <div 
          style={{ 
            width: isGraphCollapsed || stacked ? '100%' : `${Math.min(leftWidth, Math.max(360, (availableWidth ?? leftWidth + 340) - 340))}px`,
            flexShrink: 0,
            height: stacked && !isGraphCollapsed ? '50%' : '100%',
          }} 
          className="h-full overflow-hidden flex flex-col min-w-0 transition-[width] duration-75"
        >
          {asset.type === 'code' && (
            <CodeAssetDetail asset={asset as CodeAsset} onTryCode={onTryCode} />
          )}
          {asset.type === 'metric' && (
            <MetricAssetDetail
              asset={asset as MetricAsset}
              onTryCode={onTryCode}
              onNavigateToMetrics={onNavigateToMetrics}
            />
          )}
          {asset.type === 'note' && (
            <NoteAssetDetail
              asset={asset as NoteAsset}
              onTryCode={onTryCode}
              onSendToEditor={onTryCode}
              onUpdateNoteContent={(newContent) =>
                onUpdateNoteContent && onUpdateNoteContent(asset.id, newContent)
              }
            />
          )}
        </div>

        {/* 中间拖拽分界把手 (参考工程核心 - SQL) */}
        {!isGraphCollapsed && !stacked && (
          <div
            onMouseDown={() => setIsDragging(true)}
            onTouchStart={() => setIsDragging(true)}
            className="w-1.5 hover:w-2 -mx-0.5 bg-monokai-border hover:bg-monokai-accent/70 active:bg-monokai-accent cursor-col-resize transition-all z-20 relative group select-none flex items-center justify-center shrink-0"
            title="拖拽调整教程与本体图谱宽度"
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-8 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
              <GripVertical className="w-3.5 h-3.5 text-monokai-accent" />
            </div>
          </div>
        )}

        {/* 右侧：本体图谱实时渲染 (统一复用 AI 认知 - 本体图谱规范) */}
        {!isGraphCollapsed && (
          <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden bg-monokai-bg relative">
            {/* 图谱面板顶部标题与执行状态栏 */}
            <div className="min-h-9 py-1 px-3 gap-2 border-b border-monokai-border bg-monokai-sidebar flex flex-wrap items-center justify-between shrink-0 select-none">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-5 h-5 rounded bg-monokai-cyan/20 border border-monokai-cyan/40 flex items-center justify-center text-monokai-cyan shrink-0">
                  <Network className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold text-monokai-fg tracking-wide truncate">
                  本体图谱实时渲染
                </span>
                {synthesizedOntology?.executionReport?.successCount ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-monokai-green/15 text-monokai-green border border-monokai-green/30 shrink-0">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>执行驱动 ({synthesizedOntology.executionMetrics.avgDurationMs}ms)</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-monokai-yellow/15 text-monokai-yellow border border-monokai-yellow/30 shrink-0">
                    <Sparkles className="w-3 h-3" />
                    <span>待执行代码驱动</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* 显示跳数调节器 (默认二跳) */}
                <div className="flex items-center bg-monokai-bg/90 border border-monokai-border/80 rounded-md p-0.5 shadow-xs">
                  <span className="text-[10px] text-monokai-comment px-1.5 flex items-center gap-1 select-none font-medium">
                    <Layers className="w-3 h-3 text-monokai-cyan" />
                    跳数
                  </span>
                  {(['1', '2', '3', 'all'] as const).map(hop => (
                    <button
                      key={hop}
                      type="button"
                      onClick={() => setHopLimit(hop)}
                      title={
                        hop === '1'
                          ? '1跳：仅展示一级领域实体类型 (TypeHub)'
                          : hop === '2'
                          ? '2跳（默认）：展示一级领域实体类型 + 二级业务实例'
                          : hop === '3'
                          ? '3跳：展示一级类型 + 二级实例 + 三级属性与行为'
                          : '全图：完整网状拓扑无截断'
                      }
                      className={`px-1.5 py-0.5 text-[10px] font-medium rounded transition-all cursor-pointer ${
                        hopLimit === hop
                          ? 'bg-monokai-cyan text-monokai-bg font-bold shadow-xs'
                          : 'text-monokai-fg-muted hover:text-white hover:bg-monokai-hover'
                      }`}
                    >
                      {hop === 'all' ? '全图' : `${hop}跳`}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleTriggerRunAll}
                  disabled={isExecutingAll}
                  title="一键在 DuckDB WASM 中执行并更新本体图谱"
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer shadow-xs ${
                    isExecutingAll
                      ? 'bg-monokai-accent/60 text-monokai-bg cursor-wait'
                      : 'bg-monokai-accent text-monokai-bg hover:bg-monokai-accent-hover'
                  }`}
                >
                  {isExecutingAll ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>正在驱动...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 fill-current" />
                      <span>执行驱动</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={toggleGraphCollapse}
                  title="收起图谱面板"
                  className="p-1 rounded text-monokai-comment hover:text-white hover:bg-monokai-hover transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* D3 图谱可视化区 */}
            <div className="flex-1 min-h-0 relative overflow-hidden bg-monokai-bg">
              {currentOntologyState ? (
                ((currentOntologyState.objects && currentOntologyState.objects.length > 0) ||
                 (currentOntologyState.objectTypes && currentOntologyState.objectTypes.length > 0)) ? (
                  <D3GraphView
                    key={`ontology-graph-${asset?.id || 'none'}`}
                    ontologyState={currentOntologyState}
                    isActive={!isGraphCollapsed}
                    hopLimit={hopLimit}
                    onHopLimitChange={setHopLimit}
                    onInspect={(mode, target) => {
                      setInspectorMode(mode);
                      setInspectorTarget(target);
                    }}
                  />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center h-full p-8 text-center text-monokai-comment select-none">
                    <div className="w-14 h-14 rounded-2xl bg-monokai-surface border border-monokai-border flex items-center justify-center text-monokai-cyan/70 mb-3 shadow-inner">
                      <Network className="w-7 h-7" />
                    </div>
                    <h4 className="text-xs font-semibold text-monokai-fg-muted mb-1.5">当前教程未涉及业务领域实体</h4>
                    <p className="text-[11px] text-monokai-comment max-w-xs leading-relaxed">
                      遵循真实业务建模原则：SQL 语法保留字、虚拟序列表或纯算术运算不作为本体对象。
                      编写或执行涉及客户、订单、交易等业务实体的 SQL 代码后，右侧将自动建模呈现。
                    </p>
                  </div>
                )
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center h-full text-center text-monokai-comment p-6">
                  <Loader2 className="w-6 h-6 animate-spin text-monokai-cyan mb-2" />
                  <p className="text-xs">正在分析教程架构与本体关联...</p>
                </div>
              )}

              {/* 选中节点时的右侧属性检视抽屉 */}
              {inspectorMode !== 'none' && inspectorTarget && (
                <div className="absolute right-0 top-0 bottom-0 w-80 sm:w-88 z-30 border-l border-monokai-border shadow-2xl bg-monokai-sidebar flex flex-col overflow-hidden">
                  <div className="p-2 border-b border-monokai-border bg-monokai-surface flex items-center justify-between shrink-0">
                    <button
                      type="button"
                      onClick={() => handleLocateCode(inspectorTarget)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-monokai-accent/15 text-monokai-accent hover:bg-monokai-accent/25 border border-monokai-accent/30 text-xs font-semibold cursor-pointer"
                      title="反向滚动定位左侧教程与代码块"
                    >
                      <Target className="w-3.5 h-3.5" />
                      <span>定位教程/代码</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInspectorMode('none')}
                      className="p-1 text-monokai-comment hover:text-white rounded hover:bg-monokai-hover cursor-pointer"
                      title="关闭检视器"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <RightInspector
                      key={`inspector-${inspectorMode}-${inspectorTarget?.id ?? 'node'}`}
                      mode={inspectorMode}
                      target={inspectorTarget}
                      onClose={() => setInspectorMode('none')}
                      onInspect={(m, t) => {
                        setInspectorMode(m);
                        setInspectorTarget(t);
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const RightDetailWorkbench = React.memo(RightDetailWorkbenchInner);
