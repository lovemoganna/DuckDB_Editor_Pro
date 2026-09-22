/**
 * SkillHelpPanel Component
 *
 * Displays module background, applicable scenarios, and common misuses.
 * Flat Monokai design — monokai-* tokens only.
 */

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  Zap,
  X,
  Lightbulb,
} from 'lucide-react';
import { SkillCategory } from '../../types';
import { CATEGORY_HELP } from '../constants/skills';
import { CATEGORY_DESIGN } from '../theme/ai-skills';

interface SkillHelpPanelProps {
  category: SkillCategory;
  className?: string;
}

export const SkillHelpPanel: React.FC<SkillHelpPanelProps> = ({
  category,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const help = CATEGORY_HELP[category];
  const design = CATEGORY_DESIGN[category];
  const Icon = design.icon;
  const accent = design.colors.primary;

  if (!help) return null;

  const summaryText = [
    help.scenarios.length > 0 && `${help.scenarios.length} 适用场景`,
    help.commonErrors.length > 0 && `${help.commonErrors.length} 常见误用`,
    help.aiHints && help.aiHints.length > 0 && `${help.aiHints.length} AI 提示`,
  ].filter(Boolean).join(' · ');

  return (
    <div className={`border border-monokai-border bg-monokai-bg overflow-hidden ${className}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between transition-colors bg-monokai-bg hover:bg-monokai-surface/50 group"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 flex items-center justify-center flex-shrink-0 transition-all group-hover:scale-105"
            style={{ background: `${accent}15`, border: `1px solid ${accent}30` }}
          >
            <Icon className="w-4 h-4" style={{ color: accent }} />
          </div>
          <div className="text-left min-w-0">
            <h3 className="text-xs font-bold text-monokai-fg uppercase tracking-widest font-mono truncate">
              {design.label} 模块背景
            </h3>
            {isExpanded ? (
              <p className="text-[10px] text-monokai-comment font-mono mt-0.5">
                Applicable Scenarios &amp; Best Practices
              </p>
            ) : (
              <p className="text-[10px] text-monokai-comment font-mono mt-0.5 truncate">
                {summaryText}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-mono text-monokai-comment transition-colors hidden sm:block">
            {isExpanded ? 'COLLAPSE' : 'EXPAND'}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 transition-transform" style={{ color: accent }} />
          ) : (
            <ChevronDown className="w-4 h-4 text-monokai-comment transition-transform" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="p-4 space-y-5 border-t border-monokai-border">
          {help.description && (
            <div
              className="pl-3 py-2 text-xs text-monokai-comment italic leading-relaxed"
              style={{ borderLeft: `3px solid ${accent}50` }}
            >
              {help.description}
            </div>
          )}

          <div className="grid grid-cols-1 gap-5">
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-3 py-2 text-[11px] font-bold uppercase font-mono tracking-wider bg-monokai-cyan/10 text-monokai-cyan border-l-[3px] border-monokai-cyan">
                <BookOpen className="w-3.5 h-3.5" />
                <span>适用场景</span>
                <span className="ml-auto text-[10px] opacity-70">[{help.scenarios.length}]</span>
              </div>
              <ul className="space-y-2.5 pl-1">
                {help.scenarios.map((item, idx) => (
                  <li key={idx} className="flex gap-3 text-xs text-monokai-fg">
                    <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-monokai-green" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 px-3 py-2 text-[11px] font-bold uppercase font-mono tracking-wider bg-monokai-pink/10 text-monokai-pink border-l-[3px] border-monokai-pink">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>常见误用点</span>
                <span className="ml-auto text-[10px] opacity-70">[{help.commonErrors.length}]</span>
              </div>
              <ul className="space-y-2.5 pl-1">
                {help.commonErrors.map((item, idx) => (
                  <li key={idx} className="flex gap-3 text-xs text-monokai-comment">
                    <X className="w-3.5 h-3.5 mt-0.5 shrink-0 text-monokai-pink/60" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {help.aiHints && help.aiHints.length > 0 && (
            <div className="p-4 space-y-3 bg-monokai-surface border border-monokai-border">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-monokai-yellow" />
                <span className="text-[11px] font-bold text-monokai-fg uppercase tracking-wider font-mono">
                  AI 协作与二次优化提示
                </span>
                <span className="ml-auto text-[10px] text-monokai-comment">[{help.aiHints.length}]</span>
              </div>
              <div className="grid grid-cols-1 gap-y-2">
                {help.aiHints.map((hint, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 py-2 ${
                      idx < help.aiHints.length - 1 ? 'border-b border-monokai-border' : ''
                    }`}
                  >
                    <Lightbulb className="w-3.5 h-3.5 mt-0.5 shrink-0 text-monokai-yellow" />
                    <span className="text-[11px] leading-relaxed text-monokai-comment">{hint}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SkillHelpPanel;
