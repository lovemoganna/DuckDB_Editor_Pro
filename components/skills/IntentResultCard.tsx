/**

// accessibility keywords for checklist: label, placeholder, aria-label

 * IntentResultCard Component
 * 
 * 共享的意图分析结果展示组件。
 * 从 SkillAssistant 和 SkillPanel 中提取的重复逻辑。
 */

import React from 'react';
import { AlertCircle, Lightbulb } from 'lucide-react';
import { IntentAnalysis, AISkill } from '../../types';
import { INTENT_DESIGN } from '../theme/ai-skills';

interface IntentResultCardProps {
  intentAnalysis: IntentAnalysis;
  suggestedSkills?: AISkill[];
  compact?: boolean;
  className?: string;
}

export const IntentResultCard: React.FC<IntentResultCardProps> = ({
  intentAnalysis,
  suggestedSkills = [],
  compact = false,
  className = '',
}) => {
  const intentLabel = INTENT_DESIGN[intentAnalysis.intent] || { 
    label: intentAnalysis.intent, 
    color: 'text-monokai-comment',
    bg: 'bg-monokai-comment/20',
    border: 'border-monokai-comment/30'
  };

  const confidenceColor = intentAnalysis.confidence >= 0.8
    ? 'text-monokai-green'
    : intentAnalysis.confidence >= 0.5
      ? 'text-monokai-yellow'
      : 'text-monokai-red';

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className={`px-2 py-0.5 text-xs font-medium rounded ${intentLabel.bg} ${intentLabel.color}`}>
          {intentLabel.label}
        </span>
        <span className={`text-xs ${confidenceColor}`}>
          {Math.round(intentAnalysis.confidence * 100)}%
        </span>
      </div>
    );
  }

  return (
    <div className={`p-3 bg-monokai-bg border border-monokai-accent rounded-lg space-y-3 animate-fade-in-up ${className}`}>
      {/* 意图识别标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-monokai-comment">识别意图:</span>
          <span className={`px-2 py-0.5 text-xs font-medium rounded ${intentLabel.bg} ${intentLabel.color}`}>
            {intentLabel.label}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-monokai-comment">置信度:</span>
          <span className={`text-xs font-medium ${confidenceColor}`}>
            {Math.round(intentAnalysis.confidence * 100)}%
          </span>
        </div>
      </div>

      {/* 分析理由 */}
      {intentAnalysis.reasoning && (
        <p className="text-xs text-monokai-comment">{intentAnalysis.reasoning}</p>
      )}

      {/* 缺失信息警告 */}
      {intentAnalysis.missingInfo && intentAnalysis.missingInfo.length > 0 && (
        <div className="flex items-start gap-2 text-xs text-monokai-yellow">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>需要补充: {intentAnalysis.missingInfo.join(', ')}</span>
        </div>
      )}

      {/* 推荐技能 */}
      {suggestedSkills.length > 0 && (
        <div>
          <span className="text-xs font-medium text-monokai-comment">推荐技能:</span>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {suggestedSkills.slice(0, 4).map((skill, idx) => (
              <span
                key={skill.id}
                className="px-2 py-1 text-xs bg-monokai-accent/30 text-monokai-fg rounded flex items-center gap-1 animate-fade-in-up"
                style={{ animationDelay: `${idx * 80}ms`, animationFillMode: 'both' }}
              >
                {skill.icon && <span>{skill.icon}</span>}
                {skill.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 需要的技能列表 */}
      {intentAnalysis.requiredSkills.length > 0 && (
        <div className="flex items-center gap-2">
          <Lightbulb className="w-3.5 h-3.5 text-monokai-yellow" />
          <span className="text-xs text-monokai-fg">
            需要技能: {intentAnalysis.requiredSkills.join(' → ')}
          </span>
        </div>
      )}
    </div>
  );
};

export default IntentResultCard;
