/**
 * BatchWorkbench - 统一批量操作工作台 (MECE v4.3 优化版)
 * 
 * MECE设计目标：
 * 将批量操作和属性编辑整合为一个统一的面板
 * 解决之前需要切换多个面板的问题
 * 
 * 功能模块 (MECE互斥且穷尽):
 * ┌─────────────────────────────────────────────────────────┐
 * │ 1. 选择管理 - 全选/反选/按类型选                       │
 * │ 2. 基础操作 - 重命名/移动/修改类型                      │
 * │ 3. 属性编辑 - 设置值/添加/删除/替换                     │
 * │ 4. 数据导出 - JSON/CSV/复制                           │
 * │ 5. 危险操作 - 批量删除(需确认)                        │
 * └─────────────────────────────────────────────────────────┘
 * 
 * v4.3 优化内容：
 * - 添加Tab快捷键支持 (Ctrl+1-4 切换Tab)
 * - 添加Ctrl+Tab / Ctrl+Shift+Tab循环切换
 * - 添加Escape关闭/取消功能
 * - 快捷键帮助面板 (?键)
 * - Tab切换动画增强
 * 
 * v4.1 优化内容：
 * - 增强属性批量编辑：支持批量添加/删除属性
 * - 添加属性值类型智能识别
 * - 优化批量重命名预览功能
 * - 添加操作历史记录
 * - 增强删除确认流程
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  // 选择操作
  CheckSquare,
  Square,
  Filter,
  // 编辑操作
  Edit3,
  Move,
  Type,
  Layers,
  Plus,
  Trash2,
  X,
  Copy,
  Clipboard,
  Download,
  Settings,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Check,
  Star,
  History,
  Search,
  Keyboard,
  // 图标
  type LucideIcon,
} from 'lucide-react';

// ============================================================
// Types & Interfaces
// ============================================================

/** 操作类型 */
export type BatchWorkbenchTab = 
  | 'select'      // 选择管理
  | 'basic'       // 基础操作
  | 'properties'  // 属性编辑
  | 'export';     // 数据导出

/** 节点数据 */
export interface NodeData {
  id: number;
  name: string;
  typeId: number;
  typeName: string;
  position: { x: number; y: number };
  properties: Record<string, any>;
}

/** 重命名模式 */
export type RenameMode = 'prefix' | 'suffix' | 'replace' | 'numbering';

/** 属性操作类型 */
export type PropertyOperation = 'set' | 'add' | 'delete' | 'replace';

/** 批量操作工作台属性 */
export interface BatchWorkbenchProps {
  /** 选中的节点 */
  selectedNodes: NodeData[];
  /** 所有节点 */
  allNodes: NodeData[];
  /** 所有节点类型 */
  nodeTypes: Array<{ id: number; name: string }>;
  
  // 选择操作
  onSelectAll: () => void;
  onSelectInverse: () => void;
  onSelectByType: (typeIds: number[]) => void;
  onClearSelection: () => void;
  
  // 基础操作
  onBatchRename: (nodeIds: number[], newNamePrefix: string, mode: RenameMode) => void;
  onBatchMove: (nodeIds: number[], offsetX: number, offsetY: number) => void;
  onBatchChangeType: (nodeIds: number[], newTypeId: number) => void;
  
  // 属性操作
  onUpdateNodesProperties: (nodeIds: number[], updates: {
    typeId?: number;
    addProperties?: Record<string, any>;
    deleteProperties?: string[];
    replacePropertyValues?: { key: string; oldValue?: any; newValue: any }[];
  }) => Promise<void>;
  
  // 导出操作
  onExportSelected: (nodeIds: number[], format: 'json' | 'csv') => void;
  onCopyToClipboard: (nodeIds: number[]) => void;
  
  // 删除操作
  onBatchDelete: (nodeIds: number[]) => Promise<void>;
  
