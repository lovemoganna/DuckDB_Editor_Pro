/**
 * ShortcutsHelpDialog - 键盘快捷键帮助对话框
 * 
 * 功能：
 * 1. 按功能分类显示所有快捷键
 * 2. 支持搜索过滤
 * 3. 按键位显示快捷键
 * 4. 显示快捷键使用统计
 * 
 * MECE设计原则：
 * - 按功能分类：选择、编辑、视图、导航、通用
 * - 每个分类互斥且穷尽
 * - 支持多种视图模式
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Search,
  X,
  Keyboard,
  MousePointer2,
  Edit3,
  Eye,
  Navigation,
  Settings,
  Layers,
  ChevronRight,
  ChevronDown,
  Copy,
  Clipboard,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Undo2,
  Redo2,
  Plus,
  Link2,
  Lock,
  Unlock,
  Sparkles,
  Grid3X3,
  Map as MapIcon,
  ArrowUpDown,
  ArrowLeftRight,
  CheckSquare,
  Square,
  Focus,
  Loader2,
  Zap,
  type LucideIcon,
} from 'lucide-react';

// ============================================================
// Types & Interfaces
// ============================================================

/** 快捷键分类 */
export type ShortcutCategory = 
  | 'selection'    // 选择操作
  | 'editing'     // 编辑操作
  | 'view'        // 视图控制
  | 'navigation'  // 导航
  | 'general';    // 通用操作

/** 快捷键项 */
export interface ShortcutItem {
  /** 唯一标识 */
  id: string;
  /** 显示名称 */
  label: string;
  /** 描述 */
  description?: string;
  /** 快捷键组合 */
  keys: string[];
  /** 图标 */
  icon?: LucideIcon;
  /** 分类 */
  category: ShortcutCategory;
  /** 是否可用 */
  enabled?: boolean;
  /** 禁用原因 */
  disabledReason?: string;
}

/** 视图模式 */
export type ViewMode = 'category' | 'keybinding';

/** 组件属性 */
export interface ShortcutsHelpDialogProps {
  /** 是否显示 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 是否只读模式（影响部分快捷键显示） */
  isReadOnly?: boolean;
  /** 是否有选中节点 */
  hasSelection?: boolean;
  /** 是否有剪贴板数据 */
  hasClipboard?: boolean;
  /** 自定义快捷键映射 */
  customShortcuts?: Record<string, ShortcutItem>;
}

// ============================================================
// Constants
// ============================================================

/** 分类配置 */
const CATEGORY_CONFIG: Record<ShortcutCategory, {
  label: string;
  icon: LucideIcon;
  color: string;
  description: string;
}> = {
  selection: {
    label: '选择操作',
    icon: MousePointer2,
    color: '#66d9ef', // monokai-cyan
    description: '节点和连线的选择、复制、粘贴',
  },
  editing: {
    label: '编辑操作',
    icon: Edit3,
    color: '#a6e22e', // monokai-green
    description: '创建、删除、修改节点和连线',
  },
  view: {
    label: '视图控制',
    icon: Eye,
    color: '#e6db74', // monokai-yellow
    description: '缩放、布局、网格、小地图',
  },
  navigation: {
    label: '导航与定位',
    icon: Navigation,
    color: '#fd971f', // monokai-orange
    description: '搜索、聚焦、平移',
  },
  general: {
    label: '通用操作',
    icon: Settings,
    color: '#f92672', // monokai-pink
    description: '撤销、重做、帮助、模式切换',
  },
};

