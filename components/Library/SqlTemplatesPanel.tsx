/**
 * SqlTemplatesPanel - SQL 模板面板
 *
 * 显示系统预置和用户自定义的 SQL 查询模板
 * 优化：AI 一键填充、快速清除、背景说明
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Copy,
  Check,
  ExternalLink,
  Plus,
  Trash2,
  FileCode,
  Tag,
  Sparkles,
  Play,
  ChevronDown,
  Filter,
  RotateCcw,
  Loader2,
  Lightbulb
} from 'lucide-react';
import { SqlTemplate, TemplateCategory } from '../../types';
import { SqlCodeBlock } from './SqlCodeBlock';

interface SqlTemplatesPanelProps {
  templates: SqlTemplate[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  onCopy: (id: string, content: string) => void;
  onInsert: (sql: string) => void;
  onAdd: (template: Omit<SqlTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => void;
  onDelete: (id: string) => void;
  copiedId: string | null;
}

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  'user-segmentation': '用户分层',
  'multi-table-join': '多表关联',
  'time-series': '时间序列',
  'aggregation': '聚合分析',
  'data-cleaning': '数据清洗',
  'window-function': '窗口函数',
  'custom': '自定义'
};

// AI 填充模板数据
const AI_TEMPLATE_SUGGESTIONS: Record<TemplateCategory, { name: string; description: string; sql: string; tags: string }> = {
  'user-segmentation': {
    name: '用户分层查询',
    description: '基于 RFM 模型的用户分层',
    sql: `-- 用户 RFM 分层
WITH rfm AS (
  SELECT 
    user_id,
    MAX(order_date) AS recency,
    COUNT(*) AS frequency,
    SUM(amount) AS monetary
  FROM orders
  WHERE order_date >= CURRENT_DATE - INTERVAL '90 days'
  GROUP BY user_id
)
SELECT 
  user_id,
  CASE 
    WHEN recency >= CURRENT_DATE - INTERVAL '7 days' AND frequency >= 5 THEN '高价值用户'
    WHEN recency >= CURRENT_DATE - INTERVAL '30 days' AND frequency >= 3 THEN '潜力用户'
    WHEN recency >= CURRENT_DATE - INTERVAL '60 days' THEN '沉默用户'
    ELSE '流失风险'
  END AS user_segment
FROM rfm;`,
    tags: 'RFM,用户分层,分析'
  },
  'multi-table-join': {
    name: '多表关联查询',
    description: '用户与订单的关联分析',
    sql: `-- 用户订单关联分析
SELECT 
  u.user_id,
  u.username,
  u.email,
  COUNT(o.order_id) AS order_count,
  COALESCE(SUM(o.amount), 0) AS total_amount,
  MAX(o.order_date) AS last_order_date
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id
WHERE o.order_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY u.user_id, u.username, u.email
ORDER BY total_amount DESC
LIMIT 100;`,
    tags: 'JOIN,多表,关联'
  },
  'time-series': {
    name: '时间序列分析',
    description: '按日期统计关键指标',
    sql: `-- 时间序列趋势分析
SELECT 
  DATE_TRUNC('day', order_date) AS date,
  COUNT(*) AS order_count,
  SUM(amount) AS total_amount,
  AVG(amount) AS avg_amount,
  COUNT(DISTINCT user_id) AS unique_users
FROM orders
WHERE order_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', order_date)
ORDER BY date DESC;`,
    tags: '时间序列,趋势,聚合'
  },
  'aggregation': {
    name: '聚合统计查询',
    description: '多维度聚合分析',
    sql: `-- 多维度聚合统计
SELECT 
  category,
  DATE_TRUNC('month', order_date) AS month,
  COUNT(*) AS order_count,
  SUM(amount) AS total_amount,
  AVG(amount) AS avg_amount,
  MAX(amount) AS max_amount,
  MIN(amount) AS min_amount
FROM orders
WHERE order_date >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY category, DATE_TRUNC('month', order_date)
HAVING SUM(amount) > 10000
ORDER BY month DESC, total_amount DESC;`,
    tags: '聚合,HAVING,统计'
  },
  'window-function': {
    name: '窗口函数分析',
    description: '排名与累计统计',
    sql: `-- 窗口函数排名分析
SELECT 
  user_id,
  username,
  total_amount,
  RANK() OVER (ORDER BY total_amount DESC) AS rank,
  PERCENT_RANK() OVER (ORDER BY total_amount DESC) AS pct_rank,
  SUM(total_amount) OVER (ORDER BY total_amount DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cumulative_amount,
  AVG(total_amount) OVER (ORDER BY total_amount DESC ROWS BETWEEN 2 PRECEDING AND 2 FOLLOWING) AS moving_avg
FROM (
  SELECT 
    u.user_id,
    u.username,
    COALESCE(SUM(o.amount), 0) AS total_amount
  FROM users u
  LEFT JOIN orders o ON u.user_id = o.user_id
  GROUP BY u.user_id, u.username
) user_orders
ORDER BY rank;`,
    tags: '窗口函数,RANK,累计'
  },
  'data-cleaning': {
    name: '数据清洗模板',
    description: '常见数据清洗操作',
    sql: `-- 数据清洗示例
SELECT 
  -- 去除空格
  TRIM(username) AS username,
  -- 统一大小写
  LOWER(email) AS email,
  -- 处理空值
  COALESCE(phone, '未知') AS phone,
  -- 类型转换
  CAST(price AS DECIMAL(10,2)) AS price,
  -- 日期格式化
  TO_CHAR(order_date, 'YYYY-MM-DD') AS order_date,
  -- 条件判断
  CASE 
    WHEN amount < 0 THEN 0 
    ELSE amount 
  END AS clean_amount
FROM raw_data
WHERE -- 去重
  (id, order_date) IN (
    SELECT id, MAX(order_date)
    FROM raw_data
    GROUP BY id
  );`,
    tags: '清洗,TRIM,COALESCE'
  },
  'custom': {
    name: '',
    description: '',
    sql: '',
    tags: ''
  }
};

export const SqlTemplatesPanel: React.FC<SqlTemplatesPanelProps> = ({
  templates,
  selectedCategory,
  onCategoryChange,
  onCopy,
  onInsert,
  onAdd,
  onDelete,
  copiedId
}) => {
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    sql: '',
    category: 'custom' as TemplateCategory,
    tags: ''
  });
  const [isAIFilling, setIsAIFilling] = useState(false);

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

  const handleCopy = useCallback((template: SqlTemplate) => {
    onCopy(template.id, template.sql);
  }, [onCopy]);

  const handleInsert = useCallback((sql: string) => {
    onInsert(sql);
  }, [onInsert]);

  const handleAdd = useCallback(() => {
    if (!newTemplate.name || !newTemplate.sql) return;
    onAdd({
      name: newTemplate.name,
      description: newTemplate.description,
      sql: newTemplate.sql,
      category: newTemplate.category,
      tags: newTemplate.tags.split(',').map(t => t.trim()).filter(Boolean)
    });
    setNewTemplate({ name: '', description: '', sql: '', category: 'custom', tags: '' });
    setShowAddForm(false);
  }, [newTemplate, onAdd]);

  // 快速清除
  const handleQuickClear = useCallback(() => {
    onCategoryChange('all');
    setNewTemplate({ name: '', description: '', sql: '', category: 'custom', tags: '' });
    setShowAddForm(false);
  }, [onCategoryChange]);

  // AI 一键填充（根据选中分类智能生成模板）
  const handleAIFill = useCallback(() => {
    setIsAIFilling(true);

    // 模拟 AI 生成延迟
    setTimeout(() => {
      const template = AI_TEMPLATE_SUGGESTIONS[newTemplate.category] || AI_TEMPLATE_SUGGESTIONS['custom'];
      if (template.name) {
        setNewTemplate(prev => ({
          ...prev,
          name: template.name,
          description: template.description,
          sql: template.sql,
          tags: template.tags
        }));
      }
      setIsAIFilling(false);
    }, 600);
  }, [newTemplate.category]);

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* 分类筛选 */}
      <div className="mb-4 flex items-center gap-2">
        <div className="flex items-center gap-1 text-sm text-monokai-comment">
          <Filter className="w-4 h-4" />
          <span>分类：</span>
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="px-3 py-1.5 bg-monokai-bg border border-monokai-accent rounded text-sm text-monokai-fg focus:outline-none focus:border-monokai-green"
        >
          <option value="all">全部</option>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
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
          共 {templates.length} 个模板
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
          className="flex items-center gap-1 px-3 py-1.5 bg-monokai-green/20 text-monokai-green rounded-lg text-sm hover:bg-monokai-green/30 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>添加模板</span>
        </button>
      </div>

      {/* 添加表单 */}
      {showAddForm && (
        <div className="mb-4 p-4 bg-monokai-sidebar border border-monokai-accent rounded-lg">
          <h4 className="text-sm font-medium text-monokai-fg mb-3">添加新 SQL 模板</h4>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="模板名称"
              value={newTemplate.name}
              onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 bg-monokai-bg border border-monokai-accent rounded text-sm text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-green"
            />
            <input
              type="text"
              placeholder="描述"
              value={newTemplate.description}
              onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 bg-monokai-bg border border-monokai-accent rounded text-sm text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-green"
            />
            <textarea
              placeholder="SQL 语句"
              value={newTemplate.sql}
              onChange={(e) => setNewTemplate(prev => ({ ...prev, sql: e.target.value }))}
              rows={5}
              className="w-full px-3 py-2 bg-monokai-bg border border-monokai-accent rounded text-sm text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-green font-mono resize-none"
            />
            <select
              value={newTemplate.category}
              onChange={(e) => setNewTemplate(prev => ({ ...prev, category: e.target.value as TemplateCategory }))}
              className="w-full px-3 py-2 bg-monokai-bg border border-monokai-accent rounded text-sm text-monokai-fg focus:outline-none focus:border-monokai-green"
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="标签，逗号分隔"
              value={newTemplate.tags}
              onChange={(e) => setNewTemplate(prev => ({ ...prev, tags: e.target.value }))}
              className="w-full px-3 py-2 bg-monokai-bg border border-monokai-accent rounded text-sm text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-green"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                className="flex-1 px-3 py-2 bg-monokai-green text-white rounded text-sm hover:bg-monokai-green/80 transition-colors"
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

      {/* 模板列表 */}
      <div className="grid gap-3">
        {templates.map(template => (
          <div
            key={template.id}
            className="p-4 bg-monokai-sidebar border border-monokai-accent rounded-lg hover:border-monokai-green/50 transition-colors"
          >
            {/* 模板头部 */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <FileCode className="w-4 h-4 text-monokai-green" />
                  <h4 className="text-sm font-medium text-monokai-fg">{template.name}</h4>
                  <span className="px-1.5 py-0.5 text-xs bg-monokai-green/20 text-monokai-green rounded">
                    {CATEGORY_LABELS[template.category]}
                  </span>
                  {template.isSystem && (
                    <span className="px-1.5 py-0.5 text-xs bg-monokai-blue/20 text-monokai-blue rounded">
                      预置
                    </span>
                  )}
                </div>
                <p className="text-xs text-monokai-comment">{template.description}</p>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={() => handleCopy(template)}
                  className="p-1.5 rounded hover:bg-monokai-accent/20 text-monokai-comment hover:text-monokai-fg transition-colors"
                  title="复制 SQL"
                >
                  {copiedId === template.id ? <Check className="w-4 h-4 text-monokai-green" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setExpandedTemplate(expandedTemplate === template.id ? null : template.id)}
                  className="p-1.5 rounded hover:bg-monokai-accent/20 text-monokai-comment hover:text-monokai-fg transition-colors"
                  title="查看详情"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
                {!template.isSystem && (
                  <button
                    onClick={() => onDelete(template.id)}
                    className="p-1.5 rounded hover:bg-monokai-red/20 text-monokai-comment hover:text-monokai-red transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* 标签和使用次数 */}
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-1">
                {template.tags.map((tag, idx) => (
                  <span key={idx} className="px-1.5 py-0.5 text-xs bg-monokai-accent/20 text-monokai-comment rounded">
                    {tag}
                  </span>
                ))}
              </div>
              <span className="text-xs text-monokai-comment">
                已使用 {template.usageCount} 次
              </span>
            </div>

            {/* 展开的 SQL */}
            {expandedTemplate === template.id && (
              <div className="mt-3 p-3 bg-monokai-bg border border-monokai-accent rounded">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-monokai-fg">SQL 语句</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleInsert(template.sql)}
                      className="text-xs text-monokai-green hover:underline flex items-center gap-1"
                    >
                      <Play className="w-3 h-3" />
                      插入编辑器
                    </button>
                    <button
                      onClick={() => handleCopy(template)}
                      className="text-xs text-monokai-comment hover:text-monokai-fg"
                    >
                      复制
                    </button>
                  </div>
                </div>
                <SqlCodeBlock code={template.sql} maxHeight="240px" />
              </div>
            )}
          </div>
        ))}

        {templates.length === 0 && (
          <div className="text-center py-12">
            <FileCode className="w-12 h-12 text-monokai-comment mx-auto mb-3" />
            <p className="text-sm text-monokai-comment">暂无 SQL 模板</p>
            <p className="text-xs text-monokai-comment mt-1">点击上方"添加模板"或"AI 填充"创建</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SqlTemplatesPanel;