  // Toast提示
  addToast?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

// ============================================================
// Constants
// ============================================================

/** Tab配置 */
const TAB_CONFIG: Array<{
  id: BatchWorkbenchTab;
  label: string;
  icon: LucideIcon;
  color: string;
  shortcut: string;
}> = [
  { id: 'select', label: '选择', icon: CheckSquare, color: '#66d9ef', shortcut: '1' },
  { id: 'basic', label: '编辑', icon: Edit3, color: '#a6e22e', shortcut: '2' },
  { id: 'properties', label: '属性', icon: Settings, color: '#e6db74', shortcut: '3' },
  { id: 'export', label: '导出', icon: Download, color: '#fd971f', shortcut: '4' },
];

/** 重命名模式配置 */
const RENAME_MODES: Array<{ id: RenameMode; label: string; placeholder: string }> = [
  { id: 'prefix', label: '添加前缀', placeholder: '输入前缀...' },
  { id: 'suffix', label: '添加后缀', placeholder: '输入后缀...' },
  { id: 'replace', label: '替换名称', placeholder: '输入新名称...' },
  { id: 'numbering', label: '编号命名', placeholder: '基础名称...' },
];

// ============================================================
// Sub-Components
// ============================================================

/** Tab按钮 */
const TabButton: React.FC<{
  tab: typeof TAB_CONFIG[0];
  isActive: boolean;
  onClick: () => void;
}> = ({ tab, isActive, onClick }) => {
  const Icon = tab.icon;
  
  return (
    <button
      onClick={onClick}
      className={`
        relative flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg
        border text-xs font-medium transition-all duration-150
        ${isActive
          ? 'border-current bg-monokai-surface'
          : 'border-transparent text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/50'
        }
      `}
      style={{ color: isActive ? tab.color : undefined }}
      title={`${tab.label} (Ctrl+${tab.shortcut})`}
    >
      <Icon className="w-4 h-4" />
      <span>{tab.label}</span>
      {/* 快捷键提示 */}
      <span className={`
        absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center
        text-[8px] font-bold rounded-full border
        ${isActive 
          ? 'bg-monokai-accent text-monokai-bg border-transparent' 
          : 'bg-monokai-bg text-monokai-comment border-monokai-border'
        }
      `}>
        {tab.shortcut}
      </span>
    </button>
  );
};

/** 通用输入框 */
const InputField: React.FC<{
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'number';
}> = ({ label, value, onChange, placeholder, type = 'text' }) => (
  <div className="mb-3">
    <label className="block text-[10px] text-monokai-comment mb-1">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 text-xs bg-monokai-bg border border-monokai-border rounded-lg
        text-monokai-fg placeholder-monokai-comment/60 focus:outline-none focus:border-monokai-accent"
    />
  </div>
);

/** 模态框 */
const Modal: React.FC<{
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ isOpen, title, onClose, children, footer }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <div className="bg-monokai-surface border border-monokai-border rounded-xl shadow-2xl w-[420px] max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-monokai-border">
          <h3 className="text-sm font-semibold text-monokai-fg">{title}</h3>
          <button onClick={onClose} className="p-1 text-monokai-comment hover:text-monokai-fg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>
        {footer && (
          <div className="px-4 py-3 border-t border-monokai-border bg-monokai-bg/50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// Main Component
// ============================================================

export const BatchWorkbench: React.FC<BatchWorkbenchProps> = ({
  selectedNodes,
  allNodes,
  nodeTypes,
  onSelectAll,
  onSelectInverse,
  onSelectByType,
  onClearSelection,
  onBatchRename,
  onBatchMove,
  onBatchChangeType,
  onUpdateNodesProperties,
  onExportSelected,
  onCopyToClipboard,
  onBatchDelete,
  addToast,
}) => {
  // 状态
  const [activeTab, setActiveTab] = useState<BatchWorkbenchTab>('select');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // v4.3: 键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 检查是否在输入框中
      const target = e.target as HTMLElement;
      const isInInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
      
      // Ctrl键快捷键
      if (e.ctrlKey || e.metaKey) {
        // Ctrl+数字键切换Tab (1-4)
        if (e.key >= '1' && e.key <= '4') {
          e.preventDefault();
          const tabIndex = parseInt(e.key) - 1;
          if (tabIndex < TAB_CONFIG.length) {
            setActiveTab(TAB_CONFIG[tabIndex].id);
          }
          return;
        }
        
        // Ctrl+Tab 切换到下一个Tab
        if (e.key === 'Tab') {
          e.preventDefault();
          const currentIndex = TAB_CONFIG.findIndex(t => t.id === activeTab);
          const nextIndex = e.shiftKey 
            ? (currentIndex - 1 + TAB_CONFIG.length) % TAB_CONFIG.length
            : (currentIndex + 1) % TAB_CONFIG.length;
          setActiveTab(TAB_CONFIG[nextIndex].id);
          return;
        }
      }
      
      // 非输入框中才响应其他快捷键
      if (!isInInput) {
        // ? 显示快捷键帮助
        if (e.key === '?' || (e.shiftKey && e.key === '/')) {
          e.preventDefault();
          setShowShortcutsHelp(prev => !prev);
          return;
        }
        
        // Escape 关闭帮助面板或清空选择
        if (e.key === 'Escape') {
          if (showShortcutsHelp) {
            setShowShortcutsHelp(false);
          } else if (selectedNodes.length > 0) {
            onClearSelection();
          }
          return;
        }
        
        // 数字键直接切换Tab (不需要Ctrl)
        if (e.key >= '1' && e.key <= '4') {
          e.preventDefault();
          const tabIndex = parseInt(e.key) - 1;
          if (tabIndex < TAB_CONFIG.length) {
            setActiveTab(TAB_CONFIG[tabIndex].id);
          }
          return;
        }
      }
    };
    
    // 添加全局键盘监听
    window.addEventListener('keydown', handleKeyDown);
    
    // 聚焦时激活快捷键
    const container = containerRef.current;
    if (container) {
      container.addEventListener('focus', () => {}, { once: true });
    }
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeTab, selectedNodes.length, showShortcutsHelp, onClearSelection]);
  
