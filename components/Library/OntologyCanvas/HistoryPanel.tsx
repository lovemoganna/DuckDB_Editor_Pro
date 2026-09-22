/**
 * HistoryPanel - 历史记录面板 (MECE v4.3 优化版)
 * 
 * MECE设计原则：
 * - 互斥性：每个历史记录独立展示
 * - 穷尽性：覆盖所有历史操作场景
 * 
 * 功能范围：
 * - 可视化历史列表
 * - 时间戳显示
 * - 操作描述
 * - 跳转指定历史
 * - 批量撤销/重做
 * 
 * v4.3 优化内容：
 * - 添加面板状态持久化 (展开/折叠)
 * - 添加历史导出/导入功能
 * - 添加历史快照功能 (保存关键状态)
 * - 增强时间分组显示
 * - 添加历史搜索/过滤
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  History,
  X,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  RotateCw,
  Clock,
  Undo2,
  Redo2,
  Trash2,
  SkipBack,
  SkipForward,
  Check,
  AlertTriangle,
  Loader2,
  Download,
  Upload,
  Search,
  Filter,
  Calendar,
  Save,
  Plus,
  Edit3,
  Sparkles,
  Layers,
} from 'lucide-react';
import { toastService } from '../../../services/toastService';

// ============================================================
// localStorage 持久化键 (v4.3 新增)
// ============================================================

const HISTORY_PANEL_STORAGE_KEY = 'ontology-canvas-history-panel-state';
const HISTORY_SNAPSHOTS_KEY = 'ontology-canvas-history-snapshots';

/** 面板状态 */
interface PanelState {
  isCollapsed: boolean;
  lastOpenTime: number;
  filterType: HistoryEntry['type'] | 'all';
  showOnlyUndoable: boolean;
}

// ============================================================
// Types & Interfaces
// ============================================================

/** 历史记录条目 */
export interface HistoryEntry {
  /** 唯一标识 */
  id: string;
  /** 操作描述 */
  description: string;
  /** 时间戳 */
  timestamp: number;
  /** 节点数量 */
  nodeCount: number;
  /** 连线数量 */
  edgeCount: number;
  /** 操作类型 */
  type: 'create' | 'update' | 'delete' | 'layout' | 'batch' | 'other';
  /** 是否可撤销 */
  canUndo: boolean;
}

/** 历史面板属性 */
export interface HistoryPanelProps {
  /** 是否显示 */
  isOpen: boolean;
  /** 历史记录列表 */
  entries: HistoryEntry[];
  /** 当前历史索引 */
  currentIndex: number;
  /** 关闭回调 */
  onClose: () => void;
  /** 跳转到指定历史 */
  onJumpTo: (index: number) => void;
  /** 撤销 */
  onUndo: () => void;
  /** 重做 */
  onRedo: () => void;
  /** 清空历史 */
  onClear?: () => void;
  /** v4.3: 导出历史 */
  onExport?: (entries: HistoryEntry[]) => void;
  /** v4.3: 导入历史 */
  onImport?: (entries: HistoryEntry[]) => void;
  /** v4.3: 画布快照数据 (用于恢复) */
  snapshotData?: string;
  /** v4.3: 创建快照回调 */
  onCreateSnapshot?: (label: string) => void;
}

// ============================================================
// Constants
// ============================================================

/** 操作类型图标映射 */
const TYPE_ICONS: Record<HistoryEntry['type'], { icon: typeof Clock; color: string; label: string }> = {
  create: { icon: Plus, color: '#10b981', label: '创建' },
  update: { icon: Edit3, color: '#3b82f6', label: '更新' },
  delete: { icon: Trash2, color: '#ef4444', label: '删除' },
  layout: { icon: Sparkles, color: '#f59e0b', label: '布局' },
  batch: { icon: Layers, color: '#8b5cf6', label: '批量' },
  other: { icon: History, color: '#6b7280', label: '其他' },
};

