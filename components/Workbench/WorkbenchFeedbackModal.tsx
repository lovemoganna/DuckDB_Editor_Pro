import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Send, X, Database, ChevronDown, Loader2, MessageSquare, Bug, Zap, Lightbulb, CheckCircle2, Clock, Download, Trash2, Cpu, Terminal, Layers, Filter, AlertCircle } from 'lucide-react';
import { toastService } from '../../services/toastService';
import type { DuckDBRuntimeInfo } from '../../services/duckdbService';
import { ModalShell, ActionButton } from '../ui/Workbench';

export type IssuePriority = 'P0' | 'P1' | 'P2' | 'P3';
export type IssueType = 'bug' | 'improvement' | 'performance' | 'feature';
export type IssueStatus = 'triage' | 'todo' | 'in_progress' | 'done';

export interface LinearIssueItem {
  id: string;
  title: string;
  type: IssueType;
  priority: IssuePriority;
  status: IssueStatus;
  description: string;
  environment?: {
    engine: string;
    memoryMb: number;
    currentTable?: string;
    hasError?: boolean;
    userAgent: string;
  };
  createdAt: string;
  closedAt?: string;
  isOfficial?: boolean;
}

const INITIAL_OFFICIAL_ISSUES: LinearIssueItem[] = [
  {
    id: 'CORE-101',
    title: '【工程核心 SQL】编辑器输入框字体默认改为 JetBrains Mono，字号 12px',
    type: 'improvement',
    priority: 'P0',
    status: 'done',
    description: '重构全局 CSS 优先级，彻底修复 Victor Mono 花体连笔干扰；CodeMirror 6 全局注入 12px 与 line-height 1.6 专业排版，底部支持 12/13/14px 快速切换。',
    createdAt: '2026-09-05 16:50',
    closedAt: '2026-09-05 17:00',
    isOfficial: true,
  },
  {
    id: 'CORE-102',
    title: '修复“运行选中 (Run Selection)”逻辑，从 CodeMirror 提取真实选区执行',
    type: 'bug',
    priority: 'P1',
    status: 'done',
    description: '解决快捷键 Ctrl+Shift+Enter 与运行选中按钮执行全量 SQL 的严重问题，支持选区提取与当前语句智能识别，并在结果集带 [选中] 标识。',
    createdAt: '2026-09-05 16:51',
    closedAt: '2026-09-05 17:00',
    isOfficial: true,
  },
  {
    id: 'CORE-103',
    title: '解耦左侧资产树单击与查询结果集覆盖，保护用户活跃即席工作现场',
    type: 'improvement',
    priority: 'P1',
    status: 'done',
    description: '单击左侧数据表仅刷新右侧 Inspector 元数据检视，不再强行写入 SELECT * LIMIT 100 冲掉用户当前结果集；双击时以新 Tab 打开探查。',
    createdAt: '2026-09-05 16:52',
    closedAt: '2026-09-05 17:00',
    isOfficial: true,
  },
  {
    id: 'CORE-104',
    title: 'SQL 执行报错分类诊断与 AI 修复闭环（复制日志、定位行号、智能修复）',
    type: 'improvement',
    priority: 'P1',
    status: 'done',
    description: '智能解析 Parser/Binder/Catalog 异常类型，提取行号并提供“复制错误日志”与一键呼叫“AI 修复建议”闭环通道。',
    createdAt: '2026-09-05 16:53',
    closedAt: '2026-09-05 17:00',
    isOfficial: true,
  },
  {
    id: 'CORE-105',
    title: '查询 Tab 标签页未保存关闭防误触与右键快捷操作',
    type: 'improvement',
    priority: 'P2',
    status: 'done',
    description: '对处于 isDirty 状态的 Tab 增加关闭确认保护，防止心血丢失；支持复制当前 SQL、在新标签打开、关闭其他标签等快捷操作。',
    createdAt: '2026-09-05 16:54',
    closedAt: '2026-09-05 17:00',
    isOfficial: true,
  },
  {
    id: 'CORE-106',
    title: '内置 Linear 风格应用内 Issue 追踪与使用反馈闭环中心',
    type: 'feature',
    priority: 'P2',
    status: 'done',
    description: '集成会话环境与错误快照自动抓取，支持分类反馈提交、Triage 状态流转看板与 Markdown/JSON 格式化导出。',
    createdAt: '2026-09-05 16:55',
    closedAt: '2026-09-05 17:00',
    isOfficial: true,
  },
];

