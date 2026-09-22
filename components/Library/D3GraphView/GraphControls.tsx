/**
 * D3GraphView.controls.tsx - 图谱物理控制面板 (Monokai 主题优化版)
 * 
 * 职责：
 * 1. 物理参数滑块
 * 2. 布局统计信息
 * 3. 权重阈值滑块
 * 
 * @design Monokai 主题一致性 - 所有组件使用统一的 monokai-* CSS 变量
 */

import React, { useCallback } from 'react';
import { X, ChevronDown, ChevronUp, Activity, Zap, Target, Layers, Hexagon, GitBranch, Gauge } from 'lucide-react';

// ==================== 样式常量 ====================

const PANEL_BASE = 'absolute top-12 right-3 w-72 bg-gradient-to-b from-monokai-surface/98 via-monokai-surface/92 to-monokai-sidebar/95 backdrop-blur-md border border-monokai-border/80 rounded-lg shadow-[0_12px_40px_-16px_rgba(0,0,0,0.75)] z-30 overflow-hidden';
const HEADER = 'flex items-center justify-between px-3 py-2 bg-monokai-bg/60 border-b border-monokai-border/40';
const HEADER_TITLE = 'flex items-center gap-2 text-[12px] font-medium text-monokai-fg';
const CONTENT = 'p-3 space-y-4 max-h-96 overflow-y-auto custom-scrollbar';
const SECTION_TITLE = 'text-[10px] font-bold uppercase tracking-[0.12em] text-monokai-comment/80 flex items-center gap-1.5 mb-2';
const STAT_CARD = 'bg-monokai-bg/50 rounded px-2 py-1.5';
const CLOSE_BTN = 'p-1 text-monokai-comment hover:text-monokai-fg hover:bg-monokai-bg/60 rounded transition-colors';
const ICON_BASE = 'w-3.5 h-3.5';

// 滑块样式
const SLIDER_CONTAINER = 'space-y-1';
const SLIDER_HEADER = 'flex items-center justify-between text-[11px]';
const SLIDER_LABEL = 'flex items-center gap-1.5 text-monokai-comment';
const SLIDER_VALUE = 'text-monokai-fg-muted font-mono';
const SLIDER_TRACK = 'relative h-1.5 bg-monokai-bg/60 rounded-full overflow-hidden';
const SLIDER_FILL = 'absolute top-0 left-0 h-full rounded-full transition-all';
const SLIDER_INPUT = 'relative w-full h-1.5 bg-transparent appearance-none cursor-pointer accent-monokai-cyan';

// ==================== 辅助函数 ====================

/** 获取 FPS 颜色 */
function getFpsColor(fps: number): string {
  if (fps >= 50) return 'text-monokai-accent';
  if (fps >= 30) return 'text-monokai-yellow';
  return 'text-monokai-pink';
}

/** 获取性能等级颜色 */
function getPerfColor(renderTime: number): string {
  if (renderTime < 50) return 'text-monokai-accent';
  if (renderTime < 150) return 'text-monokai-cyan';
  if (renderTime < 300) return 'text-monokai-yellow';
  return 'text-monokai-pink';
}

// ==================== 滑块组件 ====================

interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  icon?: React.ReactNode;
  color?: string;
}

const SliderControl: React.FC<SliderControlProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  formatValue,
  icon,
  color = '#66d9ef',
}) => {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseFloat(e.target.value));
  }, [onChange]);
  
  const percentage = ((value - min) / (max - min)) * 100;
  const displayValue = formatValue ? formatValue(value) : value.toFixed(step < 1 ? 2 : 0);
  
  return (
    <div className={SLIDER_CONTAINER}>
      <div className={SLIDER_HEADER}>
        <span className={SLIDER_LABEL}>
          {icon && <span style={{ color }}>{icon}</span>}
          {label}
        </span>
        <span className={SLIDER_VALUE}>{displayValue}</span>
      </div>
      <div className={SLIDER_TRACK}>
        <div 
          className={SLIDER_FILL}
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          className={SLIDER_INPUT}
        />
      </div>
    </div>
  );
};

