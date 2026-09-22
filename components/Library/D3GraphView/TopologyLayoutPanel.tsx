/**
 * TopologyLayoutPanel.tsx — 拓扑布局控制面板（MECE 重构与功能完善版）
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * MECE 信息架构 (Mutually Exclusive, Collectively Exhaustive)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * 【四象限 Tab 互斥且穷尽分区】
 * Tab 1: 布局模式 (Layout Modes)      — 12种算法四维互斥分类/动效预览/独立检索/智能推荐/方向切换
 * Tab 2: 力场动力 (Physics Dynamics)   — 算法适应性感知/5大场景预设/自定义预设管理/6大精细参数
 * Tab 3: 视觉过滤 (Visuals & Filters)  — 实体类型双向联动过滤/关系权重过滤/4档标签展示/交互辅助开关
 * Tab 4: 拓扑诊断 (Diagnostics)       — 真实FPS与耗时趋势图/质量评分/PageRank核心枢纽/完整报告入口
 *
 * 【全局顶底固定工具条】
 * 顶部导航条: 布局名称与状态徽标 / 撤销与重做 / 快捷键速查 / 帮助指南 / 关闭折叠
 * 底部功能栏: 适配重置快捷操作 / 多格式综合导出中心 / AI生成与清空安全入口
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, {
  useState, useCallback, useMemo, useRef, useEffect,
  useImperativeHandle, forwardRef
} from 'react';
import {
  // 基础与视图图标
  Eye, Maximize2, RotateCcw, ZoomIn, ZoomOut, RefreshCw,
  LayoutGrid, GitBranch, Network, CircleDot, Hexagon, Star,
  Sliders, Activity, ChevronDown, ChevronUp,
  Sparkles, Download, Trash2, AlertTriangle,
  Target, Move, Lock, Lasso, Flame, HelpCircle, X,
  Keyboard, CheckCircle2, TrendingUp, Search, Filter, Tag,
  Save, Upload, ListFilter, Grid3X3, Layers,
  ArrowRightLeft, Zap as PhysicsZap, Gauge,
  Radio, Maximize, Star as StarIcon, Clock, Cpu,
  Database, GitFork, Settings2, Zap,
  // 历史与操作图标
  Undo2, Redo2, Image as ImageIcon, Copy, Play,
  EyeOff, Focus, SkipForward, SkipBack,
  Hash, Box, Hexagon as HexagonIcon, Circle,
  // 趋势与辅助图标
  BarChart2, PieChart, TrendingDown, Minus,
  Save as SaveIcon, Trash, Edit3, Plus, Check, XCircle,
  Sun, Moon, Monitor, Eye as EyeIcon, EyeOff as EyeOffIcon,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  Info, Lightbulb, Wand2, RefreshCw as RefreshCwIcon,
  FileText, Table2, Code2, ShieldAlert
} from 'lucide-react';
import type { D3LayoutMode, EdgeRoutingMode, EdgeLabelDisplay } from './D3GraphView.types';

// ==================== 类型定义 ====================

/** 布局分类 (MECE 4大互斥分类) */
export type LayoutCategory = 'hierarchical' | 'network' | 'radial' | 'grid';

/** 物理参数场景预设 */
export type PhysicsPreset = 'auto' | 'spread' | 'compact' | 'explore' | 'diagnostic';

/** 标签显示策略 */
export type LabelDisplayMode = 'auto' | 'all' | 'top' | 'hover';

/** 布局主方向 */
export type LayoutDirection = 'LR' | 'TB';

/** 节点类型过滤 */
export type NodeTypeFilter = 'typeHub' | 'instance' | 'action';

/** 面板主 Tab */
export type TopologyPanelTab = 'layout' | 'physics' | 'visuals' | 'analytics';

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
    label: 'SVG D3',
    shortLabel: 'SVG',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
    description: 'D3 + SVG 力导向仿真，最灵活但节点密集时性能受限',
    hint: '≤500节点推荐',
    color: '#66d9ef',
    bgColor: 'rgba(102, 217, 239, 0.12)',
    borderColor: 'rgba(102, 217, 239, 0.45)',
  },
  canvas: {
    label: 'Canvas 2D',
    shortLabel: 'Canvas',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>,
    description: 'HTML5 Canvas 2D 渲染，批量绘制性能优秀，适合中大规模图谱',
    hint: '500-3000节点推荐',
    color: '#a6e22e',
    bgColor: 'rgba(166, 226, 46, 0.12)',
    borderColor: 'rgba(166, 226, 46, 0.45)',
  },
  webgl: {
    label: 'WebGL Pixi',
    shortLabel: 'WebGL',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
    description: 'PixiJS WebGL 硬件加速，节点密集时（>3000）性能最优',
    hint: '≥3000节点推荐',
    color: '#fd971f',
    bgColor: 'rgba(253, 151, 31, 0.12)',
    borderColor: 'rgba(253, 151, 31, 0.45)',
  },
};

/** 布局模式元数据 */
export interface LayoutMeta {
  mode: D3LayoutMode;
  label: string;
  category: LayoutCategory;
  categoryLabel: string;
  description: string;
  icon: React.ReactNode;
  recommended: boolean;
  recommendedReason?: string;
  bestFor?: string[];
  suitableScale?: 'tiny' | 'small' | 'medium' | 'large' | 'any';
  suitableDensity?: 'low' | 'medium' | 'high' | 'any';
  /** 是否依赖力导向仿真驱动 */
  isForceDriven?: boolean;
  /** 预览布局配置: 模拟节点分布坐标 */
  previewConfig?: { centerX: number; centerY: number; nodes: { x: number; y: number; r: number; opacity?: number }[] };
}

/** 布局快照 (用于对比与恢复) */
export interface LayoutSnapshot {
  id: string;
  mode: D3LayoutMode;
  label: string;
  timestamp: number;
  nodePositions: Record<string, { x: number; y: number }>;
}

/** 自定义物理预设 */
export interface CustomPhysicsPreset {
  id: string;
  name: string;
  chargeStrength: number;
  linkDistance: number;
  collisionRadius: number;
  velocityDecay: number;
  gravityStrength: number;
  linkStrength: number;
  createdAt: number;
}

/** 性能健康级别 */
export type PerfLevel = 'excellent' | 'good' | 'warning' | 'critical';

export interface PerfConfig {
  level: PerfLevel;
  color: string;
  bgColor: string;
  borderColor: string;
  label: string;
  score: number;
}

export interface PerfDataPoint {
  timestamp: number;
  fps: number;
  renderTime: number;
  nodeCount: number;
}

// ==================== 常量与元数据 ====================

const PERF_CONFIGS: Record<PerfLevel, PerfConfig> = {
  excellent: { level: 'excellent', color: 'text-monokai-accent', bgColor: 'bg-monokai-accent/10', borderColor: 'border-monokai-accent/30', label: '极佳', score: 95 },
  good: { level: 'good', color: 'text-monokai-cyan', bgColor: 'bg-monokai-cyan/10', borderColor: 'border-monokai-cyan/30', label: '良好', score: 80 },
  warning: { level: 'warning', color: 'text-monokai-yellow', bgColor: 'bg-monokai-yellow/10', borderColor: 'border-monokai-yellow/30', label: '负载偏高', score: 55 },
  critical: { level: 'critical', color: 'text-monokai-pink', bgColor: 'bg-monokai-pink/10', borderColor: 'border-monokai-pink/30', label: '性能警告', score: 25 },
};

/** 分类元数据 (MECE 互斥分类体系) */
export const CATEGORY_METADATA: Record<LayoutCategory, {
  label: string; icon: React.ReactNode; description: string; hint: string; color: string;
}> = {
  hierarchical: {
    label: '层级结构', icon: <GitBranch className="w-3.5 h-3.5" />,
    description: '展示有向依赖与流程推进关系，自动最小化交叉连线', hint: '流程图、依赖演进、因果链路', color: '#66d9ef',
  },
  network: {
    label: '网状结构', icon: <Network className="w-3.5 h-3.5" />,
    description: '自由实体关联，社群聚类与自然吸引聚集', hint: '社交网络、隐性关系发现、社群聚类', color: '#a6e22e',
  },
  radial: {
    label: '辐射结构', icon: <CircleDot className="w-3.5 h-3.5" />,
    description: '以核心枢纽向外环形/星系扩散，凸显中心影响力', hint: '中心枢纽、影响力层阶、分类星系', color: '#fd971f',
  },
  grid: {
    label: '网格结构', icon: <LayoutGrid className="w-3.5 h-3.5" />,
    description: '规则同质节点均匀分布，适合对比与矩阵排布', hint: '资产对比、均匀展示、同质卡片', color: '#ae81ff',
  },
};