/** 默认快捷键列表 */
const DEFAULT_SHORTCUTS: ShortcutItem[] = [
  // 选择操作
  {
    id: 'select-all',
    label: '全选',
    description: '选择画布上的所有节点',
    keys: ['Ctrl', 'A'],
    icon: CheckSquare,
    category: 'selection',
  },
  {
    id: 'deselect',
    label: '取消选择',
    description: '清除当前选择',
    keys: ['Escape'],
    icon: Square,
    category: 'selection',
  },
  {
    id: 'inverse-select',
    label: '反选',
    description: '选择当前未选中的节点',
    keys: ['Ctrl', 'Shift', 'I'],
    icon: ArrowUpDown,
    category: 'selection',
  },
  {
    id: 'copy',
    label: '复制',
    description: '复制选中的节点到剪贴板',
    keys: ['Ctrl', 'C'],
    icon: Copy,
    category: 'selection',
  },
  {
    id: 'cut',
    label: '剪切',
    description: '剪切选中的节点',
    keys: ['Ctrl', 'X'],
    icon: Clipboard,
    category: 'selection',
  },
  {
    id: 'paste',
    label: '粘贴',
    description: '粘贴剪贴板中的节点',
    keys: ['Ctrl', 'V'],
    icon: Clipboard,
    category: 'selection',
  },
  {
    id: 'duplicate',
    label: '复制并新建',
    description: '创建选中节点的副本',
    keys: ['Ctrl', 'D'],
    icon: Copy,
    category: 'selection',
  },
  
  // 编辑操作
  {
    id: 'new-node',
    label: '新建节点',
    description: '在画布中央创建新节点',
    keys: ['N'],
    icon: Plus,
    category: 'editing',
  },
  {
    id: 'new-link',
    label: '新建连线',
    description: '创建节点之间的连线',
    keys: ['L'],
    icon: Link2,
    category: 'editing',
  },
  {
    id: 'delete',
    label: '删除选中',
    description: '删除选中的节点和连线',
    keys: ['Delete'],
    icon: Trash2,
    category: 'editing',
  },
  {
    id: 'edit-node',
    label: '编辑节点',
    description: '打开节点编辑对话框',
    keys: ['Enter'],
    icon: Edit3,
    category: 'editing',
  },
  {
    id: 'lock-node',
    label: '锁定/解锁节点',
    description: '切换节点的锁定状态',
    keys: ['K'],
    icon: Lock,
    category: 'editing',
  },
  {
    id: 'reverse-edge',
    label: '反转连线方向',
    description: '反转选中连线的方向',
    keys: ['R'],
    icon: ArrowLeftRight,
    category: 'editing',
  },
  
  // 视图控制
  {
    id: 'zoom-in',
    label: '放大',
    description: '放大画布视图',
    keys: ['+'],
    icon: ZoomIn,
    category: 'view',
  },
  {
    id: 'zoom-out',
    label: '缩小',
    description: '缩小画布视图',
    keys: ['-'],
    icon: ZoomOut,
    category: 'view',
  },
  {
    id: 'fit-view',
    label: '适应视图',
    description: '将所有节点放入视图',
    keys: ['1'],
    icon: Maximize2,
    category: 'view',
  },
  {
    id: 'reset-zoom',
    label: '重置缩放',
    description: '将缩放重置为100%',
    keys: ['0'],
    icon: Maximize2,
    category: 'view',
  },
  {
    id: 'toggle-grid',
    label: '切换网格',
    description: '显示/隐藏背景网格',
    keys: ['G'],
    icon: Grid3X3,
    category: 'view',
  },
  {
    id: 'toggle-minimap',
    label: '切换小地图',
    description: '显示/隐藏小地图',
    keys: ['M'],
    icon: MapIcon,
    category: 'view',
  },
  {
    id: 'auto-layout',
    label: '自动布局',
    description: '重新计算节点布局',
    keys: ['Ctrl', 'L'],
    icon: Sparkles,
    category: 'view',
  },
  
  // 导航
  {
    id: 'search',
    label: '搜索',
    description: '打开搜索框',
    keys: ['/'],
    icon: Search,
    category: 'navigation',
  },
  {
    id: 'focus',
    label: '聚焦节点',
    description: '将选中节点移到视图中央',
    keys: ['F'],
    icon: Focus,
    category: 'navigation',
  },
  {
    id: 'pan-tool',
    label: '平移工具',
    description: '切换到平移模式',
    keys: ['H'],
    icon: Navigation,
    category: 'navigation',
  },
  {
    id: 'box-select-tool',
    label: '框选工具',
    description: '切换到框选模式',
    keys: ['B'],
    icon: CheckSquare,
    category: 'navigation',
  },
  
  // 通用操作
  {
    id: 'undo',
    label: '撤销',
    description: '撤销上一次操作',
    keys: ['Ctrl', 'Z'],
    icon: Undo2,
    category: 'general',
  },
  {
    id: 'redo',
    label: '重做',
    description: '重做已撤销的操作',
    keys: ['Ctrl', 'Y'],
    icon: Redo2,
    category: 'general',
  },
  {
    id: 'help',
    label: '快捷键帮助',
    description: '打开本帮助对话框',
    keys: ['?'],
    icon: Keyboard,
    category: 'general',
  },
  {
    id: 'read-only',
    label: '只读模式',
    description: '切换只读模式',
    keys: ['Ctrl', 'Shift', 'R'],
    icon: Eye,
    category: 'general',
  },
];

