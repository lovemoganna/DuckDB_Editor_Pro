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

interface CompositionalDeductionAppProps {
  isOpen?: boolean;
  isActive?: boolean;
  onClose?: () => void;
}

const newSource = (index: number): DeductionSource => ({ id: `S${index}`, title: '', content: '' });

const createRunId = (): string => globalThis.crypto?.randomUUID?.() ?? `deduction-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const CompositionalDeductionApp: React.FC<CompositionalDeductionAppProps> = ({ isOpen = true, onClose }) => {
  const [input, setInput] = useState('');
  const [mappingRequested, setMappingRequested] = useState(false);
  const [sources, setSources] = useState<DeductionSource[]>([newSource(1)]);
  const [result, setResult] = useState<SemanticReconstruction | null>(null);
  const [history, setHistory] = useState<DeductionHistoryRecord[]>(() => loadDeductionHistory());
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
    <main className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#0b0c11] text-monokai-fg">
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#11131a] px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-monokai-amethyst/15 p-2 text-monokai-amethyst"><BrainCircuit className="h-5 w-5" /></div>
            <div>
              <h1 className="text-base font-black tracking-tight">特征组合与语义还原器</h1>
              <p className="mt-0.5 text-[11px] text-monokai-comment">先还原结构，再解释结构；不改事实，不丢关系，不擅自补关系。</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {result && (
            <>
              <button type="button" onClick={copyResult} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/5">
                {copied ? <Check className="h-3.5 w-3.5 text-monokai-green" /> : <Clipboard className="h-3.5 w-3.5" />}{copied ? '已复制' : '复制结果'}
              </button>
              <button type="button" onClick={exportResult} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/5"><Download className="h-3.5 w-3.5" />导出 Markdown</button>
            </>
          )}
          {onClose && <button type="button" aria-label="关闭 Deduction" onClick={onClose} className="rounded-lg p-2 text-monokai-comment hover:bg-white/5 hover:text-monokai-fg"><X className="h-4 w-4" /></button>}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[390px_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-y-auto border-b border-white/10 bg-[#101219] p-4 lg:border-b-0 lg:border-r sm:p-5">
          <div className="space-y-5">
            <section>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="deduction-input" className="text-xs font-black">原始输入</label>
                <span className="text-[10px] text-monokai-comment">{input.length} 字符 · 不截断</span>
              </div>
              <textarea
                id="deduction-input"
                aria-label="原始输入"
                value={input}
                onChange={event => setInput(event.target.value)}
                placeholder="粘贴自然语言、规则、条件、指标、法律条文、产品逻辑或多个离散事实……"
                className="min-h-52 w-full resize-y rounded-xl border border-white/10 bg-black/25 p-3 text-sm leading-6 text-monokai-fg outline-none placeholder:text-monokai-comment/60 focus:border-monokai-amethyst/60"
              />
            </section>

            <section className="rounded-xl border border-white/10 bg-black/15 p-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" aria-label="需要外部映射" checked={mappingRequested} onChange={event => setMappingRequested(event.target.checked)} className="mt-1 accent-[#ae81ff]" />
                <span><strong className="block text-xs">需要外部映射</strong><span className="mt-1 block text-[10px] leading-4 text-monokai-comment">只匹配你提供的依据，不联网、不调用模型常识补来源。</span></span>
              </label>

              {mappingRequested && (
                <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                  {sources.map((source, index) => (
                    <div key={source.id} className="rounded-lg border border-white/10 p-3">
                      <div className="mb-2 flex items-center justify-between text-[10px] font-bold text-monokai-comment">
                        <span>依据 {index + 1}</span>
                        {sources.length > 1 && <button type="button" aria-label={`删除依据 ${index + 1}`} onClick={() => setSources(current => current.filter(item => item.id !== source.id))} className="text-monokai-pink"><Trash2 className="h-3 w-3" /></button>}
                      </div>
                      <input aria-label={`依据名称 ${index + 1}`} value={source.title} onChange={event => updateSource(source.id, { title: event.target.value })} placeholder="依据名称 / 文档标题" className="mb-2 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs outline-none focus:border-monokai-cyan/50" />
                      <textarea aria-label={`依据内容 ${index + 1}`} value={source.content} onChange={event => updateSource(source.id, { content: event.target.value })} placeholder="粘贴可供逐字核验的依据内容" className="min-h-24 w-full resize-y rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs leading-5 outline-none focus:border-monokai-cyan/50" />
                    </div>
                  ))}
                  <button type="button" onClick={() => setSources(current => {
                    const nextIndex = Math.max(0, ...current.map(source => Number(source.id.slice(1)) || 0)) + 1;
                    return [...current, newSource(nextIndex)];
                  })} className="inline-flex items-center gap-1 text-[11px] font-bold text-monokai-cyan"><Plus className="h-3 w-3" />增加依据</button>
                </div>
              )}
            </section>

            {error && <div role="alert" className="rounded-xl border border-monokai-pink/25 bg-monokai-pink/5 p-3 text-xs leading-5 text-monokai-pink">{error}</div>}

            <div className="grid grid-cols-[1fr_auto] gap-2">
              {isRunning ? (
                <button type="button" onClick={cancel} className="inline-flex items-center justify-center gap-2 rounded-xl bg-monokai-pink px-4 py-3 text-xs font-black text-black"><Square className="h-3.5 w-3.5" />取消分析</button>
              ) : (
                <button type="button" disabled={!canRun} onClick={run} className="inline-flex items-center justify-center gap-2 rounded-xl bg-monokai-amethyst px-4 py-3 text-xs font-black text-black disabled:cursor-not-allowed disabled:opacity-35"><Sparkles className="h-4 w-4" />开始语义还原</button>
              )}
              <button type="button" aria-label="清空输入" onClick={clearInput} className="rounded-xl border border-white/10 px-3 text-monokai-comment hover:bg-white/5 hover:text-monokai-fg"><RotateCcw className="h-4 w-4" /></button>
            </div>

            <section className="border-t border-white/10 pt-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-black"><History className="h-3.5 w-3.5 text-monokai-cyan" />最近记录</div>
                {history.length > 0 && <button type="button" onClick={() => { clearDeductionHistory(); setHistory([]); }} className="text-[10px] text-monokai-comment hover:text-monokai-pink">全部清除</button>}
              </div>
              {history.length === 0 ? <p className="text-[11px] leading-5 text-monokai-comment">成功通过校验的结果会仅保存在当前浏览器。</p> : (
                <div className="space-y-2">
                  {history.map(record => (
                    <div key={record.id} className="group flex items-center rounded-lg border border-white/10 bg-black/15">
                      <button type="button" aria-label={`恢复记录：${record.request.input}`} onClick={() => restore(record)} className="min-w-0 flex-1 px-3 py-2 text-left">
                        <span className="block truncate text-[11px] font-bold text-monokai-fg">{record.request.input}</span>
                        <span className="mt-0.5 block text-[9px] text-monokai-comment">{new Date(record.createdAt).toLocaleString()}</span>
                      </button>
                      <button type="button" aria-label={`删除记录：${record.request.input}`} onClick={() => setHistory(deleteDeductionHistory(record.id))} className="mr-2 rounded p-1.5 text-monokai-comment opacity-60 hover:bg-white/5 hover:text-monokai-pink group-hover:opacity-100"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </aside>

        <section className="min-h-0 overflow-y-auto bg-[#0b0c11] p-4 sm:p-6">
          {isRunning ? (
            <div className="flex h-full min-h-80 items-center justify-center">
              <div className="text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-monokai-amethyst" /><strong className="mt-4 block text-sm">正在还原特征与关系</strong><p className="mt-2 text-xs text-monokai-comment">原子化 → 关系识别 → 上下文归一 → 反向审计 → 证据校验</p></div>
            </div>
          ) : result ? (
            <div className="mx-auto max-w-5xl">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-black"><FileSearch className="h-4 w-4 text-monokai-cyan" />结构化还原结果</div>
                <button type="button" onClick={run} disabled={!canRun} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[11px] hover:bg-white/5 disabled:opacity-40"><RotateCcw className="h-3 w-3" />重新分析</button>
              </div>
              <ReconstructionResult result={result} />
            </div>
          ) : (
            <div className="flex h-full min-h-80 items-center justify-center">
              <div className="max-w-md text-center"><BrainCircuit className="mx-auto h-10 w-10 text-monokai-amethyst/60" /><h2 className="mt-4 text-base font-black">等待原始输入</h2><p className="mt-2 text-xs leading-6 text-monokai-comment">结果只回答：有哪些特征、这些特征如何组合、组合后真正表达什么。无法确认的关系会明确保留不确定性。</p></div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
};

export default CompositionalDeductionApp;
