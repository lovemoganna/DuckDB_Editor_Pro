/**
 * useLayoutPresets - 布局预设管理 Hook
 * 
 * 功能:
 * - 保存/加载自定义布局预设
 * - 内置预设
 * - localStorage 持久化
 * - 预设分类管理
 * 
 * @example
 * ```tsx
 * const {
 *   presets,
 *   activePresetId,
 *   savePreset,
 *   loadPreset,
 *   deletePreset,
 *   applyPreset,
 * } = useLayoutPresets();
 * ```
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { OntologyLayoutMode } from '../OntologyLayout';

// ============================================================
// Types
// ============================================================

export interface LayoutPreset {
  /** 预设 ID */
  id: string;
  
  /** 预设名称 */
  name: string;
  
  /** 预设描述 */
  description: string;
  
  /** 预设分类 */
  category: 'structure' | 'display' | 'analysis' | 'custom';
  
  /** 布局模式 */
  layoutMode: OntologyLayoutMode;
  
  /** 同层节点间距 */
  nodesep: number;
  
  /** 层级间距 */
  ranksep: number;
  
  /** 并行边间距 */
  parallelOffset: number;
  
  /** 连线风格 */
  edgeRoutingMode: 'straight' | 'orthogonal' | 'bezier';
  
  /** 是否启用网格吸附 */
  snapToGrid: boolean;
  
  /** 网格大小 */
  gridSize: number;
  
  /** 是否为内置预设 */
  builtIn: boolean;
  
  /** 创建时间 */
  createdAt: number;
  
  /** 更新时间 */
  updatedAt: number;
}

// ============================================================
// Constants
// ============================================================

const PRESETS_STORAGE_KEY = 'ontology-canvas-layout-presets';

const CATEGORY_LABELS: Record<LayoutPreset['category'], string> = {
  'structure': '结构化布局',
  'display': '展示型布局',
  'analysis': '分析型布局',
  'custom': '自定义',
};

// 内置预设
const BUILT_IN_PRESETS: LayoutPreset[] = [
  {
    id: 'default-hierarchical',
    name: '标准层级',
    description: '从左到右的层级关系展示，适合业务流程',
    category: 'structure',
    layoutMode: 'hierarchical',
    nodesep: 140,
    ranksep: 280,
    parallelOffset: 35,
    edgeRoutingMode: 'orthogonal',
    snapToGrid: true,
    gridSize: 20,
    builtIn: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'compact-tree',
    name: '紧凑树形',
    description: '从上到下的紧凑树形结构，节省空间',
    category: 'structure',
    layoutMode: 'tree',
    nodesep: 100,
    ranksep: 180,
    parallelOffset: 30,
    edgeRoutingMode: 'straight',
    snapToGrid: true,
    gridSize: 20,
    builtIn: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'analysis-force',
    name: '力导向分析',
    description: '根据关系密度自动聚类，适合探索性分析',
    category: 'analysis',
    layoutMode: 'force',
    nodesep: 160,
    ranksep: 300,
    parallelOffset: 40,
    edgeRoutingMode: 'bezier',
    snapToGrid: false,
    gridSize: 20,
    builtIn: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'radial-explore',
    name: '放射探索',
    description: '以根节点为中心向外扩散，适合层级探索',
    category: 'analysis',
    layoutMode: 'radial',
    nodesep: 150,
    ranksep: 250,
    parallelOffset: 35,
    edgeRoutingMode: 'orthogonal',
    snapToGrid: true,
    gridSize: 20,
    builtIn: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'circular-review',
    name: '环形审视',
    description: '稳定环形布局，适合全面审视关系网络',
    category: 'display',
    layoutMode: 'circular',
    nodesep: 130,
    ranksep: 280,
    parallelOffset: 40,
    edgeRoutingMode: 'bezier',
    snapToGrid: false,
    gridSize: 20,
    builtIn: true,
    createdAt: 0,
    updatedAt: 0,
  },
];

// ============================================================
// Storage Helpers
// ============================================================

function loadPresets(): LayoutPreset[] {
  try {
    const stored = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!stored) return [];
    
    const presets: LayoutPreset[] = JSON.parse(stored);
    return presets.filter((p) => !p.builtIn); // 只加载自定义预设
  } catch {
    return [];
  }
}

function savePresets(presets: LayoutPreset[]): void {
  try {
    const customPresets = presets.filter((p) => !p.builtIn);
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(customPresets));
  } catch (error) {
    console.error('[useLayoutPresets] Failed to save presets:', error);
  }
}

// ============================================================
// Hook
// ============================================================

export interface UseLayoutPresetsReturn {
  /** 所有预设 (包含内置) */
  presets: LayoutPreset[];
  
  /** 当前激活的预设 ID */
  activePresetId: string | null;
  
  /** 按分类分组的预设 */
  presetsByCategory: Record<LayoutPreset['category'], LayoutPreset[]>;
  
  /** 分类标签映射 */
  categoryLabels: typeof CATEGORY_LABELS;
  
  /** 保存当前配置为新预设 */
  savePreset: (name: string, description: string, config: Omit<LayoutPreset, 'id' | 'name' | 'description' | 'category' | 'builtIn' | 'createdAt' | 'updatedAt'>) => LayoutPreset;
  