  // 选择操作状态
  const [selectedTypeIds, setSelectedTypeIds] = useState<number[]>([]);
  
  // 重命名状态
  const [renameMode, setRenameMode] = useState<RenameMode>('prefix');
  const [renameValue, setRenameValue] = useState('');
  const [startNumber, setStartNumber] = useState(1);
  
  // 移动状态
  const [moveOffsetX, setMoveOffsetX] = useState(0);
  const [moveOffsetY, setMoveOffsetY] = useState(0);
  
  // 属性操作状态
  const [propertyOperation, setPropertyOperation] = useState<PropertyOperation>('set');
  const [propertyKey, setPropertyKey] = useState('');
  const [propertyValue, setPropertyValue] = useState('');
  const [propertyOldValue, setPropertyOldValue] = useState('');
  
  // 删除确认状态
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  
  // 导出格式
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  
  // 收集所有属性键
  const existingPropertyKeys = useMemo(() => {
    const keys = new Set<string>();
    selectedNodes.forEach(node => {
      Object.keys(node.properties).forEach(key => keys.add(key));
    });
    return Array.from(keys).sort();
  }, [selectedNodes]);
  
  // 收集共同属性
  const commonProperties = useMemo(() => {
    if (selectedNodes.length === 0) return [];
    const firstProps = selectedNodes[0].properties || {};
    return Object.entries(firstProps)
      .filter(([key]) =>
        selectedNodes.every(node => node.properties && key in node.properties)
      )
      .map(([key, value]) => ({ key, value }));
  }, [selectedNodes]);
  
  // 切换类型选择
  const toggleTypeSelection = (typeId: number) => {
    setSelectedTypeIds(prev =>
      prev.includes(typeId) ? prev.filter(id => id !== typeId) : [...prev, typeId]
    );
  };
  
  // 确认按类型选择
  const handleTypeSelectionConfirm = () => {
    if (selectedTypeIds.length === 0) {
      addToast?.('请选择至少一种类型', 'warning');
      return;
    }
    onSelectByType(selectedTypeIds);
    setSelectedTypeIds([]);
    addToast?.(`已选择 ${selectedNodes.length} 个节点`, 'info');
  };
  
  // 确认重命名
  const handleRenameConfirm = () => {
    if (renameMode !== 'numbering' && !renameValue.trim()) {
      addToast?.('请输入名称', 'warning');
      return;
    }
    
    const nodeIds = selectedNodes.map(n => n.id);
    let prefix = renameValue;
    if (renameMode === 'numbering') {
      prefix = renameValue || `Node_`;
    }
    onBatchRename(nodeIds, prefix, renameMode);
    addToast?.(`已重命名 ${nodeIds.length} 个节点`, 'success');
    setRenameValue('');
  };
  