/** 修饰键显示配置 */
const MODIFIER_KEYS: Record<string, string> = {
  Ctrl: '⌃',
  Shift: '⇧',
  Alt: '⌥',
  Meta: '⌘',
};

// ============================================================
// Sub-Components
// ============================================================

/** 快捷键按钮渲染 */
const KeyButton: React.FC<{ keyName: string }> = ({ keyName }) => {
  const displayKey = MODIFIER_KEYS[keyName] || keyName;
  
  return (
    <kbd className="
      inline-flex items-center justify-center min-w-[24px] h-6 px-1.5
      bg-monokai-bg border border-monokai-border rounded text-[10px] font-mono
      text-monokai-fg shadow-sm
    ">
      {displayKey}
    </kbd>
  );
};

/** 快捷键组合渲染 */
const ShortcutKeys: React.FC<{ keys: string[] }> = ({ keys }) => (
  <div className="flex items-center gap-0.5">
    {keys.map((key, index) => (
      <React.Fragment key={key}>
        {index > 0 && <span className="text-monokai-comment mx-0.5 text-[10px]">+</span>}
        <KeyButton keyName={key} />
      </React.Fragment>
    ))}
  </div>
);

/** 分类头部 */
const CategoryHeader: React.FC<{
  category: ShortcutCategory;
  isExpanded: boolean;
  onToggle: () => void;
  count: number;
}> = ({ category, isExpanded, onToggle, count }) => {
  const config = CATEGORY_CONFIG[category];
  const Icon = config.icon;
  
  return (
    <button
      onClick={onToggle}
      className="
        w-full flex items-center gap-2 px-3 py-2 rounded-lg
        text-xs font-semibold transition-colors
        hover:bg-monokai-surface
      "
      style={{ color: config.color }}
    >
      {isExpanded ? (
        <ChevronDown className="w-4 h-4" />
      ) : (
        <ChevronRight className="w-4 h-4" />
      )}
      <Icon className="w-4 h-4" />
      <span className="flex-1 text-left">{config.label}</span>
      <span className="text-[10px] opacity-60 bg-monokai-bg px-1.5 py-0.5 rounded">
        {count}
      </span>
    </button>
  );
};

/** 快捷键项 */
const ShortcutRow: React.FC<{
  shortcut: ShortcutItem;
}> = ({ shortcut }) => {
  const Icon = shortcut.icon || Keyboard;
  const isDisabled = shortcut.enabled === false;
  
  return (
    <div className={`
      flex items-center gap-3 px-3 py-2 rounded-lg
      ${isDisabled ? 'opacity-40' : ''}
    `}>
      <Icon className="w-4 h-4 text-monokai-comment shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-monokai-fg truncate">{shortcut.label}</div>
        {shortcut.description && (
          <div className="text-[10px] text-monokai-comment truncate">
            {isDisabled ? shortcut.disabledReason : shortcut.description}
          </div>
        )}
      </div>
      <ShortcutKeys keys={shortcut.keys} />
    </div>
  );
};