// ==================== 类型定义 ====================

export interface GraphControlsProps {
  // Physics Parameters
  chargeStrength: number;
  onChargeStrengthChange: (value: number) => void;
  linkDistance: number;
  onLinkDistanceChange: (value: number) => void;
  collisionRadius: number;
  onCollisionRadiusChange: (value: number) => void;
  velocityDecay: number;
  onVelocityDecayChange: (value: number) => void;
  gravityStrength: number;
  onGravityStrengthChange: (value: number) => void;
  linkStrength: number;
  onLinkStrengthChange: (value: number) => void;
  
  // Filters
  weightThreshold: number;
  onWeightThresholdChange: (value: number) => void;
  
  // Layout Stats
  layoutStatsExpanded: boolean;
  onLayoutStatsToggle: () => void;
  layoutStats?: {
    nodeCount: number;
    linkCount: number;
    visibleCount: number;
    culledCount: number;
    renderTime: number;
    fps: number;
  };
  
  // UI State
  isVisible: boolean;
  onClose: () => void;
}

// ==================== 主组件 ====================

/**
 * GraphControls - 图谱物理控制面板 (Monokai 主题版)
 * 
 * 提供力导向布局的物理参数调整和布局统计信息。
 * 使用统一的 Monokai 主题色彩系统。
 */
