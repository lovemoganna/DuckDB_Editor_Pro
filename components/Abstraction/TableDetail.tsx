/**
 * TableDetail — 抽象表详情面板
 *
 * 改进：
 * - 统一配色：border-monokai-border，bg-monokai-surface
 * - 信息分区清晰（基本信息 / SQL / 参数）
 * - SQL 区域使用 monospace 字体突出
 * - 快捷操作按钮组
 */

import React from 'react';
import { Copy, ArrowRight, Star, Trash2, Edit3, Database, Layers, Tag } from 'lucide-react';
import { useAnalysisHubStore, useSelectedTable } from '../../hooks/store/analysisHubStore';
import { OPERATION_CONFIG } from '../../types/abstraction';
import { AbstractionPathTag } from './AbstractionPathTag';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

// 静态颜色映射
const OPERATION_TAG_CLASSES: Record<string, string> = {
  SELECT:    'bg-monokai-blue/15 text-monokai-blue border-monokai-blue/30',
  INSERT:    'bg-monokai-green/15 text-monokai-green border-monokai-green/30',
  UPDATE:    'bg-monokai-yellow/15 text-monokai-yellow border-monokai-yellow/30',
  DELETE:    'bg-monokai-red/15 text-monokai-red border-monokai-red/30',
  AGGREGATE: 'bg-monokai-amethyst/15 text-monokai-amethyst border-monokai-amethyst/30',
  JOIN:      'bg-monokai-pink/15 text-monokai-pink border-monokai-pink/30',
  WINDOW:    'bg-monokai-orange/15 text-monokai-orange border-monokai-orange/30',
  CTE:       'bg-monokai-cyan/15 text-monokai-cyan border-monokai-cyan/30',
};

// 判断是否为 Markdown 表格（有表头分隔行 |---|）
function isMarkdownTable(content: string): boolean {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return false;
  return lines[1].includes('---') || lines[1].includes('|---|');
}

// 检测数值单元格
function isNumeric(val: string) {
  return /^-?\d+(\.\d+)?$/.test(val.trim());
}

