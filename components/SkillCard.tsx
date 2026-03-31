/**
 * Skill Card Component
 *
 * Displays a skill item in the skill list.
 */

import React from 'react';
import {
  Lightbulb,
  FileCode,
  Database,
  BarChart3,
  ArrowRightLeft,
  Gauge,
  Wrench,
  Layers,
  Filter,
  Hash,
  Calculator,
  TrendingUp,
  Clock,
  Table,
  Wand2,
  Microscope,
  Trash2,
  Eye,
  Settings2,
  GitBranch,
  Calendar,
  Type,
  TrendingDown,
  FileText,
  Puzzle,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  CheckCircle,
} from 'lucide-react';
import { AISkill, SkillCategory } from '../types';

// Icon mapping based on skill category and patterns
const getCategoryIcon = (skill: AISkill): React.ReactNode => {
  const iconMap: Record<string, React.ElementType> = {
    'sql-select': FileCode,
    'sql-join': Layers,
    'sql-cte': GitBranch,
    'sql-insert': Database,
    'sql-update': Settings2,
    'sql-delete': Trash2,
    'sql-create-table': Table,
    'sql-alter-table': Settings2,
    'sql-drop-table': TrendingDown,
    'sql-view': Eye,
    'sql-index': Hash,
    'sql-table': Table,
    'analysis-time-series': TrendingUp,
    'analysis-comparison': BarChart3,
    'analysis-funnel': Filter,
    'analysis-retention': Clock,
    'transformation-pivot': Table,
    'transformation-unpivot': ArrowRightLeft,
    'transformation-type': Calculator,
    'transformation-string': Type,
    'transformation-date': Calendar,
    'optimization-explain': Microscope,
    'optimization-rewrite': Wand2,
    'optimization-index': Hash,
    'utility-test-data': Puzzle,
    'utility-sample': Filter,
    'utility-summarize': FileText,
  };

  // Try to match by skill ID
  for (const [key, Icon] of Object.entries(iconMap)) {
    if (skill.id.includes(key.replace('sql-', '').replace('analysis-', '').replace('transformation-', '').replace('optimization-', '').replace('utility-', ''))) {
      return <Icon className="w-5 h-5" />;
    }
  }

  // Fallback to category-based icons
  const categoryIcons: Record<SkillCategory, React.ElementType> = {
    sql: FileCode,
    analysis: BarChart3,
    transformation: ArrowRightLeft,
    optimization: Gauge,
    utility: Wrench,
  };

  const Icon = categoryIcons[skill.category] || Lightbulb;
  return <Icon className="w-5 h-5" />;
};

// Category color mapping - following Monokai design system
const getCategoryColors = (category: SkillCategory) => {
  const colors: Record<SkillCategory, { bg: string; text: string; border: string; gradient: string }> = {
    sql: {
      bg: 'bg-monokai-blue/20',
      text: 'text-monokai-blue',
      border: 'border-monokai-blue/30',
      gradient: 'from-monokai-blue/20 to-monokai-accent/20'
    },
    analysis: {
      bg: 'bg-monokai-green/20',
      text: 'text-monokai-green',
      border: 'border-monokai-green/30',
      gradient: 'from-monokai-green/20 to-monokai-green/20'
    },
    transformation: {
      bg: 'bg-monokai-purple/20',
      text: 'text-monokai-purple',
      border: 'border-monokai-purple/30',
      gradient: 'from-monokai-purple/20 to-monokai-pink/20'
    },
    optimization: {
      bg: 'bg-monokai-orange/20',
      text: 'text-monokai-orange',
      border: 'border-monokai-orange/30',
      gradient: 'from-monokai-orange/20 to-monokai-yellow/20'
    },
    utility: {
      bg: 'bg-monokai-comment/20',
      text: 'text-monokai-comment',
      border: 'border-monokai-comment/30',
      gradient: 'from-monokai-comment/20 to-monokai-fg/20'
    },
  };
  return colors[category] || colors.utility;
};

interface SkillCardProps {
  skill: AISkill;
  isSelected: boolean;
  onClick: () => void;
  currentTable?: string;
  validationStatus?: 'valid' | 'invalid' | 'untested' | 'testing';
}

export const SkillCard: React.FC<SkillCardProps> = ({ 
  skill, 
  isSelected, 
  onClick, 
  currentTable,
  validationStatus = 'untested'
}) => {
  const categoryColors = getCategoryColors(skill.category);
  const hasExamples = skill.examples && skill.examples.length > 0;
  
  // Check if skill can work with current context
  const isReadyToUse = !skill.requiresTable || (skill.requiresTable && currentTable);

  // Validation badge config
  const validationBadge = {
    valid: { icon: CheckCircle, color: 'text-monokai-green', bg: 'bg-monokai-green/20', label: '已验证' },
    invalid: { icon: AlertTriangle, color: 'text-monokai-red', bg: 'bg-monokai-red/20', label: '有问题' },
    testing: { icon: ShieldCheck, color: 'text-monokai-yellow', bg: 'bg-monokai-yellow/20', label: '验证中' },
    untested: { icon: HelpCircle, color: 'text-monokai-comment', bg: 'bg-monokai-comment/20', label: '待验证' },
  };
  const badge = validationBadge[validationStatus];
  const BadgeIcon = badge.icon;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-2.5 rounded-lg transition-all duration-200 group relative overflow-hidden ${
        isSelected
          ? `bg-gradient-to-r ${categoryColors.gradient} border-2 ${categoryColors.border}`
          : 'bg-monokai-bg border-2 border-transparent hover:border-monokai-accent/50 hover:bg-monokai-sidebar'
      }`}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${categoryColors.bg}`} />
      )}

      <div className="flex items-start gap-2.5 pl-1">
        {/* Icon */}
        <div className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105 ${
          isSelected
            ? `${categoryColors.bg} ${categoryColors.text}`
            : 'bg-monokai-sidebar text-monokai-comment'
        }`}>
          {getCategoryIcon(skill)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={`text-sm font-medium truncate transition-colors ${
              isSelected
                ? `${categoryColors.text}`
                : 'text-monokai-fg group-hover:text-monokai-purple'
            }`}>
              {skill.name}
            </h3>
            {/* Example count badge */}
            {hasExamples && (
              <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] bg-monokai-purple/20 text-monokai-purple rounded-full">
                {skill.examples?.length}
              </span>
            )}
            {/* Validation status badge */}
            <span 
              className={`flex-shrink-0 px-1.5 py-0.5 text-[10px] ${badge.bg} ${badge.color} rounded-full flex items-center gap-0.5`}
              title={badge.label}
            >
              <BadgeIcon className="w-2.5 h-2.5" />
            </span>
            {/* Context ready indicator */}
            {isReadyToUse && (
              <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-monokai-green" title="可立即使用" />
            )}
          </div>
          <p className={`text-xs mt-0.5 line-clamp-2 ${
            isSelected
              ? 'text-monokai-comment'
              : 'text-monokai-comment'
          }`}>
            {skill.description}
          </p>
          
          {/* Quick hint when selected */}
          {isSelected && skill.inputSchema.length > 0 && (
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] text-monokai-comment">
                {skill.inputSchema.length} 个输入项
              </span>
              {skill.inputSchema.some(f => f.required) && (
                <span className="text-[10px] text-monokai-pink">
                  {skill.inputSchema.filter(f => f.required).length} 必填
                </span>
              )}
            </div>
          )}
        </div>

        {/* Arrow indicator */}
        <div className={`flex-shrink-0 transition-all duration-200 ${
          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}>
          <svg className={`w-3.5 h-3.5 ${categoryColors.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </button>
  );
};

export default SkillCard;
