/**
 * AcademyHub.tsx - DuckDB 数据实战学堂大厅 (4 大工业实战轨迹 + 技能树大盘)
 * 
 * 职责：
 * 1. 发现内容阶段总控：4 大工业实战技能轨迹 (Tracks)、全景精选货架 (Catalog)、体系路线图 (Roadmap) 与认知方法论 (Methodology) 四模态视图；
 * 2. 全局成就与技能大盘 (Hero Deck)：总课时、已通关数、达成率、技能等级与 XP 积分；
 * 3. 「继续上次学习」高优先级全宽沉浸卡片；
 * 4. 4 大专业进阶轨迹矩阵卡片（现代 SQL、湖仓与半结构化、高性能 OLAP、企业级本体建模）；
 * 5. 多维状态过滤（全部 / 未通关 / 已通关）、难度过滤、类别芯片与关键词即时检索；
 * 6. 沉淀复用入口联动（随堂笔记总览、片段库总览、自建 Markdown 教程导入）。
 */

import React, { useState, useMemo } from 'react';
import { 
  GraduationCap, Trophy, Clock, Search, Plus, 
  ArrowRight, Play, BookOpen, Terminal, Sparkles, 
  Layers, Compass, Trash2, CheckCircle2, ChevronRight, 
  Map, LayoutGrid, BookMarked, Bookmark, RotateCcw, 
  TrendingUp, Zap, Award, Check, BarChart3, Database
} from 'lucide-react';
import { 
  AcademyCourseItem, CourseDifficulty, CourseCategoryType,
  ALL_TRACKS, TrackMeta
} from './data/academyCurriculum';
import { AcademyRoadmapView } from './AcademyRoadmapView';
import { OntologyMethodologyView } from './OntologyMethodologyView';

interface AcademyHubProps {
  courses: AcademyCourseItem[];
  completedCourseIds: string[];
  lastAccessedCourseId?: string;
  onSelectCourse: (courseId: string) => void;
  onOpenUploadModal: () => void;
  onDeleteCustomCourse?: (courseId: string) => void;
  onOpenNotes?: () => void;
  onOpenSnippets?: () => void;
}

const DIFFICULTY_METAS: Record<CourseDifficulty, {
  label: string;
  subtitle: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  accentBar: string;
}> = {
  Beginner: {
    label: '初级入门 (Foundations)',
    subtitle: '零门槛快速上手：真实电商漏斗、QUALIFY窗口去重、基础条件过滤与虚拟数据生成',
    badgeBg: 'bg-emerald-500/10',
    badgeText: 'text-emerald-400',
    badgeBorder: 'border-emerald-500/30',
    accentBar: 'bg-emerald-500',
  },
  Intermediate: {
    label: '中级进阶 (Analytics & Cleaning)',
    subtitle: '业务实战洗练：JSON多层萃取、STRUCT/LIST动态解构、动态PIVOT与时序ASOF连接',
    badgeBg: 'bg-amber-500/10',
    badgeText: 'text-amber-400',
    badgeBorder: 'border-amber-500/30',
    accentBar: 'bg-amber-500',
  },
  Advanced: {
    label: '高级专家 (Advanced & Expert)',
    subtitle: '工业级架构与闭环：模糊对齐算法、列存剪枝调优、全案本体建模与冷链风控闭环',
    badgeBg: 'bg-rose-500/10',
    badgeText: 'text-rose-400',
    badgeBorder: 'border-rose-500/30',
    accentBar: 'bg-rose-500',
  },
};

const CATEGORY_CHIPS: { type: CourseCategoryType | 'all'; label: string; icon: React.ElementType }[] = [
  { type: 'all', label: '全部类别', icon: Layers },
  { type: 'sql', label: '工业 SQL 基石', icon: Terminal },
  { type: 'lesson', label: '14课本体实操', icon: BookOpen },
  { type: 'case', label: 'OPLA 工业工坊', icon: Compass },
  { type: 'doc', label: '官方讲义', icon: FileTextIcon },
  { type: 'custom', label: '自建课程', icon: Sparkles },
];

