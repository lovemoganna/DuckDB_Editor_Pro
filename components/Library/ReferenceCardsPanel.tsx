/**
 * ReferenceCardsPanel - 速查卡片面板
 *
 * 显示系统预置和用户自定义的 SQL 速查卡片
 * 优化：AI 一键填充、快速清除、背景说明
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Copy,
  Check,
  ExternalLink,
  Plus,
  Trash2,
  BookOpen,
  Tag,
  Wand2,
  RotateCcw,
  Sparkles,
  Loader2,
  X,
  Lightbulb
} from 'lucide-react';
import { ReferenceCard } from '../../types';

interface ReferenceCardsPanelProps {
  cards: ReferenceCard[];
  onCopy: (id: string, content: string) => void;
  onInsert: (sql: string) => void;
  onAdd: (card: Omit<ReferenceCard, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onDelete: (id: string) => void;
  copiedId: string | null;
}

// AI 填充建议列表（用于随机推荐或展示）
const AI_FILL_SUGGESTIONS = [
  {
    title: 'SELECT 基本查询',
    syntax: 'SELECT column1, column2 FROM table_name WHERE condition;',
    example: `-- 查询所有用户
SELECT id, username, email FROM users WHERE status = 'active';`,
    scenario: '基础数据查询',
    tags: 'select,基础,查询'
  },
  {
    title: 'JOIN 多表关联',
    syntax: 'SELECT t1.col, t2.col FROM table1 t1 JOIN table2 t2 ON t1.id = t2.foreign_id;',
    example: `-- 用户订单关联查询
SELECT u.username, o.order_id, o.total_amount
FROM users u
INNER JOIN orders o ON u.id = o.user_id
WHERE o.status = 'completed';`,
    scenario: '多表数据关联',
    tags: 'join,关联,多表'
  },
  {
    title: 'GROUP BY 聚合统计',
    syntax: 'SELECT column, COUNT(*), SUM(column) FROM table GROUP BY column;',
    example: `-- 按类别统计订单数量
SELECT category, COUNT(*) as order_count, SUM(amount) as total
FROM orders
GROUP BY category
HAVING COUNT(*) > 10
ORDER BY total DESC;`,
    scenario: '数据聚合分析',
    tags: 'group,聚合,统计'
  },
  {
    title: '窗口函数排名',
    syntax: 'SELECT column, RANK() OVER (ORDER BY column DESC) FROM table;',
    example: `-- 用户消费排名
SELECT 
  user_id,
  username,
  total_amount,
  RANK() OVER (ORDER BY total_amount DESC) as rank,
  PERCENT_RANK() OVER (ORDER BY total_amount DESC) as pct_rank
FROM user_orders;`,
    scenario: '数据排名分析',
    tags: '窗口函数,rank,排名'
  },
  {
    title: '子查询与 CTE',
    syntax: 'WITH cte_name AS (SELECT ...) SELECT * FROM cte_name;',
    example: `-- 使用 CTE 计算用户留存
WITH user_first_order AS (
  SELECT user_id, MIN(order_date) as first_date
  FROM orders
  GROUP BY user_id
)
SELECT u.username, u.register_date, f.first_date
FROM users u
LEFT JOIN user_first_order f ON u.id = f.user_id;`,
    scenario: '复杂查询逻辑',
    tags: 'cte,子查询,复杂查询'
  },
  {
    title: 'CASE 条件判断',
    syntax: 'SELECT CASE WHEN condition THEN result1 ELSE result2 END FROM table;',
    example: `-- 用户等级分类
SELECT 
  username,
  total_amount,
  CASE 
    WHEN total_amount >= 10000 THEN 'VIP'
    WHEN total_amount >= 5000 THEN '高级'
    WHEN total_amount >= 1000 THEN '普通'
    ELSE '新用户'
  END as user_level
FROM user_stats;`,
    scenario: '条件分类',
    tags: 'case,条件,分类'
  }
];

export const ReferenceCardsPanel: React.FC<ReferenceCardsPanelProps> = ({
  cards,
  onCopy,
  onInsert,
  onAdd,
  onDelete,
  copiedId
}) => {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCard, setNewCard] = useState({
    title: '',
    syntax: '',
    example: '',
    scenario: '',
    tags: ''
  });
  const [isAIFilling, setIsAIFilling] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<typeof AI_FILL_SUGGESTIONS>([]);
  const [showAISuggestions, setShowAISuggestions] = useState(false);

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape 快速清除焦点
      if (e.key === 'Escape' && showAddForm) {
        handleQuickClear();
      }
      // Ctrl+Shift+A 触发 AI 填充
      if (e.ctrlKey && e.shiftKey && e.key === 'A' && showAddForm) {
        e.preventDefault();
        handleAIFill();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAddForm]);

  const handleCopy = useCallback((card: ReferenceCard) => {
    onCopy(card.id, card.syntax);
  }, [onCopy]);

  const handleInsert = useCallback((sql: string) => {
    onInsert(sql);
  }, [onInsert]);

  const handleAdd = useCallback(() => {
    if (!newCard.title || !newCard.syntax) return;
    onAdd({
      title: newCard.title,
      syntax: newCard.syntax,
      example: newCard.example,
      scenario: newCard.scenario,
      tags: newCard.tags.split(',').map(t => t.trim()).filter(Boolean)
    });
    setNewCard({ title: '', syntax: '', example: '', scenario: '', tags: '' });
    setShowAddForm(false);
  }, [newCard, onAdd]);

  // 快速清除表单
  const handleQuickClear = useCallback(() => {
    setNewCard({ title: '', syntax: '', example: '', scenario: '', tags: '' });
    setAiSuggestions([]);
    setShowAISuggestions(false);
  }, []);

  // AI 一键填充 - 生成速查卡片（模拟 AI 生成过程）
  const handleAIFill = useCallback(() => {
    setIsAIFilling(true);
    setAiSuggestions([]);
    setShowAISuggestions(false);

    // 模拟 AI 生成延迟（实际项目中可替换为真实 API 调用）
    setTimeout(() => {
      // 随机选择 2-3 个建议
      const shuffled = [...AI_FILL_SUGGESTIONS].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, Math.floor(Math.random() * 2) + 2);
      setAiSuggestions(selected);
      setIsAIFilling(false);
      setShowAISuggestions(true);
    }, 800);
  }, []);

  // 采用 AI 建议
  const handleApplySuggestion = useCallback((suggestion: typeof AI_FILL_SUGGESTIONS[0]) => {
    setNewCard({
      title: suggestion.title,
      syntax: suggestion.syntax,
      example: suggestion.example,
      scenario: suggestion.scenario,
      tags: suggestion.tags
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
      {/* 添加按钮 */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-monokai-comment">共 {cards.length} 张卡片</span>
          <span className="text-xs text-monokai-accent">|</span>
          <span className="text-xs text-monokai-green">系统预置 {cards.filter(c => c.isSystem).length} 张</span>
        </div>
        <div className="flex items-center gap-2">
          {/* AI 填充按钮（表单外） */}
          <button
            onClick={handleAIFill}
            disabled={isAIFilling}
            className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-monokai-amethyst to-monokai-pink text-white rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
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
            className="flex items-center gap-1 px-3 py-1.5 bg-monokai-blue/20 text-monokai-blue rounded-lg text-sm hover:bg-monokai-blue/30 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>添加卡片</span>
          </button>
        </div>
      </div>

      {/* 添加表单 */}
      {showAddForm && (
        <div className="mb-4 p-4 bg-monokai-sidebar border border-monokai-accent rounded-lg">
          <h4 className="text-sm font-medium text-monokai-fg mb-3">添加新速查卡片</h4>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="标题（如：SELECT 查询结构）"
              value={newCard.title}
              onChange={(e) => setNewCard(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 bg-monokai-bg border border-monokai-accent rounded text-sm text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-blue"
            />
            <input
              type="text"
              placeholder="语法模板"
              value={newCard.syntax}
              onChange={(e) => setNewCard(prev => ({ ...prev, syntax: e.target.value }))}
              className="w-full px-3 py-2 bg-monokai-bg border border-monokai-accent rounded text-sm text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-blue font-mono"
            />
            <textarea
              placeholder="示例 SQL（可选）"
              value={newCard.example}
              onChange={(e) => setNewCard(prev => ({ ...prev, example: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 bg-monokai-bg border border-monokai-accent rounded text-sm text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-blue font-mono resize-none"
            />
            <input
              type="text"
              placeholder="使用场景（可选）"
              value={newCard.scenario}
              onChange={(e) => setNewCard(prev => ({ ...prev, scenario: e.target.value }))}
              className="w-full px-3 py-2 bg-monokai-bg border border-monokai-accent rounded text-sm text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-blue"
            />
            <input
              type="text"
              placeholder="标签，逗号分隔（如：select, 基础, 高频）"
              value={newCard.tags}
              onChange={(e) => setNewCard(prev => ({ ...prev, tags: e.target.value }))}
              className="w-full px-3 py-2 bg-monokai-bg border border-monokai-accent rounded text-sm text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-blue"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                className="flex-1 px-3 py-2 bg-monokai-blue text-white rounded text-sm hover:bg-monokai-blue/80 transition-colors"
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

      {/* 卡片列表 */}
      <div className="grid gap-3">
        {cards.map(card => (
          <div
            key={card.id}
            className="p-4 bg-monokai-sidebar border border-monokai-accent rounded-lg hover:border-monokai-blue/50 transition-colors"
          >
            {/* 卡片头部 */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-monokai-blue" />
                <h4 className="text-sm font-medium text-monokai-fg">{card.title}</h4>
                {card.isSystem && (
                  <span className="px-1.5 py-0.5 text-xs bg-monokai-green/20 text-monokai-green rounded">
                    预置
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleCopy(card)}
                  className="p-1.5 rounded hover:bg-monokai-accent/20 text-monokai-comment hover:text-monokai-fg transition-colors"
                  title="复制语法"
                >
                  {copiedId === card.id ? <Check className="w-4 h-4 text-monokai-green" /> : <Copy className="w-4 h-4" />}
                </button>
                {card.example && (
                  <button
                    onClick={() => setExpandedCard(expandedCard === card.id ? null : card.id)}
                    className="p-1.5 rounded hover:bg-monokai-accent/20 text-monokai-comment hover:text-monokai-fg transition-colors"
                    title="查看示例"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                )}
                {!card.isSystem && (
                  <button
                    onClick={() => onDelete(card.id)}
                    className="p-1.5 rounded hover:bg-monokai-red/20 text-monokai-comment hover:text-monokai-red transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* 语法模板 */}
            <pre className="text-xs text-monokai-comment font-mono bg-monokai-bg p-2 rounded mb-2 overflow-x-auto">
              {card.syntax}
            </pre>

            {/* 使用场景 */}
            {card.scenario && (
              <p className="text-xs text-monokai-comment mb-2">
                <span className="text-monokai-fg">场景：</span>{card.scenario}
              </p>
            )}

            {/* 标签 */}
            <div className="flex flex-wrap gap-1 mb-2">
              {card.tags.map((tag, idx) => (
                <span key={idx} className="px-1.5 py-0.5 text-xs bg-monokai-accent/20 text-monokai-comment rounded">
                  {tag}
                </span>
              ))}
            </div>

            {/* 展开的示例 */}
            {expandedCard === card.id && card.example && (
              <div className="mt-3 p-3 bg-monokai-bg border border-monokai-accent rounded">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-monokai-fg">示例</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleInsert(card.example)}
                      className="text-xs text-monokai-blue hover:underline"
                    >
                      插入编辑器
                    </button>
                    <button
                      onClick={() => handleCopy(card)}
                      className="text-xs text-monokai-comment hover:text-monokai-fg"
                    >
                      复制
                    </button>
                  </div>
                </div>
                <pre className="text-xs text-monokai-comment font-mono whitespace-pre-wrap">
                  {card.example}
                </pre>
              </div>
            )}
          </div>
        ))}

        {cards.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 text-monokai-comment mx-auto mb-3" />
            <p className="text-sm text-monokai-comment">暂无速查卡片</p>
            <p className="text-xs text-monokai-comment mt-1">点击上方"添加卡片"或"AI 填充"创建</p>
          </div>
        )}
      </div>

      {/* AI 建议弹窗 */}
      {showAISuggestions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-monokai-bg border border-monokai-amethyst/30 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            {/* 弹窗头部 */}
            <div className="p-4 border-b border-monokai-accent flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-monokai-amethyst" />
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
                <span>根据您的使用场景，AI 为您推荐以下速查卡片：</span>
              </div>

              <div className="space-y-3">
                {aiSuggestions.map((suggestion, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-monokai-sidebar border border-monokai-amethyst/20 rounded-lg hover:border-monokai-amethyst/50 transition-colors cursor-pointer"
                    onClick={() => handleApplySuggestion(suggestion)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-monokai-blue" />
                        <h4 className="text-sm font-medium text-monokai-fg">{suggestion.title}</h4>
                      </div>
                      <span className="text-xs text-monokai-amethyst">点击采用</span>
                    </div>
                    <pre className="text-xs text-monokai-comment font-mono bg-monokai-bg p-2 rounded mb-2 overflow-x-auto">
                      {suggestion.syntax}
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

              <div className="mt-4 p-3 bg-monokai-amethyst/10 rounded-lg border border-monokai-amethyst/20">
                <p className="text-xs text-monokai-comment">
                  💡 <span className="text-monokai-amethyst font-medium">与 AI 二次优化：</span>
                  您可以点击上方卡片直接采用，也可以复制卡片内容后让 AI 为您定制更贴合业务的内容。
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

export default ReferenceCardsPanel;
