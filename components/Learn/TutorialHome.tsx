/**
 * TutorialHome.tsx - 学习中心（教程板块）沉浸式工作台
 * 
 * 深度重构后的排版架构（4 大支柱模态）：
 * 1. 🎯 方法论全景 (Methodology) - OPLA 思考心智模型、决策树与工业级速测
 * 2. 🛠️ 独立建模工坊 (OPLA Studio) - 从业务问题到 Object/Property/Link/Action 的完整实战与在库执行
 * 3. 📚 14 课故事实战体系 (Curriculum) - Palantir 4阶段 14 门实战课程大纲与无缝直达
 * 4. 📖 SQL 与技术参考讲义 (Reference) - DuckDB SQL 进阶与系统化分析手册
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  TutorialMetadata, tutorials, categoryMap, getRecommendedFirstTutorial, 
  getLearningPath, loadAllTutorials, searchTutorials, SearchResult 
} from '../../data/tutorials';
import { 
  ONTOLOGY_STAGES, ONTOLOGY_LESSONS_DATA, OntologyStage, 
  ONTOLOGY_STAGE_LABELS 
} from '../../hooks/useOntologyLessons';
import { WikiSearch } from './WikiSearch';
import { UploadTutorialModal } from './UploadTutorialModal';
import { OntologyMethodologyView } from './OntologyMethodologyView';
import { OntologyCaseStudio } from './OntologyCaseStudio';
import { PRESET_MODELING_CASES, type ModelingCase } from './data/mockCaseData';
import { toastService } from '../../services/toastService';
import { 
  Sparkles, Lightbulb, ArrowRight, Loader2, X, ChevronRight, Zap, 
  BookOpen, Target, TrendingUp, Search, Filter, SortAsc, Clock, 
  CheckCircle2, Circle, Play, Home, Settings, Download, Upload, 
  Keyboard, Trophy, Flame, Timer, BookMarked, Star, Award,
  ChevronDown, ChevronUp, LayoutGrid, List, RotateCcw, Brain, Network,
  Layers, ShieldCheck, Database, FileText, Compass
} from 'lucide-react';

interface TutorialHomeProps {
  onSelectTutorial: (tutorial: TutorialMetadata) => void;
  onSelectOntologyLesson?: (lessonId: string) => void;
  onTryCode?: (code: string) => void;
}

type HubTab = 'methodology' | 'studio' | 'curriculum' | 'sql';
type SortOption = 'default' | 'difficulty' | 'progress' | 'recent' | 'title';
type ViewMode = 'grid' | 'list';

export const TutorialHome: React.FC<TutorialHomeProps> = ({ 
  onSelectTutorial, 
  onSelectOntologyLesson,
  onTryCode 
}) => {
  // 顶层 4 大板块切换 (支持 URL hash 同步)
  const [activeHubTab, setActiveHubTab] = useState<HubTab>(() => {
    const hash = window.location.hash;
    if (hash.includes('#hub/studio') || hash.includes('#studio')) return 'studio';
    if (hash.includes('#hub/curriculum') || hash.includes('#curriculum')) return 'curriculum';
    if (hash.includes('#hub/sql') || hash.includes('#sql')) return 'sql';
    return 'methodology';
  });

  // 监听 URL hash 变化
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.includes('#hub/studio') || hash.includes('#studio')) {
        setActiveHubTab('studio');
      } else if (hash.includes('#hub/curriculum') || hash.includes('#curriculum')) {
        setActiveHubTab('curriculum');
      } else if (hash.includes('#hub/sql') || hash.includes('#sql')) {
        setActiveHubTab('sql');
      } else if (hash.includes('#hub/methodology') || hash.includes('#methodology')) {
        setActiveHubTab('methodology');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // 实战工坊指定的案例 ID 与建模状态
  const [workshopCaseId, setWorkshopCaseId] = useState<string>('case-coldchain-shunda');
  const [activeCase, setActiveCase] = useState<ModelingCase>(() => {
    return PRESET_MODELING_CASES.find(c => c.id === 'case-coldchain-shunda') || PRESET_MODELING_CASES[0];
  });
  const [selectedCaseObjId, setSelectedCaseObjId] = useState<string>(() => {
    const c = PRESET_MODELING_CASES.find(item => item.id === 'case-coldchain-shunda') || PRESET_MODELING_CASES[0];
    return c.referenceModel.objects[0]?.id || '';
  });

  const handleStartWorkshop = useCallback((caseId?: string) => {
    const targetId = caseId || 'case-coldchain-shunda';
    setWorkshopCaseId(targetId);
    const c = PRESET_MODELING_CASES.find(item => item.id === targetId) || PRESET_MODELING_CASES[0];
    setActiveCase(c);
    setSelectedCaseObjId(c.referenceModel.objects[0]?.id || '');
    setActiveHubTab('studio');
    window.location.hash = '#hub/studio';
  }, []);

  // SQL 教程过滤与排序
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [selectedSort, setSelectedSort] = useState<SortOption>('default');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [allTutorials, setAllTutorials] = useState<TutorialMetadata[]>(tutorials);

  // 14 课本体进度
  const [ontologyProgress, setOntologyProgress] = useState<Record<string, any>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem('duckdb_ontology_progress');
      if (saved) {
        setOntologyProgress(JSON.parse(saved));
      }
    } catch {}
  }, []);

  const ontologyCompletedCount = useMemo(() => {
    return Object.values(ontologyProgress).filter((p: any) => p?.completedAt).length;
  }, [ontologyProgress]);

  const ontologyStageCounts = useMemo(() => {
    const isCompleted = (num: number) => {
      const id = `ontology-lesson-${String(num).padStart(4, '0')}`;
      return !!ontologyProgress[id]?.completedAt;
    };
    return {
      recognition: [1, 2, 3].filter(isCompleted).length,
      topology: [4, 5, 6, 7].filter(isCompleted).length,
      assembly: [8, 9, 10, 11].filter(isCompleted).length,
      evolution: [12, 13, 14].filter(isCompleted).length,
    };
  }, [ontologyProgress]);

  // 普通教程进度
  const [completedTutorials, setCompletedTutorials] = useState<string[]>([]);
  const [tutorialProgress, setTutorialProgress] = useState<Record<string, number>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem('duckdb_learn_progress');
      if (saved) {
        const progress = JSON.parse(saved);
        const completed = Object.entries(progress)
          .filter(([_, p]: [string, any]) => p.completedAt)
          .map(([id]) => id);
        
        const progressMap: Record<string, number> = {};
        Object.entries(progress).forEach(([id, p]: [string, any]) => {
          if (p.completedSections && p.totalSections) {
            progressMap[id] = p.completedSections.length / p.totalSections;
          } else if (p.completedAt) {
            progressMap[id] = 1;
          }
        });
        
        setCompletedTutorials(completed);
        setTutorialProgress(progressMap);
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadAllTutorials().then(setAllTutorials).catch(console.error);
  }, [showUploadModal]);

  // 切换 Tab 时微调 hash
  const handleTabChange = (tab: HubTab) => {
    setActiveHubTab(tab);
    window.history.replaceState(null, '', `#hub/${tab}`);
  };

  // 过滤 SQL 教程
  const filteredTutorials = useMemo(() => {
    let result = allTutorials;
    if (selectedCategory) {
      result = result.filter(t => t.category === selectedCategory);
    }
    if (selectedDifficulty) {
      result = result.filter(t => t.difficulty === selectedDifficulty);
    }
    return result;
  }, [allTutorials, selectedCategory, selectedDifficulty]);

  return (
    <div className="h-full flex flex-col bg-monokai-bg text-monokai-fg overflow-hidden">
      {/* ============================================================ */}
      {/* 顶栏控制中枢：品牌标头 + 4 模式 Tab 导航 + 学习进度勋章 */}
      {/* ============================================================ */}
      <div className="shrink-0 bg-monokai-sidebar/95 border-b border-monokai-border/80 px-6 py-3.5 backdrop-blur-md z-20">
        <div className="flex flex-wrap items-center justify-between gap-4">
          
          {/* 左侧：标头与愿景 */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-monokai-cyan/25 to-monokai-blue/25 border border-monokai-cyan/40 flex items-center justify-center shadow-lg shadow-monokai-cyan/10">
              <Network className="w-5 h-5 text-monokai-cyan" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-tight">
                  本体认知与建模实战中心
                </h1>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-monokai-cyan/15 border border-monokai-cyan/30 text-monokai-cyan">
                  OPLA Studio
                </span>
              </div>
              <p className="text-[11px] text-monokai-comment">
                从业务问题到 Object / Property / Link / Action 的全链路思维与独立实战
              </p>
            </div>
          </div>

          {/* 中间：4 模式核心 Segmented Control */}
          <div className="flex items-center gap-1 bg-monokai-bg p-1 rounded-xl border border-monokai-border/80 shadow-inner">
            <button
              onClick={() => handleTabChange('methodology')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeHubTab === 'methodology'
                  ? 'bg-monokai-cyan text-monokai-bg shadow-md font-bold'
                  : 'text-monokai-comment hover:text-white hover:bg-monokai-surface'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>🎯 方法论全景</span>
            </button>

            <button
              onClick={() => handleTabChange('studio')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer relative ${
                activeHubTab === 'studio'
                  ? 'bg-monokai-green text-monokai-bg shadow-md font-bold'
                  : 'text-monokai-comment hover:text-white hover:bg-monokai-surface'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>🛠️ 独立建模工坊</span>
              <span className="w-1.5 h-1.5 rounded-full bg-monokai-yellow animate-pulse" />
            </button>

            <button
              onClick={() => handleTabChange('curriculum')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeHubTab === 'curriculum'
                  ? 'bg-monokai-blue text-monokai-bg shadow-md font-bold'
                  : 'text-monokai-comment hover:text-white hover:bg-monokai-surface'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>📚 14 课故事实战</span>
            </button>

            <button
              onClick={() => handleTabChange('sql')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeHubTab === 'sql'
                  ? 'bg-monokai-amethyst text-monokai-bg shadow-md font-bold'
                  : 'text-monokai-comment hover:text-white hover:bg-monokai-surface'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>📖 SQL 参考讲义</span>
            </button>
          </div>

          {/* 右侧：统计与进度 */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end text-right">
              <div className="text-xs font-mono font-bold text-monokai-cyan">
                本体课程 {ontologyCompletedCount} / 14 课
              </div>
              <div className="text-[10px] text-monokai-comment">
                DuckDB 讲义 {completedTutorials.length} / {allTutorials.length} 篇
              </div>
            </div>

            <div className="w-8 h-8 rounded-lg bg-monokai-surface border border-monokai-border flex items-center justify-center text-monokai-yellow">
              <Award className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 主视图区：根据选中的 Tab 动态渲染 */}
      {/* ============================================================ */}
      <div className="flex-1 overflow-y-auto min-h-0">
        
        {/* MODE 1: 🎯 方法论全景 */}
        {activeHubTab === 'methodology' && (
          <div className="p-6">
            <OntologyMethodologyView
              onStartWorkshop={handleStartWorkshop}
              onExploreCurriculum={() => handleTabChange('curriculum')}
            />
          </div>
        )}

        {/* MODE 2: 🛠️ OPLA 独立建模实战工坊 */}
        {activeHubTab === 'studio' && (
          <div className="h-full flex flex-col min-h-0">
            <div className="flex items-center justify-between px-6 py-2.5 border-b border-monokai-border bg-monokai-sidebar shrink-0">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleTabChange('methodology')}
                  className="px-2.5 py-1 text-xs rounded border border-monokai-border bg-monokai-surface hover:text-white transition-colors text-monokai-comment flex items-center gap-1 cursor-pointer"
                >
                  <span>←</span>
                  <span>返回方法论</span>
                </button>
                <div className="h-4 w-px bg-monokai-border" />
                <span className="text-xs text-monokai-comment">切换建模案例：</span>
                <select
                  value={activeCase.id}
                  onChange={(e) => {
                    const target = PRESET_MODELING_CASES.find(c => c.id === e.target.value) || PRESET_MODELING_CASES[0];
                    setWorkshopCaseId(target.id);
                    setActiveCase(target);
                    setSelectedCaseObjId(target.referenceModel.objects[0]?.id || '');
                  }}
                  className="px-2.5 py-1 text-xs rounded border border-monokai-border bg-monokai-bg text-monokai-fg focus:outline-none focus:border-monokai-yellow cursor-pointer"
                >
                  {PRESET_MODELING_CASES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({c.industry})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                {onTryCode && (
                  <button
                    type="button"
                    onClick={() => {
                      if (activeCase.sampleDuckDbSql) {
                        onTryCode(activeCase.sampleDuckDbSql);
                        toastService.success('已将案例 SQL 注入工作台！');
                      }
                    }}
                    className="px-3 py-1 text-xs rounded font-medium bg-monokai-accent/15 text-monokai-accent border border-monokai-accent/30 hover:bg-monokai-accent/25 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>在 SQL 工作台运行案例</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const original = PRESET_MODELING_CASES.find(c => c.id === activeCase.id);
                    if (original) {
                      setActiveCase(original);
                      toastService.info('已恢复为标准参考模型');
                    }
                  }}
                  className="px-2.5 py-1 text-xs rounded border border-monokai-border bg-monokai-surface hover:text-white transition-colors text-monokai-comment flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>重置</span>
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
              <OntologyCaseStudio
                currentCase={activeCase}
                onChangeCase={setActiveCase}
                selectedObjectId={selectedCaseObjId}
                onSelectObject={setSelectedCaseObjId}
                onResetStandard={() => {
                  const original = PRESET_MODELING_CASES.find(c => c.id === activeCase.id);
                  if (original) {
                    setActiveCase(original);
                    toastService.info('已恢复为标准参考模型');
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* MODE 3: 📚 14 课故事实战体系 */}
        {activeHubTab === 'curriculum' && (
          <div className="p-6 max-w-6xl mx-auto space-y-8 pb-16">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-monokai-yellow" />
                  <span>Palantir 4阶段 14 门故事化本体实战路线</span>
                </h2>
                <p className="text-xs text-monokai-comment mt-0.5">
                  严辨现实证据与主观臆测，经历拓扑变迁、组装验证到增量演进与冲突裁决
                </p>
              </div>

              <button
                onClick={() => handleStartWorkshop('case-coldchain-shunda')}
                className="px-4 py-2 rounded-xl bg-monokai-green text-monokai-bg font-bold text-xs hover:bg-monokai-green/90 transition-all flex items-center gap-1.5 cursor-pointer shadow"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>直接进入 OPLA 独立建模工坊实操</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 4阶段分块展示 */}
            <div className="space-y-6">
              {ONTOLOGY_STAGES.map(stage => {
                const stageLessons = ONTOLOGY_LESSONS_DATA.filter(l => l.stage === stage.id);
                const stageCompleted = ontologyStageCounts[stage.id];

                return (
                  <div 
                    key={stage.id}
                    className="p-5 rounded-2xl bg-monokai-sidebar/50 border border-monokai-border/70 space-y-4"
                  >
                    {/* 阶段标题 */}
                    <div className="flex items-center justify-between pb-3 border-b border-monokai-border/40">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{stage.icon}</span>
                        <div>
                          <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <span>{stage.label}</span>
                            <span className="text-[10px] text-monokai-comment font-normal font-mono">({stage.labelEn})</span>
                          </h3>
                          <p className="text-xs text-monokai-comment mt-0.5">{stage.description}</p>
                        </div>
                      </div>

                      <span className="text-xs font-mono font-semibold text-monokai-cyan bg-monokai-cyan/15 px-2.5 py-1 rounded-full border border-monokai-cyan/30">
                        {stageCompleted} / {stageLessons.length} 课完成
                      </span>
                    </div>

                    {/* 课卡网格 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {stageLessons.map(lesson => {
                        const isDone = !!ontologyProgress[lesson.id]?.completedAt;
                        return (
                          <div
                            key={lesson.id}
                            onClick={() => onSelectOntologyLesson?.(lesson.id)}
                            className={`p-4 rounded-xl border text-left transition-all cursor-pointer group flex flex-col justify-between ${
                              isDone
                                ? 'bg-monokai-green/10 border-monokai-green/40 hover:border-monokai-green/70'
                                : 'bg-monokai-bg/60 border-monokai-border/60 hover:border-monokai-cyan/60 hover:bg-monokai-bg/90'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-mono font-bold text-monokai-cyan">
                                  第 {String(lesson.number).padStart(2, '0')} 课
                                </span>
                                {isDone ? (
                                  <CheckCircle2 className="w-4 h-4 text-monokai-green" />
                                ) : (
                                  <span className="text-[10px] text-monokai-comment">{lesson.estimatedTime}</span>
                                )}
                              </div>
                              <h4 className="text-xs font-bold text-white group-hover:text-monokai-cyan transition-colors line-clamp-1 mb-1">
                                {lesson.title}
                              </h4>
                              <p className="text-[11px] text-monokai-comment line-clamp-2 leading-relaxed">
                                {lesson.description}
                              </p>
                            </div>

                            <div className="mt-3 pt-2.5 border-t border-monokai-border/30 flex items-center justify-between text-[10px]">
                              <span className="text-monokai-yellow font-mono truncate max-w-[150px]">
                                {lesson.coreConcept}
                              </span>
                              <span className="text-monokai-cyan font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                                <span>{isDone ? '复习' : '学习'}</span>
                                <ChevronRight className="w-3 h-3" />
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* MODE 4: 📖 SQL 与技术参考讲义 */}
        {activeHubTab === 'sql' && (
          <div className="p-6 max-w-6xl mx-auto space-y-6 pb-16">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-monokai-blue" />
                  <span>DuckDB SQL 与系统化数据分析讲义</span>
                </h2>
                <p className="text-xs text-monokai-comment mt-0.5">
                  从 SQL 基础、高级窗口函数到数据湖查询，系统掌握 DuckDB 分析能力
                </p>
              </div>

              <button
                onClick={() => setShowUploadModal(true)}
                className="px-3 py-1.5 rounded-lg bg-monokai-surface border border-monokai-border text-xs text-monokai-fg hover:bg-monokai-border cursor-pointer flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>上传自定义讲义</span>
              </button>
            </div>

            {/* 讲义网格 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTutorials.map((tutorial, idx) => (
                <div
                  key={tutorial.id}
                  onClick={() => onSelectTutorial(tutorial)}
                  className="p-4 rounded-xl bg-monokai-sidebar/60 border border-monokai-border/70 hover:border-monokai-blue/60 transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-monokai-blue/20 text-monokai-blue">
                        {tutorial.difficulty}
                      </span>
                      <span className="text-[10px] text-monokai-comment font-mono">{tutorial.estimatedTime}</span>
                    </div>
                    <h3 className="text-sm font-bold text-white group-hover:text-monokai-blue transition-colors mb-1">
                      {tutorial.title}
                    </h3>
                    <p className="text-xs text-monokai-comment line-clamp-2 leading-relaxed">
                      {tutorial.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-2.5 border-t border-monokai-border/30 flex items-center justify-between text-xs text-monokai-blue font-semibold">
                    <span>开始阅读讲义</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 上传自定义教程模态框 */}
      <UploadTutorialModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={() => {
          loadAllTutorials().then(setAllTutorials).catch(console.error);
        }}
      />
    </div>
  );
};

export default TutorialHome;