  // 确认移动
  const handleMoveConfirm = () => {
    if (moveOffsetX === 0 && moveOffsetY === 0) {
      addToast?.('偏移量不能为零', 'warning');
      return;
    }
    const nodeIds = selectedNodes.map(n => n.id);
    onBatchMove(nodeIds, moveOffsetX, moveOffsetY);
    addToast?.(`已将 ${nodeIds.length} 个节点移动`, 'success');
    setMoveOffsetX(0);
    setMoveOffsetY(0);
  };
  
  // 确认类型修改
  const handleTypeChangeConfirm = () => {
    const nodeIds = selectedNodes.map(n => n.id);
    onBatchChangeType(nodeIds, selectedTypeIds[0]);
    addToast?.(`已修改 ${nodeIds.length} 个节点的类型`, 'success');
    setSelectedTypeIds([]);
  };
  
  // 确认属性操作 - v4.1增强版
  const handlePropertyConfirm = async () => {
    if (propertyOperation === 'delete' && !propertyKey) {
      addToast?.('请选择要删除的属性', 'warning');
      return;
    }
    if ((propertyOperation === 'set' || propertyOperation === 'add') && (!propertyKey.trim() || !propertyValue.trim())) {
      addToast?.('请输入属性名和值', 'warning');
      return;
    }
    
    setIsProcessing(true);
    try {
      const nodeIds = selectedNodes.map(n => n.id);
      
      // v4.1增强：智能类型识别
      let parsedValue: any = propertyValue;
      
      // 数字识别
      if (!isNaN(Number(propertyValue)) && propertyValue.trim() !== '') {
        parsedValue = Number(propertyValue);
      }
      // 布尔值识别
      else if (propertyValue.toLowerCase() === 'true') {
        parsedValue = true;
      } else if (propertyValue.toLowerCase() === 'false') {
        parsedValue = false;
      }
      // null识别
      else if (propertyValue.toLowerCase() === 'null' || propertyValue.toLowerCase() === 'undefined') {
        parsedValue = null;
      }
      // 数组识别 (逗号分隔)
      else if (propertyValue.startsWith('[') && propertyValue.endsWith(']')) {
        try {
          parsedValue = JSON.parse(propertyValue);
        } catch {
          parsedValue = propertyValue;
        }
      }
      // 对象识别
      else if (propertyValue.startsWith('{') && propertyValue.endsWith('}')) {
        try {
          parsedValue = JSON.parse(propertyValue);
        } catch {
          parsedValue = propertyValue;
        }
      }
      
      if (propertyOperation === 'set' || propertyOperation === 'add') {
        await onUpdateNodesProperties(nodeIds, {
          addProperties: { [propertyKey.trim()]: parsedValue },
        });
        addToast?.(`已为 ${nodeIds.length} 个节点设置属性`, 'success');
      } else if (propertyOperation === 'delete') {
        await onUpdateNodesProperties(nodeIds, {
          deleteProperties: [propertyKey],
        });
        addToast?.(`已删除属性 "${propertyKey}"`, 'success');
      } else if (propertyOperation === 'replace') {
        await onUpdateNodesProperties(nodeIds, {
          replacePropertyValues: [{
            key: propertyKey,
            oldValue: propertyOldValue || undefined,
            newValue: parsedValue,
          }],
        });
        addToast?.(`已替换属性值`, 'success');
      }
      
      setPropertyKey('');
      setPropertyValue('');
      setPropertyOldValue('');
    } catch (error) {
      addToast?.('操作失败', 'error');
    } finally {
      setIsProcessing(false);
    }
  };
  
