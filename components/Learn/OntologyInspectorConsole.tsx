/**
 * OntologyInspectorConsole.tsx - 右侧常驻架构审查与 DuckDB 执行控制台
 * 
 * 职责：
 * 1. 架构合规性实时健康分 (Health Score 0-100) 与问题检查清单；
 * 2. 实时编译的 DuckDB 物理层 SQL (DDL + DML + 验证查询)；
 * 3. 一键在当前 DuckDB 中实机执行，并在控制台下方流式呈现查询结果表格；
 * 4. 一键复制 SQL、一键导出设计报告。
 */

import React, { useState } from 'react';
import { 
  ShieldCheck, Database, Play, Copy, Download, Check, 
  AlertTriangle, RefreshCw, ChevronRight, X, ExternalLink,
  Code2, CheckCircle2, Award, Terminal
} from 'lucide-react';
import { duckDBService } from '../../services/duckdbService';
import { ModelingCase } from './data/mockCaseData';

interface OntologyInspectorConsoleProps {
  currentCase: ModelingCase;
  generatedSql: string;
  auditReport: {
    score: number;
    isPassing: boolean;
    issues: { type: 'error' | 'warning' | 'info'; message: string }[];
  };
  onClose?: () => void;
  onTryCode?: (code: string) => void;
}

type ConsoleTab = 'audit' | 'duckdb' | 'export';