  /** 更新自定义预设 */
  updatePreset: (id: string, updates: Partial<Pick<LayoutPreset, 'name' | 'description' | 'nodesep' | 'ranksep' | 'parallelOffset' | 'edgeRoutingMode' | 'snapToGrid' | 'gridSize'>>) => void;
  
  /** 删除自定义预设 */
  deletePreset: (id: string) => boolean;
  
  /** 加载预设 */
  loadPreset: (id: string) => LayoutPreset | null;
  
  /** 应用预设 (更新当前配置) */
  applyPreset: (id: string) => LayoutPreset | null;
  
  /** 导出预设为 JSON */
  exportPreset: (id: string) => string | null;
  
  /** 从 JSON 导入预设 */
  importPreset: (json: string) => LayoutPreset | null;
  
  /** 重置为默认预设 */
  resetToDefault: () => void;
  
  /** 设置激活的预设 */
  setActivePresetId: (id: string | null) => void;
}

export function useLayoutPresets(): UseLayoutPresetsReturn {
  const [presets, setPresets] = useState<LayoutPreset[]>(() => [
    ...BUILT_IN_PRESETS,
    ...loadPresets(),
  ]);
  
  const [activePresetId, setActivePresetId] = useState<string | null>('default-hierarchical');

  // ============================================================
  // 按分类分组
  // ============================================================

  const presetsByCategory = useMemo(() => {
    const grouped: Record<LayoutPreset['category'], LayoutPreset[]> = {
      structure: [],
      display: [],
      analysis: [],
      custom: [],
    };
    
    presets.forEach((preset) => {
      grouped[preset.category].push(preset);
    });
    
    return grouped;
  }, [presets]);

  // ============================================================
  // 保存预设
  // ============================================================

  const savePreset = useCallback((
    name: string,
    description: string,
    config: Omit<LayoutPreset, 'id' | 'name' | 'description' | 'category' | 'builtIn' | 'createdAt' | 'updatedAt'>
  ): LayoutPreset => {
    const newPreset: LayoutPreset = {
      ...config,
      id: `custom-${Date.now()}`,
      name,
      description,
      category: 'custom',
      builtIn: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setPresets((prev) => {
      const updated = [...prev, newPreset];
      savePresets(updated);
      return updated;
    });

    return newPreset;
  }, []);

  // ============================================================
  // 更新预设
  // ============================================================

  const updatePreset = useCallback((
    id: string,
    updates: Partial<Pick<LayoutPreset, 'name' | 'description' | 'nodesep' | 'ranksep' | 'parallelOffset' | 'edgeRoutingMode' | 'snapToGrid' | 'gridSize'>>
  ) => {
    setPresets((prev) => {
      const updated = prev.map((preset) => {
        if (preset.id !== id || preset.builtIn) return preset;
        return {
          ...preset,
          ...updates,
          updatedAt: Date.now(),
        };
      });
      savePresets(updated);
      return updated;
    });
  }, []);

  // ============================================================
  // 删除预设
  // ============================================================

  const deletePreset = useCallback((id: string): boolean => {
    const preset = presets.find((p) => p.id === id);
    if (!preset || preset.builtIn) return false;

    setPresets((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      savePresets(updated);
      return updated;
    });

    if (activePresetId === id) {
      setActivePresetId(null);
    }

    return true;
  }, [presets, activePresetId]);

  // ============================================================
  // 加载/应用预设
  // ============================================================

  const loadPreset = useCallback((id: string): LayoutPreset | null => {
    const preset = presets.find((p) => p.id === id);
    return preset ? { ...preset } : null;
  }, [presets]);

  const applyPreset = useCallback((id: string): LayoutPreset | null => {
    const preset = presets.find((p) => p.id === id);
    if (!preset) return null;
    
    setActivePresetId(id);
    return { ...preset };
  }, [presets]);

  // ============================================================
  // 导入/导出
  // ============================================================

  const exportPreset = useCallback((id: string): string | null => {
    const preset = presets.find((p) => p.id === id);
    if (!preset) return null;
    
    const exportData = {
      ...preset,
      builtIn: false, // 导出时清除内置标记
    };
    
    return JSON.stringify(exportData, null, 2);
  }, [presets]);

  const importPreset = useCallback((json: string): LayoutPreset | null => {
    try {
      const data = JSON.parse(json);
      
      // 验证必要字段
      if (!data.name || !data.layoutMode) {
        throw new Error('Invalid preset format');
      }

      const newPreset: LayoutPreset = {
        ...data,
        id: `custom-${Date.now()}`, // 生成新 ID
        builtIn: false,
        category: 'custom',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      setPresets((prev) => {
        const updated = [...prev, newPreset];
        savePresets(updated);
        return updated;
      });

      return newPreset;
    } catch (error) {
      console.error('[useLayoutPresets] Failed to import preset:', error);
      return null;
    }
  }, []);

  // ============================================================
  // 重置
  // ============================================================

  const resetToDefault = useCallback(() => {
    setPresets([...BUILT_IN_PRESETS, ...loadPresets()]);
    setActivePresetId('default-hierarchical');
  }, []);

  return {
    presets,
    activePresetId,
    presetsByCategory,
    categoryLabels: CATEGORY_LABELS,
    savePreset,
    updatePreset,
    deletePreset,
    loadPreset,
    applyPreset,
    exportPreset,
    importPreset,
    resetToDefault,
    setActivePresetId,
  };
}

export default useLayoutPresets;
