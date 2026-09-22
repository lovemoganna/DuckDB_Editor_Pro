/**
 * ProgressTracker - 学习进度追踪器
 * 
 * 功能：
 * 1. 展示全局学习统计
 * 2. 追踪教程学习进度
 * 3. 展示本体课程阶段进度
 * 4. 成就系统
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  TutorialMetadata, getNextTutorial, tutorials, getLearningPath 
} from '../../data/tutorials';
import { 
  Clock, BookOpen, CheckCircle2, Trophy, Flame, Star, Award,
  ChevronDown, ChevronRight, Play, Settings, Target, Zap,
  Calendar, Timer, TrendingUp, Award as MedalIcon, Crown, Sparkles,
  Network, Layers, Brain, Zap as EvolutionIcon
} from 'lucide-react';
import { useOntologyLessons, ONTOLOGY_STAGES, OntologyStage } from '../../hooks/useOntologyLessons';

interface LearningProgress {
  tutorialId: string;
  completedSections: string[];
  lastPosition: string;
  startedAt: string;
  completedAt?: string;
  totalSections?: number;
  timeSpent?: number; // seconds
}

interface ProgressTrackerProps {
  selectedTutorial: TutorialMetadata | null;
  onNavigateToTutorial?: (tutorialId: string) => void;
  onNavigateSection?: (anchor: string) => void;
  onTryCode?: (code: string) => void;
}

const STORAGE_KEY = 'duckdb_learn_progress';
const TIME_STORAGE_KEY = 'duckdb_learn_time';

// 从 localStorage 加载进度
const loadProgress = (): Record<string, LearningProgress> => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load progress:', e);
  }
  return {};
};

// 保存进度到 localStorage
const saveProgress = (progress: Record<string, LearningProgress>) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (e) {
    console.error('Failed to save progress:', e);
  }
};

// 成就定义
interface Achievement {
  id: string;
  name: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  condition: (progress: Record<string, LearningProgress>, stats: any) => boolean;
  progress?: (progress: Record<string, LearningProgress>, stats: any) => number;
  tier?: 'bronze' | 'silver' | 'gold' | 'platinum';
}

const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_step',
    name: '初学者',
    desc: '完成第一个教程',
    icon: <Star className="w-5 h-5" />,
    color: 'text-monokai-green',
    bgColor: 'bg-monokai-green/10',
    condition: (p) => Object.values(p).some(x => x.completedAt),
    tier: 'bronze',
  },
  {
    id: 'db_master',
    name: '数据库大师',
    desc: '完成 DuckDB 入门教程',
    icon: <Trophy className="w-5 h-5" />,
    color: 'text-monokai-yellow',
    bgColor: 'bg-monokai-yellow/10',
    condition: (p) => Boolean(p['duckdb-basics']?.completedAt || p['duckdb-intro']?.completedAt),
    tier: 'silver',
  },
  {
    id: 'streak_3',
    name: '连续3天',
    desc: '连续学习3天',
    icon: <Flame className="w-5 h-5" />,
    color: 'text-monokai-orange',
    bgColor: 'bg-monokai-orange/10',
    condition: (_, stats) => stats.streak >= 3,
    tier: 'bronze',
  },
  {
    id: 'streak_7',
    name: '连续7天',
    desc: '连续学习7天',
    icon: <Flame className="w-5 h-5" />,
    color: 'text-monokai-red',
    bgColor: 'bg-monokai-red/10',
    condition: (_, stats) => stats.streak >= 7,
    progress: (_, stats) => Math.min(stats.streak / 7, 1),
    tier: 'silver',
  },
  {
    id: 'ontology_4',
    name: '本体论者',
    desc: '完成4阶段本体建模课程',
    icon: <Target className="w-5 h-5" />,
    color: 'text-monokai-cyan',
    bgColor: 'bg-monokai-cyan/10',
    condition: (_, stats) => stats.ontologyCompleted >= 14,
    tier: 'gold',
  },
  {
    id: 'ontology_stage_1',
    name: '识别专家',
    desc: '完成识别与边界阶段',
    icon: <Brain className="w-5 h-5" />,
    color: 'text-monokai-cyan',
    bgColor: 'bg-monokai-cyan/10',
    condition: (_, stats) => stats.ontologyByStage.recognition >= 3,
    tier: 'bronze',
  },
  {
    id: 'ontology_stage_2',
    name: '拓扑探索者',
    desc: '完成拓扑与变迁阶段',
    icon: <Layers className="w-5 h-5" />,
    color: 'text-monokai-blue',
    bgColor: 'bg-monokai-blue/10',
    condition: (_, stats) => stats.ontologyByStage.topology >= 4,
    tier: 'silver',
  },
  {
    id: 'ontology_stage_3',
    name: '组装大师',
    desc: '完成组装与验证阶段',
    icon: <Network className="w-5 h-5" />,
    color: 'text-monokai-green',
    bgColor: 'bg-monokai-green/10',
    condition: (_, stats) => stats.ontologyByStage.assembly >= 4,
    tier: 'silver',
  },
  {
    id: 'ontology_stage_4',
    name: '演进先知',
    desc: '完成演进与证据阶段',
    icon: <EvolutionIcon className="w-5 h-5" />,
    color: 'text-monokai-yellow',
    bgColor: 'bg-monokai-yellow/10',
    condition: (_, stats) => stats.ontologyByStage.evolution >= 3,
    tier: 'gold',
  },
  {
    id: 'complete_5',
    name: '学习达人',
    desc: '完成5个教程',
    icon: <BookOpen className="w-5 h-5" />,
    color: 'text-monokai-blue',
    bgColor: 'bg-monokai-blue/10',
    condition: (p) => Object.values(p).filter(x => x.completedAt).length >= 5,
    progress: (p, stats) => Math.min(stats.completed / 5, 1),
    tier: 'silver',
  },
  {
    id: 'complete_10',
    name: '知识渊博',
    desc: '完成10个教程',
    icon: <Award className="w-5 h-5" />,
    color: 'text-monokai-amethyst',
    bgColor: 'bg-monokai-amethyst/10',
    condition: (p) => Object.values(p).filter(x => x.completedAt).length >= 10,
    progress: (p, stats) => Math.min(stats.completed / 10, 1),
    tier: 'gold',
  },
  {
    id: 'speed_learner',
    name: '速学者',
    desc: '在1天内完成2个教程',
    icon: <Zap className="w-5 h-5" />,
    color: 'text-monokai-yellow',
    bgColor: 'bg-monokai-yellow/10',
    condition: (p, stats) => stats.sameDayCompletions >= 2,
    tier: 'gold',
  },
  {
    id: 'all_beginner',
    name: '入门完成',
    desc: '完成所有入门级教程',
    icon: <Crown className="w-5 h-5" />,
    color: 'text-monokai-green',
    bgColor: 'bg-monokai-green/10',
    condition: (p) => {
      const beginners = tutorials.filter(t => t.difficulty === 'Beginner');
      return beginners.every(t => p[t.id]?.completedAt);
    },
    tier: 'platinum',
  },
  {
    id: 'time_investor',
    name: '时间投资',
    desc: '累计学习超过10小时',
    icon: <Timer className="w-5 h-5" />,
    color: 'text-monokai-orange',
    bgColor: 'bg-monokai-orange/10',
    condition: (_, stats) => stats.totalTime >= 36000, // 10 hours
    progress: (_, stats) => Math.min(stats.totalTime / 36000, 1),
    tier: 'silver',
  },
];

// 时间格式化
const formatTime = (seconds: number): string => {
  if (seconds < 60) return `${seconds}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
};

// 日期格式化
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays < 7) return `${diffDays}天前`;
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
};

// ============================================================
// 阶段进度卡片组件
// ============================================================
interface StageProgressCardProps {
  stage: typeof ONTOLOGY_STAGES[0];
  progress: number;
  completedCount: number;
  totalCount: number;
  isActive?: boolean;
}

const StageProgressCard: React.FC<StageProgressCardProps> = ({
  stage,
  progress,
  completedCount,
  totalCount,
  isActive = false,
}) => {
  const colorMap: Record<string, { bg: string; text: string; border: string; gradient: string }> = {
    cyan: { 
      bg: 'bg-monokai-cyan/10', 
      text: 'text-monokai-cyan', 
      border: 'border-monokai-cyan/30',
      gradient: 'from-monokai-cyan to-monokai-blue'
    },
    blue: { 
      bg: 'bg-monokai-blue/10', 
      text: 'text-monokai-blue', 
      border: 'border-monokai-blue/30',
      gradient: 'from-monokai-blue to-monokai-purple'
    },
    green: { 
      bg: 'bg-monokai-green/10', 
      text: 'text-monokai-green', 
      border: 'border-monokai-green/30',
      gradient: 'from-monokai-green to-monokai-cyan'
    },
    yellow: { 
      bg: 'bg-monokai-yellow/10', 
      text: 'text-monokai-yellow', 
      border: 'border-monokai-yellow/30',
      gradient: 'from-monokai-yellow to-monokai-orange'
    },
  };

  const style = colorMap[stage.color];
  const isCompleted = progress >= 1;

  return (
    <div className={`p-3 rounded-lg border transition-all ${
      isActive ? `${style.bg} ${style.border}` : 'bg-monokai-surface/30 border-monokai-border/30'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${style.bg} ${style.text}`}>
          {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : stage.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-xs font-medium ${style.text}`}>{stage.label}</div>
          <div className="text-[9px] text-monokai-comment">{stage.labelEn}</div>
        </div>
        <div className="text-right">
          <div className={`text-sm font-bold ${style.text}`}>{completedCount}/{totalCount}</div>
          <div className="text-[9px] text-monokai-comment">课</div>
        </div>
      </div>
      <div className="h-1.5 bg-monokai-surface rounded-full overflow-hidden">
        <div 
          className={`h-full bg-gradient-to-r ${style.gradient} transition-all duration-500`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
};

// ============================================================
// 成就卡片组件
// ============================================================
const AchievementCard: React.FC<{
  achievement: Achievement;
  isUnlocked: boolean;
  progress?: number;
  onClick?: () => void;
}> = ({ achievement, isUnlocked, progress = 0, onClick }) => {
  const tierColors = {
    bronze: { border: 'border-monokai-orange/30', glow: 'shadow-monokai-orange/20' },
    silver: { border: 'border-monokai-comment/30', glow: 'shadow-monokai-comment/20' },
    gold: { border: 'border-monokai-yellow/40', glow: 'shadow-monokai-yellow/20' },
    platinum: { border: 'border-monokai-cyan/50', glow: 'shadow-monokai-cyan/30' },
  };
  
  const tierStyle = tierColors[achievement.tier || 'bronze'];
  
  return (
    <button
      onClick={onClick}
      className={`relative p-3 rounded-xl border transition-all group ${
        isUnlocked
          ? `${achievement.bgColor} ${tierStyle.border} ${tierStyle.glow} shadow-lg`
          : 'bg-monokai-surface/50 border-monokai-border/50 opacity-50'
      }`}
      title={isUnlocked ? achievement.desc : `未解锁: ${achievement.desc}`}
    >
      {/* 成就图标 */}
      <div className={`flex items-center justify-center w-10 h-10 rounded-full mb-2 mx-auto ${
        isUnlocked ? achievement.bgColor : 'bg-monokai-surface'
      }`}>
        <div className={isUnlocked ? achievement.color : 'text-monokai-comment'}>
          {achievement.icon}
        </div>
      </div>
      
      {/* 成就名称 */}
      <div className={`text-center text-xs font-semibold mb-0.5 ${
        isUnlocked ? 'text-monokai-fg' : 'text-monokai-comment'
      }`}>
        {achievement.name}
      </div>
      
      {/* 解锁状态 */}
      {isUnlocked ? (
        <div className={`text-center text-[10px] ${achievement.color}`}>
          ✓ 已解锁
        </div>
      ) : progress > 0 ? (
        <div className="mt-1">
          <div className="h-1 bg-monokai-surface rounded-full overflow-hidden">
            <div 
              className={`h-full ${achievement.color.replace('text-', 'bg-')} transition-all`}
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="text-center text-[10px] text-monokai-comment">
          ○ 未解锁
        </div>
      )}
      
      {/* Tier 标记 */}
      {achievement.tier && (
        <div className={`absolute top-1 right-1 text-[8px] px-1 py-0.5 rounded ${
          achievement.tier === 'platinum' ? 'bg-monokai-cyan/20 text-monokai-cyan' :
          achievement.tier === 'gold' ? 'bg-monokai-yellow/20 text-monokai-yellow' :
          achievement.tier === 'silver' ? 'bg-monokai-comment/20 text-monokai-comment' :
          'bg-monokai-orange/20 text-monokai-orange'
        } font-bold uppercase tracking-wider`}>
          {achievement.tier === 'platinum' ? '铂金' :
           achievement.tier === 'gold' ? '金' :
           achievement.tier === 'silver' ? '银' : '铜'}
        </div>
      )}
    </button>
  );
};

