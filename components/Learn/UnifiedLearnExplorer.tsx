/**
 * UnifiedLearnExplorer.tsx - 学习中心统一资源与导航树
 * 
 * 职责：
 * 1. 彻底取代原有多头侧边栏，将「方法论」、「实战案例库」、「14课故事实战体系」与「SQL讲义」
 *    整合为统一同构的紧凑专业目录树 (230px)。
 * 2. 带有快速检索过滤、完成勋章与进度胶囊。
 */

import React, { useState, useMemo } from 'react';
import { 
  Compass, Zap, BookOpen, Database, Search, ChevronRight, 
  ChevronDown, CheckCircle2, Circle, Plus, Award, Layers,
  FileText, Sparkles, Filter
} from 'lucide-react';
import { PRESET_MODELING_CASES } from './data/mockCaseData';
import { ONTOLOGY_STAGES, ONTOLOGY_LESSONS_DATA } from '../../hooks/useOntologyLessons';
import { tutorials, TutorialMetadata } from '../../data/tutorials';

export type ExplorerSelectionType = 
  | { type: 'methodology' }
  | { type: 'case'; caseId: string }
  | { type: 'curriculum-overview' }
  | { type: 'lesson'; lessonId: string }
  | { type: 'sql'; tutorialId: string };

interface UnifiedLearnExplorerProps {
  currentSelection: ExplorerSelectionType;
  onSelect: (selection: ExplorerSelectionType) => void;
  ontologyProgress: Record<string, any>;
  onNewCustomCase?: () => void;
}

