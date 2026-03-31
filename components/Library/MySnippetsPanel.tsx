/**
 * MySnippetsPanel - 个人收藏面板
 *
 * 用户归档的 SQL 片段、历史查询、自定义笔记
 * 优化：AI 一键填充、快速清除、背景说明
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Copy,
  Check,
  Plus,
  Trash2,
  Star,
  Tag,
  Search,
  Filter,
  Clock,
  Edit3,
  ExternalLink,
  RotateCcw,
  Sparkles,
  Loader2,
  Lightbulb,
  X
} from 'lucide-react';
import { CodeSnippet } from '../../types';

// AI 填充建议列表
const AI_SNIPPET_SUGGESTIONS = [
  {
    title: '常用日期筛选',
    sql: `-- 最近7天数据
SELECT * FROM orders 
WHERE order_date >= CURRENT_DATE - INTERVAL '7 days';

-- 本月数据
SELECT * FROM orders 
WHERE DATE_TRUNC('month', order_date) = DATE_TRUNC('month', CURRENT_DATE);

-- 去年数据
SELECT * FROM orders 
WHERE EXTRACT(YEAR FROM order_date) = EXTRACT(YEAR FROM CURRENT_DATE) - 1;`,
    description: '常用的日期范围筛选模式',
    tags: '日期,筛选,高频'
  },
  {
    title: '分页查询',
    sql: `-- 分页查询模板 (第N页，每页M条)
SELECT * FROM (
  SELECT *, ROW_NUMBER() OVER (ORDER BY id) AS row_num
  FROM your_table
) t
WHERE row_num > (${1} - 1) * ${10}
AND row_num <= ${1} * ${10};`,
    description: '标准分页查询 SQL',
    tags: '分页,ROWNUMBER,分页'
  },
  {
    title: '去重统计',
    sql: `-- 按用户统计（去重）
SELECT 
  user_id,
  COUNT(DISTINCT order_id) AS order_count,
  COUNT(DISTINCT product_id) AS product_count,
  SUM(amount) AS total_amount
FROM orders
WHERE order_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY user_id
HAVING COUNT(DISTINCT order_id) > 0;`,
    description: '基于 DISTINCT 的去重统计',
    tags: '去重,DISTINCT,统计'
  }
];

interface MySnippetsPanelProps {
  snippets: CodeSnippet[];
  selectedFilter: string;
  onFilterChange: (filter: string) => void;
  onCopy: (id: string, content: string) => void;
  onInsert: (sql: string) => void;
  onAdd: (snippet: Omit<CodeSnippet, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  copiedId: string | null;
}

export const MySnippetsPanel: React.FC<MySnippetsPanelProps> = ({
  snippets,
  selectedFilter,
  onFilterChange,
  onCopy,
  onInsert,
  onAdd,
  onDelete,
  onToggleFavorite,
  copiedId
}) => {
  const [expandedSnippet, setExpandedSnippet] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSnippet, setNewSnippet] = useState({
    title: '',
    sql: '',
    description: '',
    tags: '',
    favorite: false
  });
  const [isAIFilling, setIsAIFilling] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<typeof AI_SNIPPET_SUGGESTIONS>([]);
  const [showAISuggestions, setShowAISuggestions] = useState(false);

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showAddForm) {
        handleQuickClear();
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'A' && showAddForm) {
        e.preventDefault();
        handleAIFill();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAddForm]);

  const handleCopy = useCallback((snippet: CodeSnippet) => {
    onCopy(snippet.id, snippet.sql);
  }, [onCopy]);

  const handleInsert = useCallback((sql: string) => {
    onInsert(sql);
  }, [onInsert]);

  const handleAdd = useCallback(() => {
    if (!newSnippet.title || !newSnippet.sql) return;
    onAdd({
      title: newSnippet.title,
      sql: newSnippet.sql,
      description: newSnippet.description,
      tags: newSnippet.tags.split(',').map(t => t.trim()).filter(Boolean),
      favorite: newSnippet.favorite
    });
    setNewSnippet({ title: '', sql: '', description: '', tags: '', favorite: false });
    setShowAddForm(false);
  }, [newSnippet, onAdd]);

  const formatDate = (timestamp: number) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric'
    });
  };

  // 快速清除
  const handleQuickClear = useCallback(() => {
    onFilterChange('all');
    setNewSnippet({ title: '', sql: '', description: '', tags: '', favorite: false });
    setShowAddForm(false);
    setAiSuggestions([]);
    setShowAISuggestions(false);
  }, [onFilterChange]);

  // AI 一键填充（智能推荐收藏片段）
  const handleAIFill = useCallback(() => {
    setIsAIFilling(true);
    setAiSuggestions([]);
    setShowAISuggestions(false);

    // 模拟 AI 生成延迟
    setTimeout(() => {
      // 随机选择 2-3 个建议
      const shuffled = [...AI_SNIPPET_SUGGESTIONS].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, Math.floor(Math.random() * 2) + 2);
      setAiSuggestions(selected);
      setIsAIFilling(false);
      setShowAISuggestions(true);
    }, 700);
  }, []);

  // 采用 AI 建议
  const handleApplySuggestion = useCallback((suggestion: typeof AI_SNIPPET_SUGGESTIONS[0]) => {
    setNewSnippet({
      title: suggestion.title,
      sql: suggestion.sql,
      description: suggestion.description,
      tags: suggestion.tags,
      favorite: false
    });
    setShowAISuggestions(false);
    setAiSuggestions([]);
  }, []);

  // 关闭 AI 建议弹窗
  const handleCloseAISuggestions = useCallback(() => {
    setShowAISuggestions(false);
  }, []);

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* 筛选器 */}
      <div className="mb-4 flex items-center gap-2">
        <div className="flex items-center gap-1 text-sm text-monokai-comment">
          <Filter className="w-4 h-4" />
          <span>筛选：</span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => onFilterChange('all')}
            className={`px-3 py-1.5 rounded text-sm transition-colors ${
              selectedFilter === 'all'
                ? 'bg-monokai-yellow/20 text-monokai-yellow'
                : 'text-monokai-comment hover:text-monokai-fg'
            }`}
          >
            全部
          </button>
          <button
            onClick={() => onFilterChange('favorites')}
            className={`px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-1 ${
              selectedFilter === 'favorites'
                ? 'bg-monokai-yellow/20 text-monokai-yellow'
                : 'text-monokai-comment hover:text-monokai-fg'
            }`}
          >
            <Star className="w-3 h-3" />
            收藏
          </button>
        </div>
        {/* 快速清除按钮 */}
        <button
          onClick={handleQuickClear}
          className="flex items-center gap-1 px-2 py-1.5 text-xs text-monokai-comment hover:text-monokai-fg hover:bg-monokai-accent/20 rounded transition-colors"
          title="快速清除筛选条件"
        >
          <RotateCcw className="w-3 h-3" />
          清除
        </button>
        <span className="ml-auto text-sm text-monokai-comment">
          共 {snippets.length} 个片段
        </span>
      </div>

      {/* 添加按钮 */}
      <div className="mb-4 flex justify-end gap-2">
        {/* AI 填充按钮（表单外） */}
        <button
          onClick={handleAIFill}
          disabled={isAIFilling}
          className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-monokai-purple to-monokai-pink text-white rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          title="AI 一键填充（Ctrl+Shift+A）"
        >
          {isAIFilling ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          <span>{isAIFilling ? '生成中...' : 'AI 填充'}</span>
        </button>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 px-3 py-1.5 bg-monokai-yellow/20 text-monokai-yellow rounded-lg text-sm hover:bg-monokai-yellow/30 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>添加片段</span>
        </button>
      </div>

      {/* 添加表单 */}
      {showAddForm && (
        <div className="mb-4 p-4 bg-monokai-sidebar border border-monokai-accent rounded-lg">
          <h4 className="text-sm font-medium text-monokai-fg mb-3">添加新代码片段</h4>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="标题"
              value={newSnippet.title}
              onChange={(e) => setNewSnippet(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 bg-monokai-bg border border-monokai-accent rounded text-sm text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-yellow"
            />
            <textarea
              placeholder="SQL 语句"
              value={newSnippet.sql}
              onChange={(e) => setNewSnippet(prev => ({ ...prev, sql: e.target.value }))}
              rows={5}
              className="w-full px-3 py-2 bg-monokai-bg border border-monokai-accent rounded text-sm text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-yellow font-mono resize-none"
            />
            <input
              type="text"
              placeholder="描述（可选）"
              value={newSnippet.description}
              onChange={(e) => setNewSnippet(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 bg-monokai-bg border border-monokai-accent rounded text-sm text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-yellow"
            />
            <input
              type="text"
              placeholder="标签，逗号分隔"
              value={newSnippet.tags}
              onChange={(e) => setNewSnippet(prev => ({ ...prev, tags: e.target.value }))}
              className="w-full px-3 py-2 bg-monokai-bg border border-monokai-accent rounded text-sm text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-yellow"
            />
            <label className="flex items-center gap-2 text-sm text-monokai-fg cursor-pointer">
              <input
                type="checkbox"
                checked={newSnippet.favorite}
                onChange={(e) => setNewSnippet(prev => ({ ...prev, favorite: e.target.checked }))}
                className="w-4 h-4 rounded border-monokai-accent text-monokai-yellow focus:ring-monokai-yellow"
              />
              <Star className={`w-4 h-4 ${newSnippet.favorite ? 'fill-monokai-yellow text-monokai-yellow' : 'text-monokai-comment'}`} />
              收藏此片段
            </label>
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                className="flex-1 px-3 py-2 bg-monokai-yellow text-white rounded text-sm hover:bg-monokai-yellow/80 transition-colors"
              >
                保存
              </button>
              <button
                onClick={handleQuickClear}
                className="flex items-center gap-1 px-3 py-2 bg-monokai-accent/20 text-monokai-comment rounded text-sm hover:bg-monokai-accent/30 transition-colors"
                title="快速清除（Esc）"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-3 py-2 bg-monokai-accent/20 text-monokai-comment rounded text-sm hover:bg-monokai-accent/30 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 片段列表 */}
      <div className="grid gap-3">
        {snippets.map(snippet => (
          <div
            key={snippet.id}
            className="p-4 bg-monokai-sidebar border border-monokai-accent rounded-lg hover:border-monokai-yellow/50 transition-colors"
          >
            {/* 片段头部 */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-medium text-monokai-fg">{snippet.title}</h4>
                  <button
                    onClick={() => onToggleFavorite(snippet.id)}
                    className="p-0.5 hover:bg-monokai-accent/20 rounded transition-colors"
                  >
                    <Star className={`w-4 h-4 ${snippet.favorite ? 'fill-monokai-yellow text-monokai-yellow' : 'text-monokai-comment'}`} />
                  </button>
                  <span className="text-xs text-monokai-comment flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(snippet.updatedAt)}
                  </span>
                </div>
                {snippet.description && (
                  <p className="text-xs text-monokai-comment">{snippet.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={() => handleCopy(snippet)}
                  className="p-1.5 rounded hover:bg-monokai-accent/20 text-monokai-comment hover:text-monokai-fg transition-colors"
                  title="复制"
                >
                  {copiedId === snippet.id ? <Check className="w-4 h-4 text-monokai-green" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setExpandedSnippet(expandedSnippet === snippet.id ? null : snippet.id)}
                  className="p-1.5 rounded hover:bg-monokai-accent/20 text-monokai-comment hover:text-monokai-fg transition-colors"
                  title="查看详情"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(snippet.id)}
                  className="p-1.5 rounded hover:bg-monokai-red/20 text-monokai-comment hover:text-monokai-red transition-colors"
                  title="删除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 标签 */}
            {snippet.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {snippet.tags.map((tag, idx) => (
                  <span key={idx} className="px-1.5 py-0.5 text-xs bg-monokai-accent/20 text-monokai-comment rounded">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* 预览 SQL */}
            <div className="mt-2 p-2 bg-monokai-bg rounded">
              <pre className="text-xs text-monokai-comment font-mono truncate">
                {snippet.sql.slice(0, 100)}{snippet.sql.length > 100 ? '...' : ''}
              </pre>
            </div>

            {/* 展开的 SQL */}
            {expandedSnippet === snippet.id && (
              <div className="mt-3 p-3 bg-monokai-bg border border-monokai-accent rounded">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-monokai-fg">完整 SQL</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleInsert(snippet.sql)}
                      className="text-xs text-monokai-yellow hover:underline"
                    >
                      插入编辑器
                    </button>
                    <button
                      onClick={() => handleCopy(snippet)}
                      className="text-xs text-monokai-comment hover:text-monokai-fg"
                    >
                      复制
                    </button>
                  </div>
                </div>
                <pre className="text-xs text-monokai-comment font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {snippet.sql}
                </pre>
              </div>
            )}
          </div>
        ))}

        {snippets.length === 0 && (
          <div className="text-center py-12">
            <Star className="w-12 h-12 text-monokai-comment mx-auto mb-3" />
            <p className="text-sm text-monokai-comment">暂无收藏片段</p>
            <p className="text-xs text-monokai-comment mt-1">
              {selectedFilter === 'favorites' ? '还没有收藏任何片段' : '点击上方"添加片段"或"AI 填充"创建'}
            </p>
          </div>
        )}
      </div>

      {/* AI 建议弹窗 */}
      {showAISuggestions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-monokai-bg border border-monokai-purple/30 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            {/* 弹窗头部 */}
            <div className="p-4 border-b border-monokai-accent flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-monokai-purple" />
                <h3 className="text-lg font-bold text-monokai-fg">AI 智能推荐</h3>
              </div>
              <button
                onClick={handleCloseAISuggestions}
                className="p-2 rounded hover:bg-monokai-accent/20 text-monokai-comment"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 弹窗内容 */}
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <div className="mb-4 flex items-center gap-2 text-sm text-monokai-comment">
                <Lightbulb className="w-4 h-4 text-monokai-yellow" />
                <span>根据您的收藏偏好，AI 为您推荐以下 SQL 片段：</span>
              </div>

              <div className="space-y-3">
                {aiSuggestions.map((suggestion, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-monokai-sidebar border border-monokai-yellow/20 rounded-lg hover:border-monokai-yellow/50 transition-colors cursor-pointer"
                    onClick={() => handleApplySuggestion(suggestion)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-monokai-yellow" />
                        <h4 className="text-sm font-medium text-monokai-fg">{suggestion.title}</h4>
                      </div>
                      <span className="text-xs text-monokai-yellow">点击采用</span>
                    </div>
                    <pre className="text-xs text-monokai-comment font-mono bg-monokai-bg p-2 rounded mb-2 overflow-x-auto max-h-24">
                      {suggestion.sql}
                    </pre>
                    <div className="flex flex-wrap gap-1">
                      {suggestion.tags.split(',').map((tag, tagIdx) => (
                        <span key={tagIdx} className="px-1.5 py-0.5 text-xs bg-monokai-accent/20 text-monokai-comment rounded">
                          {tag.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3 bg-monokai-purple/10 rounded-lg border border-monokai-purple/20">
                <p className="text-xs text-monokai-comment">
                  💡 <span className="text-monokai-purple font-medium">与 AI 二次优化：</span>
                  您可以点击上方片段直接采用，也可以复制后让 AI 为您定制更贴合业务需求的内容。
                </p>
              </div>
            </div>

            {/* 弹窗底部 */}
            <div className="p-4 border-t border-monokai-accent flex justify-end">
              <button
                onClick={handleCloseAISuggestions}
                className="px-4 py-2 bg-monokai-accent/20 text-monokai-comment rounded-lg text-sm hover:bg-monokai-accent/30 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MySnippetsPanel;