export const GraphControls: React.FC<GraphControlsProps> = ({
  chargeStrength,
  onChargeStrengthChange,
  linkDistance,
  onLinkDistanceChange,
  collisionRadius,
  onCollisionRadiusChange,
  velocityDecay,
  onVelocityDecayChange,
  gravityStrength,
  onGravityStrengthChange,
  linkStrength,
  onLinkStrengthChange,
  weightThreshold,
  onWeightThresholdChange,
  layoutStatsExpanded,
  onLayoutStatsToggle,
  layoutStats,
  isVisible,
  onClose,
}) => {
  if (!isVisible) return null;
  
  const CYAN = '#66d9ef';
  const YELLOW = '#e6db74';
  const GREEN = '#a6e22e';
  
  return (
    <div className={PANEL_BASE}>
      {/* 头部 */}
      <div className={HEADER}>
        <div className={HEADER_TITLE}>
          <Zap className={ICON_BASE} style={{ color: YELLOW }} />
          <span>物理参数</span>
        </div>
        <button onClick={onClose} className={CLOSE_BTN}>
          <X className="w-4 h-4" />
        </button>
      </div>
      
      {/* 内容 */}
      <div className={CONTENT}>
        {/* 力参数 */}
        <div className="space-y-3">
          <h4 className={SECTION_TITLE}>
            <Activity className="w-3 h-3" />
            力参数
          </h4>
          
          <SliderControl
            label="电荷强度"
            value={chargeStrength}
            min={-500}
            max={-20}
            step={10}
            onChange={onChargeStrengthChange}
            formatValue={(v) => v.toString()}
            icon={<Zap className="w-3 h-3" />}
            color={CYAN}
          />
          
          <SliderControl
            label="连线距离"
            value={linkDistance}
            min={30}
            max={200}
            step={5}
            onChange={onLinkDistanceChange}
            formatValue={(v) => `${v}px`}
            icon={<Target className="w-3 h-3" />}
            color={CYAN}
          />
          
          <SliderControl
            label="碰撞半径"
            value={collisionRadius}
            min={5}
            max={50}
            step={1}
            onChange={onCollisionRadiusChange}
            formatValue={(v) => `${v}px`}
            icon={<Target className="w-3 h-3" />}
            color={CYAN}
          />
          
          <SliderControl
            label="连线强度"
            value={linkStrength}
            min={0.1}
            max={2}
            step={0.1}
            onChange={onLinkStrengthChange}
            formatValue={(v) => v.toFixed(1)}
            icon={<Layers className="w-3 h-3" />}
            color={CYAN}
          />
        </div>
        
        {/* 阻尼参数 */}
        <div className="space-y-3">
          <h4 className={SECTION_TITLE}>
            <Activity className="w-3 h-3" />
            阻尼参数
          </h4>
          
          <SliderControl
            label="速度衰减"
            value={velocityDecay}
            min={0.01}
            max={0.9}
            step={0.01}
            onChange={onVelocityDecayChange}
            formatValue={(v) => v.toFixed(2)}
            icon={<Activity className="w-3 h-3" />}
            color={YELLOW}
          />
          
          <SliderControl
            label="重力强度"
            value={gravityStrength}
            min={0}
            max={1}
            step={0.05}
            onChange={onGravityStrengthChange}
            formatValue={(v) => v.toFixed(2)}
            icon={<Activity className="w-3 h-3" />}
            color={YELLOW}
          />
        </div>
        
        {/* 过滤参数 */}
        <div className="space-y-3">
          <h4 className={SECTION_TITLE}>
            <Target className="w-3 h-3" />
            过滤
          </h4>
          
          <SliderControl
            label="权重阈值"
            value={weightThreshold}
            min={0}
            max={1}
            step={0.05}
            onChange={onWeightThresholdChange}
            formatValue={(v) => v.toFixed(2)}
            icon={<Target className="w-3 h-3" />}
            color={GREEN}
          />
        </div>
        
        {/* 布局统计 */}
        {layoutStats && (
          <div className="space-y-2">
            <button
              onClick={onLayoutStatsToggle}
              className="w-full flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.12em] text-monokai-comment/80 hover:text-monokai-fg transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Activity className="w-3 h-3" />
                布局统计
              </span>
              {layoutStatsExpanded ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
            
            {layoutStatsExpanded && (
              <>
                {/* 性能指示器 */}
                <div className={`${STAT_CARD} flex items-center justify-between border border-monokai-border/40`}>
                  <div className="flex items-center gap-1.5">
                    <Gauge className={`w-4 h-4 ${getPerfColor(layoutStats.renderTime)}`} />
                    <span className="text-[10px] text-monokai-comment">渲染</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[11px] font-mono font-bold ${getFpsColor(layoutStats.fps)}`}>
                      {layoutStats.fps.toFixed(0)} FPS
                    </span>
                    <span className={`text-[11px] font-mono ${getPerfColor(layoutStats.renderTime)}`}>
                      {layoutStats.renderTime.toFixed(1)}ms
                    </span>
                  </div>
                </div>
                
                {/* 统计网格 */}
                <div className="grid grid-cols-2 gap-1.5">
                  <div className={`${STAT_CARD} flex items-center justify-between`}>
                    <div className="flex items-center gap-1">
                      <Hexagon className="w-3 h-3 text-monokai-fg-muted" />
                      <span className="text-[9px] text-monokai-comment/70">节点</span>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-monokai-fg">{layoutStats.nodeCount}</span>
                  </div>
                  <div className={`${STAT_CARD} flex items-center justify-between`}>
                    <div className="flex items-center gap-1">
                      <GitBranch className="w-3 h-3 text-monokai-fg-muted" />
                      <span className="text-[9px] text-monokai-comment/70">边</span>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-monokai-fg">{layoutStats.linkCount}</span>
                  </div>
                  <div className={`${STAT_CARD} flex items-center justify-between`}>
                    <div className="flex items-center gap-1">
                      <Activity className="w-3 h-3 text-monokai-accent" />
                      <span className="text-[9px] text-monokai-comment/70">可见</span>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-monokai-accent">{layoutStats.visibleCount}</span>
                  </div>
                  <div className={`${STAT_CARD} flex items-center justify-between`}>
                    <div className="flex items-center gap-1">
                      <Target className="w-3 h-3 text-monokai-comment" />
                      <span className="text-[9px] text-monokai-comment/70">裁剪</span>
                    </div>
                    <span className="text-[11px] font-mono text-monokai-comment">{layoutStats.culledCount}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GraphControls;