export const UnifiedLearnExplorer: React.FC<UnifiedLearnExplorerProps> = ({
  currentSelection,
  onSelect,
  ontologyProgress,
  onNewCustomCase,
}) => {
  const [filterText, setFilterText] = useState('');
  
  // 折叠分组状态
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    methodology: true,
    cases: true,
    curriculum: true,
    sql: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // 14 课进度统计
  const ontologyCompletedCount = useMemo(() => {
    return Object.values(ontologyProgress).filter((p: any) => p?.completedAt).length;
  }, [ontologyProgress]);

  // 过滤后的案例
  const filteredCases = useMemo(() => {
    if (!filterText.trim()) return PRESET_MODELING_CASES;
    return PRESET_MODELING_CASES.filter(c => 
      c.title.toLowerCase().includes(filterText.toLowerCase()) ||
      c.industry.toLowerCase().includes(filterText.toLowerCase())
    );
  }, [filterText]);

  // 过滤后的课程
  const filteredLessons = useMemo(() => {
    if (!filterText.trim()) return ONTOLOGY_LESSONS_DATA;
    return ONTOLOGY_LESSONS_DATA.filter(l => 
      l.title.toLowerCase().includes(filterText.toLowerCase()) ||
      l.coreConcept?.toLowerCase().includes(filterText.toLowerCase())
    );
  }, [filterText]);

  return (
    <div className="w-58 shrink-0 h-full flex flex-col bg-monokai-sidebar border-r border-monokai-border/80 select-none font-sans text-xs">
      {/* 1. 顶部紧凑搜索框 */}
      <div className="p-2 border-b border-monokai-border/60">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-monokai-comment absolute left-2 pointer-events-none" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="过滤知识库与案例..."
            className="w-full bg-monokai-bg/80 border border-monokai-border/60 rounded-md pl-7 pr-2 py-1 text-[11px] text-white placeholder-monokai-comment/60 focus:outline-none focus:border-monokai-cyan"
          />
        </div>
      </div>

      {/* 2. 树状目录导航列表 */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-2 custom-scrollbar">
        
        {/* ================= SECTION 1: 认知方法论 ================= */}
        <div>
          <button
            onClick={() => toggleSection('methodology')}
            className="w-full flex items-center justify-between px-2 py-1 rounded text-monokai-comment hover:text-white transition-colors font-bold text-[11px] uppercase tracking-wider cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-monokai-cyan" />
              <span>认知方法论</span>
            </span>
            {expandedSections.methodology ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>

          {expandedSections.methodology && (
            <div className="mt-0.5 space-y-0.5 pl-2">
              <button
                onClick={() => onSelect({ type: 'methodology' })}
                className={`w-full text-left px-2 py-1.5 rounded-md transition-all flex items-center gap-2 cursor-pointer ${
                  currentSelection.type === 'methodology'
                    ? 'bg-monokai-cyan/20 text-monokai-cyan font-bold border border-monokai-cyan/40 shadow-xs'
                    : 'text-monokai-fg/80 hover:bg-monokai-surface hover:text-white'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-monokai-cyan" />
                <span className="truncate">OPLA 四步思考法全景</span>
              </button>
            </div>
          )}
        </div>

        {/* ================= SECTION 2: 实战建模工坊 ================= */}
        <div>
          <div className="flex items-center justify-between px-2 py-1 text-[11px] font-bold text-monokai-comment uppercase tracking-wider">
            <button
              onClick={() => toggleSection('cases')}
              className="flex items-center gap-1.5 hover:text-white cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-monokai-green" />
              <span>OPLA 独立工坊</span>
            </button>
            
            {onNewCustomCase && (
              <button
                onClick={onNewCustomCase}
                className="text-monokai-comment hover:text-monokai-cyan p-0.5 transition-colors cursor-pointer"
                title="新建空白自定义建模案例"
              >
                <Plus className="w-3 h-3" />
              </button>
            )}
          </div>

          {expandedSections.cases && (
            <div className="mt-0.5 space-y-0.5 pl-2">
              {filteredCases.map(c => {
                const isSelected = currentSelection.type === 'case' && currentSelection.caseId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => onSelect({ type: 'case', caseId: c.id })}
                    className={`w-full text-left px-2 py-1.5 rounded-md transition-all flex items-center justify-between gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-monokai-green/20 text-monokai-green font-bold border border-monokai-green/40 shadow-xs'
                        : 'text-monokai-fg/80 hover:bg-monokai-surface hover:text-white'
                    }`}
                  >
                    <span className="truncate">{c.title.split('：')[0]}</span>
                    {c.difficulty === '核心旗舰' && (
                      <span className="text-[9px] px-1 rounded bg-monokai-yellow/20 text-monokai-yellow font-mono shrink-0">旗舰</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ================= SECTION 3: 14 课故事实战体系 ================= */}
        <div>
          <button
            onClick={() => toggleSection('curriculum')}
            className="w-full flex items-center justify-between px-2 py-1 rounded text-monokai-comment hover:text-white transition-colors font-bold text-[11px] uppercase tracking-wider cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-monokai-blue" />
              <span>14 课故事体系</span>
            </span>
            <span className="text-[10px] font-mono text-monokai-cyan font-semibold">
              {ontologyCompletedCount}/14
            </span>
          </button>

          {expandedSections.curriculum && (
            <div className="mt-0.5 space-y-2 pl-2">
              {ONTOLOGY_STAGES.map(stage => {
                const stageLessons = filteredLessons.filter(l => l.stage === stage.id);
                if (stageLessons.length === 0) return null;

                return (
                  <div key={stage.id} className="space-y-0.5">
                    <div className="text-[10px] text-monokai-comment font-medium px-1 py-0.5 flex items-center gap-1">
                      <span>{stage.icon}</span>
                      <span className="truncate">{stage.label}</span>
                    </div>

                    {stageLessons.map(lesson => {
                      const isDone = !!ontologyProgress[lesson.id]?.completedAt;
                      const isSelected = currentSelection.type === 'lesson' && currentSelection.lessonId === lesson.id;

                      return (
                        <button
                          key={lesson.id}
                          onClick={() => onSelect({ type: 'lesson', lessonId: lesson.id })}
                          className={`w-full text-left px-2 py-1 rounded-md transition-all flex items-center justify-between gap-1.5 cursor-pointer text-[11px] ${
                            isSelected
                              ? 'bg-monokai-blue/20 text-monokai-blue font-bold border border-monokai-blue/40 shadow-xs'
                              : 'text-monokai-fg/70 hover:bg-monokai-surface hover:text-white'
                          }`}
                        >
                          <span className="truncate">
                            {String(lesson.number).padStart(2, '0')} {lesson.title}
                          </span>
                          {isDone ? (
                            <CheckCircle2 className="w-3 h-3 text-monokai-green shrink-0" />
                          ) : (
                            <Circle className="w-2.5 h-2.5 text-monokai-comment/40 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ================= SECTION 4: SQL 手册讲义 ================= */}
        <div>
          <button
            onClick={() => toggleSection('sql')}
            className="w-full flex items-center justify-between px-2 py-1 rounded text-monokai-comment hover:text-white transition-colors font-bold text-[11px] uppercase tracking-wider cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-monokai-amethyst" />
              <span>SQL 讲义参考</span>
            </span>
            {expandedSections.sql ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>

          {expandedSections.sql && (
            <div className="mt-0.5 space-y-0.5 pl-2">
              {tutorials.map(tut => {
                const isSelected = currentSelection.type === 'sql' && currentSelection.tutorialId === tut.id;
                return (
                  <button
                    key={tut.id}
                    onClick={() => onSelect({ type: 'sql', tutorialId: tut.id })}
                    className={`w-full text-left px-2 py-1.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer text-[11px] ${
                      isSelected
                        ? 'bg-monokai-amethyst/20 text-monokai-amethyst font-bold border border-monokai-amethyst/40 shadow-xs'
                        : 'text-monokai-fg/70 hover:bg-monokai-surface hover:text-white'
                    }`}
                  >
                    <FileText className="w-3 h-3 text-monokai-comment shrink-0" />
                    <span className="truncate">{tut.title}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 3. 底部进度小胶囊 */}
      <div className="p-2 border-t border-monokai-border/70 bg-monokai-bg/60 flex items-center justify-between text-[10px] text-monokai-comment">
        <span className="flex items-center gap-1">
          <Award className="w-3.5 h-3.5 text-monokai-yellow" />
          <span>通关进度</span>
        </span>
        <span className="font-mono font-bold text-monokai-cyan">
          {ontologyCompletedCount} / 14 课
        </span>
      </div>
    </div>
  );
};

export default UnifiedLearnExplorer;
