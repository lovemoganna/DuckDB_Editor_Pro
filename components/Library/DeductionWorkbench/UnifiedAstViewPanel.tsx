import React, { useState } from 'react';
import {
  BookOpen, Code, Database, Eye, FileText, Layers, ShieldCheck,
} from 'lucide-react';
import type { FeatureDefinition, RuleDefinition } from '../../../services/ontology/ontologyInferenceEngine';
import { compileRule, renderRuleLisp } from '../../../services/ontology/ontologyInferenceEngine';
import { RuleNodeRenderer } from './RuleNodeRenderer';

export interface UnifiedAstViewPanelProps {
  activeRule: RuleDefinition | null;
  allRules: RuleDefinition[];
  features: FeatureDefinition[];
}

export const UnifiedAstViewPanel: React.FC<UnifiedAstViewPanelProps> = ({
  activeRule,
  allRules,
  features,
}) => {
  const [activeTab, setActiveTab] = useState<'lisp' | 'tree' | 'sql' | 'explanation'>('lisp');

  if (!activeRule) {
    return (
      <div className="flex h-full items-center justify-center bg-[#12141e] p-4 text-xs text-monokai-comment">
        请选择一条规则以查看其统一 AST 展现
      </div>
    );
  }

  const compiled = compileRule(activeRule, features, allRules);
  const lispCode = renderRuleLisp(activeRule, features);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#12141e] p-3 text-xs">
      {/* Tab Navigation */}
      <div className="mb-3 flex shrink-0 items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-1">
          {[
            { id: 'lisp', label: '中文 Lisp', icon: Code },
            { id: 'tree', label: '图形规则树', icon: Eye },
            { id: 'sql', label: 'DuckDB SQL', icon: Database },
            { id: 'explanation', label: '自然语言解释', icon: BookOpen },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all ${
                  isActive
                    ? 'border border-monokai-green/30 bg-monokai-green/20 text-monokai-green'
                    : 'border border-transparent bg-white/5 text-monokai-comment hover:bg-white/10'
                }`}
              >
                <Icon className="h-3 w-3" /> {tab.label}
              </button>
            );
          })}
        </div>
        <span className="text-[10px] text-monokai-comment">
          单源 AST：<code className="text-monokai-yellow">{activeRule.logicalId}</code>
        </span>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-auto">
        {/* Lisp View */}
        {activeTab === 'lisp' && (
          <div className="rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-xs text-monokai-fg">
            <div className="mb-2 text-[10px] text-monokai-comment">
              # 人看中文结构，机器执行统一 AST
            </div>
            <pre className="whitespace-pre-wrap leading-relaxed text-monokai-cyan">
              {lispCode}
            </pre>
          </div>
        )}

        {/* Readonly Visual Tree View */}
        {activeTab === 'tree' && (
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="mb-2 text-[10px] text-monokai-comment">
              统一 AST 派生的层级图形树结构（只读）
            </div>
            <RuleNodeRenderer
              node={activeRule.root}
              features={features}
              allRules={allRules}
              currentRuleId={activeRule.id}
              depth={0}
              readOnly
              onUpdateNode={() => {}}
              onDeleteNode={() => {}}
              onAddChild={() => {}}
            />
          </div>
        )}

        {/* SQL View */}
        {activeTab === 'sql' && (
          <div className="rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-xs space-y-3">
            <div>
              <div className="mb-1 text-[10px] font-bold text-monokai-green">Compiled Predicate SQL (DuckDB):</div>
              <pre className="whitespace-pre-wrap rounded bg-black/50 p-2.5 text-monokai-green">
                {compiled.predicateSql}
              </pre>
            </div>
            <div className="rounded-lg bg-monokai-green/10 p-2 text-[10px] text-monokai-green">
              <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
              已启用安全参数绑定 (Parameter Binding)，包含 {compiled.params.length} 个注入防护占位符。
            </div>
          </div>
        )}

        {/* Natural Language Explanation View */}
        {activeTab === 'explanation' && (
          <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-3">
            <div className="rounded-lg bg-monokai-cyan/10 p-2.5 text-monokai-cyan">
              <strong className="block font-bold">规则业务语义：</strong>
              <p className="mt-1 text-[11px] leading-relaxed">{compiled.explanation}</p>
            </div>

            <div className="space-y-1 text-[11px]">
              <div className="font-bold text-monokai-fg">关联分析特征：</div>
              <div className="flex flex-wrap gap-1">
                {compiled.featureIds.map(fid => {
                  const feat = features.find(f => f.id === fid);
                  return (
                    <span key={fid} className="rounded bg-white/10 px-2 py-0.5 text-monokai-yellow">
                      {feat?.name ?? fid}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