/** 按键绑定视图的快捷键项 */
const KeyBindingRow: React.FC<{
  shortcut: ShortcutItem;
}> = ({ shortcut }) => {
  const Icon = shortcut.icon || Keyboard;
  const isDisabled = shortcut.enabled === false;
  
  return (
    <div className={`
      flex items-center gap-3 px-3 py-2 rounded-lg
      ${isDisabled ? 'opacity-40' : ''}
    `}>
      <ShortcutKeys keys={shortcut.keys} />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-monokai-fg truncate">{shortcut.label}</div>
        {shortcut.description && (
          <div className="text-[10px] text-monokai-comment truncate">
            {isDisabled ? shortcut.disabledReason : shortcut.description}
          </div>
        )}
      </div>
      <Icon className="w-4 h-4 text-monokai-comment shrink-0" />
    </div>
  );
};

// ============================================================
// Main Component
// ============================================================

export const ShortcutsHelpDialog: React.FC<ShortcutsHelpDialogProps> = ({
  isOpen,
  onClose,
  isReadOnly = false,
  hasSelection = false,
  hasClipboard = false,
  customShortcuts,
}) => {
  // 状态
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('category');
  const [expandedCategories, setExpandedCategories] = useState<Set<ShortcutCategory>>(
    new Set(['selection', 'editing', 'view', 'navigation', 'general'])
  );
  
  // 处理快捷键映射
  const shortcuts = useMemo(() => {
    const mapped = new Map<string, ShortcutItem>();
    
    // 添加默认快捷键
    DEFAULT_SHORTCUTS.forEach(s => mapped.set(s.id, s));
    
    // 应用上下文状态
    mapped.forEach(s => {
      if (s.id === 'paste') {
        s.enabled = hasClipboard;
        s.disabledReason = hasClipboard ? undefined : '剪贴板为空';
      }
      if (s.id === 'copy' || s.id === 'cut' || s.id === 'duplicate' || s.id === 'delete') {
        s.enabled = hasSelection;
        s.disabledReason = hasSelection ? undefined : '无选中节点';
      }
      if (s.id === 'new-node' || s.id === 'new-link' || s.id === 'lock-node') {
        s.enabled = !isReadOnly;
        s.disabledReason = isReadOnly ? '只读模式' : undefined;
      }
    });
    
    // 应用自定义快捷键
    if (customShortcuts) {
      Object.entries(customShortcuts).forEach(([id, shortcut]) => {
        const existing = mapped.get(id);
        if (existing) {
          mapped.set(id, { ...existing, ...shortcut });
        } else {
          mapped.set(id, shortcut);
        }
      });
    }
    
    return Array.from(mapped.values());
  }, [isReadOnly, hasSelection, hasClipboard, customShortcuts]);
  
  // 过滤后的快捷键
  const filteredShortcuts = useMemo(() => {
    if (!searchQuery.trim()) return shortcuts;
    
    const query = searchQuery.toLowerCase();
    return shortcuts.filter(s => 
      s.label.toLowerCase().includes(query) ||
      s.description?.toLowerCase().includes(query) ||
      s.keys.some(k => k.toLowerCase().includes(query))
    );
  }, [shortcuts, searchQuery]);
  
  // 按分类分组的快捷键
  const shortcutsByCategory = useMemo(() => {
    const grouped: Record<ShortcutCategory, ShortcutItem[]> = {
      selection: [],
      editing: [],
      view: [],
      navigation: [],
      general: [],
    };
    
    filteredShortcuts.forEach(s => {
      grouped[s.category].push(s);
    });
    
    return grouped;
  }, [filteredShortcuts]);
  
  // 按按键分组（用于keybinding视图）
  const shortcutsByKey = useMemo(() => {
    const grouped: Record<string, ShortcutItem[]> = {};
    
    filteredShortcuts.forEach(s => {
      const keyCombo = s.keys.join('+');
      if (!grouped[keyCombo]) {
        grouped[keyCombo] = [];
      }
      grouped[keyCombo].push(s);
    });
    
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .reduce((acc, [key, items]) => {
        acc[key] = items;
        return acc;
      }, {} as Record<string, ShortcutItem[]>);
  }, [filteredShortcuts]);
  
  // 切换分类展开状态
  const toggleCategory = useCallback((category: ShortcutCategory) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);
  
  // 展开所有分类
  const expandAll = useCallback(() => {
    setExpandedCategories(new Set(['selection', 'editing', 'view', 'navigation', 'general']));
  }, []);
  
  // 折叠所有分类
  const collapseAll = useCallback(() => {
    setExpandedCategories(new Set());
  }, []);
  
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
  
  // 统计信息
  const stats = useMemo(() => ({
    total: shortcuts.length,
    enabled: shortcuts.filter(s => s.enabled !== false).length,
    filtered: filteredShortcuts.length,
    byCategory: {
      selection: shortcuts.filter(s => s.category === 'selection').length,
      editing: shortcuts.filter(s => s.category === 'editing').length,
      view: shortcuts.filter(s => s.category === 'view').length,
      navigation: shortcuts.filter(s => s.category === 'navigation').length,
      general: shortcuts.filter(s => s.category === 'general').length,
    }
  }), [shortcuts, filteredShortcuts]);

  // 常用快捷键（按使用频率排序的前5个）
  const frequentShortcuts = useMemo(() => {
    return shortcuts
      .filter(s => s.enabled !== false)
      .slice(0, 5);
  }, [shortcuts]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* 对话框 */}
      <div className="
        relative w-[720px] max-h-[80vh] flex flex-col
        bg-monokai-sidebar border border-monokai-border rounded-2xl
        shadow-2xl overflow-hidden
        animate-in fade-in zoom-in-95 duration-200
      ">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-monokai-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-monokai-accent/20 flex items-center justify-center">
              <Keyboard className="w-4 h-4 text-monokai-accent" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-monokai-fg">键盘快捷键</h2>
              <p className="text-[10px] text-monokai-comment">
                {stats.filtered} 个快捷键可用 · {stats.enabled} 个当前可用
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* 视图切换 */}
            <div className="flex items-center gap-1 bg-monokai-bg rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('category')}
                className={`
                  px-2.5 py-1 rounded text-[10px] font-medium transition-colors
                  ${viewMode === 'category' 
                    ? 'bg-monokai-surface text-monokai-fg' 
                    : 'text-monokai-comment hover:text-monokai-fg'
                  }
                `}
              >
                按分类
              </button>
              <button
                onClick={() => setViewMode('keybinding')}
                className={`
                  px-2.5 py-1 rounded text-[10px] font-medium transition-colors
                  ${viewMode === 'keybinding' 
                    ? 'bg-monokai-surface text-monokai-fg' 
                    : 'text-monokai-comment hover:text-monokai-fg'
                  }
                `}
              >
                按按键
              </button>
            </div>
            
            {/* 关闭按钮 */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* 常用快捷键快速访问区 */}
        {!searchQuery && (
          <div className="px-4 py-2 border-b border-monokai-border/50 bg-monokai-bg/30 shrink-0">
            <div className="flex items-center gap-2 mb-1.5">
              <Zap className="w-3 h-3 text-monokai-yellow" />
              <span className="text-[10px] font-semibold text-monokai-comment uppercase tracking-wider">
                常用操作
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {frequentShortcuts.map(shortcut => {
                const Icon = shortcut.icon || Keyboard;
                return (
                  <button
                    key={shortcut.id}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-monokai-surface/50 hover:bg-monokai-surface transition-colors text-[10px]"
                  >
                    <Icon className="w-3 h-3 text-monokai-comment" />
                    <span className="text-monokai-fg">{shortcut.label}</span>
                    <ShortcutKeys keys={shortcut.keys} />
                  </button>
                );
              })}
            </div>
          </div>
        )}
        
        {/* 搜索栏 */}
        <div className="px-4 py-3 border-b border-monokai-border shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-monokai-comment" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索快捷键..."
              className="
                w-full pl-9 pr-3 py-2 rounded-lg
                bg-monokai-bg border border-monokai-border
                text-xs text-monokai-fg placeholder-monokai-comment/60
                focus:outline-none focus:border-monokai-accent
              "
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-monokai-comment hover:text-monokai-fg"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          
          {/* 快速操作 */}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-monokai-comment">快速筛选:</span>
            <button
              onClick={expandAll}
              className="text-[10px] text-monokai-accent hover:underline"
            >
              展开全部
            </button>
            <span className="text-monokai-comment">·</span>
            <button
              onClick={collapseAll}
              className="text-[10px] text-monokai-accent hover:underline"
            >
              折叠全部
            </button>
          </div>
        </div>
        
        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
          {/* 分类视图 */}
          {viewMode === 'category' && (
            <div className="space-y-2">
              {(Object.keys(CATEGORY_CONFIG) as ShortcutCategory[]).map(category => {
                const items = shortcutsByCategory[category];
                if (items.length === 0) return null;
                
                const config = CATEGORY_CONFIG[category];
                const isExpanded = expandedCategories.has(category);
                
                return (
                  <div key={category} className="rounded-lg border border-monokai-border overflow-hidden">
                    <CategoryHeader
                      category={category}
                      isExpanded={isExpanded}
                      onToggle={() => toggleCategory(category)}
                      count={items.length}
                    />
                    {isExpanded && (
                      <div className="px-2 pb-2 space-y-0.5">
                        {items.map(shortcut => (
                          <ShortcutRow key={shortcut.id} shortcut={shortcut} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          
          {/* 按键视图 */}
          {viewMode === 'keybinding' && (
            <div className="space-y-2">
              {Object.entries(shortcutsByKey).map(([keyCombo, items]) => (
                <div key={keyCombo} className="rounded-lg border border-monokai-border overflow-hidden">
                  <div className="px-3 py-1.5 bg-monokai-bg/50 border-b border-monokai-border/50">
                    <ShortcutKeys keys={keyCombo.split('+')} />
                  </div>
                  <div className="px-2 pb-2 space-y-0.5">
                    {items.map(shortcut => (
                      <KeyBindingRow key={shortcut.id} shortcut={shortcut} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* 无结果 */}
          {filteredShortcuts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="w-10 h-10 text-monokai-comment/30 mb-3" />
              <p className="text-sm text-monokai-comment">未找到匹配的快捷键</p>
              <p className="text-[10px] text-monokai-comment/60 mt-1">
                尝试其他搜索词
              </p>
            </div>
          )}
        </div>
        
        {/* 底部提示 */}
        <div className="px-4 py-2.5 border-t border-monokai-border bg-monokai-bg/50 shrink-0">
          <div className="flex items-center justify-between text-[10px] text-monokai-comment">
            <div className="flex items-center gap-4">
              <span>⌃ = Ctrl</span>
              <span>⇧ = Shift</span>
              <span>⌥ = Alt</span>
              <span>⌘ = Cmd</span>
            </div>
            <div className="flex items-center gap-2">
              <span>按</span>
              <kbd className="px-1.5 py-0.5 bg-monokai-surface rounded border border-monokai-border font-mono">Esc</kbd>
              <span>关闭</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// Hook: 使用快捷键管理
// ============================================================

/** 快捷键事件处理钩子 */
export const useShortcuts = (
  handlers: Record<string, () => void>,
  enabled: boolean = true
) => {
  useEffect(() => {
    if (!enabled) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const modifiers = {
        ctrl: e.ctrlKey || e.metaKey,
        shift: e.shiftKey,
        alt: e.altKey,
      };
      
      // 查找匹配的处理器
      Object.entries(handlers).forEach(([shortcut, handler]) => {
        const parts = shortcut.toLowerCase().split('+');
        const expectedMods = {
          ctrl: parts.includes('ctrl'),
          shift: parts.includes('shift'),
          alt: parts.includes('alt'),
        };
        const keyPart = parts[parts.length - 1];
        
        if (
          key === keyPart &&
          modifiers.ctrl === expectedMods.ctrl &&
          modifiers.shift === expectedMods.shift &&
          modifiers.alt === expectedMods.alt
        ) {
          e.preventDefault();
          handler();
        }
      });
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers, enabled]);
};

export default ShortcutsHelpDialog;