/** 12 种布局算法注册表 (MECE 完全穷尽) */
export const LAYOUT_REGISTRY: LayoutMeta[] = [
  // ══ 1. 层级结构 (4种) ══
  {
    mode: 'topologicalFlow', label: '拓扑语义层级流', category: 'hierarchical',
    categoryLabel: '层级结构', description: '基于拓扑排序与最长路径，自动分配语义层级，有效消除连线重叠',
    icon: <GitBranch className="w-4 h-4" />, recommended: false,
    bestFor: ['语义关联', '依赖链路', '混合节点'], suitableScale: 'any', suitableDensity: 'any',
    isForceDriven: true,
    previewConfig: {
      centerX: 50, centerY: 50,
      nodes: [
        { x: 15, y: 50, r: 5 }, { x: 38, y: 50, r: 6 }, { x: 38, y: 28, r: 4 },
        { x: 62, y: 28, r: 4 }, { x: 62, y: 50, r: 6 }, { x: 38, y: 72, r: 4 },
        { x: 62, y: 72, r: 4 }, { x: 85, y: 50, r: 5 },
      ],
    },
  },
  {
    mode: 'dagre', label: 'Dagre 严格分层', category: 'hierarchical',
    categoryLabel: '层级结构', description: '严格有向无环图分层算法，适合秩序井然的单向流程图',
    icon: <Layers className="w-4 h-4" />, recommended: false,
    bestFor: ['流程图', '单向依赖', '严格阶层'], suitableScale: 'medium', suitableDensity: 'medium',
    isForceDriven: false,
    previewConfig: {
      centerX: 50, centerY: 50,
      nodes: [
        { x: 20, y: 20, r: 4 }, { x: 50, y: 20, r: 4 }, { x: 80, y: 20, r: 4 },
        { x: 35, y: 50, r: 4 }, { x: 65, y: 50, r: 4 }, { x: 50, y: 80, r: 4 },
      ],
    },
  },
  {
    mode: 'verticalTree', label: '纵向层级树', category: 'hierarchical',
    categoryLabel: '层级结构', description: '自上而下的经典树形流，适合主干展开与父子分支',
    icon: <GitFork className="w-4 h-4" />, recommended: false,
    bestFor: ['组织架构', '分类树', '父子派生'], suitableScale: 'small', suitableDensity: 'low',
    isForceDriven: false,
    previewConfig: {
      centerX: 50, centerY: 50,
      nodes: [
        { x: 50, y: 15, r: 5 }, { x: 30, y: 40, r: 4 }, { x: 70, y: 40, r: 4 },
        { x: 50, y: 40, r: 4 }, { x: 20, y: 70, r: 3 }, { x: 40, y: 70, r: 3 },
        { x: 60, y: 70, r: 3 }, { x: 80, y: 70, r: 3 },
      ],
    },
  },
  {
    mode: 'horizontalTree', label: '横向层级树', category: 'hierarchical',
    categoryLabel: '层级结构', description: '自左至右横向展开树，适合展示长链路和时间线脉络',
    icon: <ArrowRightLeft className="w-4 h-4" />, recommended: true,
    recommendedReason: '知识图谱默认推荐：自左至右横向展开树，层级脉络最直观',
    bestFor: ['时间线', '长链演进', '横向推演'], suitableScale: 'small', suitableDensity: 'low',
    isForceDriven: false,
    previewConfig: {
      centerX: 50, centerY: 50,
      nodes: [
        { x: 15, y: 50, r: 5 }, { x: 40, y: 30, r: 4 }, { x: 40, y: 70, r: 4 },
        { x: 65, y: 20, r: 3 }, { x: 65, y: 50, r: 3 }, { x: 65, y: 80, r: 3 },
        { x: 85, y: 15, r: 3 }, { x: 85, y: 85, r: 3 },
      ],
    },
  },

  // ══ 2. 网状结构 (3种) ══
  {
    mode: 'force', label: '有机力导向', category: 'network',
    categoryLabel: '网状结构', description: '纯物理引力与斥力模拟，节点自然聚合成团，最具探索动感',
    icon: <Zap className="w-4 h-4" />, recommended: false,
    recommendedReason: '自由探索复杂隐性联系，适合非结构化图谱',
    bestFor: ['自然探索', '聚类发现', '弱结构网'], suitableScale: 'small', suitableDensity: 'any',
    isForceDriven: true,
    previewConfig: {
      centerX: 50, centerY: 50,
      nodes: [
        { x: 50, y: 50, r: 6 }, { x: 30, y: 30, r: 4 }, { x: 70, y: 30, r: 4 },
        { x: 30, y: 70, r: 4 }, { x: 70, y: 70, r: 4 }, { x: 20, y: 50, r: 3 },
        { x: 80, y: 50, r: 3 }, { x: 50, y: 20, r: 3 }, { x: 50, y: 80, r: 3 },
      ],
    },
  },
  {
    mode: 'clusteredForce', label: '社区重心极坐标', category: 'network',
    categoryLabel: '网状结构', description: '基于 Louvain 社区发现算法，社区各自抱团并环形分布',
    icon: <Hexagon className="w-4 h-4" />, recommended: false,
    bestFor: ['社群发现', '模块聚类', '多社区大图'], suitableScale: 'medium', suitableDensity: 'medium',
    isForceDriven: true,
    previewConfig: {
      centerX: 50, centerY: 50,
      nodes: [
        { x: 30, y: 30, r: 5 }, { x: 25, y: 35, r: 3 }, { x: 35, y: 25, r: 3 },
        { x: 70, y: 30, r: 5 }, { x: 65, y: 35, r: 3 }, { x: 75, y: 25, r: 3 },
        { x: 50, y: 75, r: 5 }, { x: 45, y: 70, r: 3 }, { x: 55, y: 80, r: 3 },
      ],
    },
  },
  {
    mode: 'groupedCircular', label: '分组环形', category: 'network',
    categoryLabel: '网状结构', description: '按节点概念类型分组，组内环状排列，组间连线清晰透亮',
    icon: <CircleDot className="w-4 h-4" />, recommended: false,
    bestFor: ['类型切片', '多主体关系', '宏观概览'], suitableScale: 'any', suitableDensity: 'any',
    isForceDriven: true,
    previewConfig: {
      centerX: 50, centerY: 50,
      nodes: [
        { x: 50, y: 50, r: 7 }, { x: 20, y: 25, r: 3 }, { x: 30, y: 15, r: 3 }, { x: 15, y: 35, r: 3 },
        { x: 80, y: 25, r: 3 }, { x: 70, y: 15, r: 3 }, { x: 85, y: 35, r: 3 },
        { x: 20, y: 75, r: 3 }, { x: 30, y: 85, r: 3 }, { x: 80, y: 75, r: 3 }, { x: 70, y: 85, r: 3 },
      ],
    },
  },

  // ══ 3. 辐射结构 (4种) ══
  {
    mode: 'concentric', label: '同心圆同轴径向', category: 'radial',
    categoryLabel: '辐射结构', description: '按度数中心度分层，关键节点居中，次级节点按同心圆向外环绕',
    icon: <Target className="w-4 h-4" />, recommended: false,
    bestFor: ['核心度分析', '中心影响力', '同心圆'], suitableScale: 'small', suitableDensity: 'low',
    isForceDriven: false,
    previewConfig: {
      centerX: 50, centerY: 50,
      nodes: [
        { x: 50, y: 50, r: 6 },
        { x: 25, y: 25, r: 3 }, { x: 75, y: 25, r: 3 }, { x: 25, y: 75, r: 3 }, { x: 75, y: 75, r: 3 },
        { x: 50, y: 18, r: 3 }, { x: 50, y: 82, r: 3 }, { x: 18, y: 50, r: 3 }, { x: 82, y: 50, r: 3 },
      ],
    },
  },
  {
    mode: 'starburst', label: '星系辐射', category: 'radial',
    categoryLabel: '辐射结构', description: '以核心枢纽为星核，关联实例沿射线向外爆发，视觉冲击力强',
    icon: <Star className="w-4 h-4" />, recommended: false,
    bestFor: ['星爆扩散', '单核带动', '视觉大屏'], suitableScale: 'small', suitableDensity: 'low',
    isForceDriven: true,
    previewConfig: {
      centerX: 50, centerY: 50,
      nodes: [
        { x: 50, y: 50, r: 7 }, { x: 50, y: 15, r: 4 }, { x: 80, y: 30, r: 3 },
        { x: 85, y: 60, r: 3 }, { x: 70, y: 85, r: 3 }, { x: 30, y: 85, r: 3 },
        { x: 15, y: 60, r: 3 }, { x: 20, y: 30, r: 3 },
      ],
    },
  },
  {
    mode: 'dandelion', label: '蒲公英扇形径向', category: 'radial',
    categoryLabel: '辐射结构', description: 'TypeHub 概念作为花心，各 Instance 实例按类型扇形向外发散',
    icon: <Radio className="w-4 h-4" />, recommended: false,
    bestFor: ['本体类型', '花瓣聚拢', '层次分明'], suitableScale: 'medium', suitableDensity: 'medium',
    isForceDriven: false,
    previewConfig: {
      centerX: 50, centerY: 50,
      nodes: [
        { x: 50, y: 50, r: 7 }, { x: 30, y: 30, r: 3 }, { x: 70, y: 30, r: 3 },
        { x: 25, y: 55, r: 3 }, { x: 75, y: 55, r: 3 }, { x: 35, y: 75, r: 3 }, { x: 65, y: 75, r: 3 },
      ],
    },
  },
  {
    mode: 'spoke', label: '轮辐辐射骨架', category: 'radial',
    categoryLabel: '辐射结构', description: '等角射线对称布局，保证每个子分支间距对称均匀',
    icon: <Settings2 className="w-4 h-4" />, recommended: false,
    bestFor: ['对称轮辐', '均匀对比', '核心辐射'], suitableScale: 'small', suitableDensity: 'low',
    isForceDriven: false,
    previewConfig: {
      centerX: 50, centerY: 50,
      nodes: [
        { x: 50, y: 50, r: 6 }, { x: 50, y: 20, r: 3 }, { x: 78, y: 35, r: 3 },
        { x: 78, y: 65, r: 3 }, { x: 50, y: 80, r: 3 }, { x: 22, y: 65, r: 3 }, { x: 22, y: 35, r: 3 },
      ],
    },
  },

  // ══ 4. 网格结构 (1种) ══
  {
    mode: 'grid', label: '同质正交网格', category: 'grid',
    categoryLabel: '网格结构', description: '所有实体节点规则排布在规整方阵上，完全消除视觉重叠',
    icon: <LayoutGrid className="w-4 h-4" />, recommended: false,
    bestFor: ['同质方阵', '规则对比', '卡片矩阵'], suitableScale: 'any', suitableDensity: 'any',
    isForceDriven: false,
    previewConfig: {
      centerX: 50, centerY: 50,
      nodes: [
        { x: 20, y: 20, r: 4 }, { x: 40, y: 20, r: 4 }, { x: 60, y: 20, r: 4 }, { x: 80, y: 20, r: 4 },
        { x: 20, y: 50, r: 4 }, { x: 40, y: 50, r: 4 }, { x: 60, y: 50, r: 4 }, { x: 80, y: 50, r: 4 },
        { x: 20, y: 80, r: 4 }, { x: 40, y: 80, r: 4 }, { x: 60, y: 80, r: 4 }, { x: 80, y: 80, r: 4 },
      ],
    },
  },
];

export interface PhysicsPresetConfig {
  id: PhysicsPreset;
  label: string;
  icon: React.ReactNode;
  description: string;
  hint: string;
  chargeStrength: number;
  linkDistance: number;
  collisionRadius: number;
  velocityDecay: number;
  gravityStrength: number;
  linkStrength: number;
}

/** 5 大内置物理力场预设 */
export const PHYSICS_PRESETS: PhysicsPresetConfig[] = [
  {
    id: 'auto', label: '智能调优', icon: <Focus className="w-3.5 h-3.5" />,
    description: '根据图谱规模自动平衡引力与斥力', hint: '适合大多数通用本体知识图谱',
    chargeStrength: -180, linkDistance: 150, collisionRadius: 14, velocityDecay: 0.4, gravityStrength: 0.15, linkStrength: 0.4,
  },
  {
    id: 'spread', label: '展开避障', icon: <ZoomIn className="w-3.5 h-3.5" />,
    description: '增强排斥力与连线距离，充分拉开重叠节点', hint: '适合密集图谱、边交叉较严重场景',
    chargeStrength: -280, linkDistance: 200, collisionRadius: 18, velocityDecay: 0.35, gravityStrength: 0.1, linkStrength: 0.3,
  },
  {
    id: 'compact', label: '紧凑全景', icon: <ZoomOut className="w-3.5 h-3.5" />,
    description: '增强引力与约束刚度，收拢视野节省画布空间', hint: '适合大图全貌宏观鸟瞰或小屏展示',
    chargeStrength: -120, linkDistance: 90, collisionRadius: 10, velocityDecay: 0.5, gravityStrength: 0.25, linkStrength: 0.6,
  },
  {
    id: 'explore', label: '敏锐探索', icon: <Eye className="w-3.5 h-3.5" />,
    description: '降低速度衰减阻尼，增强灵敏互动回弹', hint: '适合动态拖动探索隐藏因果关系',
    chargeStrength: -200, linkDistance: 130, collisionRadius: 12, velocityDecay: 0.2, gravityStrength: 0.12, linkStrength: 0.35,
  },
  {
    id: 'diagnostic', label: '平稳诊断', icon: <Activity className="w-3.5 h-3.5" />,
    description: '超高阻尼与弱微扰，锁定布局便于结构观察', hint: '适合静态研读、拓扑度量指标分析',
    chargeStrength: -80, linkDistance: 200, collisionRadius: 8, velocityDecay: 0.7, gravityStrength: 0.05, linkStrength: 0.15,
  },
];

