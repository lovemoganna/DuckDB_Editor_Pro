import React, { useState } from 'react';
import { Brain, Loader2, Sparkles, Wand2 } from 'lucide-react';
import type { FeatureDefinition, RuleDefinition } from '../../../services/ontology/ontologyInferenceEngine';
import { FeatureRuleAst } from '../../../services/ontology/ontologyRuleAst';

export interface AiRuleDrafterProps {
  features: FeatureDefinition[];
  onRuleGenerated: (name: string, root: FeatureRuleAst) => void;
}

const PRESET_PROMPTS = [
  '推演数值大于 10000 且状态异常的复合情形',
  '排除具有白名单标记的实体，挖掘高风险情形',
  '结合多个关联特征进行交叉验证与否定排除',
];

export const AiRuleDrafter: React.FC<AiRuleDrafterProps> = ({
  features,
  onRuleGenerated,
}) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);

    try {
      const text = prompt.trim();
      const numMatch = text.match(/[-+]?[0-9]*\.?[0-9]+/);
      const parsedNum = numMatch ? parseFloat(numMatch[0]) : 100;

      // Match feature from text or fallback to appropriate type
      const matchedFeature = features.find(f => text.includes(f.name) || text.includes(f.id));
      const numFeature = matchedFeature?.valueType === 'number'
        ? matchedFeature
        : (features.find(f => f.valueType === 'number') ?? features[0]);

      const boolFeature = matchedFeature?.valueType === 'boolean'
        ? matchedFeature
        : (features.find(f => f.valueType === 'boolean') ?? features[1] ?? features[0]);

      let operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' = 'gt';
      if (text.includes('大于等于') || text.includes('>=') || text.includes('不低于') || text.includes('至少')) {
        operator = 'gte';
      } else if (text.includes('小于等于') || text.includes('<=') || text.includes('不超过')) {
        operator = 'lte';
      } else if (text.includes('小于') || text.includes('<') || text.includes('低于')) {
        operator = 'lt';
      } else if (text.includes('等于') || text.includes('=')) {
        operator = 'eq';
      } else if (text.includes('不等于') || text.includes('!=') || text.includes('不是')) {
        operator = 'neq';
      }

      const isDisjunction = text.includes('或者') || text.includes(' 或 ') || text.includes(' OR ');
      const isNegation = text.includes('排除') || text.includes('非') || text.includes('不包含') || text.includes('未');

      const conditions: FeatureRuleAst[] = [];

      if (numFeature) {
        conditions.push({
          kind: 'condition' as const,
          nodeId: `node-ai-num-${Date.now()}`,
          featureId: numFeature.id,
          operator,
          value: parsedNum,
        });
      }

      if (boolFeature && boolFeature.id !== numFeature?.id) {
        const boolCond: FeatureRuleAst = {
          kind: 'condition' as const,
          nodeId: `node-ai-bool-${Date.now()}`,
          featureId: boolFeature.id,
          operator: 'is_true' as const,
        };
        if (isNegation) {
          conditions.push({
            kind: 'not' as const,
            nodeId: `node-ai-not-${Date.now()}`,
            child: boolCond,
          });
        } else {
          conditions.push(boolCond);
        }
      }

      const newRoot: FeatureRuleAst = conditions.length === 1
        ? conditions[0]
        : {
            kind: isDisjunction ? 'or' : 'and',
            nodeId: `node-ai-${Date.now()}`,
            children: conditions,
          };

      const ruleName = text.slice(0, 20) + (text.length > 20 ? '...' : '');
      onRuleGenerated(`AI起草: ${ruleName}`, newRoot);
      setPrompt('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-monokai-amethyst/30 bg-monokai-amethyst/[0.04] p-3 text-xs">
      <div className="flex items-center gap-1.5 font-bold text-monokai-amethyst text-[11px]">
        <Brain className="h-4 w-4" />
        AI 智能起草规则（自然语言 ➔ AST 树）
      </div>

      <div className="mt-2 flex items-center gap-2">
        <input
          type="text"
          placeholder="用中文描述想要推演的特征组合逻辑，如：数值大于10000且排除白名单..."
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleGenerate(); }}
          className="flex-1 rounded-lg border border-white/10 bg-[#0c0d12] px-3 py-1.5 text-xs text-monokai-fg outline-none focus:border-monokai-accent"
          aria-label="AI 规则描述"
        />
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          className="flex items-center gap-1 shrink-0 rounded-lg bg-monokai-amethyst px-3 py-1.5 font-bold text-black transition-all hover:brightness-110 disabled:opacity-40"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
          生成规则 AST
        </button>
      </div>

      {/* Preset Prompts */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-monokai-comment">快捷灵感:</span>
        {PRESET_PROMPTS.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setPrompt(p)}
            className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-monokai-comment hover:bg-white/10 hover:text-monokai-fg transition-colors"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
};
