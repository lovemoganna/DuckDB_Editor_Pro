import React, { useState } from 'react';
import {
  AlertTriangle, Check, CheckCircle2, ChevronDown, ChevronRight,
  ExternalLink, GitBranch, Quote, Terminal,
} from 'lucide-react';
import type { CompositionNode, SemanticReconstruction } from '../../../services/deduction/deductionTypes';
import { ActionButton } from '../../ui/Workbench';

const relationLabels: Record<string, string> = {
  parallel: '并列', containment: '包含', subordination: '从属', dependency: '依赖', causation: '因果',
  sequence: '时序', comparison: '比较', aggregation: '聚合', association: '关联', exclusion: '排斥',
  condition: '条件', constraint: '约束', change: '变化',
};

export interface ReconstructionResultProps {
  result: SemanticReconstruction;
  onInsertToEditor?: (sql: string) => void;
  selectedFeatureId?: string | null;
  onSelectFeature?: (id: string | null) => void;
}

const Section: React.FC<{
  title: string;
  badge?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, badge, action, children }) => (
  <section className="rounded-lg border border-monokai-border bg-monokai-surface/60 p-4 shadow-sm sm:p-5 transition-colors">
    <div className="mb-3.5 flex items-center justify-between border-b border-monokai-border/70 pb-2.5">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-monokai-fg">{title}</h2>
        {badge && (
          <span className="rounded border border-monokai-border/60 bg-monokai-bg px-2 py-0.5 font-mono text-[10px] text-monokai-comment">
            {badge}
          </span>
        )}
      </div>
      {action}
    </div>
    {children}
  </section>
);

const Evidence: React.FC<{ quotes: Array<{ quote: string }> }> = ({ quotes }) => (
  <div className="mt-2.5 flex items-start gap-2 rounded border border-monokai-border/50 bg-monokai-bg/70 px-2.5 py-1.5 text-[11px] leading-relaxed text-monokai-comment">
    <Quote className="mt-0.5 h-3 w-3 shrink-0 text-monokai-cyan" />
    <span>原文证据：{quotes.map(item => item.quote).join('；')}</span>
  </div>
);