// ==================== 样式常量 ====================

const SURFACE = 'bg-[#1e1f1c]/95 border border-monokai-border/80 rounded-xl shadow-[0_16px_48px_-12px_rgba(0,0,0,0.85)] backdrop-blur-xl text-monokai-fg font-sans';
const GROUP_CARD = 'rounded-lg border border-monokai-border/60 bg-monokai-bg/50 p-2.5 flex flex-col gap-2';
const SECTION_LABEL = 'text-[10px] font-bold uppercase tracking-[0.12em] text-monokai-comment flex items-center gap-1.5';
const TAB_BTN_ACTIVE = 'flex-1 py-1.5 px-1 rounded-md text-[11px] font-semibold bg-monokai-cyan/15 text-monokai-cyan border border-monokai-cyan/40 shadow-sm transition-all flex items-center justify-center gap-1';
const TAB_BTN_INACTIVE = 'flex-1 py-1.5 px-1 rounded-md text-[11px] font-medium text-monokai-comment hover:text-monokai-fg hover:bg-monokai-bg/40 border border-transparent transition-all flex items-center justify-center gap-1';
const BTN_PRIMARY = 'inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold bg-monokai-cyan/15 text-monokai-cyan border border-monokai-cyan/40 hover:bg-monokai-cyan/25 hover:border-monokai-cyan/60 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_SECONDARY = 'inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-monokai-bg/70 text-monokai-fg-muted border border-monokai-border/70 hover:bg-monokai-elevated hover:text-monokai-fg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_AI = 'inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-monokai-accent/12 text-monokai-accent border border-monokai-accent/35 hover:bg-monokai-accent/22 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_DANGER = 'inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-monokai-pink/12 text-monokai-pink border border-monokai-pink/35 hover:bg-monokai-pink/22 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_TOGGLE_ACTIVE = 'flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold bg-monokai-cyan/12 text-monokai-cyan border border-monokai-cyan/45 transition-colors cursor-pointer shadow-[0_0_8px_rgba(102,217,239,0.15)]';
const BTN_TOGGLE_INACTIVE = 'flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-monokai-bg/40 text-monokai-comment border border-monokai-border/60 hover:bg-monokai-elevated/70 hover:text-monokai-fg transition-colors cursor-pointer';

// ==================== 辅助计算 ====================

function getGraphFeatureSummary(nodeCount: number, linkCount: number) {
  const density = nodeCount > 1 ? (2 * linkCount) / (nodeCount * (nodeCount - 1)) : 0;
  const features: string[] = [];
  if (nodeCount > 80) features.push('大图谱');
  else if (nodeCount > 25) features.push('中型图谱');
  else if (nodeCount > 0) features.push('精简图谱');
  if (density > 0.4) features.push('高密度连通');
  else if (density > 0.15) features.push('中密度网络');
  else if (density > 0) features.push('稀疏结构');
  return { density, features };
}

export function getRecommendedLayout(nodeCount: number, linkCount: number, hasDirectionalLinks: boolean): LayoutMeta | null {
  if (nodeCount === 0) return null;
  const density = nodeCount > 1 ? (2 * linkCount) / (nodeCount * (nodeCount - 1)) : 0;
  if (nodeCount > 60 && linkCount > nodeCount * 0.4) {
    return LAYOUT_REGISTRY.find(l => l.mode === 'topologicalFlow') || null;
  }
  if (nodeCount <= 25 && density < 0.2) {
    return LAYOUT_REGISTRY.find(l => l.mode === 'dandelion') || null;
  }
  if (nodeCount <= 30 && hasDirectionalLinks) {
    return LAYOUT_REGISTRY.find(l => l.mode === 'horizontalTree') || null;
  }
  return LAYOUT_REGISTRY.find(l => l.mode === 'horizontalTree') || null;
}

function getPerfLevel(avgMs: number): PerfLevel {
  if (avgMs <= 18) return 'excellent';
  if (avgMs <= 45) return 'good';
  if (avgMs <= 90) return 'warning';
  return 'critical';
}

function calculateLayoutQualityScore(
  nodeCount: number,
  linkCount: number,
  layoutMode: D3LayoutMode,
  perfLevel: PerfLevel
): number {
  let score = 75;
  const meta = LAYOUT_REGISTRY.find(l => l.mode === layoutMode);
  if (meta?.recommended) score += 10;
  if (nodeCount > 60 && meta?.suitableScale === 'large') score += 10;
  if (nodeCount <= 20 && meta?.suitableScale === 'small') score += 8;

  if (perfLevel === 'excellent') score += 10;
  else if (perfLevel === 'good') score += 5;
  else if (perfLevel === 'warning') score -= 15;
  else if (perfLevel === 'critical') score -= 30;

  return Math.max(10, Math.min(99, score));
}

function getPerfTrend(data: PerfDataPoint[]): 'up' | 'down' | 'stable' {
  if (!data || data.length < 3) return 'stable';
  const recent = data.slice(-4).map(d => d.renderTime);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const last = recent[recent.length - 1];
  const diff = last - avg;
  if (diff > 5) return 'down'; // 耗时增加，性能下降
  if (diff < -5) return 'up';   // 耗时减少，性能上升
  return 'stable';
}

// ==================== 子组件 ====================

/** 性能趋势迷你折线图 */
const PerfMiniChart: React.FC<{ data: PerfDataPoint[]; metric: 'fps' | 'renderTime' }> = ({ data, metric }) => {
  const points = (data || []).slice(-12);
  if (points.length < 2) {
    return <div className="h-6 flex items-center justify-center text-[9px] text-monokai-comment/50">等待采样中...</div>;
  }

  const values = points.map(p => metric === 'fps' ? p.fps : p.renderTime);
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values);
  const range = maxVal - minVal || 1;

  const W = 100;
  const H = 24;
  const padding = 2;

  const coords = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * (W - padding * 2);
    const y = H - padding - ((v - minVal) / range) * (H - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M ${coords.join(' L ')}`;
  const areaD = `M ${padding},${H - padding} L ${coords.join(' L ')} L ${W - padding},${H - padding} Z`;
  const color = metric === 'fps' ? '#a6e22e' : '#66d9ef';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-6 overflow-visible">
      <defs>
        <linearGradient id={`grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#grad-${metric})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

/** 动效节点分布预览 SVG */
const LayoutSimPreview: React.FC<{
  mode: D3LayoutMode; color: string; isActive: boolean; size?: number;
}> = ({ mode, color, isActive, size = 52 }) => {
  const meta = LAYOUT_REGISTRY.find(l => l.mode === mode);
  const config = meta?.previewConfig;
  const strokeColor = isActive ? color : 'rgba(255,255,255,0.35)';
  const fillColor = isActive ? color : 'rgba(255,255,255,0.2)';

  const getConnections = (): { x1: number; y1: number; x2: number; y2: number }[] => {
    const conns: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const nodes = config?.nodes || [];
    const n = nodes.length;
    if (n < 2) return conns;

    switch (mode) {
      case 'topologicalFlow':
        for (let i = 0; i < n - 1; i++) {
          conns.push({ x1: nodes[i].x, y1: nodes[i].y, x2: nodes[i + 1].x, y2: nodes[i + 1].y });
        }
        break;
      case 'verticalTree':
      case 'horizontalTree':
        conns.push({ x1: nodes[0].x, y1: nodes[0].y, x2: nodes[1].x, y2: nodes[1].y });
        conns.push({ x1: nodes[0].x, y1: nodes[0].y, x2: nodes[2].x, y2: nodes[2].y });
        if (n >= 5) {
          conns.push({ x1: nodes[1].x, y1: nodes[1].y, x2: nodes[3].x, y2: nodes[3].y });
          conns.push({ x1: nodes[2].x, y1: nodes[2].y, x2: nodes[4].x, y2: nodes[4].y });
        }
        break;
      case 'concentric':
      case 'starburst':
      case 'dandelion':
      case 'spoke':
        for (let i = 1; i < n; i++) {
          conns.push({ x1: nodes[0].x, y1: nodes[0].y, x2: nodes[i].x, y2: nodes[i].y });
        }
        break;
      case 'grid':
        for (let i = 0; i < n; i++) {
          if (i % 4 !== 3 && i + 1 < n) conns.push({ x1: nodes[i].x, y1: nodes[i].y, x2: nodes[i + 1].x, y2: nodes[i + 1].y });
        }
        break;
      default:
        for (let i = 0; i < Math.min(n - 1, 5); i++) {
          conns.push({ x1: nodes[i].x, y1: nodes[i].y, x2: nodes[i + 1].x, y2: nodes[i + 1].y });
        }
    }
    return conns;
  };

  const conns = getConnections();

  return (
    <svg viewBox="0 0 100 100" className="overflow-visible" style={{ width: size, height: size }} aria-hidden="true">
      {conns.map((c, i) => (
        <line
          key={i}
          x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2}
          stroke={strokeColor}
          strokeWidth="1.5"
          opacity={isActive ? 0.75 : 0.3}
          strokeLinecap="round"
        />
      ))}
      {(config?.nodes || []).map((node, i) => (
        <circle
          key={i}
          cx={node.x} cy={node.y} r={node.r || 4}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={i === 0 ? 2 : 1}
          opacity={(node as any).opacity ?? 1}
        />
      ))}
    </svg>
  );
};

/** 布局卡片组件 */
const LayoutCard: React.FC<{
  meta: LayoutMeta;
  isActive: boolean;
  onSelect: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}> = ({ meta, isActive, onSelect, isFavorite, onToggleFavorite }) => {
  const categoryColor = CATEGORY_METADATA[meta.category].color;
  return (
    <div
      className={`group relative flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer ${
        isActive
          ? 'bg-monokai-cyan/12 border-monokai-cyan/50 shadow-[0_0_14px_rgba(102,217,239,0.18)]'
          : 'bg-monokai-bg/40 border-monokai-border/40 hover:bg-monokai-bg/70 hover:border-monokai-border/80'
      }`}
      onClick={onSelect}
    >
      <div className="shrink-0 p-1 rounded-md bg-monokai-bg/60 border border-monokai-border/40">
        <LayoutSimPreview mode={meta.mode} color={categoryColor} isActive={isActive} size={42} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-[11px] font-semibold truncate ${isActive ? 'text-monokai-cyan' : 'text-monokai-fg'}`}>
            {meta.label}
          </span>
          {meta.recommended && (
            <span className="shrink-0 text-[9px] px-1.5 py-px rounded bg-monokai-accent/20 text-monokai-accent border border-monokai-accent/35 font-bold flex items-center gap-0.5">
              <Sparkles className="w-2.5 h-2.5" />推荐
            </span>
          )}
          {!meta.isForceDriven && (
            <span className="shrink-0 text-[8px] px-1 py-px rounded bg-monokai-purple/15 text-monokai-purple border border-monokai-purple/30 font-mono">
              几何静态
            </span>
          )}
        </div>
        <p className="text-[10px] text-monokai-comment line-clamp-1 mt-0.5 leading-snug">
          {meta.description}
        </p>
        {meta.bestFor && meta.bestFor.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {meta.bestFor.slice(0, 3).map(tag => (
              <span key={tag} className="text-[8.5px] px-1 py-px rounded bg-monokai-bg/80 text-monokai-comment/80 border border-monokai-border/30">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
        className={`shrink-0 p-1.5 rounded-md transition-colors ${
          isFavorite ? 'text-monokai-yellow' : 'text-monokai-comment/40 hover:text-monokai-yellow hover:bg-monokai-yellow/10'
        }`}
        title={isFavorite ? '取消收藏' : '收藏此布局'}
        aria-label={isFavorite ? '取消收藏' : '收藏此布局'}
      >
        <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
      </button>
    </div>
  );
};

/** 高精度力场参数滑块 */
const ParameterSlider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  color?: string;
  onChange: (v: number) => void;
}> = ({ label, value, min, max, step = 1, unit = '', disabled = false, color = '#66d9ef', onChange }) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    const delta = (e.shiftKey ? 5 : 1) * step;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(Math.max(min, value - delta));
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(Math.min(max, value + delta));
    }
  };

  return (
    <div className={`flex items-center gap-2 text-[11px] ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
      <span className="w-16 shrink-0 text-monokai-comment text-[10px] font-medium">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
        onKeyDown={handleKeyDown}
        className="flex-1 h-1.5 appearance-none bg-monokai-bg rounded-full cursor-pointer accent-current"
        style={{ accentColor: color }}
        aria-label={label}
        title={`${label}: ${value}${unit} (方向键微调, Shift+方向键加速)`}
      />
      <span className="w-12 text-right font-mono text-[10.5px] text-monokai-fg tabular-nums shrink-0">
        {value}{unit}
      </span>
    </div>
  );
};

