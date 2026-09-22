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
import { CodeHighlightBlock } from '../ui/CodeHighlightBlock';
import { duckDBService } from '../../services/duckdbService';
import { libraryAiService } from '../../services/libraryAiService';
import { toastService } from '../../services/toastService';

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

  // AI 一键填充 - 结合 DuckDB 真实表结构与 AI 智能生成速查卡片
  const handleAIFill = useCallback(async () => {
    setIsAIFilling(true);
    setAiSuggestions([]);
    setShowAISuggestions(false);

    try {
      const tables = await duckDBService.getTables().catch(() => []);
      let generated: Array<typeof AI_FILL_SUGGESTIONS[0]> = [];

      if (tables.length > 0) {
        const targetTable = tables[0];
        const schema = await duckDBService.getTableSchema(targetTable).catch(() => []);
        
        try {
          const aiSnippets = await libraryAiService.generateTemplatesForTable(
            targetTable,
            schema.map((c: any) => ({ name: c.name, type: c.type || 'VARCHAR' }))
          );
          if (aiSnippets && aiSnippets.length > 0) {
            generated = aiSnippets.map(s => ({
              title: s.title,
              syntax: s.sql.split('\n')[0] || s.sql,
              example: s.sql,
              scenario: s.description,
              tags: s.tags.join(',')
            }));
          }
        } catch {
          // Fallback to dynamic schema-based templates
          const colNames = schema.map((c: any) => c.name);
          generated = [
            {
              title: `${targetTable} 表全字段探查`,
              syntax: `SELECT * FROM "${targetTable}" LIMIT 50;`,
              example: `-- 探查 ${targetTable} 表全量字段与前 50 行数据\nSELECT * FROM "${targetTable}" LIMIT 50;`,
              scenario: `快速探查数据表 ${targetTable} 的数据分布与样本`,
              tags: `${targetTable},dql,explore`
            },
            {
              title: `${targetTable} 统计指标聚合 (Summarize)`,
              syntax: `SUMMARIZE "${targetTable}";`,
              example: `-- 计算 ${targetTable} 各列的 Min, Max, Null 比例与唯一值数\nSUMMARIZE "${targetTable}";`,
              scenario: `DuckDB 原生列存储分布统计`,
              tags: `${targetTable},summarize,stats`
            },
            {
              title: `${targetTable} 行数与非空率检查`,
              syntax: `SELECT COUNT(*) AS total_rows FROM "${targetTable}";`,
              example: `-- 检查行数与列完整性\nSELECT COUNT(*) AS total_rows${colNames.length > 0 ? `, COUNT("${colNames[0]}") AS valid_count` : ''} FROM "${targetTable}";`,
              scenario: `数据质量与完整性基础核验`,
              tags: `${targetTable},quality,count`
            }
          ];
        }
      }

      if (generated.length === 0) {
        generated = AI_FILL_SUGGESTIONS.slice(0, 3);
      }

      setAiSuggestions(generated);
      setShowAISuggestions(true);
      toastService.success(`AI 已生成 ${generated.length} 个速查建议卡片`);
    } catch (err: any) {
      toastService.error('生成速查建议失败: ' + (err?.message || String(err)));
    } finally {
      setIsAIFilling(false);
    }
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
        <div className="mb-4 p-4 bg-monokai-surface/90 rounded-xl shadow-md">
          <h4 className="text-xs font-semibold text-monokai-fg mb-3">添加新速查卡片</h4>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="标题（如：SELECT 查询结构）"
              value={newCard.title}
              onChange={(e) => setNewCard(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 bg-monokai-bg rounded-lg text-xs text-monokai-fg placeholder-monokai-comment focus:outline-none focus:ring-1 focus:ring-monokai-cyan/70"
            />
            <input
              type="text"
              placeholder="语法模板"
              value={newCard.syntax}
              onChange={(e) => setNewCard(prev => ({ ...prev, syntax: e.target.value }))}
              className="w-full px-3 py-2 bg-monokai-bg rounded-lg text-xs text-monokai-fg placeholder-monokai-comment focus:outline-none focus:ring-1 focus:ring-monokai-cyan/70 font-mono"
            />
            <textarea
              placeholder="示例 SQL（可选）"
              value={newCard.example}
              onChange={(e) => setNewCard(prev => ({ ...prev, example: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 bg-monokai-bg rounded-lg text-xs text-monokai-fg placeholder-monokai-comment focus:outline-none focus:ring-1 focus:ring-monokai-cyan/70 font-mono resize-none"
            />
            <input
              type="text"
              placeholder="使用场景（可选）"
              value={newCard.scenario}
              onChange={(e) => setNewCard(prev => ({ ...prev, scenario: e.target.value }))}
              className="w-full px-3 py-2 bg-monokai-bg rounded-lg text-xs text-monokai-fg placeholder-monokai-comment focus:outline-none focus:ring-1 focus:ring-monokai-cyan/70"
            />
            <input
              type="text"
              placeholder="标签，逗号分隔（如：select, 基础, 高频）"
              value={newCard.tags}
              onChange={(e) => setNewCard(prev => ({ ...prev, tags: e.target.value }))}
              className="w-full px-3 py-2 bg-monokai-bg rounded-lg text-xs text-monokai-fg placeholder-monokai-comment focus:outline-none focus:ring-1 focus:ring-monokai-cyan/70"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                className="flex-1 px-3 py-1.5 bg-monokai-cyan text-monokai-bg font-semibold rounded-lg text-xs hover:bg-monokai-cyan/90 transition-colors cursor-pointer"
              >
                保存卡片
              </button>
              <button
                onClick={handleQuickClear}
                className="flex items-center gap-1 px-3 py-1.5 bg-monokai-surface text-monokai-comment rounded-lg text-xs hover:text-monokai-fg transition-colors cursor-pointer"
                title="快速清除（Esc）"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 bg-monokai-surface text-monokai-comment rounded-lg text-xs hover:text-monokai-fg transition-colors cursor-pointer"
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
            className="p-4 bg-monokai-surface/90 rounded-xl transition-colors shadow-xs"
          >
            {/* 卡片头部 */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-monokai-cyan" />
                <h4 className="text-xs font-semibold text-monokai-fg">{card.title}</h4>
                {card.isSystem && (
                  <span className="px-2 py-0.5 text-[10px] font-mono font-medium bg-monokai-cyan/15 text-monokai-cyan rounded">
                    预置
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleCopy(card)}
                  className="p-1.5 rounded-lg hover:bg-monokai-surface text-monokai-comment hover:text-monokai-fg transition-colors cursor-pointer"
                  title="复制语法"
                >
                  {copiedId === card.id ? <Check className="w-3.5 h-3.5 text-monokai-green" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                {card.example && (
                  <button
                    onClick={() => setExpandedCard(expandedCard === card.id ? null : card.id)}
                    className="p-1.5 rounded-lg hover:bg-monokai-surface text-monokai-comment hover:text-monokai-cyan border border-transparent hover:border-monokai-border/70 transition-colors cursor-pointer"
                    title="查看示例"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
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
            <CodeHighlightBlock
              code={card.syntax}
              language="sql"
              title="SQL 语法"
              showLineNumbers={false}
              maxHeight="120px"
              className="mb-2"
            />

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
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-monokai-fg">示例语句</span>
                  <button
                    type="button"
                    onClick={() => handleInsert(card.example)}
                    className="text-xs text-monokai-blue hover:underline cursor-pointer"
                  >
                    插入编辑器
                  </button>
                </div>
                <CodeHighlightBlock
                  code={card.example}
                  language="sql"
                  title="执行示例"
                  maxHeight="200px"
                  onCopy={() => handleCopy(card)}
                />
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
          <div className="bg-monokai-bg border border-monokai-border rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
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
                    className="p-4 bg-monokai-sidebar border border-monokai-border rounded-lg hover:border-monokai-border-strong transition-colors cursor-pointer"
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

              <div className="mt-4 p-3 bg-monokai-amethyst/10 rounded-lg border border-monokai-border">
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
