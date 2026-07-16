/**
 * SceneGuidanceBanner — 本体模块工作模式引导
 *
 * 当画布视图节点数少于 5 时显示，帮助用户在三种工作模式中快速选择。
 * 面向有明确目标的专业用户，而非初次接触的引导式体验。
 */

import React from 'react';
import { Network, Sparkles, ArrowRight, Database, BarChart3 } from 'lucide-react';

interface SceneGuidanceBannerProps {
  onNavigate: (tab: 'canvas' | 'graph') => void;
  /** Whether to show the banner. Default: always show in canvas when this component is rendered. */
  alwaysShow?: boolean;
}

export const SceneGuidanceBanner: React.FC<SceneGuidanceBannerProps> = ({
  onNavigate,
  alwaysShow = false,
}) => {
  return (
    <div className="px-4 py-3 border-b border-monokai-border/20 bg-monokai-sidebar/20">
      <div className="flex items-center gap-6">
        {/* Mode selector */}
        <div className="flex items-center gap-1 p-1 bg-monokai-bg/50 rounded-xl border border-monokai-border/15">
          <button
            onClick={() => onNavigate('canvas')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all text-monokai-amethyst bg-monokai-amethyst/10 border border-monokai-amethyst/20"
          >
            <Network className="w-3.5 h-3.5" />
            结构画布
          </button>
          <button
            onClick={() => onNavigate('graph')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all text-monokai-comment hover:text-monokai-cyan hover:bg-monokai-cyan/5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            探索图谱
          </button>
        </div>

        {/* Quick guidance */}
        <div className="flex items-center gap-4 text-[11px] text-monokai-comment/50">
          <div className="flex items-center gap-1.5">
            <Database className="w-3 h-3" />
            <span>Schema Tab 可选择数据库表</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ArrowRight className="w-3 h-3" />
            <span>推断本体结构后自动填充画布</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SceneGuidanceBanner;