// ==================== 主组件接口 ====================

export interface TopologyLayoutPanelProps {
  // S0: 渲染引擎模式 (MECE 三选一)
  renderEngineMode?: RenderEngineMode;
  onRenderEngineModeChange?: (mode: RenderEngineMode) => void;

  // S1: 视图基础控制
  onFitAll: () => void;
  onResetLayout: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRefresh: () => void;
  layoutDirection?: LayoutDirection;
  onLayoutDirectionChange?: (dir: LayoutDirection) => void;

  // S2: 布局算法模式
  layoutMode: D3LayoutMode;
  onLayoutModeChange: (mode: D3LayoutMode) => void;

  // 实体与全局搜索 (解耦)
  searchTerm?: string;
  onSearchTermChange?: (term: string) => void;

  // S3: 视觉与标签展示策略
  labelMode?: LabelDisplayMode;
  onLabelModeChange?: (mode: LabelDisplayMode) => void;
  onExport?: () => void;
  onClear?: () => void;
  onAIFill?: () => void;

  // S4: 交互行为开关
  clickToFocus: boolean;
  onClickToFocusChange: (v: boolean) => void;
  isFixedDrag: boolean;
  onIsFixedDragChange: (v: boolean) => void;
  isLassoMode: boolean;
  onIsLassoModeChange: (v: boolean) => void;
  showPageRank: boolean;
  onShowPageRankChange: (v: boolean) => void;

  // S5: 物理力场参数
  chargeStrength: number;
  onChargeStrengthChange: (v: number) => void;
  linkDistance: number;
  onLinkDistanceChange: (v: number) => void;
  collisionRadius: number;
  onCollisionRadiusChange: (v: number) => void;
  velocityDecay: number;
  onVelocityDecayChange: (v: number) => void;
  gravityStrength: number;
  onGravityStrengthChange: (v: number) => void;
  linkStrength: number;
  onLinkStrengthChange: (v: number) => void;

  // S6: 规模与性能指标
  nodeCount: number;
  linkCount: number;
  fps?: number;
  renderTime?: number;
  perfHistory?: PerfDataPoint[];

  // 节点类型过滤联动
  nodeTypeFilters?: Set<NodeTypeFilter>;
  onNodeTypeFiltersChange?: (filters: Set<NodeTypeFilter>) => void;
  nodeCountByType?: { typeHub: number; instance: number; action: number };

  // 关系权重阈值过滤
  weightThreshold?: number;
  onWeightThresholdChange?: (val: number) => void;

  // 连线渲染与动效设置 (MECE 连线控制)
  showHierarchyLinks?: boolean;
  onShowHierarchyLinksChange?: (val: boolean) => void;
  enableLinkParticles?: boolean;
  onEnableLinkParticlesChange?: (val: boolean) => void;
  edgeRoutingMode?: EdgeRoutingMode;
  onEdgeRoutingModeChange?: (mode: EdgeRoutingMode) => void;
  edgeLabelDisplay?: EdgeLabelDisplay;
  onEdgeLabelDisplayChange?: (display: EdgeLabelDisplay) => void;

  // 导出功能扩展
  onExportPNG?: () => void;
  onExportSVG?: () => void;
  onExportCSV?: () => void;
  onExportExcel?: () => void;
  onExportSubgraphs?: () => void;

  // 布局历史回溯 (撤销/重做)
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;

  // 快照恢复扩展
  onApplySnapshot?: (snapshot: LayoutSnapshot) => void;

  // 默认活动 Tab
  defaultTab?: TopologyPanelTab;

  // 辅助与状态
  onClose?: () => void;
  onShowTopologyReport?: () => void;
  showHelp?: boolean;
  onShowHelpChange?: (v: boolean) => void;
  isLoading?: boolean;
}

export interface TopologyLayoutPanelRef {
  captureSnapshot: () => LayoutSnapshot;
  getSnapshots: () => LayoutSnapshot[];
  getFavoriteLayouts: () => D3LayoutMode[];
}

