import React from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, GitBranch, Quote } from 'lucide-react';
import type { CompositionNode, SemanticReconstruction } from '../../../services/deduction/deductionTypes';

const relationLabels: Record<string, string> = {
  parallel: '并列', containment: '包含', subordination: '从属', dependency: '依赖', causation: '因果',
  sequence: '时序', comparison: '比较', aggregation: '聚合', association: '关联', exclusion: '排斥',
  condition: '条件', constraint: '约束', change: '变化',
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="rounded-2xl border border-white/10 bg-[#13151d] p-4 shadow-sm sm:p-5">
    <h2 className="mb-4 text-sm font-black tracking-wide text-monokai-fg">{title}</h2>
    {children}
  </section>
);

const Evidence: React.FC<{ quotes: Array<{ quote: string }> }> = ({ quotes }) => (
  <div className="mt-2 flex items-start gap-1.5 text-[11px] leading-5 text-monokai-comment">
    <Quote className="mt-0.5 h-3 w-3 shrink-0 text-monokai-cyan" />
    <span>原文证据：{quotes.map(item => item.quote).join('；')}</span>
  </div>
);

const StructureTree: React.FC<{ node: CompositionNode }> = ({ node }) => (
  <li role="treeitem" aria-expanded={node.children.length > 0 ? true : undefined} className="relative pl-4">
    <div className="inline-flex max-w-full items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 font-mono text-xs text-monokai-fg">
      <span className="rounded bg-monokai-amethyst/15 px-1.5 py-0.5 text-[9px] uppercase text-monokai-amethyst">{node.type}</span>
      <span className="break-words">{node.label}</span>
    </div>
    {node.children.length > 0 && (
      <ul role="group" className="mt-2 space-y-2 border-l border-white/10 pl-3">
        {node.children.map(child => <StructureTree key={child.id} node={child} />)}
      </ul>
    )}
  </li>
);

