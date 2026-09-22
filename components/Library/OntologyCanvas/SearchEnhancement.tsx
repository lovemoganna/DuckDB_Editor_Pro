/**
 * SearchEnhancement - 搜索增强组件 (MECE v4.3 优化版)
 * 
 * MECE优化目标：
 * 1. 模糊搜索支持 - 提高查找效率
 * 2. 搜索历史 - 快速访问最近搜索 (v4.3: 支持localStorage持久化)
 * 3. 分类过滤 - 按类型/属性/图层筛选
 * 4. 实时预览 - 显示搜索结果预览
 * 
 * 功能设计：
 * - 模糊匹配算法 (Fuzzy Search)
 * - 搜索历史记录 (v4.3: 持久化到localStorage)
 * - 分类过滤器
 * - 高亮匹配文本
 * 
 * v4.3 优化内容：
 * - 添加搜索历史localStorage持久化
 * - 添加历史自动清理机制 (30天过期)
 * - 添加导入/导出历史功能
 * - 添加历史搜索统计
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Search,
  X,
  History,
  Star,
  Filter,
  ChevronDown,
  ChevronRight,
  Hash,
  Type,
  ToggleLeft,
  List,
  Settings,
  Highlighter,
  Loader2,
  type Icon as LucideIcon,
} from 'lucide-react';

// ============================================================
// Types & Interfaces
// ============================================================

/** 搜索结果项 */
export interface SearchResultItem {
  id: number;
  name: string;
  typeId: number;
  typeName: string;
  properties?: Record<string, any>;
  layerId?: string;
  matchScore: number;      // 匹配分数 (0-100)
  matchedFields: string[]; // 匹配的字段
  matchHighlights: {
    field: string;
    start: number;
    end: number;
  }[];
}

/** 搜索过滤器 */
export interface SearchFilters {
  byType: number[];       // 按类型ID过滤
  byLayer: string[];      // 按图层过滤
  byProperty: {          // 按属性过滤
    key?: string;
    value?: string;
  };
  hasProperties?: boolean; // 是否有属性
}

/** 搜索配置 */
export interface SearchConfig {
  fuzzyMatch: {
    enabled: boolean;
    threshold: number;    // 0-1, 相似度阈值
  };
  highlight: {
    enabled: boolean;
    color: string;
  };
  maxResults: number;
  debounceMs: number;
}

/** 搜索历史项 */
export interface SearchHistoryItem {
  query: string;
  timestamp: number;
  resultCount: number;
  isFavorite: boolean;
}

// ============================================================
// Constants
// ============================================================

/** 默认搜索配置 */
export const DEFAULT_SEARCH_CONFIG: SearchConfig = {
  fuzzyMatch: {
    enabled: true,
    threshold: 0.4, // 40%相似度开始匹配
  },
  highlight: {
    enabled: true,
    color: '#a6e22e', // monokai-green
  },
  maxResults: 20,
  debounceMs: 200,
};

/** 最大历史记录数 */
const MAX_HISTORY_ITEMS = 10;

/** 最大收藏项数 */
const MAX_FAVORITE_ITEMS = 5;

/** v4.3: localStorage存储键 */
const SEARCH_HISTORY_STORAGE_KEY = 'ontology-canvas-search-history';
const SEARCH_HISTORY_EXPIRY_DAYS = 30; // 30天过期

// ============================================================
// localStorage 持久化工具 (v4.3 新增)
// ============================================================

/**
 * 从localStorage加载搜索历史
 */
function loadSearchHistory(): SearchHistoryItem[] {
  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_STORAGE_KEY);
    if (!stored) return [];
    
    const parsed = JSON.parse(stored) as SearchHistoryItem[];
    const now = Date.now();
    const expiryMs = SEARCH_HISTORY_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    
    // 过滤过期项
    return parsed.filter(item => {
      const age = now - item.timestamp;
      return age < expiryMs;
    });
  } catch (e) {
    console.warn('Failed to load search history from localStorage:', e);
    return [];
  }
}

/**
 * 保存搜索历史到localStorage
 */
