import React from 'react';
import { 
  Star, 
  Trash2, 
  Edit3, 
  Sparkles, 
  Layers, 
  BookMarked,
  Share2,
  PanelLeftOpen
} from 'lucide-react';
import { KnowledgeAsset, CodeAsset, MetricAsset, NoteAsset } from '../types';
import { CodeAssetDetail } from './CodeAssetDetail';
import { MetricAssetDetail } from './MetricAssetDetail';
import { NoteAssetDetail } from './NoteAssetDetail';

interface RightDetailWorkbenchProps {
  asset: KnowledgeAsset | null;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  onTryCode?: (sql: string) => void;
  onNavigateToMetrics?: (metricName: string) => void;
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
  onToggleFavorite,
  onEditAsset,
  onDeleteAsset,
  onUpdateNoteContent,
  onOpenAiAssistant,
}) => {
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
        <h3 className="text-sm font-semibold text-monokai-fg-muted">请选择一项知识资</h3>
        <p className="text-xs text-monokai-comment mt-1 max-w-sm">
          在左侧列表浏览或搜索，点击任将 SQL 片段、业务口径或知识笔记查看详情并进行实战操作        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-monokai-bg overflow-hidden">
      {/* 顶部操作工具栏*/}
      <div className="px-6 py-2.5 border-b border-monokai-border bg-monokai-surface flex items-center justify-between">
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
            更新→ {asset.updatedAt.slice(0, 10)}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* AI 润色 / 解释 */}
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
            title="编辑资产属"
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

      {/* 核心详情视图 */}
      <div className="flex-1 overflow-hidden flex flex-col">
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
    </div>
  );
};

export const RightDetailWorkbench = React.memo(RightDetailWorkbenchInner);