export const OntologyInspectorConsole: React.FC<OntologyInspectorConsoleProps> = ({
  currentCase,
  generatedSql,
  auditReport,
  onClose,
  onTryCode,
}) => {
  const [activeTab, setActiveTab] = useState<ConsoleTab>('duckdb');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<{
    success: boolean;
    message: string;
    rows?: any[];
    columns?: string[];
  } | null>(null);

  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedExport, setCopiedExport] = useState(false);

  // 在 DuckDB 实机执行
  const handleRunVerification = async () => {
    setIsExecuting(true);
    setExecutionResult(null);

    try {
      const statements = generatedSql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      let lastRes: any = null;
      for (const stmt of statements) {
        lastRes = await duckDBService.query(stmt);
      }

      let rows: any[] = [];
      let columns: string[] = [];

      if (lastRes) {
        if (Array.isArray(lastRes)) {
          rows = lastRes;
          columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        } else if (lastRes.rows) {
          rows = lastRes.rows;
          columns = lastRes.columns || (rows.length > 0 ? Object.keys(rows[0]) : []);
        }
      }

      setExecutionResult({
        success: true,
        message: `模型 DDL & DML 成功执行！共执行 ${statements.length} 条 SQL 语句。`,
        rows: rows.slice(0, 10),
        columns,
      });
    } catch (err: any) {
      console.error('[OntologyInspectorConsole] Execution error:', err);
      setExecutionResult({
        success: false,
        message: `执行失败: ${err.message || String(err)}`,
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(generatedSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleExportMarkdown = () => {
    let md = `# OPLA 建模设计报告：${currentCase.title}\n\n`;
    md += `## 业务背景\n${currentCase.businessBackground}\n\n`;
    md += `## 生成的 DuckDB SQL\n\`\`\`sql\n${generatedSql}\n\`\`\`\n`;
    navigator.clipboard.writeText(md);
    setCopiedExport(true);
    setTimeout(() => setCopiedExport(false), 2000);
  };

  return (
    <div className="w-80 shrink-0 h-full flex flex-col bg-monokai-sidebar border-l border-monokai-border/80 select-none font-sans text-xs">
      {/* 顶栏 */}
      <div className="h-9 px-3 border-b border-monokai-border/80 flex items-center justify-between bg-monokai-bg/60">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-monokai-cyan" />
          <span className="font-bold text-white text-[11px]">审查与执行控制台</span>
        </div>

        <div className="flex items-center gap-1">
          {/* 健康分小胶囊 */}
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
            auditReport.score >= 80
              ? 'bg-monokai-green/15 text-monokai-green border-monokai-green/30'
              : 'bg-monokai-yellow/15 text-monokai-yellow border-monokai-yellow/30'
          }`}>
            {auditReport.score}分
          </span>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded text-monokai-comment hover:text-white cursor-pointer"
              title="折叠控制台"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Tab 切换条 */}
      <div className="flex border-b border-monokai-border/60 bg-monokai-sidebar/80 p-1 gap-1 text-[11px]">
        <button
          onClick={() => setActiveTab('duckdb')}
          className={`flex-1 py-1 rounded font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer ${
            activeTab === 'duckdb'
              ? 'bg-monokai-surface text-monokai-green shadow-xs'
              : 'text-monokai-comment hover:text-white'
          }`}
        >
          <Database className="w-3 h-3" />
          <span>DuckDB 验证</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex-1 py-1 rounded font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer ${
            activeTab === 'audit'
              ? 'bg-monokai-surface text-monokai-cyan shadow-xs'
              : 'text-monokai-comment hover:text-white'
          }`}
        >
          <ShieldCheck className="w-3 h-3" />
          <span>架构审查 ({auditReport.issues.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('export')}
          className={`flex-1 py-1 rounded font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer ${
            activeTab === 'export'
              ? 'bg-monokai-surface text-monokai-yellow shadow-xs'
              : 'text-monokai-comment hover:text-white'
          }`}
        >
          <Download className="w-3 h-3" />
          <span>导出</span>
        </button>
      </div>

      {/* 内容主体 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        
        {/* ================= TAB 1: DUCKDB 在库执行 ================= */}
        {activeTab === 'duckdb' && (
          <div className="space-y-3 h-full flex flex-col">
            {/* 执行操作按钮行 */}
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={handleRunVerification}
                disabled={isExecuting}
                className="flex-1 py-1.5 px-3 rounded-lg bg-monokai-green text-monokai-bg font-bold text-xs hover:bg-monokai-green/90 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                {isExecuting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>立即在 DuckDB 运行验证</span>
              </button>

              <button
                onClick={handleCopySql}
                className="p-1.5 rounded-lg bg-monokai-surface border border-monokai-border text-monokai-comment hover:text-white transition-colors cursor-pointer"
                title="复制代码"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5 text-monokai-green" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

              {onTryCode && (
                <button
                  onClick={() => onTryCode(generatedSql)}
                  className="p-1.5 rounded-lg bg-monokai-surface border border-monokai-border text-monokai-cyan hover:bg-monokai-cyan/10 transition-colors cursor-pointer"
                  title="发送到 SQL 工作台"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* 执行状态/结果 */}
            {executionResult && (
              <div className={`p-2.5 rounded-lg border text-[11px] space-y-1.5 ${
                executionResult.success
                  ? 'bg-monokai-green/10 border-monokai-green/40 text-monokai-green'
                  : 'bg-monokai-pink/10 border-monokai-pink/40 text-monokai-pink'
              }`}>
                <div className="flex items-center gap-1.5 font-bold">
                  {executionResult.success ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                  <span className="leading-tight">{executionResult.message}</span>
                </div>

                {executionResult.rows && executionResult.rows.length > 0 && executionResult.columns && (
                  <div className="overflow-x-auto max-h-40 bg-monokai-bg/90 rounded border border-monokai-border/50 p-1">
                    <table className="w-full text-[9px] font-mono text-left">
                      <thead>
                        <tr className="border-b border-monokai-border/60 text-monokai-comment">
                          {executionResult.columns.map(c => (
                            <th key={c} className="p-1 whitespace-nowrap">{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {executionResult.rows.map((row, rIdx) => (
                          <tr key={rIdx} className="border-b border-monokai-border/30 text-white hover:bg-monokai-surface/40">
                            {executionResult.columns!.map(c => (
                              <td key={c} className="p-1 truncate max-w-[120px]">{String(row[c] ?? '')}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* SQL 实时预览卡 */}
            <div className="flex-1 min-h-0 flex flex-col bg-monokai-bg rounded-lg border border-monokai-border/80 overflow-hidden">
              <div className="px-2.5 py-1 border-b border-monokai-border/60 bg-monokai-surface/40 flex items-center justify-between text-[10px] text-monokai-comment font-mono">
                <span>live_compiled_model.sql</span>
                <span>DuckDB SQL</span>
              </div>
              <pre className="flex-1 p-2.5 overflow-y-auto text-[10.5px] font-mono leading-relaxed text-monokai-fg/90 select-text">
                {generatedSql}
              </pre>
            </div>
          </div>
        )}

        {/* ================= TAB 2: 架构审查清单 ================= */}
        {activeTab === 'audit' && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-monokai-bg/70 border border-monokai-border/60 text-center">
              <div className="text-[10px] text-monokai-comment uppercase tracking-wider mb-1">综合本体健康分</div>
              <div className={`text-3xl font-mono font-bold ${
                auditReport.score >= 80 ? 'text-monokai-green' : auditReport.score >= 60 ? 'text-monokai-yellow' : 'text-monokai-pink'
              }`}>
                {auditReport.score}
              </div>
              <div className="text-[10.5px] text-monokai-comment mt-1">
                {auditReport.score >= 80 ? '✓ 满足高质量业务闭环标准' : '需优化实体拓扑或补齐 Action'}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-bold text-white">合规审计条目清单：</div>
              {auditReport.issues.length === 0 ? (
                <div className="p-3 rounded-lg bg-monokai-green/10 border border-monokai-green/30 text-monokai-green text-center text-xs flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>全部 6 项合规检查均已通过！</span>
                </div>
              ) : (
                auditReport.issues.map((iss, i) => (
                  <div
                    key={i}
                    className={`p-2.5 rounded-lg border text-[11px] flex items-start gap-2 ${
                      iss.type === 'error'
                        ? 'bg-monokai-pink/10 border-monokai-pink/30 text-monokai-pink'
                        : iss.type === 'warning'
                        ? 'bg-monokai-yellow/10 border-monokai-yellow/30 text-monokai-yellow'
                        : 'bg-monokai-surface/60 border-monokai-border text-monokai-comment'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{iss.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 3: 导出设计报告 ================= */}
        {activeTab === 'export' && (
          <div className="space-y-3">
            <div className="text-xs text-monokai-comment leading-relaxed">
              可一键将当前案例的 Object、Property、Link、Action 完整定义及生成的 DuckDB DDL 脚本导出为 Markdown 文档或 JSON 格式。
            </div>

            <button
              onClick={handleExportMarkdown}
              className="w-full py-2 px-3 rounded-lg bg-monokai-surface border border-monokai-border hover:border-monokai-cyan text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              {copiedExport ? <Check className="w-3.5 h-3.5 text-monokai-green" /> : <Download className="w-3.5 h-3.5 text-monokai-cyan" />}
              <span>{copiedExport ? '已复制 Markdown 报告' : '复制完整 Markdown 设计报告'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OntologyInspectorConsole;
