import React, { useMemo, useState } from 'react';
import {
  AlertTriangle, BookOpen, CheckCircle2, ChevronDown, ChevronRight,
  Code2, FileText, Info, Play, RotateCcw, Sparkles, XCircle,
} from 'lucide-react';
import {
  compileRule, evaluateRule, renderRuleLisp, renderRuleExplanation, validateRule,
  OPERATOR_LABELS, VALUE_FREE_OPERATORS,
  type CompiledRule, type EvaluationTrace, type FeatureDefinition, type RuleDefinition,
  type RuleValidationReport,
} from '../../services/ontology/ontologyInferenceEngine';

export interface RulePreviewPanelProps {
  rule: RuleDefinition;
  features: FeatureDefinition[];
  availableRules: RuleDefinition[];
}

const Section = ({ title, icon: Icon, children, defaultOpen = true }: { title: string; icon: React.ElementType; children: React.ReactNode; defaultOpen?: boolean }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-lg p-2 transition-colors hover:bg-white/5"
      >
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-monokai-accent" />
          <span className="text-sm font-black text-monokai-fg">{title}</span>
        </div>
        {isOpen ? <ChevronDown size={16} className="text-monokai-comment" /> : <ChevronRight size={16} className="text-monokai-comment" />}
      </button>
      {isOpen && (
        <div className="mt-2 animate-in slide-in-from-top-2 duration-200 fade-in">
          {children}
        </div>
      )}
    </div>
  );
};

const LispHighlighter = ({ code }: { code: string }) => {
  const tokens = code.split(/([()\s])/);
  return (
    <pre className="whitespace-pre-wrap break-all font-mono text-xs">
      {tokens.map((token, i) => {
        if (token === '(' || token === ')') {
          return <span key={i} className="text-monokai-comment">{token}</span>;
        }
        if (token === 'AND') {
          return <span key={i} className="font-bold text-monokai-cyan">{token}</span>;
        }
        if (token === 'OR') {
          return <span key={i} className="font-bold text-monokai-yellow">{token}</span>;
        }
        if (token === 'NOT') {
          return <span key={i} className="font-bold text-monokai-pink">{token}</span>;
        }
        if (token.startsWith('"') || token.startsWith("'") || (!isNaN(Number(token)) && token.trim() !== '')) {
          return <span key={i} className="text-monokai-amethyst">{token}</span>;
        }
        if (/\s/.test(token)) {
          return token;
        }
        if (Object.values(OPERATOR_LABELS || {}).includes(token as any)) {
          return <span key={i} className="font-bold text-monokai-fg">{token}</span>;
        }
        return <span key={i} className="text-monokai-green">{token}</span>;
      })}
    </pre>
  );
};

const SqlHighlighter = ({ sql }: { sql: string }) => {
  const tokens = sql.split(/(\s+|[=><(),])/);
  const keywords = new Set(['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IS', 'NULL', 'IN', 'BETWEEN', 'CAST', 'AS']);
  return (
    <pre className="whitespace-pre-wrap break-all font-mono text-xs">
      {tokens.map((token, i) => {
        const upper = token.toUpperCase();
        if (keywords.has(upper)) {
          return <span key={i} className="font-bold text-monokai-cyan">{token}</span>;
        }
        if ((token.startsWith("'") && token.endsWith("'")) || (token.startsWith('"') && token.endsWith('"'))) {
          return <span key={i} className="text-monokai-yellow">{token}</span>;
        }
        if (token.startsWith('$')) {
          return <span key={i} className="text-monokai-amethyst">{token}</span>;
        }
        return <span key={i} className="text-monokai-fg">{token}</span>;
      })}
    </pre>
  );
};

