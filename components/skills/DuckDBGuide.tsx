/**
 * DuckDBGuide — Compact overview entry point for AI Skills
 *
 * Acts as the "Guide" view that delegates to BrowseMode via callbacks.
 * No internal state — all analysis and execution uses SkillContext.
 * This component replaces the monolithic DuckDBSkillsGuide.tsx.
 *
 * This component replaces the monolithic DuckDBSkillsGuide.tsx.
 * It is NOT currently imported in App.tsx — designed as an optional
 * entry point alongside SkillPanel.
 */

import React, { useEffect, useState } from 'react';
import {
  Terminal,
  Lightbulb,
  LayoutGrid,
  ArrowRight,
  Loader2,
  Search,
} from 'lucide-react';
import {
  AISkill,
  SkillChain,
} from '../../types';
import { CATEGORY_DESIGN, getSkillIcon } from '../theme/ai-skills';
import { SkillChainPanel } from './SkillChainPanel';
import { ExecutionResultPanel } from './ExecutionResultPanel';
import { ThinkingDisplay } from './ThinkingDisplay';
import { useSkillContext } from './context/SkillContext';
import { getAllSkills } from '../../services/skillRegistry';
import { COGNITIVE_LAYERS } from '../../services/skills/definitions';

interface DuckDBGuideProps {
  className?: string;
  currentTable?: string;
}

