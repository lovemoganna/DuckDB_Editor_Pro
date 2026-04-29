/**
 * SkillHelpPanel Component
 *
 * Displays module background, applicable scenarios, and common misuses.
 * Flat Monokai design — no glassmorphism, no shadows, 1px borders.
 * Optimized visual hierarchy with category accent colors.
 */

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
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

// ─── Color palette (monokai hex) ────────────────────────────────────────────
const C = {
  bg:      '#272822',
  surface: '#1e1e1c',
  sidebar: '#3e3d32',
  border:  '#3e3d32',
  fg:      '#f8f8f2',
  muted:   '#75715e',
  green:   '#a6e22e',
  blue:    '#66d9ef',
  purple:  '#ae81ff',
  pink:    '#f92672',
  yellow:  '#e6db74',
  orange:  '#fd971f',
};

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

  // 生成摘要信息
  const summaryText = [
    help.scenarios.length > 0 && `${help.scenarios.length} 适用场景`,
    help.commonErrors.length > 0 && `${help.commonErrors.length} 常见误用`,
    help.aiHints && help.aiHints.length > 0 && `${help.aiHints.length} AI 提示`,
  ].filter(Boolean).join(' · ');

  return (
    <div
      className={`border border-[#3e3d32] bg-[#1e1e1c] overflow-hidden ${className}`}
    >
      {/* Module Title & Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between transition-colors hover:bg-[#272822]/50 group"
        style={{ background: C.surface }}
      >
        <div className="flex items-center gap-3">
          {/* Category icon badge */}
          <div
            className="w-8 h-8 flex items-center justify-center flex-shrink-0 transition-all group-hover:scale-105"
            style={{ background: `${accent}15`, border: `1px solid ${accent}30` }}
          >
            <Icon className="w-4 h-4" style={{ color: accent }} />
          </div>
          <div className="text-left min-w-0">
            <h3 className="text-xs font-bold text-[#f8f8f2] uppercase tracking-widest font-mono truncate">
              {design.label} 模块背景
            </h3>
            {isExpanded ? (
              <p className="text-[10px] text-[#75715e] font-mono mt-0.5">
                Applicable Scenarios &amp; Best Practices
              </p>
            ) : (
              <p className="text-[10px] text-[#75715e] font-mono mt-0.5 truncate">
                {summaryText}
              </p>
            )}
          </div>
        </div>

        {/* Collapse indicator */}
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] uppercase font-mono transition-colors hidden sm:block"
            style={{ color: C.muted }}
          >
            {isExpanded ? 'COLLAPSE' : 'EXPAND'}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 transition-transform" style={{ color: accent }} />
          ) : (
            <ChevronDown className="w-4 h-4 transition-transform" style={{ color: C.muted }} />
          )}
        </div>
      </button>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="p-4 space-y-5 border-t border-[#3e3d32]">
          {/* Description */}
          {help.description && (
            <div
              className="pl-3 py-2 text-xs text-[#75715e] italic leading-relaxed"
              style={{ borderLeft: `3px solid ${accent}50` }}
            >
              {help.description}
            </div>
          )}

          {/* Scenarios + Misuses grid */}
          <div className="grid grid-cols-1 gap-5">
            {/* Scenarios */}
            <div className="space-y-3">
              <div
                className="flex items-center gap-2 px-3 py-2 text-[11px] font-bold uppercase font-mono tracking-wider"
                style={{ background: `${C.blue}10`, color: C.blue, borderLeft: `3px solid ${C.blue}` }}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>适用场景</span>
                <span className="ml-auto text-[10px] opacity-70">[{help.scenarios.length}]</span>
              </div>
              <ul className="space-y-2.5 pl-1">
                {help.scenarios.map((item, idx) => (
                  <li key={idx} className="flex gap-3 text-xs" style={{ color: C.fg }}>
                    <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: C.green }} />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Common Errors */}
            <div className="space-y-3">
              <div
                className="flex items-center gap-2 px-3 py-2 text-[11px] font-bold uppercase font-mono tracking-wider"
                style={{ background: `${C.pink}10`, color: C.pink, borderLeft: `3px solid ${C.pink}` }}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>常见误用点</span>
                <span className="ml-auto text-[10px] opacity-70">[{help.commonErrors.length}]</span>
              </div>
              <ul className="space-y-2.5 pl-1">
                {help.commonErrors.map((item, idx) => (
                  <li key={idx} className="flex gap-3 text-xs" style={{ color: C.muted }}>
                    <X className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: `${C.pink}99` }} />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* AI Hints */}
          {help.aiHints && help.aiHints.length > 0 && (
            <div
              className="p-4 space-y-3"
              style={{ background: C.bg, border: `1px solid ${C.border}` }}
            >
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4" style={{ color: C.yellow }} />
                <span className="text-[11px] font-bold text-[#f8f8f2] uppercase tracking-wider font-mono">
                  AI 协作与二次优化提示
                </span>
                <span className="ml-auto text-[10px] text-[#75715e]">[{help.aiHints.length}]</span>
              </div>
              <div className="grid grid-cols-1 gap-y-2">
                {help.aiHints.map((hint, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 py-2"
                    style={{ borderBottom: idx < help.aiHints.length - 1 ? `1px solid ${C.border}` : 'none' }}
                  >
                    <Lightbulb className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: C.yellow }} />
                    <span className="text-[11px] leading-relaxed" style={{ color: C.muted }}>{hint}</span>
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
