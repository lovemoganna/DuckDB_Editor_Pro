import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  Zap, 
  CheckCircle, 
  AlertTriangle, 
  Layers, 
  Activity, 
  GitBranch, 
  HelpCircle,
  Sparkles,
  BookMarked,
  RotateCcw,
  Check,
  Clock,
  ArrowRight,
  FileCheck,
  Compass,
  Eye,
  Brain,
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  Star,
  Copy,
  RefreshCw,
  PlusCircle,
  GraduationCap,
  Sparkle
} from 'lucide-react';
import { useOntologyStore, OntologyStoreState } from '../../hooks/useOntologyStore';
import { useConfirmDialog } from '../ui/ConfirmDialog';
import { ToastNotification } from '../ui/ToastNotification';
import { DEFAULT_PATTERNS, ONTOLOGY_STAGES, WikiNodeRaw } from './defaultPatterns';
import { ActionButton, IconButton, Badge } from '../ui/Workbench';

interface PatternLibraryPanelProps {
  state: OntologyStoreState;
  activeTemplateId: string;
  switchTemplate: (templateId: string) => Promise<void>;
  onTablesReady?: () => void;
}

export type LearningStatusFilter = 'all' | 'todo' | 'completed';

// ============================================================
// Stage Theme & Semantic Color System (阶段语义色彩编码)
// ============================================================
export const STAGE_THEMES: Record<string, {
  border: string;
  badgeBg: string;
  badgeText: string;
  indicator: string;
  glow: string;
}> = {
  phase1: {
    border: 'border-sky-500/30 hover:border-sky-500/60',
    badgeBg: 'bg-sky-500/15 border-sky-500/35',
    badgeText: 'text-sky-400',
    indicator: 'bg-sky-400',
    glow: 'ring-sky-500/30',
  },
  phase2: {
    border: 'border-emerald-500/30 hover:border-emerald-500/60',
    badgeBg: 'bg-emerald-500/15 border-emerald-500/35',
    badgeText: 'text-emerald-400',
    indicator: 'bg-emerald-400',
    glow: 'ring-emerald-500/30',
  },
  phase3: {
    border: 'border-amber-500/30 hover:border-amber-500/60',
    badgeBg: 'bg-amber-500/15 border-amber-500/35',
    badgeText: 'text-amber-400',
    indicator: 'bg-amber-400',
    glow: 'ring-amber-500/30',
  },
  phase4: {
    border: 'border-purple-500/30 hover:border-purple-500/60',
    badgeBg: 'bg-purple-500/15 border-purple-500/35',
    badgeText: 'text-purple-400',
    indicator: 'bg-purple-400',
    glow: 'ring-purple-500/30',
  },
};

// ============================================================
// Icon Mapper Utility
// ============================================================
const ICON_MAP: Record<string, React.ElementType> = {
  BookOpen, Sparkles, Activity, GitBranch, Layers, Clock,
  BookMarked, HelpCircle, Zap, CheckCircle, AlertTriangle, FileCheck
};

const getLessonIcon = (iconName: string) => ICON_MAP[iconName] || BookOpen;

// ============================================================
// Lesson Card Component (结构化教学卡片 - 物理隔离与 4 象限详情)
// ============================================================
interface LessonCardProps {
  pattern: WikiNodeRaw;
  isActive: boolean;
  isLoading: boolean;
  isCompleted: boolean;
  isFocused: boolean;
  onSelect: () => void;
  onMerge?: () => void;
  onToggleComplete: () => void;
}

