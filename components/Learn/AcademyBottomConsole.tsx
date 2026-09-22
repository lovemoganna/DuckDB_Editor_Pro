/**
 * AcademyBottomConsole.tsx - 学堂轻量级可拖拽/折叠底部控制台
 * 
 * 设计规范：
 * 1. 类似 VS Code 终端 / Chrome DevTools，默认可按需展开与收起；
 * 2. 彻底消灭多 TAB 栏切换：单一视图内即包含 SQL 编辑区与结果数据表，直观呈现；
 * 3. 页面无右侧固定栏挤占，保持宽屏阅读，执行时自底部升起；
 * 4. 键盘支持 Ctrl+Enter 即时执行、Tab 智能两空格缩进；内置常用 DuckDB 语法速查抽屉。
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Play, Copy, Check, Download, 
  ChevronDown, Maximize2, Minimize2, Terminal, AlertCircle,
  Clock, Database, ArrowUpRight, Sparkles, X
} from 'lucide-react';
import { duckDBService } from '../../services/duckdbService';
import { toastService } from '../../services/toastService';

interface AcademyBottomConsoleProps {
  isOpen: boolean;
  onClose: () => void;
  sql: string;
  onSqlChange: (newSql: string) => void;
  courseTitle?: string;
  onOpenInGlobalSql?: (sql: string) => void;
}

const CHEAT_SHEET_ITEMS = [
  { label: 'QUALIFY排名', snippet: 'QUALIFY row_number() OVER (PARTITION BY category ORDER BY sales DESC) <= 3' },
  { label: 'FILTER聚合', snippet: 'COUNT(*) FILTER (WHERE status = \'Completed\')' },
  { label: 'ARG_MAX极值', snippet: 'arg_max(device_id, report_time)' },
  { label: '动态PIVOT', snippet: 'PIVOT source_table ON quarter USING SUM(amount)' },
  { label: 'JSON解构', snippet: 'payload->>\'$.customer.email\'' },
  { label: 'ASOF时序撮合', snippet: 'FROM trades ASOF JOIN quotes ON trades.sym = quotes.sym AND trades.time >= quotes.time' }
];

export const AcademyBottomConsole: React.FC<AcademyBottomConsoleProps> = ({
  isOpen,
  onClose,
  sql,
  onSqlChange,
  courseTitle = '学堂演练',
  onOpenInGlobalSql,
}) => {
  // 控制台高度调节（默认 320px）
  const [consoleHeight, setConsoleHeight] = useState<number>(320);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);
  const startYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(320);

  // 语法速查展开
  const [showCheatSheet, setShowCheatSheet] = useState(false);

  // 执行状态
  const [isRunning, setIsRunning] = useState(false);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);
  const [copied, setCopied] = useState(false);

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // 执行 SQL
  const handleExecute = useCallback(async (customSql?: string) => {
    const targetSql = (customSql !== undefined ? customSql : sql).trim();
    if (!targetSql) {
      toastService.warning('SQL 代码为空');
      return;
    }

    setIsRunning(true);
    setErrorMessage(null);
    const start = performance.now();

    try {
      const res = await duckDBService.executeAndAuditWithMetadata(
        targetSql,
        'SELECT',
        'academy_console',
        courseTitle
      );

      const elapsed = Math.round(performance.now() - start);
      setExecutionTime(elapsed);

      if (res.error) {
        setErrorMessage(res.error);
        setColumns([]);
        setRows([]);
      } else {
        const rowList = res.rows || [];
        setRows(rowList);
        if (res.columns && res.columns.length > 0) {
          setColumns(res.columns);
        } else if (rowList.length > 0) {
          setColumns(Object.keys(rowList[0]));
        } else {
          setColumns([]);
        }
      }
      setHasRun(true);
      setCurrentPage(1);
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - start);
      setExecutionTime(elapsed);
      setErrorMessage(err?.message || String(err));
      setColumns([]);
      setRows([]);
      setHasRun(true);
    } finally {
      setIsRunning(false);
    }
  }, [sql, courseTitle]);

  // 当外部传入新 SQL 且 isOpen 变为 true 时自动触发执行
  const lastExecutedSqlRef = useRef<string>('');
  useEffect(() => {
    if (isOpen && sql.trim() && sql !== lastExecutedSqlRef.current) {
      lastExecutedSqlRef.current = sql;
      handleExecute(sql);
    }
  }, [isOpen, sql, handleExecute]);

  // 快捷键支持
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleExecute();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;
      const newVal = val.substring(0, start) + '  ' + val.substring(end);
      onSqlChange(newVal);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  // 拖拽逻辑
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = consoleHeight;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current) return;
    const deltaY = startYRef.current - e.clientY;
    const newH = Math.min(Math.max(180, startHeightRef.current + deltaY), window.innerHeight * 0.85);
    setConsoleHeight(newH);
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  // 导出 CSV
  const handleDownloadCsv = () => {
    if (rows.length === 0) return;
    const header = columns.join(',');
    const body = rows.map(r => columns.map(c => JSON.stringify(r[c] ?? '')).join(',')).join('\n');
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `duckdb_result_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toastService.success('CSV 文件已导出');
  };

  // 复制 SQL
  const handleCopySql = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    toastService.success('SQL 已复制');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  const currentHeight = isMaximized ? '85vh' : `${consoleHeight}px`;
  const totalPages = Math.ceil(rows.length / pageSize) || 1;
  const paginatedRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <section 
      aria-label="DuckDB 运行控制台"
      style={{ height: currentHeight }}
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#0c1015] border-t border-zinc-800 flex flex-col shadow-2xl transition-all duration-75"
    >
      {/* 1. 拖拽把手 (Drag Handle) */}
      <div 
        onMouseDown={handleMouseDown}
        className="h-1.5 w-full bg-zinc-900 hover:bg-cyan-500/50 transition-colors cursor-row-resize flex items-center justify-center group shrink-0"
        title="上下拖动调节高度"
      >
        <div className="w-12 h-1 rounded-full bg-zinc-700 group-hover:bg-cyan-400 transition-colors" />
      </div>

      {/* 2. 控制台工具栏 (Console Header) */}
      <div className="h-9 px-4 bg-[#12171f] border-b border-zinc-800 flex items-center justify-between text-xs shrink-0 select-none">
        
        {/* 左侧：标题与执行状态 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-zinc-300 font-semibold">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>SQL 交互试炼场</span>
          </div>

          <span className="text-zinc-700">|</span>

          {isRunning ? (
            <span className="flex items-center gap-1.5 text-cyan-400 font-mono text-[11px] animate-pulse">
              <Clock className="w-3.5 h-3.5" />
              <span>计算中...</span>
            </span>
          ) : errorMessage ? (
            <span className="flex items-center gap-1.5 text-rose-400 font-mono text-[11px]">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>执行异常</span>
            </span>
          ) : hasRun ? (
            <div className="flex items-center gap-2 text-zinc-400 font-mono text-[11px]">
              <span className="text-emerald-400 font-semibold">{rows.length} 行</span>
              <span>·</span>
              <span>{columns.length} 列</span>
              <span>·</span>
              <span>{executionTime ?? 0} ms</span>
            </div>
          ) : (
            <span className="text-zinc-500 text-[11px]">准备就绪</span>
          )}
        </div>

        {/* 右侧：动作按钮 */}
        <div className="flex items-center gap-2">
          {/* 语法速查 */}
          <button
            type="button"
            onClick={() => setShowCheatSheet(!showCheatSheet)}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer ${
              showCheatSheet ? 'bg-cyan-500 text-black font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title="DuckDB 常用语法速查"
          >
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>语法速查</span>
          </button>

          {/* 复制 SQL */}
          <button
            type="button"
            onClick={handleCopySql}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title="复制当前 SQL"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* 导出 CSV */}
          {rows.length > 0 && (
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              title="导出 CSV"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}

          {/* 核心运行按钮 */}
          <button
            type="button"
            onClick={() => handleExecute()}
            disabled={isRunning}
            className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm ${
              isRunning
                ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                : 'bg-emerald-400 hover:bg-emerald-300 text-black active:scale-95'
            }`}
          >
            <Play className={`w-3.5 h-3.5 fill-current ${isRunning ? 'animate-spin' : ''}`} />
            <span>运行 (Ctrl+↵)</span>
          </button>

          <span className="text-zinc-700">|</span>

          {/* 最大化 / 还原 */}
          <button
            type="button"
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title={isMaximized ? '还原高度' : '最大化'}
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* 收起控制台 */}
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title="收起控制台"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 语法速查抽屉 */}
      {showCheatSheet && (
        <div className="bg-[#0f141b] border-b border-zinc-800 p-2.5 space-y-1.5 z-10 shrink-0 select-none">
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <span>点击一键追加常用 DuckDB 分析语法：</span>
            <button 
              type="button"
              onClick={() => setShowCheatSheet(false)}
              className="hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {CHEAT_SHEET_ITEMS.map(item => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  const updated = sql ? `${sql}\n\n-- ${item.label}\n${item.snippet}` : item.snippet;
                  onSqlChange(updated);
                  toastService.info(`已追加：${item.label}`);
                }}
                className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-left transition-colors cursor-pointer text-xs flex items-center gap-1.5"
              >
                <span className="font-bold text-cyan-400">{item.label}</span>
                <span className="text-[10px] text-zinc-500 font-mono truncate max-w-xs">{item.snippet}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. 主体工作区：左侧 SQL 编辑器 + 右侧结果表（无任何多余 TAB） */}
      <div className="flex-1 flex min-h-0 divide-x divide-zinc-800">
        
        {/* 左侧：可直接编辑与调整的 SQL 输入区 (40% 宽度) */}
        <div className="w-[38%] min-w-[280px] max-w-[500px] flex flex-col bg-[#0c1015] p-2.5 relative">
          <textarea
            value={sql}
            onChange={(e) => onSqlChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="在此键入 DuckDB SQL 代码... (Ctrl+Enter 执行)"
            className="w-full h-full bg-transparent text-xs font-mono text-zinc-200 placeholder-zinc-600 resize-none outline-none border-0 selection:bg-cyan-500/30 leading-relaxed custom-scrollbar"
            spellCheck={false}
          />
          <div className="absolute bottom-2 right-3 text-[10px] text-zinc-600 font-mono pointer-events-none">
            Ctrl+↵ 执行 · Tab 缩进
          </div>
        </div>

        {/* 右侧：纯粹的结果数据表格与错误呈现 (62% 宽度) */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0a0e14] overflow-hidden">
          {isRunning ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-zinc-500 text-xs">
              <Clock className="w-5 h-5 text-cyan-400 animate-spin" />
              <span>DuckDB WASM 正在向量化执行...</span>
            </div>
          ) : errorMessage ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="p-3 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 mb-3">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-rose-300 mb-1">执行未通过</h4>
              <p className="text-xs font-mono text-rose-400 max-w-xl bg-rose-950/30 p-3 rounded border border-rose-900/50 break-all text-left">
                {errorMessage}
              </p>
            </div>
          ) : !hasRun ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-zinc-600 text-xs select-none">
              <Database className="w-6 h-6 text-zinc-700" />
              <span>点击正文代码块的「运行」或上方按钮执行查询</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 text-xs">
              <span>查询成功执行，但未返回任何数据行 (0 rows)</span>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              {/* 表格容器 */}
              <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-left border-collapse font-mono text-[11px]">
                  <thead className="bg-[#12171f] sticky top-0 z-10 text-zinc-400 border-b border-zinc-800 select-none">
                    <tr>
                      <th className="py-2 px-3 font-semibold text-zinc-600 w-10 text-right">#</th>
                      {columns.map(col => (
                        <th key={col} className="py-2 px-3 font-semibold text-zinc-300 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                    {paginatedRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="py-1.5 px-3 text-right text-zinc-600 text-[10px]">
                          {(currentPage - 1) * pageSize + rIdx + 1}
                        </td>
                        {columns.map(col => {
                          const val = row[col];
                          const isNull = val === null || val === undefined;
                          const isNum = typeof val === 'number';
                          return (
                            <td 
                              key={col} 
                              className={`py-1.5 px-3 truncate max-w-xs ${
                                isNull ? 'text-zinc-600 italic' : isNum ? 'text-cyan-300' : 'text-zinc-300'
                              }`}
                              title={String(val)}
                            >
                              {isNull ? 'NULL' : String(val)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 表格底部分页条 */}
              {totalPages > 1 && (
                <div className="h-8 px-3 bg-[#12171f] border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400 shrink-0 select-none">
                  <span>共 {rows.length} 行数据，当前第 {currentPage}/{totalPages} 页</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-300 transition-colors cursor-pointer"
                    >
                      上一页
                    </button>
                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-300 transition-colors cursor-pointer"
                    >
                      下一页
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </section>
  );
};

export default AcademyBottomConsole;
