import React from 'react';

/** 渲染引擎模式：MECE 三选一 —— SVG D3 / HTML5 Canvas / WebGL Pixi */
export type RenderEngineMode = 'svg' | 'canvas' | 'webgl';

/** 渲染引擎元数据 */
export const RENDER_ENGINE_META: Record<RenderEngineMode, {
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  description: string;
  hint: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  svg: {
    label: 'SVG D3 (矢量交互)',
    shortLabel: 'SVG',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
    description: 'D3 + SVG 力导向物理仿真，矢量无损缩放，支持细粒度高光与动态流向粒子',
    hint: '≤500节点推荐',
    color: 'var(--monokai-cyan)',
    bgColor: 'color-mix(in srgb, var(--monokai-cyan) 12%, transparent)',
    borderColor: 'color-mix(in srgb, var(--monokai-cyan) 45%, transparent)',
  },
  canvas: {
    label: 'Canvas 2D (极速绘制)',
    shortLabel: 'Canvas',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>,
    description: 'HTML5 Canvas 2D 硬件批量绘制，60 FPS 极速平移缩放，零 DOM 开销',
    hint: '500-3000节点推荐',
    color: 'var(--monokai-accent)',
    bgColor: 'color-mix(in srgb, var(--monokai-accent) 12%, transparent)',
    borderColor: 'color-mix(in srgb, var(--monokai-accent) 45%, transparent)',
  },
  webgl: {
    label: 'WebGL Pixi (GPU加速)',
    shortLabel: 'WebGL',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
    description: 'PixiJS WebGL 硬件着色器加速，空间视锥剔除与 LOD 动态分级，超大规模首选',
    hint: '≥3000节点推荐',
    color: 'var(--monokai-orange)',
    bgColor: 'color-mix(in srgb, var(--monokai-orange) 12%, transparent)',
    borderColor: 'color-mix(in srgb, var(--monokai-orange) 45%, transparent)',
  },
};

