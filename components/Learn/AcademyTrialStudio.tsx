/**
 * AcademyTrialStudio.tsx - 学堂技术文档流与轻量控制台实战工坊
 * 
 * 核心重构规范：
 * 1. 彻底移除永久占位的右侧分栏与冗余抽屉，采用类似 DuckDB / PostgreSQL 官方文档的宽屏纯净技术排版；
 * 2. 彻底消灭多 TAB 栏切换：各章节与分步代码块右上角自带「运行」与「复制」，点击即在底部控制台执行并直出数据表；
 * 3. 底部可拖拽/折叠控制台（AcademyBottomConsole）：平时静默收起，运行即升起，零干扰；
 * 4. 顶栏极致精简：仅保留核心导航、掌握标记与终端开关，去除所有说教与无关修饰。
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2, Circle, 
  Sparkles, Award, Target, Code2, Database,
  Terminal, Play, Copy, Check, ExternalLink, RotateCcw,
  AlertTriangle, ShieldCheck, ChevronDown, ChevronUp,
  BookOpen, Compass
} from 'lucide-react';
import { AcademyCourseItem } from './data/academyCurriculum';
import { AcademyBottomConsole } from './AcademyBottomConsole';
import { AcademyMarkdownReader } from './AcademyMarkdownReader';
import { OntologyLessonViewer } from './OntologyLessonViewer';
import { OntologyCaseStudio } from './OntologyCaseStudio';
import { useOntologyLessons } from '../../hooks/useOntologyLessons';
import { PRESET_MODELING_CASES, compileDuckDbSql, ModelingCase } from './data/mockCaseData';
import { loadTutorialContent } from './tutorialContentLoader';
import { getTutorialById, getUserTutorialContent } from '../../data/tutorials';
import { toastService } from '../../services/toastService';
import { duckDBService } from '../../services/duckdbService';

interface AcademyTrialStudioProps {
  course: AcademyCourseItem;
  allCourses: AcademyCourseItem[];
  isCompleted: boolean;
  onToggleComplete: (courseId: string) => void;
  onBackToHub: () => void;
  onNavigateToCourse: (courseId: string) => void;
  onOpenInGlobalSql?: (sql: string) => void;
}

const DIFFICULTY_CONFIG: Record<string, { label: string; text: string; bg: string; border: string }> = {
  Beginner: { label: '初级入门', text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  Intermediate: { label: '进阶实战', text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
  Advanced: { label: '专家高阶', text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
};

export const AcademyTrialStudio: React.FC<AcademyTrialStudioProps> = ({
  course,
  allCourses,
  isCompleted,
  onToggleComplete,
  onBackToHub,
  onNavigateToCourse,
  onOpenInGlobalSql,
}) => {
  // 当前活动 SQL 代码
  const [activeSql, setActiveSql] = useState<string>(course.initialSql);

  // 底部控制台开关状态（默认在底部停靠，用户可随时收起或点击正文运行重新呼出）
  const [isConsoleOpen, setIsConsoleOpen] = useState(true);

  // 代码复制状态标记
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // 表形态展开状态
  const [showInputSchema, setShowInputSchema] = useState(true);

  // 输入模拟表自动初始化
  const [tablesReady, setTablesReady] = useState(false);
  const [isInitializingTables, setIsInitializingTables] = useState(false);

  const handleInitializeTables = useCallback(async (isReset = false) => {
    if (!course.inputTables || course.inputTables.length === 0) return;
    setIsInitializingTables(true);
    try {
      for (const tbl of course.inputTables) {
        if (tbl.setupSql) {
          await duckDBService.executeAndAuditWithMetadata(
            tbl.setupSql,
            'CREATE',
            'academy_setup',
            `初始化 ${tbl.tableName}`
          );
        }
      }
      setTablesReady(true);
      if (isReset) {
        toastService.success(`已重置 ${course.inputTables.length} 张模拟业务表！`);
      }
    } catch (err: any) {
      console.warn('[AcademyTrialStudio] Failed to initialize input tables:', err);
    } finally {
      setIsInitializingTables(false);
    }
  }, [course.inputTables]);

  useEffect(() => {
    if (course.inputTables && course.inputTables.length > 0) {
      handleInitializeTables(false);
    } else {
      setTablesReady(true);
    }
  }, [course.id, course.inputTables, handleInitializeTables]);

  // 当课程切换时，更新当前激活的 SQL 并关闭控制台
  useEffect(() => {
    setActiveSql(course.initialSql);
  }, [course.id, course.initialSql]);

  // 14 课故事课程支撑
  const { currentLesson, selectLesson, markLessonComplete, markSectionComplete } = useOntologyLessons();
  useEffect(() => {
    if (course.categoryType === 'lesson' && course.refId) {
      selectLesson(course.refId);
    }
  }, [course.id, course.categoryType, course.refId, selectLesson]);

  // 官方讲义/用户自定义教程 Markdown 内容加载
  const [docContent, setDocContent] = useState<string>(course.content || '');
  const [loadingDoc, setLoadingDoc] = useState(false);

  useEffect(() => {
    if (course.content) {
      setDocContent(course.content);
      return;
    }
    if (course.categoryType === 'doc' && course.refId) {
      const tut = getTutorialById(course.refId);
      if (tut) {
        setLoadingDoc(true);
        const controller = new AbortController();
        loadTutorialContent(tut, {
          signal: controller.signal,
          fetchDocument: (p, i) => fetch(p, i),
          getUserContent: getUserTutorialContent,
          getEmbeddedContent: () => tut.description || '',
        })
          .then(c => setDocContent(c))
          .catch(() => setDocContent('无法加载讲义内容，请稍后重试。'))
          .finally(() => setLoadingDoc(false));
        return () => controller.abort();
      }
    }
  }, [course.id, course.categoryType, course.refId, course.content]);

  // 上一课 / 下一课计算
  const currentIndex = allCourses.findIndex(c => c.id === course.id);
  const prevCourse = currentIndex > 0 ? allCourses[currentIndex - 1] : null;
  const nextCourse = currentIndex < allCourses.length - 1 ? allCourses[currentIndex + 1] : null;

  // 案例数据与 OPLA 看板交互
  const matchedCase = useMemo(() => {
    if (course.categoryType === 'case' && course.refId) {
      return PRESET_MODELING_CASES.find(c => c.id === course.refId) || null;
    }
    return null;
  }, [course.categoryType, course.refId]);

  const [activeCase, setActiveCase] = useState<ModelingCase | null>(matchedCase);
  const [selectedCaseObjId, setSelectedCaseObjId] = useState<string>('');

  useEffect(() => {
    setActiveCase(matchedCase);
    if (matchedCase && matchedCase.referenceModel.objects.length > 0) {
      setSelectedCaseObjId(matchedCase.referenceModel.objects[0].id);
    }
  }, [matchedCase]);

  const handleCaseChange = (updated: ModelingCase) => {
    setActiveCase(updated);
    const compiledSql = compileDuckDbSql(updated);
    setActiveSql(compiledSql);
  };

  const diffConfig = DIFFICULTY_CONFIG[course.difficulty] || DIFFICULTY_CONFIG.Beginner;

  // 复制指定代码
  const handleCopyCode = (key: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedKey(key);
    toastService.success('代码已复制到剪贴板');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // 运行指定代码：填入底部控制台、展开控制台并执行
  const handleRunCode = (code: string) => {
    setActiveSql(code);
    setIsConsoleOpen(true);
  };

  return (
    <div className="flex flex-col h-full bg-[#0c1015] text-[#d4d4d4] overflow-hidden font-sans select-none relative">
      
      {/* ============================================================ */}
      {/* 1. 极致精简顶栏 (Header) */}
      {/* ============================================================ */}
      <header className="h-11 shrink-0 bg-[#12171f] border-b border-zinc-800 px-4 flex items-center justify-between z-20 select-none">
        
        {/* 左侧：返回大厅 + 难度 + 标题 */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onBackToHub}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
            title="返回学堂大厅"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>返回大厅</span>
          </button>

          <span className="text-zinc-700 text-sm hidden sm:inline">|</span>

          {/* 难度标识 */}
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${diffConfig.bg} ${diffConfig.text} ${diffConfig.border} shrink-0`}>
            {diffConfig.label}
          </span>

          {/* 课程标题 */}
          <h2 className="text-xs font-bold text-white truncate max-w-xs sm:max-w-md md:max-w-lg">
            {course.title}
          </h2>
        </div>

        {/* 右侧：在工作台打开 + 标记掌握 + 上一课/下一课 + 终端控制台开关 */}
        <div className="flex items-center gap-2 shrink-0">
          
          {/* 在工作台实战 */}
          {onOpenInGlobalSql && (
            <button
              type="button"
              onClick={() => {
                onOpenInGlobalSql(activeSql);
                toastService.success('已载入主工作台，正在为您跳转...');
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-zinc-400 hover:text-cyan-400 hover:bg-zinc-800 transition-colors cursor-pointer"
              title="在主 SQL 工作台中打开当前代码"
            >
              <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline text-[11px]">在工作台实战</span>
            </button>
          )}

          {/* 标记掌握 */}
          <button
            type="button"
            onClick={() => onToggleComplete(course.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
              isCompleted
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-zinc-800 text-zinc-400 hover:text-white border-zinc-700 hover:border-zinc-600'
            }`}
          >
            {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5 fill-current" /> : <Circle className="w-3.5 h-3.5" />}
            <span>{isCompleted ? '已通关' : '标记已掌握'}</span>
          </button>

          <span className="text-zinc-700 text-sm">|</span>

          {/* 上一课 */}
          <button
            type="button"
            onClick={() => prevCourse && onNavigateToCourse(prevCourse.id)}
            disabled={!prevCourse}
            className={`p-1.5 rounded-lg text-xs flex items-center transition-colors ${
              prevCourse ? 'text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer' : 'text-zinc-600 cursor-not-allowed'
            }`}
            title={prevCourse ? `上一课: ${prevCourse.title}` : '已是第一课'}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* 下一课 */}
          <button
            type="button"
            onClick={() => nextCourse && onNavigateToCourse(nextCourse.id)}
            disabled={!nextCourse}
            className={`p-1.5 rounded-lg text-xs flex items-center transition-colors ${
              nextCourse ? 'text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer' : 'text-zinc-600 cursor-not-allowed'
            }`}
            title={nextCourse ? `下一课: ${nextCourse.title}` : '已是最后一课'}
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <span className="text-zinc-700 text-sm">|</span>

          {/* 底部控制台开关 */}
          <button
            type="button"
            onClick={() => setIsConsoleOpen(!isConsoleOpen)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
              isConsoleOpen 
                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
                : 'bg-zinc-800 text-zinc-300 hover:text-white border-zinc-700'
            }`}
            title="展开/收起 DuckDB 运行控制台"
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span>控制台</span>
          </button>

        </div>
      </header>

      {/* ============================================================ */}
      {/* 2. 单栏宽屏纯净技术文档流 (Clean Technical Document Stream) */}
      {/* ============================================================ */}
      <main className="flex-1 overflow-y-auto bg-[#0c1015] custom-scrollbar select-text pb-28">
        
        {/* A. SQL 实战课程技术文档排版 */}
        {course.categoryType === 'sql' && (
          <article className="max-w-4xl mx-auto py-8 px-6 space-y-8">
            
            {/* 章节标题区 */}
            <div className="border-b border-zinc-800/80 pb-5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
                <span>{course.trackTitle || 'DuckDB 现代分析'}</span>
                <span>/</span>
                <span>{course.id}</span>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {course.title}
              </h1>
              <p className="text-sm text-zinc-400 leading-relaxed">
                {course.summary}
              </p>
            </div>

            {/* 1. 为什么这一步至关重要？ */}
            <section className="space-y-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>为什么这一步至关重要？</span>
              </h2>
              {course.businessScenario && (
                <div className="p-3.5 rounded-lg bg-[#12171f] border-l-3 border-amber-400 text-xs text-zinc-300 leading-relaxed">
                  <strong className="text-amber-300 mr-1.5">业务背景:</strong>
                  {course.businessScenario}
                </div>
              )}
              <p className="text-xs text-zinc-300 leading-relaxed">
                {course.whyItMatters || course.summary}
              </p>
            </section>

            {/* 2. 涉及数据表形态 (Input Tables Schema) */}
            {course.inputTables && course.inputTables.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-400" />
                    <span>涉及数据表形态 ({course.inputTables.length})</span>
                  </h2>
                  <div className="flex items-center gap-2">
                    {isInitializingTables ? (
                      <span className="text-[11px] text-amber-400 animate-pulse">正在初始化数据...</span>
                    ) : tablesReady ? (
                      <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> 数据已就绪
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleInitializeTables(true)}
                      disabled={isInitializingTables}
                      className="px-2 py-0.5 rounded text-[10.5px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors flex items-center gap-1 cursor-pointer"
                      title="重置数据表"
                    >
                      <RotateCcw className={`w-3 h-3 ${isInitializingTables ? 'animate-spin' : ''}`} />
                      <span>重置数据</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowInputSchema(!showInputSchema)}
                      className="text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer ml-1"
                    >
                      {showInputSchema ? '收起' : '展开'}
                    </button>
                  </div>
                </div>

                {showInputSchema && (
                  <div className="space-y-3">
                    {course.inputTables.map((tbl, tIdx) => (
                      <div key={tIdx} className="rounded-xl bg-[#12171f] border border-zinc-800 overflow-hidden">
                        <div className="p-3 bg-zinc-900/80 border-b border-zinc-800/80 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                              {tbl.tableName}
                            </span>
                            <span className="text-xs text-zinc-400">{tbl.description}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRunCode(`SELECT * FROM ${tbl.tableName} LIMIT 5;`)}
                            className="px-2.5 py-1 rounded text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-cyan-400 border border-zinc-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>预览数据 (LIMIT 5)</span>
                          </button>
                        </div>
                        <div className="p-3 flex flex-wrap gap-2">
                          {tbl.columns.map(col => (
                            <div key={col.name} className="px-2 py-1 rounded bg-zinc-950 border border-zinc-800 text-[11px] font-mono flex items-center gap-1.5">
                              <span className="text-zinc-200 font-semibold">{col.name}</span>
                              <span className="text-cyan-400/80 text-[10px]">:{col.type}</span>
                              {col.comment && <span className="text-zinc-500 text-[10px]">({col.comment})</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* 3. 核心语法与示例代码 */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-cyan-400" />
                  <span>核心示例实现</span>
                </h2>
              </div>
              <div className="rounded-xl bg-[#0d1117] border border-zinc-800 overflow-hidden shadow-lg">
                <div className="h-9 px-4 bg-[#161b22] border-b border-zinc-800 flex items-center justify-between text-xs select-none">
                  <span className="font-mono text-zinc-400 text-[11px]">SQL · DuckDB</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyCode('base', course.initialSql)}
                      className="px-2 py-0.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex items-center gap-1 text-[11px] cursor-pointer"
                    >
                      {copiedKey === 'base' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'base' ? '已复制' : '复制'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRunCode(course.initialSql)}
                      className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-400 hover:bg-emerald-300 text-black transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-xs"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>执行示例</span>
                    </button>
                  </div>
                </div>
                <pre className="p-4 text-xs font-mono text-zinc-200 overflow-x-auto leading-relaxed custom-scrollbar bg-transparent">
                  <code>{course.initialSql}</code>
                </pre>
              </div>
            </section>

            {/* 4. 循序渐进 · 分步演练 */}
            {course.steps && course.steps.length > 0 && (
              <section className="space-y-4 pt-2">
                <div className="border-t border-zinc-800/80 pt-6">
                  <h2 className="text-base font-bold text-white flex items-center gap-2 mb-1">
                    <Target className="w-4 h-4 text-emerald-400" />
                    <span>循序渐进 · 分步演练</span>
                  </h2>
                  <p className="text-xs text-zinc-400">
                    按照业务逻辑逐步推演，点击即可在底部控制台即时执行并查看数据演变
                  </p>
                </div>

                <div className="space-y-4">
                  {course.steps.map((step, idx) => (
                    <div key={step.id} className="rounded-xl bg-[#12171f] border border-zinc-800 overflow-hidden">
                      <div className="p-3 bg-zinc-900/60 border-b border-zinc-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-mono font-bold text-[11px]">
                            {idx + 1}
                          </span>
                          <h3 className="text-xs font-bold text-zinc-200">{step.title}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopyCode(`step-${idx}`, step.sql)}
                            className="px-2 py-0.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex items-center gap-1 text-[11px] cursor-pointer"
                          >
                            {copiedKey === `step-${idx}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>复制</span>
                          </button>
                          <button
                            type="button"
                            name={`Step ${idx + 1}`}
                            onClick={() => handleRunCode(step.sql)}
                            className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-400 hover:bg-emerald-300 text-black transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-xs"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>Step {idx + 1}</span>
                          </button>
                        </div>
                      </div>
                      <div className="p-3 space-y-2.5">
                        <p className="text-xs text-zinc-400 leading-relaxed">{step.description || step.explanation}</p>
                        <div className="rounded-lg bg-[#0c1015] border border-zinc-800 p-3 font-mono text-xs text-zinc-300 overflow-x-auto">
                          <code>{step.sql}</code>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 5. 实战挑战目标 */}
            {course.challenge && (
              <section className="space-y-3 pt-2">
                <div className="border-t border-zinc-800/80 pt-6">
                  <h2 className="text-base font-bold text-amber-300 flex items-center gap-2 mb-1">
                    <Award className="w-4 h-4" />
                    <span>实战挑战目标</span>
                  </h2>
                  <p className="text-xs text-zinc-400">
                    检验是否真正理解语法机制，载入模板并根据要求编写你的解决方案
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#12171f] border border-amber-500/30 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xs font-bold text-white mb-1">【挑战任务】</h3>
                      <p className="text-xs text-zinc-300 leading-relaxed">{course.challenge.question}</p>
                    </div>
                    <button
                      type="button"
                      name="载入挑战模板"
                      onClick={() => handleRunCode(course.challenge?.starterSql || course.initialSql)}
                      className="px-3 py-1 rounded text-xs font-bold bg-amber-400 hover:bg-amber-300 text-black transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs active:scale-95"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>载入挑战模板</span>
                    </button>
                  </div>
                  {course.challenge.starterSql && (
                    <div className="rounded-lg bg-[#0c1015] border border-zinc-800 p-3 font-mono text-xs text-zinc-300 overflow-x-auto">
                      <code>{course.challenge.starterSql}</code>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* 6. 关键避坑与底层原理 */}
            {(course.antiPattern || course.explanation) && (
              <section className="space-y-3 pt-2">
                <div className="border-t border-zinc-800/80 pt-6">
                  <h2 className="text-base font-bold text-white flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>关键避坑与底层原理</span>
                  </h2>
                  <p className="text-xs text-zinc-400">
                    技术要点与 DuckDB 向量化执行机理深度解析
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {course.antiPattern && (
                    <div className="p-4 rounded-xl bg-[#12171f] border border-rose-500/30 space-y-2">
                      <div className="flex items-center gap-1.5 text-rose-400 font-bold text-xs">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>❌ 常见反模式 / 陷阱</span>
                      </div>
                      {typeof course.antiPattern === 'object' ? (
                        <>
                          <div className="p-2.5 rounded bg-zinc-950 font-mono text-xs text-rose-300/90 overflow-x-auto border border-zinc-800">
                            <code>{course.antiPattern.badSql}</code>
                          </div>
                          <p className="text-xs text-zinc-400 leading-relaxed">{course.antiPattern.problem}</p>
                        </>
                      ) : (
                        <p className="text-xs text-zinc-400 leading-relaxed">{course.antiPattern}</p>
                      )}
                    </div>
                  )}

                  {course.bestPractice && (
                    <div className="p-4 rounded-xl bg-[#12171f] border border-emerald-500/30 space-y-2">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>✅ 生产最佳实践</span>
                      </div>
                      {typeof course.bestPractice === 'object' ? (
                        <>
                          <div className="p-2.5 rounded bg-zinc-950 font-mono text-xs text-emerald-300/90 overflow-x-auto border border-zinc-800">
                            <code>{course.bestPractice.goodSql}</code>
                          </div>
                          <p className="text-xs text-zinc-400 leading-relaxed">{course.bestPractice.reason}</p>
                        </>
                      ) : (
                        <p className="text-xs text-zinc-400 leading-relaxed">{course.bestPractice}</p>
                      )}
                    </div>
                  )}
                </div>

                {course.explanation && (
                  <div className="p-3 rounded-lg bg-[#12171f] border border-zinc-800 text-xs text-zinc-400 leading-relaxed">
                    💡 <strong className="text-zinc-200">引擎原理解析：</strong>{course.explanation}
                  </div>
                )}
              </section>
            )}

            {/* 7. 生产级沉淀复用 */}
            {course.productionTemplate && (
              <section className="space-y-3 pt-2">
                <div className="border-t border-zinc-800/80 pt-6">
                  <h2 className="text-base font-bold text-white flex items-center gap-2 mb-1">
                    <Database className="w-4 h-4 text-cyan-400" />
                    <span>生产级沉淀复用 (CREATE VIEW)</span>
                  </h2>
                  <p className="text-xs text-zinc-400">
                    可直接在业务数仓或分析管道中作为物化层/视图固化复用
                  </p>
                </div>

                <div className="rounded-xl bg-[#0d1117] border border-cyan-500/30 overflow-hidden">
                  <div className="p-3 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between">
                    <span className="text-xs font-mono text-cyan-400 font-semibold">{course.productionTemplate.title}</span>
                    <button
                      type="button"
                      onClick={() => handleRunCode(course.productionTemplate!.ddlSql || course.productionTemplate!.templateSql)}
                      className="px-2.5 py-1 rounded text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-black transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>在 DuckDB 注册此视图</span>
                    </button>
                  </div>
                  <pre className="p-3.5 text-xs font-mono text-zinc-300 overflow-x-auto custom-scrollbar">
                    <code>{course.productionTemplate.ddlSql || course.productionTemplate.templateSql}</code>
                  </pre>
                </div>
              </section>
            )}

          </article>
        )}

        {/* B. 14 课故事化本体实战课程 */}
        {course.categoryType === 'lesson' && currentLesson && (
          <div className="max-w-4xl mx-auto py-8 px-6">
            <OntologyLessonViewer
              lesson={currentLesson}
              onGoHome={onBackToHub}
              onCompleteSection={(secId) => markSectionComplete(currentLesson.id, secId)}
              onCompleteLesson={() => {
                markLessonComplete(currentLesson.id);
                onToggleComplete(course.id);
              }}
              onNavigateToLesson={(lessonId) => {
                const targetCourse = allCourses.find(c => c.refId === lessonId);
                if (targetCourse) onNavigateToCourse(targetCourse.id);
              }}
              onTryCode={(code) => handleRunCode(code)}
            />
          </div>
        )}

        {/* C. OPLA 工业案例工坊 (激活交互式 4 柱看板与拓扑) */}
        {course.categoryType === 'case' && activeCase && (
          <div className="flex flex-col h-full">
            <div className="p-3 bg-[#12171f] border-b border-zinc-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Compass className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-bold text-white truncate">
                  【{activeCase.industry}】{activeCase.title}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const sql = compileDuckDbSql(activeCase);
                  handleRunCode(sql);
                  toastService.success('已编译当前 OPLA 模型并在控制台执行！');
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500 text-black hover:bg-emerald-400 transition-colors flex items-center gap-1 cursor-pointer shrink-0 shadow-sm"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>编译并在试炼场运行</span>
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
              <OntologyCaseStudio
                currentCase={activeCase}
                onChangeCase={handleCaseChange}
                selectedObjectId={selectedCaseObjId}
                onSelectObject={setSelectedCaseObjId}
                onResetStandard={() => {
                  if (matchedCase) {
                    setActiveCase(matchedCase);
                    setActiveSql(matchedCase.sampleDuckDbSql || course.initialSql);
                    toastService.info('已恢复为标准参考模型');
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* D. 官方讲义与自建 Markdown 教程 */}
        {(course.categoryType === 'doc' || course.categoryType === 'custom') && (
          <div className="max-w-4xl mx-auto py-8 px-6">
            {loadingDoc ? (
              <div className="flex items-center justify-center h-48 text-xs text-zinc-500">
                正在加载讲义与文档...
              </div>
            ) : (
              <AcademyMarkdownReader
                content={docContent}
                onTryCode={(code) => handleRunCode(code)}
                showToc={true}
              />
            )}
          </div>
        )}

      </main>

      {/* ============================================================ */}
      {/* 3. 底部可拖拽/折叠轻量控制台 (AcademyBottomConsole) */}
      {/* ============================================================ */}
      <AcademyBottomConsole
        isOpen={isConsoleOpen}
        onClose={() => setIsConsoleOpen(false)}
        sql={activeSql}
        onSqlChange={setActiveSql}
        courseTitle={course.title}
        onOpenInGlobalSql={onOpenInGlobalSql}
      />

    </div>
  );
};

export default AcademyTrialStudio;
