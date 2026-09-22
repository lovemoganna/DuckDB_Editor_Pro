/**
 * AcademyRoadmapView.tsx - 体系化学习路径图谱视图
 * 
 * 职责：
 * 1. 发现内容阶段的核心导航机制：将零散课程串联为循序渐进的 5 阶路线图；
 * 2. 标明每阶段的目标能力、核心关卡与通关率；
 * 3. 智能高亮学习者当前所处的阶段与推荐学习课程；
 * 4. 支持直接点击卡片无缝直达沉浸式试炼台。
 */

import React from 'react';
import { 
  CheckCircle2, Circle, ArrowRight, Play, Trophy, Sparkles, 
  Terminal, TrendingUp, Layers, Compass, BookOpen, Clock, Check
} from 'lucide-react';
import { 
  AcademyCourseItem, ROADMAP_STAGES, RoadmapStageMeta, 
  getCoursesByRoadmapStage 
} from './data/academyCurriculum';

interface AcademyRoadmapViewProps {
  courses: AcademyCourseItem[];
  completedCourseIds: string[];
  onSelectCourse: (courseId: string) => void;
}

const STAGE_ICON_MAP: Record<string, React.ElementType> = {
  Terminal,
  Sparkles,
  TrendingUp,
  Layers,
  Compass,
};

export const AcademyRoadmapView: React.FC<AcademyRoadmapViewProps> = ({
  courses,
  completedCourseIds,
  onSelectCourse,
}) => {
  return (
    <div className="flex flex-col space-y-8 max-w-5xl mx-auto py-2 px-1 select-none font-sans">
      {ROADMAP_STAGES.map((stage, idx) => {
        const stageCourses = getCoursesByRoadmapStage(stage.id, courses);
        const completedInStage = stageCourses.filter(c => completedCourseIds.includes(c.id));
        const progressPercent = stageCourses.length > 0 
          ? Math.round((completedInStage.length / stageCourses.length) * 100) 
          : 0;
        const isStageCompleted = stageCourses.length > 0 && completedInStage.length === stageCourses.length;
        
        // 找到本阶段下一个建议学习的课程
        const nextInStage = stageCourses.find(c => !completedCourseIds.includes(c.id));

        const IconComponent = STAGE_ICON_MAP[stage.iconName] || BookOpen;

        return (
          <div key={stage.id} className="relative flex flex-col md:flex-row gap-5 group">
            
            {/* 左侧阶段轴线与里程碑节点 */}
            <div className="md:w-64 shrink-0 flex flex-col justify-start">
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center border shadow-xs ${
                  isStageCompleted 
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-bold'
                    : 'bg-zinc-800 text-cyan-400 border-zinc-700'
                }`}>
                  {isStageCompleted ? <Check className="w-4 h-4" /> : <IconComponent className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white tracking-wide">{stage.title}</h3>
                  <span className="text-[10.5px] text-zinc-400 font-mono">
                    进度 {completedInStage.length}/{stageCourses.length} · {progressPercent}%
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-zinc-400 leading-relaxed pr-2 mt-1">
                {stage.subtitle}
              </p>

              {/* 阶段进度条 */}
              <div className="w-full bg-zinc-800/80 rounded-full h-1.5 mt-2.5 overflow-hidden border border-zinc-700/50">
                <div 
                  className={`h-full transition-all duration-300 ${isStageCompleted ? 'bg-emerald-400' : 'bg-cyan-400'}`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* 推荐下一关 */}
              {nextInStage && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => onSelectCourse(nextInStage.id)}
                    className="w-full py-1.5 px-2.5 rounded-lg text-[11px] font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25 transition-all flex items-center justify-between cursor-pointer"
                  >
                    <span className="truncate">攻克下一关: {nextInStage.title.slice(0, 12)}...</span>
                    <ArrowRight className="w-3 h-3 shrink-0 ml-1" />
                  </button>
                </div>
              )}
            </div>

            {/* 右侧关卡卡片网格 */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {stageCourses.map((c, cIdx) => {
                const isCompleted = completedCourseIds.includes(c.id);

                return (
                  <div
                    key={c.id}
                    onClick={() => onSelectCourse(c.id)}
                    className={`p-3.5 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-between select-none ${
                      isCompleted 
                        ? 'bg-[#12171f]/80 border-emerald-500/30 hover:border-emerald-500/60'
                        : 'bg-[#12171f] border-zinc-800 hover:border-cyan-500/50 hover:bg-[#161d27] shadow-xs'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="text-[10px] font-mono font-semibold text-zinc-500">
                          关卡 0{idx + 1}-{cIdx + 1}
                        </span>
                        {isCompleted ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/40 px-1.5 py-0.2 rounded border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3 fill-current" /> 已通关
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                            <Clock className="w-3 h-3" /> {c.estimatedMinutes}m
                          </span>
                        )}
                      </div>

                      <h4 className="text-xs font-bold text-white group-hover:text-cyan-400 transition-colors line-clamp-1">
                        {c.title}
                      </h4>
                      <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                        {c.summary}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-zinc-800/80 text-[10px]">
                      <div className="flex gap-1 flex-wrap">
                        {c.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="px-1.5 py-0.2 rounded bg-zinc-800/80 text-zinc-400">
                            #{tag}
                          </span>
                        ))}
                      </div>

                      <span className="flex items-center gap-1 text-cyan-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>去试炼</span>
                        <Play className="w-2.5 h-2.5 fill-current" />
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
  );
};

export default AcademyRoadmapView;