export const ReconstructionResult: React.FC<{ result: SemanticReconstruction }> = ({ result }) => (
  <div className="space-y-4" aria-label="语义还原结果">
    <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-xs ${result.validation.status === 'valid' ? 'border-monokai-green/25 bg-monokai-green/5 text-monokai-green' : 'border-monokai-yellow/25 bg-monokai-yellow/5 text-monokai-yellow'}`}>
      {result.validation.status === 'valid' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
      <strong>{result.validation.status === 'valid' ? '原文逐字支持已确认' : '引用已定位，但 AI 归纳仍待确认'}</strong>
      {result.validation.issues.length > 0 && <span className="text-current/80">{result.validation.issues.join('；')}</span>}
    </div>

    <Section title="1. 原始输入">
      <pre className="whitespace-pre-wrap break-words rounded-xl bg-black/20 p-4 text-sm leading-6 text-monokai-fg">{result.input}</pre>
    </Section>

    <Section title="2. 特征">
      <div className="grid gap-3 xl:grid-cols-2">
        {result.features.map(feature => (
          <article key={feature.id} className="rounded-xl border border-white/10 bg-black/15 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <strong className="font-mono text-xs text-monokai-cyan">{feature.id}</strong>
              <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-monokai-comment">{feature.kind}</span>
              <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${feature.classification === 'fact' ? 'bg-monokai-green/10 text-monokai-green' : 'bg-monokai-yellow/10 text-monokai-yellow'}`}>{feature.classification === 'fact' ? 'AI 分类：事实' : 'AI 分类：判断'}</span>
              {feature.certainty === 'uncertain' && <span className="rounded bg-monokai-pink/10 px-2 py-0.5 text-[10px] font-bold text-monokai-pink">待确认</span>}
            </div>
            <p className="mt-2 text-sm leading-6 text-monokai-fg">{feature.statement}</p>
            <Evidence quotes={feature.evidence} />
          </article>
        ))}
      </div>
    </Section>

    <Section title="3. 关系">
      {result.relations.length === 0 ? (
        <p className="text-sm text-monokai-comment">未发现明确关系；系统没有强行建立关系。</p>
      ) : (
        <div className="space-y-3">
          {result.relations.map(relation => (
            <article key={relation.id} className="rounded-xl border border-white/10 bg-black/15 p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <strong className="font-mono text-monokai-amethyst">{relation.id}</strong>
                <span className="rounded bg-monokai-amethyst/10 px-2 py-0.5 text-monokai-amethyst">AI 识别：{relationLabels[relation.type] ?? relation.type}</span>
                {relation.operator && <span className="rounded bg-monokai-cyan/10 px-2 py-0.5 font-mono text-monokai-cyan">{relation.operator}</span>}
                {relation.certainty === 'uncertain' && <span className="rounded bg-monokai-yellow/10 px-2 py-0.5 font-bold text-monokai-yellow">关系：待确认</span>}
              </div>
              <div className="mt-2 flex items-center gap-2 font-mono text-[11px] text-monokai-comment">
                <span>{relation.fromFeatureIds.join(' + ')}</span><span>→</span><span>{relation.toFeatureIds.join(' + ')}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-monokai-fg">{relation.statement}</p>
              <Evidence quotes={relation.evidence} />
            </article>
          ))}
        </div>
      )}
    </Section>

    <Section title="4. 结构">
      {result.contexts.length > 0 && (
        <div className="mb-4 rounded-xl border border-monokai-cyan/15 bg-monokai-cyan/[0.03] p-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-monokai-cyan">公共上下文</div>
          {result.contexts.map(context => <p key={context.id} className="text-xs leading-5 text-monokai-fg">{context.label} → {context.featureIds.join('、')}</p>)}
        </div>
      )}
      <ul role="tree" aria-label="特征组合结构" className="space-y-2"><StructureTree node={result.structure} /></ul>
    </Section>

    <Section title="5. 核心语义">
      {result.validation.status === 'valid_with_uncertainty' && <p className="mb-2 text-[11px] text-monokai-yellow">AI 综合说明；引用可追溯，但等价性当前无法独立确认。</p>}
      <blockquote className="border-l-2 border-monokai-green pl-4 text-base font-semibold leading-7 text-monokai-fg">{result.coreMeaning.text}</blockquote>
    </Section>

    {result.externalMappings && (
      <Section title="6. 外部映射">
        <div className="space-y-3">
          {result.externalMappings.map(mapping => (
            <article key={mapping.id} className="rounded-xl border border-white/10 bg-black/15 p-3 text-xs leading-5">
              <div className="flex flex-wrap items-center gap-2">
                <ExternalLink className="h-3.5 w-3.5 text-monokai-cyan" />
                <strong className="text-monokai-fg">{mapping.correspondingObject || mapping.targetId}</strong>
                <span className={`rounded px-2 py-0.5 font-bold ${mapping.matchLevel === '无法确认' ? 'bg-monokai-pink/10 text-monokai-pink' : 'bg-monokai-cyan/10 text-monokai-cyan'}`}>{mapping.matchLevel}</span>
              </div>
              <p className="mt-2 text-monokai-fg">对应内容：{mapping.correspondingContent || '未找到直接对应内容'}</p>
              <p className="text-monokai-comment">依据：{mapping.basis?.quote ?? '未找到直接对应内容'}</p>
              <p className="text-monokai-comment">验证：{mapping.validationNote}</p>
            </article>
          ))}
        </div>
      </Section>
    )}

    <Section title="7. 一针见血解读">
      {result.validation.status === 'valid_with_uncertainty' && <p className="mb-2 text-[11px] text-monokai-yellow">AI 归纳；不是数据库事实或原文逐字结论。</p>}
      <div className="flex items-start gap-3">
        <GitBranch className="mt-1 h-4 w-4 shrink-0 text-monokai-yellow" />
        <blockquote className="text-base font-semibold leading-7 text-monokai-fg">{result.punchline.text}</blockquote>
      </div>
    </Section>
  </div>
);
