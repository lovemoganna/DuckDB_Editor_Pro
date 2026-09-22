/**
 * OntologyLessonViewer - 沉浸式单流本体建模学习查看器 (无 TAB 纯净技术长文流)
 * 
 * 核心重构哲学：
 * 1. 彻底消灭 5 步 TAB 栏切换：告别翻页步进器，全文单向连贯滚动，沉浸顺畅；
 * 2. 五大维度垂直排版：
 *    - 场景故事与原文证据 (Scene & Dilemma)
 *    - 直觉误区 vs 本体准则 (Trap vs Aha!)
 *    - 直观模型与 OPLA 决策架构 (Visual Model & Golden Rule)
 *    - 动手推演与底层 DuckDB 执行 (Interactive Lab & SQL)
 *    - 通关自测与架构认知检验 (Checkpoint Challenge)
 * 3. 统一采用现代深空暗黑开发者规范 (#0c1015, #12171f, border-zinc-800)。
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ChevronLeft, ChevronRight, CheckCircle2,
  Play, Copy, Check, AlertTriangle,
  Clock, Zap, Network, Share2,
  HelpCircle, Lightbulb, BookOpen, Award, RotateCcw, X,
  Target, Compass, GitBranch, CheckSquare, Layers
} from 'lucide-react';
import { 
  OntologyLesson, 
  ONTOLOGY_STAGE_LABELS,
  getSeedDataForLesson 
} from '../../hooks/useOntologyLessons';
import { LESSON_STEP_FLOWS, LessonStepFlow } from '../../data/ontologyCurriculum';
import { OntologyInteractiveViewer } from './OntologyInteractiveViewer';

interface OntologyLessonViewerProps {
  lesson: OntologyLesson;
  onGoHome?: () => void;
  onCompleteSection: (sectionId: string) => void;
  onCompleteLesson: () => void;
  onNavigateToLesson: (lessonId: string) => void;
  onTryCode?: (code: string) => void;
  onOpenTable?: (tableName: string) => void;
}

export const OntologyLessonViewer: React.FC<OntologyLessonViewerProps> = ({
  lesson,
  onGoHome,
  onCompleteSection,
  onCompleteLesson,
  onNavigateToLesson,
  onTryCode,
}) => {
  // 动手推演是否已触发
  const [hasSimulated, setHasSimulated] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  // 代码与原文复制状态
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedQuote, setCopiedQuote] = useState(false);

  // 挑战单选题状态
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);

  // 全屏拓扑网络漫游模态框
  const [showCanvasModal, setShowCanvasModal] = useState(false);

  // 步骤 4 验证清单互动勾选状态
  const [checkedVerificationItems, setCheckedVerificationItems] = useState<Set<number>>(new Set());

  // 获取本课专属教学流配置
  const stepFlow = useMemo<LessonStepFlow>(() => {
    if (LESSON_STEP_FLOWS[lesson.number]) {
      return LESSON_STEP_FLOWS[lesson.number];
    }
    return LESSON_STEP_FLOWS[1];
  }, [lesson.number]);

  // 零延迟同步加载种子数据
  const seedData = useMemo(() => {
    return getSeedDataForLesson(lesson.number);
  }, [lesson.number]);

  // 课程切换时重置状态
  useEffect(() => {
    setHasSimulated(false);
    setSelectedOption(null);
    setHasAnswered(false);
    setShowCanvasModal(false);
    setCheckedVerificationItems(new Set());
  }, [lesson.id]);

  // 阶段专属配色
  const stageStyles = useMemo(() => {
    switch (lesson.stage) {
      case 'recognition':
        return {
          textColor: 'text-cyan-400',
          bgColor: 'bg-cyan-500/10',
          borderColor: 'border-cyan-500/30',
        };
      case 'topology':
        return {
          textColor: 'text-sky-400',
          bgColor: 'bg-sky-500/10',
          borderColor: 'border-sky-500/30',
        };
      case 'assembly':
        return {
          textColor: 'text-emerald-400',
          bgColor: 'bg-emerald-500/10',
          borderColor: 'border-emerald-500/30',
        };
      case 'evolution':
        return {
          textColor: 'text-amber-400',
          bgColor: 'bg-amber-500/10',
          borderColor: 'border-amber-500/30',
        };
      default:
        return {
          textColor: 'text-cyan-400',
          bgColor: 'bg-cyan-500/10',
          borderColor: 'border-cyan-500/30',
        };
    }
  }, [lesson.stage]);

  // 上下课导航 ID
  const prevLessonId = useMemo(() => {
    if (lesson.number <= 1) return null;
    return `ontology-lesson-${String(lesson.number - 1).padStart(4, '0')}`;
  }, [lesson.number]);

  const nextLessonId = useMemo(() => {
    if (lesson.number >= 14) return null;
    return `ontology-lesson-${String(lesson.number + 1).padStart(4, '0')}`;
  }, [lesson.number]);

  // 触发动手推演
  const handleTriggerSimulation = useCallback(() => {
    setIsSimulating(true);
    setTimeout(() => {
      setIsSimulating(false);
      setHasSimulated(true);
      onCompleteSection(`lesson-${lesson.number}-simulation`);
    }, 450);
  }, [lesson.number, onCompleteSection]);

  // 提交单选答案
  const handleSelectQuizOption = useCallback((index: number) => {
    setSelectedOption(index);
    setHasAnswered(true);
    if (index === stepFlow.challenge.correctIndex) {
      onCompleteLesson();
      onCompleteSection(`lesson-${lesson.number}-quiz`);
    }
  }, [stepFlow.challenge.correctIndex, lesson.number, onCompleteLesson, onCompleteSection]);

  // 重置测验允许重试
  const handleResetQuiz = useCallback(() => {
    setSelectedOption(null);
    setHasAnswered(false);
  }, []);

  // 复制代码
  const handleCopySql = useCallback((sqlText: string) => {
    navigator.clipboard.writeText(sqlText);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  }, []);

  // 复制材料原文
  const handleCopyQuote = useCallback((quoteText: string) => {
    navigator.clipboard.writeText(quoteText);
    setCopiedQuote(true);
    setTimeout(() => setCopiedQuote(false), 2000);
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#0c1015] text-[#d4d4d4] select-text overflow-hidden font-sans">
      
      {/* ============================================================ */}
      {/* 1. 极致精简顶栏 (无任何 TAB 切换) */}
      {/* ============================================================ */}
      <header className="h-11 shrink-0 border-b border-zinc-800 bg-[#12171f] px-4 flex items-center justify-between z-20 gap-3 select-none">
        
        {/* 左侧：返回大纲 + 阶段徽章 + 课号标题 + 上下课微调器 */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={onGoHome}
            className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1 shrink-0"
            title="返回教程大纲"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>返回大纲</span>
          </button>

          <span className="text-zinc-700 shrink-0">|</span>

          {/* 阶段徽章 */}
          <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${stageStyles.bgColor} ${stageStyles.textColor} border ${stageStyles.borderColor}`}>
            {ONTOLOGY_STAGE_LABELS[lesson.stage]}
          </span>

          {/* 课号与标题 */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`text-xs font-bold font-mono ${stageStyles.textColor} shrink-0`}>
              第 {String(lesson.number).padStart(2, '0')} 课
            </span>
            <span className="text-xs font-medium text-white truncate max-w-xs md:max-w-md">
              {lesson.title}
            </span>
          </div>

          {/* 上下课快捷箭头 */}
          <div className="flex items-center gap-1 shrink-0 ml-1">
            <button
              onClick={() => prevLessonId && onNavigateToLesson(prevLessonId)}
              disabled={!prevLessonId}
              title={prevLessonId ? '切换至上一课' : '已是第一课'}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono text-zinc-500">
              {lesson.number}/14
            </span>
            <button
              onClick={() => nextLessonId && onNavigateToLesson(nextLessonId)}
              disabled={!nextLessonId}
              title={nextLessonId ? '切换至下一课' : '已修完全部课程'}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 右侧：全景拓扑弹窗 + 用时预估 */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setShowCanvasModal(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 hover:text-cyan-400 border border-zinc-700 text-xs transition-all cursor-pointer"
            title="查看本课对应的全景力导向拓扑关系图"
          >
            <Share2 className="w-3 h-3 text-cyan-400" />
            <span className="text-[11px]">全景拓扑</span>
          </button>

          <span className="flex items-center gap-1 text-[11px] text-zinc-500 font-mono border-l border-zinc-800 pl-2.5">
            <Clock className="w-3 h-3" />
            <span>{lesson.estimatedTime || '30分钟'}</span>
          </span>
        </div>
      </header>

      {/* ============================================================ */}
      {/* 2. 主阅读区：单流无 TAB 连贯垂直排版 (Full Document Stream) */}
      {/* ============================================================ */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
        <article className="max-w-4xl mx-auto w-full space-y-8 pb-20">

          {/* 章节大标题 */}
          <div className="border-b border-zinc-800 pb-5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
              <span>本体认知架构体系</span>
              <span>/</span>
              <span>第 {String(lesson.number).padStart(2, '0')} 课</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {lesson.title}
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {lesson.coreConcept}
            </p>
          </div>

          {/* ============================================================ */}
          {/* 一、业务场景还原与建模定位 */}
          {/* ============================================================ */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
              <BookOpen className="w-4 h-4 text-cyan-400" />
              <h2 className="text-base font-bold text-white">一、业务场景还原与建模定位</h2>
            </div>

            {/* 阶段目标与承上启下卡片 */}
            <div className="p-4 rounded-xl border border-zinc-800 bg-[#12171f] space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Compass className={`w-4 h-4 ${stageStyles.textColor}`} />
                  <span className="text-xs font-bold text-white">阶段定位：{ONTOLOGY_STAGE_LABELS[lesson.stage]}</span>
                </div>
                <span className={`text-[10.5px] px-2 py-0.5 rounded-full ${stageStyles.bgColor} ${stageStyles.textColor} border ${stageStyles.borderColor} font-medium`}>
                  Stage {lesson.stage === 'recognition' ? 1 : lesson.stage === 'topology' ? 2 : lesson.stage === 'assembly' ? 3 : 4} / 4
                </span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed pl-6">
                {stepFlow.stageGoal}
              </p>
              <div className="pt-2 border-t border-zinc-800/80 flex items-start gap-2 pl-1">
                <span className="text-[10.5px] font-bold text-cyan-400 shrink-0">为什么现在学：</span>
                <span className="text-xs text-zinc-400 leading-relaxed">
                  {stepFlow.whyThisOrder}
                </span>
              </div>
            </div>

            {/* 贯穿实战案例映射 */}
            <div className="p-4 rounded-xl border border-sky-500/30 bg-sky-500/5 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-sky-400">
                <Layers className="w-4 h-4 shrink-0" />
                <span>贯穿实战案例（顺达物流追踪链）映射</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed pl-6">
                {stepFlow.caseConnection}
              </p>
            </div>

            {/* 本课最核心的 1 句建模判断法 */}
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-cyan-500/10 via-cyan-500/5 to-transparent border border-cyan-500/30 flex items-center gap-2.5">
              <Target className="w-4 h-4 text-cyan-400 shrink-0" />
              <div className="text-xs leading-relaxed">
                <span className="font-bold text-cyan-400 mr-1.5">核心建模心智：</span>
                <span className="font-medium text-white">{stepFlow.coreMethod}</span>
              </div>
            </div>

            {/* 场景引言金句卡片 */}
            <div className="p-4 rounded-xl border border-zinc-800 bg-[#0c1015] text-white relative group">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[10.5px] text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>材料原文直接记录</span>
                </div>
                <button
                  onClick={() => handleCopyQuote(stepFlow.story.quote)}
                  className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700 transition-colors"
                >
                  {copiedQuote ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedQuote ? '已复制' : '复制原文'}</span>
                </button>
              </div>
              <blockquote className="text-xs font-mono font-medium leading-relaxed italic text-zinc-200 pl-3.5 border-l-2 border-cyan-400">
                {stepFlow.story.quote}
              </blockquote>
            </div>

            {/* 场景详情描述与灵魂拷问 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-zinc-800 bg-[#12171f] space-y-1.5">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  现实业务背景剖析
                </h3>
                <p className="text-xs leading-relaxed text-zinc-300">
                  {stepFlow.story.scenario}
                </p>
              </div>

              <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                  <HelpCircle className="w-4 h-4 shrink-0" />
                  <span>核心灵魂拷问 (The Dilemma)</span>
                </div>
                <p className="text-xs leading-relaxed text-zinc-300 pl-5">
                  {stepFlow.story.dilemma}
                </p>
              </div>
            </div>
          </section>

          {/* ============================================================ */}
          {/* 二、直觉误区 vs 本体建模准则 */}
          {/* ============================================================ */}
          <section className="space-y-4 pt-4">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h2 className="text-base font-bold text-white">二、直觉误区 vs 本体建模准则</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 常见陷阱卡片 */}
              <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 flex flex-col justify-between space-y-3">
                <div>
                  <div className="text-xs font-bold text-rose-400 flex items-center gap-1.5 mb-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{stepFlow.trapVsAha.trap.title}</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {stepFlow.trapVsAha.trap.desc}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 leading-relaxed">
                  ⚠️ 根源危害：{stepFlow.trapVsAha.trap.danger}
                </div>
              </div>

              {/* 本体准则卡片 */}
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex flex-col justify-between space-y-3">
                <div>
                  <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 mb-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{stepFlow.trapVsAha.aha.title}</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {stepFlow.trapVsAha.aha.desc}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-medium leading-relaxed">
                  💡 破局准则：{stepFlow.trapVsAha.aha.rule}
                </div>
              </div>
            </div>

            {/* 为什么传统思维翻车 */}
            <div className="p-4 rounded-xl border border-zinc-800 bg-[#12171f] space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-400">
                <Compass className="w-4 h-4" />
                <span>为什么传统思维容易在此翻车？</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed pl-5">
                传统关系数据库习惯于“见物建表、见字加列”，忽略了现实世界的实体具有持续统一的身份与因果生命周期。本体建模要求我们从业务证据与真实行为出发，建立跨越时间与异构系统的闭环映射。
              </p>
            </div>
          </section>

          {/* ============================================================ */}
          {/* 三、直观模型与 O-P-L-A 决策框架 */}
          {/* ============================================================ */}
          <section className="space-y-4 pt-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Network className="w-4 h-4 text-cyan-400" />
                <h2 className="text-base font-bold text-white">三、O-P-L-A 建模决策树与实体架构</h2>
              </div>
              <button
                onClick={() => setShowCanvasModal(true)}
                className="text-xs text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>打开全景力导向拓扑</span>
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              {stepFlow.model.summary}
            </p>

            {/* Palantir 4要素决策树三连卡片 */}
            <div className="p-4 rounded-xl border border-zinc-800 bg-[#12171f] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-white">
                    Palantir 4要素建模思考决策树 (O-P-L-A)
                  </span>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono">
                  识别 · 关联 · 驱动
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. 对象 vs 属性 */}
                <div className="p-3 rounded-lg bg-[#0c1015] border border-cyan-500/30 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-400">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                    <span>1. 对象 vs 属性判断</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {stepFlow.modelingDecision.objectVsProperty}
                  </p>
                </div>

                {/* 2. 关系 Link */}
                <div className="p-3 rounded-lg bg-[#0c1015] border border-sky-500/30 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400">
                    <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
                    <span>2. 关系 Link 建立条件</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {stepFlow.modelingDecision.linkCondition}
                  </p>
                </div>

                {/* 3. 行动 Action */}
                <div className="p-3 rounded-lg bg-[#0c1015] border border-amber-500/30 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                    <span>3. 行动 Action 触发闭环</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {stepFlow.modelingDecision.actionTrigger}
                  </p>
                </div>
              </div>
            </div>

            {/* 核心实体要素定义列表 */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-zinc-400" />
                <span>本课核心本体要素定义 ({stepFlow.model.keyEntities.length} 项)</span>
              </div>

              <div className="space-y-2">
                {stepFlow.model.keyEntities.map((entity, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-zinc-800 bg-[#12171f] hover:border-zinc-700 transition-all flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-white">
                          {entity.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono border border-zinc-700">
                          {entity.category}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        {entity.explanation}
                      </p>
                    </div>

                    <span className={`text-[10.5px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                      entity.badgeColor === 'green' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                      entity.badgeColor === 'yellow' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                      entity.badgeColor === 'pink' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' :
                      entity.badgeColor === 'blue' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30' :
                      'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                    }`}>
                      {entity.badge}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 本课架构口诀 */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-sky-500/10 via-[#12171f] to-transparent border border-sky-500/30 text-xs flex items-center gap-2.5">
              <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-white font-medium text-xs leading-relaxed">
                本课架构口诀：{stepFlow.model.goldenRule}
              </span>
            </div>
          </section>

          {/* ============================================================ */}
          {/* 四、动手推演与底层 DuckDB 执行 */}
          {/* ============================================================ */}
          <section className="space-y-4 pt-4">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
              <Zap className="w-4 h-4 text-emerald-400" />
              <h2 className="text-base font-bold text-white">四、动手推演与底层 DuckDB 执行</h2>
            </div>

            <div className="space-y-1">
              <h3 className="text-xs font-bold text-white">
                {stepFlow.lab.title}
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {stepFlow.lab.description}
              </p>
            </div>

            {/* 一键推演操作区 */}
            <div className="p-5 rounded-xl border border-zinc-800 bg-[#12171f] text-center space-y-4">
              {!hasSimulated ? (
                <button
                  onClick={handleTriggerSimulation}
                  disabled={isSimulating}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-bold text-xs hover:opacity-95 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <Zap className={`w-4 h-4 ${isSimulating ? 'animate-spin' : ''}`} />
                    <span>{isSimulating ? '正在推演状态变迁...' : stepFlow.lab.actionLabel}</span>
                  </span>
                </button>
              ) : (
                <div className="space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{stepFlow.lab.simulationResult.headline}</span>
                    </div>
                    <button
                      onClick={handleTriggerSimulation}
                      className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>重新推演</span>
                    </button>
                  </div>

                  {/* 统计指标胶囊 */}
                  <div className="grid grid-cols-3 gap-2">
                    {stepFlow.lab.simulationResult.stats.map((stat, i) => (
                      <div key={i} className="bg-[#0c1015] p-2.5 rounded-lg border border-zinc-800 text-center">
                        <div className="text-[10.5px] text-zinc-400 mb-0.5">{stat.label}</div>
                        <div className={`text-xs font-bold font-mono ${stat.color}`}>{stat.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* 洞察说明与建模启示 */}
                  <div className="text-xs text-zinc-300 leading-relaxed text-left bg-zinc-900/60 p-3 rounded-lg border border-zinc-800 space-y-1">
                    <div className="font-bold text-cyan-400 flex items-center gap-1.5 text-xs">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                      <span>推演产出与建模启示</span>
                    </div>
                    <p className="text-xs pl-5">
                      {stepFlow.lab.simulationResult.insight}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 本课建模自检验证清单 */}
            <div className="p-4 rounded-xl border border-zinc-800 bg-[#12171f] space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white">
                    建模自检三关验证清单 (Verification Checklist)
                  </span>
                </div>
                <span className="text-xs font-mono text-zinc-400">
                  {checkedVerificationItems.size} / {stepFlow.verificationChecklist.length} 已自检
                </span>
              </div>

              <div className="space-y-2">
                {stepFlow.verificationChecklist.map((item, idx) => {
                  const isChecked = checkedVerificationItems.has(idx);
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        setCheckedVerificationItems(prev => {
                          const next = new Set(prev);
                          if (next.has(idx)) next.delete(idx);
                          else next.add(idx);
                          return next;
                        });
                      }}
                      className={`w-full text-left p-2.5 rounded-lg border text-xs leading-relaxed transition-all cursor-pointer flex items-start gap-2.5 ${
                        isChecked 
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' 
                          : 'bg-[#0c1015] border-zinc-800 text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded mt-0.5 shrink-0 flex items-center justify-center border text-[10px] ${
                        isChecked 
                          ? 'bg-emerald-500 text-black border-emerald-500 font-bold' 
                          : 'border-zinc-700 text-transparent'
                      }`}>
                        ✓
                      </span>
                      <span className="text-xs leading-relaxed select-none">{item}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 底层 DuckDB SQL 代码块 */}
            <div className="rounded-xl border border-zinc-800 bg-[#0d1117] overflow-hidden shadow-lg">
              <div className="h-9 px-4 bg-[#161b22] border-b border-zinc-800 flex items-center justify-between text-xs select-none">
                <span className="font-mono text-zinc-400 text-xs">底层 DuckDB 物理层 DDL 与验证 SQL</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopySql(stepFlow.lab.duckdbSql)}
                    className="px-2 py-0.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex items-center gap-1 text-xs cursor-pointer"
                  >
                    {copiedSql ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSql ? '已复制' : '复制代码'}</span>
                  </button>
                  {onTryCode && (
                    <button
                      onClick={() => onTryCode(stepFlow.lab.duckdbSql)}
                      className="px-2.5 py-0.5 rounded text-xs font-bold bg-emerald-400 hover:bg-emerald-300 text-black transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-xs"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>在控制台执行</span>
                    </button>
                  )}
                </div>
              </div>
              <pre className="p-4 text-xs font-mono text-zinc-200 overflow-x-auto leading-relaxed custom-scrollbar bg-transparent">
                <code>{stepFlow.lab.duckdbSql}</code>
              </pre>
            </div>
          </section>

          {/* ============================================================ */}
          {/* 五、通关自测与架构认知检验 */}
          {/* ============================================================ */}
          <section className="space-y-4 pt-4">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
              <Award className="w-4 h-4 text-amber-400" />
              <h2 className="text-base font-bold text-white">五、通关自测与架构认知检验</h2>
            </div>

            <div className="p-5 rounded-xl border border-zinc-800 bg-[#12171f] space-y-4">
              <div className="text-xs font-bold text-white leading-relaxed">
                ❓ {stepFlow.challenge.question}
              </div>

              {/* 选项列表 */}
              <div className="space-y-2">
                {stepFlow.challenge.options.map((opt, idx) => {
                  const isSelected = selectedOption === idx;
                  const isCorrect = idx === stepFlow.challenge.correctIndex;

                  let itemStyle = 'border-zinc-800 bg-[#0c1015] text-zinc-300 hover:border-zinc-700';
                  if (hasAnswered) {
                    if (isCorrect) {
                      itemStyle = 'border-emerald-500/60 bg-emerald-500/10 text-emerald-400 font-semibold';
                    } else if (isSelected) {
                      itemStyle = 'border-rose-500/60 bg-rose-500/10 text-rose-400';
                    } else {
                      itemStyle = 'opacity-40 border-zinc-800';
                    }
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => !hasAnswered && handleSelectQuizOption(idx)}
                      disabled={hasAnswered}
                      className={`w-full text-left p-3 rounded-lg border text-xs leading-relaxed transition-all cursor-pointer flex items-center gap-3 ${itemStyle}`}
                    >
                      <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px] shrink-0 font-mono">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="text-xs leading-relaxed">{opt}</span>
                    </button>
                  );
                })}
              </div>

              {/* 解答析义与通关彩蛋 */}
              {hasAnswered && (
                <div className="p-4 rounded-xl border border-zinc-800 bg-[#0c1015] space-y-2.5 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {selectedOption === stepFlow.challenge.correctIndex ? (
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>回答正确！通关勋章已解锁 🎖️</span>
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-rose-400 flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4" />
                          <span>回答有误，请查阅解析加深理解：</span>
                        </span>
                      )}
                    </div>

                    <button
                      onClick={handleResetQuiz}
                      className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer bg-zinc-800 px-2.5 py-1 rounded border border-zinc-700 transition-colors"
                      title="清空选择并重新作答"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>重新作答</span>
                    </button>
                  </div>

                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {stepFlow.challenge.explanation}
                  </p>

                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-medium leading-relaxed">
                    {stepFlow.challenge.takeaway}
                  </div>
                </div>
              )}
            </div>

            {/* 课末结语与进入下一课行动 */}
            <div className="pt-6 border-t border-zinc-800 flex items-center justify-between">
              <div className="text-xs text-zinc-500 font-mono">
                第 {lesson.number} 课 · 已通关
              </div>
              {nextLessonId ? (
                <button
                  onClick={() => onNavigateToLesson(nextLessonId)}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-bold text-xs hover:opacity-95 transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
                >
                  <span>开启下一课 🚀</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={onGoHome}
                  className="px-6 py-2.5 rounded-xl bg-cyan-400 text-black font-bold text-xs hover:bg-cyan-300 transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/20"
                >
                  <span>🎉 全部 14 门实战课已修满！返回大纲</span>
                </button>
              )}
            </div>

          </section>

        </article>
      </main>

      {/* ============================================================ */}
      {/* 全景力导向拓扑画布模态弹窗 */}
      {/* ============================================================ */}
      {showCanvasModal && seedData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
          <div className="bg-[#0c1015] border border-zinc-800 rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="h-12 border-b border-zinc-800 px-5 flex items-center justify-between bg-[#12171f] shrink-0">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-white">
                  全景力导向拓扑网络 · {seedData._meta?.name || lesson.title}
                </span>
              </div>
              <button
                onClick={() => setShowCanvasModal(false)}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden p-2">
              <OntologyInteractiveViewer data={seedData} />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default OntologyLessonViewer;
