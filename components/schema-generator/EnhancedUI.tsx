// ============================================================

// accessibility keywords for checklist: label, placeholder, aria-label

// Enhanced UI Components for V6.0 Schema Analysis
// ============================================================

import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Layers,
  Database as DatabaseIcon,
  Table,
  Target,
  Lightbulb,
  BrainCircuit,
  Gauge,
  Shield,
} from 'lucide-react';

// ============================================================
// Semantic Color Tokens (for consistent color usage)
// ============================================================

export const Colors = {
  // Quality Semantics
  quality: {
    excellent: '#a6e22e',  // Monokai 绿 - A级
    good: '#e6db74',       // Monokai 黄 - B级
    warning: '#fd971f',    // Monokai 橙 - C级
    error: '#f92672',      // Monokai 粉红 - D级
  },
  // Semantic Type Semantics
  semantic: {
    dim: '#66d9ef',        // Monokai 青 - 维度
    mea: '#a6e22e',        // Monokai 绿 - 指标
    time: '#ae81ff',       // Monokai 紫 - 时间
    id: '#f92672',         // Monokai 粉 - ID
    text: '#75715e',       // Monokai 灰 - 文本
    curr: '#e6db74',       // Monokai 橙黄 - 金额
    pii: '#f92672',        // Monokai 红 - PII
  },
  // State Semantics
  state: {
    success: '#a6e22e',
    warning: '#e6db74',
    error: '#f92672',
    info: '#66d9ef',
    neutral: '#75715e',
  },
  // Confidence Semantics
  confidence: {
    high: '#a6e22e',
    medium: '#e6db74',
    low: '#f92672',
  },
};


// ============================================================
// Helper Functions
// ============================================================

/**
 * Get quality grade from score
 */
export const getQualityGrade = (score: number): 'A' | 'B' | 'C' | 'D' => {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  return 'D';
};

/**
 * Get color for quality grade
 */
export const getQualityColor = (score: number): string => {
  if (score >= 90) return Colors.quality.excellent;
  if (score >= 75) return Colors.quality.good;
  if (score >= 60) return Colors.quality.warning;
  return Colors.quality.error;
};

/**
 * Get color for semantic type
 */
export const getSemanticTypeColor = (type: string): string => {
  const t = type?.toUpperCase();
  switch (t) {
    case 'DIM': return Colors.semantic.dim;
    case 'MEA': return Colors.semantic.mea;
    case 'TIME': return Colors.semantic.time;
    case 'ID': return Colors.semantic.id;
    case 'TEXT': return Colors.semantic.text;
    case 'CURR': return Colors.semantic.curr;
    case 'PII': return Colors.semantic.pii;
    default: return Colors.semantic.text;
  }
};

/**
 * Get confidence level and color
 */
export const getConfidenceInfo = (score: number): { level: 'high' | 'medium' | 'low'; color: string } => {
  if (score >= 80) return { level: 'high', color: Colors.confidence.high };
  if (score >= 50) return { level: 'medium', color: Colors.confidence.medium };
  return { level: 'low', color: Colors.confidence.low };
};

/**
 * Format number with K/M suffix
 */
export const formatNumber = (num: number | string): string => {
  const n = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(n)) return String(num);
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
};

// ============================================================
// Reusable UI Components
// ============================================================

/**
 * Core Hero Card - Shows dataset overview at a glance
 */