function saveSearchHistory(history: SearchHistoryItem[]): void {
  try {
    localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch (e) {
    console.warn('Failed to save search history to localStorage:', e);
  }
}

/**
 * 清除所有搜索历史
 */
function clearSearchHistory(): void {
  try {
    localStorage.removeItem(SEARCH_HISTORY_STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear search history from localStorage:', e);
  }
}

/**
 * 导出搜索历史为JSON
 */
function exportSearchHistory(history: SearchHistoryItem[]): string {
  return JSON.stringify(history, null, 2);
}

/**
 * 从JSON导入搜索历史
 */
function importSearchHistory(json: string): SearchHistoryItem[] | null {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return null;
    
    // 验证并规范化数据
    return parsed
      .filter((item): item is SearchHistoryItem => 
        typeof item.query === 'string' && 
        typeof item.timestamp === 'number'
      )
      .map(item => ({
        query: item.query,
        timestamp: item.timestamp,
        resultCount: item.resultCount ?? 0,
        isFavorite: item.isFavorite ?? false,
      }));
  } catch (e) {
    console.warn('Failed to import search history:', e);
    return null;
  }
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * 计算Levenshtein距离
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * 计算模糊匹配分数 (0-100)
 */
function calculateFuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  // 完全匹配
  if (t === q) return 100;

  // 包含匹配
  if (t.includes(q)) {
    return 80 + (q.length / t.length) * 20;
  }

  // 开头匹配
  if (t.startsWith(q)) {
    return 70 + (q.length / t.length) * 30;
  }

  // 模糊匹配
  const maxLen = Math.max(q.length, t.length);
  const distance = levenshteinDistance(q, t);
  const similarity = 1 - distance / maxLen;

  return similarity * 60; // 最高60分
}

/**
 * 查找匹配位置
 */
function findMatchHighlights(query: string, text: string): { start: number; end: number }[] {
  const highlights: { start: number; end: number }[] = [];
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  
  let searchStart = 0;
  let pos = t.indexOf(q, searchStart);
  
  while (pos !== -1) {
    highlights.push({
      start: pos,
      end: pos + q.length,
    });
    searchStart = pos + 1;
    pos = t.indexOf(q, searchStart);
  }
  
  return highlights;
}

/**
 * 高亮文本渲染
 */
function renderHighlightedText(
  text: string,
  highlights: { start: number; end: number }[],
  highlightColor: string
): React.ReactNode[] {
  if (highlights.length === 0) {
    return [text];
  }

  const result: React.ReactNode[] = [];
  let lastEnd = 0;

  highlights.forEach((h, i) => {
    if (h.start > lastEnd) {
      result.push(text.slice(lastEnd, h.start));
    }
    result.push(
      <span
        key={i}
        style={{ backgroundColor: highlightColor, color: '#0c0d12', borderRadius: '2px' }}
        className="px-0.5 font-semibold"
      >
        {text.slice(h.start, h.end)}
      </span>
    );
    lastEnd = h.end;
  });

  if (lastEnd < text.length) {
    result.push(text.slice(lastEnd));
  }

  return result;
}

// ============================================================
// Sub-Components
// ============================================================

/** 搜索历史项组件 */
const HistoryItem: React.FC<{
  item: SearchHistoryItem;
  onSelect: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
}> = ({ item, onSelect, onToggleFavorite, onDelete }) => {
  // v4.3: 格式化时间显示
  const formatTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return new Date(timestamp).toLocaleDateString('zh-CN');
  };
  
  return (
    <div className="flex items-center gap-2 px-3 py-2 hover:bg-monokai-surface/50 rounded-lg group transition-colors">
      <History className="w-3.5 h-3.5 text-monokai-comment shrink-0" />
      <button
        onClick={onSelect}
        className="flex-1 text-left text-xs text-monokai-fg truncate"
      >
        {item.query}
      </button>
      <span className="text-[10px] text-monokai-comment shrink-0">{item.resultCount} 结果</span>
      <span 
        className="text-[9px] text-monokai-comment/60 shrink-0 hidden group-hover:flex"
        title={new Date(item.timestamp).toLocaleString('zh-CN')}
      >
        {formatTime(item.timestamp)}
      </span>
      <button
        onClick={onToggleFavorite}
        className={`p-1 rounded transition-colors shrink-0 ${item.isFavorite ? 'text-monokai-yellow' : 'text-monokai-comment/50 hover:text-monokai-yellow'}`}
        title={item.isFavorite ? '取消收藏' : '收藏'}
      >
        <Star className={`w-3 h-3 ${item.isFavorite ? 'fill-current' : ''}`} />
      </button>
      <button
        onClick={onDelete}
        className="p-1 rounded text-monokai-comment/50 hover:text-monokai-danger opacity-0 group-hover:opacity-100 transition-all shrink-0"
        title="删除"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};

/** v4.3: 历史管理面板 */
const HistoryManagementPanel: React.FC<{
  history: SearchHistoryItem[];
  onUpdateHistory: (history: SearchHistoryItem[]) => void;
  onClose: () => void;
}> = ({ history, onUpdateHistory, onClose }) => {
  const [showImport, setShowImport] = React.useState(false);
  const [importText, setImportText] = React.useState('');
  const [importError, setImportError] = React.useState('');
  
  // 导出历史
  const handleExport = () => {
    const json = exportSearchHistory(history);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `search-history-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  // 导入历史
  const handleImport = () => {
    const imported = importSearchHistory(importText);
    if (!imported) {
      setImportError('无效的JSON格式');
      return;
    }
    
    // 合并现有历史和导入的历史
    const merged = [...history];
    imported.forEach(item => {
      if (!merged.find(h => h.query === item.query)) {
        merged.push(item);
      }
    });
    
    // 限制数量
    const favorites = merged.filter(h => h.isFavorite);
    const nonFavorites = merged.filter(h => !h.isFavorite);
    const limitedNonFavorites = nonFavorites.slice(0, MAX_HISTORY_ITEMS - favorites.length);
    
    onUpdateHistory([...favorites, ...limitedNonFavorites]);
    setShowImport(false);
    setImportText('');
    setImportError('');
  };
  
  // 清除所有历史
  const handleClearAll = () => {
    if (confirm('确定要清除所有搜索历史吗？')) {
      clearSearchHistory();
      onUpdateHistory([]);
    }
  };
  
  // 统计信息
  const totalSearches = history.reduce((sum, h) => sum + h.resultCount, 0);
  const favoritesCount = history.filter(h => h.isFavorite).length;
  
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-monokai-fg">历史管理</span>
        <button
          onClick={onClose}
          className="p-1 text-monokai-comment hover:text-monokai-fg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      {/* 统计信息 */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-monokai-bg rounded-lg p-2">
          <div className="text-lg font-bold text-monokai-accent">{history.length}</div>
          <div className="text-[9px] text-monokai-comment">总记录</div>
        </div>
        <div className="bg-monokai-bg rounded-lg p-2">
          <div className="text-lg font-bold text-monokai-yellow">{favoritesCount}</div>
          <div className="text-[9px] text-monokai-comment">收藏</div>
        </div>
        <div className="bg-monokai-bg rounded-lg p-2">
          <div className="text-lg font-bold text-monokai-green">{totalSearches}</div>
          <div className="text-[9px] text-monokai-comment">搜索次数</div>
        </div>
      </div>
      
      {/* 操作按钮 */}
      {!showImport ? (
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={history.length === 0}
            className="flex-1 py-2 text-[10px] bg-monokai-surface border border-monokai-border rounded-lg hover:border-monokai-accent transition-colors disabled:opacity-50"
          >
            导出历史
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="flex-1 py-2 text-[10px] bg-monokai-surface border border-monokai-border rounded-lg hover:border-monokai-accent transition-colors"
          >
            导入历史
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={importText}
            onChange={(e) => { setImportText(e.target.value); setImportError(''); }}
            placeholder="粘贴导出的JSON内容..."
            className="w-full h-24 px-3 py-2 text-[10px] bg-monokai-bg border border-monokai-border rounded-lg resize-none"
          />
          {importError && (
            <p className="text-[10px] text-monokai-danger">{importError}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleImport}
              disabled={!importText.trim()}
              className="flex-1 py-2 text-[10px] bg-monokai-accent text-monokai-bg rounded-lg hover:brightness-110 transition-all disabled:opacity-50"
            >
              确认导入
            </button>
            <button
              onClick={() => { setShowImport(false); setImportText(''); setImportError(''); }}
              className="px-4 py-2 text-[10px] bg-monokai-surface border border-monokai-border rounded-lg hover:border-monokai-accent transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}
      
      {/* 清除所有 */}
      {history.length > 0 && (
        <button
          onClick={handleClearAll}
          className="w-full py-2 text-[10px] text-monokai-danger border border-monokai-danger/30 rounded-lg hover:bg-monokai-danger/10 transition-colors"
        >
          清除所有历史
        </button>
      )}
      
      <p className="text-[9px] text-monokai-comment/60 text-center">
        历史记录会在 {SEARCH_HISTORY_EXPIRY_DAYS} 天后自动过期
      </p>
    </div>
  );
};

/** 搜索结果项组件 */
const SearchResultItemComponent: React.FC<{
  item: SearchResultItem;
  onClick: () => void;
  highlightColor: string;
}> = ({ item, onClick, highlightColor }) => {
  const nameHighlights = findMatchHighlights(item.name, item.name);
  const typeNameHighlights = findMatchHighlights(item.name, item.typeName);
  
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2.5 hover:bg-monokai-surface/50 rounded-lg transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-monokai-fg truncate">
              {renderHighlightedText(item.name, nameHighlights, highlightColor)}
            </span>
            {item.matchScore >= 80 && (
              <span className="text-[9px] px-1 py-0.5 bg-monokai-green/20 text-monokai-green rounded shrink-0">
                精确
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${item.typeId % 2 === 0 ? 'bg-monokai-blue/20 text-monokai-blue' : 'bg-monokai-pink/20 text-monokai-pink'}`}>
              {item.typeName}
            </span>
            {item.matchedFields.length > 0 && (
              <span className="text-[10px] text-monokai-comment">
                匹配: {item.matchedFields.join(', ')}
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] font-mono text-monokai-comment">
            相似度 {item.matchScore}%
          </div>
        </div>
      </div>
    </button>
  );
};

/** 分类过滤器组件 */
const TypeFilterDropdown: React.FC<{
  types: Array<{ id: number; name: string }>;
  selected: number[];
  onToggle: (typeId: number) => void;
  onClear: () => void;
}> = ({ types, selected, onToggle, onClear }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-medium
          transition-all
          ${selected.length > 0
            ? 'border-monokai-accent/50 bg-monokai-accent/10 text-monokai-accent'
            : 'border-monokai-border text-monokai-comment hover:text-monokai-fg hover:border-monokai-border-strong'
          }
        `}
      >
        <Filter className="w-3 h-3" />
        <span>类型 {selected.length > 0 ? `(${selected.length})` : ''}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-monokai-surface border border-monokai-border rounded-lg shadow-xl z-50 p-1">
          {selected.length > 0 && (
            <button
              onClick={onClear}
              className="w-full text-left px-3 py-1.5 text-[10px] text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/50 rounded"
            >
              清除筛选
            </button>
          )}
          {types.map(type => (
            <button
              key={type.id}
              onClick={() => onToggle(type.id)}
              className={`
                w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded
                ${selected.includes(type.id)
                  ? 'bg-monokai-accent/10 text-monokai-accent'
                  : 'text-monokai-fg hover:bg-monokai-surface/50'
                }
              `}
            >
              <div className={`w-3 h-3 rounded border ${selected.includes(type.id) ? 'bg-monokai-accent border-monokai-accent' : 'border-monokai-border'}`}>
                {selected.includes(type.id) && (
                  <svg className="w-full h-full text-monokai-bg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              {type.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================
// Main Component
// ============================================================

export interface SearchEnhancementProps {
  /** 所有可搜索的实体 */
  items: Array<{
    id: number;
    name: string;
    typeId: number;
    typeName: string;
    properties?: Record<string, any>;
    layerId?: string;
  }>;
  
  /** 所有实体类型 */
  types: Array<{ id: number; name: string }>;
  
  /** 搜索配置 */
  config?: Partial<SearchConfig>;
  
  /** 搜索回调 */
  onSearch: (results: SearchResultItem[]) => void;
  
  /** 选中回调 */
  onSelect: (item: SearchResultItem) => void;
  
  /** 搜索历史 - v4.3: 现在支持从localStorage自动加载 */
  history: SearchHistoryItem[];
  
  /** 更新历史 */
  onUpdateHistory: (history: SearchHistoryItem[]) => void;
  
  /** v4.3: 是否启用历史持久化 (默认true) */
  enableHistoryPersistence?: boolean;
}

export const SearchEnhancement: React.FC<SearchEnhancementProps> = ({
  items,
  types,
  config = {},
  onSearch,
  onSelect,
  history,
  onUpdateHistory,
  enableHistoryPersistence = true, // v4.3: 默认启用
}) => {
  // v4.3: 初始化时从localStorage加载历史
  useEffect(() => {
    if (enableHistoryPersistence && history.length === 0) {
      const storedHistory = loadSearchHistory();
      if (storedHistory.length > 0) {
        onUpdateHistory(storedHistory);
      }
    }
  }, [enableHistoryPersistence]); // 只在挂载时执行一次
  
  // v4.3: 每次历史更新时同步到localStorage
  useEffect(() => {
    if (enableHistoryPersistence) {
      saveSearchHistory(history);
    }
  }, [history, enableHistoryPersistence]);
  // 合并配置
  const mergedConfig = useMemo(() => ({
    ...DEFAULT_SEARCH_CONFIG,
    ...config,
    fuzzyMatch: { ...DEFAULT_SEARCH_CONFIG.fuzzyMatch, ...config.fuzzyMatch },
    highlight: { ...DEFAULT_SEARCH_CONFIG.highlight, ...config.highlight },
  }), [config]);

  // 状态
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({
    byType: [],
    byLayer: [],
    byProperty: {},
  });
  const [showHistory, setShowHistory] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  
  // Ref
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // 执行搜索
  const performSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) {
      onSearch([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    // 模拟异步搜索
    setTimeout(() => {
      const results: SearchResultItem[] = [];
      const q = searchQuery.toLowerCase();

      items.forEach(item => {
        // 应用过滤器
        if (filters.byType.length > 0 && !filters.byType.includes(item.typeId)) {
          return;
        }
        if (filters.byLayer.length > 0 && item.layerId && !filters.byLayer.includes(item.layerId)) {
          return;
        }

        // 计算匹配分数
        let maxScore = 0;
        const matchedFields: string[] = [];
        const allHighlights: { field: string; start: number; end: number }[] = [];

        // 名称匹配
        const nameScore = calculateFuzzyScore(q, item.name);
        if (nameScore > 0) {
          maxScore = Math.max(maxScore, nameScore);
          if (nameScore >= mergedConfig.fuzzyMatch.threshold * 100) {
            matchedFields.push('name');
            allHighlights.push(...findMatchHighlights(searchQuery, item.name).map(h => ({ field: 'name', ...h })));
          }
        }

        // 类型名称匹配
        const typeScore = calculateFuzzyScore(q, item.typeName);
        if (typeScore > 0) {
          maxScore = Math.max(maxScore, typeScore * 0.8); // 类型权重稍低
          if (typeScore >= mergedConfig.fuzzyMatch.threshold * 100 * 0.8) {
            matchedFields.push('type');
          }
        }

        // 属性匹配
        if (item.properties) {
          Object.entries(item.properties).forEach(([key, value]) => {
            const keyScore = calculateFuzzyScore(q, key);
            if (keyScore > 0 && keyScore >= mergedConfig.fuzzyMatch.threshold * 100) {
              maxScore = Math.max(maxScore, keyScore * 0.6);
              matchedFields.push(`properties.${key}`);
            }

            const valueStr = String(value);
            const valueScore = calculateFuzzyScore(q, valueStr);
            if (valueScore > 0 && valueScore >= mergedConfig.fuzzyMatch.threshold * 100 * 0.5) {
              maxScore = Math.max(maxScore, valueScore * 0.4);
              if (!matchedFields.includes(`properties.${key}`)) {
                matchedFields.push(`properties.${key}`);
              }
            }
          });
        }

        if (maxScore > 0) {
          results.push({
            ...item,
            matchScore: Math.round(maxScore),
            matchedFields,
            matchHighlights: allHighlights,
          });
        }
      });

      // 按匹配分数排序
      results.sort((a, b) => b.matchScore - a.matchScore);

      // 限制结果数
      const limitedResults = results.slice(0, mergedConfig.maxResults);

      onSearch(limitedResults);
      setIsSearching(false);
    }, mergedConfig.debounceMs);
  }, [items, filters, mergedConfig, onSearch]);

  // 防抖搜索
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      performSearch(query);
    }, mergedConfig.debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, performSearch, mergedConfig.debounceMs]);

  // 添加到历史
  const addToHistory = useCallback((searchQuery: string, resultCount: number) => {
    if (!searchQuery.trim()) return;

    const newItem: SearchHistoryItem = {
      query: searchQuery,
      timestamp: Date.now(),
      resultCount,
      isFavorite: false,
    };

    const updatedHistory = [
      newItem,
      ...history.filter(h => h.query !== searchQuery),
    ].slice(0, MAX_HISTORY_ITEMS);

    onUpdateHistory(updatedHistory);
  }, [history, onUpdateHistory]);

  // 切换类型过滤器
  const toggleTypeFilter = useCallback((typeId: number) => {
    setFilters(prev => ({
      ...prev,
      byType: prev.byType.includes(typeId)
        ? prev.byType.filter(id => id !== typeId)
        : [...prev.byType, typeId],
    }));
  }, []);

  // 清除类型过滤器
  const clearTypeFilters = useCallback(() => {
    setFilters(prev => ({ ...prev, byType: [] }));
  }, []);

  // 选择历史项
  const selectHistoryItem = useCallback((item: SearchHistoryItem) => {
    setQuery(item.query);
    setShowHistory(false);
    performSearch(item.query);
  }, [performSearch]);

  // 切换收藏
  const toggleFavorite = useCallback((query: string) => {
    onUpdateHistory(history.map(h =>
      h.query === query ? { ...h, isFavorite: !h.isFavorite } : h
    ));
  }, [history, onUpdateHistory]);

  // 删除历史项
  const deleteHistoryItem = useCallback((query: string) => {
    onUpdateHistory(history.filter(h => h.query !== query));
  }, [history, onUpdateHistory]);

  // 快捷键处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setShowHistory(false);
        inputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 历史和收藏
  const favorites = useMemo(() => history.filter(h => h.isFavorite), [history]);
  const recentHistory = useMemo(() => history.filter(h => !h.isFavorite), [history]);

  return (
    <div className="w-full">
      {/* 搜索输入框 */}
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-monokai-comment" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowHistory(false);
              }}
              onFocus={() => setShowHistory(true)}
              placeholder="搜索实体... (按 / 聚焦)"
              className="
                w-full pl-9 pr-3 py-2 rounded-lg
                bg-monokai-bg border border-monokai-border
                text-xs text-monokai-fg placeholder-monokai-comment/60
                focus:outline-none focus:border-monokai-accent
                transition-colors
              "
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-monokai-accent animate-spin" />
            )}
            {query && !isSearching && (
              <button
                onClick={() => {
                  setQuery('');
                  onSearch([]);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-monokai-comment hover:text-monokai-fg"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {/* 类型过滤器 */}
          <TypeFilterDropdown
            types={types}
            selected={filters.byType}
            onToggle={toggleTypeFilter}
            onClear={clearTypeFilters}
          />
        </div>
        
        {/* 下拉面板 */}
        {showHistory && !query && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-monokai-surface border border-monokai-border rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto custom-scrollbar">
            {/* 收藏搜索 */}
            {favorites.length > 0 && (
              <div className="p-2">
                <div className="flex items-center justify-between px-2 py-1 text-[10px] font-semibold text-monokai-yellow uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <Star className="w-3 h-3" />
                    收藏 ({favorites.length})
                  </div>
                </div>
                {favorites.map(item => (
                  <HistoryItem
                    key={item.query}
                    item={item}
                    onSelect={() => selectHistoryItem(item)}
                    onToggleFavorite={() => toggleFavorite(item.query)}
                    onDelete={() => deleteHistoryItem(item.query)}
                  />
                ))}
              </div>
            )}
            
            {/* 最近搜索 */}
            {recentHistory.length > 0 && (
              <div className="p-2 border-t border-monokai-border">
                <div className="flex items-center justify-between px-2 py-1 text-[10px] font-semibold text-monokai-comment uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <History className="w-3 h-3" />
                    最近搜索 ({recentHistory.length})
                  </div>
                  {enableHistoryPersistence && (
                    <button
                      onClick={() => setShowHistory(false)}
                      className="text-[9px] text-monokai-comment/60 hover:text-monokai-accent transition-colors"
                      title="管理历史"
                    >
                      <Settings className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {recentHistory.map(item => (
                  <HistoryItem
                    key={item.query}
                    item={item}
                    onSelect={() => selectHistoryItem(item)}
                    onToggleFavorite={() => toggleFavorite(item.query)}
                    onDelete={() => deleteHistoryItem(item.query)}
                  />
                ))}
              </div>
            )}
            
            {/* v4.3: 历史统计信息 */}
            {enableHistoryPersistence && history.length > 0 && (
              <div className="p-2 border-t border-monokai-border">
                <HistoryManagementPanel
                  history={history}
                  onUpdateHistory={onUpdateHistory}
                  onClose={() => setShowHistory(false)}
                />
              </div>
            )}
            
            {/* 空状态 */}
            {history.length === 0 && (
              <div className="p-6 text-center">
                <Search className="w-8 h-8 text-monokai-comment/30 mx-auto mb-2" />
                <p className="text-xs text-monokai-comment">输入关键词开始搜索</p>
                {enableHistoryPersistence && (
                  <p className="text-[10px] text-monokai-comment/60 mt-1">
                    搜索历史将自动保存
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchEnhancement;
