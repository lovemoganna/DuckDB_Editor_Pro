import React, { useMemo, useState } from 'react';
import {
  BrainCircuit, Check, Clipboard, Download, FileSearch, History, Loader2, Plus, RotateCcw, Sparkles, Square,
  Trash2, X,
} from 'lucide-react';
import {
  cancelSemanticReconstruction,
  reconstructSemantics,
} from '../../services/deduction/semanticReconstructionEngine';
import {
  clearDeductionHistory,
  deleteDeductionHistory,
  loadDeductionHistory,
  saveDeductionHistory,
} from '../../services/deduction/deductionHistoryStorage';
import { formatDeductionMarkdown } from '../../services/deduction/deductionFormatter';
import type {
  DeductionHistoryRecord,
  DeductionRequest,
  DeductionSource,
  SemanticReconstruction,
} from '../../services/deduction/deductionTypes';
import { ReconstructionResult } from './Deduction/ReconstructionResult';
import { PageHeader, ActionButton, EmptyState, PageShell } from '../ui/Workbench';
import { useAppStore } from '../../hooks/store/useAppStore';
import { Tab } from '../../types';

interface CompositionalDeductionAppProps {
  isOpen?: boolean;
  isActive?: boolean;
  onClose?: () => void;
  onInsertToEditor?: (sql: string) => void;
}

const newSource = (index: number): DeductionSource => ({ id: `S${index}`, title: '', content: '' });