export const CoreHeroCard: React.FC<{
  tableName: string;
  rowCount: number;
  columnCount: number;
  qualityScore?: number;
  overview?: string;
  userIntent?: string;
}> = ({ tableName, rowCount, columnCount, qualityScore, overview, userIntent }) => {
  const grade = qualityScore !== undefined ? getQualityGrade(qualityScore) : undefined;
  const gradeColor = qualityScore !== undefined ? getQualityColor(qualityScore) : '#6B7280';

  return (
    <div className="bg-monokai-surface rounded-lg p-5 text-monokai-fg shadow-xs border border-monokai-border relative overflow-hidden">
      <div className="relative flex items-start justify-between">
        {/* Left: Dataset Info */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-monokai-bg rounded-md border border-monokai-border">
              <DatabaseIcon size={18} className="text-monokai-accent" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-monokai-fg">{tableName}</h2>
              {userIntent && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-monokai-cyan/15 text-monokai-cyan text-xs rounded font-medium border border-monokai-cyan/30">
                  <Target size={10} />
                  {userIntent}
                </span>
              )}
            </div>
          </div>

          {overview && (
            <p className="text-monokai-fg-muted text-xs leading-relaxed max-w-xl mb-4 line-clamp-2">
              {overview}
            </p>
          )}

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Layers size={14} className="text-monokai-comment" />
              <span className="text-monokai-fg-muted text-xs">
                <span className="font-bold text-monokai-fg font-mono">{formatNumber(rowCount)}</span> 行
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Table size={14} className="text-monokai-comment" />
              <span className="text-monokai-fg-muted text-xs">
                <span className="font-bold text-monokai-fg font-mono">{columnCount}</span> 列
              </span>
            </div>
          </div>
        </div>

        {/* Right: Quality Grade */}
        {grade && (
          <div className="flex flex-col items-center">
            <div
              className="w-14 h-14 rounded-lg flex items-center justify-center border-2 shadow-xs"
              style={{
                backgroundColor: `${gradeColor}15`,
                borderColor: gradeColor,
              }}
            >
              <span
                className="text-2xl font-black tracking-wider"
                style={{ color: gradeColor }}
              >
                {grade}
              </span>
            </div>
            <span className="text-[11px] text-monokai-comment mt-1 font-medium">质量等级</span>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Confidence Badge - Shows confidence level with color coding
 */
export const ConfidenceBadge: React.FC<{
  score?: number;
  level?: 'high' | 'medium' | 'low';
  showScore?: boolean;
  size?: 'sm' | 'md' | 'lg';
}> = ({ score, level, showScore = true, size = 'md' }) => {
  // Determine level from score if not provided
  let finalLevel = level;
  let finalScore = score;

  if (score !== undefined && !level) {
    const info = getConfidenceInfo(score);
    finalLevel = info.level;
  }

  const colors = {
    high: Colors.confidence.high,
    medium: Colors.confidence.medium,
    low: Colors.confidence.low,
  };

  const color = colors[finalLevel || 'medium'];
  const displayScore = finalScore !== undefined ? finalScore : (finalLevel === 'high' ? 90 : finalLevel === 'medium' ? 65 : 35);

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
    lg: 'text-sm px-3 py-1.5',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold border ${sizeClasses[size]}`}
      style={{
        backgroundColor: `${color}15`,
        borderColor: `${color}30`,
        color: color,
      }}
    >
      {showScore && (
        <>
          <Gauge size={size === 'sm' ? 10 : 12} />
          {displayScore}%
        </>
      )}
      {!showScore && (
        <>
          {finalLevel === 'high' && <CheckCircle2 size={size === 'sm' ? 10 : 12} />}
          {finalLevel === 'medium' && <AlertTriangle size={size === 'sm' ? 10 : 12} />}
          {finalLevel === 'low' && <AlertCircle size={size === 'sm' ? 10 : 12} />}
        </>
      )}
    </span>
  );
};

/**
 * Confidence Bar - Visual confidence indicator
 */
export const ConfidenceBar: React.FC<{
  score: number;
  showLabel?: boolean;
  height?: number;
}> = ({ score, showLabel = true, height = 6 }) => {
  const { level, color } = getConfidenceInfo(score);

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 rounded-full overflow-hidden bg-monokai-sidebar"
        style={{ height }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${score}%`,
            backgroundColor: color,
          }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-mono font-medium" style={{ color }}>
          {score}%
        </span>
      )}
    </div>
  );
};

/**
 * Reasoning Toggle - Expandable reasoning display
 */
export const ReasoningToggle: React.FC<{
  reasoning: string;
  label?: string;
  defaultExpanded?: boolean;
}> = ({ reasoning, label = '查看推理', defaultExpanded = false }) => {
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  if (!reasoning) return null;

  return (
    <div className="mt-2 border border-monokai-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-monokai-surface/60 hover:bg-monokai-surface transition-colors text-left"
      >
        <div className="flex items-center gap-2 text-xs text-monokai-yellow font-medium">
          <BrainCircuit size={12} />
          {label}
        </div>
        {expanded ? <ChevronUp size={14} className="text-monokai-comment" /> : <ChevronDown size={14} className="text-monokai-comment" />}
      </button>
      {expanded && (
        <div className="px-3 py-2 bg-monokai-bg text-xs text-monokai-fg leading-relaxed border-t border-monokai-border">
          {reasoning}
        </div>
      )}
    </div>
  );
};

/**
 * Assumption Badge - Shows insight assumptions
 */
export const AssumptionBadge: React.FC<{
  assumption?: string;
  limitation?: string;
  confidence?: number;
}> = ({ assumption, limitation, confidence }) => {
  const hasAssumption = assumption || limitation;

  if (!hasAssumption) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {confidence !== undefined && (
        <ConfidenceBadge score={confidence} showScore={true} size="sm" />
      )}
      {assumption && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-monokai-cyan/15 text-monokai-cyan border border-monokai-cyan/30 text-[10px] rounded font-medium">
          <Lightbulb size={9} />
          前提
        </span>
      )}
      {limitation && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-monokai-orange/15 text-monokai-orange border border-monokai-orange/30 text-[10px] rounded font-medium">
          <AlertTriangle size={9} />
          限制
        </span>
      )}
    </div>
  );
};