export const TopologyLayoutPanel = forwardRef<TopologyLayoutPanelRef, TopologyLayoutPanelProps>(({
  // S0: 渲染引擎模式
  renderEngineMode = 'svg', onRenderEngineModeChange,
  // S1
  onFitAll, onResetLayout, onZoomIn, onZoomOut, onRefresh,
  layoutDirection = 'LR', onLayoutDirectionChange,
  // S2
  layoutMode, onLayoutModeChange,
  searchTerm = '', onSearchTermChange,
  labelMode = 'auto', onLabelModeChange,
  onExport, onClear, onAIFill,
  // S4
  clickToFocus, onClickToFocusChange,
  isFixedDrag, onIsFixedDragChange,
  isLassoMode, onIsLassoModeChange,
  showPageRank, onShowPageRankChange,
  // S5
  chargeStrength, onChargeStrengthChange,
  linkDistance, onLinkDistanceChange,
  collisionRadius, onCollisionRadiusChange,
  velocityDecay, onVelocityDecayChange,
  gravityStrength, onGravityStrengthChange,
  linkStrength, onLinkStrengthChange,
  // S6
  nodeCount, linkCount, fps = 60, renderTime = 16,
  perfHistory = [],
  // 过滤
  nodeTypeFilters = new Set(['typeHub', 'instance', 'action']),
  onNodeTypeFiltersChange,
  nodeCountByType = { typeHub: 0, instance: 0, action: 0 },
  weightThreshold = 0.65,
  onWeightThresholdChange,
  // 连线渲染与动效设置
  showHierarchyLinks = true,
  onShowHierarchyLinksChange,
  enableLinkParticles = true,
  onEnableLinkParticlesChange,
  edgeRoutingMode = 'spline',
  onEdgeRoutingModeChange,
  edgeLabelDisplay = 'auto',
  onEdgeLabelDisplayChange,
  // 导出
  onExportPNG, onExportSVG, onExportCSV, onExportExcel, onExportSubgraphs,
  // 历史
  canUndo: parentCanUndo, canRedo: parentCanRedo, onUndo: parentOnUndo, onRedo: parentOnRedo,
  onApplySnapshot,
  defaultTab = 'layout',
  onClose, onShowTopologyReport, showHelp = false, onShowHelpChange, isLoading = false,
}, ref) => {
  // ── 内部状态 (MECE 分层隔离) ────────────────────────────────────────────────

  // 核心 Tab 切换
  const [activeTab, setActiveTab] = useState<TopologyPanelTab>(defaultTab);

  // 独立布局算法搜索 (与图谱实体搜索彻底解耦)
  const [layoutSearchQuery, setLayoutSearchQuery] = useState('');

  // 布局分类筛选标签 (默认全选)
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<Set<LayoutCategory>>(
    new Set(['hierarchical', 'network', 'radial', 'grid'])
  );

  // 收藏的布局集合
  const [favoriteLayouts, setFavoriteLayouts] = useState<Set<D3LayoutMode>>(() => {
    try {
      const saved = localStorage.getItem('duckdb_favorite_layouts');
      return saved ? new Set(JSON.parse(saved)) : new Set(['horizontalTree']);
    } catch {
      return new Set(['horizontalTree']);
    }
  });

  const toggleFavorite = (mode: D3LayoutMode) => {
    setFavoriteLayouts(prev => {
      const next = new Set(prev);
      if (next.has(mode)) next.delete(mode);
      else next.add(mode);
      try { localStorage.setItem('duckdb_favorite_layouts', JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  // 智能推荐是否在本次会话中关闭
  const [recommendDismissed, setRecommendDismissed] = useState(false);

  // 物理场景预设状态
  const [activePhysicsPreset, setActivePhysicsPreset] = useState<PhysicsPreset>('auto');

  // 自定义预设列表
  const [customPresets, setCustomPresets] = useState<CustomPhysicsPreset[]>(() => {
    try {
      const saved = localStorage.getItem('duckdb_custom_physics_presets');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showCustomPresetInput, setShowCustomPresetInput] = useState(false);
  const [customPresetName, setCustomPresetName] = useState('');

  // 布局历史 (备用本地回退，优先联动父组件)
  const [localHistory, setLocalHistory] = useState<D3LayoutMode[]>([layoutMode]);
  const [localHistoryIndex, setLocalHistoryIndex] = useState(0);

  const canUndo = parentCanUndo !== undefined ? parentCanUndo : localHistoryIndex > 0;
  const canRedo = parentCanRedo !== undefined ? parentCanRedo : localHistoryIndex < localHistory.length - 1;

  const handleUndo = useCallback(() => {
    if (parentOnUndo) { parentOnUndo(); return; }
    if (localHistoryIndex > 0) {
      const idx = localHistoryIndex - 1;
      setLocalHistoryIndex(idx);
      onLayoutModeChange(localHistory[idx]);
    }
  }, [parentOnUndo, localHistoryIndex, localHistory, onLayoutModeChange]);

  const handleRedo = useCallback(() => {
    if (parentOnRedo) { parentOnRedo(); return; }
    if (localHistoryIndex < localHistory.length - 1) {
      const idx = localHistoryIndex + 1;
      setLocalHistoryIndex(idx);
      onLayoutModeChange(localHistory[idx]);
    }
  }, [parentOnRedo, localHistoryIndex, localHistory, onLayoutModeChange]);

  const changeLayoutMode = useCallback((mode: D3LayoutMode) => {
    if (mode === layoutMode) return;
    setLocalHistory(prev => [...prev.slice(0, localHistoryIndex + 1), mode].slice(-20));
    setLocalHistoryIndex(prev => prev + 1);
    onLayoutModeChange(mode);
  }, [layoutMode, localHistoryIndex, onLayoutModeChange]);

  // 快照管理
  const [snapshots, setSnapshots] = useState<LayoutSnapshot[]>([]);
  const captureSnapshot = useCallback((): LayoutSnapshot => {
    const meta = LAYOUT_REGISTRY.find(l => l.mode === layoutMode);
    const snap: LayoutSnapshot = {
      id: `snap-${Date.now()}`,
      mode: layoutMode,
      label: meta?.label || layoutMode,
      timestamp: Date.now(),
      nodePositions: {},
    };
    setSnapshots(prev => [snap, ...prev.slice(0, 4)]);
    return snap;
  }, [layoutMode]);

  // 导出 Ref API 给父组件
  useImperativeHandle(ref, () => ({
    captureSnapshot,
    getSnapshots: () => snapshots,
    getFavoriteLayouts: () => [...favoriteLayouts],
  }), [captureSnapshot, snapshots, favoriteLayouts]);

  // 应用物理预设
  const applyPhysicsPreset = useCallback((preset: PhysicsPresetConfig | CustomPhysicsPreset) => {
    onChargeStrengthChange(preset.chargeStrength);
    onLinkDistanceChange(preset.linkDistance);
    onCollisionRadiusChange(preset.collisionRadius);
    onVelocityDecayChange(preset.velocityDecay);
    onGravityStrengthChange(preset.gravityStrength);
    onLinkStrengthChange(preset.linkStrength);
  }, [onChargeStrengthChange, onLinkDistanceChange, onCollisionRadiusChange, onVelocityDecayChange, onGravityStrengthChange, onLinkStrengthChange]);

  // 保存自定义力场预设
  const handleSaveCustomPreset = () => {
    const name = customPresetName.trim() || `自定义预设 ${customPresets.length + 1}`;
    const preset: CustomPhysicsPreset = {
      id: `custom-${Date.now()}`,
      name,
      chargeStrength,
      linkDistance,
      collisionRadius,
      velocityDecay,
      gravityStrength,
      linkStrength,
      createdAt: Date.now(),
    };
    const updated = [preset, ...customPresets.slice(0, 5)];
    setCustomPresets(updated);
    try { localStorage.setItem('duckdb_custom_physics_presets', JSON.stringify(updated)); } catch {}
    setCustomPresetName('');
    setShowCustomPresetInput(false);
  };

  const handleDeleteCustomPreset = (id: string) => {
    const updated = customPresets.filter(p => p.id !== id);
    setCustomPresets(updated);
    try { localStorage.setItem('duckdb_custom_physics_presets', JSON.stringify(updated)); } catch {}
  };

  // 快捷键面板开关
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // 键盘快捷键监听
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); handleUndo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); handleRedo(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleUndo, handleRedo]);

  // ── 计算属性 ──────────────────────────────────────────────────────────────

  const currentLayoutMeta = useMemo(
    () => LAYOUT_REGISTRY.find(l => l.mode === layoutMode) || LAYOUT_REGISTRY[0],
    [layoutMode]
  );

  const graphSummary = useMemo(() => getGraphFeatureSummary(nodeCount, linkCount), [nodeCount, linkCount]);
  const recommendedLayout = useMemo(() => getRecommendedLayout(nodeCount, linkCount, false), [nodeCount, linkCount]);

  // 过滤后的布局列表
  const filteredLayouts = useMemo(() => {
    return LAYOUT_REGISTRY.filter(meta => {
      if (!activeCategoryFilter.has(meta.category)) return false;
      if (!layoutSearchQuery.trim()) return true;
      const q = layoutSearchQuery.toLowerCase();
      return meta.label.toLowerCase().includes(q) ||
        meta.description.toLowerCase().includes(q) ||
        meta.categoryLabel.toLowerCase().includes(q) ||
        meta.bestFor?.some(t => t.toLowerCase().includes(q));
    });
  }, [activeCategoryFilter, layoutSearchQuery]);

  const perfLevel = getPerfLevel(renderTime);
  const perfConfig = PERF_CONFIGS[perfLevel];
  const qualityScore = calculateLayoutQualityScore(nodeCount, linkCount, layoutMode, perfLevel);
  const fpsTrend = getPerfTrend(perfHistory.filter(p => p.fps > 0));

  // ── 渲染界面 ──────────────────────────────────────────────────────────────

  return (
    <div
      className={`${SURFACE} absolute top-3 left-3 z-[1000] flex flex-col w-[360px] max-h-[calc(100vh-28px)] overflow-hidden`}
      role="region"
      aria-label="知识图谱拓扑布局控制中心"
    >
      {/* 顶部彩色流光饰边 */}
      <span className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-monokai-cyan via-monokai-accent to-monokai-purple opacity-80" />

      {/* ═══ 1. 顶部固定状态栏 ═══ */}
      <div className="shrink-0 flex items-center justify-between px-3.5 py-2.5 border-b border-monokai-border/60 bg-monokai-surface/40">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-monokai-cyan/15 border border-monokai-cyan/40 flex items-center justify-center shrink-0">
            <Sliders className="w-4 h-4 text-monokai-cyan" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[13px] text-monokai-fg leading-tight">拓扑布局</span>
              <span
                className="text-[9px] px-1.5 py-px rounded-full font-medium"
                style={{
                  backgroundColor: `${CATEGORY_METADATA[currentLayoutMeta.category].color}20`,
                  color: CATEGORY_METADATA[currentLayoutMeta.category].color,
                  border: `1px solid ${CATEGORY_METADATA[currentLayoutMeta.category].color}40`,
                }}
              >
                {currentLayoutMeta.categoryLabel}
              </span>
            </div>
            <span className="block text-[10px] text-monokai-comment/80 truncate">
              {currentLayoutMeta.label}
            </span>
          </div>
        </div>

        {/* 顶部右侧快捷按钮群 */}
        <div className="flex items-center gap-1 shrink-0">
          {/* 撤销 / 重做 */}
          <button
            onClick={handleUndo}
            disabled={!canUndo}
            title="撤销布局 (Ctrl+Z)"
            aria-label="撤销"
            className="p-1.5 rounded text-monokai-comment hover:bg-monokai-bg/60 hover:text-monokai-fg disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleRedo}
            disabled={!canRedo}
            title="重做布局 (Ctrl+Y)"
            aria-label="重做"
            className="p-1.5 rounded text-monokai-comment hover:bg-monokai-bg/60 hover:text-monokai-fg disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          {/* 快捷键参考 */}
          <button
            onClick={() => setShowShortcutsModal(!showShortcutsModal)}
            title="快捷键速查"
            aria-label="快捷键速查"
            className={`p-1.5 rounded transition-colors ${showShortcutsModal ? 'text-monokai-cyan bg-monokai-cyan/15' : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-bg/60'}`}
          >
            <Keyboard className="w-3.5 h-3.5" />
          </button>

          {/* 使用指南 */}
          {onShowHelpChange && (
            <button
              onClick={() => onShowHelpChange(!showHelp)}
              title="使用指南"
              aria-label="使用指南"
              className={`p-1.5 rounded transition-colors ${showHelp ? 'text-monokai-cyan bg-monokai-cyan/15' : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-bg/60'}`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          )}

          {/* 关闭面板 */}
          {onClose && (
            <button
              onClick={onClose}
              title="隐藏面板"
              aria-label="隐藏控制面板"
              className="p-1.5 rounded text-monokai-comment hover:text-monokai-fg hover:bg-monokai-bg/60 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ═══ 2. MECE 四象限 Tab 切换条 ═══ */}
      <div className="shrink-0 p-1.5 bg-monokai-bg/60 border-b border-monokai-border/40 flex items-center gap-1">
        <button
          onClick={() => setActiveTab('layout')}
          className={activeTab === 'layout' ? TAB_BTN_ACTIVE : TAB_BTN_INACTIVE}
          aria-selected={activeTab === 'layout'}
        >
          <LayoutGrid className="w-3 h-3" />
          <span>布局模式</span>
        </button>
        <button
          onClick={() => setActiveTab('physics')}
          className={activeTab === 'physics' ? TAB_BTN_ACTIVE : TAB_BTN_INACTIVE}
          aria-selected={activeTab === 'physics'}
        >
          <PhysicsZap className="w-3 h-3" />
          <span>力场动力</span>
        </button>
        <button
          onClick={() => setActiveTab('visuals')}
          className={activeTab === 'visuals' ? TAB_BTN_ACTIVE : TAB_BTN_INACTIVE}
          aria-selected={activeTab === 'visuals'}
        >
          <Tag className="w-3 h-3" />
          <span>视觉过滤</span>
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={activeTab === 'analytics' ? TAB_BTN_ACTIVE : TAB_BTN_INACTIVE}
          aria-selected={activeTab === 'analytics'}
        >
          <Activity className="w-3 h-3" />
          <span>拓扑诊断</span>
        </button>
      </div>

      {/* 快捷键弹窗抽屉 */}
      {showShortcutsModal && (
        <div className="shrink-0 p-3 bg-monokai-bg/95 border-b border-monokai-border/60 text-[10.5px] space-y-1.5 animate-fadeIn">
          <div className="flex items-center justify-between text-monokai-cyan font-semibold">
            <span className="flex items-center gap-1"><Keyboard className="w-3.5 h-3.5" /> 快捷键全览</span>
            <button onClick={() => setShowShortcutsModal(false)} className="text-monokai-comment hover:text-monokai-fg">✕</button>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1 text-monokai-fg-muted">
            <div className="flex justify-between"><span>适应全图</span><kbd className="px-1 py-0.5 rounded bg-monokai-surface border border-monokai-border font-mono text-[9px]">0</kbd></div>
            <div className="flex justify-between"><span>重置布局</span><kbd className="px-1 py-0.5 rounded bg-monokai-surface border border-monokai-border font-mono text-[9px]">R</kbd></div>
            <div className="flex justify-between"><span>放大视角</span><kbd className="px-1 py-0.5 rounded bg-monokai-surface border border-monokai-border font-mono text-[9px]">+</kbd></div>
            <div className="flex justify-between"><span>缩小视角</span><kbd className="px-1 py-0.5 rounded bg-monokai-surface border border-monokai-border font-mono text-[9px]">-</kbd></div>
            <div className="flex justify-between"><span>聚焦选中</span><kbd className="px-1 py-0.5 rounded bg-monokai-surface border border-monokai-border font-mono text-[9px]">F</kbd></div>
            <div className="flex justify-between"><span>按住框选</span><kbd className="px-1 py-0.5 rounded bg-monokai-surface border border-monokai-border font-mono text-[9px]">Shift</kbd></div>
            <div className="flex justify-between"><span>撤销布局</span><kbd className="px-1 py-0.5 rounded bg-monokai-surface border border-monokai-border font-mono text-[9px]">Ctrl+Z</kbd></div>
            <div className="flex justify-between"><span>重做布局</span><kbd className="px-1 py-0.5 rounded bg-monokai-surface border border-monokai-border font-mono text-[9px]">Ctrl+Y</kbd></div>
          </div>
        </div>
      )}

      {/* ═══ 3. 中间可滚动 Tab 内容区 ═══ */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-2.5 custom-scrollbar min-h-0 text-[12px]">

        {/* ────────────────────────────────────────────────────────────
            TAB 1: 布局模式 (Layout Modes)
        ──────────────────────────────────────────────────────────── */}
        {activeTab === 'layout' && (
          <div className="space-y-2.5">
            {/* 独立布局搜索框 */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-monokai-comment" />
              <input
                type="text"
                value={layoutSearchQuery}
                onChange={e => setLayoutSearchQuery(e.target.value)}
                placeholder="搜索 12 种布局特性、场景标签..."
                className="w-full pl-8 pr-7 py-1.5 text-[11px] bg-monokai-bg/70 border border-monokai-border/60 rounded-lg text-monokai-fg placeholder-monokai-comment/60 focus:outline-none focus:border-monokai-cyan/50 focus:bg-monokai-bg"
                role="searchbox"
              />
              {layoutSearchQuery && (
                <button
                  onClick={() => setLayoutSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-monokai-comment hover:text-monokai-fg p-0.5"
                  aria-label="清空布局搜索"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* 智能推荐 Banner */}
            {recommendedLayout && !recommendDismissed && layoutMode !== recommendedLayout.mode && (
              <div className="p-2.5 rounded-lg bg-monokai-accent/10 border border-monokai-accent/30 flex items-start gap-2 relative">
                <Lightbulb className="w-4 h-4 text-monokai-accent shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10.5px] font-bold text-monokai-accent">智能算法推荐</span>
                    <span className="text-[8px] px-1 py-px rounded bg-monokai-accent/20 text-monokai-accent font-medium">
                      基于规模与密度
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold text-monokai-fg mt-0.5">
                    {recommendedLayout.label}
                  </div>
                  <p className="text-[9.5px] text-monokai-comment mt-0.5 leading-snug">
                    {recommendedLayout.recommendedReason}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => changeLayoutMode(recommendedLayout.mode)}
                      className="px-2 py-1 rounded bg-monokai-accent text-[#1b1c18] font-bold text-[10px] hover:brightness-110 transition-all flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      切换推荐布局
                    </button>
                    <button
                      onClick={() => setRecommendDismissed(true)}
                      className="text-[9.5px] text-monokai-comment hover:text-monokai-fg transition-colors"
                    >
                      忽略
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setRecommendDismissed(true)}
                  className="text-monokai-comment/50 hover:text-monokai-comment p-1"
                  aria-label="关闭推荐"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* 分类过滤药丸组 */}
            <div className="flex flex-wrap gap-1">
              {(['hierarchical', 'network', 'radial', 'grid'] as LayoutCategory[]).map(cat => {
                const meta = CATEGORY_METADATA[cat];
                const isActive = activeCategoryFilter.has(cat);
                const count = LAYOUT_REGISTRY.filter(l => l.category === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => {
                      setActiveCategoryFilter(prev => {
                        const next = new Set(prev);
                        if (next.has(cat)) { if (next.size > 1) next.delete(cat); }
                        else next.add(cat);
                        return next;
                      });
                    }}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                      isActive
                        ? 'border shadow-sm'
                        : 'bg-monokai-bg/30 text-monokai-comment border-monokai-border/30 hover:border-monokai-border/60'
                    }`}
                    style={isActive ? {
                      backgroundColor: `${meta.color}18`,
                      borderColor: `${meta.color}60`,
                      color: meta.color,
                    } : undefined}
                  >
                    <span>{meta.icon}</span>
                    <span>{meta.label}</span>
                    <span className="text-[9px] opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>

            {/* 收藏布局置顶条 */}
            {favoriteLayouts.size > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-monokai-comment overflow-x-auto pb-0.5">
                <Star className="w-3 h-3 text-monokai-yellow shrink-0 fill-current" />
                <span className="shrink-0 text-monokai-comment/70">快速收藏:</span>
                <div className="flex items-center gap-1 flex-1 overflow-x-auto">
                  {[...favoriteLayouts].map(mode => {
                    const meta = LAYOUT_REGISTRY.find(l => l.mode === mode);
                    if (!meta) return null;
                    const isCur = meta.mode === layoutMode;
                    return (
                      <button
                        key={mode}
                        onClick={() => changeLayoutMode(mode)}
                        className={`shrink-0 px-2 py-0.5 rounded text-[9.5px] font-medium border transition-colors ${
                          isCur
                            ? 'bg-monokai-yellow/20 text-monokai-yellow border-monokai-yellow/50'
                            : 'bg-monokai-bg/40 text-monokai-fg-muted border-monokai-border/50 hover:text-monokai-fg'
                        }`}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 布局流向控制（针对 TopologicalFlow 与树形结构） */}
            {onLayoutDirectionChange && (layoutMode === 'topologicalFlow' || layoutMode.includes('Tree')) && (
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-monokai-bg/40 border border-monokai-border/40 text-[10.5px]">
                <span className="text-monokai-comment flex items-center gap-1">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-monokai-cyan" />
                  层级流动主方向
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onLayoutDirectionChange('LR')}
                    className={`px-2 py-0.5 rounded font-mono text-[9.5px] border transition-colors ${
                      layoutDirection === 'LR'
                        ? 'bg-monokai-cyan/20 text-monokai-cyan border-monokai-cyan/50 font-bold'
                        : 'bg-monokai-bg/50 text-monokai-comment border-transparent'
                    }`}
                  >
                    从左至右 (LR)
                  </button>
                  <button
                    onClick={() => onLayoutDirectionChange('TB')}
                    className={`px-2 py-0.5 rounded font-mono text-[9.5px] border transition-colors ${
                      layoutDirection === 'TB'
                        ? 'bg-monokai-cyan/20 text-monokai-cyan border-monokai-cyan/50 font-bold'
                        : 'bg-monokai-bg/50 text-monokai-comment border-transparent'
                    }`}
                  >
                    从上至下 (TB)
                  </button>
                </div>
              </div>
            )}

            {/* 布局卡片列表 */}
            <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-0.5 custom-scrollbar">
              {filteredLayouts.map(meta => (
                <LayoutCard
                  key={meta.mode}
                  meta={meta}
                  isActive={meta.mode === layoutMode}
                  onSelect={() => changeLayoutMode(meta.mode)}
                  isFavorite={favoriteLayouts.has(meta.mode)}
                  onToggleFavorite={() => toggleFavorite(meta.mode)}
                />
              ))}
              {filteredLayouts.length === 0 && (
                <div className="py-6 text-center text-[11px] text-monokai-comment">
                  未检索到匹配的布局算法
                </div>
              )}
            </div>

            {/* 快照保存区 */}
            <div className="pt-2 border-t border-monokai-border/40 flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-1 text-monokai-comment">
                <Copy className="w-3 h-3 text-monokai-cyan" />
                <span>布局快照对照</span>
                {snapshots.length > 0 && <span className="text-[9px]">({snapshots.length})</span>}
              </div>
              <button
                onClick={captureSnapshot}
                className="px-2 py-1 rounded bg-monokai-bg/60 border border-monokai-border/60 hover:bg-monokai-elevated text-monokai-fg-muted hover:text-monokai-fg text-[9.5px] flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> 保存当前快照
              </button>
            </div>
            {snapshots.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {snapshots.map(s => (
                  <button
                    key={s.id}
                    onClick={() => {
                      changeLayoutMode(s.mode);
                      if (onApplySnapshot) onApplySnapshot(s);
                    }}
                    className="px-2 py-0.5 rounded bg-monokai-bg/40 border border-monokai-border/50 hover:border-monokai-cyan/50 text-[9px] text-monokai-comment hover:text-monokai-cyan truncate max-w-[150px]"
                    title={`时间: ${new Date(s.timestamp).toLocaleTimeString()}`}
                  >
                    {s.label} · {new Date(s.timestamp).toLocaleTimeString()}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────
            TAB 2: 力场动力 (Physics & Dynamics)
        ──────────────────────────────────────────────────────────── */}
        {activeTab === 'physics' && (
          <div className="space-y-3">
            {/* 力场状态感知提示 */}
            <div className={`p-2.5 rounded-lg border text-[10.5px] leading-snug flex items-start gap-2 ${
              currentLayoutMeta.isForceDriven
                ? 'bg-monokai-cyan/8 border-monokai-cyan/30 text-monokai-cyan'
                : 'bg-monokai-yellow/8 border-monokai-yellow/30 text-monokai-yellow'
            }`}>
              {currentLayoutMeta.isForceDriven ? (
                <>
                  <PhysicsZap className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">物理仿真活跃中</span>
                    <p className="text-[9.5px] text-monokai-comment mt-0.5">
                      当前算法「{currentLayoutMeta.label}」受物理力场驱动，微调参数将实时改变节点间距与聚合边界。
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">几何规整约束模式</span>
                    <p className="text-[9.5px] text-monokai-comment mt-0.5">
                      「{currentLayoutMeta.label}」采用精确几何数学排布（非力导向），力场参数主要用于拖动避障弹性。
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* 5 大场景内置预设 */}
            <div className={GROUP_CARD}>
              <div className="flex items-center justify-between">
                <span className={SECTION_LABEL}><Focus className="w-3 h-3 text-monokai-cyan" /> 场景调优预设</span>
                <button
                  onClick={() => setShowCustomPresetInput(!showCustomPresetInput)}
                  className="text-[9.5px] text-monokai-accent hover:underline flex items-center gap-0.5"
                >
                  <SaveIcon className="w-3 h-3" /> 保存当前力场
                </button>
              </div>

              {/* 内置预设选择按钮组 */}
              <div className="grid grid-cols-5 gap-1">
                {PHYSICS_PRESETS.map(p => {
                  const isAct = activePhysicsPreset === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setActivePhysicsPreset(p.id);
                        applyPhysicsPreset(p);
                      }}
                      className={`flex flex-col items-center gap-1 p-1.5 rounded-md border text-center transition-all ${
                        isAct
                          ? 'bg-monokai-cyan/15 border-monokai-cyan/50 text-monokai-cyan font-bold shadow-sm'
                          : 'bg-monokai-bg/40 border-monokai-border/40 text-monokai-comment hover:text-monokai-fg hover:bg-monokai-bg'
                      }`}
                      title={`${p.description}\n场景: ${p.hint}`}
                    >
                      <span className="shrink-0">{p.icon}</span>
                      <span className="text-[9px]">{p.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* 保存自定义预设小弹框 */}
              {showCustomPresetInput && (
                <div className="p-2 rounded bg-monokai-bg border border-monokai-border/60 flex items-center gap-1.5 mt-1 animate-fadeIn">
                  <input
                    type="text"
                    value={customPresetName}
                    onChange={e => setCustomPresetName(e.target.value)}
                    placeholder="输入预设名称..."
                    className="flex-1 px-2 py-1 text-[10px] bg-monokai-surface rounded border border-monokai-border/60 text-monokai-fg focus:outline-none focus:border-monokai-cyan/50"
                  />
                  <button
                    onClick={handleSaveCustomPreset}
                    className="px-2 py-1 rounded bg-monokai-accent text-[#1b1c18] font-bold text-[10px]"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => setShowCustomPresetInput(false)}
                    className="text-monokai-comment hover:text-monokai-fg p-1"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* 自定义预设列表 */}
              {customPresets.length > 0 && (
                <div className="pt-2 border-t border-monokai-border/40 space-y-1">
                  <span className="text-[9px] text-monokai-comment">我的自定义预设:</span>
                  <div className="flex flex-wrap gap-1">
                    {customPresets.map(cp => (
                      <div
                        key={cp.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-monokai-surface border border-monokai-border/50 text-[9.5px]"
                      >
                        <button
                          onClick={() => applyPhysicsPreset(cp)}
                          className="hover:text-monokai-cyan text-monokai-fg-muted font-medium"
                        >
                          {cp.name}
                        </button>
                        <button
                          onClick={() => handleDeleteCustomPreset(cp.id)}
                          className="text-monokai-comment/50 hover:text-monokai-pink ml-1"
                          title="删除预设"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 6 大核心物理力学滑块 */}
            <div className={GROUP_CARD}>
              <span className={SECTION_LABEL}><Sliders className="w-3 h-3 text-monokai-cyan" /> 动力学微调 (可方向键步进)</span>
              <div className="space-y-2 pt-1">
                <ParameterSlider
                  label="排斥力"
                  value={chargeStrength}
                  min={-400}
                  max={-20}
                  step={5}
                  color="#ff6188"
                  onChange={onChargeStrengthChange}
                />
                <ParameterSlider
                  label="连线距离"
                  value={linkDistance}
                  min={30}
                  max={400}
                  step={5}
                  unit="px"
                  color="#66d9ef"
                  onChange={onLinkDistanceChange}
                />
                <ParameterSlider
                  label="碰撞半径"
                  value={collisionRadius}
                  min={4}
                  max={40}
                  step={1}
                  unit="px"
                  color="#a6e22e"
                  onChange={onCollisionRadiusChange}
                />
                <ParameterSlider
                  label="速度衰减"
                  value={Math.round(velocityDecay * 100)}
                  min={5}
                  max={85}
                  step={1}
                  unit="%"
                  color="#ffd166"
                  onChange={v => onVelocityDecayChange(v / 100)}
                />
                <ParameterSlider
                  label="中心引力"
                  value={Math.round(gravityStrength * 100)}
                  min={0}
                  max={50}
                  step={1}
                  unit="%"
                  color="#fd971f"
                  onChange={v => onGravityStrengthChange(v / 100)}
                />
                <ParameterSlider
                  label="弹性刚度"
                  value={Math.round(linkStrength * 100)}
                  min={5}
                  max={100}
                  step={5}
                  unit="%"
                  color="#ae81ff"
                  onChange={v => onLinkStrengthChange(v / 100)}
                />
              </div>

              <div className="pt-2 border-t border-monokai-border/40 flex justify-end">
                <button
                  onClick={() => {
                    const def = PHYSICS_PRESETS[0];
                    applyPhysicsPreset(def);
                    setActivePhysicsPreset('auto');
                  }}
                  className="px-2 py-1 rounded text-[10px] text-monokai-comment hover:text-monokai-fg bg-monokai-bg/40 hover:bg-monokai-elevated border border-monokai-border/40 flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" /> 重置为智能默认
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────
            TAB 3: 视觉与过滤 (Visuals & Filters)
        ──────────────────────────────────────────────────────────── */}
        {activeTab === 'visuals' && (
          <div className="space-y-2.5">
            {/* 实体类型双向联动过滤 */}
            <div className={GROUP_CARD}>
              <div className="flex items-center justify-between">
                <span className={SECTION_LABEL}><Filter className="w-3 h-3 text-monokai-cyan" /> 实体类型过滤</span>
                <span className="text-[9px] text-monokai-comment">双向联动画布显示</span>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { key: 'typeHub' as NodeTypeFilter, label: '类型集', icon: <HexagonIcon className="w-3 h-3" />, color: '#c77dff', count: nodeCountByType.typeHub },
                  { key: 'instance' as NodeTypeFilter, label: '实体实例', icon: <Box className="w-3 h-3" />, color: '#66d9ef', count: nodeCountByType.instance },
                  { key: 'action' as NodeTypeFilter, label: '行动任务', icon: <Zap className="w-3 h-3" />, color: '#4ade80', count: nodeCountByType.action },
                ].map(({ key, label, icon, color, count }) => {
                  const isChecked = nodeTypeFilters.has(key);
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        if (!onNodeTypeFiltersChange) return;
                        const next = new Set(nodeTypeFilters);
                        if (next.has(key)) {
                          if (next.size > 1) next.delete(key);
                        } else {
                          next.add(key);
                        }
                        onNodeTypeFiltersChange(next);
                      }}
                      className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-center transition-all ${
                        isChecked
                          ? 'border-opacity-60 shadow-sm'
                          : 'bg-monokai-bg/30 border-monokai-border/40 text-monokai-comment opacity-50 hover:opacity-80'
                      }`}
                      style={isChecked ? {
                        backgroundColor: `${color}18`,
                        borderColor: color,
                        color: color,
                      } : undefined}
                    >
                      <div className="flex items-center gap-1 text-[11px] font-semibold">
                        <span>{icon}</span>
                        <span>{label}</span>
                      </div>
                      <span className="font-mono text-[10px] opacity-80">{count} 个</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 关系强度阈值过滤 */}
            {onWeightThresholdChange && (
              <div className={GROUP_CARD}>
                <div className="flex items-center justify-between">
                  <span className={SECTION_LABEL}><Target className="w-3 h-3 text-monokai-yellow" /> 关系权重阈值</span>
                  <span className="font-mono text-monokai-yellow text-[10px] font-bold">
                    {weightThreshold === 0 ? '全量展示' : `≥ ${weightThreshold.toFixed(2)}`}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.95"
                  step="0.05"
                  value={weightThreshold}
                  onChange={e => onWeightThresholdChange(Number(e.target.value))}
                  aria-label="关系强度过滤阈值"
                  className="w-full h-1.5 cursor-pointer accent-monokai-yellow bg-monokai-bg rounded-full"
                />
                <div className="grid grid-cols-3 gap-1 pt-1">
                  {[
                    { v: 0, label: '全量关系' },
                    { v: 0.5, label: '核心关联 (≥0.5)' },
                    { v: 0.75, label: '强关系 (≥0.75)' },
                  ].map(item => (
                    <button
                      key={item.v}
                      onClick={() => onWeightThresholdChange(item.v)}
                      className={`py-1 rounded text-[9.5px] font-medium border transition-colors ${
                        weightThreshold === item.v
                          ? 'bg-monokai-yellow/20 text-monokai-yellow border-monokai-yellow/50 font-bold'
                          : 'bg-monokai-bg/40 text-monokai-comment border-monokai-border/40 hover:text-monokai-fg'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 连线渲染与动效控制 (MECE 连线视觉系统) */}
            <div className={GROUP_CARD}>
              <div className="flex items-center justify-between">
                <span className={SECTION_LABEL}><GitFork className="w-3 h-3 text-monokai-purple" /> 连线渲染与流向</span>
                <span className="text-[9px] text-monokai-comment">层级衍生 · 业务流向</span>
              </div>

              <div className="space-y-2">
                {/* 1. L0-L1 根节点衍生连线开关 */}
                <div className="flex items-center justify-between p-2 rounded-lg border border-monokai-border/40 bg-monokai-bg/30">
                  <div className="flex items-center gap-1.5">
                    <HexagonIcon className="w-3.5 h-3.5 text-monokai-purple" />
                    <div className="flex flex-col">
                      <span className="text-[11px] font-semibold text-monokai-fg">展示层级归属连线</span>
                      <span className="text-[9px] text-monokai-comment">TypeHub 根节点到实例的具象衍生线</span>
                    </div>
                  </div>
                  <button
                    onClick={() => onShowHierarchyLinksChange?.(!showHierarchyLinks)}
                    aria-pressed={showHierarchyLinks}
                    aria-label="切换层级归属连线"
                    className={`px-2 py-0.5 rounded text-[9.5px] font-mono font-bold border transition-colors ${
                      showHierarchyLinks
                        ? 'bg-monokai-purple/20 text-monokai-purple border-monokai-purple/50'
                        : 'bg-monokai-bg text-monokai-comment border-monokai-border/40 hover:text-monokai-fg'
                    }`}
                  >
                    {showHierarchyLinks ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* 2. 业务流向动态粒子开关 */}
                <div className="flex items-center justify-between p-2 rounded-lg border border-monokai-border/40 bg-monokai-bg/30">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-monokai-yellow" />
                    <div className="flex flex-col">
                      <span className="text-[11px] font-semibold text-monokai-fg">业务流向动态粒子</span>
                      <span className="text-[9px] text-monokai-comment">高亮与依赖调用方向流光动画</span>
                    </div>
                  </div>
                  <button
                    onClick={() => onEnableLinkParticlesChange?.(!enableLinkParticles)}
                    aria-pressed={enableLinkParticles}
                    aria-label="切换业务流向动态粒子"
                    className={`px-2 py-0.5 rounded text-[9.5px] font-mono font-bold border transition-colors ${
                      enableLinkParticles
                        ? 'bg-monokai-yellow/20 text-monokai-yellow border-monokai-yellow/50'
                        : 'bg-monokai-bg text-monokai-comment border-monokai-border/40 hover:text-monokai-fg'
                    }`}
                  >
                    {enableLinkParticles ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* 3. 连线曲率避障形态 */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-monokai-comment font-medium">连线几何形态</span>
                    <span className="text-[9px] text-monokai-cyan font-mono">{edgeRoutingMode === 'spline' ? '自适应避障' : '经典直连'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => onEdgeRoutingModeChange?.('spline')}
                      className={`py-1.5 px-2 rounded-md text-[10px] font-medium border text-center transition-all ${
                        edgeRoutingMode === 'spline'
                          ? 'bg-monokai-cyan/20 text-monokai-cyan border-monokai-cyan/50 font-bold'
                          : 'bg-monokai-bg/40 text-monokai-comment border-monokai-border/40 hover:text-monokai-fg'
                      }`}
                    >
                      平滑避障曲线 (Spline)
                    </button>
                    <button
                      onClick={() => onEdgeRoutingModeChange?.('straight')}
                      className={`py-1.5 px-2 rounded-md text-[10px] font-medium border text-center transition-all ${
                        edgeRoutingMode === 'straight'
                          ? 'bg-monokai-cyan/20 text-monokai-cyan border-monokai-cyan/50 font-bold'
                          : 'bg-monokai-bg/40 text-monokai-comment border-monokai-border/40 hover:text-monokai-fg'
                      }`}
                    >
                      经典直连线 (Straight)
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 标签展示策略 */}
            {onLabelModeChange && (
              <div className={GROUP_CARD}>
                <span className={SECTION_LABEL}><Tag className="w-3 h-3 text-monokai-cyan" /> 文本标签展示策略</span>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { key: 'auto' as LabelDisplayMode, label: '智能LOD', hint: '随画布缩放自适应' },
                    { key: 'all' as LabelDisplayMode, label: '全部显示', hint: '始终显示所有标签' },
                    { key: 'top' as LabelDisplayMode, label: '核心枢纽', hint: '仅显示高连接度节点' },
                    { key: 'hover' as LabelDisplayMode, label: '悬停显现', hint: '仅鼠标悬停或选中显现' },
                  ].map(item => (
                    <button
                      key={item.key}
                      onClick={() => onLabelModeChange(item.key)}
                      title={item.hint}
                      className={`py-1.5 px-1 rounded-md text-[10px] font-medium border text-center transition-all ${
                        labelMode === item.key
                          ? 'bg-monokai-cyan/20 text-monokai-cyan border-monokai-cyan/50 font-bold'
                          : 'bg-monokai-bg/40 text-monokai-comment border-monokai-border/40 hover:text-monokai-fg'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 交互模式开关 */}
            <div className={GROUP_CARD}>
              <span className={SECTION_LABEL}><Target className="w-3 h-3 text-monokai-cyan" /> 交互行为模式</span>
              <div className="space-y-1.5">
                <button
                  onClick={() => onClickToFocusChange(!clickToFocus)}
                  className={clickToFocus ? BTN_TOGGLE_ACTIVE : BTN_TOGGLE_INACTIVE}
                  aria-pressed={clickToFocus}
                  aria-label="点击聚焦模式"
                >
                  <span className="flex items-center gap-1.5"><Focus className="w-3.5 h-3.5" /> 点击聚焦邻域 (Focus Mode)</span>
                  <span className={`text-[9px] px-1.5 py-px rounded font-mono font-bold ${clickToFocus ? 'bg-monokai-cyan/20 text-monokai-cyan' : 'bg-monokai-bg text-monokai-comment'}`}>
                    {clickToFocus ? 'ON' : 'OFF'}
                  </span>
                </button>

                <button
                  onClick={() => onIsFixedDragChange(!isFixedDrag)}
                  className={isFixedDrag ? BTN_TOGGLE_ACTIVE : BTN_TOGGLE_INACTIVE}
                  aria-pressed={isFixedDrag}
                  aria-label="固定拖拽模式"
                >
                  <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> 固定拖拽位置 (Pin on Drag)</span>
                  <span className={`text-[9px] px-1.5 py-px rounded font-mono font-bold ${isFixedDrag ? 'bg-monokai-cyan/20 text-monokai-cyan' : 'bg-monokai-bg text-monokai-comment'}`}>
                    {isFixedDrag ? 'ON' : 'OFF'}
                  </span>
                </button>

                <button
                  onClick={() => onIsLassoModeChange(!isLassoMode)}
                  className={isLassoMode ? BTN_TOGGLE_ACTIVE : BTN_TOGGLE_INACTIVE}
                  aria-pressed={isLassoMode}
                  aria-label="框选模式"
                >
                  <span className="flex items-center gap-1.5"><Lasso className="w-3.5 h-3.5" /> 矩形多选框选 (Lasso Selection)</span>
                  <span className={`text-[9px] px-1.5 py-px rounded font-mono font-bold ${isLassoMode ? 'bg-monokai-cyan/20 text-monokai-cyan' : 'bg-monokai-bg text-monokai-comment'}`}>
                    {isLassoMode ? 'ON' : 'OFF'}
                  </span>
                </button>

                <button
                  onClick={() => onShowPageRankChange(!showPageRank)}
                  className={showPageRank ? BTN_TOGGLE_ACTIVE : BTN_TOGGLE_INACTIVE}
                  aria-pressed={showPageRank}
                  aria-label="PageRank 热力图"
                >
                  <span className="flex items-center gap-1.5"><Flame className="w-3.5 h-3.5" /> PageRank 权重热力图</span>
                  <span className={`text-[9px] px-1.5 py-px rounded font-mono font-bold ${showPageRank ? 'bg-monokai-cyan/20 text-monokai-cyan' : 'bg-monokai-bg text-monokai-comment'}`}>
                    {showPageRank ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────
            TAB 4: 拓扑诊断 (Diagnostics & Metrics)
        ──────────────────────────────────────────────────────────── */}
        {activeTab === 'analytics' && (
          <div className="space-y-2.5">
            {/* 综合健康与质量评分卡 */}
            <div className={`p-3 rounded-lg border ${perfConfig.borderColor} ${perfConfig.bgColor} flex items-center justify-between`}>
              <div>
                <div className="flex items-center gap-1 text-[10px] font-bold text-monokai-comment uppercase">
                  <Gauge className={`w-3.5 h-3.5 ${perfConfig.color}`} />
                  拓扑健康指数
                </div>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className={`text-2xl font-bold font-mono ${perfConfig.color}`}>{qualityScore}</span>
                  <span className="text-[10px] text-monokai-comment">/ 100 分</span>
                </div>
                <div className="text-[10px] text-monokai-fg-muted mt-0.5">
                  综合渲染状态: <span className={`font-semibold ${perfConfig.color}`}>{perfConfig.label}</span>
                </div>
              </div>

              <div className="text-right">
                <button
                  onClick={onShowTopologyReport}
                  className="px-2.5 py-1.5 rounded-md bg-monokai-cyan/15 text-monokai-cyan border border-monokai-cyan/40 hover:bg-monokai-cyan/25 text-[10.5px] font-semibold flex items-center gap-1 transition-colors"
                >
                  <Activity className="w-3.5 h-3.5" />
                  完整体检报告 →
                </button>
              </div>
            </div>

            {/* 实时性能折线与指标 */}
            <div className={GROUP_CARD}>
              <span className={SECTION_LABEL}><Activity className="w-3 h-3 text-monokai-cyan" /> 渲染动力学监控</span>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded bg-monokai-bg/60 border border-monokai-border/40">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] text-monokai-comment">实时帧率 FPS</span>
                    <span className={`text-[9px] font-mono font-bold ${fps >= 50 ? 'text-monokai-accent' : 'text-monokai-yellow'}`}>
                      {fps.toFixed(0)}
                    </span>
                  </div>
                  <PerfMiniChart data={perfHistory} metric="fps" />
                </div>
                <div className="p-2 rounded bg-monokai-bg/60 border border-monokai-border/40">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] text-monokai-comment">单步运算耗时</span>
                    <span className={`text-[9px] font-mono font-bold ${perfConfig.color}`}>
                      {renderTime.toFixed(0)} ms
                    </span>
                  </div>
                  <PerfMiniChart data={perfHistory} metric="renderTime" />
                </div>
              </div>

              {/* 规模概况 */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-monokai-border/30 text-[10.5px]">
                <div className="flex items-center justify-between p-1.5 rounded bg-monokai-bg/40">
                  <span className="text-monokai-comment">节点总数</span>
                  <span className="font-mono font-bold text-monokai-cyan">{nodeCount}</span>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded bg-monokai-bg/40">
                  <span className="text-monokai-comment">连线总数</span>
                  <span className="font-mono font-bold text-monokai-yellow">{linkCount}</span>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded bg-monokai-bg/40">
                  <span className="text-monokai-comment">网络密度</span>
                  <span className="font-mono font-bold text-monokai-accent">{graphSummary.density.toFixed(3)}</span>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded bg-monokai-bg/40">
                  <span className="text-monokai-comment">结构特征</span>
                  <span className="font-mono font-bold text-monokai-fg-muted truncate">{graphSummary.features.join(' · ') || '标准'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ═══ 4. 底部固定全局操作栏 (Global Actions) ═══ */}
      <div className="shrink-0 p-2.5 bg-monokai-bg/70 border-t border-monokai-border/60 space-y-2">
        {/* 渲染模式切换 + 基础视图控制四联按钮 */}
        <div className="space-y-1.5">
          {/* 渲染模式切换器 (MECE 三选一) */}
          {onRenderEngineModeChange && (
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-monokai-comment shrink-0">渲染:</span>
              <div className="flex-1 grid grid-cols-3 gap-0.5">
                {(['svg', 'canvas', 'webgl'] as RenderEngineMode[]).map((mode) => {
                  const meta = RENDER_ENGINE_META[mode];
                  const isActive = renderEngineMode === mode;
                  return (
                    <button
                      key={mode}
                      onClick={() => onRenderEngineModeChange(mode)}
                      title={`${meta.label}: ${meta.description} (${meta.hint})`}
                      className={`relative px-1.5 py-1 rounded text-[9.5px] font-medium border transition-all flex items-center justify-center gap-1 ${
                        isActive
                          ? 'border-current shadow-sm'
                          : 'border-transparent text-monokai-comment hover:text-monokai-fg'
                      }`}
                      style={isActive ? {
                        backgroundColor: meta.bgColor,
                        borderColor: meta.borderColor,
                        color: meta.color,
                      } : undefined}
                    >
                      <span style={{ color: isActive ? meta.color : undefined }}>{meta.icon}</span>
                      <span className="shrink-0">{meta.shortLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* 视图控制五联按钮 */}
          <div className="grid grid-cols-5 gap-1">
            <button
              onClick={onFitAll}
              title="适应全图视角 (0)"
              className={BTN_PRIMARY + ' !py-1 text-[10px]'}
            >
              <Maximize2 className="w-3 h-3" /> 适应
            </button>
            <button
              onClick={onResetLayout}
              title="重置物理状态 (R)"
              className={BTN_SECONDARY + ' !py-1 text-[10px]'}
            >
              <RotateCcw className="w-3 h-3" /> 重置
            </button>
            <button
              onClick={onZoomIn}
              title="放大视角 (+)"
              className={BTN_SECONDARY + ' !py-1 text-[10px]'}
            >
              <ZoomIn className="w-3 h-3" /> 放大
            </button>
            <button
              onClick={onZoomOut}
              title="缩小视角 (-)"
              className={BTN_SECONDARY + ' !py-1 text-[10px]'}
            >
              <ZoomOut className="w-3 h-3" /> 缩小
            </button>
            <button
              onClick={onRefresh}
              title="刷新图谱数据"
              className={BTN_SECONDARY + ' !py-1 text-[10px]'}
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} /> 刷新
            </button>
          </div>
        </div>

        {/* 综合导出与扩展操作 */}
        <div className="grid grid-cols-4 gap-1 pt-1 border-t border-monokai-border/30">
          {onExportPNG && (
            <button
              onClick={onExportPNG}
              className={BTN_SECONDARY + ' !py-1 text-[9.5px]'}
              title="导出当前高保真 PNG 图片"
            >
              <ImageIcon className="w-3 h-3" /> PNG
            </button>
          )}
          {onExportSVG && (
            <button
              onClick={onExportSVG}
              className={BTN_SECONDARY + ' !py-1 text-[9.5px]'}
              title="导出矢量 SVG 原始图形"
            >
              <Code2 className="w-3 h-3" /> SVG
            </button>
          )}
          {onExportCSV && (
            <button
              onClick={onExportCSV}
              className={BTN_SECONDARY + ' !py-1 text-[9.5px]'}
              title="导出 CSV 关系数据表格"
            >
              <FileText className="w-3 h-3" /> CSV
            </button>
          )}
          {onExportExcel && (
            <button
              onClick={onExportExcel}
              className={BTN_SECONDARY + ' !py-1 text-[9.5px]'}
              title="导出格式化 Excel 报表"
            >
              <Table2 className="w-3 h-3" /> Excel
            </button>
          )}
        </div>

        {/* AI 生成与一键清空安全栏 */}
        {(onAIFill || onClear) && (
          <div className="flex items-center gap-1.5 pt-1">
            {onAIFill && (
              <button
                onClick={onAIFill}
                disabled={isLoading}
                className={BTN_AI + ' flex-1 !py-1 text-[10.5px] font-semibold'}
              >
                <Sparkles className="w-3.5 h-3.5 text-monokai-accent" />
                {isLoading ? '构思中...' : 'AI 图谱构思'}
              </button>
            )}
            {onClear && (
              <button
                onClick={onClear}
                className={BTN_DANGER + ' shrink-0 !py-1 px-2.5 text-[10px]'}
                title="清空本体图谱"
              >
                <Trash2 className="w-3 h-3 text-monokai-pink" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

TopologyLayoutPanel.displayName = 'TopologyLayoutPanel';

export default TopologyLayoutPanel;