// ============================================================
// Sub-Components
// ============================================================

/** 历史条目组件 */
interface HistoryItemProps {
  entry: HistoryEntry;
  isActive: boolean;
  isCurrent: boolean;
  onJump: () => void;
  onUndo: () => void;
}

const HistoryItem: React.FC<HistoryItemProps> = ({ entry, isActive, isCurrent, onJump, onUndo }) => {
  const typeConfig = TYPE_ICONS[entry.type];
  const TypeIcon = typeConfig.icon;
  
  // 格式化时间
  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };
  
  return (
    <div
      onClick={onJump}
      className={`
        relative flex items-start gap-3 p-3 rounded-lg cursor-pointer
        transition-all duration-150 border
        ${isCurrent
          ? 'bg-monokai-accent/10 border-monokai-accent/30'
          : isActive
            ? 'bg-monokai-surface border-monokai-border hover:border-monokai-border-strong'
            : 'bg-monokai-surface/50 border-transparent hover:bg-monokai-surface'
        }
      `}
    >
      {/* 类型图标 */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{ backgroundColor: `${typeConfig.color}20` }}
      >
        <TypeIcon className="w-4 h-4" style={{ color: typeConfig.color }} />
      </div>
      
      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-monokai-fg truncate">
            {entry.description}
          </span>
          <span
            className="text-[9px] px-1.5 py-0.5 rounded shrink-0"
            style={{
              backgroundColor: `${typeConfig.color}20`,
              color: typeConfig.color,
            }}
          >
            {typeConfig.label}
          </span>
        </div>
        
        <div className="flex items-center gap-3 text-[10px] text-monokai-comment">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatTime(entry.timestamp)}
          </span>
          <span>{entry.nodeCount} 节点</span>
          <span>{entry.edgeCount} 连线</span>
        </div>
      </div>
      
      {/* 当前状态指示 */}
      {isCurrent && (
        <div className="absolute -left-px top-1/2 -translate-y-1/2 w-1 h-6 bg-monokai-accent rounded-r" />
      )}
      
      {/* 撤销按钮 */}
      {isActive && entry.canUndo && (
        <button
          onClick={(e) => { e.stopPropagation(); onUndo(); }}
          className="
            absolute right-2 top-1/2 -translate-y-1/2
            p-1.5 rounded-lg text-monokai-comment hover:text-monokai-accent
            hover:bg-monokai-accent/10 transition-all opacity-0 group-hover:opacity-100
          "
          title="撤销此操作"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

// ============================================================
// Main Component
// ============================================================

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  isOpen,
  entries,
  currentIndex,
  onClose,
  onJumpTo,
  onUndo,
  onRedo,
  onClear,
  onExport,
  onImport,
  snapshotData,
  onCreateSnapshot,
}) => {
  // v4.3: 从localStorage恢复面板状态
  const loadPanelState = useCallback((): PanelState => {
    try {
      const stored = localStorage.getItem(HISTORY_PANEL_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load panel state:', e);
    }
    return {
      isCollapsed: false,
      lastOpenTime: 0,
      filterType: 'all',
      showOnlyUndoable: false,
    };
  }, []);
  
  // 本地状态
  const [isCollapsed, setIsCollapsed] = useState<boolean>(loadPanelState().isCollapsed);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  // v4.3: 新增状态
  const [filterType, setFilterType] = useState<HistoryEntry['type'] | 'all'>(() => loadPanelState().filterType);
  const [showOnlyUndoable, setShowOnlyUndoable] = useState(() => loadPanelState().showOnlyUndoable);
  const [showExportImport, setShowExportImport] = useState(false);
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [snapshotLabel, setSnapshotLabel] = useState('');
  
  // v4.3: 保存面板状态到localStorage
  const savePanelState = useCallback(() => {
    try {
      const state: PanelState = {
        isCollapsed,
        lastOpenTime: Date.now(),
        filterType,
        showOnlyUndoable,
      };
      localStorage.setItem(HISTORY_PANEL_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to save panel state:', e);
    }
  }, [isCollapsed, filterType, showOnlyUndoable]);
  
  // 监听状态变化保存
  useEffect(() => {
    if (isOpen) {
      savePanelState();
    }
  }, [isCollapsed, filterType, showOnlyUndoable, isOpen, savePanelState]);
  
  // v4.3: 过滤后的历史记录
  const filteredEntries = useMemo(() => {
    let result = entries;
    
    // 按类型过滤
    if (filterType !== 'all') {
      result = result.filter(e => e.type === filterType);
    }
    
    // 只显示可撤销的
    if (showOnlyUndoable) {
      result = result.filter((_, idx) => idx <= currentIndex);
    }
    
    return result;
  }, [entries, filterType, showOnlyUndoable, currentIndex]);
  
  // 计算统计数据
  const stats = useMemo(() => {
    const total = filteredEntries.length;
    const undoable = currentIndex + 1;
    const redoable = entries.length - currentIndex - 1;
    return { total, undoable, redoable };
  }, [filteredEntries.length, entries.length, currentIndex]);
  
  // 跳转到最旧
  const handleJumpToOldest = useCallback(() => {
    onJumpTo(0);
  }, [onJumpTo]);
  
  // 跳转到最新
  const handleJumpToLatest = useCallback(() => {
    onJumpTo(entries.length - 1);
  }, [onJumpTo, entries.length]);
  
  // 清空历史
  const handleClear = useCallback(() => {
    if (onClear) {
      onClear();
      setShowClearConfirm(false);
    }
  }, [onClear]);
  
  // v4.3: 导出历史
  const handleExport = useCallback(() => {
    const exportData = {
      version: '1.0',
      exportTime: Date.now(),
      entries: entries,
      currentIndex: currentIndex,
    };
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `history-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onExport?.(entries);
  }, [entries, currentIndex, onExport]);
  
  // v4.3: 导入历史
  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        if (data.entries && Array.isArray(data.entries)) {
          onImport?.(data.entries);
          toastService.success(`成功导入 ${data.entries.length} 条历史记录`);
        } else {
          toastService.error('导入失败：文件中未找到有效的历史记录条目');
        }
      } catch (err) {
        console.error('Failed to import history:', err);
        toastService.error('导入失败：无效的文件格式或损坏的 JSON');
      }
    };
    input.click();
  }, [onImport]);
  
  // v4.3: 创建快照
  const handleCreateSnapshot = useCallback(() => {
    if (snapshotLabel.trim() && onCreateSnapshot) {
      onCreateSnapshot(snapshotLabel.trim());
      setSnapshotLabel('');
      setShowSnapshotModal(false);
    }
  }, [snapshotLabel, onCreateSnapshot]);
  
  // ESC键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  return (
    <>
      {/* 背景遮罩 */}
      <div 
        className="fixed inset-0 z-[90] bg-black/30"
        onClick={onClose}
      />
      
      {/* 面板 */}
      <div className="
        fixed top-0 right-0 bottom-0 z-[91] w-80
        bg-monokai-sidebar border-l border-monokai-border
        shadow-2xl flex flex-col
        animate-in slide-in-from-right duration-200
      ">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-monokai-border shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-monokai-purple/20 flex items-center justify-center">
              <History className="w-4 h-4 text-monokai-purple" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-monokai-fg">历史记录</h2>
              <p className="text-[10px] text-monokai-comment">
                {stats.total} 条记录 {filterType !== 'all' && `(${filterType})`}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            {/* v4.3: 导出/导入按钮 */}
            {onExport && onImport && entries.length > 0 && (
              <button
                onClick={() => setShowExportImport(!showExportImport)}
                className="p-1.5 rounded-lg text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface transition-colors"
                title="导入/导出"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
            
            {/* 折叠按钮 */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 rounded-lg text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface transition-colors"
              title={isCollapsed ? '展开面板' : '折叠面板'}
            >
              {isCollapsed ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            
            {/* 关闭按钮 */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* v4.3: 导出/导入面板 */}
        {showExportImport && (
          <div className="px-4 py-3 border-b border-monokai-border bg-monokai-bg/30 shrink-0">
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                className="flex-1 py-2 text-[10px] bg-monokai-surface border border-monokai-border rounded-lg hover:border-monokai-accent transition-colors flex items-center justify-center gap-1"
              >
                <Download className="w-3 h-3" />
                导出历史
              </button>
              <button
                onClick={handleImport}
                className="flex-1 py-2 text-[10px] bg-monokai-surface border border-monokai-border rounded-lg hover:border-monokai-accent transition-colors flex items-center justify-center gap-1"
              >
                <Upload className="w-3 h-3" />
                导入历史
              </button>
            </div>
            {onCreateSnapshot && (
              <button
                onClick={() => { setShowExportImport(false); setShowSnapshotModal(true); }}
                className="w-full mt-2 py-2 text-[10px] bg-monokai-accent/10 border border-monokai-accent/30 rounded-lg hover:border-monokai-accent transition-colors flex items-center justify-center gap-1 text-monokai-accent"
              >
                <Save className="w-3 h-3" />
                保存当前状态快照
              </button>
            )}
          </div>
        )}
        
        {/* 统计栏 */}
        {!isCollapsed && (
          <>
            {/* v4.3: 过滤选项栏 */}
            <div className="px-4 py-2 border-b border-monokai-border bg-monokai-bg/50 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-monokai-comment">可撤销:</span>
                  <span className="text-monokai-green font-medium">{stats.undoable}</span>
                  <span className="text-monokai-comment">|</span>
                  <span className="text-monokai-comment">可重做:</span>
                  <span className="text-monokai-orange font-medium">{stats.redoable}</span>
                </div>
                {onClear && entries.length > 0 && (
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="text-[10px] text-monokai-danger hover:underline"
                  >
                    清空历史
                  </button>
                )}
              </div>
              
              {/* v4.3: 过滤选项 */}
              <div className="flex items-center gap-2 mt-2">
                {/* 类型过滤 */}
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as HistoryEntry['type'] | 'all')}
                  className="flex-1 px-2 py-1 text-[10px] bg-monokai-bg border border-monokai-border rounded text-monokai-fg"
                >
                  <option value="all">全部类型</option>
                  <option value="create">创建</option>
                  <option value="update">更新</option>
                  <option value="delete">删除</option>
                  <option value="layout">布局</option>
                  <option value="batch">批量</option>
                </select>
                
                {/* 只显示可撤销 */}
                <button
                  onClick={() => setShowOnlyUndoable(!showOnlyUndoable)}
                  className={`
                    px-2 py-1 text-[10px] rounded border transition-colors
                    ${showOnlyUndoable
                      ? 'bg-monokai-accent/15 border-monokai-accent/40 text-monokai-accent'
                      : 'border-monokai-border text-monokai-comment hover:text-monokai-fg'
                    }
                  `}
                >
                  仅可撤销
                </button>
              </div>
            </div>
            
            {/* 快速操作栏 */}
            <div className="px-4 py-2 border-b border-monokai-border flex items-center gap-1 shrink-0">
              <button
                onClick={handleJumpToOldest}
                disabled={currentIndex <= 0}
                className="p-1.5 rounded text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface disabled:opacity-30 transition-colors"
                title="跳转到最初"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              
              <button
                onClick={onUndo}
                disabled={currentIndex <= 0}
                className="p-1.5 rounded text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface disabled:opacity-30 transition-colors"
                title="撤销 (Ctrl+Z)"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              
              <button
                onClick={onRedo}
                disabled={currentIndex >= entries.length - 1}
                className="p-1.5 rounded text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface disabled:opacity-30 transition-colors"
                title="重做 (Ctrl+Y)"
              >
                <Redo2 className="w-4 h-4" />
              </button>
              
              <button
                onClick={handleJumpToLatest}
                disabled={currentIndex >= entries.length - 1}
                className="p-1.5 rounded text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface disabled:opacity-30 transition-colors"
                title="跳转到最新"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>
            
            {/* 历史列表 */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <History className="w-12 h-12 text-monokai-comment/20 mb-3" />
                  <p className="text-sm text-monokai-comment">暂无历史记录</p>
                  <p className="text-[10px] text-monokai-comment/60 mt-1">
                    对画布的操作将记录在这里
                  </p>
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  {/* 时间分组 */}
                  {(() => {
                    const now = Date.now();
                    const todayEntries = entries.filter(e => now - e.timestamp < 86400000);
                    const olderEntries = entries.filter(e => now - e.timestamp >= 86400000);
                    
                    return (
                      <>
                        {todayEntries.length > 0 && (
                          <div className="space-y-1">
                            <div className="px-2 py-1 text-[10px] font-semibold text-monokai-comment uppercase tracking-wider">
                              今天
                            </div>
                            {todayEntries.map((entry, idx) => {
                              const actualIndex = entries.indexOf(entry);
                              return (
                                <HistoryItem
                                  key={entry.id}
                                  entry={entry}
                                  isActive={actualIndex <= currentIndex}
                                  isCurrent={actualIndex === currentIndex}
                                  onJump={() => onJumpTo(actualIndex)}
                                  onUndo={onUndo}
                                />
                              );
                            })}
                          </div>
                        )}
                        
                        {olderEntries.length > 0 && (
                          <div className="space-y-1 mt-4">
                            <div className="px-2 py-1 text-[10px] font-semibold text-monokai-comment uppercase tracking-wider">
                              更早
                            </div>
                            {olderEntries.map((entry) => {
                              const actualIndex = entries.indexOf(entry);
                              return (
                                <HistoryItem
                                  key={entry.id}
                                  entry={entry}
                                  isActive={actualIndex <= currentIndex}
                                  isCurrent={actualIndex === currentIndex}
                                  onJump={() => onJumpTo(actualIndex)}
                                  onUndo={onUndo}
                                />
                              );
                            })}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </>
        )}
        
        {/* 底部快捷键提示 */}
        <div className="px-4 py-2 border-t border-monokai-border bg-monokai-bg/50 shrink-0">
          <div className="flex items-center justify-between text-[10px] text-monokai-comment">
            <div className="flex items-center gap-3">
              <span>
                <kbd className="px-1 py-0.5 bg-monokai-surface rounded border border-monokai-border font-mono">Ctrl+Z</kbd>
                撤销
              </span>
              <span>
                <kbd className="px-1 py-0.5 bg-monokai-surface rounded border border-monokai-border font-mono">Ctrl+Y</kbd>
                重做
              </span>
            </div>
            <div>
              <kbd className="px-1 py-0.5 bg-monokai-surface rounded border border-monokai-border font-mono">Esc</kbd>
              关闭
            </div>
          </div>
        </div>
      </div>
      
      {/* 清空确认对话框 */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowClearConfirm(false)}
          />
          <div className="relative bg-monokai-surface border border-monokai-border rounded-xl p-4 w-80 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-monokai-danger/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-monokai-danger" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-monokai-fg">清空历史记录</h3>
                <p className="text-xs text-monokai-comment mt-1">
                  确定要清空所有历史记录吗？此操作不可撤销。
                </p>
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-3 py-1.5 text-xs text-monokai-comment hover:text-monokai-fg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleClear}
                className="px-3 py-1.5 text-xs bg-monokai-danger text-white rounded-lg hover:brightness-110 transition-all"
              >
                确认清空
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default HistoryPanel;
