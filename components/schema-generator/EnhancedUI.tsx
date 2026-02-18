// ============================================================
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
} from 'lucide-react';

// ============================================================
// Semantic Color Tokens (for consistent color usage)
// ============================================================

export const Colors = {
  // Quality Semantics
  quality: {
    excellent: '#10B981',  // 绿 - A级
    good: '#F59E0B',       // 黄 - B级
    warning: '#F97316',   // 橙 - C级
    error: '#EF4444',      // 红 - D级
  },
  // Semantic Type Semantics
  semantic: {
    dim: '#3B82F6',       // 蓝 - 维度
    mea: '#10B981',        // 绿 - 指标
    time: '#8B5CF6',       // 紫 - 时间
    id: '#EC4899',         // 粉 - ID
    text: '#6B7280',       // 灰 - 文本
    curr: '#F59E0B',       // 橙 - 金额
    pii: '#EF4444',        // 红 - PII
  },
  // State Semantics
  state: {
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
    neutral: '#6B7280',
  },
  // Confidence Semantics
  confidence: {
    high: '#10B981',
    medium: '#F59E0B',
    low: '#EF4444',
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
    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-2xl border border-slate-700/50 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-500/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-purple-500/10 to-transparent rounded-full translate-y-1/2 -translate-x-1/2" />

      <div className="relative flex items-start justify-between">
        {/* Left: Dataset Info */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
              <DatabaseIcon size={20} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">{tableName}</h2>
              {userIntent && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded-full font-medium">
                  <Target size={10} />
                  {userIntent}
                </span>
              )}
            </div>
          </div>

          {overview && (
            <p className="text-slate-400 text-sm leading-relaxed max-w-xl mb-4 line-clamp-2">
              {overview}
            </p>
          )}

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Layers size={14} className="text-slate-500" />
              <span className="text-slate-300 text-sm">
                <span className="font-bold text-white">{formatNumber(rowCount)}</span> 行
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Table size={14} className="text-slate-500" />
              <span className="text-slate-300 text-sm">
                <span className="font-bold text-white">{columnCount}</span> 列
              </span>
            </div>
          </div>
        </div>

        {/* Right: Quality Grade */}
        {grade && (
          <div className="flex flex-col items-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center border-4 shadow-2xl"
              style={{
                backgroundColor: `${gradeColor}15`,
                borderColor: gradeColor,
              }}
            >
              <span
                className="text-3xl font-black tracking-wider"
                style={{ color: gradeColor }}
              >
                {grade}
              </span>
            </div>
            <span className="text-xs text-slate-500 mt-1 font-medium">质量等级</span>
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
        className="flex-1 rounded-full overflow-hidden bg-gray-100"
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
    <div className="mt-2 border border-amber-200/30 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-amber-50/50 hover:bg-amber-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2 text-xs text-amber-700 font-medium">
          <BrainCircuit size={12} />
          {label}
        </div>
        {expanded ? <ChevronUp size={14} className="text-amber-500" /> : <ChevronDown size={14} className="text-amber-500" />}
      </button>
      {expanded && (
        <div className="px-3 py-2 bg-white text-xs text-slate-600 leading-relaxed border-t border-amber-200/30">
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
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] rounded font-medium">
          <Lightbulb size={9} />
          前提
        </span>
      )}
      {limitation && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-50 text-orange-600 text-[10px] rounded font-medium">
          <AlertTriangle size={9} />
          限制
        </span>
      )}
    </div>
  );
};

/**
 * Empty State - Standardized empty state display
 */
export const EmptyState: React.FC<{
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ icon, title, description, action }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-4">
        {icon}
      </div>
      <h3 className="text-sm font-bold text-gray-700 mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-gray-500 mb-4 max-w-sm">{description}</p>
      )}
      {action}
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
          className="h-4 bg-gray-200 rounded animate-pulse"
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
    <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${className}`}>
      <div
        className="flex items-center justify-between px-4 py-3 bg-gray-50/50 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-gray-500">{icon}</span>}
          <h3 className="text-sm font-bold text-gray-800">{title}</h3>
          {badge !== undefined && (
            <span
              className="px-1.5 py-0.5 text-[10px] font-bold rounded-full"
              style={{
                backgroundColor: badgeColor ? `${badgeColor}15` : '#F3F4F6',
                color: badgeColor || '#6B7280',
              }}
            >
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
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
            className="w-full h-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-xl border border-gray-200"
          >
            <ChevronRight size={16} className="text-gray-500" />
          </button>
        ) : (
          <div className="space-y-4">
            {left}
            <button
              onClick={() => setLeftCollapsed(true)}
              className="w-full flex items-center justify-center py-2 text-gray-400 hover:text-gray-600 text-xs"
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
            className="w-full h-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-xl border border-gray-200"
          >
            <ChevronLeft size={16} className="text-gray-500" />
          </button>
        ) : (
          <div className="space-y-4">
            {right}
            <button
              onClick={() => setRightCollapsed(true)}
              className="w-full flex items-center justify-center py-2 text-gray-400 hover:text-gray-600 text-xs"
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