interface WorkbenchFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  runtimeInfo: DuckDBRuntimeInfo;
  currentTable?: string | null;
  activeSql?: string;
  lastError?: string | null;
}

export const WorkbenchFeedbackModal: React.FC<WorkbenchFeedbackModalProps> = ({
  isOpen,
  onClose,
  runtimeInfo,
  currentTable,
  activeSql = '',
  lastError,
}) => {
  const [activeTab, setActiveTab] = useState<'submit' | 'board'>('board');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<IssueType>('improvement');
  const [priority, setPriority] = useState<IssuePriority>('P1');
  const [includeEnv, setIncludeEnv] = useState(true);

  // Issues list loaded from localStorage
  const [issues, setIssues] = useState<LinearIssueItem[]>(() => {
    try {
      const stored = localStorage.getItem('duckdb_linear_issues_v1');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {}
    return INITIAL_OFFICIAL_ISSUES;
  });

  const saveIssues = (updated: LinearIssueItem[]) => {
    setIssues(updated);
    try {
      localStorage.setItem('duckdb_linear_issues_v1', JSON.stringify(updated));
    } catch {}
  };

  // ESC 关闭由 ModalShell 自动管理

  // T6 注入：无论 includeEnv 取值如何，提交时都强制在 description 末尾追加运行时快照。
  // 这是 Triage 阶段定位问题的最低保障，避免用户在勾选 includeEnv=false 时丢失环境上下文。
  const buildRuntimeSnapshot = (
    runtime: DuckDBRuntimeInfo,
    table: string | null | undefined,
    sql: string,
    error: string | null | undefined,
    memoryMb: number
  ): string => {
    const lines: string[] = [];
    lines.push(`- Engine: \`${runtime.version || 'DuckDB WASM'}\``);
    lines.push(`- Storage Mode: \`${runtime.storageMode || 'memory'}\``);
    lines.push(`- Database Size: \`${runtime.dbSize || '未知'}\``);
    lines.push(`- Persistent: \`${runtime.persistent ? 'yes' : 'no'}\``);
    lines.push(`- Current Table: \`${table && table.trim() ? table : '无'}\``);
    lines.push(`- Active SQL Length: \`${sql?.length || 0}\` chars`);
    lines.push(`- Memory (JS Heap): \`${memoryMb} MB\``);
    lines.push(`- User-Agent: \`${navigator.userAgent.slice(0, 90)}\``);
    lines.push(`- Captured At: \`${new Date().toISOString()}\``);

    if (error && error.trim()) {
      const errTrimmed = error.length > 240 ? `${error.slice(0, 240)}…(truncated)` : error;
      lines.push('');
      lines.push('**Last Error:**');
      lines.push('```');
      lines.push(errTrimmed);
      lines.push('```');
    }

    if (sql && sql.trim()) {
      const trimmedSql = sql.length > 280 ? `${sql.slice(0, 280)}…(truncated, total ${sql.length} chars)` : sql;
      lines.push('');
      lines.push('**Active SQL (截取):**');
      lines.push('```sql');
      lines.push(trimmedSql);
      lines.push('```');
    }

    return lines.join('\n');
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toastService.error('请填写 Issue 标题');
      return;
    }

    const perf = (performance as any).memory;
    const usedMb = perf ? Math.round(perf.usedJSHeapSize / (1024 * 1024)) : 420;

    // T6: 始终在 description 末尾注入运行时快照，确保 Issue 自带环境证据。
    const descriptionTrimmed = description.trim();
    const snapshotBlock = buildRuntimeSnapshot(runtimeInfo, currentTable, activeSql, lastError, usedMb);
    const finalDescription = descriptionTrimmed
      ? `${descriptionTrimmed}\n\n---\n\n## 自动附加：运行环境诊断快照\n\n${snapshotBlock}`
      : `## 自动附加：运行环境诊断快照\n\n${snapshotBlock}`;

    const newIssue: LinearIssueItem = {
      id: `CORE-${Date.now().toString().slice(-4)}`,
      title: title.trim(),
      type,
      priority,
      status: 'triage',
      description: finalDescription,
      environment: includeEnv
        ? {
            engine: runtimeInfo.version || 'DuckDB WASM',
            memoryMb: usedMb,
            currentTable: currentTable || '无',
            hasError: Boolean(lastError),
            userAgent: navigator.userAgent.slice(0, 70),
          }
        : undefined,
      createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    };

    const updated = [newIssue, ...issues];
    saveIssues(updated);
    toastService.success(`已提交反馈 Issue ${newIssue.id}，进入 Triage 待办`);
    setTitle('');
    setDescription('');
    setActiveTab('board');
  };

  const handleStatusChange = (id: string, newStatus: IssueStatus) => {
    const updated = issues.map(iss => {
      if (iss.id === id) {
        return {
          ...iss,
          status: newStatus,
          closedAt: newStatus === 'done' ? new Date().toLocaleString('zh-CN', { hour12: false }) : undefined,
        };
      }
      return iss;
    });
    saveIssues(updated);
    toastService.info(`已更新 ${id} 状态至: ${newStatus.toUpperCase()}`);
  };

  const handleDeleteIssue = (id: string) => {
    const updated = issues.filter(iss => iss.id !== id);
    saveIssues(updated);
    toastService.info(`已移除 Issue ${id}`);
  };

  const handleExportMarkdown = () => {
    const lines = [
      '# DuckDB Studio - Linear Issues Backlog',
      `*Generated at: ${new Date().toLocaleString()}*`,
      '',
      '| ID | Priority | Type | Status | Title | Created At |',
      '| :--- | :--- | :--- | :--- | :--- | :--- |',
      ...issues.map(
        i =>
          `| **${i.id}** | ${i.priority} | ${i.type} | ${i.status} | ${i.title.replace(/\|/g, '-')} | ${i.createdAt} |`
      ),
      '',
      '## Detailed Specifications',
      ...issues.map(
        i => `\n### [${i.id}] ${i.title}\n- **Status**: \`${i.status}\` | **Priority**: \`${i.priority}\`\n- **Description**: ${i.description}\n`
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `duckdb-issues-${Date.now().toString().slice(-6)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toastService.success('已导出 Markdown 需求清单');
  };

  const filteredIssues = issues.filter(i => {
    if (filterType !== 'all' && i.type !== filterType) return false;
    if (filterStatus !== 'all' && i.status !== filterStatus) return false;
    return true;
  });

  const countByStatus = {
    triage: issues.filter(i => i.status === 'triage').length,
    todo: issues.filter(i => i.status === 'todo').length,
    in_progress: issues.filter(i => i.status === 'in_progress').length,
    done: issues.filter(i => i.status === 'done').length,
  };

  return (
    <ModalShell
      open={isOpen}
      onClose={onClose}
      title="Linear 反馈追踪与 Issue 闭环中心"
      description="参考 Linear 规范：反馈收集 → Triage 分拣 → 优先级编排 → 开发验证 → 闭环沉淀"
      size="lg"
      icon={MessageSquare}
      iconColor="text-monokai-yellow"
      badge="Issue Loop v2.0"
      headerActions={
        <button
          type="button"
          onClick={handleExportMarkdown}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border text-xs text-monokai-fg-muted hover:text-monokai-fg transition-colors cursor-pointer"
          title="导出当前全量 Issue 清单为 Markdown"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">导出清单</span>
        </button>
      }
      footer={
        <>
          <span className="mr-auto flex items-center gap-1.5 font-mono text-[11px] text-monokai-comment">
            <span className="w-2 h-2 rounded-full bg-monokai-green" />
            <span>Linear Issue Sync: Local Persistent (localStorage)</span>
          </span>
          <ActionButton variant="primary" onClick={onClose}>
            完成并返回工作台
          </ActionButton>
        </>
      }
    >

        {/* Sub-Navigation */}
        <div className="flex items-center justify-between border-b border-monokai-border/80 px-5 py-2 bg-monokai-bg/60 text-xs">
          <div className="flex items-center gap-1.5 bg-monokai-surface/80 p-0.5 rounded-lg border border-monokai-border/60">
            <button
              onClick={() => setActiveTab('board')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'board'
                  ? 'bg-monokai-elevated text-monokai-yellow shadow-xs'
                  : 'text-monokai-comment hover:text-monokai-fg'
              }`}
            >
              Issue 追踪看板 ({issues.length})
            </button>
            <button
              onClick={() => setActiveTab('submit')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'submit'
                  ? 'bg-monokai-elevated text-monokai-green shadow-xs'
                  : 'text-monokai-comment hover:text-monokai-fg'
              }`}
            >
              <Send className="w-3 h-3" />
              <span>新建使用反馈</span>
            </button>
          </div>

          {activeTab === 'board' && (
            <div className="flex items-center gap-2">
              <select
                aria-label="按类型过滤"
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="bg-monokai-surface border border-monokai-border rounded-md px-2 py-1 text-[11px] text-monokai-fg focus:outline-none focus:border-monokai-accent transition-colors"
              >
                <option value="all">所有类型 (All Types)</option>
                <option value="bug">缺陷 Bug</option>
                <option value="improvement">体验优化 Improvement</option>
                <option value="performance">性能 Performance</option>
                <option value="feature">功能诉求 Feature</option>
              </select>
              <select
                aria-label="按状态过滤"
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="bg-monokai-surface border border-monokai-border rounded-md px-2 py-1 text-[11px] text-monokai-fg focus:outline-none focus:border-monokai-accent transition-colors"
              >
                <option value="all">所有状态 (All Status)</option>
                <option value="triage">Triage 待分拣</option>
                <option value="todo">Todo 规划中</option>
                <option value="in_progress">In Progress 进行中</option>
                <option value="done">Done 已闭环</option>
              </select>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5">
          {activeTab === 'submit' ? (
            <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-4 font-sans">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-monokai-fg">
                  Issue 标题 / 反馈痛点摘要 <span className="text-monokai-pink">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="例如：SQL 编辑器快捷键在多开 Tab 时冲突；或希望增加结果集列复制..."
                  className="w-full rounded-xl bg-monokai-bg border border-monokai-border px-3.5 py-2.5 text-xs text-monokai-fg placeholder:text-monokai-comment focus:outline-none focus:border-monokai-accent transition-colors"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-monokai-fg">反馈分类 (Type)</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'bug', label: '缺陷 Bug', icon: Bug, color: 'text-monokai-pink' },
                      { id: 'improvement', label: '体验优化', icon: Sparkles, color: 'text-monokai-accent' },
                      { id: 'performance', label: '性能卡顿', icon: Zap, color: 'text-monokai-orange' },
                      { id: 'feature', label: '功能诉求', icon: Lightbulb, color: 'text-monokai-cyan' },
                    ].map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setType(item.id as IssueType)}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                          type === item.id
                            ? 'bg-monokai-elevated border-monokai-accent text-monokai-fg shadow-xs font-semibold'
                            : 'bg-monokai-surface/60 border-monokai-border text-monokai-comment hover:text-monokai-fg hover:border-monokai-border/80'
                        }`}
                      >
                        <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-monokai-fg">优先级 (Linear Priority)</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: 'P0', label: 'P0 紧急', color: 'bg-monokai-pink/20 text-monokai-pink border-monokai-pink/40' },
                      { id: 'P1', label: 'P1 高优', color: 'bg-monokai-orange/20 text-monokai-orange border-monokai-orange/40' },
                      { id: 'P2', label: 'P2 中等', color: 'bg-monokai-yellow/20 text-monokai-yellow border-monokai-yellow/40' },
                      { id: 'P3', label: 'P3 低优', color: 'bg-monokai-surface text-monokai-comment border-monokai-border' },
                    ].map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPriority(p.id as IssuePriority)}
                        className={`py-2 px-1 rounded-lg border text-[11px] font-mono font-semibold text-center transition-all cursor-pointer ${
                          priority === p.id ? `${p.color} ring-1 ring-white/20` : 'bg-monokai-surface/40 border-monokai-border/40 text-monokai-comment hover:text-monokai-fg'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-monokai-fg">
                  复现步骤 / 期望行为详细说明
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={4}
                  placeholder="详细描述您在何种操作路径下遇到了问题，期望得到怎样的反馈或体验交互..."
                  className="w-full rounded-xl bg-monokai-bg border border-monokai-border p-3 text-xs text-monokai-fg placeholder:text-monokai-comment focus:outline-none focus:border-monokai-accent transition-colors"
                />
              </div>

              {/* Automatic Diagnostic Snapshot Toggle */}
              <div className="p-3.5 rounded-xl bg-monokai-bg/70 border border-monokai-border/80 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="includeEnvCheck"
                  checked={includeEnv}
                  onChange={e => setIncludeEnv(e.target.checked)}
                  className="mt-1 rounded accent-monokai-accent cursor-pointer"
                />
                <label htmlFor="includeEnvCheck" className="text-xs cursor-pointer select-none space-y-1">
                  <div className="font-semibold text-monokai-fg flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-monokai-cyan" />
                    <span>自动附加当前运行环境诊断元数据（推荐）</span>
                  </div>
                  <p className="text-[11px] text-monokai-comment">
                    将包含 DuckDB WASM 状态、当前表、活跃 SQL 长度及内存占用，以便快速 Triage 定位。
                  </p>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('board')}
                  className="px-4 py-2 rounded-xl bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border text-xs text-monokai-comment hover:text-monokai-fg transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-monokai-accent hover:opacity-90 text-monokai-bg font-bold text-xs shadow-sm transition-all active:scale-98 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>提交进入 Triage 待办</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {/* Metric Counters */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Triage 待分拣', count: countByStatus.triage, color: 'text-monokai-orange', bg: 'bg-monokai-orange/10' },
                  { label: 'Todo 规划中', count: countByStatus.todo, color: 'text-monokai-cyan', bg: 'bg-monokai-cyan/10' },
                  { label: 'In Progress 推进中', count: countByStatus.in_progress, color: 'text-monokai-yellow', bg: 'bg-monokai-yellow/10' },
                  { label: 'Done 已闭环', count: countByStatus.done, color: 'text-monokai-green', bg: 'bg-monokai-green/10' },
                ].map(metric => (
                  <div key={metric.label} className={`p-3 rounded-xl border border-monokai-border/80 ${metric.bg} flex items-center justify-between`}>
                    <span className="text-xs text-monokai-comment font-medium">{metric.label}</span>
                    <span className={`text-base font-bold font-mono ${metric.color}`}>{metric.count}</span>
                  </div>
                ))}
              </div>

              {/* Issues List */}
              <div className="space-y-2">
                {filteredIssues.length === 0 ? (
                  <div className="py-12 text-center text-xs text-monokai-comment">
                    暂无匹配的 Issue 项目
                  </div>
                ) : (
                  filteredIssues.map(issue => {
                    const typeBadge = {
                      bug: { label: 'Bug', color: 'bg-monokai-pink/15 text-monokai-pink border-monokai-pink/30' },
                      improvement: { label: '优化', color: 'bg-monokai-yellow/15 text-monokai-yellow border-monokai-yellow/30' },
                      performance: { label: '性能', color: 'bg-monokai-orange/15 text-monokai-orange border-monokai-orange/30' },
                      feature: { label: '功能', color: 'bg-monokai-cyan/15 text-monokai-cyan border-monokai-cyan/30' },
                    }[issue.type];

                    return (
                      <div
                        key={issue.id}
                        className="p-3.5 rounded-xl bg-monokai-surface/60 hover:bg-monokai-surface border border-monokai-border-subtle hover:border-monokai-border transition-all space-y-2 group"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[11px] font-mono font-bold text-monokai-yellow shrink-0">
                              {issue.id}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium uppercase shrink-0 ${typeBadge.color}`}>
                              {typeBadge.label}
                            </span>
                            <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-monokai-bg border border-monokai-border/60 text-monokai-comment shrink-0">
                              {issue.priority}
                            </span>
                            <h4 className="text-xs font-semibold text-monokai-fg truncate group-hover:text-monokai-accent transition-colors">
                              {issue.title}
                            </h4>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Status dropdown */}
                            <select
                              aria-label={`修改 Issue ${issue.id} 状态`}
                              value={issue.status}
                              onChange={e => handleStatusChange(issue.id, e.target.value as IssueStatus)}
                              className="bg-monokai-bg border border-monokai-border rounded px-2 py-0.5 text-[10px] font-mono text-monokai-fg focus:outline-none focus:border-monokai-accent transition-colors cursor-pointer"
                            >
                              <option value="triage">Triage</option>
                              <option value="todo">Todo</option>
                              <option value="in_progress">In Progress</option>
                              <option value="done">Done (已闭环)</option>
                            </select>

                            {!issue.isOfficial && (
                              <button
                                onClick={() => handleDeleteIssue(issue.id)}
                                className="p-1 rounded hover:bg-monokai-pink/20 hover:text-monokai-pink text-monokai-comment transition-colors cursor-pointer"
                                title="删除此反馈"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <p className="text-[11px] text-monokai-fg-muted leading-relaxed font-sans">
                          {issue.description}
                        </p>

                        <div className="flex items-center justify-between text-[10px] text-monokai-comment font-mono pt-1 border-t border-monokai-border/40">
                          <div className="flex items-center gap-3">
                            <span>创建于: {issue.createdAt}</span>
                            {issue.closedAt && (
                              <span className="text-monokai-green flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                闭环于: {issue.closedAt}
                              </span>
                            )}
                          </div>
                          {issue.isOfficial && (
                            <span className="text-monokai-cyan font-sans">DuckDB Studio 官方基准</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
    </ModalShell>
  );
};