function FileTextIcon(props: any) {
  return <BookOpen {...props} />;
}

const TRACK_ICONS: Record<string, React.ElementType> = {
  Terminal,
  Layers,
  TrendingUp,
  Compass,
};

export const AcademyHub: React.FC<AcademyHubProps> = ({
  courses,
  completedCourseIds,
  lastAccessedCourseId,
  onSelectCourse,
  onOpenUploadModal,
  onDeleteCustomCourse,
  onOpenNotes,
  onOpenSnippets,
}) => {
  // 视图模式：tracks (实战技能轨迹 - 默认/主推), catalog (全景精选货架), roadmap (路径图), methodology (方法论)
  const [viewMode, setViewMode] = useState<'catalog' | 'tracks' | 'roadmap' | 'methodology'>('catalog');
  const [selectedDifficulty, setSelectedDifficulty] = useState<CourseDifficulty | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<CourseCategoryType | 'all'>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'uncompleted' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 统计数据
  const totalCount = courses.length;
  const completedCount = completedCourseIds.length;
  const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const totalMinutes = courses.reduce((acc, c) => acc + (c.estimatedMinutes || 10), 0);
  const xpPoints = completedCount * 120;

  // 技能称号
  const userRank = useMemo(() => {
    if (completedCount >= 12) return { title: '数据架构专家 Lv.4', desc: '融汇湖仓计算与企业本体建模', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' };
    if (completedCount >= 8) return { title: '高性能 OLAP 工程师 Lv.3', desc: '精通多维透视与时序撮合', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' };
    if (completedCount >= 4) return { title: '进阶数据分析师 Lv.2', desc: '掌握现代 SQL 窗口与半结构化清洗', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' };
    return { title: '初级探索者 Lv.1', desc: '起步工业级 DuckDB 实战之旅', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
  }, [completedCount]);

  // 上次学习的课程对象
  const lastAccessedCourse = useMemo(() => {
    if (!lastAccessedCourseId) return null;
    return courses.find(c => c.id === lastAccessedCourseId) || null;
  }, [lastAccessedCourseId, courses]);

  // 过滤后的课程
  const filteredCourses = useMemo(() => {
    return courses.filter(c => {
      // 难度过滤
      if (selectedDifficulty !== 'all' && c.difficulty !== selectedDifficulty) {
        return false;
      }
      // 类别过滤
      if (selectedCategory !== 'all' && c.categoryType !== selectedCategory) {
        return false;
      }
      // 标签过滤
      if (selectedTag && !c.tags.includes(selectedTag)) {
        return false;
      }
      // 状态过滤
      const isComp = completedCourseIds.includes(c.id);
      if (statusFilter === 'uncompleted' && isComp) return false;
      if (statusFilter === 'completed' && !isComp) return false;

      // 搜索过滤
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = c.title.toLowerCase().includes(q);
        const matchSummary = c.summary.toLowerCase().includes(q);
        const matchTags = c.tags.some(t => t.toLowerCase().includes(q));
        if (!matchTitle && !matchSummary && !matchTags) return false;
      }
      return true;
    });
  }, [courses, selectedDifficulty, selectedCategory, selectedTag, statusFilter, searchQuery, completedCourseIds]);

  const hasActiveFilters = selectedDifficulty !== 'all' || selectedCategory !== 'all' || selectedTag !== null || statusFilter !== 'all' || !!searchQuery.trim();

  const handleResetFilters = () => {
    setSelectedDifficulty('all');
    setSelectedCategory('all');
    setSelectedTag(null);
    setStatusFilter('all');
    setSearchQuery('');
  };

  // 按难度分组
  const beginnerCourses = useMemo(() => filteredCourses.filter(c => c.difficulty === 'Beginner'), [filteredCourses]);
  const intermediateCourses = useMemo(() => filteredCourses.filter(c => c.difficulty === 'Intermediate'), [filteredCourses]);
  const advancedCourses = useMemo(() => filteredCourses.filter(c => c.difficulty === 'Advanced'), [filteredCourses]);

  // 渲染单个课程卡片
  const renderCourseCard = (course: AcademyCourseItem) => {
    const isCompleted = completedCourseIds.includes(course.id);
    const meta = DIFFICULTY_METAS[course.difficulty];

    return (
      <div
        key={course.id}
        onClick={() => onSelectCourse(course.id)}
        className="group relative flex flex-col justify-between p-4 rounded-xl bg-[#12171f] border border-zinc-800 hover:border-cyan-500/50 hover:bg-[#161d27] transition-all duration-200 cursor-pointer shadow-sm hover:shadow-lg select-none"
      >
        {/* 顶部标签行 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder}`}>
                {course.difficulty === 'Beginner' ? '初级' : course.difficulty === 'Intermediate' ? '进阶' : '专家'}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-400 font-medium">
                {course.categoryLabel}
              </span>
              {course.inputTables && course.inputTables.length > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 font-mono">
                  {course.inputTables[0].tableName}
                </span>
              )}
              {course.isCustom && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/10 text-purple-400 font-semibold border border-purple-500/30">
                  自定义
                </span>
              )}
            </div>

            {/* 完成徽章 / 删除自定义课程 */}
            <div className="flex items-center gap-1">
              {isCompleted && (
                <span className="flex items-center gap-1 text-[10.5px] text-emerald-400 font-semibold bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5 fill-current" />
                  <span>已通关</span>
                </span>
              )}

              {course.isCustom && onDeleteCustomCourse && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`确定删除自定义课程「${course.title}」吗？`)) {
                      onDeleteCustomCourse(course.id);
                    }
                  }}
                  className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors ml-1"
                  title="删除该自定义课程"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* 课程标题 */}
          <h3 className="text-xs font-bold text-white group-hover:text-cyan-400 transition-colors line-clamp-1 mb-1.5">
            {course.title}
          </h3>

          {/* 简要描述 */}
          <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed mb-3">
            {course.summary}
          </p>
        </div>

        {/* 底部信息行 */}
        <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10.5px] text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>~{course.estimatedMinutes} 分钟</span>
            </span>

            {course.tags.length > 0 && (
              <span className="hidden sm:inline-block px-1.5 py-0.2 rounded bg-zinc-800/70 text-zinc-400">
                #{course.tags[0]}
              </span>
            )}
          </div>

          <span className="flex items-center gap-0.5 text-cyan-400 font-semibold group-hover:translate-x-0.5 transition-transform">
            <span>进入实操</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0c1015] text-[#d4d4d4] overflow-y-auto custom-scrollbar select-none font-sans">
      
      {/* ============================================================ */}
      {/* 1. 学堂大厅仪表盘 (Academy Hero Header Deck) */}
      {/* ============================================================ */}
      <section className="bg-gradient-to-b from-[#121922] via-[#0f141b] to-[#0c1015] border-b border-zinc-800/80 px-6 pt-7 pb-6 shrink-0">
        <div className="max-w-6xl mx-auto space-y-5">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* 标语与标识 */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-sm">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] tracking-widest font-mono text-cyan-400 font-bold uppercase">
                      DATA ACADEMY
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-zinc-800 text-zinc-400 font-mono border border-zinc-700">
                      DuckDB WASM
                    </span>
                  </div>
                  <h1 className="text-xl font-extrabold text-white tracking-tight">
                    DuckDB 数据实战学堂
                  </h1>
                </div>
              </div>
              <p className="text-xs text-zinc-400 max-w-2xl pl-0.5 leading-relaxed">
                企业级数据分析与领域本体建模实战工坊。涵盖电商漏斗、半结构化湖仓、QUALIFY 窗口分析与顺达冷链因果闭环。
              </p>
            </div>

            {/* 快捷操作区：导入教程 + 沉淀复用入口 */}
            <div className="flex items-center gap-2">
              {onOpenNotes && (
                <button
                  type="button"
                  onClick={onOpenNotes}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors cursor-pointer flex items-center gap-1.5"
                  title="查看所有随堂学习笔记"
                >
                  <BookMarked className="w-3.5 h-3.5 text-amber-400" />
                  <span>我的笔记</span>
                </button>
              )}

              {onOpenSnippets && (
                <button
                  type="button"
                  onClick={onOpenSnippets}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors cursor-pointer flex items-center gap-1.5"
                  title="查看所有已收藏的代码片段"
                >
                  <Bookmark className="w-3.5 h-3.5 text-cyan-400" />
                  <span>片段库</span>
                </button>
              )}

              <button
                type="button"
                onClick={onOpenUploadModal}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-black transition-colors shadow-sm cursor-pointer flex items-center gap-1.5 active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>导入教程</span>
              </button>
            </div>

          </div>

          {/* 进度看板卡片组 (Hero Achievement Deck) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            
            {/* 1. 通关进度 */}
            <div className="p-3.5 rounded-xl bg-[#12171f] border border-zinc-800 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10.5px] text-zinc-400 font-medium">通关进度</div>
                <div className="text-sm font-bold text-white font-mono">
                  {completedCount} <span className="text-xs text-zinc-500 font-normal">/ {totalCount} 课</span>
                </div>
              </div>
            </div>

            {/* 2. 达成率 */}
            <div className="p-3.5 rounded-xl bg-[#12171f] border border-zinc-800 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                <Trophy className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10.5px] text-zinc-400 font-medium">达成率</div>
                <div className="text-sm font-bold text-white font-mono">{completionPercentage}%</div>
                <div className="w-full bg-zinc-800 rounded-full h-1 mt-1 overflow-hidden">
                  <div className="bg-cyan-400 h-full rounded-full transition-all duration-300" style={{ width: `${completionPercentage}%` }} />
                </div>
              </div>
            </div>

            {/* 3. 总学时与经验 */}
            <div className="p-3.5 rounded-xl bg-[#12171f] border border-zinc-800 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10.5px] text-zinc-400 font-medium">总学时</div>
                <div className="text-sm font-bold text-white font-mono">
                  ~{totalMinutes} <span className="text-xs text-zinc-500 font-normal">分钟</span>
                </div>
              </div>
            </div>

            {/* 4. 技能树与等级 */}
            <div className="p-3.5 rounded-xl bg-[#12171f] border border-zinc-800 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${userRank.bg} ${userRank.color}`}>
                <Zap className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10.5px] text-zinc-400 font-medium">实战段位 ({xpPoints} XP)</div>
                <div className={`text-xs font-bold ${userRank.color} truncate font-mono`}>
                  {userRank.title}
                </div>
              </div>
            </div>

          </div>

          {/* 继续上次学习高光条 */}
          {lastAccessedCourse && (
            <div 
              onClick={() => onSelectCourse(lastAccessedCourse.id)}
              className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-500/10 via-[#12171f] to-[#12171f] border border-emerald-500/30 hover:border-emerald-500/60 transition-all flex items-center justify-between cursor-pointer group shadow-sm"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-black font-extrabold shrink-0 group-hover:scale-105 transition-transform">
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                      继续上次学习
                    </span>
                    <span className="text-[10.5px] text-zinc-400">· {lastAccessedCourse.categoryLabel}</span>
                  </div>
                  <h4 className="text-xs font-bold text-white truncate">
                    {lastAccessedCourse.title}
                  </h4>
                </div>
              </div>

              <div className="flex items-center gap-1 text-xs font-semibold text-emerald-400 shrink-0 pl-2">
                <span>进入试炼</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          )}

        </div>
      </section>

      {/* ============================================================ */}
      {/* 2. 浏览模式切换与多维检索栏 */}
      {/* ============================================================ */}
      <section className="bg-[#12171f]/95 border-b border-zinc-800 px-6 py-3.5 shrink-0 sticky top-0 z-10 backdrop-blur">
        <div className="max-w-6xl mx-auto space-y-3">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            
            {/* 左侧：视图模式切换 (实战技能轨迹 vs 精选货架 vs 体系路线图 vs 认知方法论) */}
            <div className="flex rounded-lg bg-zinc-800/80 p-0.5 text-xs font-medium w-fit flex-wrap border border-zinc-700/50">
              <button
                type="button"
                onClick={() => setViewMode('tracks')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                  viewMode === 'tracks'
                    ? 'bg-[#0c1015] text-emerald-400 font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>实战技能轨迹</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('catalog')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                  viewMode === 'catalog'
                    ? 'bg-[#0c1015] text-cyan-400 font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>精选货架</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('roadmap')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                  viewMode === 'roadmap'
                    ? 'bg-[#0c1015] text-emerald-400 font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Map className="w-3.5 h-3.5" />
                <span>学习路径图</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('methodology')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                  viewMode === 'methodology'
                    ? 'bg-[#0c1015] text-amber-400 font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>认知方法论</span>
              </button>
            </div>

            {/* 状态快捷过滤 (全部 / 未通关 / 已通关) */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-zinc-400 text-[11px] mr-1 hidden md:inline">状态:</span>
              {(['all', 'uncompleted', 'completed'] as const).map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                    statusFilter === st
                      ? 'bg-zinc-800 text-white font-semibold border border-zinc-700'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {st === 'all' ? '全部' : st === 'uncompleted' ? '未通关' : '已通关'}
                </button>
              ))}
            </div>

            {/* 搜索框 */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="搜索课程、SQL关键字或标签..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-800/90 text-white placeholder-zinc-500 rounded-lg border border-zinc-700 focus:border-cyan-400 focus:outline-none"
              />
            </div>

          </div>

          {/* 难度切换与类别筛选 (在精选货架与轨迹模式下展现) */}
          {(viewMode === 'catalog' || viewMode === 'tracks') && (
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pt-1 border-t border-zinc-800/80">
              
              {/* 难度 Tab */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSelectedDifficulty('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    selectedDifficulty === 'all'
                      ? 'bg-cyan-500 text-black font-bold'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  全部难度 ({courses.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDifficulty('Beginner')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    selectedDifficulty === 'Beginner'
                      ? 'bg-emerald-500 text-black font-bold'
                      : 'text-emerald-400 hover:bg-emerald-500/10'
                  }`}
                >
                  初级入门
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDifficulty('Intermediate')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    selectedDifficulty === 'Intermediate'
                      ? 'bg-amber-500 text-black font-bold'
                      : 'text-amber-400 hover:bg-amber-500/10'
                  }`}
                >
                  中级进阶
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDifficulty('Advanced')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    selectedDifficulty === 'Advanced'
                      ? 'bg-rose-500 text-white font-bold'
                      : 'text-rose-400 hover:bg-rose-500/10'
                  }`}
                >
                  高级专家
                </button>
              </div>

              {/* 类别筛选芯片与重置按钮 */}
              <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-0.5">
                {CATEGORY_CHIPS.map(chip => {
                  const ChipIcon = chip.icon;
                  const isSelected = selectedCategory === chip.type;
                  return (
                    <button
                      key={chip.type}
                      type="button"
                      onClick={() => setSelectedCategory(chip.type)}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer shrink-0 ${
                        isSelected
                          ? 'bg-zinc-800 text-cyan-400 font-bold border border-zinc-700'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <ChipIcon className="w-3 h-3" />
                      <span>{chip.label}</span>
                    </button>
                  );
                })}

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-semibold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors cursor-pointer shrink-0 ml-1"
                    title="清空全部筛选条件"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>重置</span>
                  </button>
                )}
              </div>

            </div>
          )}

        </div>
      </section>

      {/* ============================================================ */}
      {/* 3. 主体内容区 (Tracks / Methodology / Roadmap / Catalog) */}
      {/* ============================================================ */}
      <main className="flex-1 p-6 max-w-6xl mx-auto w-full space-y-8">
        
        {/* A. 认知方法论全景视图 */}
        {viewMode === 'methodology' ? (
          <OntologyMethodologyView
            onStartWorkshop={(caseId) => onSelectCourse(caseId || 'case-coldchain-shunda')}
            onExploreCurriculum={() => setViewMode('roadmap')}
          />
        ) : viewMode === 'roadmap' ? (
          /* B. 体系路线图视图 */
          <AcademyRoadmapView
            courses={courses}
            completedCourseIds={completedCourseIds}
            onSelectCourse={onSelectCourse}
          />
        ) : viewMode === 'tracks' ? (
          /* C. 4 大专业技能进阶轨迹矩阵视图 (Tracks View) */
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div>
                <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                  <span>4 大工业级实战技能轨迹</span>
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  以真实企业数据集为基石，串联从业务痛点推演到指标交付的完整闭环。
                </p>
              </div>
              <span className="text-xs font-mono text-zinc-500">
                16 门工业实战关卡
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {ALL_TRACKS.map(track => {
                const TrackIcon = TRACK_ICONS[track.iconName] || Terminal;
                const trackLessons = track.lessons;
                const completedInTrack = trackLessons.filter(l => completedCourseIds.includes(l.id)).length;
                const trackPercent = Math.round((completedInTrack / trackLessons.length) * 100);

                // 联动筛选
                const visibleLessons = trackLessons.filter(lesson => {
                  const isComp = completedCourseIds.includes(lesson.id);
                  if (statusFilter === 'uncompleted' && isComp) return false;
                  if (statusFilter === 'completed' && !isComp) return false;
                  if (selectedDifficulty !== 'all' && lesson.difficulty !== selectedDifficulty) return false;
                  if (searchQuery.trim()) {
                    const q = searchQuery.toLowerCase().trim();
                    const matchTitle = lesson.title.toLowerCase().includes(q);
                    const matchSubtitle = lesson.subtitle.toLowerCase().includes(q);
                    const matchTags = lesson.tags.some(t => t.toLowerCase().includes(q));
                    const matchScenario = lesson.businessScenario?.toLowerCase().includes(q);
                    if (!matchTitle && !matchSubtitle && !matchTags && !matchScenario) return false;
                  }
                  return true;
                });

                return (
                  <div 
                    key={track.id}
                    className="rounded-xl bg-[#12171f] border border-zinc-800 p-5 space-y-4 shadow-sm hover:border-zinc-700 transition-all"
                  >
                    {/* 轨迹头部 */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center font-bold"
                          style={{ backgroundColor: `${track.accentColor}15`, color: track.accentColor }}
                        >
                          <TrackIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">
                              {track.tagline}
                            </span>
                          </div>
                          <h3 className="text-sm font-extrabold text-white">
                            {track.title}
                          </h3>
                        </div>
                      </div>

                      {/* 进度 */}
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold font-mono text-white">
                          {completedInTrack} / {trackLessons.length} 课
                        </span>
                        <div className="w-20 bg-zinc-800 rounded-full h-1.5 mt-1 overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${trackPercent}%`, backgroundColor: track.accentColor }}
                          />
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {track.description}
                    </p>

                    {/* 课程列表 */}
                    <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                      {visibleLessons.length === 0 ? (
                        <div className="py-4 text-center text-xs text-zinc-500">
                          暂无符合当前筛选条件的关卡
                        </div>
                      ) : (
                        visibleLessons.map(lesson => {
                          const isLessonCompleted = completedCourseIds.includes(lesson.id);
                          return (
                            <div
                              key={lesson.id}
                              onClick={() => onSelectCourse(lesson.id)}
                              className="p-2.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800/90 border border-zinc-800/60 hover:border-cyan-500/40 transition-all cursor-pointer flex items-center justify-between group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center text-[10px] font-mono text-zinc-400 group-hover:text-cyan-400 font-bold shrink-0">
                                  0{lesson.order}
                                </span>
                                <div className="min-w-0">
                                  <h4 className="text-xs font-semibold text-white group-hover:text-cyan-400 transition-colors truncate">
                                    {lesson.title}
                                  </h4>
                                  <div className="flex items-center gap-2 text-[10px] text-zinc-500 mt-0.5">
                                    <span>~{lesson.estimatedMinutes}分钟</span>
                                    {lesson.inputTables && lesson.inputTables.length > 0 && (
                                      <span className="font-mono text-emerald-400/80">
                                        {lesson.inputTables[0].tableName}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="shrink-0 pl-2 flex items-center gap-1.5">
                                {isLessonCompleted ? (
                                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-500/30">
                                    <Check className="w-3 h-3" /> 已通关
                                  </span>
                                ) : (
                                  <span className="text-xs text-zinc-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all">
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* D. 全景精选货架视图模式 (Catalog) */
          <>
            {/* 1. 初级入门货架 */}
            {(selectedDifficulty === 'all' || selectedDifficulty === 'Beginner') && beginnerCourses.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-4 rounded-sm bg-emerald-500" />
                    <h2 className="text-sm font-bold text-white tracking-wide">
                      初级入门 (Foundations)
                    </h2>
                    <span className="text-xs text-zinc-500 font-mono">({beginnerCourses.length})</span>
                  </div>
                  <span className="text-[11px] text-zinc-400 hidden sm:inline">
                    {DIFFICULTY_METAS.Beginner.subtitle}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {beginnerCourses.map(renderCourseCard)}
                </div>
              </section>
            )}

            {/* 2. 中级进阶货架 */}
            {(selectedDifficulty === 'all' || selectedDifficulty === 'Intermediate') && intermediateCourses.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-4 rounded-sm bg-amber-500" />
                    <h2 className="text-sm font-bold text-white tracking-wide">
                      中级进阶 (Analytics & Cleaning)
                    </h2>
                    <span className="text-xs text-zinc-500 font-mono">({intermediateCourses.length})</span>
                  </div>
                  <span className="text-[11px] text-zinc-400 hidden sm:inline">
                    {DIFFICULTY_METAS.Intermediate.subtitle}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {intermediateCourses.map(renderCourseCard)}
                </div>
              </section>
            )}

            {/* 3. 高级专家货架 */}
            {(selectedDifficulty === 'all' || selectedDifficulty === 'Advanced') && advancedCourses.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-4 rounded-sm bg-rose-500" />
                    <h2 className="text-sm font-bold text-white tracking-wide">
                      高级专家 (Advanced & Expert)
                    </h2>
                    <span className="text-xs text-zinc-500 font-mono">({advancedCourses.length})</span>
                  </div>
                  <span className="text-[11px] text-zinc-400 hidden sm:inline">
                    {DIFFICULTY_METAS.Advanced.subtitle}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {advancedCourses.map(renderCourseCard)}
                </div>
              </section>
            )}

            {/* 空搜索结果 */}
            {filteredCourses.length === 0 && (
              <div className="h-64 flex flex-col items-center justify-center text-center text-zinc-500">
                <Search className="w-8 h-8 mb-2 opacity-30 text-cyan-400" />
                <p className="text-xs text-zinc-300">未检索到匹配的实战课程</p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  尝试清除搜索条件，或点击右上角「导入教程」上传自定义 Markdown 课程
                </p>
              </div>
            )}
          </>
        )}

      </main>

    </div>
  );
};

export default AcademyHub;