// 渲染 pipe 分隔纯文本表格
function renderPipeTable(content: string) {
  const rows = content.trim().split('\n').map(l =>
    l.split('|').map(c => c.trim()).filter(Boolean)
  );
  if (rows.length === 0) return null;
  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="bg-monokai-amethyst/10 text-monokai-amethyst">
          {rows[0].map((cell, i) => (
            <th key={i} className="px-3 py-1.5 text-left font-semibold border-b border-monokai-border text-[11px]">
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.slice(1).map((row, ri) => (
          <tr key={ri} className="hover:bg-monokai-surface transition-colors">
            {row.map((cell, ci) => (
              <td key={ci} className="px-3 py-1.5 border-b border-monokai-border/50 text-monokai-fg-muted font-mono">
                {isNumeric(cell) ? (
                  <span className="text-monokai-orange">{cell}</span>
                ) : cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// 渲染 Markdown 表格
function renderMarkdownTable(content: string) {
  const lines = content.trim().split('\n');
  const rows = lines.map(l =>
    l.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim())
  );
  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="bg-monokai-amethyst/10 text-monokai-amethyst">
          {rows[0].map((cell, i) => (
            <th key={i} className="px-3 py-1.5 text-left font-semibold border-b border-monokai-border text-[11px]">
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.slice(2).map((row, ri) => (
          <tr key={ri} className="hover:bg-monokai-surface transition-colors">
            {row.map((cell, ci) => (
              <td key={ci} className="px-3 py-1.5 border-b border-monokai-border/50 text-monokai-fg-muted font-mono">
                {isNumeric(cell) ? (
                  <span className="text-monokai-orange">{cell}</span>
                ) : cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TableRenderer({ content }: { content: string }) {
  if (!content.trim()) return null;
  if (isMarkdownTable(content)) {
    return renderMarkdownTable(content);
  }
  return renderPipeTable(content);
}

interface TableDetailProps {
  onInsert?: (sql: string) => void;
}

export const TableDetail: React.FC<TableDetailProps> = ({ onInsert }) => {
  const table = useSelectedTable();
  const copiedId = useAnalysisHubStore(s => s.copiedId);
  const setCopiedId = useAnalysisHubStore(s => s.setCopiedId);
  const toggleFavorite = useAnalysisHubStore(s => s.toggleFavorite);
  const openEditForm = useAnalysisHubStore(s => s.openEditForm);
  const removeTable = useAnalysisHubStore(s => s.removeTable);

  if (!table) {
    return (
      <div className="flex items-center justify-center h-full bg-monokai-bg">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-monokai-surface border border-monokai-border flex items-center justify-center mx-auto mb-4">
            <Layers className="w-7 h-7 text-monokai-fg-muted/40" />
          </div>
          <p className="text-sm font-medium text-monokai-fg-muted mb-1">选择模板查看详情</p>
          <p className="text-xs text-monokai-fg-muted/60">从左侧列表选择，或使用 AI 生成</p>
        </div>
      </div>
    );
  }

  const OpConfig = OPERATION_CONFIG[table.sqlConfig.operation];
  const opTagClass = OPERATION_TAG_CLASSES[table.sqlConfig.operation] || 'bg-monokai-fg/15 text-monokai-fg border-monokai-fg/30';
  const isCopied = copiedId === table.id;

  const handleCopy = () => {
    navigator.clipboard.writeText(table.sqlConfig.template);
    setCopiedId(table.id);
  };

  return (
    <div className="h-full overflow-y-auto bg-monokai-bg">
      <div className="p-6 space-y-6">
        {/* 头部：名称 + 操作类型 + 操作按钮 */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold text-monokai-fg leading-tight">{table.name}</h2>
              {table.isFavorite && (
                <Star className="w-4 h-4 text-monokai-yellow fill-monokai-yellow flex-shrink-0" />
              )}
              {table.isSystem && (
                <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-monokai-green/15 text-monokai-green border border-monokai-green/30">
                  系统
                </span>
              )}
            </div>
            <p className="text-sm text-monokai-fg-muted">{table.description}</p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => toggleFavorite(table.id)}
              className="p-2 rounded-lg bg-monokai-surface border border-monokai-border text-monokai-fg-muted hover:text-monokai-yellow hover:border-monokai-yellow/40 transition-all"
              title={table.isFavorite ? '取消收藏' : '添加收藏'}
            >
              <Star className={`w-4 h-4 ${table.isFavorite ? 'fill-monokai-yellow text-monokai-yellow' : 'text-monokai-fg-muted'}`} />
            </button>
            <button
              onClick={() => onInsert && onInsert(table.sqlConfig.template)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-monokai-amethyst/20 to-monokai-blue/20 text-monokai-amethyst border border-monokai-amethyst/30 hover:from-monokai-amethyst/30 hover:to-monokai-blue/30 transition-all"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              插入
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-monokai-surface border border-monokai-border text-monokai-fg-muted hover:text-monokai-fg hover:border-monokai-fg-muted transition-all"
            >
              {isCopied ? (
                <>
                  <Copy className="w-3.5 h-3.5 text-monokai-green" />
                  <span className="text-monokai-green">已复制</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  复制
                </>
              )}
            </button>
          </div>
        </div>

        {/* 抽象层级路径 */}
        <div className="bg-monokai-surface border border-monokai-border rounded-xl p-4">
          <h3 className="text-xs font-semibold text-monokai-fg-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            抽象路径
          </h3>
          <AbstractionPathTag path={table.abstractionPath} size="md" />
        </div>

        {/* SQL 模板 */}
        <div className="bg-monokai-surface border border-monokai-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-monokai-border">
            <div className="flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-monokai-fg-muted" />
              <h3 className="text-xs font-semibold text-monokai-fg-muted uppercase tracking-wider">SQL 模板</h3>
              <span className={`px-2 py-0.5 text-[10px] font-semibold rounded border ${opTagClass}`}>
                {OpConfig.label}
              </span>
            </div>
          </div>
          <div className="px-4 py-3">
            <SyntaxHighlighter
              language="sql"
              style={oneDark}
              customStyle={{
                background: 'transparent',
                padding: 0,
                margin: 0,
                fontSize: '12px',
                lineHeight: '1.6',
              }}
              wrapLongLines
            >
              {table.sqlConfig.template}
            </SyntaxHighlighter>
          </div>
        </div>

        {/* 参数定义 */}
        <div className="bg-monokai-surface border border-monokai-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-monokai-fg-muted uppercase tracking-wider">参数定义</h3>
            {(!table.sqlConfig.parameters || table.sqlConfig.parameters.length === 0) && (
              <span className="text-[10px] text-monokai-fg-muted/50">无占位符</span>
            )}
          </div>

          {(!table.sqlConfig.parameters || table.sqlConfig.parameters.length === 0) ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-monokai-bg rounded-lg border border-dashed border-monokai-border">
              <span className="text-xs text-monokai-fg-muted/50">
                使用 {"{{参数名}}"} 或 {"${参数名}"} 格式在 SQL 模板中定义占位符
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              {table.sqlConfig.parameters.map((param, idx) => (
                <div key={idx} className="flex items-start gap-3 px-3 py-2.5 bg-monokai-bg rounded-lg border border-monokai-border">
                  <div className="flex items-center gap-2 min-w-[100px] flex-shrink-0">
                    <code className="text-xs font-mono text-monokai-amethyst">{param.name}</code>
                    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border flex-shrink-0 ${
                      param.type === 'table' ? 'bg-monokai-blue/15 text-monokai-blue border-monokai-blue/30' :
                      param.type === 'column' ? 'bg-monokai-green/15 text-monokai-green border-monokai-green/30' :
                      param.type === 'number' ? 'bg-monokai-orange/15 text-monokai-orange border-monokai-orange/30' :
                      param.type === 'date' ? 'bg-monokai-amethyst/15 text-monokai-amethyst border-monokai-amethyst/30' :
                      'bg-monokai-fg/10 text-monokai-fg border-monokai-fg/20'
                    }`}>
                      {param.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {param.description && (
                      <span className="text-xs text-monokai-fg-muted flex-1">{param.description}</span>
                    )}
                    {param.required && (
                      <span className="text-[10px] text-monokai-red bg-monokai-red/10 px-1.5 py-0.5 rounded border border-monokai-red/20 flex-shrink-0">
                        必填
                      </span>
                    )}
                    {param.defaultValue && (
                      <span className="text-[10px] text-monokai-green bg-monokai-green/10 px-1.5 py-0.5 rounded border border-monokai-green/20 flex-shrink-0">
                        默认: {param.defaultValue}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 示例输出 */}
        {table.sqlConfig.sampleOutput && (
          <div className="bg-monokai-surface border border-monokai-border rounded-xl p-4">
            <h3 className="text-xs font-semibold text-monokai-fg-muted uppercase tracking-wider mb-3">示例输出</h3>
            <div className="bg-monokai-bg px-3 py-2 rounded-lg border border-monokai-border overflow-x-auto">
              <TableRenderer content={table.sqlConfig.sampleOutput} />
            </div>
          </div>
        )}

        {/* 标签 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 flex-wrap flex-1">
            <Tag className="w-3.5 h-3.5 text-monokai-fg-muted" />
            {table.tags.map((tag) => (
              <span key={tag} className="px-2 py-1 text-xs text-monokai-fg-muted bg-monokai-surface border border-monokai-border rounded-md">
                {tag}
              </span>
            ))}
            <span className="px-2 py-1 text-xs text-monokai-fg-muted/60 bg-monokai-surface border border-monokai-border rounded-md">
              {table.domain}
            </span>
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className="flex items-center gap-2 pt-4 border-t border-monokai-border">
          <button
            onClick={() => openEditForm(table)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-monokai-surface border border-monokai-border text-monokai-fg-muted hover:text-monokai-fg hover:border-monokai-fg-muted transition-all"
          >
            <Edit3 className="w-3.5 h-3.5" />
            编辑模板
          </button>
          {!table.isSystem && (
            <button
              onClick={() => removeTable(table.id)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-monokai-pink/10 border border-monokai-pink/30 text-monokai-pink hover:bg-monokai-pink/20 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              删除
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TableDetail;