const createRunId = (): string => globalThis.crypto?.randomUUID?.() ?? `deduction-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const CompositionalDeductionApp: React.FC<CompositionalDeductionAppProps> = ({
  isOpen = true,
  onClose,
  onInsertToEditor,
}) => {
  const { tables = [], setPendingSql, setActiveTab } = useAppStore();
  const [input, setInput] = useState('');
  const [mappingRequested, setMappingRequested] = useState(false);
  const [sources, setSources] = useState<DeductionSource[]>([newSource(1)]);
  const [result, setResult] = useState<SemanticReconstruction | null>(null);
  const [history, setHistory] = useState<DeductionHistoryRecord[]>(() => loadDeductionHistory());
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);

  const sourcesComplete = useMemo(() => !mappingRequested || sources.some(source => source.title.trim() && source.content.trim()), [mappingRequested, sources]);
  const canRun = input.trim().length > 0 && sourcesComplete && !isRunning;

  const buildRequest = (): DeductionRequest => ({
    input,
    externalMappingRequested: mappingRequested,
    sources: mappingRequested ? sources.filter(source => source.title.trim() && source.content.trim()) : [],
  });

  const run = async () => {
    if (!canRun) return;
    setIsRunning(true);
    setError(null);
    setCopied(false);
    try {
      const request = buildRequest();
      const nextResult = await reconstructSemantics(request);
      setResult(nextResult);
      const record: DeductionHistoryRecord = {
        id: createRunId(),
        createdAt: new Date().toISOString(),
        request: { ...request, input: request.input.trim() },
        result: nextResult,
      };
      setHistory(saveDeductionHistory(record));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : '语义还原失败，请检查 AI 配置后重试。';
      setError(message);
    } finally {
      setIsRunning(false);
    }
  };

  const cancel = () => {
    cancelSemanticReconstruction();
    setIsRunning(false);
    setError('本次语义还原已取消，原始输入已保留。');
  };

  const clearInput = () => {
    if (isRunning) cancelSemanticReconstruction();
    setInput('');
    setMappingRequested(false);
    setSources([newSource(1)]);
    setResult(null);
    setError(null);
    setIsRunning(false);
  };

  const restore = (record: DeductionHistoryRecord) => {
    setInput(record.request.input);
    setMappingRequested(record.request.externalMappingRequested);
    setSources(record.request.sources?.length ? record.request.sources : [newSource(1)]);
    setResult(record.result);
    setError(null);
  };

  const updateSource = (id: string, patch: Partial<DeductionSource>) => {
    setSources(current => current.map(source => source.id === id ? { ...source, ...patch } : source));
  };

  const copyResult = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(formatDeductionMarkdown(result));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const exportResult = () => {
    if (!result) return;
    const blob = new Blob([formatDeductionMarkdown(result)], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Deduction_Semantic_Reconstruction_${Date.now()}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <PageShell scroll="none" className="h-full min-h-0 w-full overflow-hidden font-sans">
      {/* Standard Page Header */}
      <PageHeader
        title="特征组合与语义还原器"
        description="先还原结构，再解释结构；不改事实，不丢关系，不擅自补关系"
        icon={BrainCircuit}
        actions={
          <div className="flex items-center gap-2.5">
            {result && (
              <>
                <ActionButton
                  variant="secondary"
                  size="md"
                  icon={copied ? Check : Clipboard}
                  onClick={copyResult}
                >
                  {copied ? '已复制' : '复制结果'}
                </ActionButton>
                <ActionButton
                  variant="secondary"
                  size="md"
                  icon={Download}
                  onClick={exportResult}
                >
                  导出 Markdown
                </ActionButton>
              </>
            )}
          </div>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[380px_minmax(0,1fr)]">
        {/* Left Input Sidebar */}
        <aside className="min-h-0 overflow-y-auto border-b border-monokai-border bg-monokai-sidebar/90 p-4 lg:border-b-0 lg:border-r sm:p-5 custom-scrollbar">
          <div className="space-y-4">
            <section>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="deduction-input" className="text-xs font-semibold text-monokai-fg">原始输入 (Raw Input)</label>
                <span className="text-[10px] font-mono text-monokai-comment">{input.length} 字符 · 不截断</span>
              </div>
              <textarea
                id="deduction-input"
                aria-label="原始输入"
                value={input}
                onChange={event => setInput(event.target.value)}
                placeholder="粘贴自然语言、业务规则、条件、指标、法律条文、产品逻辑或多个离散事实……"
                className="min-h-48 w-full resize-y rounded-md border border-monokai-border/80 bg-monokai-surface/90 p-3 text-xs leading-5 text-monokai-fg outline-none placeholder:text-monokai-comment/60 focus:border-monokai-accent transition-colors"
              />
            </section>

            <section className="rounded-lg border border-monokai-border/80 bg-monokai-surface/60 p-3">
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  aria-label="需要外部映射"
                  checked={mappingRequested}
                  onChange={event => setMappingRequested(event.target.checked)}
                  className="mt-0.5 accent-monokai-accent cursor-pointer"
                />
                <div>
                  <strong className="block text-xs font-medium text-monokai-fg">需要外部映射 (Strict Source Mapping)</strong>
                  <span className="mt-0.5 block text-xs leading-4 text-monokai-comment">只匹配你提供的依据，不联网、不调用模型常识补来源。</span>
                </div>
              </label>

              {mappingRequested && (
                <div className="mt-3.5 space-y-3 border-t border-monokai-border/70 pt-3">
                  {sources.map((source, index) => (
                    <div key={source.id} className="rounded-md border border-monokai-border/80 bg-monokai-bg/60 p-2.5">
                      <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold text-monokai-comment">
                        <span>依据 {index + 1}</span>
                        {sources.length > 1 && (
                          <button
                            type="button"
                            aria-label={`删除依据 ${index + 1}`}
                            onClick={() => setSources(current => current.filter(item => item.id !== source.id))}
                            className="text-monokai-comment hover:text-monokai-pink cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <input
                        aria-label={`依据名称 ${index + 1}`}
                        value={source.title}
                        onChange={event => updateSource(source.id, { title: event.target.value })}
                        placeholder="依据名称 / 文档标题"
                        className="mb-2 w-full rounded-md border border-monokai-border/80 bg-monokai-surface px-2.5 py-1.5 text-xs text-monokai-fg outline-none focus:border-monokai-accent"
                      />
                      <textarea
                        aria-label={`依据内容 ${index + 1}`}
                        value={source.content}
                        onChange={event => updateSource(source.id, { content: event.target.value })}
                        placeholder="粘贴可供逐字核验的依据内容"
                        className="min-h-20 w-full resize-y rounded-md border border-monokai-border/80 bg-monokai-surface px-2.5 py-1.5 text-xs leading-5 text-monokai-fg outline-none focus:border-monokai-accent"
                      />
                    </div>
                  ))}
                  {tables.length > 0 && (
                    <div className="mt-2 rounded border border-monokai-border/60 bg-monokai-bg/60 p-2">
                      <span className="mb-1 block text-[10px] font-semibold text-monokai-comment">快速载入 DuckDB 表为依据：</span>
                      <div className="flex flex-wrap gap-1.5">
                        {tables.map(table => (
                          <button
                            key={table}
                            type="button"
                            onClick={() => {
                              const nextIndex = Math.max(0, ...sources.map(s => Number(s.id.slice(1)) || 0)) + 1;
                              setSources(curr => [
                                ...curr,
                                {
                                  id: `S${nextIndex}`,
                                  title: `数据表: ${table}`,
                                  content: `数据库表 ${table} 的业务数据与结构约束。`,
                                },
                              ]);
                            }}
                            className="inline-flex items-center rounded border border-monokai-border bg-monokai-surface px-2 py-0.5 font-mono text-[10px] text-monokai-fg-muted hover:text-monokai-accent hover:border-monokai-accent transition-colors cursor-pointer"
                          >
                            + {table}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setSources(current => {
                      const nextIndex = Math.max(0, ...current.map(source => Number(source.id.slice(1)) || 0)) + 1;
                      return [...current, newSource(nextIndex)];
                    })}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-monokai-accent hover:underline cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />增加依据
                  </button>
                </div>
              )}
            </section>

            {error && (
              <div role="alert" className="rounded-lg border border-monokai-border-subtle bg-rose-500/10 p-3 text-xs leading-5 text-rose-400">
                {error}
              </div>
            )}

            <div className="grid grid-cols-[1fr_auto] gap-2">
              {isRunning ? (
                <ActionButton
                  variant="danger"
                  icon={Square}
                  onClick={cancel}
                >
                  取消分析
                </ActionButton>
              ) : (
                <ActionButton
                  variant="primary"
                  icon={BrainCircuit}
                  disabled={!canRun}
                  onClick={run}
                >
                  开始语义还原
                </ActionButton>
              )}
              <ActionButton
                variant="secondary"
                icon={RotateCcw}
                aria-label="清空输入"
                onClick={clearInput}
                title="清空输入"
              />
            </div>

            <section className="border-t border-monokai-border/80 pt-4">
              <div className="mb-2.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-monokai-fg">
                  <History className="h-3.5 w-3.5 text-monokai-accent" />
                  <span>最近记录</span>
                </div>
                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { clearDeductionHistory(); setHistory([]); }}
                    className="text-[10px] text-monokai-comment hover:text-monokai-pink cursor-pointer transition-colors"
                  >
                    全部清除
                  </button>
                )}
              </div>
              {history.length === 0 ? (
                <p className="text-[11px] leading-5 text-monokai-comment">成功通过校验的结果会仅保存在当前浏览器。</p>
              ) : (
                <div className="space-y-1.5">
                  {history.map(record => (
                    <div key={record.id} className="group flex items-center rounded-md border border-monokai-border/70 bg-monokai-surface/60 hover:bg-monokai-surface hover:border-monokai-border transition-all">
                      <button
                        type="button"
                        aria-label={`恢复记录：${record.request.input}`}
                        onClick={() => restore(record)}
                        className="min-w-0 flex-1 px-2.5 py-1.5 text-left cursor-pointer"
                      >
                        <span className="block truncate text-[11px] font-medium text-monokai-fg">{record.request.input}</span>
                        <span className="mt-0.5 block text-[9px] font-mono text-monokai-comment">{new Date(record.createdAt).toLocaleString()}</span>
                      </button>
                      <button
                        type="button"
                        aria-label={`删除记录：${record.request.input}`}
                        onClick={() => setHistory(deleteDeductionHistory(record.id))}
                        className="mr-2 rounded p-1 text-monokai-comment opacity-50 hover:text-monokai-pink hover:bg-monokai-pink/10 group-hover:opacity-100 cursor-pointer transition-all"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </aside>

        {/* Right Output Area */}
        <section className="min-h-0 overflow-y-auto bg-monokai-bg p-4 sm:p-6 custom-scrollbar">
          {isRunning ? (
            <div className="flex h-full min-h-80 items-center justify-center">
              <div className="text-center">
                <Loader2 className="mx-auto h-7 w-7 animate-spin text-monokai-green" />
                <strong className="mt-3 block text-sm font-semibold text-monokai-fg">正在解析原子特征与组合拓扑...</strong>
                <p className="mt-1.5 text-xs text-monokai-comment font-mono">事实解构 · 关系拓扑 · 证据反向校验</p>
              </div>
            </div>
          ) : result ? (
            <div className="mx-auto max-w-5xl">
              <div className="mb-4 flex items-center justify-between border-b border-monokai-border/80 pb-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-monokai-fg">
                  <FileSearch className="h-4 w-4 text-monokai-cyan" />
                  <span>结构化还原结果</span>
                </div>
                <ActionButton
                  variant="secondary"
                  size="sm"
                  icon={RotateCcw}
                  onClick={run}
                  disabled={!canRun}
                >
                  重新分析
                </ActionButton>
              </div>
              <ReconstructionResult
                result={result}
                selectedFeatureId={selectedFeatureId}
                onSelectFeature={setSelectedFeatureId}
                onInsertToEditor={(sql) => {
                  if (onInsertToEditor) {
                    onInsertToEditor(sql);
                  } else {
                    setPendingSql(sql);
                    setActiveTab(Tab.SQL);
                  }
                }}
              />
            </div>
          ) : (
            <div className="flex h-full min-h-80 items-center justify-center p-8">
              <EmptyState
                icon={BrainCircuit}
                title="等待原始输入进行语义还原"
                description="输入业务规则或离散事实后，系统将自动拆解特征、识别拓扑关系，生成具有可追溯性的演绎图谱。"
              />
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
};

export default CompositionalDeductionApp;