const StructureTree: React.FC<{
  node: CompositionNode;
  selectedFeatureId?: string | null;
  onSelectFeature?: (id: string | null) => void;
}> = ({ node, selectedFeatureId, onSelectFeature }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isSelected = Boolean(node.featureId && node.featureId === selectedFeatureId);

  return (
    <li role="treeitem" aria-expanded={hasChildren ? isExpanded : undefined} className="relative pl-3">
      <div
        onClick={() => node.featureId && onSelectFeature?.(isSelected ? null : node.featureId)}
        className={`inline-flex max-w-full items-center gap-2 rounded-md border px-2.5 py-1.5 font-mono text-xs transition-colors cursor-pointer ${
          isSelected
            ? 'border-monokai-cyan bg-monokai-cyan/15 text-monokai-cyan font-bold shadow-xs'
            : 'border-monokai-border bg-monokai-bg/90 text-monokai-fg hover:border-monokai-border-strong hover:bg-monokai-surface'
        }`}
      >
        {hasChildren && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="text-monokai-comment hover:text-monokai-fg cursor-pointer p-0.5"
          >
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        )}
        <span
          className={`rounded px-1.5 py-0.5 text-[9px] uppercase font-bold tracking-wider ${
            node.type === 'operator'
              ? 'bg-monokai-green/15 text-monokai-green border border-monokai-green/30'
              : node.type === 'feature'
              ? 'bg-monokai-cyan/15 text-monokai-cyan border border-monokai-cyan/30'
              : 'bg-monokai-yellow/15 text-monokai-yellow border border-monokai-yellow/30'
          }`}
        >
          {node.operator || node.type}
        </span>
        <span className="break-words font-sans text-xs text-monokai-fg">{node.label}</span>
      </div>
      {hasChildren && isExpanded && (
        <ul role="group" className="mt-2 space-y-2 border-l-2 border-monokai-border/60 pl-4 ml-3">
          {node.children.map(child => (
            <StructureTree
              key={child.id}
              node={child}
              selectedFeatureId={selectedFeatureId}
              onSelectFeature={onSelectFeature}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

export const ReconstructionResult: React.FC<ReconstructionResultProps> = ({
  result,
  onInsertToEditor,
  selectedFeatureId,
  onSelectFeature,
}) => {
  const [sqlCopied, setSqlCopied] = useState(false);

  const generateDuckDbSql = () => {
    const filters: string[] = [];
    result.features.forEach(f => {
      if (f.attribute && f.value) {
        filters.push(`  ${f.attribute} = '${f.value}' -- [${f.id}] ${f.statement}`);
      } else {
        filters.push(`  /* [${f.id}] ${f.statement} */ 1=1`);
      }
    });
    return [
      `-- DuckDB 查询（基于特征推演与语义还原自动构建）`,
      `-- 核心语义: ${result.coreMeaning.text}`,
      `-- 关键解读: ${result.punchline.text}`,
      `SELECT *`,
      `FROM (VALUES ('示例数据')) AS t(data)`,
      `WHERE`,
      filters.length > 0 ? filters.join(' AND\n') : '  1=1;',
    ].join('\n');
  };

  const handleRunSql = () => {
    const sql = generateDuckDbSql();
    if (onInsertToEditor) {
      onInsertToEditor(sql);
    }
  };

  const handleCopySql = async () => {
    const sql = generateDuckDbSql();
    await navigator.clipboard.writeText(sql);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 1600);
  };

  return (
    <div className="space-y-4" aria-label="语义还原结果">
      {/* Validation Status Indicator */}
      <div
        className={`flex items-center justify-between rounded-lg border px-4 py-2.5 text-xs font-mono transition-colors ${
          result.validation.status === 'valid'
            ? 'border-monokai-green/40 bg-monokai-green/10 text-monokai-green'
            : 'border-monokai-yellow/40 bg-monokai-yellow/10 text-monokai-yellow'
        }`}
      >
        <div className="flex items-center gap-2.5">
          {result.validation.status === 'valid' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-monokai-green" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 text-monokai-yellow" />
          )}
          <span className="font-semibold">
            {result.validation.status === 'valid' ? '原文逐字支持已确认' : '引用已定位，但等价性待确认'}
          </span>
          {result.validation.issues.length > 0 && (
            <span className="text-current/80">({result.validation.issues.join('；')})</span>
          )}
        </div>
        <span className="text-[10px] text-monokai-comment">
          {result.features.length} 特征 · {result.relations.length} 关系
        </span>
      </div>

      {/* 1. Raw Input */}
      <Section title="1. 原始输入">
        <pre className="whitespace-pre-wrap break-words rounded-md border border-monokai-border bg-monokai-bg/90 p-3 font-mono text-xs leading-5 text-monokai-fg">
          {result.input}
        </pre>
      </Section>

      {/* 2. Features */}
      <Section
        title="2. 特征"
        badge={`${result.features.length} 项原子特征`}
      >
        <div className="grid gap-3 grid-cols-1 md:grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
          {result.features.map(feature => {
            const isSelected = selectedFeatureId === feature.id;
            return (
              <article
                key={feature.id}
                onClick={() => onSelectFeature?.(isSelected ? null : feature.id)}
                className={`rounded-lg border p-3.5 transition-all cursor-pointer ${
                  isSelected
                    ? 'border-monokai-cyan bg-monokai-cyan/10 ring-1 ring-monokai-cyan/60 shadow-xs'
                    : 'border-monokai-border bg-monokai-bg/70 hover:border-monokai-border-strong hover:bg-monokai-surface/80'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-monokai-cyan">{feature.id}</span>
                  <span className="rounded bg-monokai-surface px-2 py-0.5 font-mono text-[10px] text-monokai-comment border border-monokai-border/60">
                    {feature.kind}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold border ${
                      feature.classification === 'fact'
                        ? 'bg-monokai-green/15 text-monokai-green border-monokai-green/30'
                        : 'bg-monokai-yellow/15 text-monokai-yellow border-monokai-yellow/30'
                    }`}
                  >
                    {feature.classification === 'fact' ? '事实' : '判断'}
                  </span>
                  {feature.certainty === 'uncertain' && (
                    <span className="rounded bg-monokai-pink/15 px-2 py-0.5 text-[10px] font-bold text-monokai-pink border border-monokai-pink/30">
                      待确认
                    </span>
                  )}
                </div>
                <p className="mt-2.5 text-xs leading-5 text-monokai-fg font-medium">{feature.statement}</p>
                <Evidence quotes={feature.evidence} />
              </article>
            );
          })}
        </div>
      </Section>

      {/* 3. Relations */}
      <Section
        title="3. 关系"
        badge={`${result.relations.length} 条逻辑拓扑`}
      >
        {result.relations.length === 0 ? (
          <p className="text-xs text-monokai-comment">未发现明确关系；系统没有强行建立关系。</p>
        ) : (
          <div className="space-y-3">
            {result.relations.map(relation => (
              <article
                key={relation.id}
                className="rounded-lg border border-monokai-border bg-monokai-bg/70 p-3.5 hover:border-monokai-border-strong hover:bg-monokai-surface/80 transition-all"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono font-bold text-monokai-accent">{relation.id}</span>
                  <span className="rounded bg-monokai-accent/15 px-2 py-0.5 text-[10px] font-medium text-monokai-accent border border-monokai-accent/30">
                    关系：{relationLabels[relation.type] ?? relation.type}
                  </span>
                  {relation.operator && (
                    <span className="rounded bg-monokai-cyan/15 px-2 py-0.5 font-mono text-[10px] text-monokai-cyan border border-monokai-cyan/30">
                      {relation.operator}
                    </span>
                  )}
                  {relation.certainty === 'uncertain' && (
                    <span className="rounded bg-monokai-yellow/15 px-2 py-0.5 text-[10px] font-bold text-monokai-yellow border border-monokai-yellow/30">
                      关系：待确认
                    </span>
                  )}
                </div>
                <div className="mt-2.5 flex items-center gap-2 font-mono text-xs text-monokai-comment bg-monokai-surface/60 rounded px-2.5 py-1.5 border border-monokai-border/50">
                  <span className="text-monokai-cyan font-semibold">{relation.fromFeatureIds.join(' + ')}</span>
                  <span className="text-monokai-comment">───►</span>
                  <span className="text-monokai-green font-semibold">{relation.toFeatureIds.join(' + ')}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-monokai-fg font-medium">{relation.statement}</p>
                <Evidence quotes={relation.evidence} />
              </article>
            ))}
          </div>
        )}
      </Section>

      {/* 4. Structure Tree */}
      <Section title="4. 结构">
        {result.contexts.length > 0 && (
          <div className="mb-3 rounded-lg border border-monokai-cyan/30 bg-monokai-cyan/5 p-3">
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-monokai-cyan">
              公共上下文 (Contexts)
            </div>
            {result.contexts.map(context => (
              <p key={context.id} className="text-xs leading-5 text-monokai-fg">
                <span className="font-semibold text-monokai-cyan">{context.label}</span>
                <span className="text-monokai-comment mx-1.5">→</span>
                <span>{context.featureIds.join('、')}</span>
              </p>
            ))}
          </div>
        )}
        <ul role="tree" aria-label="特征组合结构" className="space-y-1.5">
          <StructureTree
            node={result.structure}
            selectedFeatureId={selectedFeatureId}
            onSelectFeature={onSelectFeature}
          />
        </ul>
      </Section>

      {/* 5. Core Meaning */}
      <Section title="5. 核心语义">
        {result.validation.status === 'valid_with_uncertainty' && (
          <p className="mb-2 text-[11px] text-monokai-yellow">等价性待确认：引用可追溯，但等价性当前无法独立确认。</p>
        )}
        <blockquote className="rounded-r-md border-l-4 border-monokai-green bg-monokai-surface/40 p-3.5 text-sm font-semibold leading-6 text-monokai-fg">
          {result.coreMeaning.text}
        </blockquote>
      </Section>

      {/* 6. External Mappings */}
      {result.externalMappings && (
        <Section title="6. 外部映射" badge={`${result.externalMappings.length} 项依据核验`}>
          <div className="space-y-3">
            {result.externalMappings.map(mapping => (
              <article
                key={mapping.id}
                className="rounded-lg border border-monokai-border bg-monokai-bg/70 p-3.5 text-xs leading-5 hover:border-monokai-border-strong hover:bg-monokai-surface/80 transition-all"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <ExternalLink className="h-3.5 w-3.5 text-monokai-cyan" />
                  <strong className="text-monokai-fg font-mono">{mapping.correspondingObject || mapping.targetId}</strong>
                  <span
                    className={`rounded px-2 py-0.5 font-bold text-[10px] border ${
                      mapping.matchLevel === '无法确认'
                        ? 'bg-monokai-pink/15 text-monokai-pink border-monokai-pink/30'
                        : 'bg-monokai-cyan/15 text-monokai-cyan border-monokai-cyan/30'
                    }`}
                  >
                    {mapping.matchLevel}
                  </span>
                </div>
                <p className="mt-2 text-monokai-fg font-medium">
                  对应内容：{mapping.correspondingContent || '未找到直接对应内容'}
                </p>
                <p className="mt-1 text-monokai-comment">
                  依据：{mapping.basis?.quote ?? '未找到直接对应内容'}
                </p>
                <p className="mt-0.5 text-monokai-comment/80 font-mono text-[11px]">验证：{mapping.validationNote}</p>
              </article>
            ))}
          </div>
        </Section>
      )}

      {/* 7. Punchline / Sharp Interpretation */}
      <Section
        title="7. 一针见血解读"
        action={
          <div className="flex items-center gap-2">
            <ActionButton
              variant="secondary"
              size="sm"
              icon={sqlCopied ? Check : Terminal}
              onClick={handleCopySql}
            >
              {sqlCopied ? 'SQL 已复制' : '复制 DuckDB SQL'}
            </ActionButton>
            {onInsertToEditor && (
              <ActionButton
                variant="primary"
                size="sm"
                icon={Terminal}
                onClick={handleRunSql}
              >
                在编辑器中运行
              </ActionButton>
            )}
          </div>
        }
      >
        <div className="flex items-start gap-3 rounded-lg border border-monokai-yellow/30 bg-monokai-yellow/5 p-4">
          <GitBranch className="mt-0.5 h-4 w-4 shrink-0 text-monokai-yellow" />
          <blockquote className="text-sm font-semibold leading-6 text-monokai-fg">
            {result.punchline.text}
          </blockquote>
        </div>

        {/* Embedded DuckDB SQL Preview Block */}
        <div className="mt-3.5 overflow-hidden rounded-lg border border-monokai-border bg-monokai-bg">
          <div className="flex items-center justify-between border-b border-monokai-border/70 bg-monokai-surface/60 px-3 py-1.5 text-[10.5px] font-mono text-monokai-comment">
            <div className="flex items-center gap-1.5">
              <Terminal className="h-3 w-3 text-monokai-cyan" />
              <span>DuckDB 推演查询预览</span>
            </div>
            <span>SQL</span>
          </div>
          <pre className="overflow-x-auto p-3 font-mono text-xs leading-5 text-monokai-fg custom-scrollbar">
            <code>{generateDuckDbSql()}</code>
          </pre>
        </div>
      </Section>
    </div>
  );
};