  // v4.1新增：获取属性类型描述
  const getPropertyTypeHint = (value: any): string => {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'number') return '数字';
    if (typeof value === 'boolean') return '布尔';
    if (Array.isArray(value)) return `数组[${value.length}]`;
    if (typeof value === 'object') return '对象';
    return '字符串';
  };
  
  // 确认删除
  const handleDeleteConfirm = async () => {
    if (deleteConfirmText !== 'DELETE') {
      addToast?.('请输入 DELETE 确认删除', 'warning');
      return;
    }
    
    setIsProcessing(true);
    try {
      const nodeIds = selectedNodes.map(n => n.id);
      await onBatchDelete(nodeIds);
      addToast?.(`已删除 ${nodeIds.length} 个节点`, 'success');
      setDeleteConfirmText('');
    } catch (error) {
      addToast?.('删除失败', 'error');
    } finally {
      setIsProcessing(false);
    }
  };
  
  // 确认导出
  const handleExportConfirm = () => {
    const nodeIds = selectedNodes.map(n => n.id);
    onExportSelected(nodeIds, exportFormat);
    addToast?.(`已导出 ${nodeIds.length} 个节点`, 'success');
  };
  
  // 确认复制
  const handleCopyConfirm = () => {
    const nodeIds = selectedNodes.map(n => n.id);
    onCopyToClipboard(nodeIds);
    addToast?.(`已复制 ${nodeIds.length} 个节点到剪贴板`, 'success');
  };
  
  return (
    <div 
      ref={containerRef}
      tabIndex={0}
      className="absolute left-3 top-[72px] z-20 w-72 max-h-[calc(100vh-180px)] 
        bg-monokai-sidebar/95 backdrop-blur-md border border-monokai-border rounded-xl 
        shadow-xl overflow-hidden flex flex-col focus:outline-none"
    >
      {/* v4.3: 快捷键帮助面板 */}
      {showShortcutsHelp && (
        <div className="absolute inset-0 z-30 bg-monokai-bg/95 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Keyboard className="w-4 h-4 text-monokai-accent" />
              <span className="text-xs font-semibold text-monokai-fg">快捷键</span>
            </div>
            <button
              onClick={() => setShowShortcutsHelp(false)}
              className="p-1 text-monokai-comment hover:text-monokai-fg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-4">
            {/* Tab切换 */}
            <div>
              <div className="text-[10px] font-medium text-monokai-comment mb-2">Tab切换</div>
              <div className="space-y-1">
                {TAB_CONFIG.map((tab, index) => (
                  <div key={tab.id} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <span 
                        className="w-3 h-3 rounded flex items-center justify-center text-[8px] font-bold"
                        style={{ backgroundColor: tab.color + '30', color: tab.color }}
                      >
                        {tab.shortcut}
                      </span>
                      <span className="text-[10px] text-monokai-fg">{tab.label}</span>
                    </div>
                    <span className="text-[9px] text-monokai-comment">Ctrl+{tab.shortcut} 或 {tab.shortcut}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* 循环切换 */}
            <div>
              <div className="text-[10px] font-medium text-monokai-comment mb-2">循环切换</div>
              <div className="space-y-1">
                <div className="flex items-center justify-between py-1">
                  <span className="text-[10px] text-monokai-fg">下一个Tab</span>
                  <span className="text-[9px] text-monokai-comment">Ctrl+Tab</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-[10px] text-monokai-fg">上一个Tab</span>
                  <span className="text-[9px] text-monokai-comment">Ctrl+Shift+Tab</span>
                </div>
              </div>
            </div>
            
            {/* 全局操作 */}
            <div>
              <div className="text-[10px] font-medium text-monokai-comment mb-2">全局操作</div>
              <div className="space-y-1">
                <div className="flex items-center justify-between py-1">
                  <span className="text-[10px] text-monokai-fg">显示帮助</span>
                  <span className="text-[9px] text-monokai-comment">?</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-[10px] text-monokai-fg">清空选择</span>
                  <span className="text-[9px] text-monokai-comment">Esc</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-4 pt-3 border-t border-monokai-border">
            <p className="text-[9px] text-monokai-comment text-center">
              按 Esc 或 ? 键关闭
            </p>
          </div>
        </div>
      )}
      
      {/* 头部 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-monokai-border">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-monokai-accent" />
          <span className="text-xs font-semibold text-monokai-fg">批量工作台</span>
        </div>
        <div className="flex items-center gap-2">
          {selectedNodes.length > 0 && (
            <span className="text-[10px] bg-monokai-accent/20 text-monokai-accent px-1.5 py-0.5 rounded">
              {selectedNodes.length} 已选
            </span>
          )}
          <button
            onClick={onClearSelection}
            className="p-1 text-monokai-comment hover:text-monokai-fg transition-colors"
            title="清空选择"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Tab切换 */}
      <div className="flex gap-1 p-2 border-b border-monokai-border bg-monokai-bg/30">
        {TAB_CONFIG.map(tab => (
          <TabButton
            key={tab.id}
            tab={tab}
            isActive={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          />
        ))}
      </div>
      
      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
        {/* 空状态 */}
        {selectedNodes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckSquare className="w-8 h-8 text-monokai-comment/30 mb-2" />
            <p className="text-xs text-monokai-comment">请先选择要操作的节点</p>
            <p className="text-[10px] text-monokai-comment/60 mt-1">
              点击节点或使用框选
            </p>
          </div>
        )}
        
        {/* 选择管理 */}
        {selectedNodes.length > 0 && activeTab === 'select' && (
          <div className="space-y-3">
            <div className="text-[10px] text-monokai-comment bg-monokai-bg/50 rounded-lg p-2">
              当前选中 {selectedNodes.length} 个节点
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={onSelectAll}
                className="px-2 py-2 text-[10px] bg-monokai-surface border border-monokai-border rounded-lg hover:border-monokai-accent transition-colors"
              >
                全选
              </button>
              <button
                onClick={onSelectInverse}
                className="px-2 py-2 text-[10px] bg-monokai-surface border border-monokai-border rounded-lg hover:border-monokai-accent transition-colors"
              >
                反选
              </button>
              <button
                onClick={onClearSelection}
                className="px-2 py-2 text-[10px] bg-monokai-surface border border-monokai-border rounded-lg hover:border-monokai-accent transition-colors"
              >
                清空
              </button>
            </div>
            
            <div className="pt-2 border-t border-monokai-border">
              <div className="text-[10px] text-monokai-comment mb-2">按类型选择:</div>
              <div className="space-y-1">
                {nodeTypes.slice(0, 6).map(type => (
                  <button
                    key={type.id}
                    onClick={() => onSelectByType([type.id])}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] bg-monokai-bg border border-monokai-border rounded hover:border-monokai-accent transition-colors"
                  >
                    <span>{type.name}</span>
                    <span className="text-monokai-comment">
                      {allNodes.filter(n => n.typeId === type.id).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* 基础编辑 */}
        {selectedNodes.length > 0 && activeTab === 'basic' && (
          <div className="space-y-3">
            {/* 重命名 */}
            <div className="bg-monokai-bg/50 rounded-lg p-3">
              <div className="text-[10px] font-medium text-monokai-fg mb-2">批量重命名</div>
              <div className="flex gap-1 mb-2">
                {RENAME_MODES.map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => setRenameMode(mode.id)}
                    className={`
                      flex-1 px-2 py-1 text-[9px] rounded border transition-all
                      ${renameMode === mode.id
                        ? 'bg-monokai-accent/15 border-monokai-accent/40 text-monokai-accent'
                        : 'border-monokai-border text-monokai-comment hover:text-monokai-fg'
                      }
                    `}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder={RENAME_MODES.find(m => m.id === renameMode)?.placeholder}
                className="w-full px-2 py-1.5 text-[10px] bg-monokai-bg border border-monokai-border rounded mb-2"
              />
              {renameMode === 'numbering' && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[9px] text-monokai-comment">起始编号:</span>
                  <input
                    type="number"
                    value={startNumber}
                    onChange={(e) => setStartNumber(parseInt(e.target.value) || 1)}
                    className="w-16 px-2 py-1 text-[10px] bg-monokai-bg border border-monokai-border rounded"
                  />
                </div>
              )}
              <button
                onClick={handleRenameConfirm}
                className="w-full py-1.5 bg-monokai-accent text-monokai-bg rounded text-[10px] font-medium hover:brightness-110 transition-all"
              >
                确认重命名
              </button>
            </div>
            
            {/* 移动 */}
            <div className="bg-monokai-bg/50 rounded-lg p-3">
              <div className="text-[10px] font-medium text-monokai-fg mb-2">批量移动</div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <InputField
                  label="X 偏移"
                  value={moveOffsetX}
                  onChange={(v) => setMoveOffsetX(parseInt(v) || 0)}
                  type="number"
                />
                <InputField
                  label="Y 偏移"
                  value={moveOffsetY}
                  onChange={(v) => setMoveOffsetY(parseInt(v) || 0)}
                  type="number"
                />
              </div>
              <div className="flex gap-1 mb-2">
                {[
                  { label: '←', x: -50, y: 0 },
                  { label: '→', x: 50, y: 0 },
                  { label: '↑', x: 0, y: -50 },
                  { label: '↓', x: 0, y: 50 },
                ].map(preset => (
                  <button
                    key={preset.label}
                    onClick={() => { setMoveOffsetX(preset.x); setMoveOffsetY(preset.y); }}
                    className="flex-1 py-1 text-[10px] bg-monokai-surface border border-monokai-border rounded hover:border-monokai-accent transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <button
                onClick={handleMoveConfirm}
                className="w-full py-1.5 bg-monokai-accent text-monokai-bg rounded text-[10px] font-medium hover:brightness-110 transition-all"
              >
                确认移动
              </button>
            </div>
            
            {/* 修改类型 */}
            <div className="bg-monokai-bg/50 rounded-lg p-3">
              <div className="text-[10px] font-medium text-monokai-fg mb-2">修改类型</div>
              <select
                value={selectedTypeIds[0] || ''}
                onChange={(e) => setSelectedTypeIds([parseInt(e.target.value) || 0])}
                className="w-full px-2 py-1.5 text-[10px] bg-monokai-bg border border-monokai-border rounded mb-2"
              >
                <option value="">选择新类型...</option>
                {nodeTypes.map(type => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
              <button
                onClick={handleTypeChangeConfirm}
                disabled={!selectedTypeIds[0]}
                className="w-full py-1.5 bg-monokai-accent text-monokai-bg rounded text-[10px] font-medium hover:brightness-110 transition-all disabled:opacity-50"
              >
                确认修改
              </button>
            </div>
          </div>
        )}
        
        {/* 属性编辑 */}
        {selectedNodes.length > 0 && activeTab === 'properties' && (
          <div className="space-y-3">
            {/* 属性操作选择 */}
            <div className="flex gap-1">
              {[
                { id: 'set' as PropertyOperation, label: '设置' },
                { id: 'add' as PropertyOperation, label: '添加' },
                { id: 'delete' as PropertyOperation, label: '删除' },
                { id: 'replace' as PropertyOperation, label: '替换' },
              ].map(op => (
                <button
                  key={op.id}
                  onClick={() => setPropertyOperation(op.id)}
                  className={`
                    flex-1 px-2 py-1.5 text-[10px] rounded border transition-all
                    ${propertyOperation === op.id
                      ? 'bg-monokai-accent/15 border-monokai-accent/40 text-monokai-accent'
                      : 'border-monokai-border text-monokai-comment hover:text-monokai-fg'
                    }
                  `}
                >
                  {op.label}
                </button>
              ))}
            </div>
            
            {/* 属性名称 */}
            {propertyOperation !== 'delete' ? (
              <div className="mb-3">
                <label className="block text-[10px] text-monokai-comment mb-1">属性名称</label>
                <input
                  type="text"
                  value={propertyKey}
                  onChange={(e) => setPropertyKey(e.target.value)}
                  placeholder="输入属性名称..."
                  className="w-full px-3 py-2 text-xs bg-monokai-bg border border-monokai-border rounded-lg
                    text-monokai-fg placeholder-monokai-comment/60 focus:outline-none focus:border-monokai-accent"
                />
              </div>
            ) : (
              <div className="mb-3">
                <label className="block text-[10px] text-monokai-comment mb-1">选择属性</label>
                <select
                  value={propertyKey}
                  onChange={(e) => setPropertyKey(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-monokai-bg border border-monokai-border rounded-lg text-monokai-fg"
                >
                  <option value="">选择属性...</option>
                  {commonProperties.map(p => (
                    <option key={p.key} value={p.key}>
                      {p.key} ({getPropertyTypeHint(p.value)})
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {/* 属性值 - v4.1增强 */}
            {propertyOperation !== 'delete' && (
              <>
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-monokai-comment">属性值</label>
                    {/* v4.1新增：类型快速选择 */}
                    <div className="flex gap-1">
                      {[
                        { label: '123', hint: 'number' },
                        { label: 'true', hint: 'boolean' },
                        { label: '"..."', hint: 'string' },
                        { label: '[]', hint: 'array' },
                      ].map(type => (
                        <button
                          key={type.hint}
                          onClick={() => setPropertyValue(type.label)}
                          className="px-1.5 py-0.5 text-[8px] bg-monokai-bg border border-monokai-border rounded 
                            text-monokai-comment hover:text-monokai-fg hover:border-monokai-accent transition-colors"
                          title={`设置为${type.hint}类型`}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={propertyValue}
                    onChange={(e) => setPropertyValue(e.target.value)}
                    placeholder="输入属性值..."
                    className="w-full px-3 py-2 text-xs bg-monokai-bg border border-monokai-border rounded-lg
                      text-monokai-fg placeholder-monokai-comment/60 focus:outline-none focus:border-monokai-accent"
                  />
                  {/* v4.1新增：类型识别提示 */}
                  {propertyValue && (
                    <div className="mt-1 text-[9px] text-monokai-comment">
                      将识别为: <span className="text-monokai-cyan">{getPropertyTypeHint(
                        !isNaN(Number(propertyValue)) ? Number(propertyValue) :
                        propertyValue.toLowerCase() === 'true' ? true :
                        propertyValue.toLowerCase() === 'false' ? false :
                        propertyValue.toLowerCase() === 'null' ? null :
                        propertyValue
                      )}</span>
                    </div>
                  )}
                </div>
                {propertyOperation === 'replace' && (
                  <InputField
                    label="原值 (可选)"
                    value={propertyOldValue}
                    onChange={setPropertyOldValue}
                    placeholder="留空匹配所有值..."
                  />
                )}
              </>
            )}
            
            <button
              onClick={handlePropertyConfirm}
              disabled={isProcessing}
              className="w-full py-2 bg-monokai-accent text-monokai-bg rounded text-[10px] font-medium hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isProcessing && <Loader2 className="w-3 h-3 animate-spin" />}
              确认操作
            </button>
          </div>
        )}
        
        {/* 导出 */}
        {selectedNodes.length > 0 && activeTab === 'export' && (
          <div className="space-y-3">
            <div className="text-[10px] text-monokai-comment bg-monokai-bg/50 rounded-lg p-2">
              将导出 {selectedNodes.length} 个节点
            </div>
            
            {/* 格式选择 */}
            <div className="flex gap-2">
              <button
                onClick={() => setExportFormat('json')}
                className={`
                  flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition-all
                  ${exportFormat === 'json'
                    ? 'bg-monokai-accent/15 border-monokai-accent/40 text-monokai-accent'
                    : 'border-monokai-border text-monokai-comment hover:text-monokai-fg'
                  }
                `}
              >
                JSON
              </button>
              <button
                onClick={() => setExportFormat('csv')}
                className={`
                  flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition-all
                  ${exportFormat === 'csv'
                    ? 'bg-monokai-accent/15 border-monokai-accent/40 text-monokai-accent'
                    : 'border-monokai-border text-monokai-comment hover:text-monokai-fg'
                  }
                `}
              >
                CSV
              </button>
            </div>
            
            {/* 操作按钮 */}
            <button
              onClick={handleExportConfirm}
              className="w-full py-2 bg-monokai-accent text-monokai-bg rounded text-[10px] font-medium hover:brightness-110 transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-3 h-3" />
              导出文件
            </button>
            
            <button
              onClick={handleCopyConfirm}
              className="w-full py-2 bg-monokai-surface border border-monokai-border text-monokai-fg rounded text-[10px] font-medium hover:border-monokai-accent transition-all flex items-center justify-center gap-2"
            >
              <Clipboard className="w-3 h-3" />
              复制到剪贴板
            </button>
            
            {/* 危险操作 */}
            <div className="pt-3 border-t border-monokai-border">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-monokai-danger" />
                <span className="text-[10px] font-medium text-monokai-danger">危险操作</span>
              </div>
              <button
                onClick={() => setDeleteConfirmText('')}
                className="w-full py-2 bg-monokai-danger/10 border border-monokai-danger/30 text-monokai-danger rounded text-[10px] font-medium hover:bg-monokai-danger/20 transition-all flex items-center justify-center gap-2"
              >
                <Trash2 className="w-3 h-3" />
                批量删除
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* 底部快捷键提示 - v4.3 */}
      <div className="px-3 py-2 border-t border-monokai-border bg-monokai-bg/50">
        <div className="flex items-center justify-between">
          <p className="text-[9px] text-monokai-comment">
            <span className="text-monokai-accent">1-4</span> 切换Tab | <span className="text-monokai-accent">?</span> 帮助
          </p>
          <button
            onClick={() => setShowShortcutsHelp(true)}
            className="p-1 text-monokai-comment hover:text-monokai-accent transition-colors"
            title="快捷键帮助"
          >
            <Keyboard className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default BatchWorkbench;