const LessonCard: React.FC<LessonCardProps> = ({
  pattern,
  isActive,
  isLoading,
  isCompleted,
  isFocused,
  onSelect,
  onMerge,
  onToggleComplete,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const IconComponent = getLessonIcon(pattern.iconName);
  const theme = STAGE_THEMES[pattern.stageId] || STAGE_THEMES.phase1;

  const handleCopyStory = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(pattern.caseBackground);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = pattern.caseBackground;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      data-testid={`lesson-card-${pattern.id}`}
      tabIndex={0}
      className={`
        rounded-xl border transition-all duration-200 overflow-hidden select-none outline-none
        ${isFocused ? 'ring-2 ring-monokai-cyan shadow-lg' : ''}
        ${isActive 
          ? 'border-monokai-cyan bg-monokai-surface ring-1 ring-monokai-cyan/40 shadow-sm' 
          : `${theme.border} bg-monokai-surface/60 hover:bg-monokai-surface`
        }
      `}
    >
      {/* ── Card Header (点击只触发展开/折叠，绝不误触载入) ── */}
      <div 
        className="flex items-center justify-between p-3 gap-2.5 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded(!expanded)}
        title="点击展开/收起课程详情"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* Completion Checkbox / Star Toggle */}
          <button
            type="button"
            title={isCompleted ? '标记为待学习' : '标记为已掌握'}
            onClick={(e) => {
              e.stopPropagation();
              onToggleComplete();
            }}
            className={`
              w-5 h-5 rounded flex items-center justify-center transition-all cursor-pointer shrink-0
              ${isCompleted 
                ? 'bg-monokai-green text-monokai-bg hover:brightness-110 shadow-xs' 
                : 'border border-monokai-comment/40 text-transparent hover:border-monokai-green/70 hover:text-monokai-green/50'
              }
            `}
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </button>

          {/* Stage & Lesson Number Badge */}
          <span className={`
            px-2 py-0.5 rounded text-xs font-mono font-bold shrink-0 border
            ${isActive 
              ? 'bg-monokai-cyan text-monokai-bg border-monokai-cyan' 
              : `${theme.badgeBg} ${theme.badgeText}`
            }
          `}>
            {pattern.lessonNum}
          </span>
          
          {/* Icon + Title + Complexity Pill */}
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <IconComponent className={`
                w-3.5 h-3.5 shrink-0 
                ${isActive ? 'text-monokai-cyan' : theme.badgeText}
              `} />
              <h3 className={`
                text-xs font-bold truncate
                ${isActive ? 'text-monokai-cyan' : isCompleted ? 'text-monokai-fg/70 line-through decoration-monokai-comment' : 'text-monokai-fg'}
              `}>
                {pattern.title.replace(/第 \d+ 课：/, '')}
              </h3>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-monokai-comment flex-wrap">
              <span>{pattern.nodeCount} 实体 · {pattern.linkCount} 关系</span>
              {pattern.coreConcept && (
                <>
                  <span>•</span>
                  <span className="font-mono text-monokai-cyan/90 truncate">{pattern.coreConcept}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls (严格物理隔离，自带 stopPropagation) */}
        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Main Load / Reload Button */}
          <button
            type="button"
            onClick={onSelect}
            disabled={isLoading}
            title={isActive ? '图谱当前已载入本课，点击可重置回原始状态' : '载入本课模型到知识图谱'}
            className={`
              flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer shrink-0
              ${isActive 
                ? 'bg-monokai-cyan/15 text-monokai-cyan border border-monokai-cyan/40 hover:bg-monokai-cyan/25' 
                : 'bg-monokai-cyan text-monokai-bg hover:bg-monokai-cyan/90 shadow-xs active:scale-95'
              }
              ${isLoading ? 'opacity-60 cursor-wait' : ''}
            `}
          >
            {isLoading ? (
              <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : isActive ? (
              <><RefreshCw className="w-3 h-3" /> 重置</>
            ) : (
              <><ArrowRight className="w-3 h-3" /> 载入</>
            )}
          </button>

          {/* Expand / Collapse Chevron */}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? '收起详情' : '展开详情'}
            className="p-1 rounded-lg text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/80 transition-all cursor-pointer"
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ── Expanded Content: MECE 4-Quadrant Instructional Details ── */}
      {expanded && (
        <div className="border-t border-monokai-border/60 p-3.5 space-y-3 bg-monokai-sidebar/30">
          {/* Brief Description */}
          <p className="text-xs text-monokai-fg/90 leading-relaxed font-medium">
            {pattern.brief}
          </p>

          {/* Q1: Case Background Story with One-Click Copy */}
          <div className="p-2.5 rounded-lg bg-monokai-yellow/8 border border-monokai-yellow/25 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-monokai-yellow">
                <BookOpen className="w-3.5 h-3.5" />
                <span>① 原文案例材料故事</span>
              </div>
              <button
                type="button"
                onClick={handleCopyStory}
                title="复制案例素材文本"
                className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-monokai-yellow/15 hover:bg-monokai-yellow/30 text-monokai-yellow transition-all cursor-pointer"
              >
                {copied ? (
                  <><Check className="w-3 h-3 text-monokai-green" /> 已复制材料</>
                ) : (
                  <><Copy className="w-3 h-3" /> 复制材料</>
                )}
              </button>
            </div>
            <p className="text-xs text-monokai-fg leading-relaxed bg-black/20 p-2 rounded border border-white/5 whitespace-pre-wrap font-sans">
              {pattern.caseBackground}
            </p>
          </div>

          {/* Q2: Mind Action */}
          <div className="p-2.5 rounded-lg bg-monokai-surface/90 border border-monokai-border/60">
            <div className="flex items-start gap-2">
              <Brain className="w-3.5 h-3.5 text-monokai-pink shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-monokai-pink">② 核心心智训练动作</span>
                <p className="text-xs text-monokai-fg mt-1 leading-relaxed">{pattern.mindAction}</p>
              </div>
            </div>
          </div>

          {/* Q3: Graph Focus */}
          <div className="p-2.5 rounded-lg bg-monokai-surface/90 border border-monokai-border/60">
            <div className="flex items-start gap-2">
              <Eye className="w-3.5 h-3.5 text-monokai-cyan shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-monokai-cyan">③ 图谱视觉看点</span>
                <p className="text-xs text-monokai-comment mt-1 leading-relaxed">{pattern.graphFocus}</p>
              </div>
            </div>
          </div>

          {/* Q4: Core Nodes & Schema */}
          <div className="p-2.5 rounded-lg bg-monokai-surface/90 border border-monokai-border/60">
            <div className="flex items-start gap-2">
              <Layers className="w-3.5 h-3.5 text-monokai-green shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-monokai-green">④ 核心实体与概念</span>
                  <span className="text-[10px] text-monokai-comment">点击高亮图谱</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {pattern.coreNodes.map((node, i) => (
                    <button 
                      key={i}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if ((window as any).__d3FocusNode) {
                          (window as any).__d3FocusNode(node, 'name');
                        }
                      }}
                      title={`在知识图谱画布中聚焦「${node}」`}
                      className="px-2 py-0.5 rounded text-[11px] bg-monokai-bg text-monokai-fg border border-monokai-border font-mono hover:border-monokai-cyan hover:text-monokai-cyan transition-colors cursor-pointer active:scale-95"
                    >
                      {node}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Expanded Bottom Action Toolbar */}
          <div className="pt-2 flex items-center justify-between gap-2 border-t border-monokai-border/40">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onSelect}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-monokai-cyan text-monokai-bg hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                {isActive ? <RefreshCw className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                <span>{isActive ? '重新重置本课图谱' : '覆盖载入到图谱'}</span>
              </button>

              {onMerge && (
                <button
                  type="button"
                  onClick={onMerge}
                  disabled={isLoading}
                  title="保留当前画布实体，将本课模型增量合并进来"
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-monokai-surface border border-monokai-border text-monokai-fg hover:border-monokai-cyan/60 hover:text-monokai-cyan transition-all cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>追加合并</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onToggleComplete}
              className={`
                flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer
                ${isCompleted
                  ? 'border-monokai-green/40 text-monokai-green bg-monokai-green/10 hover:bg-monokai-green/20'
                  : 'border-monokai-border text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface'
                }
              `}
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isCompleted ? '已掌握' : '标记已掌握'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// Learning Progress Header Component (MECE: 学习追踪与路线进度)
// ============================================================
interface LearningProgressHeaderProps {
  completedCount: number;
  totalCount: number;
  onResetProgress: () => void;
  onResetDefaultGraph: () => void;
  isResetting: boolean;
}

const LearningProgressHeader: React.FC<LearningProgressHeaderProps> = ({
  completedCount,
  totalCount,
  onResetProgress,
  onResetDefaultGraph,
  isResetting
}) => {
  const percentage = Math.round((completedCount / (totalCount || 1)) * 100);

  return (
    <div className="space-y-2.5">
      {/* Title Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-monokai-cyan/15 border border-monokai-cyan/35 text-monokai-cyan">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-monokai-fg flex items-center gap-1.5">
              <span>本体建模实战路线</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-monokai-cyan/15 text-monokai-cyan font-mono border border-monokai-cyan/30">
                14 课
              </span>
            </h2>
            <p className="text-[10px] text-monokai-comment">Palantir 风格核心方法论</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <IconButton
            icon={RotateCcw}
            label="还原初始默认图谱"
            size="sm"
            tone="warning"
            disabled={isResetting}
            onClick={onResetDefaultGraph}
          />
        </div>
      </div>

      {/* Progress Bar & Completion Stats */}
      <div className="p-2.5 rounded-lg bg-monokai-surface/60 border border-monokai-border/50 space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-monokai-comment flex items-center gap-1 font-medium">
            <GraduationCap className="w-3.5 h-3.5 text-monokai-green" />
            <span>掌握进度:</span>
            <strong className="text-monokai-fg font-bold">{completedCount}</strong>
            <span>/ {totalCount} 课</span>
          </span>
          <span className="font-mono font-bold text-monokai-green">{percentage}%</span>
        </div>
        <div className="w-full h-1.5 bg-monokai-bg rounded-full overflow-hidden border border-white/5">
          <div 
            className="h-full bg-gradient-to-r from-sky-400 via-emerald-400 to-green-400 transition-all duration-300 rounded-full"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
};

// ============================================================
// Quick Stats Bar Component
// ============================================================
interface QuickStatsProps {
  state: OntologyStoreState;
}

const QuickStats: React.FC<QuickStatsProps> = ({ state }) => {
  const stats = [
    { label: '画布实体', value: state.objects?.length ?? 0, color: 'cyan' },
    { label: '关系连线', value: state.links?.length ?? 0, color: 'green' },
    { label: '概念模式', value: (state.objectTypes?.length ?? 0) + (state.linkTypes?.length ?? 0), color: 'yellow' },
  ];

  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-monokai-surface/40 rounded-lg border border-monokai-border/30 text-xs">
      <span className="text-[10px] text-monokai-comment">当前图谱:</span>
      <div className="flex items-center gap-2.5">
        {stats.map((stat, idx) => (
          <React.Fragment key={stat.label}>
            {idx > 0 && <div className="w-px h-2.5 bg-monokai-border" />}
            <div className="flex items-center gap-1 text-[11px]">
              <span className="text-monokai-comment">{stat.label}</span>
              <span className={`font-mono font-bold ${
                stat.color === 'cyan' ? 'text-monokai-cyan' : stat.color === 'green' ? 'text-monokai-green' : 'text-monokai-yellow'
              }`}>
                {stat.value}
              </span>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

// ============================================================
// Stage Filter Component (阶段多维筛选)
// ============================================================
interface StageFilterProps {
  selected: string;
  onSelect: (id: string) => void;
  patternCount: Record<string, number>;
}

const StageFilter: React.FC<StageFilterProps> = ({ selected, onSelect, patternCount }) => {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar scrollbar-thin">
      <button
        type="button"
        onClick={() => onSelect('all')}
        className={`
          px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0
          ${selected === 'all'
            ? 'bg-monokai-cyan text-monokai-bg shadow-sm font-bold ring-1 ring-monokai-cyan/40'
            : 'bg-monokai-surface text-monokai-comment hover:text-monokai-fg border border-monokai-border hover:bg-monokai-surface/80'
          }
        `}
      >
        全部 ({Object.values(patternCount).reduce((a, b) => a + b, 0)})
      </button>
      {ONTOLOGY_STAGES.map(stage => {
        const count = patternCount[stage.id] || 0;
        const isSelected = selected === stage.id;
        const theme = STAGE_THEMES[stage.id] || STAGE_THEMES.phase1;

        return (
          <button
            key={stage.id}
            type="button"
            onClick={() => onSelect(stage.id)}
            title={stage.desc}
            className={`
              px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 border
              ${isSelected
                ? `${theme.badgeBg} ${theme.badgeText} ring-1 ${theme.glow} font-bold`
                : 'bg-monokai-surface text-monokai-comment hover:text-monokai-fg border-monokai-border hover:bg-monokai-surface/80'
              }
            `}
          >
            {stage.badge} ({count})
          </button>
        );
      })}
    </div>
  );
};

// ============================================================
// Main PatternLibraryPanel Component
// ============================================================
export const PatternLibraryPanel: React.FC<PatternLibraryPanelProps> = ({
  state,
  activeTemplateId,
  switchTemplate,
  onTablesReady
}) => {
  const { confirm } = useConfirmDialog();
  const { mergeOntologyTemplate } = useOntologyStore();

  // State
  const [toast, setToast] = useState<{ show: boolean; msg: string; success: boolean }>({ 
    show: false, msg: '', success: true 
  });
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<LearningStatusFilter>('all');
  const [sortBy, setSortBy] = useState<'order' | 'nodes' | 'links'>('order');
  const [searchQuery, setSearchQuery] = useState('');
  const [keyboardIndex, setKeyboardIndex] = useState<number>(-1);

  // LocalStorage-backed completion state
  const [completedLessons, setCompletedLessons] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('duckdb_ontology_completed_lessons');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleComplete = useCallback((id: string) => {
    setCompletedLessons(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      try {
        localStorage.setItem('duckdb_ontology_completed_lessons', JSON.stringify(next));
      } catch (err) {
        console.warn('Failed to save completed lessons to localStorage', err);
      }
      return next;
    });
  }, []);

  const handleResetProgress = useCallback(async () => {
    const ok = await confirm({
      title: '重置学习进度',
      message: '确定要清空全部 14 门课程的已掌握记录吗？',
      variant: 'warning',
      confirmText: '确认重置',
    });
    if (!ok) return;
    setCompletedLessons([]);
    try {
      localStorage.removeItem('duckdb_ontology_completed_lessons');
    } catch {}
  }, [confirm]);

  // Count patterns per stage
  const patternCount = useMemo(() => {
    const counts: Record<string, number> = {};
    DEFAULT_PATTERNS.forEach(p => {
      counts[p.stageId] = (counts[p.stageId] || 0) + 1;
    });
    return counts;
  }, []);

  // Filtered patterns
  const filteredPatterns = useMemo(() => {
    let patterns = DEFAULT_PATTERNS;

    // Stage filter
    if (selectedStage !== 'all') {
      patterns = patterns.filter(p => p.stageId === selectedStage);
    }

    // Status filter
    if (statusFilter === 'completed') {
      patterns = patterns.filter(p => completedLessons.includes(p.id));
    } else if (statusFilter === 'todo') {
      patterns = patterns.filter(p => !completedLessons.includes(p.id));
    }

    // Full text search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      patterns = patterns.filter(p => 
        p.lessonNum.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        p.brief.toLowerCase().includes(q) ||
        p.mindAction.toLowerCase().includes(q) ||
        p.caseBackground.toLowerCase().includes(q) ||
        p.coreNodes.some(n => n.toLowerCase().includes(q)) ||
        (p.coreConcept && p.coreConcept.toLowerCase().includes(q))
      );
    }
    
    // Sorting
    if (sortBy === 'nodes') {
      patterns = [...patterns].sort((a, b) => b.nodeCount - a.nodeCount);
    } else if (sortBy === 'links') {
      patterns = [...patterns].sort((a, b) => b.linkCount - a.linkCount);
    }
    
    return patterns;
  }, [selectedStage, statusFilter, searchQuery, completedLessons, sortBy]);

  // Select / Load lesson into graph
  const handleSelectLesson = useCallback(async (pattern: WikiNodeRaw) => {
    const seedId = pattern.seedIds[0] || pattern.id;
    setLoadingId(pattern.id);
    try {
      await switchTemplate(seedId);
      setToast({
        show: true,
        msg: `已成功载入第 ${pattern.lessonNum} 课「${pattern.title.replace(/第 \d+ 课：/, '')}」`,
        success: true
      });
      setTimeout(() => setToast(p => ({ ...p, show: false })), 2600);
      onTablesReady?.();
    } catch (err: any) {
      console.error('Failed to load lesson:', err);
      setToast({ show: true, msg: `载入失败: ${err?.message || '未知错误'}`, success: false });
      setTimeout(() => setToast(p => ({ ...p, show: false })), 3000);
    } finally {
      setLoadingId(null);
    }
  }, [switchTemplate, onTablesReady]);

  // Merge lesson into existing graph
  const handleMergeLesson = useCallback(async (pattern: WikiNodeRaw) => {
    const seedId = pattern.seedIds[0] || pattern.id;
    setLoadingId(pattern.id + '-merge');
    try {
      await mergeOntologyTemplate(seedId, 'overwrite');
      setToast({
        show: true,
        msg: `已将第 ${pattern.lessonNum} 课「${pattern.title.replace(/第 \d+ 课：/, '')}」增量合并入当前画布`,
        success: true
      });
      setTimeout(() => setToast(p => ({ ...p, show: false })), 2600);
      onTablesReady?.();
    } catch (err: any) {
      console.error('Failed to merge lesson:', err);
      setToast({ show: true, msg: `追加合并失败: ${err?.message || '未知错误'}`, success: false });
      setTimeout(() => setToast(p => ({ ...p, show: false })), 3000);
    } finally {
      setLoadingId(null);
    }
  }, [mergeOntologyTemplate, onTablesReady]);

  // Handle reset to default
  const handleResetDefault = useCallback(async () => {
    const ok = await confirm({
      title: '还原默认图谱',
      message: '确认清空当前画布并恢复至初始默认本体图谱（第 01 课基准）？',
      variant: 'warning',
      confirmText: '确认还原',
    });
    if (!ok) return;

    setLoadingId('reset');
    try {
      await switchTemplate('lesson-0001');
      setToast({
        show: true,
        msg: '已成功还原为第 01 课基准本体图谱',
        success: true
      });
      setTimeout(() => setToast(p => ({ ...p, show: false })), 2500);
      onTablesReady?.();
    } catch (err: any) {
      console.error('Failed to reset graph:', err);
      setToast({ show: true, msg: '还原失败', success: false });
      setTimeout(() => setToast(p => ({ ...p, show: false })), 2500);
    } finally {
      setLoadingId(null);
    }
  }, [confirm, switchTemplate, onTablesReady]);

  // Global Keyboard Navigation (↑/↓ 导航, Enter 载入, M 标记掌握)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (filteredPatterns.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setKeyboardIndex(prev => (prev + 1 < filteredPatterns.length ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setKeyboardIndex(prev => (prev - 1 >= 0 ? prev - 1 : filteredPatterns.length - 1));
      } else if (e.key === 'Enter' && keyboardIndex >= 0 && keyboardIndex < filteredPatterns.length) {
        e.preventDefault();
        handleSelectLesson(filteredPatterns[keyboardIndex]);
      } else if ((e.key === 'm' || e.key === 'M') && keyboardIndex >= 0 && keyboardIndex < filteredPatterns.length) {
        e.preventDefault();
        toggleComplete(filteredPatterns[keyboardIndex].id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredPatterns, keyboardIndex, handleSelectLesson, toggleComplete]);

  return (
    <div className="flex flex-col h-full min-h-0 font-sans text-monokai-fg bg-monokai-bg/60 select-none">
      {/* Toast Notification */}
      {toast.show && (
        <ToastNotification 
          message={toast.msg} 
          type={toast.success ? 'success' : 'error'} 
          onClose={() => setToast(p => ({ ...p, show: false }))} 
        />
      )}

      {/* ── Header Section (L1: 路线概览与进度层) ── */}
      <div className="p-3 space-y-3 shrink-0 border-b border-monokai-border/50">
        <LearningProgressHeader 
          completedCount={completedLessons.length}
          totalCount={DEFAULT_PATTERNS.length}
          onResetProgress={handleResetProgress}
          onResetDefaultGraph={handleResetDefault}
          isResetting={loadingId === 'reset'}
        />

        {/* Current Canvas Quick Stats */}
        <QuickStats state={state} />

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-monokai-comment" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索课号、标题、核心节点或案例故事..."
            className="w-full pl-8 pr-7 py-1.5 bg-monokai-surface border border-monokai-border rounded-lg text-xs text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-cyan transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-monokai-comment hover:text-monokai-fg text-xs px-1 cursor-pointer"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* ── Filter Controls (L2: 阶段与状态多维筛选) ── */}
      <div className="px-3 pt-2.5 pb-2 shrink-0 space-y-2 border-b border-monokai-border/30">
        {/* Stage Filter */}
        <StageFilter 
          selected={selectedStage}
          onSelect={setSelectedStage}
          patternCount={patternCount}
        />

        {/* Status Filter Tabs (全部 / 待学习 / 已掌握) & Sort */}
        <div className="flex items-center justify-between gap-1 text-xs flex-wrap">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-monokai-comment mr-1">状态:</span>
            {(['all', 'todo', 'completed'] as LearningStatusFilter[]).map(status => {
              const label = status === 'all' 
                ? `全部 (${DEFAULT_PATTERNS.length})` 
                : status === 'todo' 
                  ? `待学习 (${DEFAULT_PATTERNS.length - completedLessons.length})` 
                  : `已掌握 (${completedLessons.length})`;
              const isSel = statusFilter === status;

              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`
                    px-2 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer
                    ${isSel 
                      ? 'bg-monokai-surface text-monokai-cyan border border-monokai-cyan/40 font-bold' 
                      : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/60'
                    }
                  `}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 text-[10px] text-monokai-comment">
            <span>排序:</span>
            <select
              value={sortBy}
              aria-label="课程排序"
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-monokai-surface border border-monokai-border rounded px-1.5 py-0.5 text-[10px] text-monokai-fg outline-none cursor-pointer hover:border-monokai-cyan/50 transition-colors"
            >
              <option value="order">课号顺序</option>
              <option value="nodes">实体最多</option>
              <option value="links">关系最多</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Lesson List (L3: 结构化卡片主体) ── */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 custom-scrollbar p-3">
        {filteredPatterns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
            <Search className="w-8 h-8 text-monokai-comment/40" />
            <p className="text-xs text-monokai-comment">未找到符合筛选条件的实战课程</p>
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setSelectedStage('all'); setStatusFilter('all'); }}
              className="px-3 py-1.5 text-xs text-monokai-cyan hover:bg-monokai-surface border border-monokai-cyan/30 rounded-lg transition-colors cursor-pointer"
            >
              清空全部筛选
            </button>
          </div>
        ) : (
          filteredPatterns.map((pattern, idx) => {
            const seedId = pattern.seedIds[0] || pattern.id;
            const isActive = activeTemplateId === seedId;
            const isLoading = loadingId === pattern.id || loadingId === `${pattern.id}-merge`;
            const isCompleted = completedLessons.includes(pattern.id);
            const isFocused = keyboardIndex === idx;

            return (
              <LessonCard
                key={pattern.id}
                pattern={pattern}
                isActive={isActive}
                isLoading={isLoading}
                isCompleted={isCompleted}
                isFocused={isFocused}
                onSelect={() => handleSelectLesson(pattern)}
                onMerge={() => handleMergeLesson(pattern)}
                onToggleComplete={() => toggleComplete(pattern.id)}
              />
            );
          })
        )}
      </div>

      {/* ── Footer: 真实键盘快捷键与统计 (L4) ── */}
      <div className="px-3 py-2 border-t border-monokai-border/40 shrink-0 bg-monokai-surface/20">
        <div className="flex items-center justify-between text-[10px] text-monokai-comment">
          <span className="flex items-center gap-1">
            <span className="font-mono bg-monokai-surface px-1 py-0.2 rounded border border-monokai-border">↑↓</span> 聚焦
            <span className="font-mono bg-monokai-surface px-1 py-0.2 rounded border border-monokai-border ml-1">Enter</span> 载入
            <span className="font-mono bg-monokai-surface px-1 py-0.2 rounded border border-monokai-border ml-1">M</span> 标记掌握
          </span>
          <span className="font-mono">{filteredPatterns.length} / {DEFAULT_PATTERNS.length} 门</span>
        </div>
      </div>
    </div>
  );
};

export default PatternLibraryPanel;

