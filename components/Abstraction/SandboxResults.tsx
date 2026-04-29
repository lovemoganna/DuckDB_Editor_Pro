/**
 * SandboxResults — 实验台结果预览
 *
 * 改进：
 * - 统一配色使用 monokai-border
 * - 表头样式更醒目
 * - 空状态和加载状态视觉更友好
 */

import React from 'react';
import { Table, AlertCircle, Loader2, Database } from 'lucide-react';
import { useAbstractionSandbox } from '../../hooks/useAbstractionSandbox';

export const SandboxResults: React.FC = () => {
  const { sandboxResult, sandboxError, isExecuting } = useAbstractionSandbox();

  if (sandboxError) {
    return (
      <div className="h-full flex items-center justify-center bg-monokai-bg">
        <div className="text-center max-w-md px-6">
          <div className="w-14 h-14 rounded-2xl bg-monokai-pink/10 border border-monokai-pink/30 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-monokai-pink" />
          </div>
          <h3 className="text-sm font-semibold text-monokai-pink mb-2">执行失败</h3>
          <p className="text-xs text-monokai-fg-muted leading-relaxed">{sandboxError}</p>
        </div>
      </div>
    );
  }

  if (isExecuting) {
    return (
      <div className="h-full flex items-center justify-center bg-monokai-bg">
        <div className="text-center">
          <Loader2 className="w-8 h-8 mx-auto mb-3 text-monokai-purple animate-spin" />
          <p className="text-sm text-monokai-fg-muted">执行中...</p>
        </div>
      </div>
    );
  }

  if (!sandboxResult) {
    return (
      <div className="h-full flex items-center justify-center bg-monokai-bg">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-monokai-surface border border-monokai-border flex items-center justify-center mx-auto mb-4">
            <Table className="w-7 h-7 text-monokai-fg-muted/40" />
          </div>
          <p className="text-sm text-monokai-fg-muted mb-1">暂无执行结果</p>
          <p className="text-xs text-monokai-fg-muted/60">在编辑器输入 SQL 后按 Ctrl+Enter 执行</p>
        </div>
      </div>
    );
  }

  const resultData = sandboxResult as Record<string, unknown>;

  if (resultData.columns && resultData.rows) {
    const columns = resultData.columns as string[];
    const rows = resultData.rows as unknown[];
    return (
      <div className="h-full flex flex-col bg-monokai-bg">
        <div className="flex items-center justify-between px-4 py-2 bg-monokai-surface border-b border-monokai-border">
          <div className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-monokai-fg-muted" />
            <span className="text-xs font-medium text-monokai-fg">
              {rows.length} 行 × {columns.length} 列
            </span>
          </div>
          {resultData.executionTime && (
            <span className="text-[10px] text-monokai-fg-muted">
              执行 {String(resultData.executionTime)}ms
            </span>
          )}
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs font-sans">
            <thead className="sticky top-0 bg-monokai-surface">
              <tr>
                {columns.map((col, idx) => (
                  <th
                    key={idx}
                    className="px-4 py-2.5 text-left text-xs font-semibold text-monokai-purple bg-monokai-surface border-b border-monokai-border"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => {
                const cells = row as unknown[];
                return (
                  <tr
                    key={rowIdx}
                    className="hover:bg-monokai-surface/50 border-b border-monokai-border/50 transition-colors"
                  >
                    {cells.map((cell, cellIdx) => (
                      <td key={cellIdx} className="px-4 py-2 text-monokai-fg">
                        {cell === null ? (
                          <span className="text-monokai-fg-muted/50 italic">NULL</span>
                        ) : typeof cell === 'object' ? (
                          JSON.stringify(cell)
                        ) : (
                          String(cell)
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-monokai-bg">
      <div className="flex items-center justify-between px-4 py-2 bg-monokai-surface border-b border-monokai-border">
        <span className="text-xs text-monokai-fg-muted">执行结果</span>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <pre className="text-xs text-monokai-fg-muted font-mono whitespace-pre-wrap leading-relaxed">
          {JSON.stringify(resultData, null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default SandboxResults;
