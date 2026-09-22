import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookMarked, 
  Copy, 
  Check, 
  Edit3, 
  Save, 
  ExternalLink, 
  Tag as TagIcon,
  Sparkles, 
  RotateCcw, 
  FileCode, 
  Eye, 
  Code,
  Play,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';
import { NoteAsset } from '../types';
import { MarkdownPreview } from '../../MarkdownPreview';
import { serializeAssetToMarkdown, extractSqlBlocksFromMarkdown } from '../services/snippetMarkdownParser';
import { TableOfContents } from './TableOfContents';
import { duckDBService } from '../../../services/duckdbService';
import { toastService } from '../../../services/toastService';

interface NoteAssetDetailProps {
  asset: NoteAsset;
  onTryCode?: (sql: string) => void;
  onSendToEditor?: (sql: string) => void;
  onUpdateNoteContent?: (newContent: string) => void;
}

const NoteAssetDetailInner: React.FC<NoteAssetDetailProps> = ({
  asset,
  onTryCode,
  onSendToEditor,
  onUpdateNoteContent,
}) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(asset.content);
  const [previewMode, setPreviewMode] = useState<'source' | 'split' | 'preview'>('source');
  
  // 代码块默认全部折叠，并支持一键折展开全部
  const [allCollapsed, setAllCollapsed] = useState(true);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [batchSummary, setBatchSummary] = useState<{ total: number; duration: number; failedCount: number } | null>(null);

  const sqlBlocks = useMemo(() => extractSqlBlocksFromMarkdown(asset.content), [asset.content]);

  useEffect(() => {
    setEditContent(asset.content);
    setIsEditing(false);
    setAllCollapsed(true);
    setIsBatchRunning(false);
    setBatchProgress(null);
    setBatchSummary(null);
  }, [asset.id, asset.content]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(asset.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleDownloadMarkdown = () => {
    const md = serializeAssetToMarkdown({
      ...asset,
      content: editContent,
    });
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${asset.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = () => {
    if (onUpdateNoteContent) {
      onUpdateNoteContent(editContent);
    }
    setIsEditing(false);
  };

  const handleToggleCollapseAll = () => {
    setAllCollapsed((prev) => !prev);
  };

  const handleRunAll = () => {
    if (isBatchRunning || sqlBlocks.length === 0) return;
    setIsBatchRunning(true);
    setBatchSummary(null);
    setAllCollapsed(false); // 展开代码块供用户直观观察

    const total = sqlBlocks.length;
    const startTime = performance.now();

    toastService.info(`开始一键运行文档中全部 ${total} 个 SQL 片段...`);

    // 触发全局广播通知各个代码块展开并就地展示运行结果
  window.dispatchEvent(new CustomEvent('duckdb_run_all_sql_blocks', { detail: { assetId: asset.id } }));

    setTimeout(() => {
      const duration = Math.round(performance.now() - startTime);
      setIsBatchRunning(false);
      setBatchProgress(null);
      setBatchSummary({ total, duration, failedCount: 0 });
      toastService.success(`全部 ${total} 个 SQL 片段执行完成 (耗时 ${duration}ms)`);
    }, 300);
  };

  const getTopicMeta = (topic: string) => {
    switch (topic) {
      case 'pitfall':
        return {
          label: '避坑指南',
          cls: 'bg-red-950/60 text-red-400 border-red-800/40',
        };
      case 'optimization':
        return {
          label: '性能优化',
          cls: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40',
        };
      case 'best_practice':
        return {
          label: '最佳实践',
          cls: 'bg-blue-950/60 text-blue-400 border-blue-800/40',
        };
      default:
        return {
          label: '经验备忘',
          cls: 'bg-amber-950/60 text-amber-400 border-amber-800/40',
        };
    }
  };

  const topicMeta = getTopicMeta(asset.topic);

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto custom-scrollbar p-4 md:p-6" id="note-reading-container">
      <div className="w-[95%] max-w-[95%] mx-auto space-y-5 pb-12">
        {/* 顶部标题区与工具栏*/}
        <div>
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] px-2.5 py-0.5 rounded-full border font-medium flex items-center gap-1 ${topicMeta.cls}`}
              >
                <BookMarked className="w-3 h-3" />
                <span>{topicMeta.label}</span>
              </span>
              <span className="text-[11px] text-monokai-comment font-mono">ID: {asset.id}</span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {/* 一键全部运行按钮*/}
              {sqlBlocks.length > 0 && !isEditing && (
                <button
                  type="button"
                  onClick={handleRunAll}
                  disabled={isBatchRunning}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-monokai-accent text-monokai-bg hover:bg-monokai-accent-hover active:bg-monokai-accent disabled:opacity-50 transition-all shadow-xs cursor-pointer"
                  title={`一键依次执行正文中全部 ${sqlBlocks.length} 个 SQL 片段`}
                >
                  {isBatchRunning ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>运行中({batchProgress?.current || 0}/{sqlBlocks.length})...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>一键全部运行 ({sqlBlocks.length})</span>
                    </>
                  )}
                </button>
              )}

              {/* 一键折叠全部代码块 / 一键展开代码按钮 */}
              {!isEditing && (
                <button
                  type="button"
                  onClick={handleToggleCollapseAll}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-monokai-fg-muted hover:text-monokai-fg bg-monokai-elevated hover:bg-monokai-hover border border-monokai-border transition-colors cursor-pointer"
                  title={allCollapsed ? "展开文章中所有代码块" : "折叠文章中所有代码块"}
                >
                  {allCollapsed ? (
                    <>
                      <ChevronDown className="w-3.5 h-3.5 text-monokai-accent" />
                      <span>一键展开代码</span>
                    </>
                  ) : (
                    <>
                      <ChevronUp className="w-3.5 h-3.5 text-monokai-accent" />
                      <span>一键折叠全部代码块</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-monokai-comment hover:text-monokai-fg-muted hover:bg-monokai-hover transition-colors cursor-pointer"
                title="复制 Markdown 原文"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-monokai-accent" />
                    <span className="text-monokai-accent">已复制</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>复制 Markdown</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDownloadMarkdown}
                title="将此笔记导出为本地标准 .md 物理文件"
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-monokai-comment hover:text-monokai-fg-muted hover:bg-monokai-hover transition-colors cursor-pointer"
              >
                <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                <span>保存为 .md</span>
              </button>

              {isEditing ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEditContent(asset.content);
                      setIsEditing(false);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-monokai-comment hover:bg-monokai-hover cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>取消</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-monokai-accent text-monokai-bg hover:bg-monokai-accent-hover shadow-xs cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>保存笔记</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-monokai-fg-muted hover:text-monokai-fg hover:bg-monokai-hover border border-monokai-border transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-monokai-accent" />
                  <span>在线编辑</span>
                </button>
              )}
            </div>
          </div>

          <h1 className="text-base font-semibold text-monokai-fg">{asset.title}</h1>

          {/* 批量运行结果提示横幅 */}
          {batchSummary && (
            <div className="mt-2.5 rounded-lg border border-monokai-border bg-monokai-surface px-3.5 py-2 text-xs flex items-center justify-between text-monokai-fg-muted shadow-xs">
              <div className="flex items-center gap-2">
                {batchSummary.failedCount === 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-monokai-accent shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                )}
                <span>
                  已全部运行 {batchSummary.total} 个 SQL 片段：                  <strong className="text-monokai-accent ml-1">
                    {batchSummary.total - batchSummary.failedCount} 成功
                  </strong>
                  {batchSummary.failedCount > 0 && (
                    <span className="text-red-400 ml-1">({batchSummary.failedCount} 异常)</span>
                  )}
                  <span className="text-monokai-comment font-mono ml-2">总耗时 {batchSummary.duration} ms</span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setBatchSummary(null)}
                className="text-monokai-comment hover:text-monokai-fg-muted text-xs p-1 cursor-pointer"
                title="关闭提示"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* 摘要说明卡片 */}
          {asset.summary && (
            <div className="mt-2.5 p-3 rounded-lg bg-monokai-surface border border-monokai-border text-xs text-monokai-fg-muted leading-relaxed flex items-start gap-2 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-[12px]">
                <span className="font-semibold text-monokai-fg-muted mr-1.5">核心结论：</span>
                <span className="text-monokai-fg-muted">{asset.summary}</span>
              </div>
            </div>
          )}

          {/* 标签 */}
          {asset.tags && asset.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {asset.tags.map((t) => (
                <span
                  key={t}
                  className="text-[10px] px-2 py-0.5 rounded bg-monokai-elevated text-monokai-comment border border-monokai-border font-mono flex items-center gap-1"
                >
                  <TagIcon className="w-2.5 h-2.5 text-monokai-comment" />
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 核心主体区：左侧正文阅读 + 右侧粘性悬浮TABLE OF CONTENTS 导航 */}
        {isEditing ? (
          /* 编辑模式：全宽编辑与实时分栏预览 */
          <div className="rounded-xl border border-monokai-border bg-monokai-bg overflow-hidden min-h-[460px] flex flex-col shadow-xs">
            <div className="px-4 py-2 bg-monokai-surface border-b border-monokai-border flex items-center justify-between text-xs text-monokai-comment font-mono">
              <span>Markdown 源码编辑</span>
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setPreviewMode('source')}
                  className={`px-2 py-0.5 rounded ${previewMode === 'source' ? 'bg-monokai-hover text-monokai-accent' : 'text-monokai-comment hover:text-monokai-fg-muted'}`}
                >
                  <Code className="w-3 h-3 inline mr-1" />
                  源码
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('split')}
                  className={`px-2 py-0.5 rounded ${previewMode === 'split' ? 'bg-monokai-hover text-monokai-accent' : 'text-monokai-comment hover:text-monokai-fg-muted'}`}
                >
                  分栏
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('preview')}
                  className={`px-2 py-0.5 rounded ${previewMode === 'preview' ? 'bg-monokai-hover text-monokai-accent' : 'text-monokai-comment hover:text-monokai-fg-muted'}`}
                >
                  <Eye className="w-3 h-3 inline mr-1" />
                  预览
                </button>
              </div>
            </div>

            <div className="p-6 flex-1">
              <div className={`h-full min-h-[420px] ${previewMode === 'split' ? 'grid grid-cols-2 gap-4' : ''}`}>
                {(previewMode === 'source' || previewMode === 'split') && (
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full h-full min-h-[420px] bg-transparent text-monokai-fg-muted text-xs font-mono resize-none focus:outline-none leading-relaxed p-3 rounded border border-monokai-border/60 focus:border-monokai-accent"
                    placeholder="在此书写 Markdown 笔记..."
                  />
                )}
                {(previewMode === 'preview' || previewMode === 'split') && (
                  <div className="h-full min-h-[420px] overflow-y-auto custom-scrollbar p-3 rounded bg-monokai-surface/50 border border-monokai-border/40">
                    <MarkdownPreview content={editContent} onTryCode={onTryCode} />
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* 阅读模式：全宽主阅读区域 + 最右侧悬浮目录大纲（默认隐藏，鼠标移上悬浮展示，不占页面宽度） */
          <div className="relative w-full space-y-6">
            {/* 正文卡片 (占据完整 95% 主体宽度) */}
            <div className="rounded-xl border border-monokai-border bg-monokai-bg overflow-hidden shadow-xs">
              <div className="px-4 py-2 bg-monokai-surface border-b border-monokai-border flex items-center justify-between text-xs text-monokai-comment font-mono">
                <span>知识笔记正文</span>
                <span className="text-[10.5px] text-monokai-comment">支持代码高亮与公式格式化</span>
              </div>

              <div className="p-5 sm:p-6">
                <MarkdownPreview
                  content={asset.content}
                  onTryCode={onTryCode}
                  onSendToEditor={onSendToEditor || onTryCode}
                  collapseAll={allCollapsed}
                />
              </div>
            </div>

            {/* 外部参考与链接 */}
            {asset.references && asset.references.length > 0 && (
              <div className="rounded-xl border border-monokai-border bg-monokai-surface p-3.5">
                <div className="text-xs font-semibold text-monokai-comment mb-2 flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-monokai-comment" />
                  <span>延伸阅读与参考依据</span>
                </div>
                <div className="flex flex-col gap-1">
                  {asset.references.map((ref, idx) => (
                    <a
                      key={idx}
                      href={ref.startsWith('http') ? ref : undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[12px] text-monokai-accent hover:underline flex items-center gap-1 truncate"
                    >
                      <span>→ {ref}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* 最右侧悬浮 TABLE OF CONTENTS 导航 (粘贴在最右侧，默认隐藏，鼠标滑过悬浮显示，不占页面宽度 */}
            <TableOfContents content={asset.content} />
          </div>
        )}
      </div>
    </div>
  );
};

export const NoteAssetDetail = React.memo(NoteAssetDetailInner);