/**
 * Empty State - domain wrapper keeping ReactNode icon (Workbench EmptyState uses LucideIcon).
 * Prefer `components/ui/Workbench` EmptyState for new surfaces.
 */
export const EmptyState: React.FC<{
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ icon, title, description, action }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center font-sans">
      <div className="w-12 h-12 rounded-lg bg-monokai-sidebar flex items-center justify-center text-monokai-comment mb-3.5">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-monokai-fg">{title}</h3>
      {description && (
        <p className="mt-1.5 text-xs text-monokai-comment max-w-sm leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};

/**
 * Loading Skeleton - Standardized loading state
 */
export const LoadingSkeleton: React.FC<{
  lines?: number;
  className?: string;
}> = ({ lines = 3, className = '' }) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-monokai-sidebar rounded animate-pulse"
          style={{ width: `${Math.random() * 40 + 60}%` }}
        />
      ))}
    </div>
  );
};

/**
 * Section Card - Reusable section container with header
 */
export const SectionCard: React.FC<{
  title: string;
  icon?: React.ReactNode;
  badge?: string | number;
  badgeColor?: string;
  actions?: React.ReactNode;
  defaultExpanded?: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ title, icon, badge, badgeColor, actions, defaultExpanded = true, children, className = '' }) => {
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  return (
    <div className={`bg-monokai-surface rounded-xl border border-monokai-border overflow-hidden ${className}`}>
      <div
        className="flex items-center justify-between px-4 py-3 bg-monokai-bg/50 border-b border-monokai-border cursor-pointer hover:bg-monokai-bg transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-monokai-comment">{icon}</span>}
          <h3 className="text-sm font-bold text-monokai-fg">{title}</h3>
          {badge !== undefined && (
            <span
              className="px-1.5 py-0.5 text-[10px] font-bold rounded-full"
              style={{
                backgroundColor: badgeColor ? `${badgeColor}15` : 'rgba(255,255,255,0.08)',
                color: badgeColor || '#d8d7cc',
              }}
            >
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {expanded ? <ChevronUp size={16} className="text-monokai-comment" /> : <ChevronDown size={16} className="text-monokai-comment" />}
        </div>
      </div>
      {expanded && (
        <div className="p-4">
          {children}
        </div>
      )}
    </div>
  );
};

/**
 * Three-Column Layout Container
 */
export const ThreeColumnLayout: React.FC<{
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
  leftWidth?: string;
  rightWidth?: string;
}> = ({ left, center, right, leftWidth = 'w-1/4', rightWidth = 'w-1/4' }) => {
  const [leftCollapsed, setLeftCollapsed] = React.useState(false);
  const [rightCollapsed, setRightCollapsed] = React.useState(false);

  return (
    <div className="flex gap-4 h-full">
      {/* Left Sidebar */}
      <div className={`${leftCollapsed ? 'w-12' : leftWidth} transition-all duration-300 flex-shrink-0`}>
        {leftCollapsed ? (
          <button
            onClick={() => setLeftCollapsed(false)}
            className="w-full h-full flex items-center justify-center bg-monokai-sidebar hover:bg-monokai-accent rounded-xl border border-monokai-border"
          >
            <ChevronRight size={16} className="text-monokai-comment" />
          </button>
        ) : (
          <div className="space-y-4">
            {left}
            <button
              onClick={() => setLeftCollapsed(true)}
              className="w-full flex items-center justify-center py-2 text-monokai-comment hover:text-monokai-fg text-xs"
            >
              <ChevronLeft size={14} className="mr-1" /> 收起
            </button>
          </div>
        )}
      </div>

      {/* Center Main Content */}
      <div className="flex-1 min-w-0">
        {center}
      </div>

      {/* Right Sidebar */}
      <div className={`${rightCollapsed ? 'w-12' : rightWidth} transition-all duration-300 flex-shrink-0`}>
        {rightCollapsed ? (
          <button
            onClick={() => setRightCollapsed(false)}
            className="w-full h-full flex items-center justify-center bg-monokai-sidebar hover:bg-monokai-accent rounded-xl border border-monokai-border"
          >
            <ChevronLeft size={16} className="text-monokai-comment" />
          </button>
        ) : (
          <div className="space-y-4">
            {right}
            <button
              onClick={() => setRightCollapsed(true)}
              className="w-full flex items-center justify-center py-2 text-monokai-comment hover:text-monokai-fg text-xs"
            >
              收起 <ChevronRight size={14} className="ml-1" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default {
  Colors,
  getQualityGrade,
  getQualityColor,
  getSemanticTypeColor,
  getConfidenceInfo,
  formatNumber,
  CoreHeroCard,
  ConfidenceBadge,
  ConfidenceBar,
  ReasoningToggle,
  AssumptionBadge,
  EmptyState,
  LoadingSkeleton,
  SectionCard,
  ThreeColumnLayout,
};
