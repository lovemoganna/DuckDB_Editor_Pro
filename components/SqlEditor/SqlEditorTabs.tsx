import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Plus,
  FileCode,
  Save,
  Download,
  Copy,
  Edit2,
  MoreVertical,
  XCircle,
  ArrowRight,
  Trash2,
} from 'lucide-react';
import { SqlTab } from '../../types';

export interface SqlEditorTabsProps {
  tabs: SqlTab[];
  activeTabId: string;
  editingTitleId: string | null;
  tempTitle: string;
  onTabClick: (tabId: string) => void;
  onTabDoubleClick: (tab: SqlTab) => void;
  onCloseTab: (tabId: string, e?: React.MouseEvent) => void;
  onCloseOtherTabs?: (tabId: string) => void;
  onCloseTabsToRight?: (tabId: string) => void;
  onCloseAllTabs?: () => void;
  onCreateTab: () => void;
  onDuplicateTab?: (tabId: string) => void;
  onSaveAsQuery?: (tab: SqlTab) => void;
  onSaveAsDuckdbFile?: (tab: SqlTab) => void;
  onSaveAsSqlFile?: (tab: SqlTab) => void;
  onTitleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTitleSave: () => void;
  onTitleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export const SqlEditorTabs: React.FC<SqlEditorTabsProps> = ({
  tabs,
  activeTabId,
  editingTitleId,
  tempTitle,
  onTabClick,
  onTabDoubleClick,
  onCloseTab,
  onCloseOtherTabs,
  onCloseTabsToRight,
  onCloseAllTabs,
  onCreateTab,
  onDuplicateTab,
  onSaveAsQuery,
  onSaveAsDuckdbFile,
  onSaveAsSqlFile,
  onTitleChange,
  onTitleSave,
  onTitleKeyDown,
}) => {
  const [contextMenu, setContextMenu] = useState<{
    tab: SqlTab;
    x: number;
    y: number;
  } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click or escape
  useEffect(() => {
    if (!contextMenu) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  const openContextMenuAt = (x: number, y: number, tab: SqlTab) => {
    const menuWidth = 230;
    const menuHeight = 390;
    const clampedX = Math.max(10, Math.min(x, window.innerWidth - menuWidth - 10));
    const clampedY = Math.max(10, Math.min(y, window.innerHeight - menuHeight - 10));
    setContextMenu({ tab, x: clampedX, y: clampedY });
  };

  const handleContextMenu = (e: React.MouseEvent, tab: SqlTab) => {
    e.preventDefault();
    e.stopPropagation();
    openContextMenuAt(e.clientX, e.clientY, tab);
  };

  const handleOpenTabMenu = (e: React.MouseEvent, tab: SqlTab) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    openContextMenuAt(rect.left, rect.bottom + 4, tab);
  };

  return (
    <>
      <div
        aria-label="SQL Editor Tabs"
        role="tablist"
        className="h-8 flex items-stretch bg-monokai-sidebar px-2 gap-1 overflow-x-auto custom-scrollbar border-b border-monokai-border/70 select-none shrink-0"
        onDoubleClick={(e) => {
          if (e.target === e.currentTarget) {
            onCreateTab();
          }
        }}
        title="双击空白处新建查询"
      >
        {tabs.map((tab, index) => {
          const isActive = activeTabId === tab.id;

          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              className={`group relative flex items-center gap-1.5 px-2.5 text-xs cursor-pointer min-w-[130px] max-w-[240px] transition-all duration-150 rounded-t-lg border-t-2 ${
                isActive
                  ? 'bg-monokai-bg text-monokai-fg font-medium z-10 shadow-xs border-monokai-border-strong'
                  : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/60 border-transparent'
              }`}
              onClick={() => onTabClick(tab.id)}
              onMouseDown={(e) => {
                // Middle click closes tab
                if (e.button === 1) {
                  e.preventDefault();
                  e.stopPropagation();
                  onCloseTab(tab.id, e);
                }
              }}
              onContextMenu={(e) => handleContextMenu(e, tab)}
            >
              <FileCode
                size={13}
                className={`shrink-0 transition-colors ${
                  isActive ? 'text-monokai-yellow' : 'text-monokai-comment/60 group-hover:text-monokai-comment'
                }`}
              />

              {editingTitleId === tab.id ? (
                <input
                  autoFocus
                  value={tempTitle}
                  aria-label="Tab title"
                  placeholder="标签名称"
                  onFocus={(e) => e.target.select()}
                  onChange={onTitleChange}
                  onBlur={onTitleSave}
                  onKeyDown={onTitleKeyDown}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-monokai-surface text-monokai-fg border border-monokai-border px-1.5 py-0.5 rounded outline-none w-full text-xs font-mono font-medium focus:ring-1 focus:ring-monokai-accent/30"
                />
              ) : (
                <span
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onTabDoubleClick(tab);
                  }}
                  className="truncate flex-1 font-mono text-[11px] leading-tight"
                  title={`${tab.title}\n• 左键点击切换\n• 双击重命名\n• 右键打开选项 (另存为/关闭等)\n• 中键快速关闭`}
                >
                  {tab.title}
                </span>
              )}

              {/* Action Buttons: More Options + Close */}
              <div className="flex items-center gap-0.5 shrink-0 ml-auto">
                <button
                  type="button"
                  onClick={(e) => handleOpenTabMenu(e, tab)}
                  className={`p-0.5 rounded transition-all cursor-pointer ${
                    isActive
                      ? 'opacity-100 hover:bg-monokai-surface text-monokai-comment hover:text-monokai-fg'
                      : 'opacity-70 hover:opacity-100 hover:bg-monokai-surface text-monokai-comment hover:text-monokai-fg'
                  }`}
                  title="标签选项 (另存为 / 关闭等)"
                  aria-label="标签选项"
                  aria-haspopup="menu"
                  aria-expanded={contextMenu?.tab.id === tab.id}
                  onDoubleClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical size={11} />
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id, e);
                  }}
                  className={`p-0.5 rounded transition-all cursor-pointer ${
                    isActive
                      ? 'opacity-100 hover:bg-monokai-pink/20 hover:text-monokai-pink text-monokai-comment'
                      : 'opacity-70 hover:opacity-100 hover:bg-monokai-pink/20 hover:text-monokai-pink text-monokai-comment'
                  }`}
                  title={tabs.length === 1 ? '关闭并重置当前查询 (中键或快捷键)' : '关闭标签页 (中键快捷关闭)'}
                  aria-label="关闭标签页"
                  onDoubleClick={(e) => e.stopPropagation()}
                >
                  <X size={11} />
                </button>
              </div>

              {isActive && <div className="absolute -bottom-[1px] left-0 right-0 h-[2px] bg-monokai-bg z-20" />}
            </div>
          );
        })}

        {/* New Tab Button */}
        <button
          type="button"
          onClick={onCreateTab}
          className="self-center h-6.5 w-6.5 ml-1 text-monokai-comment hover:text-monokai-yellow hover:bg-monokai-surface/80 rounded-md transition-all duration-150 cursor-pointer flex items-center justify-center shrink-0 active:scale-95 border border-transparent hover:border-monokai-border/60"
          title="新建 SQL 标签页 (双击空白区域亦可新建)"
          aria-label="新建 SQL 标签页"
        >
          <Plus size={13} />
        </button>
      </div>

      {/* Tab Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          role="menu"
          aria-label="标签页操作"
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 9999,
            maxHeight: 'calc(100vh - 20px)',
            maxWidth: 'calc(100vw - 20px)',
          }}
          className="min-w-[215px] overflow-y-auto bg-monokai-sidebar border border-monokai-border/90 rounded-lg shadow-2xl py-1 text-xs text-monokai-fg select-none animate-in fade-in zoom-in-95 duration-100 backdrop-blur-md"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-3 py-1.5 border-b border-monokai-border/40 text-[11px] font-mono text-monokai-comment flex items-center gap-1.5">
            <FileCode size={12} className="text-monokai-yellow shrink-0" />
            <span className="truncate font-semibold text-monokai-fg">{contextMenu.tab.title}</span>
          </div>

          {/* Section: Save As Options */}
          <div className="py-1">
            <button
              type="button"
              className="w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-monokai-surface hover:text-monokai-yellow transition-colors cursor-pointer group"
              onClick={() => {
                const tab = contextMenu.tab;
                setContextMenu(null);
                onSaveAsQuery?.(tab);
              }}
            >
              <div className="flex items-center gap-2">
                <Save size={13} className="text-monokai-accent group-hover:scale-110 transition-transform" />
                <span>另存为已保存查询...</span>
              </div>
              <span className="text-[10px] text-monokai-comment/80 font-mono">书签/看板</span>
            </button>

            <button
              type="button"
              className="w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-monokai-surface hover:text-monokai-green transition-colors cursor-pointer group"
              onClick={() => {
                const tab = contextMenu.tab;
                setContextMenu(null);
                onSaveAsDuckdbFile?.(tab);
              }}
            >
              <div className="flex items-center gap-2">
                <Download size={13} className="text-monokai-green group-hover:scale-110 transition-transform" />
                <span>另存为本地 .duckdb 文件</span>
              </div>
              <span className="text-[10px] text-monokai-comment/80 font-mono">数据库</span>
            </button>

            <button
              type="button"
              className="w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-monokai-surface hover:text-monokai-green transition-colors cursor-pointer group"
              onClick={() => {
                const tab = contextMenu.tab;
                setContextMenu(null);
                onSaveAsSqlFile?.(tab);
              }}
            >
              <div className="flex items-center gap-2">
                <Download size={13} className="text-monokai-green group-hover:scale-110 transition-transform" />
                <span>另存为本地 .sql 文件</span>
              </div>
              <span className="text-[10px] text-monokai-comment/80 font-mono">导出</span>
            </button>

            <button
              type="button"
              className="w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-monokai-surface hover:text-monokai-fg transition-colors cursor-pointer group"
              onClick={() => {
                const tab = contextMenu.tab;
                setContextMenu(null);
                onDuplicateTab?.(tab.id);
              }}
            >
              <div className="flex items-center gap-2">
                <Copy size={13} className="text-monokai-comment group-hover:text-monokai-fg transition-colors" />
                <span>复制为新标签页 (副本)</span>
              </div>
            </button>
          </div>

          {/* Divider */}
          <div className="my-1 border-t border-monokai-border/40" />

          {/* Section: Rename */}
          <div className="py-0.5">
            <button
              type="button"
              className="w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-monokai-surface hover:text-monokai-fg transition-colors cursor-pointer"
              onClick={() => {
                const tab = contextMenu.tab;
                setContextMenu(null);
                onTabDoubleClick(tab);
              }}
            >
              <div className="flex items-center gap-2">
                <Edit2 size={13} className="text-monokai-comment" />
                <span>重命名标签页</span>
              </div>
              <span className="text-[10px] text-monokai-comment/60 font-mono">双击</span>
            </button>
          </div>

          {/* Divider */}
          <div className="my-1 border-t border-monokai-border/40" />

          {/* Section: Close Actions */}
          <div className="py-1">
            <button
              type="button"
              className="w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-monokai-pink/20 hover:text-monokai-pink transition-colors cursor-pointer group"
              onClick={(e) => {
                const id = contextMenu.tab.id;
                setContextMenu(null);
                onCloseTab(id, e);
              }}
            >
              <div className="flex items-center gap-2">
                <X size={13} className="text-monokai-pink" />
                <span>关闭当前标签页</span>
              </div>
              <span className="text-[10px] text-monokai-comment/60 font-mono">Ctrl+W</span>
            </button>

            <button
              type="button"
              disabled={tabs.length <= 1}
              className={`w-full px-3 py-1.5 flex items-center justify-between text-left transition-colors ${
                tabs.length <= 1
                  ? 'opacity-35 cursor-not-allowed'
                  : 'hover:bg-monokai-surface hover:text-monokai-fg cursor-pointer'
              }`}
              onClick={() => {
                if (tabs.length <= 1) return;
                const id = contextMenu.tab.id;
                setContextMenu(null);
                onCloseOtherTabs?.(id);
              }}
            >
              <div className="flex items-center gap-2">
                <XCircle size={13} className="text-monokai-comment" />
                <span>关闭其他标签页</span>
              </div>
            </button>

            <button
              type="button"
              disabled={tabs.findIndex((t) => t.id === contextMenu.tab.id) === tabs.length - 1}
              className={`w-full px-3 py-1.5 flex items-center justify-between text-left transition-colors ${
                tabs.findIndex((t) => t.id === contextMenu.tab.id) === tabs.length - 1
                  ? 'opacity-35 cursor-not-allowed'
                  : 'hover:bg-monokai-surface hover:text-monokai-fg cursor-pointer'
              }`}
              onClick={() => {
                if (tabs.findIndex((t) => t.id === contextMenu.tab.id) === tabs.length - 1) return;
                const id = contextMenu.tab.id;
                setContextMenu(null);
                onCloseTabsToRight?.(id);
              }}
            >
              <div className="flex items-center gap-2">
                <ArrowRight size={13} className="text-monokai-comment" />
                <span>关闭右侧标签页</span>
              </div>
            </button>

            <button
              type="button"
              className="w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-monokai-pink/20 hover:text-monokai-pink transition-colors cursor-pointer group"
              onClick={() => {
                setContextMenu(null);
                onCloseAllTabs?.();
              }}
            >
              <div className="flex items-center gap-2">
                <Trash2 size={13} className="text-monokai-comment group-hover:text-monokai-pink transition-colors" />
                <span>关闭全部标签页</span>
              </div>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