const TraceViewer: React.FC<{
  trace: EvaluationTrace;
  depth?: number;
  allExpandedSignal?: boolean | null;
}> = ({ trace, depth = 0, allExpandedSignal = null }) => {
  const statusColors = {
    TRUE: 'text-monokai-green bg-monokai-green/10 border-monokai-border-subtle',
    FALSE: 'text-rose-400 bg-rose-500/10 border-monokai-border-subtle',
    UNKNOWN: 'text-amber-400 bg-amber-500/10 border-monokai-border-subtle',
  };

  const hasChildren = Boolean(trace.children && trace.children.length > 0);
  const [isExpanded, setIsExpanded] = useState(true);

  React.useEffect(() => {
    if (allExpandedSignal !== null) {
      setIsExpanded(allExpandedSignal);
    }
  }, [allExpandedSignal]);

  const isRuleRef = trace.kind === 'ruleRef';

  return (
    <div className="space-y-1 font-mono text-xs" style={{ paddingLeft: depth * 12 }}>
      <div className={`flex items-center gap-1.5 rounded-lg border p-1.5 transition-all ${statusColors[trace.value]}`}>
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setIsExpanded(prev => !prev)}
            className="p-0.5 hover:bg-white/10 rounded text-monokai-fg shrink-0"
            aria-label={isExpanded ? '折叠求值节点' : '展开求值节点'}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <span className="font-bold shrink-0">{trace.value}</span>
        {isRuleRef && (
          <span className="rounded bg-monokai-amethyst/20 px-1.5 py-0.5 text-[10px] text-monokai-amethyst font-bold shrink-0">
            [子规则 AST 拆解]
          </span>
        )}
        <span className="text-monokai-fg font-medium">{trace.label}</span>
        {trace.actual !== undefined && (
          <span className="text-[10px] text-monokai-comment">
            实际: {JSON.stringify(trace.actual)}
          </span>
        )}
        {trace.reason && (
          <span className="text-[10px] text-monokai-yellow">({trace.reason})</span>
        )}
      </div>
      {isExpanded && hasChildren && trace.children?.map((child, i) => (
        <TraceViewer key={child.nodeId || i} trace={child} depth={depth + 1} allExpandedSignal={allExpandedSignal} />
      ))}
    </div>
  );
};