// ============================================================
// 统计卡片组件
// ============================================================
const StatItem: React.FC<{
  icon: React.ReactNode;
  value: string | number;
  label: string;
  color: string;
}> = ({ icon, value, label, color }) => (
  <div className={`flex items-center gap-2 p-2 rounded-lg bg-monokai-surface/30 border border-monokai-border/30`}>
    <div className={`text-${color}`}>{icon}</div>
    <div>
      <div className={`text-sm font-bold text-monokai-${color}`}>{value}</div>
      <div className="text-[10px] text-monokai-comment">{label}</div>
    </div>
  </div>
);

// ============================================================
// 章节进度项
// ============================================================
const SectionProgressItem: React.FC<{
  section: { id: string; title: string; anchor: string };
  isCompleted: boolean;
  index: number;
  onClick: () => void;
}> = ({ section, isCompleted, index, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full text-left py-1.5 px-2 rounded text-[11px] flex items-center gap-2 transition-colors ${
      isCompleted
        ? 'bg-monokai-green/10 text-monokai-green'
        : 'hover:bg-monokai-accent/20 text-monokai-fg/60 hover:text-monokai-fg'
    }`}
  >
    <span className="w-5 text-center">
      {isCompleted ? (
        <CheckCircle2 className="w-3.5 h-3.5 inline" />
      ) : (
        <span className="text-monokai-comment">{index + 1}</span>
      )}
    </span>
    <span className="truncate">{section.title}</span>
  </button>
);

// ============================================================
// 主组件
// ============================================================
export const ProgressTracker: React.FC<ProgressTrackerProps> = ({
  selectedTutorial,
  onNavigateSection,
  onTryCode,
}) => {
  const [progress, setProgress] = useState<Record<string, LearningProgress>>({});
  const [totalTime, setTotalTime] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [expandedSections, setExpandedSections] = useState(true);

  // 本体课程进度
  const {
    lessons,
    lessonsByStage,
    stageProgress,
    completedCount: ontologyCompletedCount,
  } = useOntologyLessons();

  // 加载进度
  useEffect(() => {
    const saved = loadProgress();
    setProgress(saved);
    
    // 加载学习时间
    const savedTime = localStorage.getItem(TIME_STORAGE_KEY);
    if (savedTime) {
      setTotalTime(parseInt(savedTime, 10) || 0);
    }
    
    // 计算连续学习天数
    if (saved && Object.keys(saved).length > 0) {
      const dates = Object.values(saved)
        .map(p => p.startedAt)
        .filter(Boolean)
        .map(d => new Date(d).toDateString());
      
      const uniqueDates = [...new Set(dates)];
      let streak = 0;
      const today = new Date().toDateString();
      
      for (let i = 0; i < 30; i++) {
        const checkDate = new Date(Date.now() - i * 86400000).toDateString();
        if (uniqueDates.includes(checkDate)) {
          streak++;
        } else if (checkDate !== today) {
          break;
        }
      }
      setCurrentStreak(streak);
    }
  }, []);

  // 计算统计信息
  const tutorialProgress = useMemo(() => {
    const allProgress = Object.values(progress);
    const completed = allProgress.filter(p => p.completedAt).length;
    const inProgress = allProgress.filter(p => !p.completedAt && p.completedSections?.length > 0).length;
    const sameDayCompletions = allProgress.filter(p => {
      if (!p.completedAt) return false;
      const completedDate = new Date(p.completedAt).toDateString();
      const today = new Date().toDateString();
      return completedDate === today;
    }).length;
    
    return {
      totalStarted: allProgress.length,
      totalCompleted: completed,
      inProgress,
      streak: currentStreak,
      totalTime,
      sameDayCompletions,
    };
  }, [progress, currentStreak, totalTime]);

  // 本体课程统计
  const ontologyStats = useMemo(() => {
    return {
      ontologyCompleted: ontologyCompletedCount,
      ontologyByStage: {
        recognition: lessonsByStage.recognition.filter(l => l.isCompleted).length,
        topology: lessonsByStage.topology.filter(l => l.isCompleted).length,
        assembly: lessonsByStage.assembly.filter(l => l.isCompleted).length,
        evolution: lessonsByStage.evolution.filter(l => l.isCompleted).length,
      },
    };
  }, [ontologyCompletedCount, lessonsByStage]);

  // 全局统计
  const globalStats = useMemo(() => ({
    ...tutorialProgress,
    ...ontologyStats,
  }), [tutorialProgress, ontologyStats]);

  // 获取已解锁的成就
  const unlockedAchievements = useMemo(() => {
    return ACHIEVEMENTS.filter(a => a.condition(progress, globalStats));
  }, [ACHIEVEMENTS, progress, globalStats]);

  // 示例 SQL 代码
  const sampleSql = useMemo(() => {
    if (!selectedTutorial) return '';
    if (selectedTutorial.id === 'duckdb-basics' || selectedTutorial.id === 'duckdb-intro') {
      return `-- 创建示例表
CREATE TABLE departments (
    dept_id INTEGER PRIMARY KEY,
    dept_name VARCHAR(50) NOT NULL
);
INSERT INTO departments VALUES (1, '技术研发部'), (2, '市场营销部');
SELECT * FROM departments;`;
    }
    return '';
  }, [selectedTutorial]);

  // 推荐的下一个教程
  const nextTutorial = useMemo(() => {
    if (!selectedTutorial) return null;
    return getNextTutorial(selectedTutorial.id);
  }, [selectedTutorial]);

  // 当前教程进度
  const tutorialProgressData = useMemo(() => {
    if (!selectedTutorial) return null;
    return progress[selectedTutorial.id] || {
      tutorialId: selectedTutorial.id,
      completedSections: [],
      lastPosition: '',
      startedAt: new Date().toISOString(),
      totalSections: selectedTutorial.sections?.length || 0,
    };
  }, [progress, selectedTutorial]);

  // 完成百分比
  const completionPercent = useMemo(() => {
    if (!selectedTutorial?.sections || !tutorialProgressData) return 0;
    const total = selectedTutorial.sections.length;
    const completed = tutorialProgressData.completedSections?.length || 0;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }, [selectedTutorial, tutorialProgressData]);

  // 标记章节完成
  const markSectionComplete = useCallback((sectionId: string) => {
    if (!selectedTutorial) return;

    const current = progress[selectedTutorial.id] || {
      tutorialId: selectedTutorial.id,
      completedSections: [],
      lastPosition: sectionId,
      startedAt: new Date().toISOString(),
      totalSections: selectedTutorial.sections?.length || 0,
    };

    if (current.completedSections?.includes(sectionId)) return;

    const updated: LearningProgress = {
      ...current,
      completedSections: [...(current.completedSections || []), sectionId],
      lastPosition: sectionId,
    };

    if (selectedTutorial.sections && updated.completedSections.length >= selectedTutorial.sections.length) {
      updated.completedAt = new Date().toISOString();
    }

    const newProgress = { ...progress, [selectedTutorial.id]: updated };
    setProgress(newProgress);
    saveProgress(newProgress);
  }, [progress, selectedTutorial]);

  // ============================================================
  // 渲染逻辑
  // ============================================================

  // 首页视图
  if (!selectedTutorial) {
    const totalLessons = tutorials.length + 14; // SQL tutorials + Ontology lessons
    const totalCompleted = tutorialProgress.totalCompleted + ontologyCompletedCount;

    return (
      <div className="p-4 space-y-4">
        {/* 本体课程阶段进度 */}
        <div>
          <h3 className="text-xs font-bold text-monokai-comment uppercase tracking-wider mb-3 flex items-center gap-2">
            <Network className="w-4 h-4 text-monokai-cyan" />
            本体建模进度
            <span className="ml-auto text-[10px] font-normal">
              {ontologyCompletedCount}/14 课程
            </span>
          </h3>
          
          {/* 阶段进度卡片 */}
          <div className="grid grid-cols-2 gap-2">
            {ONTOLOGY_STAGES.map(stage => (
              <StageProgressCard
                key={stage.id}
                stage={stage}
                progress={stageProgress[stage.id]}
                completedCount={lessonsByStage[stage.id].filter(l => l.isCompleted).length}
                totalCount={lessonsByStage[stage.id].length}
              />
            ))}
          </div>
        </div>

        {/* 学习进度概览 */}
        <div>
          <h3 className="text-xs font-bold text-monokai-comment uppercase tracking-wider mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            学习概览
          </h3>
          
          {/* 进度条 */}
          <div className="bg-monokai-bg/40 rounded-lg p-3 mb-3">
            <div className="flex justify-between text-[10px] mb-1.5">
              <span className="text-monokai-comment">总进度</span>
              <span className="text-monokai-fg font-medium">
                {totalCompleted}/{totalLessons} 课程
              </span>
            </div>
            <div className="h-2 bg-monokai-accent/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-monokai-green to-monokai-cyan transition-all rounded-full"
                style={{ width: `${(totalCompleted / totalLessons) * 100}%` }}
              />
            </div>
          </div>

          {/* 统计卡片 */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <StatItem
              icon={<Clock className="w-4 h-4" />}
              value={formatTime(globalStats.totalTime)}
              label="累计学习"
              color="cyan"
            />
            <StatItem
              icon={<Flame className="w-4 h-4" />}
              value={`${globalStats.streak}天`}
              label="连续学习"
              color="orange"
            />
            <StatItem
              icon={<BookOpen className="w-4 h-4" />}
              value={totalCompleted}
              label="已完成"
              color="green"
            />
            <StatItem
              icon={<Zap className="w-4 h-4" />}
              value={globalStats.inProgress}
              label="进行中"
              color="yellow"
            />
          </div>
        </div>

        {/* 成就墙 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-monokai-comment uppercase tracking-wider flex items-center gap-2">
              <MedalIcon className="w-4 h-4" />
              成就墙 ({unlockedAchievements.length}/{ACHIEVEMENTS.length})
            </h3>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            {ACHIEVEMENTS.map(achievement => {
              const isUnlocked = unlockedAchievements.some(a => a.id === achievement.id);
              const achievementProgress = achievement.progress?.(progress, globalStats) || (isUnlocked ? 1 : 0);
              
              return (
                <AchievementCard
                  key={achievement.id}
                  achievement={achievement}
                  isUnlocked={isUnlocked}
                  progress={achievementProgress}
                />
              );
            })}
          </div>
        </div>

        {/* 进行中的教程 */}
        {Object.keys(progress).filter(id => !progress[id].completedAt && progress[id].completedSections?.length > 0).length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-monokai-comment uppercase tracking-wider mb-2 flex items-center gap-2">
              <Play className="w-4 h-4" />
              进行中
            </h3>
            <div className="space-y-1">
              {Object.entries(progress)
                .filter(([_, p]) => !p.completedAt && p.completedSections?.length > 0)
                .slice(0, 3)
                .map(([tutorialId, p]) => {
                  const tutorial = tutorials.find(t => t.id === tutorialId);
                  if (!tutorial) return null;
                  
                  const tutorialProg = p.completedSections.length / (p.totalSections || tutorial.sections?.length || 1);
                  
                  return (
                    <button
                      key={tutorialId}
                      onClick={() => {/* navigate to tutorial */}}
                      className="w-full text-left p-2.5 rounded-lg bg-monokai-bg/30 hover:bg-monokai-accent/20 transition-colors border border-monokai-border/30"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] text-monokai-fg font-medium truncate">{tutorial.title}</span>
                        <span className="text-[10px] text-monokai-cyan">{Math.round(tutorialProg * 100)}%</span>
                      </div>
                      <div className="h-1 bg-monokai-accent/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-monokai-cyan transition-all"
                          style={{ width: `${tutorialProg * 100}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 教程详情视图
  return (
    <div className="p-4 flex flex-col space-y-4">
      {/* 一键实践 */}
      {onTryCode && sampleSql && (
        <button
          onClick={() => onTryCode(sampleSql)}
          className="w-full py-2 bg-monokai-green/15 hover:bg-monokai-green/25 border border-monokai-green/30 rounded-lg text-monokai-green text-[10px] font-medium transition-colors flex items-center justify-center gap-1.5"
        >
          <Play className="w-3.5 h-3.5" />
          <span>一键实践</span>
        </button>
      )}

      {/* 进度概览 */}
      <div className="bg-monokai-bg/40 rounded-lg p-3">
        <div className="flex justify-between text-[10px] mb-1.5">
          <span className="text-monokai-comment">本章进度</span>
          <span className="text-monokai-fg font-medium">{completionPercent}%</span>
        </div>
        <div className="h-2 bg-monokai-accent/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-monokai-green to-monokai-blue transition-all rounded-full"
            style={{ width: `${completionPercent}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] text-monokai-comment">
          <span>{tutorialProgressData?.completedSections?.length || 0} / {selectedTutorial.sections?.length || 0} 章节</span>
          {tutorialProgressData?.startedAt && (
            <span>开始于 {formatDate(tutorialProgressData.startedAt)}</span>
          )}
        </div>
      </div>

      {/* 章节进度 */}
      {selectedTutorial.sections && selectedTutorial.sections.length > 0 && (
        <div className="flex-1">
          <button
            onClick={() => setExpandedSections(!expandedSections)}
            className="w-full flex items-center justify-between text-[10px] text-monokai-comment mb-2 hover:text-monokai-fg transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              章节列表
            </span>
            {expandedSections ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          
          {expandedSections && (
            <div className="space-y-0.5">
              {selectedTutorial.sections.map((section, index) => {
                const isCompleted = tutorialProgressData?.completedSections?.includes(section.id);
                return (
                  <SectionProgressItem
                    key={section.id}
                    section={section}
                    isCompleted={isCompleted || false}
                    index={index}
                    onClick={() => {
                      markSectionComplete(section.id);
                      onNavigateSection?.(section.anchor);
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 推荐下一教程 */}
      {nextTutorial && (
        <div className="pt-3 border-t border-monokai-accent/30">
          <div className="text-[10px] text-monokai-comment mb-2 flex items-center gap-1.5">
            <ChevronRight className="w-3 h-3" />
            下一课推荐
          </div>
          <button
            onClick={() => {/* navigate to next tutorial */}}
            className="w-full p-2.5 rounded-lg bg-monokai-blue/10 border border-monokai-blue/20 hover:bg-monokai-blue/20 transition-colors text-left"
          >
            <div className="text-[11px] text-monokai-blue font-medium truncate">
              {nextTutorial.title}
            </div>
            <div className="text-[10px] text-monokai-comment mt-0.5">
              {nextTutorial.difficulty} · {nextTutorial.estimatedTime}
            </div>
          </button>
        </div>
      )}

      {/* 完成提示 */}
      {completionPercent === 100 && (
        <div className="p-3 bg-monokai-green/10 border border-monokai-green/30 rounded-lg text-center">
          <Sparkles className="w-6 h-6 mx-auto mb-1 text-monokai-green" />
          <div className="text-sm font-bold text-monokai-green">🎉 恭喜完成！</div>
          <div className="text-[10px] text-monokai-comment mt-1">你已经完成了本教程的学习</div>
        </div>
      )}
    </div>
  );
};

export default ProgressTracker;
