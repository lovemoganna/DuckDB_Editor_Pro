/**
 * AcademySqlRunner.tsx - 学堂沉浸式 SQL 交互试炼场
 * 
 * 职责：
 * 1. 动手实践阶段核心执行器：直连本地 DuckDB WASM 引擎；
 * 2. 演练与挑战模板切换：基础示例、分步步骤、动手挑战任务与生产视图沉淀模板；
 * 3. 增强型代码编辑：快捷键执行 (Ctrl+Enter)、代码重置、复制与收藏到片段库；
 * 4. 验证结果集成：4 合 1 结果看板（运行结果表格、挑战指标比对、输入表形态、智能排错建议）；
 * 5. 全局联动：支持直接推送至主工作区 SQL 工作台深度探索。
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Play, RotateCcw, Copy, Check, ExternalLink, 
  Terminal, Sparkles, Target, Bookmark, Layers
} from 'lucide-react';
import { duckDBService } from '../../services/duckdbService';
import { toastService } from '../../services/toastService';
import { AcademyResultVerification } from './AcademyResultVerification';
import { CourseStep, CourseChallenge } from './data/academyCurriculum';

interface AcademySqlRunnerProps {
  initialSql: string;
  courseTitle?: string;
  courseId?: string;
  steps?: CourseStep[];
  challenge?: CourseChallenge;
  productionTemplate?: {
    title: string;
    description: string;
    templateSql: string;
  };
  inputTables?: any[];
  onOpenInGlobalSql?: (sql: string) => void;
  onSaveSnippet?: (sql: string) => void;
}

export const AcademySqlRunner: React.FC<AcademySqlRunnerProps> = ({
  initialSql,
  courseTitle,
  courseId,
  steps,
  challenge,
  productionTemplate,
  inputTables,
  onOpenInGlobalSql,
  onSaveSnippet,
}) => {
  const [sql, setSql] = useState(initialSql);
  const [activeTab, setActiveTab] = useState<string>('base');
  const [isRunning, setIsRunning] = useState(false);
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);
  const [lastExecutedSql, setLastExecutedSql] = useState('');
  const [copied, setCopied] = useState(false);
  const [showCheatSheet, setShowCheatSheet] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const CHEAT_SHEET_ITEMS = [
    { label: '内存序列', snippet: 'SELECT range AS id FROM range(10);', desc: '生成 0-9 虚拟测试数据' },
    { label: 'QUALIFY排名', snippet: 'QUALIFY row_number() OVER (PARTITION BY dept ORDER BY score DESC) = 1', desc: '省去子查询直接窗口过滤' },
    { label: 'FILTER聚合', snippet: 'SUM(amount) FILTER (WHERE status = \'Completed\')', desc: '多状态同查性能提升3-5倍' },
    { label: '安全兜底', snippet: 'COALESCE(val, \'N/A\')', desc: '优雅处理 NULL 缺失值' },
    { label: '正则抽取', snippet: 'regexp_extract(text, \'(\\d+)\', 1)', desc: '从文本中提取模式数字' },
    { label: '动态透视', snippet: 'PIVOT df ON quarter USING SUM(sales);', desc: '长表极速转宽表' },
    { label: '结构解构', snippet: 'UNNEST([1, 2, 3]) AS val', desc: '列表展开为多行' },
  ];

  // 当外部初始 SQL 切换时自动同步
  useEffect(() => {
    setSql(initialSql);
    setActiveTab('base');
    setColumns([]);
    setRows([]);
    setErrorMessage(null);
    setExecutionTime(null);
    setHasRun(false);
    setLastExecutedSql('');
  }, [initialSql]);

  // 执行查询
  const handleExecute = useCallback(async (sqlToRun?: string) => {
    const targetSql = (sqlToRun ?? sql).trim();
    if (!targetSql) {
      toastService.warning('请输入需要执行的 SQL 语句');
      return;
    }

    setIsRunning(true);
    setErrorMessage(null);
    setLastExecutedSql(targetSql);
    const start = performance.now();

    try {
      // 执行 DuckDB 查询
      const res = await duckDBService.executeAndAuditWithMetadata(
        targetSql,
        'SELECT',
        'academy_trial_lab',
        courseTitle || '学堂试炼'
      );

      const elapsed = performance.now() - start;
      setExecutionTime(Math.round(elapsed));

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
    } catch (err: any) {
      const elapsed = performance.now() - start;
      setExecutionTime(Math.round(elapsed));
      setErrorMessage(err?.message || String(err));
      setColumns([]);
      setRows([]);
      setHasRun(true);
    } finally {
      setIsRunning(false);
    }
  }, [sql, courseTitle]);

  // 快捷键 Ctrl+Enter 执行 / Tab 缩进支持
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleExecute();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      setSql(newValue);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  // 重置为参考 SQL
  const handleReset = () => {
    setSql(initialSql);
    setActiveTab('base');
    toastService.info('已重置为初始参考 SQL');
  };

  // 复制当前 SQL
  const handleCopySql = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    toastService.success('SQL 代码已复制到剪贴板');
    setTimeout(() => setCopied(false), 2000);
  };

  // 导出结果为 CSV
  const handleExportCsv = () => {
    if (!rows || rows.length === 0 || columns.length === 0) return;
    const header = columns.join(',');
    const body = rows.map(r => columns.map(c => JSON.stringify(r[c] ?? '')).join(',')).join('\n');
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `academy_result_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toastService.success('查询结果已导出为 CSV');
  };

  // 切换演练步骤或挑战模板
  const handleSelectTemplate = (tabKey: string, code: string) => {
    setActiveTab(tabKey);
    setSql(code);
    toastService.info(`已切换至：${tabKey === 'base' ? '核心示例' : tabKey === 'challenge' ? '动手挑战' : tabKey === 'production' ? '生产视图' : tabKey}`);
  };

  return (
    <div className="flex flex-col h-full bg-[#12171f] border-l border-zinc-800 select-text font-sans overflow-hidden text-[#d4d4d4]">
      
      {/* 1. 试炼场顶栏工具条 */}
      <div className="h-10 shrink-0 bg-[#0f141b] border-b border-zinc-800 px-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-white tracking-wide">SQL 交互试炼场</span>
          <span className="text-[10px] text-zinc-500 font-mono hidden sm:inline">DuckDB WASM</span>
        </div>

        {/* 快捷工具按钮组 */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleReset}
            title="重置为初始代码"
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer text-xs flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden xl:inline text-[11px]">重置</span>
          </button>

          <button
            type="button"
            onClick={handleCopySql}
            title="复制代码"
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer text-xs flex items-center gap-1"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden xl:inline text-[11px]">{copied ? '已复制' : '复制'}</span>
          </button>

          {onSaveSnippet && (
            <button
              type="button"
              onClick={() => onSaveSnippet(sql)}
              title="将当前 SQL 收藏为复用片段"
              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 transition-colors cursor-pointer text-xs flex items-center gap-1"
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span className="hidden xl:inline text-[11px]">收藏片段</span>
            </button>
          )}

          {onOpenInGlobalSql && (
            <button
              type="button"
              onClick={() => onOpenInGlobalSql(sql)}
              title="在全局主 SQL 工作台中打开"
              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-cyan-400 transition-colors cursor-pointer text-xs flex items-center gap-1"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden xl:inline text-[11px]">主工作台</span>
            </button>
          )}

          {/* 语法速查按钮 */}
          <button
            type="button"
            onClick={() => setShowCheatSheet(!showCheatSheet)}
            title="DuckDB 高频函数与语法速查"
            className={`p-1.5 rounded transition-colors cursor-pointer text-xs flex items-center gap-1 ${
              showCheatSheet 
                ? 'bg-cyan-500 text-black font-bold' 
                : 'hover:bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden xl:inline text-[11px]">语法速查</span>
          </button>

          {/* 核心执行按钮 */}
          <button
            type="button"
            onClick={() => handleExecute()}
            disabled={isRunning}
            className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm ${
              isRunning
                ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                : 'bg-emerald-400 hover:bg-emerald-300 text-black font-extrabold active:scale-95'
            }`}
          >
            <Play className={`w-3.5 h-3.5 fill-current ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? '执行中...' : '运行 (Ctrl+↵)'}</span>
          </button>
        </div>
      </div>

      {/* 语法速查快捷抽屉 */}
      {showCheatSheet && (
        <div className="bg-[#0f141b] border-b border-zinc-800 p-2.5 space-y-1.5 z-10">
          <div className="flex items-center justify-between text-[10.5px] text-zinc-400 font-medium">
            <span>点击一键追加常用 DuckDB 分析语法：</span>
            <button 
              type="button"
              onClick={() => setShowCheatSheet(false)}
              className="hover:text-white cursor-pointer"
            >
              关闭
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {CHEAT_SHEET_ITEMS.map(item => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setSql(prev => prev ? `${prev}\n\n-- ${item.label}\n${item.snippet}` : item.snippet);
                  toastService.info(`已插入：${item.label}`);
                }}
                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-left transition-colors cursor-pointer group"
                title={item.desc}
              >
                <div className="text-[11px] font-bold text-cyan-400 group-hover:text-white truncate">
                  {item.label}
                </div>
                <div className="text-[9.5px] text-zinc-500 truncate">
                  {item.desc}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 2. 步骤模板切换条 (若课程有多步、挑战或生产视图) */}
      {(steps && steps.length > 0 || challenge || productionTemplate) && (
        <div className="h-8 shrink-0 bg-[#0d1117] border-b border-zinc-800/80 px-2 flex items-center gap-1.5 overflow-x-auto text-[11px]">
          <button
            type="button"
            onClick={() => handleSelectTemplate('base', initialSql)}
            className={`px-2.5 py-0.5 rounded-md font-medium transition-colors cursor-pointer shrink-0 flex items-center gap-1 ${
              activeTab === 'base'
                ? 'bg-zinc-800 text-cyan-400 font-bold border border-zinc-700'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Terminal className="w-3 h-3" />
            <span>核心示例</span>
          </button>

          {steps?.map((step, idx) => (
            <button
              key={step.id}
              type="button"
              onClick={() => handleSelectTemplate(`Step ${idx + 1}`, step.sql)}
              className={`px-2.5 py-0.5 rounded-md font-medium transition-colors cursor-pointer shrink-0 flex items-center gap-1 ${
                activeTab === `Step ${idx + 1}`
                  ? 'bg-zinc-800 text-emerald-400 font-bold border border-zinc-700'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span>{`Step ${idx + 1}`}</span>
            </button>
          ))}

          {challenge && (
            <button
              type="button"
              onClick={() => handleSelectTemplate('challenge', challenge.starterSql || initialSql)}
              className={`px-2.5 py-0.5 rounded-md font-medium transition-colors cursor-pointer shrink-0 flex items-center gap-1 ${
                activeTab === 'challenge'
                  ? 'bg-zinc-800 text-amber-400 font-bold border border-zinc-700'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Target className="w-3 h-3 text-amber-400" />
              <span>动手挑战</span>
            </button>
          )}

          {productionTemplate && (
            <button
              type="button"
              onClick={() => handleSelectTemplate('production', productionTemplate.templateSql)}
              className={`px-2.5 py-0.5 rounded-md font-medium transition-colors cursor-pointer shrink-0 flex items-center gap-1 ${
                activeTab === 'production'
                  ? 'bg-zinc-800 text-purple-400 font-bold border border-zinc-700'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3 h-3 text-purple-400" />
              <span>生产视图</span>
            </button>
          )}
        </div>
      )}

      {/* 3. SQL 代码编辑区 (上半部 40%) */}
      <div className="h-44 shrink-0 relative flex flex-col bg-[#0c1015] border-b border-zinc-800">
        <textarea
          ref={textareaRef}
          value={sql}
          onChange={e => setSql(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="在此键入 DuckDB SQL 代码，按 Ctrl+Enter 立即执行..."
          className="w-full h-full p-3 font-mono text-xs text-[#d4d4d4] bg-transparent resize-none focus:outline-none focus:ring-1 focus:ring-cyan-500/50 leading-relaxed custom-scrollbar selection:bg-zinc-800 selection:text-white"
          spellCheck={false}
        />
        <div className="absolute bottom-1.5 right-2 text-[10px] font-mono text-zinc-500 pointer-events-none opacity-60">
          {sql.split('\n').length} 行 · {sql.length} 字符
        </div>
      </div>

      {/* 4. 验证结果看板 (下半部 60%) */}
      <AcademyResultVerification
        columns={columns}
        rows={rows}
        executionTime={executionTime}
        errorMessage={errorMessage}
        isRunning={isRunning}
        hasRun={hasRun}
        executedSql={lastExecutedSql}
        challenge={activeTab === 'challenge' ? challenge : undefined}
        inputTables={inputTables}
        onExportCsv={handleExportCsv}
      />

    </div>
  );
};

export default AcademySqlRunner;
