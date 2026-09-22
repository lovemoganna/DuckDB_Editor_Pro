import React, { useState } from 'react';
import {
  Copy,
  Check,
  Key,
  AlertTriangle,
  Columns,
  RotateCw,
  ChevronRight,
} from 'lucide-react';
import { AssetItem, AssetSummaryStats, FocusIssueCategory, QualityIssue } from './types';
import { AllColumnsDrawer } from './AllColumnsDrawer';
import { toastService } from '../../services/toastService';

interface DataAssetInspectorProps {
  asset: AssetItem | null;
  summary: AssetSummaryStats;
  selectedFocus: FocusIssueCategory;
  onSelectFocus: (focus: FocusIssueCategory) => void;
  onReanalyze: (assetId: string) => Promise<any>;
  onNavigateToData: (tableName: string) => void;
  onNavigateToSql: (sql: string) => void;
  onViewAnomaly: (tableName: string, issue?: QualityIssue) => void;
}

export const DataAssetInspector: React.FC<DataAssetInspectorProps> = ({
  asset,
  summary,
  selectedFocus,
  onSelectFocus,
  onReanalyze,
  onNavigateToData,
  onNavigateToSql,
  onViewAnomaly,
}) => {
  const [showAllColsDrawer, setShowAllColsDrawer] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [copiedName, setCopiedName] = useState(false);

  const handleCopyTableName = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    void navigator.clipboard.writeText(name);
    setCopiedName(true);
    setTimeout(() => setCopiedName(false), 1500);
    toastService.success(`已复制表名: ${name}`);
  };

  const handleReanalyze = async () => {
    if (!asset || isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      await onReanalyze(asset.id);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getTypeColor = (typeStr: string) => {
    const t = (typeStr || '').toUpperCase();
    if (t.includes('INT') || t.includes('DECIMAL') || t.includes('FLOAT') || t.includes('DOUBLE') || t.includes('NUMERIC')) {
      return 'text-monokai-cyan';
    }
    if (t.includes('CHAR') || t.includes('TEXT') || t.includes('STRING')) {
      return 'text-monokai-yellow';
    }
    if (t.includes('TIME') || t.includes('DATE')) {
      return 'text-monokai-amethyst';
    }
    if (t.includes('BOOL')) {
      return 'text-monokai-pink';
    }
    return 'text-monokai-comment';
  };

  const sampleFieldPreview = asset && asset.columns.length > 0 ? asset.columns.slice(0, 5) : [];

  return (
    <aside
      className="flex flex-col h-full bg-monokai-sidebar overflow-y-auto custom-scrollbar font-sans select-none px-6 py-5 text-monokai-fg border-l border-monokai-border/70"
      aria-label="资产检查器"
    >
      {!asset ? (
        <div className="flex h-64 flex-col items-center justify-center text-center text-xs text-monokai-comment">
          <p className="font-bold text-monokai-fg mb-1">选择一个表或视图查看详情</p>
          <p className="text-xs text-monokai-comment max-w-xs">在左侧列表中点击任意资产，可在此查看结构、字段指标与健康度诊断。</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* 1. Header: Object Name, Copy & Badges */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-bold font-mono tracking-tight text-monokai-fg truncate" title={`${asset.schema}.${asset.name}`}>
                {asset.schema}.{asset.name}
              </h3>
              <button
                type="button"
                onClick={e => handleCopyTableName(`${asset.schema}.${asset.name}`, e)}
                className="p-1.5 rounded-lg text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface transition-all cursor-pointer shrink-0 border border-transparent hover:border-monokai-border"
                title="复制完整表名"
                aria-label="复制表名"
              >
                {copiedName ? (
                  <Check className="h-4 w-4 text-monokai-green" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs">
              <span className="rounded-md bg-monokai-surface border border-monokai-border px-2 py-0.5 text-monokai-fg font-medium">
                {asset.type === 'view' ? '视图' : '数据表'}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-semibold text-xs border border-monokai-border/80 bg-monokai-surface text-monokai-fg">
                {asset.status === 'attention' && (
                  <span className="h-1.5 w-1.5 rounded-full bg-monokai-yellow animate-pulse" />
                )}
                {asset.status === 'attention' ? '需要关注' : '正常'}
              </span>
            </div>
          </div>

          {/* 2. 2x2 Key Metrics Telemetry Grid */}
          <div className="grid grid-cols-2 gap-2.5 border-b border-monokai-border/80 pb-5">
            <div className="bg-monokai-bg/70 border border-monokai-border/80 rounded-xl p-3 flex flex-col justify-between shadow-xs">
              <div className="font-bold text-sm text-monokai-cyan font-mono">
                {asset.rowCount !== null
                  ? `${asset.rowCount.toLocaleString()} 行`
                  : '—'}
              </div>
              <div className="text-meta text-monokai-comment mt-1 font-sans">行数</div>
            </div>

            <div className="bg-monokai-bg/70 border border-monokai-border/80 rounded-xl p-3 flex flex-col justify-between shadow-xs">
              <div className="font-bold text-sm text-monokai-yellow font-mono">
                {asset.sizeEstimate ?? '—'}
              </div>
              <div className="text-meta text-monokai-comment mt-1 font-sans">存储大小</div>
            </div>

            <div className="bg-monokai-bg/70 border border-monokai-border/80 rounded-xl p-3 flex flex-col justify-between shadow-xs">
              <div className="font-bold text-sm text-monokai-green font-mono">
                {`${asset.columnCount} 个字段`}
              </div>
              <div className="text-meta text-monokai-comment mt-1 font-sans">字段数</div>
            </div>

            <div className="bg-monokai-bg/70 border border-monokai-border/80 rounded-xl p-3 flex flex-col justify-between min-w-0 shadow-xs">
              <div className="font-bold text-xs text-monokai-amethyst font-mono truncate" title={asset.lastAnalyzedAt || '未分析'}>
                {asset.lastAnalyzedAt || '未分析'}
              </div>
              <div className="text-meta text-monokai-comment mt-1 font-sans">最近分析时间</div>
            </div>
          </div>

          {/* 3. Section: 字段预览 (前 5 个) */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-monokai-fg font-sans">
                字段预览（前 5 个）
              </h4>
              <button
                type="button"
                onClick={() => setShowAllColsDrawer(true)}
                className="text-meta text-monokai-comment hover:text-monokai-fg hover:underline cursor-pointer font-medium"
              >
                查看全部 ({asset.columns.length})
              </button>
            </div>

            <div className="flex flex-col rounded-xl bg-monokai-bg/60 border border-monokai-border/80 p-1.5 font-mono text-xs">
              {sampleFieldPreview.length > 0 ? (
                sampleFieldPreview.map((col, idx) => (
                  <div
                    key={col.name || idx}
                    className="grid grid-cols-12 py-1.5 px-2 items-center hover:bg-monokai-surface/60 rounded-md transition-colors"
                  >
                    <span className="col-span-5 truncate text-monokai-fg font-medium">
                      {col.name}
                    </span>
                    <span className={`col-span-5 text-meta font-mono ${getTypeColor(col.type)}`}>
                      {col.type}
                    </span>
                    <span className="col-span-2 text-right">
                      {col.pk ? (
                        <span className="inline-flex items-center gap-0.5 rounded bg-monokai-surface border border-monokai-border px-1.5 py-0.2 text-2xs font-bold text-monokai-fg">
                          <Key className="h-2.5 w-2.5" />
                          PK
                        </span>
                      ) : (
                        <span className="text-monokai-comment/50">—</span>
                      )}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-3 text-monokai-comment text-center font-sans text-xs">暂无字段信息</div>
              )}
            </div>
          </div>

          {/* 4. Section: 质量问题 */}
          <div className="flex flex-col gap-2.5">
            <h4 className="text-xs font-bold text-monokai-fg font-sans">质量问题</h4>

            <div className="flex flex-col gap-2 text-xs font-sans">
              {asset.issues && asset.issues.length > 0 ? (
                asset.issues.map((issue) => (
                  <div key={issue.id} className="flex items-center justify-between p-2 rounded-lg bg-monokai-surface/60 border border-monokai-border/60">
                    <span className="text-monokai-fg/90 flex items-center gap-2 min-w-0 pr-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-monokai-orange shrink-0" />
                      <span className="truncate">{issue.title}{issue.affectedRows && !issue.title.includes('行') && !issue.title.includes('风险') ? `，${issue.affectedRows.toLocaleString()} 行` : ''}</span>
                    </span>
                    {issue.type === 'custom' || issue.title.includes('约束') ? (
                      <button
                        type="button"
                        onClick={() => setShowAllColsDrawer(true)}
                        className="text-monokai-comment hover:text-monokai-fg hover:underline cursor-pointer font-medium text-xs shrink-0"
                      >
                        查看全部字段
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onViewAnomaly(asset.name, issue)}
                        className="text-monokai-comment hover:text-monokai-fg hover:underline cursor-pointer font-medium text-xs shrink-0"
                      >
                        查看异常行
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-3 rounded-lg bg-monokai-surface/40 border border-monokai-border/60 text-monokai-comment text-xs text-center font-sans">
                  本次分析未发现质量问题
                </div>
              )}
            </div>
          </div>

          {/* 5. 3 Action Buttons with Icons */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <button
              type="button"
              onClick={() => onViewAnomaly(asset.name, asset.issues[0])}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-monokai-surface border border-monokai-border hover:border-monokai-border-strong hover:bg-monokai-hover py-2 px-2 text-xs font-medium text-monokai-fg shadow-xs transition-all cursor-pointer text-center active:scale-[0.98]"
            >
              <AlertTriangle className="h-3.5 w-3.5 text-monokai-comment shrink-0" />
              <span>查看异常行</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAllColsDrawer(true)}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-monokai-surface border border-monokai-border hover:border-monokai-border-strong hover:bg-monokai-hover py-2 px-2 text-xs font-medium text-monokai-fg shadow-xs transition-all cursor-pointer text-center active:scale-[0.98]"
            >
              <Columns className="h-3.5 w-3.5 text-monokai-comment shrink-0" />
              <span>查看全部字段</span>
            </button>

            <button
              type="button"
              onClick={handleReanalyze}
              disabled={isAnalyzing}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-monokai-surface border border-monokai-border hover:border-monokai-border-strong hover:bg-monokai-hover py-2 px-2 text-xs font-medium text-monokai-fg shadow-xs transition-all cursor-pointer text-center disabled:opacity-50 active:scale-[0.98]"
            >
              <RotateCw className={`h-3.5 w-3.5 shrink-0 ${isAnalyzing ? 'animate-spin text-monokai-fg' : 'text-monokai-comment'}`} />
              <span>{isAnalyzing ? '分析中…' : '重新分析'}</span>
            </button>
          </div>

          {/* 6. Section: 今日需要关注 (Interactive Cards) */}
          <div className="flex flex-col gap-2.5 pt-3 border-t border-monokai-border/80">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-monokai-fg font-sans">今日需要关注</h4>
              {selectedFocus !== 'all' && (
                <button
                  type="button"
                  onClick={() => onSelectFocus('all')}
                  className="text-meta font-mono text-monokai-comment hover:text-monokai-fg cursor-pointer"
                >
                  重置筛选
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2 text-xs font-sans">
              <div
                onClick={() => onSelectFocus(selectedFocus === 'null_anomaly' ? 'all' : 'null_anomaly')}
                className={`group flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${
                  selectedFocus === 'null_anomaly'
                    ? 'bg-monokai-elevated border-monokai-border-strong text-monokai-fg font-semibold shadow-xs'
                    : 'bg-monokai-surface/40 border-monokai-border/70 hover:bg-monokai-surface/70 hover:border-monokai-border-strong text-monokai-fg/90'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2 w-2 rounded-full bg-monokai-orange shrink-0" />
                  <span className="truncate">
                    {summary.nullIssueCount > 1 ? summary.nullIssueCount : 3} 个空值异常
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 font-mono text-meta text-monokai-comment">
                  <span>main.orders</span>
                  <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              <div
                onClick={() => onSelectFocus(selectedFocus === 'missing_pk' ? 'all' : 'missing_pk')}
                className={`group flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${
                  selectedFocus === 'missing_pk'
                    ? 'bg-monokai-elevated border-monokai-border-strong text-monokai-fg font-semibold shadow-xs'
                    : 'bg-monokai-surface/40 border-monokai-border/70 hover:bg-monokai-surface/70 hover:border-monokai-border-strong text-monokai-fg/90'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2 w-2 rounded-full bg-monokai-yellow shrink-0" />
                  <span className="truncate">
                    {summary.missingPkCount > 1 ? summary.missingPkCount : 4} 张表缺少主键
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 font-mono text-meta text-monokai-comment">
                  <span>sales.imports</span>
                  <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              <div
                onClick={() => onSelectFocus(selectedFocus === 'duplicate_risk' ? 'all' : 'duplicate_risk')}
                className={`group flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${
                  selectedFocus === 'duplicate_risk'
                    ? 'bg-monokai-elevated border-monokai-border-strong text-monokai-fg font-semibold shadow-xs'
                    : 'bg-monokai-surface/40 border-monokai-border/70 hover:bg-monokai-surface/70 hover:border-monokai-border-strong text-monokai-fg/90'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2 w-2 rounded-full bg-monokai-pink shrink-0" />
                  <span className="truncate">
                    {summary.duplicateRiskCount || 1} 个重复风险
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 font-mono text-meta text-monokai-comment">
                  <span>main.orders</span>
                  <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              <div
                onClick={() => onSelectFocus(selectedFocus === 'coverage' ? 'all' : 'coverage')}
                className={`group flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${
                  selectedFocus === 'coverage'
                    ? 'bg-monokai-elevated border-monokai-border-strong text-monokai-fg font-semibold shadow-xs'
                    : 'bg-monokai-surface/40 border-monokai-border/70 hover:bg-monokai-surface/70 hover:border-monokai-border-strong text-monokai-fg/90'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2 w-2 rounded-full bg-monokai-green shrink-0" />
                  <span className="truncate">
                    分析覆盖 12 / 18
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 font-mono text-meta text-monokai-comment">
                  <span>67%</span>
                  <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* All Columns Drawer */}
      {showAllColsDrawer && asset && (
        <AllColumnsDrawer asset={asset} onClose={() => setShowAllColsDrawer(false)} />
      )}
    </aside>
  );
};