export const DuckDBGuide: React.FC<DuckDBGuideProps> = ({
  className = '',
  currentTable,
}) => {
  const {
    nlInput, setNlInput,
    intentAnalysis, suggestedSkills,
    executionResult: skillResult,
    handleAnalyze: onAnalyze,
    handleExecute: onOneClickGenerate,
    isExecuting: isAnalyzingOrExecuting,
    setSelectedSkill: setBrowseSkill,
    setViewMode,
    currentTable: ctxTable,
    thinkingSteps,
    streamingSql,
    executionProgress,
    cancelExecution,
  } = useSkillContext();

  const tableName = currentTable || ctxTable;

  const allSkills = getAllSkills();
  const [tipIndex, setTipIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeHandbookLayer, setActiveHandbookLayer] = useState<string>('all');
  const [thinkingCollapsed, setThinkingCollapsed] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setTipIndex(prev => prev + 1), 5000);
    return () => clearInterval(id);
  }, []);

  // 内置技能（不含 handbook）vs 官方手册
  const builtInCount = allSkills.filter((s: any) => s.category !== 'handbook').length;
  const handbookCount = allSkills.filter((s: any) => s.category === 'handbook').length;

  // 过滤后的技能列表
  const filteredSkills = (() => {
    if (activeCategory === 'all') return allSkills;
    if (activeCategory !== 'handbook') {
      return allSkills.filter((s: any) => s.category === activeCategory);
    }
    // handbook 分类：按认知层级进一步过滤
    return allSkills.filter((s: any) => {
      if (s.category !== 'handbook') return false;
      if (activeHandbookLayer === 'all') return true;
      const skillIntent = (s as any)._layer;
      return skillIntent === activeHandbookLayer;
    });
  })();

  const activeTip = allSkills[tipIndex % allSkills.length];
  const ALL_CATEGORIES = ['all', 'modeling', 'wrangling', 'insights', 'optimization', 'engineering', 'handbook'] as const;

  const handleBrowseSkill = (skill: AISkill) => {
    setBrowseSkill(skill);
    setViewMode('browse');
  };

  const handleBrowseAll = () => {
    setViewMode('browse');
  };

  // 当前分类的设计色（自然语言输入区顶边强调色）
  const currentCatDesign = activeCategory === 'all'
    ? { primary: '#ae81ff', accentBorder: 'border-t-monokai-purple' }
    : (() => {
        const d = CATEGORY_DESIGN[activeCategory as any];
        return d
          ? { primary: d.colors.primary, accentBorder: `border-t-[${d.colors.primary}]` }
          : { primary: '#ae81ff', accentBorder: 'border-t-monokai-purple' };
      })();

  return (
    <div className={`flex flex-col h-full ${className}`}>

      {/* ─── Top Area: Header + Category Strip (fixed) ─────────── */}
      <div className="shrink-0">

        {/* ─── Header ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-3 mx-5 mt-5 px-4 py-3 bg-[#1e1f1c] border border-[#3e3d32] relative overflow-hidden">
          {/* 左侧渐变装饰条 */}
          <div
            className="absolute left-0 top-0 bottom-0 w-[3px]"
            style={{ background: `linear-gradient(to bottom, ${currentCatDesign.primary}, transparent)` }}
          />
          <div className="flex items-center gap-3 pl-2">
            {/* 图标容器：发光效果 */}
            <div
              className="w-10 h-10 flex items-center justify-center border border-[#49483e]"
              style={{
                background: `${currentCatDesign.primary}18`,
                boxShadow: `0 0 12px ${currentCatDesign.primary}30`,
              }}
            >
              <Terminal className="w-5 h-5" style={{ color: currentCatDesign.primary }} />
            </div>
            <div>
              <h3 className="text-[13px] font-bold text-monokai-fg flex items-center gap-2 mb-0.5">
                <span>AI Skills</span>
                <span
                  className="px-1.5 py-0.5 text-[10px] font-mono font-normal rounded border"
                  style={{
                    background: `${currentCatDesign.primary}18`,
                    color: currentCatDesign.primary,
                    borderColor: `${currentCatDesign.primary}40`,
                  }}
                >
                  {builtInCount} 内置
                </span>
                <span
                  className="px-1.5 py-0.5 text-[10px] font-mono font-normal rounded border"
                  style={{
                    background: '#e6db7418',
                    color: '#e6db74',
                    borderColor: '#e6db7440',
                  }}
                >
                  {handbookCount} 官方
                </span>
                {tableName && (
                  <span className="px-1.5 py-0.5 text-[10px] bg-[#a6e22e]/15 text-monokai-green rounded border border-[#a6e22e]/30 font-mono font-normal">
                    {tableName}
                  </span>
                )}
              </h3>
              <p className="text-[10px] text-monokai-comment font-mono">AI 智能生成 · 意图分析 · 技能链组合</p>
            </div>
          </div>

          {/* 右侧滚动提示 */}
          <div
            className="flex items-center gap-2 px-3 py-2 max-w-[240px] shrink-0 border"
            style={{ background: '#272822', borderColor: '#3e3d32' }}
          >
            <div className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ background: currentCatDesign.primary }} />
            <div className="overflow-hidden flex-1">
              <div className="text-[10px] text-monokai-comment whitespace-nowrap overflow-hidden text-ellipsis font-mono">
                <span className="font-mono font-medium" style={{ color: currentCatDesign.primary }}>{activeTip?.name}</span>
                <span className="mx-1 opacity-50">·</span>
                <span className="text-monokai-comment">{activeTip?.description?.slice(0, 26)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Category filter strip ─────────────────────────────── */}
        <div className="flex items-center gap-2 mx-5 mb-3 overflow-x-auto custom-scrollbar pb-0.5">
          {ALL_CATEGORIES.map(cat => {
            const design = cat === 'all' ? null : CATEGORY_DESIGN[cat as any];
            const isActive = activeCategory === cat;

            if (cat === 'all') {
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className="shrink-0 px-3 py-1.5 text-xs border transition-all duration-200 cursor-pointer"
                  style={{
                    background: isActive ? '#ae81ff20' : '#272822',
                    borderColor: isActive ? '#ae81ff' + '60' : '#3e3d32',
                    color: isActive ? '#ae81ff' : '#75715e',
                    boxShadow: isActive ? '0 0 8px #ae81ff30' : 'none',
                  }}
                >
                  所有
                </button>
              );
            }
            if (!design) return null;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs border transition-all duration-200 cursor-pointer"
                style={{
                  background: isActive ? `${design.colors.primary}20` : '#272822',
                  borderColor: isActive ? `${design.colors.primary}60` : '#3e3d32',
                  color: isActive ? design.colors.primary : '#75715e',
                  boxShadow: isActive ? `0 0 8px ${design.colors.primary}30` : 'none',
                }}
              >
                <span>{design.emoji}</span>
                <span>{design.label}</span>
              </button>
            );
          })}

          <button
            onClick={handleBrowseAll}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs border border-monokai-purple/40 text-monokai-purple hover:border-monokai-purple/70 hover:text-monokai-fg transition-all duration-200 ml-auto cursor-pointer"
          >
            <LayoutGrid className="w-3 h-3" />
            详情模式
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* ─── Handbook cognitive layer sub-strip ─────────────────── */}
        {activeCategory === 'handbook' && (
          <div className="flex items-center gap-1.5 mx-5 mb-3 overflow-x-auto custom-scrollbar pb-0.5">
            {([{ layer: 'all', label: '全部' }, ...COGNITIVE_LAYERS] as const).map(l => {
              const isActive = activeHandbookLayer === l.layer;
              const layerColor = l.layer === 'all' ? '#e6db74'
                : l.layer === 'perception' ? '#66d9ef'
                : l.layer === 'strategy' ? '#ae81ff'
                : l.layer === 'execution' ? '#a6e22e'
                : '#f1fa8c';
              const count = l.layer === 'all'
                ? handbookCount
                : allSkills.filter((s: any) => s.category === 'handbook' && (s as any)._layer === l.layer).length;
              return (
                <button
                  key={l.layer}
                  onClick={() => setActiveHandbookLayer(l.layer)}
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1 text-[10px] border transition-all duration-200 cursor-pointer"
                  style={{
                    background: isActive ? `${layerColor}20` : '#1e1f1c',
                    borderColor: isActive ? `${layerColor}60` : '#3e3d32',
                    color: isActive ? layerColor : '#75715e',
                  }}
                >
                  <span>{l.label}</span>
                  <span className="opacity-60">({count})</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Middle Area: Skill Grid (independent scroll) ───────── */}
      <div className="shrink-0 mx-5 overflow-y-auto custom-scrollbar" style={{ maxHeight: '280px' }}>
        <div className="grid gap-2.5 py-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {filteredSkills.map((skill: any) => {
            const design = CATEGORY_DESIGN[skill.category];
            const Icon = getSkillIcon(skill.id);
            const isActive = suggestedSkills.some((s: any) => s.id === skill.id);

            // Handbook 技能显示认知层级，而非长分类名
            const handbookLayer = (skill as any)._layer as string | undefined;
            const handbookLayerMeta = handbookLayer
              ? COGNITIVE_LAYERS.find(l => l.layer === handbookLayer)
              : undefined;
            const layerColor = handbookLayerMeta?.color === 'cyan' ? '#66d9ef'
              : handbookLayerMeta?.color === 'purple' ? '#ae81ff'
              : handbookLayerMeta?.color === 'green' ? '#a6e22e'
              : handbookLayerMeta?.color === 'yellow' ? '#f1fa8c'
              : design.colors.primary;
            const layerLabel = handbookLayerMeta?.label;

            return (
              <button
                key={skill.id}
                onClick={() => handleBrowseSkill(skill)}
                className="group relative flex items-start gap-2 px-3 py-2.5 border cursor-pointer transition-all duration-200 text-left rounded-lg"
                style={{
                  background: isActive ? `${design.colors.primary}15` : '#1e1f1c',
                  borderColor: isActive ? `${design.colors.primary}60` : '#3e3d32',
                  boxShadow: isActive ? `0 0 10px ${design.colors.primary}20` : 'none',
                }}
              >
                {/* 左侧彩色强调条 */}
                <div
                  className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full transition-all duration-200"
                  style={{ background: design.colors.primary, opacity: isActive ? 1 : 0 }}
                />
                <div
                  className="w-8 h-8 rounded flex items-center justify-center shrink-0 border transition-all duration-200"
                  style={{
                    background: `${design.colors.primary}15`,
                    borderColor: isActive ? `${design.colors.primary}50` : '#3e3d32',
                  }}
                >
                  <Icon className="w-4 h-4 transition-colors duration-200" style={{ color: design.colors.primary }} />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span
                    className="text-[11px] font-semibold font-sans transition-colors duration-200 leading-tight line-clamp-2"
                    style={{ color: design.colors.primary }}
                  >
                    {/* 去掉 name 末尾的英文括号，如 "时间特征探测器 (Time Character Detector)" */}
                    {skill.name.replace(/\s*\([A-Za-z\s&:']+\)\s*$/, '').trim()}
                  </span>
                  {/* Handbook 显示认知层级；内置显示分类标签 */}
                  {layerLabel ? (
                    <span
                      className="text-[9px] font-mono mt-0.5"
                      style={{ color: layerColor }}
                    >
                      {layerLabel}
                    </span>
                  ) : (
                    <span className="text-[9px] text-monokai-comment whitespace-nowrap mt-0.5">
                      {design.label}
                    </span>
                  )}
                  {/* 技能描述（仅当有中文且不含英文引导语时显示） */}
                  {skill.description && !/^[A-Za-z]/.test(skill.description) && (
                    <span className="text-[8px] text-monokai-comment mt-0.5 leading-tight line-clamp-2">
                      {skill.description}
                    </span>
                  )}
                </div>
                <ArrowRight
                  className="w-3 h-3 shrink-0 mt-0.5 opacity-0 group-hover:opacity-60 transition-opacity duration-200"
                  style={{ color: design.colors.primary }}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Bottom Area: NL Input + Results (scrollable) ──────── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar mx-5 mb-5">
        {/* ─── NL Input Section ──────────────────────────────────── */}
        <div
          className="mt-3 mb-4 p-4 border border-[#3e3d32] relative overflow-hidden"
          style={{
            background: '#1e1f1c',
            borderTopWidth: '2px',
            borderTopColor: currentCatDesign.primary,
          }}
        >
          {/* 内部微弱背景渐变 */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(135deg, ${currentCatDesign.primary}08 0%, transparent 60%)`,
            }}
          />

          <div className="flex items-center gap-2 mb-3 relative">
            <Search className="w-3.5 h-3.5 shrink-0" style={{ color: currentCatDesign.primary }} />
            <span className="text-xs font-semibold font-sans text-monokai-fg">自然语言 → SQL</span>
            <span className="text-[10px] text-monokai-comment ml-auto font-mono">输入需求，AI 自动分析并生成</span>
          </div>

          <div className="flex gap-2.5 relative">
            <input
              type="text"
              value={nlInput}
              onChange={e => { setNlInput(e.target.value); }}
              onKeyDown={e => e.key === 'Enter' && onAnalyze()}
              placeholder={tableName
                ? `针对 ${tableName} 描述需求，例如：统计每月的订单数量`
                : '描述你的 SQL 需求，例如：创建一个用户表'}
              className="flex-1 px-3 py-2 text-xs bg-[#272822] border border-[#49483e] text-monokai-fg placeholder-monokai-comment/50 focus:outline-none focus:border-[#75715e] font-sans"
            />
            <button
              onClick={() => onAnalyze()}
              disabled={isAnalyzingOrExecuting || !nlInput.trim()}
              className="px-3 py-2 text-xs border text-monokai-comment hover:text-monokai-fg hover:border-[#75715e] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 font-sans cursor-pointer"
            >
              {isAnalyzingOrExecuting ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 分析中</>
              ) : (
                <><Lightbulb className="w-3.5 h-3.5" /> 分析</>
              )}
            </button>
            <button
              onClick={() => onOneClickGenerate()}
              disabled={isAnalyzingOrExecuting || !nlInput.trim()}
              className="px-4 py-2 text-xs font-sans cursor-pointer transition-all duration-200 flex items-center gap-1.5 border"
              style={{
                background: isAnalyzingOrExecuting || !nlInput.trim() ? '#ae81ff30' : '#ae81ff',
                borderColor: isAnalyzingOrExecuting || !nlInput.trim() ? '#ae81ff40' : '#ae81ff',
                color: isAnalyzingOrExecuting || !nlInput.trim() ? '#ae81ff80' : '#1e1f1c',
                opacity: isAnalyzingOrExecuting || !nlInput.trim() ? 0.5 : 1,
              }}
            >
              {isAnalyzingOrExecuting ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 生成中</>
              ) : '一键生成'}
            </button>
          </div>

          {/* Intent analysis result */}
          {intentAnalysis && (
            <div
              className="mt-3 p-2.5 border"
              style={{ background: '#272822', borderColor: '#3e3d32' }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] text-monokai-comment font-mono">意图识别:</span>
                <span
                  className="text-[10px] px-1.5 py-0.5 border font-mono"
                  style={{
                    background: intentAnalysis.confidence >= 0.8
                      ? '#a6e22e18'
                      : intentAnalysis.confidence >= 0.5
                      ? '#e6db7418'
                      : '#f9267218',
                    color: intentAnalysis.confidence >= 0.8
                      ? '#a6e22e'
                      : intentAnalysis.confidence >= 0.5
                      ? '#e6db74'
                      : '#f92672',
                    borderColor: intentAnalysis.confidence >= 0.8
                      ? '#a6e22e40'
                      : intentAnalysis.confidence >= 0.5
                      ? '#e6db7440'
                      : '#f9267240',
                  }}
                >
                  {intentAnalysis.intent} · {Math.round(intentAnalysis.confidence * 100)}%
                </span>
              </div>
            </div>
          )}

          {/* Recommended skills */}
          {suggestedSkills.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[10px] text-monokai-comment font-mono">推荐技能:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {suggestedSkills.slice(0, 5).map(skill => {
                  const design = CATEGORY_DESIGN[skill.category];
                  const Icon = getSkillIcon(skill.id);
                  return (
                    <button
                      key={skill.id}
                      onClick={() => handleBrowseSkill(skill)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-sans border transition-all duration-200 cursor-pointer"
                      style={{
                        background: `${design.colors.primary}12`,
                        borderColor: `${design.colors.primary}40`,
                        color: design.colors.primary,
                      }}
                    >
                      <Icon className="w-3 h-3 shrink-0" />
                      <span className="font-medium font-sans">{skill.name}</span>
                      <ArrowRight className="w-2.5 h-2.5 opacity-60" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Thinking Display (while executing) */}
        {isAnalyzingOrExecuting && thinkingSteps.length > 0 && (
          <ThinkingDisplay
            steps={thinkingSteps}
            streamingSql={streamingSql}
            isCollapsed={thinkingCollapsed}
            onToggleCollapse={() => setThinkingCollapsed(prev => !prev)}
            onCancel={cancelExecution}
            progress={executionProgress}
          />
        )}

        {/* Final result (after execution completes) */}
        {skillResult && !isAnalyzingOrExecuting && (
          <ExecutionResultPanel
            result={skillResult}
            streamingSql={streamingSql}
            showInsertButton={true}
            insertButtonText="插入到编辑器"
          />
        )}

        {/* Skill Chain Panel */}
        {intentAnalysis?.skillChain && (
          <div className="mb-3">
            <SkillChainPanel
              chain={intentAnalysis.skillChain as SkillChain}
              allSkills={allSkills}
              onSelectSkill={(skillId) => {
                const skill = allSkills.find((s: any) => s.id === skillId);
                if (skill) handleBrowseSkill(skill);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default DuckDBGuide;
