import React, { useState } from 'react';
import { 
  Target, 
  Copy, 
  Check, 
  Sparkles, 
  Layers, 
  Database, 
  User, 
  BarChart3,
  FileCode
} from 'lucide-react';
import { MetricAsset } from '../types';
import { MarkdownPreview } from '../../MarkdownPreview';
import { CodeHighlightBlock } from '../../ui/CodeHighlightBlock';
import { serializeAssetToMarkdown } from '../services/snippetMarkdownParser';

interface MetricAssetDetailProps {
  asset: MetricAsset;
  onTryCode?: (sql: string) => void;
  onNavigateToMetrics?: (metricName: string) => void;
}

export const MetricAssetDetail: React.FC<MetricAssetDetailProps> = ({
  asset,
  onTryCode,
  onNavigateToMetrics,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(asset.sqlExpression);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleDownloadMarkdown = () => {
    const md = serializeAssetToMarkdown(asset);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${asset.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto custom-scrollbar p-4 md:p-6">
      <div className="w-[95%] max-w-[95%] mx-auto space-y-5 pb-12">
        {/* 顶部标题与元数据 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-sky-950/60 text-sky-400 border border-sky-800/40 font-medium flex items-center gap-1">
              <Target className="w-3 h-3" />
              <span>业务指标口径</span>
            </span>
            {asset.owner && (
              <span className="text-[11px] text-monokai-comment flex items-center gap-1">
                <User className="w-3 h-3 text-monokai-comment" />
                <span>负责 {asset.owner}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-monokai-comment hover:text-monokai-fg-muted hover:bg-monokai-hover transition-colors"
              title="复制 SQL 表达"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-monokai-accent" />
                  <span className="text-monokai-accent">已复制 SQL</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>复制 SQL</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownloadMarkdown}
              title="将此指标口径导出为标准 .md 物理文件"
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-monokai-comment hover:text-monokai-fg-muted hover:bg-monokai-hover transition-colors"
            >
              <FileCode className="w-3.5 h-3.5 text-emerald-400" />
              <span>保存为 .md</span>
            </button>

            {onNavigateToMetrics && (
              <button
                type="button"
                onClick={() => onNavigateToMetrics(asset.name)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-emerald-400 hover:bg-monokai-hover border border-emerald-800/40 transition-colors"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>联动指标看板</span>
              </button>
            )}
          </div>
        </div>

        <h1 className="text-base font-semibold text-monokai-fg">{asset.name}</h1>

        {/* 标签 */}
        {asset.tags && asset.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {asset.tags.map((t) => (
              <span
                key={t}
                className="text-[10px] px-2 py-0.5 rounded bg-monokai-elevated text-monokai-comment border border-monokai-border font-mono"
              >
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 业务定义与计算口径两列卡*/}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 业务含义 (支持 Markdown 渲染) */}
        <div className="rounded-xl border border-monokai-border bg-monokai-surface p-4 flex flex-col justify-between shadow-2xs">
          <div>
            <div className="text-xs font-semibold text-monokai-fg-muted flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>业务定义与统计场</span>
            </div>
            <div className="text-[12.5px] leading-[1.65] text-monokai-fg-muted">
              <MarkdownPreview content={asset.businessMeaning} onTryCode={onTryCode} />
            </div>
          </div>
        </div>

        {/* 计算公式与度量逻辑 */}
        <div className="rounded-xl border border-monokai-border bg-monokai-surface p-4 flex flex-col justify-between shadow-2xs">
          <div>
            <div className="text-xs font-semibold text-monokai-fg-muted flex items-center gap-1.5 mb-2">
              <BarChart3 className="w-3.5 h-3.5 text-monokai-accent shrink-0" />
              <span>计算公式与度量逻辑</span>
            </div>
            <div className="p-2.5 rounded-lg bg-monokai-bg border border-monokai-border font-mono text-[11.5px] text-monokai-accent leading-relaxed">
              {asset.calculationFormula}
            </div>
          </div>
        </div>
      </div>

      {/* 关联表与分析维度 */}
      <div className="rounded-xl border border-monokai-border bg-monokai-surface p-4 space-y-4 shadow-2xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-semibold text-monokai-comment mb-2 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-monokai-comment" />
              <span>涉及事实/维表 ({asset.sourceTables?.length || 0})</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {asset.sourceTables && asset.sourceTables.length > 0 ? (
                asset.sourceTables.map((t) => (
                  <span
                    key={t}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-monokai-bg border border-monokai-border text-monokai-fg-muted font-mono"
                  >
                    {t}
                  </span>
                ))
              ) : (
                <span className="text-xs text-monokai-comment">未指定关联表</span>
              )}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-monokai-comment mb-2 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-monokai-comment" />
              <span>常用分析维度</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {asset.dimensions && asset.dimensions.length > 0 ? (
                asset.dimensions.map((d) => (
                  <span
                    key={d}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-monokai-elevated border border-monokai-border text-emerald-400 font-mono"
                  >
                    {d}
                  </span>
                ))
              ) : (
                <span className="text-xs text-monokai-comment">未配置细分维</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 标准 SQL 计算范式：由 CodeHighlightBlock 就地执行并展示结果?*/}
      <div className="space-y-1.5">
        <div className="text-xs font-semibold text-monokai-comment flex items-center gap-1.5 px-0.5">
          <span>标准计算 SQL 脚本定义</span>
        </div>
        <CodeHighlightBlock
          code={asset.sqlExpression}
          language="sql"
          title={`${asset.name} - 计算定义`}
          allowFormat={true}
          onTryCode={onTryCode}
          initialCollapsed={false}
        />
      </div>
      </div>
    </div>
  );
};
