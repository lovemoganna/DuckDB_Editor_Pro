/**
 * AcademyResultVerification.tsx - 结果验证与智能诊断看板 (4 合 1 交互控制台)
 * 
 * 职责：
 * 1. 结果性能指标度量：执行耗时(ms)、行数、列数、字段物理类型；
 * 2. 交互式结果数据表格：列过滤、排序、分页与 CSV 极速导出；
 * 3. 挑战目标比对判定 (Challenge Verification)：比对返回列、行数、关键字与预期产出，给予即时肯定反馈；
 * 4. 智能错误排查诊断 (Smart Error Diagnostics)：拦截 DuckDB 运行时报错，给出人话错误原因与针对性修复建议；
 * 5. 输入表形态字典 (Input Tables Schema)：随堂随时核查输入数据字段物理类型。
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  CheckCircle2, AlertTriangle, XCircle, Clock, Database, 
  Download, Search, Sparkles, ChevronLeft, ChevronRight,
  HelpCircle, Lightbulb, ArrowRight, Table2, Layers, Check,
  Target, ShieldCheck
} from 'lucide-react';
import { CourseChallenge } from './data/academyCurriculum';

export interface VerificationReport {
  isPassed: boolean;
  score: number;
  message: string;
  matchedCriteria: string[];
  unmatchedCriteria: string[];
}

interface AcademyResultVerificationProps {
  columns: string[];
  rows: any[];
  executionTime: number | null;
  errorMessage: string | null;
  isRunning: boolean;
  hasRun: boolean;
  executedSql: string;
  challenge?: CourseChallenge;
  inputTables?: any[];
  onExportCsv?: () => void;
}

// 常见 DuckDB 报错人话诊断映射
function diagnoseSqlError(error: string): { title: string; hint: string; suggestion: string } {
  const errLower = error.toLowerCase();
  
  if (errLower.includes('must appear in the group by clause') || errLower.includes('aggregate')) {
    return {
      title: '聚合分组字段遗漏 (GROUP BY Mismatch)',
      hint: '在使用了 SUM/AVG/COUNT 等聚合函数的查询中，SELECT 中出现的普通维度列必须全数列在 GROUP BY 子句中。',
      suggestion: '检查 SELECT 后的非聚合列，并将其完整加入末尾的 GROUP BY 列表中。'
    };
  }
  if (errLower.includes('does not exist') || errLower.includes('table') && errLower.includes('not found')) {
    return {
      title: '表名或视图不存在 (Object Not Found)',
      hint: '查询引用的表在当前 DuckDB 内存会话中尚未创建或拼写有误。',
      suggestion: '点击左侧输入表预览卡片中的「重置数据」按钮，或使用 WITH cte AS (...) 构造测试数据。'
    };
  }
  if (errLower.includes('syntax error') || errLower.includes('parser error')) {
    return {
      title: 'SQL 语法解析错误 (Syntax Error)',
      hint: '语句中存在未闭合的括号、逗号多余或关键字拼写错误。',
      suggestion: '仔细核对 SELECT/FROM/WHERE 的顺序，检查是否有遗漏的分号或逗号。'
    };
  }
  if (errLower.includes('type') && (errLower.includes('mismatch') || errLower.includes('conversion') || errLower.includes('cast'))) {
    return {
      title: '数据类型不匹配 (Type Conversion Error)',
      hint: '运算或比较时两端字段类型不兼容（例如用字符串与数字直接加减）。',
      suggestion: '使用 ::INTEGER, ::VARCHAR 或 TRY_CAST(col AS DOUBLE) 进行显式类型转换。'
    };
  }
  if (errLower.includes('division by zero')) {
    return {
      title: '除以零异常 (Division by Zero)',
      hint: '计算百分比或比率时，分母可能为 0。',
      suggestion: '使用 NULLIF(denominator, 0) 将分母为 0 转化为 NULL，避免直接抛错。'
    };
  }
  if (errLower.includes('window function') && (errLower.includes('where') || errLower.includes('not allowed'))) {
    return {
      title: '窗口函数过滤位置受限 (Window in WHERE)',
      hint: '标准 SQL 不允许在 WHERE 子句中直接使用窗口函数。',
      suggestion: '在 DuckDB 中，你可以直接使用 QUALIFY row_number() = 1，无需嵌套多层子查询！'
    };
  }
  if (errLower.includes('ambiguous') || errLower.includes('multiple matches')) {
    return {
      title: '字段名歧义冲突 (Ambiguous Column)',
      hint: 'JOIN 连接的多张表中包含了同名的字段，引擎无法判断该取哪一张表。',
      suggestion: '请为表设置别名（如 a.id, b.id）并在字段前显式加上表前缀。'
    };
  }
  if (errLower.includes('out of range') || errLower.includes('overflow')) {
    return {
      title: '数值范围溢出 (Value Out of Range)',
      hint: '计算结果超出了当前数据类型所允许的存储最大/最小值。',
      suggestion: '尝试将数值转换为更大容量的类型，如 ::BIGINT 或 ::HUGEINT。'
    };
  }

  return {
    title: 'DuckDB 引擎运行时异常',
    hint: '引擎在执行此语句时返回了错误状态。',
    suggestion: '请比对左侧讲义示例代码，尝试恢复初始 SQL 并逐步调试。'
  };
}

export const AcademyResultVerification: React.FC<AcademyResultVerificationProps> = ({
  columns,
  rows,
  executionTime,
  errorMessage,
  isRunning,
  hasRun,
  executedSql,
  challenge,
  inputTables,
  onExportCsv,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeConsoleTab, setActiveConsoleTab] = useState<'results' | 'challenge' | 'schema' | 'diagnostics'>('results');
  const pageSize = 15;

  // 当发生报错时自动切换到诊断选项卡
  useEffect(() => {
    if (errorMessage) {
      setActiveConsoleTab('diagnostics');
    }
  }, [errorMessage]);

  // 挑战验证逻辑
  const verification = useMemo<VerificationReport | null>(() => {
    if (!challenge || !hasRun || errorMessage) return null;

    const matched: string[] = [];
    const unmatched: string[] = [];
    let checksCount = 0;
    let passedCount = 0;

    // 1. 目标列名校验
    if (challenge.targetColumn) {
      checksCount++;
      const hasCol = columns.some(c => c.toLowerCase() === challenge.targetColumn!.toLowerCase());
      if (hasCol) {
        passedCount++;
        matched.push(`已输出目标计算列: ${challenge.targetColumn}`);
      } else {
        unmatched.push(`缺少目标计算列: ${challenge.targetColumn} (当前列: ${columns.join(', ')})`);
      }
    }

    // 2. 结果最小行数校验
    if (challenge.targetMinRows !== undefined) {
      checksCount++;
      if (rows.length >= challenge.targetMinRows) {
        passedCount++;
        matched.push(`输出有效记录 ${rows.length} 行 (要求至少 ${challenge.targetMinRows} 行)`);
      } else {
        unmatched.push(`输出记录 ${rows.length} 行不足 (要求至少 ${challenge.targetMinRows} 行)`);
      }
    }

    // 3. 关键字使用校验
    if (challenge.keywords && challenge.keywords.length > 0) {
      challenge.keywords.forEach(kw => {
        checksCount++;
        const regex = new RegExp(`\\b${kw}\\b`, 'i');
        if (regex.test(executedSql)) {
          passedCount++;
          matched.push(`已使用核心语法: ${kw}`);
        } else {
          unmatched.push(`未检测到核心语法: ${kw}`);
        }
      });
    }

    const isPassed = checksCount > 0 && passedCount === checksCount;
    const score = checksCount > 0 ? Math.round((passedCount / checksCount) * 100) : 100;

    return {
      isPassed,
      score,
      message: isPassed 
        ? '🎉 完美达成挑战目标！逻辑与预期指标完全吻合。'
        : '⚠️ 部分要求尚未达成，请根据未满足项微调 SQL。',
      matchedCriteria: matched,
      unmatchedCriteria: unmatched,
    };
  }, [challenge, hasRun, errorMessage, columns, rows, executedSql]);

  // 搜索过滤行
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    const q = searchTerm.toLowerCase();
    return rows.filter(r => 
      Object.values(r).some(v => String(v).toLowerCase().includes(q))
    );
  }, [rows, searchTerm]);

  // 分页截取
  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0c1015] overflow-hidden select-none font-sans">
      
      {/* 1. 执行状态与度量看板 */}
      <div className="h-9 px-3.5 bg-[#12171f] border-b border-zinc-800 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-3">
          {isRunning ? (
            <div className="flex items-center gap-1.5 text-cyan-400 font-medium animate-pulse">
              <Clock className="w-3.5 h-3.5" />
              <span>DuckDB WASM 极速执行中...</span>
            </div>
          ) : errorMessage ? (
            <div className="flex items-center gap-1.5 text-rose-400 font-semibold">
              <XCircle className="w-3.5 h-3.5" />
              <span>执行失败</span>
            </div>
          ) : hasRun ? (
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>执行成功</span>
              <span className="text-zinc-400 font-normal text-[11px] ml-1 flex items-center gap-1">
                (<span>{rows.length} 行</span>
                <span>·</span>
                <span>{columns.length} 列</span>
                <span>· {executionTime ?? 0} ms)</span>
              </span>
            </div>
          ) : (
            <span className="text-zinc-500 text-[11px]">准备就绪，点击运行执行查询</span>
          )}
        </div>

        {/* 状态指示：输入表数量 */}
        {inputTables && inputTables.length > 0 && (
          <span className="text-[10.5px] text-zinc-500 font-mono hidden sm:inline">
            已就绪 {inputTables.length} 张模拟表
          </span>
        )}
      </div>

      {/* 2. 4 合 1 交互 Tab 控制栏 */}
      <div className="h-8 px-2 bg-[#0f141b] border-b border-zinc-800 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveConsoleTab('results')}
            className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer ${
              activeConsoleTab === 'results'
                ? 'bg-zinc-800 text-cyan-400 font-bold border border-zinc-700 shadow-xs'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Table2 className="w-3 h-3" />
            <span>查询结果</span>
            {hasRun && !errorMessage && <span className="text-[10px] font-mono opacity-80">({rows.length})</span>}
          </button>

          {challenge && (
            <button
              type="button"
              onClick={() => setActiveConsoleTab('challenge')}
              className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                activeConsoleTab === 'challenge'
                  ? 'bg-zinc-800 text-amber-400 font-bold border border-zinc-700 shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Target className="w-3 h-3 text-amber-400" />
              <span>挑战比对</span>
              {verification && (
                <span className={`text-[9.5px] font-mono px-1 rounded ${verification.isPassed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                  {verification.score}%
                </span>
              )}
            </button>
          )}

          {inputTables && inputTables.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveConsoleTab('schema')}
              className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                activeConsoleTab === 'schema'
                  ? 'bg-zinc-800 text-emerald-400 font-bold border border-zinc-700 shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Database className="w-3 h-3 text-emerald-400" />
              <span>输入表形态</span>
              <span className="text-[10px] font-mono opacity-80">({inputTables.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveConsoleTab('diagnostics')}
            className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer ${
              activeConsoleTab === 'diagnostics'
                ? errorMessage
                  ? 'bg-rose-950/40 text-rose-400 font-bold border border-rose-500/30 shadow-xs'
                  : 'bg-zinc-800 text-purple-400 font-bold border border-zinc-700 shadow-xs'
                : errorMessage
                  ? 'text-rose-400 hover:text-rose-300 font-bold'
                  : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Lightbulb className="w-3 h-3" />
            <span>智能诊断</span>
            {errorMessage && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />}
          </button>
        </div>

        {/* 右侧工具：搜索 & CSV 导出 (在结果选项卡中展示) */}
        {activeConsoleTab === 'results' && hasRun && !errorMessage && rows.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                placeholder="筛选结果..."
                className="pl-6 pr-2 py-0.5 text-[10.5px] bg-zinc-800 text-white rounded border border-zinc-700 focus:border-cyan-400 focus:outline-none w-24 transition-all focus:w-36"
              />
            </div>

            {onExportCsv && (
              <button
                type="button"
                onClick={onExportCsv}
                className="px-2 py-0.5 rounded text-[10.5px] text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-700 flex items-center gap-1 transition-colors cursor-pointer"
                title="导出 CSV"
              >
                <Download className="w-3 h-3" />
                <span>CSV</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 3. 挑战验证顶栏 (有挑战反馈时常驻展示) */}
      {verification && (
        <div className={`p-2.5 px-3.5 border-b text-xs transition-all ${
          verification.isPassed 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold">
              {verification.isPassed ? (
                <Sparkles className="w-4 h-4 text-emerald-400 fill-current" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              )}
              <span>{verification.message}</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/60 border border-current/20">
              匹配度 {verification.score}%
            </span>
          </div>

          {(verification.matchedCriteria.length > 0 || verification.unmatchedCriteria.length > 0) && (
            <div className="mt-1.5 flex flex-wrap gap-2 text-[11px]">
              {verification.matchedCriteria.map((m, i) => (
                <span key={i} className="flex items-center gap-1 text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3" /> {m}
                </span>
              ))}
              {verification.unmatchedCriteria.map((u, i) => (
                <span key={i} className="flex items-center gap-1 text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-500/20">
                  <AlertTriangle className="w-3 h-3" /> {u}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. 主体内容区：根据 activeConsoleTab 切换 */}
      <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
        
        {/* A. 智能诊断选项卡 (当报错或主动选中时) */}
        {(activeConsoleTab === 'diagnostics' || (errorMessage && activeConsoleTab === 'results')) ? (
          <div className="p-4 space-y-3 select-text">
            {errorMessage ? (
              (() => {
                const diag = diagnoseSqlError(errorMessage);
                return (
                  <div className="p-3.5 rounded-xl bg-[#12171f] border border-rose-500/30 space-y-2.5">
                    <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                      <XCircle className="w-4 h-4 shrink-0" />
                      <span>{diag.title}</span>
                    </div>

                    <div className="p-2.5 rounded bg-zinc-950/80 border border-zinc-800 font-mono text-[11px] text-rose-300 leading-relaxed overflow-x-auto whitespace-pre-wrap">
                      {errorMessage}
                    </div>

                    <div className="pt-2 border-t border-zinc-800 text-xs text-zinc-300 space-y-1">
                      <p className="flex items-start gap-1.5">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span><strong>可能原因：</strong>{diag.hint}</span>
                      </p>
                      <p className="flex items-start gap-1.5 text-zinc-400">
                        <ArrowRight className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                        <span><strong>排查建议：</strong>{diag.suggestion}</span>
                      </p>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="p-4 rounded-xl bg-[#12171f] border border-zinc-800 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4" />
                  <span>SQL 语法健康度良好 · DuckDB 执行引擎就绪</span>
                </div>
                <div className="text-xs text-zinc-300 space-y-1.5 leading-relaxed">
                  <p>• <strong>列存向量化执行</strong>：DuckDB 采用 Morsel-driven 多线程执行模型与自适应向量化批处理，在内存中具备极高吞吐。</p>
                  <p>• <strong>MinMax 统计下推</strong>：当在 WHERE 中对整数或日期字段进行范围过滤时，引擎将自动跳过无关数据块。</p>
                  <p>• <strong>窗口过滤准则</strong>：优先使用 DuckDB 专属 <code>QUALIFY</code> 过滤窗口排名，避免嵌套多层子查询产生临时投影。</p>
                </div>
              </div>
            )}
          </div>
        ) : activeConsoleTab === 'challenge' ? (
          /* B. 挑战比对专属面板 */
          <div className="p-4 space-y-3">
            {challenge ? (
              <div className="p-3.5 rounded-xl bg-[#12171f] border border-amber-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                    <Target className="w-4 h-4" />
                    <span>挑战任务目标</span>
                  </div>
                  {verification && (
                    <span className={`text-[10.5px] font-mono px-2 py-0.5 rounded font-bold ${verification.isPassed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      达成度: {verification.score}%
                    </span>
                  )}
                </div>

                <p className="text-xs text-zinc-200 leading-relaxed font-medium">
                  {challenge.question}
                </p>

                {challenge.hint && (
                  <p className="text-[11px] text-zinc-400 pt-1.5 border-t border-zinc-800">
                    💡 <strong className="text-amber-300">提示：</strong>{challenge.hint}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2 pt-1">
                  {challenge.targetColumn && (
                    <div className="p-2 rounded bg-zinc-900 border border-zinc-800 text-[11px]">
                      <span className="text-zinc-500">期望目标列：</span>
                      <code className="text-cyan-400 font-mono font-bold ml-1">{challenge.targetColumn}</code>
                    </div>
                  )}
                  {challenge.targetMinRows !== undefined && (
                    <div className="p-2 rounded bg-zinc-900 border border-zinc-800 text-[11px]">
                      <span className="text-zinc-500">最小期望行数：</span>
                      <code className="text-amber-400 font-mono font-bold ml-1">&gt;= {challenge.targetMinRows} 行</code>
                    </div>
                  )}
                </div>

                {challenge.keywords && challenge.keywords.length > 0 && (
                  <div className="text-[11px] text-zinc-400">
                    <span className="text-zinc-500 mr-1.5">要求包含关键字：</span>
                    {challenge.keywords.map(kw => (
                      <span key={kw} className="px-1.5 py-0.5 rounded bg-zinc-800 text-purple-400 font-mono mr-1">
                        {kw}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-zinc-500">本关未设置特定挑战验收指标</div>
            )}
          </div>
        ) : activeConsoleTab === 'schema' ? (
          /* C. 输入表形态字典 */
          <div className="p-4 space-y-4">
            {inputTables && inputTables.length > 0 ? (
              inputTables.map((tbl: any, idx: number) => (
                <div key={idx} className="p-3 rounded-xl bg-[#12171f] border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-emerald-400">
                      {tbl.tableName}
                    </span>
                    <span className="text-[10.5px] text-zinc-400">
                      {tbl.description}
                    </span>
                  </div>

                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-500 font-mono">
                        <th className="py-1 px-2">字段名</th>
                        <th className="py-1 px-2">物理类型</th>
                        <th className="py-1 px-2">业务含义 / 示例值</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 font-mono">
                      {tbl.columns.map((col: any) => (
                        <tr key={col.name} className="hover:bg-zinc-800/30">
                          <td className="py-1 px-2 text-cyan-400 font-semibold">{col.name}</td>
                          <td className="py-1 px-2 text-purple-400">{col.type}</td>
                          <td className="py-1 px-2 text-zinc-400">{col.comment || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-xs text-zinc-500">本课使用内存合成数据或通用序列</div>
            )}
          </div>
        ) : (
          /* D. 运行结果表格选项卡 */
          !hasRun ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500">
              <Table2 className="w-10 h-10 mb-2 opacity-30 text-cyan-400" />
              <p className="text-xs text-zinc-300 font-medium">执行结果将在此呈现</p>
              <p className="text-[11px] text-zinc-500 mt-1 max-w-xs">
                在上方编辑 SQL 后，点击「运行」或按 <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-amber-300 font-mono text-[10px] border border-zinc-700">Ctrl+Enter</kbd> 查看即时反馈
              </p>
            </div>
          ) : rows.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500">
              <Database className="w-8 h-8 mb-2 opacity-40 text-amber-400" />
              <p className="text-xs text-zinc-300">语句执行成功，但返回 0 条记录</p>
              <p className="text-[11px] text-zinc-500 mt-1">
                检查过滤条件是否过于严苛，或所选数据表为空
              </p>
            </div>
          ) : (
            <div className="w-full h-full overflow-auto select-text">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-[#161d27] backdrop-blur z-10 border-b border-zinc-800">
                  <tr>
                    <th className="py-2 px-3 text-[11px] font-mono text-zinc-500 w-10 text-center border-r border-zinc-800">
                      #
                    </th>
                    {columns.map(col => (
                      <th key={col} className="py-2 px-3 text-[11px] font-mono font-semibold text-cyan-400 truncate max-w-[200px]">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-mono text-[11.5px]">
                  {paginatedRows.map((row, rIdx) => {
                    const actualIdx = (currentPage - 1) * pageSize + rIdx + 1;
                    return (
                      <tr key={rIdx} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="py-1.5 px-3 text-center text-[10px] text-zinc-600 border-r border-zinc-800/60">
                          {actualIdx}
                        </td>
                        {columns.map(col => {
                          const val = row[col];
                          const isNull = val === null || val === undefined;
                          return (
                            <td key={col} className="py-1.5 px-3 truncate max-w-[240px]">
                              {isNull ? (
                                <span className="text-zinc-600 italic">NULL</span>
                              ) : typeof val === 'object' ? (
                                <span className="text-purple-400">{JSON.stringify(val)}</span>
                              ) : typeof val === 'number' ? (
                                <span className="text-amber-400">{val}</span>
                              ) : (
                                <span className="text-[#d4d4d4]">{String(val)}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

      </div>

      {/* 5. 底部分页条 (多页时显示) */}
      {activeConsoleTab === 'results' && hasRun && !errorMessage && totalPages > 1 && (
        <div className="h-8 px-3 bg-[#12171f] border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-500 shrink-0">
          <span>
            共 {filteredRows.length} 条记录 · 第 {currentPage}/{totalPages} 页
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default AcademyResultVerification;