export const RulePreviewPanel: React.FC<RulePreviewPanelProps> = ({ rule, features, availableRules }) => {
  const [sampleValues, setSampleValues] = useState<Record<string, string>>({});
  const [allTraceExpanded, setAllTraceExpanded] = useState<boolean | null>(null);

  const validation = useMemo(() => {
    try {
      return validateRule(rule, features, availableRules);
    } catch (e) {
      return { valid: false, errors: [{ nodeId: 'root', message: String(e) }], warnings: [], maxDepth: 0 } as RuleValidationReport;
    }
  }, [rule, features, availableRules]);

  const lisp = useMemo(() => {
    try {
      return renderRuleLisp(rule, features, availableRules);
    } catch (e) {
      return `解析失败: ${String(e)}`;
    }
  }, [rule, features, availableRules]);

  const compiled = useMemo(() => {
    try {
      return compileRule(rule, features, availableRules);
    } catch (e) {
      return { error: String(e) };
    }
  }, [rule, features, availableRules]);

  const explanation = useMemo(() => {
    try {
      return renderRuleExplanation(rule, features, availableRules);
    } catch (e) {
      return `生成解释失败: ${String(e)}`;
    }
  }, [rule, features, availableRules]);

  const referencedFeatures = useMemo(() => {
    if (!compiled || 'error' in compiled) return [];
    const ids = new Set(compiled.featureIds || []);
    return features.filter(f => ids.has(f.id));
  }, [compiled, features]);

  // Dry-run evaluation on sample input
  const dryRunTrace = useMemo(() => {
    if (!validation.valid) return null;
    const parsedValues: Record<string, unknown> = {};
    for (const f of referencedFeatures) {
      const raw = sampleValues[f.id];
      if (raw !== undefined && raw.trim() !== '') {
        if (raw === 'true') parsedValues[f.id] = true;
        else if (raw === 'false') parsedValues[f.id] = false;
        else if (raw === 'null') parsedValues[f.id] = null;
        else if (!isNaN(Number(raw))) parsedValues[f.id] = Number(raw);
        else parsedValues[f.id] = raw;
      }
    }
    try {
      return evaluateRule(rule, features, parsedValues, { rules: availableRules });
    } catch {
      return null;
    }
  }, [rule, features, availableRules, referencedFeatures, sampleValues, validation.valid]);

  return (
    <div className="flex h-full flex-col overflow-y-auto overflow-x-hidden border-l border-monokai-border bg-monokai-bg p-4 custom-scrollbar">
      {/* 1. Validation Status */}
      <div className="mb-6">
        {validation.valid ? (
          <div className="flex items-center gap-2 rounded-xl border border-monokai-border-subtle bg-monokai-green/10 p-3">
            <CheckCircle2 className="text-monokai-green" size={20} />
            <div>
              <div className="text-sm font-black text-monokai-green">规则有效</div>
              <div className="text-[11px] text-monokai-green/70">最大深度: {validation.maxDepth}</div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 rounded-xl border border-monokai-border-subtle bg-rose-500/10 p-3">
            <div className="flex items-center gap-2">
              <XCircle className="text-rose-400" size={20} />
              <div className="text-sm font-black text-rose-400">规则存在 {validation.errors?.length || 0} 个错误</div>
            </div>
            {validation.errors && validation.errors.length > 0 && (
              <ul className="list-disc space-y-1 pl-8 text-xs text-rose-400/80">
                {validation.errors.map((err, i) => (
                  <li key={i}>{err.message} <span className="text-[10px] opacity-50">({err.nodeId})</span></li>
                ))}
              </ul>
            )}
          </div>
        )}

        {validation.warnings && validation.warnings.length > 0 && (
          <div className="mt-2 flex flex-col gap-2 rounded-xl border border-monokai-border-subtle bg-amber-500/10 p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="text-amber-400" size={16} />
              <div className="text-sm font-black text-amber-400">警告</div>
            </div>
            <ul className="list-disc space-y-1 pl-8 text-xs text-amber-400/80">
              {validation.warnings.map((warn, i) => (
                <li key={i}>{warn.message}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 2. Dry-Run Simulator (🧪 样例数据即时试算) */}
      {referencedFeatures.length > 0 && (
        <Section title="🧪 样例数据即时试算" icon={Sparkles} defaultOpen={true}>
          <div className="space-y-3 rounded-xl border border-monokai-border bg-monokai-sidebar p-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-monokai-comment">
                输入测试特征值，实时验证逻辑树求值过程：
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const newSamples: Record<string, string> = {};
                    referencedFeatures.forEach(f => {
                      if (f.domain && f.domain.length > 0) {
                        const randomChoice = f.domain[Math.floor(Math.random() * f.domain.length)];
                        newSamples[f.id] = String(randomChoice);
                      } else if (f.valueType === 'boolean') {
                        newSamples[f.id] = Math.random() > 0.5 ? 'true' : 'false';
                      } else if (f.valueType === 'number') {
                        newSamples[f.id] = String(Math.floor(Math.random() * 200000) + 5000);
                      } else if (f.valueType === 'category') {
                        newSamples[f.id] = '高风险';
                      } else {
                        newSamples[f.id] = '测试样本';
                      }
                    });
                    setSampleValues(newSamples);
                  }}
                  className="px-2 py-0.5 rounded bg-monokai-surface hover:bg-monokai-hover text-monokai-fg hover:text-monokai-accent text-[10px] font-medium transition-colors border border-monokai-border cursor-pointer"
                  aria-label="一键填入随机测试数据"
                  title="一键填入随机测试数据"
                >
                  🎲 一键填入随机测试数据
                </button>
                <button
                  type="button"
                  onClick={() => setSampleValues({})}
                  className="px-2 py-0.5 rounded bg-monokai-surface hover:bg-monokai-hover text-monokai-comment hover:text-monokai-fg text-[10px] font-medium transition-colors border border-monokai-border cursor-pointer"
                  aria-label="清空测试数据"
                  title="清空测试数据"
                >
                  🧹 清空测试数据
                </button>
              </div>
            </div>
            <div className="grid gap-2">
              {referencedFeatures.map(f => (
                <div key={f.id} className="flex items-center justify-between text-xs">
                  <span className="font-bold text-monokai-green">{f.name}</span>
                  <input
                    type="text"
                    placeholder={`输入 ${f.valueType} 值 (未填为 NULL)`}
                    value={sampleValues[f.id] ?? ''}
                    onChange={e => setSampleValues({ ...sampleValues, [f.id]: e.target.value })}
                    className="w-48 rounded border border-monokai-border bg-monokai-surface px-2 py-1 font-mono text-xs text-monokai-fg outline-none focus:border-monokai-accent"
                  />
                </div>
              ))}
            </div>

            {dryRunTrace && (
              <div className="mt-3 border-t border-monokai-border pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-monokai-accent">求值树求值结果</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAllTraceExpanded(true)}
                      className="text-[10px] text-monokai-comment hover:text-monokai-accent px-1.5 py-0.5 rounded bg-monokai-surface border border-monokai-border cursor-pointer"
                    >
                      全部展开
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllTraceExpanded(false)}
                      className="text-[10px] text-monokai-comment hover:text-monokai-accent px-1.5 py-0.5 rounded bg-monokai-surface border border-monokai-border cursor-pointer"
                    >
                      全部折叠
                    </button>
                    <button
                      onClick={() => setSampleValues({})}
                      className="flex items-center gap-1 text-[10px] text-monokai-comment hover:text-monokai-fg ml-1 cursor-pointer"
                    >
                      <RotateCcw size={10} /> 重置
                    </button>
                  </div>
                </div>
                <TraceViewer trace={dryRunTrace} allExpandedSignal={allTraceExpanded} />
              </div>
            )}
          </div>
        </Section>
      )}

      {/* 3. 中文 Lisp 视图 */}
      <Section title="📝 中文 Lisp" icon={Code2}>
        <div className="rounded-xl border border-monokai-border bg-monokai-sidebar p-3">
          <LispHighlighter code={lisp} />
        </div>
      </Section>

      {/* 4. SQL 预览 */}
      <Section title="💾 SQL" icon={Code2}>
        <div className="rounded-xl border border-monokai-border bg-monokai-sidebar p-3">
          {'error' in (compiled as any) ? (
            <div className="text-xs text-rose-400">{(compiled as any).error}</div>
          ) : (
            <div className="flex flex-col gap-3">
              <SqlHighlighter sql={(compiled as CompiledRule).predicateSql} />
              {((compiled as CompiledRule).params?.length ?? 0) > 0 && (
                <div className="border-t border-monokai-border pt-2">
                  <div className="mb-1 text-[11px] text-monokai-comment">参数绑定:</div>
                  <div className="font-mono text-xs text-monokai-amethyst">
                    {(compiled as CompiledRule).params.map((p, i) => `$${i + 1} = ${JSON.stringify(p)}`).join('\n')}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-monokai-border pt-2 text-[10px] text-monokai-comment">
                <span>特征引用数: {(compiled as CompiledRule).featureIds?.length || 0}</span>
                <span className="font-mono">指纹: {((compiled as CompiledRule).fingerprint || '').substring(0, 8)}...</span>
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* 5. 自然语言解释 */}
      <Section title="📖 解释" icon={BookOpen}>
        <div className="rounded-xl border border-monokai-border bg-monokai-sidebar p-3">
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-monokai-fg">{explanation}</p>
        </div>
      </Section>

      {/* 6. 特征定义展开 */}
      {referencedFeatures.length > 0 && (
        <Section title="🔍 引用特征" icon={FileText} defaultOpen={false}>
          <div className="flex flex-col gap-2">
            {referencedFeatures.map(f => (
              <details key={f.id} className="group rounded-xl border border-monokai-border bg-monokai-sidebar overflow-hidden">
                <summary className="flex cursor-pointer items-center justify-between p-3 transition-colors hover:bg-monokai-surface">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-monokai-green">{f.name}</span>
                    <span className="rounded bg-monokai-surface px-2 py-0.5 text-[10px] text-monokai-fg border border-monokai-border-subtle">{f.valueType}</span>
                    <span className="rounded bg-monokai-surface px-2 py-0.5 text-[10px] text-monokai-fg border border-monokai-border-subtle">{f.source?.kind || 'unknown'}</span>
                  </div>
                  <ChevronDown size={14} className="text-monokai-comment transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-2 space-y-2 border-t border-monokai-border-subtle p-3 pt-0 text-xs text-monokai-fg">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-monokai-comment">ID</span>
                    <span className="font-mono">{f.logicalId} (v{f.version})</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-monokai-comment">描述</span>
                    <span>{f.description || '无描述'}</span>
                  </div>
                  <div className="flex flex-col rounded bg-amber-500/10 p-2 border border-monokai-border-subtle">
                    <span className="text-[10px] text-amber-400">空值语义</span>
                    <span>{f.nullSemantics || '未定义'}</span>
                  </div>
                  {f.window && (
                    <div className="flex flex-col">
                      <span className="text-[10px] text-monokai-comment">时间窗口</span>
                      <span>{f.window.value} {f.window.unit} {f.window.anchorColumn ? `(基于 ${f.window.anchorColumn})` : ''}</span>
                    </div>
                  )}
                  {f.domain && (
                    <div className="flex flex-col">
                      <span className="text-[10px] text-monokai-comment">值域</span>
                      <span className="font-mono">{JSON.stringify(f.domain)}</span>
                    </div>
                  )}
                </div>
              </details>
            ))}
          </div>
        </Section>
      )}

      {/* 7. NULL/UNKNOWN 语义摘要 */}
      {referencedFeatures.length > 0 && (
        <Section title="⚠️ 空值语义" icon={Info} defaultOpen={false}>
          <div className="rounded-xl border border-monokai-border bg-monokai-sidebar overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-monokai-surface text-[10px] text-monokai-comment border-b border-monokai-border-subtle">
                <tr>
                  <th className="p-2 font-medium">特征</th>
                  <th className="p-2 font-medium">处理策略</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-monokai-border-subtle">
                {referencedFeatures.map(f => (
                  <tr key={f.id} className="hover:bg-monokai-surface/50">
                    <td className="p-2 text-monokai-green">{f.name}</td>
                    <td className="p-2 text-monokai-yellow">{f.nullSemantics || '默认 (NULL)'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
};

export default RulePreviewPanel;
