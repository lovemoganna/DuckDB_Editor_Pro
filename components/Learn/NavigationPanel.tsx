/**
 * NavigationPanel - 学习中心导航面板
 * 
 * MECE 重构：
 * - 左侧：本体建模 4 阶段方法论（独立模块）
 * - 中间：其他教程分类
 * - 右侧：统计和设置
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { 
  ChevronRight, ChevronDown, BookOpen, Home, Search, Settings, 
  Download, Upload, Plus, Clock, CheckCircle2, Circle, 
  Filter, SortAsc, X, Keyboard, Sparkles, GraduationCap, Network,
  Layers, Database, Brain, Zap, BarChart2, RotateCcw, ChevronLeft
} from 'lucide-react';
import { TutorialMetadata, TutorialSection, tutorials, searchTutorials, SearchResult } from '../../data/tutorials';
import { useOntologyLessons, ONTOLOGY_STAGES, OntologyStage, OntologyLesson } from '../../hooks/useOntologyLessons';
import { PanelHeader } from '../ui/Workbench';

interface NavigationPanelProps {
  selectedTutorial: TutorialMetadata | null;
  onSelectTutorial: (tutorial: TutorialMetadata) => void;
  selectedOntologyLessonId?: string | null;
  onSelectOntologyLesson?: (lessonId: string) => void;
  currentSection?: string;
  onNavigateSection?: (sectionId: string) => void;
}

// ============================================================
// MECE 分类配置
// ============================================================
type TutorialCategory = 'ontology' | 'sql' | 'knowledge' | 'custom';

interface CategoryConfig {
  id: TutorialCategory;
  label: string;
  icon: React.ElementType;
  color: string;
  description: string;
}

const CATEGORY_CONFIGS: CategoryConfig[] = [
  { 
    id: 'ontology', 
    label: '本体实操手册', 
    icon: Sparkles, 
    color: 'cyan',
    description: 'Palantir 元结构 DuckDB SQL 完整实操'
  },
  { 
    id: 'sql', 
    label: 'SQL 数据分析', 
    icon: Database, 
    color: 'blue',
    description: 'DuckDB SQL 系统化学习'
  },
  { 
    id: 'knowledge', 
    label: '知识图谱', 
    icon: Layers, 
    color: 'green',
    description: '图谱构建与组合推演'
  },
  { 
    id: 'custom', 
    label: '自定义教程', 
    icon: GraduationCap, 
    color: 'yellow',
    description: '用户上传的教程'
  },
];

// ============================================================
// 工具栏组件
// ============================================================
const Toolbar: React.FC<{
  onSearch: () => void;
  onExport: () => void;
  onImport: () => void;
  searchActive: boolean;
}> = ({ onSearch, onExport, onImport, searchActive }) => (
  <div className="flex items-center gap-1 px-2 py-1.5 border-b border-monokai-border/50 bg-monokai-sidebar/80">
    <button
      onClick={onSearch}
      className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${
        searchActive 
          ? 'bg-monokai-cyan/20 text-monokai-cyan border border-monokai-cyan/30' 
          : 'bg-monokai-surface/50 text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface'
      }`}
      title="搜索教程 (Ctrl+F)"
    >
      <Search className="w-3.5 h-3.5" />
      <span className="truncate">搜索教程...</span>
      <kbd className="ml-auto text-[9px] bg-monokai-bg/60 px-1.5 py-0.5 rounded border border-monokai-border/50 font-mono">
        ⌘F
      </kbd>
    </button>
    <button
      onClick={onExport}
      className="p-2 rounded-lg bg-monokai-surface/50 text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface transition-all"
      title="导出学习进度"
    >
      <Download className="w-3.5 h-3.5" />
    </button>
    <button
      onClick={onImport}
      className="p-2 rounded-lg bg-monokai-surface/50 text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface transition-all"
      title="导入教程"
    >
      <Upload className="w-3.5 h-3.5" />
    </button>
  </div>
);

// ============================================================
// 搜索结果弹窗
// ============================================================
const SearchModal: React.FC<{
  onClose: () => void;
  onSelectTutorial: (tutorial: TutorialMetadata) => void;
}> = ({ onClose, onSelectTutorial }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (query.trim()) {
      const searchResults = searchTutorials(query);
      setResults(searchResults);
      setSelectedIndex(0);
    } else {
      setResults([]);
    }
  }, [query]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      onSelectTutorial(results[selectedIndex]);
      onClose();
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [results, selectedIndex, onSelectTutorial, onClose]);

  const getDifficultyStyle = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner': return 'bg-monokai-green/20 text-monokai-green';
      case 'Intermediate': return 'bg-monokai-orange/20 text-monokai-orange';
      case 'Advanced': return 'bg-monokai-amethyst/20 text-monokai-amethyst';
      default: return 'bg-monokai-blue/20 text-monokai-blue';
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-monokai-bg/95 backdrop-blur-sm flex flex-col">
      <div className="p-3 border-b border-monokai-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-monokai-comment" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索教程标题、描述或内容..."
            className="w-full pl-10 pr-10 py-3 bg-monokai-sidebar border border-monokai-border rounded-xl text-sm text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-cyan transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-monokai-surface text-monokai-comment"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between mt-2 text-[10px] text-monokai-comment">
          <span>按 ↑↓ 选择，Enter 确认，Esc 关闭</span>
          <span>{results.length > 0 ? `找到 ${results.length} 个结果` : '开始输入以搜索'}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        {results.length === 0 && query && (
          <div className="text-center py-12 text-monokai-comment text-sm">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>未找到匹配的教程</p>
            <p className="text-xs mt-1 opacity-60">尝试使用不同的关键词</p>
          </div>
        )}
        
        <div className="space-y-1">
          {results.map((result, index) => (
            <button
              key={result.id}
              onClick={() => {
                onSelectTutorial(result);
                onClose();
              }}
              className={`w-full text-left p-3 rounded-lg border transition-all ${
                index === selectedIndex
                  ? 'bg-monokai-cyan/15 border-monokai-cyan/40 shadow-lg shadow-monokai-cyan/10'
                  : 'bg-monokai-sidebar/50 border-monokai-border hover:border-monokai-border-strong'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${getDifficultyStyle(result.difficulty)}`}>
                      {result.difficulty === 'Beginner' ? '入门' : result.difficulty === 'Intermediate' ? '进阶' : '高级'}
                    </span>
                    <span className="text-[10px] text-monokai-comment bg-monokai-surface px-1.5 py-0.5 rounded">
                      {result.category}
                    </span>
                  </div>
                  <h4 className="text-sm font-medium text-monokai-fg truncate">{result.title}</h4>
                  <p className="text-[11px] text-monokai-comment mt-1 line-clamp-2">
                    {result.matchingExcerpt || result.description}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-monokai-comment shrink-0 mt-1" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// 本体课程阶段面板
// ============================================================
interface OntologyStagePanelProps {
  lessonsByStage: Record<OntologyStage, OntologyLesson[]>;
  stageProgress: Record<OntologyStage, number>;
  currentLessonId?: string;
  onSelectLesson: (lessonId: string) => void;
  graphStats: { entities: number; relations: number; concepts: number };
  overallProgress: number;
  completedCount: number;
}

const OntologyStagePanel: React.FC<OntologyStagePanelProps> = ({
  lessonsByStage,
  stageProgress,
  currentLessonId,
  onSelectLesson,
  graphStats,
  overallProgress,
  completedCount,
}) => {
  const [expandedStages, setExpandedStages] = useState<Set<OntologyStage>>(new Set(['recognition']));

  const toggleStage = useCallback((stage: OntologyStage) => {
    setExpandedStages(prev => {
      const next = new Set(prev);
      if (next.has(stage)) {
        next.delete(stage);
      } else {
        next.add(stage);
      }
      return next;
    });
  }, []);

  const stageColorMap: Record<OntologyStage, { bg: string; text: string; border: string; accent: string }> = {
    recognition: { 
      bg: 'bg-monokai-cyan/10', 
      text: 'text-monokai-cyan', 
      border: 'border-monokai-cyan/20',
      accent: 'bg-monokai-cyan'
    },
    topology: { 
      bg: 'bg-monokai-blue/10', 
      text: 'text-monokai-blue', 
      border: 'border-monokai-blue/20',
      accent: 'bg-monokai-blue'
    },
    assembly: { 
      bg: 'bg-monokai-green/10', 
      text: 'text-monokai-green', 
      border: 'border-monokai-green/20',
      accent: 'bg-monokai-green'
    },
    evolution: { 
      bg: 'bg-monokai-yellow/10', 
      text: 'text-monokai-yellow', 
      border: 'border-monokai-yellow/20',
      accent: 'bg-monokai-yellow'
    },
  };

  const stageIcons: Record<OntologyStage, React.ReactNode> = {
    recognition: <Brain className="w-4 h-4" />,
    topology: <Network className="w-4 h-4" />,
    assembly: <Layers className="w-4 h-4" />,
    evolution: <Zap className="w-4 h-4" />,
  };

  return (
    <div className="mb-4">
      {/* 标题区 */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-monokai-cyan/20 to-monokai-blue/20 flex items-center justify-center">
            <Network className="w-4 h-4 text-monokai-cyan" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-monokai-fg">本体建模实战路线</h3>
            <p className="text-[9px] text-monokai-comment">Palantir 风格核心方法论</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-monokai-cyan">{completedCount}/14</div>
          <div className="text-[9px] text-monokai-comment">课程完成</div>
        </div>
      </div>

      {/* 全局进度条 */}
      <div className="mx-1 mb-3">
        <div className="h-2 bg-monokai-surface rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-monokai-cyan to-monokai-blue transition-all duration-500"
            style={{ width: `${overallProgress * 100}%` }}
          />
        </div>
      </div>

      {/* 图谱统计 */}
      <div className="flex gap-2 mx-1 mb-3 px-3 py-2 bg-monokai-surface/30 rounded-lg border border-monokai-border/30">
        <div className="flex-1 text-center">
          <div className="text-sm font-bold text-monokai-cyan">{graphStats.entities}</div>
          <div className="text-[9px] text-monokai-comment">画布实体</div>
        </div>
        <div className="w-px bg-monokai-border/50" />
        <div className="flex-1 text-center">
          <div className="text-sm font-bold text-monokai-blue">{graphStats.relations}</div>
          <div className="text-[9px] text-monokai-comment">关系连线</div>
        </div>
        <div className="w-px bg-monokai-border/50" />
        <div className="flex-1 text-center">
          <div className="text-sm font-bold text-monokai-green">{graphStats.concepts}</div>
          <div className="text-[9px] text-monokai-comment">概念模式</div>
        </div>
      </div>

      {/* 阶段列表 */}
      <div className="space-y-2">
        {ONTOLOGY_STAGES.map((stage, stageIdx) => {
          const stageLessons = lessonsByStage[stage.id];
          const isExpanded = expandedStages.has(stage.id);
          const style = stageColorMap[stage.id];
          const progress = stageProgress[stage.id];
          const completedInStage = stageLessons.filter(l => l.isCompleted).length;

          return (
            <div key={stage.id} className={`rounded-lg border ${style.border} overflow-hidden`}>
              {/* 阶段头部 */}
              <button
                onClick={() => toggleStage(stage.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 transition-all ${
                  isExpanded ? style.bg : 'hover:bg-monokai-surface/50'
                }`}
              >
                {/* 阶段序号 */}
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${style.bg} ${style.text}`}>
                  {stageIdx + 1}
                </div>

                {/* 阶段信息 */}
                <div className="flex-1 min-w-0 text-left">
                  <div className={`flex items-center gap-2 ${style.text}`}>
                    <span className="text-xs font-semibold">{stage.label}</span>
                    <span className="text-[9px] opacity-60">{stage.labelEn}</span>
                  </div>
                  <div className="text-[10px] text-monokai-comment mt-0.5 line-clamp-1">
                    {stage.description}
                  </div>
                </div>

                {/* 进度指示 */}
                <div className="text-right shrink-0">
                  <div className="text-xs font-medium text-monokai-fg">
                    {completedInStage}/{stageLessons.length}
                  </div>
                  <div className="text-[9px] text-monokai-comment">课</div>
                </div>

                {/* 展开箭头 */}
                <div className={`${style.text} transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </button>

              {/* 阶段进度条 */}
              <div className="px-3 pb-2">
                <div className="h-1 bg-monokai-surface rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${style.accent} transition-all duration-300`}
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              </div>

              {/* 课程列表 */}
              {isExpanded && (
                <div className="border-t border-monokai-border/30 bg-monokai-bg/50">
                  <div className="p-2 space-y-1">
                    {stageLessons.map((lesson) => {
                      const isSelected = currentLessonId === lesson.id;
                      const isCompleted = lesson.isCompleted;
                      const hasProgress = lesson.progress > 0 && lesson.progress < 1;

                      return (
                        <button
                          key={lesson.id}
                          onClick={() => onSelectLesson(lesson.id)}
                          className={`w-full flex items-center gap-2 px-2 py-2 rounded-md text-left transition-all ${
                            isSelected
                              ? `${style.bg} border ${style.border}`
                              : 'hover:bg-monokai-surface/50'
                          }`}
                        >
                          {/* 状态图标 */}
                          <div className="shrink-0">
                            {isCompleted ? (
                              <CheckCircle2 className="w-4 h-4 text-monokai-green" />
                            ) : hasProgress ? (
                              <div className="relative w-4 h-4">
                                <Circle className="w-4 h-4 text-monokai-surface" />
                                <div 
                                  className={`absolute inset-0 flex items-center justify-center`}
                                >
                                  <div 
                                    className={`w-3 h-3 rounded-full ${style.accent}`}
                                    style={{ 
                                      clipPath: `conic-gradient(${style.text.replace('text-', '')} ${lesson.progress * 360}deg, transparent ${lesson.progress * 360}deg)`
                                    }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <Circle className="w-4 h-4 text-monokai-comment" />
                            )}
                          </div>

                          {/* 课程编号 */}
                          <div className="shrink-0 text-[10px] font-mono text-monokai-comment w-6">
                            {String(lesson.number).padStart(4, '0')}
                          </div>

                          {/* 课程标题 */}
                          <div className="flex-1 min-w-0">
                            <div className={`text-[11px] font-medium truncate ${
                              isSelected ? style.text : 'text-monokai-fg'
                            }`}>
                              {lesson.title}
                            </div>
                            {hasProgress && (
                              <div className="mt-1 h-0.5 bg-monokai-surface rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${style.accent}`}
                                  style={{ width: `${lesson.progress * 100}%` }}
                                />
                              </div>
                            )}
                          </div>

                          {/* 快捷信息 */}
                          <div className="shrink-0 flex items-center gap-2">
                            {lesson.sections.length > 0 && (
                              <span className="text-[9px] text-monokai-comment">
                                {lesson.sections.length}节
                              </span>
                            )}
                            <span className="text-[9px] text-monokai-comment">
                              {lesson.estimatedTime}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================
// 折叠面板组件
// ============================================================
const CollapsibleSection: React.FC<{
  title: string;
  icon: React.ElementType;
  color: string;
  count: number;
  description?: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
  onHeaderClick?: () => void;
}> = ({ title, icon: Icon, color, count, description, defaultExpanded = true, children, onHeaderClick }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    cyan: { bg: 'bg-monokai-cyan/15', text: 'text-monokai-cyan', border: 'border-monokai-cyan/30' },
    blue: { bg: 'bg-monokai-blue/15', text: 'text-monokai-blue', border: 'border-monokai-blue/30' },
    green: { bg: 'bg-monokai-green/15', text: 'text-monokai-green', border: 'border-monokai-green/30' },
    yellow: { bg: 'bg-monokai-yellow/15', text: 'text-monokai-yellow', border: 'border-monokai-yellow/30' },
    purple: { bg: 'bg-monokai-amethyst/15', text: 'text-monokai-amethyst', border: 'border-monokai-amethyst/30' },
  };

  const style = colorMap[color] || colorMap.cyan;

  return (
    <div className="mb-3">
      <button
        onClick={() => {
          setExpanded(!expanded);
          onHeaderClick?.();
        }}
        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all group ${
          expanded ? `${style.bg} ${style.text}` : 'hover:bg-monokai-surface text-monokai-fg-muted'
        }`}
      >
        <div className={`w-5 h-5 rounded flex items-center justify-center ${expanded ? style.bg : ''}`}>
          <Icon className={`w-3.5 h-3.5 ${expanded ? style.text : ''}`} />
        </div>
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold">{title}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              expanded ? `${style.bg} ${style.text} border ${style.border}` : 'bg-monokai-surface text-monokai-comment'
            }`}>
              {count}课
            </span>
          </div>
          {description && expanded && (
            <p className="text-[10px] mt-0.5 opacity-70 line-clamp-1">{description}</p>
          )}
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 opacity-60" />
        ) : (
          <ChevronRight className="w-4 h-4 opacity-40 group-hover:opacity-70" />
        )}
      </button>
      
      {expanded && (
        <div className="mt-1.5 pl-3 pr-1 space-y-0.5 border-l border-monokai-border/50">
          {children}
        </div>
      )}
    </div>
  );
};

// ============================================================
// 教程导航项
// ============================================================
const TutorialNavItem: React.FC<{
  tutorial: TutorialMetadata;
  isSelected: boolean;
  isCompleted: boolean;
  progress?: number;
  onSelect: (tutorial: TutorialMetadata) => void;
  index: number;
}> = ({ tutorial, isSelected, isCompleted, progress = 0, onSelect, index }) => (
  <button
    onClick={() => onSelect(tutorial)}
    className={`w-full text-left p-2 rounded-md transition-all flex items-start gap-2 ${
      isSelected
        ? 'bg-monokai-elevated text-monokai-fg border border-monokai-cyan/30'
        : 'hover:bg-monokai-surface text-monokai-fg-muted hover:text-monokai-fg'
    }`}
  >
    <div className="shrink-0 mt-0.5">
      {isCompleted ? (
        <CheckCircle2 className="w-4 h-4 text-monokai-green" />
      ) : progress > 0 ? (
        <div className="w-4 h-4 rounded-full border-2 border-monokai-cyan flex items-center justify-center">
          <div 
            className="w-2 h-2 rounded-full bg-monokai-cyan" 
          />
        </div>
      ) : (
        <Circle className="w-4 h-4 text-monokai-comment" />
      )}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium text-monokai-fg-muted opacity-60">
          {String(index + 1).padStart(2, '0')}
        </span>
        <span className={`text-[11px] font-medium truncate ${
          isSelected ? 'text-monokai-cyan font-semibold' : 'text-monokai-fg'
        }`}>
          {tutorial.title}
        </span>
      </div>
      {progress > 0 && progress < 1 && (
        <div className="mt-1.5 h-1 bg-monokai-surface rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-monokai-cyan to-monokai-blue transition-all"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}
    </div>
  </button>
);

// ============================================================
// 面包屑导航
// ============================================================
export const Breadcrumb: React.FC<{
  items: { label: string; onClick?: () => void }[]
}> = ({ items }) => (
  <div className="flex items-center gap-2 text-[10px] font-mono text-monokai-comment mb-3">
    <button
      onClick={() => items[0]?.onClick?.()}
      className="flex items-center gap-1 text-monokai-comment hover:text-monokai-cyan transition-colors cursor-pointer"
    >
      <Home className="w-3.5 h-3.5" />
      <span>学习中心</span>
    </button>
    {items.slice(1).map((item, index) => (
      <React.Fragment key={index}>
        <span className="text-monokai-border">/</span>
        {item.onClick ? (
          <button
            onClick={item.onClick}
            className="text-monokai-comment hover:text-monokai-cyan transition-colors cursor-pointer"
          >
            {item.label}
          </button>
        ) : (
          <span className="text-monokai-fg font-medium">{item.label}</span>
        )}
      </React.Fragment>
    ))}
  </div>
);

// ============================================================
// 主导航面板组件
// ============================================================
export const NavigationPanel: React.FC<NavigationPanelProps> = ({
  selectedTutorial,
  onSelectTutorial,
  selectedOntologyLessonId,
  onSelectOntologyLesson,
  currentSection,
  onNavigateSection,
}) => {
  // 本体课程 Hook
  const {
    lessons,
    lessonsByStage,
    stageProgress,
    completedCount,
    overallProgress,
    graphStats,
    selectLesson,
  } = useOntologyLessons();

  const [expandedTutorials, setExpandedTutorials] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<TutorialCategory>>(new Set(['ontology', 'sql']));
  const [searchActive, setSearchActive] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [ontologyLessonId, setOntologyLessonId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 从 localStorage 读取已完成教程和学习进度
  const { completedTutorials, tutorialProgress } = useMemo(() => {
    const completed: string[] = [];
    const progressMap: Record<string, number> = {};
    
    try {
      const saved = localStorage.getItem('duckdb_learn_progress');
      if (saved) {
        const progress = JSON.parse(saved);
        Object.entries(progress).forEach(([id, p]: [string, any]) => {
          if (p.completedAt) {
            completed.push(id);
          }
          if (p.completedSections && p.totalSections) {
            progressMap[id] = p.completedSections.length / p.totalSections;
          }
        });
      }
    } catch (e) { }
    
    return { completedTutorials: completed, tutorialProgress: progressMap };
  }, []);

  // 分类教程 (MECE 全量覆盖，本体建模独立分组)
  const categorizedTutorials = useMemo(() => {
    const result: Record<TutorialCategory, TutorialMetadata[]> = {
      ontology: [],
      sql: [],
      knowledge: [],
      custom: [],
    };

    tutorials.forEach(tutorial => {
      const title = (tutorial.title || '').toLowerCase();
      const category = (tutorial.category || '').toLowerCase();
      const id = (tutorial.id || '').toLowerCase();
      
      // 本体建模实操与 DuckDB 原生 SQL 教程
      if (title.includes('本体') || category.includes('本体') || id.includes('ontology') ||
          tutorial.tags.some(tag => tag.toLowerCase().includes('本体') || tag.toLowerCase().includes('ontology'))) {
        result.ontology.push(tutorial);
        return;
      }

      if (category.includes('sql') || category.includes('数据') || 
          tutorial.tags.some(tag => tag.includes('sql') || tag.includes('DuckDB'))) {
        result.sql.push(tutorial);
      } else if (category.includes('知识') || category.includes('图谱') ||
                 tutorial.tags.some(tag => tag.includes('知识') || tag.includes('图谱'))) {
        result.knowledge.push(tutorial);
      } else if (tutorial.isUserTutorial) {
        result.custom.push(tutorial);
      } else {
        result.sql.push(tutorial);
      }
    });

    return result;
  }, []);

  // 切换教程展开状态
  const toggleExpand = useCallback((tutorialId: string) => {
    setExpandedTutorials(prev => {
      const next = new Set(prev);
      if (next.has(tutorialId)) {
        next.delete(tutorialId);
      } else {
        next.add(tutorialId);
      }
      return next;
    });
  }, []);

  // 切换分类展开状态
  const toggleCategory = useCallback((categoryId: TutorialCategory) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  // 处理本体课程选择 - 同步通知父容器并更新视图
  const handleSelectOntologyLesson = useCallback((lessonId: string) => {
    setOntologyLessonId(lessonId);
    selectLesson(lessonId);
    onSelectOntologyLesson?.(lessonId);
  }, [selectLesson, onSelectOntologyLesson]);

  // 导出学习进度
  const handleExport = useCallback(() => {
    try {
      const saved = localStorage.getItem('duckdb_learn_progress');
      const ontologySaved = localStorage.getItem('duckdb_ontology_progress');
      const data = {
        tutorials: saved ? JSON.parse(saved) : {},
        ontology: ontologySaved ? JSON.parse(ontologySaved) : {},
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `learn-progress-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed:', e);
    }
  }, []);

  // 导入教程
  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        console.log('Import content:', content.substring(0, 100));
      } catch (err) {
        console.error('Import failed:', err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setSearchActive(true);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 折叠窄栏视图
  if (isCollapsed) {
    return (
      <div className="learn-navigation w-11 border-r border-monokai-border/70 flex flex-col items-center py-2.5 bg-monokai-sidebar shrink-0 select-none font-sans relative z-20">
        <button
          onClick={() => setIsCollapsed(false)}
          title="展开课程导航面板"
          className="p-1.5 rounded-lg hover:bg-monokai-surface text-monokai-comment hover:text-monokai-cyan transition-colors mb-4 cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <button
          onClick={() => setIsCollapsed(false)}
          title="本体建模实战路线 (14课)"
          className="p-2 rounded-lg hover:bg-monokai-surface text-monokai-cyan transition-colors mb-2 cursor-pointer relative group"
        >
          <Network className="w-4 h-4" />
          <span className="absolute left-full ml-2 px-2 py-0.5 bg-monokai-elevated border border-monokai-border rounded text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 shadow-md">
            本体建模实战路线 ({completedCount}/14)
          </span>
        </button>

        <button
          onClick={() => { setIsCollapsed(false); setSearchActive(true); }}
          title="搜索课程 (Ctrl+F)"
          className="p-2 rounded-lg hover:bg-monokai-surface text-monokai-comment hover:text-white transition-colors cursor-pointer relative group"
        >
          <Search className="w-4 h-4" />
          <span className="absolute left-full ml-2 px-2 py-0.5 bg-monokai-elevated border border-monokai-border rounded text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 shadow-md">
            搜索课程 (Ctrl+F)
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="learn-navigation w-72 border-r border-monokai-border flex flex-col bg-monokai-sidebar shrink-0 select-none font-sans relative">
      {/* 头部 */}
      <PanelHeader
        title="学习中心"
        icon={BookOpen}
        actions={
          <button
            onClick={() => setIsCollapsed(true)}
            title="收起侧边栏"
            className="p-1 rounded-md hover:bg-monokai-surface text-monokai-comment hover:text-white transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        }
      />

      {/* 工具栏 */}
      <Toolbar
        onSearch={() => setSearchActive(true)}
        onExport={handleExport}
        onImport={handleImport}
        searchActive={searchActive}
      />

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.md"
        className="hidden"
        onChange={handleFileImport}
      />

      {/* 搜索弹窗 */}
      {searchActive && (
        <SearchModal
          onClose={() => setSearchActive(false)}
          onSelectTutorial={onSelectTutorial}
        />
      )}

      {/* 教程列表 */}
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
        {/* OPLA 工作台快捷入口 */}
        <div className="mb-3 p-2 rounded-xl bg-monokai-bg/60 border border-monokai-border/60 space-y-1">
          <button
            onClick={() => {
              window.location.hash = '#hub/methodology';
              window.dispatchEvent(new HashChangeEvent('hashchange'));
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-monokai-comment hover:text-white hover:bg-monokai-surface transition-all cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <span className="text-monokai-cyan">🎯</span>
              <span>方法论全景</span>
            </span>
            <ChevronRight className="w-3 h-3 text-monokai-comment" />
          </button>
          <button
            onClick={() => {
              window.location.hash = '#hub/studio';
              window.dispatchEvent(new HashChangeEvent('hashchange'));
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold text-monokai-green hover:bg-monokai-green/15 transition-all cursor-pointer border border-monokai-green/20"
          >
            <span className="flex items-center gap-2">
              <span>🛠️</span>
              <span>OPLA 独立建模工坊</span>
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-monokai-yellow animate-pulse" />
          </button>
        </div>

        {/* ============================================= */}
        {/* MECE 第一层：本体建模 (独立模块) */}
        {/* ============================================= */}
        <OntologyStagePanel
          lessonsByStage={lessonsByStage}
          stageProgress={stageProgress}
          currentLessonId={selectedOntologyLessonId || ontologyLessonId || undefined}
          onSelectLesson={handleSelectOntologyLesson}
          graphStats={graphStats}
          overallProgress={overallProgress}
          completedCount={completedCount}
        />

        {/* 本体实操手册 (DuckDB SQL 实践) */}
        {categorizedTutorials.ontology.length > 0 && (
          <div className="mt-3">
            <CollapsibleSection
              title="本体实操手册"
              icon={Sparkles}
              color="cyan"
              count={categorizedTutorials.ontology.length}
              description="Palantir 元结构 DuckDB SQL 实践"
              defaultExpanded={expandedCategories.has('ontology')}
              onHeaderClick={() => toggleCategory('ontology')}
            >
              {categorizedTutorials.ontology.map((tutorial, idx) => (
                <TutorialNavItem
                  key={tutorial.id}
                  tutorial={tutorial}
                  isSelected={selectedTutorial?.id === tutorial.id}
                  isCompleted={completedTutorials.includes(tutorial.id)}
                  progress={tutorialProgress[tutorial.id] || 0}
                  onSelect={onSelectTutorial}
                  index={idx}
                />
              ))}
            </CollapsibleSection>
          </div>
        )}

        {/* 分隔线 */}
        <div className="border-t border-monokai-border/50 my-4" />

        {/* ============================================= */}
        {/* MECE 第二层：其他教程分类 */}
        {/* ============================================= */}

        {/* SQL 数据分析 */}
        {categorizedTutorials.sql.length > 0 && (
          <CollapsibleSection
            title="SQL 数据分析"
            icon={Database}
            color="blue"
            count={categorizedTutorials.sql.length}
            description="DuckDB SQL 系统化学习"
            defaultExpanded={expandedCategories.has('sql')}
            onHeaderClick={() => toggleCategory('sql')}
          >
            {categorizedTutorials.sql.map((tutorial, idx) => (
              <TutorialNavItem
                key={tutorial.id}
                tutorial={tutorial}
                isSelected={selectedTutorial?.id === tutorial.id}
                isCompleted={completedTutorials.includes(tutorial.id)}
                progress={tutorialProgress[tutorial.id] || 0}
                onSelect={onSelectTutorial}
                index={idx}
              />
            ))}
          </CollapsibleSection>
        )}

        {/* 知识图谱 */}
        {categorizedTutorials.knowledge.length > 0 && (
          <CollapsibleSection
            title="知识图谱"
            icon={Layers}
            color="green"
            count={categorizedTutorials.knowledge.length}
            description="图谱构建与组合推演"
            defaultExpanded={expandedCategories.has('knowledge')}
            onHeaderClick={() => toggleCategory('knowledge')}
          >
            {categorizedTutorials.knowledge.map((tutorial, idx) => (
              <TutorialNavItem
                key={tutorial.id}
                tutorial={tutorial}
                isSelected={selectedTutorial?.id === tutorial.id}
                isCompleted={completedTutorials.includes(tutorial.id)}
                progress={tutorialProgress[tutorial.id] || 0}
                onSelect={onSelectTutorial}
                index={idx}
              />
            ))}
          </CollapsibleSection>
        )}

        {/* 自定义教程 */}
        {categorizedTutorials.custom.length > 0 && (
          <CollapsibleSection
            title="自定义教程"
            icon={GraduationCap}
            color="yellow"
            count={categorizedTutorials.custom.length}
            description="用户上传的教程"
            defaultExpanded={expandedCategories.has('custom')}
            onHeaderClick={() => toggleCategory('custom')}
          >
            {categorizedTutorials.custom.map((tutorial, idx) => (
              <TutorialNavItem
                key={tutorial.id}
                tutorial={tutorial}
                isSelected={selectedTutorial?.id === tutorial.id}
                isCompleted={completedTutorials.includes(tutorial.id)}
                progress={tutorialProgress[tutorial.id] || 0}
                onSelect={onSelectTutorial}
                index={idx}
              />
            ))}
          </CollapsibleSection>
        )}

        {/* 学习统计 */}
        <div className="mt-4 pt-4 border-t border-monokai-border/50">
          <div className="px-2 py-2 bg-monokai-surface/30 rounded-lg">
            <div className="flex items-center justify-between text-[10px] text-monokai-comment mb-2">
              <span>学习进度</span>
              <span className="text-monokai-green font-medium">
                {completedTutorials.length + completedCount}/{tutorials.length + 14}
              </span>
            </div>
            <div className="h-1.5 bg-monokai-surface rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-monokai-green to-monokai-cyan transition-all"
                style={{ 
                  width: `${((completedTutorials.length + completedCount) / (tutorials.length + 14)) * 100}%` 
                }}
              />
            </div>
            <div className="flex items-center gap-3 mt-2 text-[9px] text-monokai-comment">
              <span>✓ 本体 {completedCount} 课</span>
              <span>✓ SQL {completedTutorials.length} 课</span>
            </div>
          </div>
        </div>
      </div>

      {/* 底部快捷操作 */}
      <div className="px-3 py-2 border-t border-monokai-border/50 bg-monokai-sidebar/50">
        <div className="flex items-center gap-2">
          <button className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface rounded-lg transition-all">
            <Keyboard className="w-3.5 h-3.5" />
            <span>快捷键</span>
          </button>
          <button className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface rounded-lg transition-all">
            <Settings className="w-3.5 h-3.5" />
            <span>设置</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default NavigationPanel;
