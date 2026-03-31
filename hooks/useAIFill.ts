/**
 * useAIFill — Ontology 模块 AI 一键填充 + 快速清除 Hook
 *
 * 为 OntologyView 及其子组件提供：
 * - 层感知 AI 填充（自动匹配当前 MECE 层）
 * - 填充结果状态管理
 * - 快速清除（局部 + 全局）
 * - 二次优化入口
 */

import { useState, useCallback, useRef } from 'react';
import { ontologyAiService } from '../services/ontologyAiService';
import { MECELayer } from './useOntologyStore';

// ============================================================
// Types
// ============================================================

export type AIFillMode =
  | 'foundation'
  | 'relations'
  | 'methodology'
  | 'patterns'
  | 'domains'
  | 'graph'
  | 'canvas'
  | 'crud'
  | 'introspection'
  | 'suggestions';

export interface AIFillState {
  isLoading: boolean;
  error: string | null;
  result: any | null;
  mode: AIFillMode;
  input: string;
  secondaryInput?: string; // 用于 relations 层：target object
  secondaryInput2?: string; // 用于 relations 层：context
}

export interface AIFillConfig {
  mode: AIFillMode;
  layer?: MECELayer;
  placeholder?: string;
  secondaryPlaceholder?: string;
  onAccept?: (result: any) => void;
  onInjectSQL?: (sql: string) => void;
}

// Quick clear presets per mode
export const MODE_CLEAR_DEFAULTS: Record<AIFillMode, Partial<AIFillState>> = {
  foundation:    { input: '', result: null },
  relations:     { input: '', secondaryInput: '', secondaryInput2: '', result: null },
  methodology:   { input: '', result: null },
  patterns:      { input: '', secondaryInput: '', result: null },
  domains:       { input: '', result: null },
  graph:         { input: '', result: null },
  canvas:        { input: '', result: null },
  crud:          { input: '', result: null },
  introspection: { input: '', result: null },
  suggestions:   { result: null },
};

// ============================================================
// Hook
// ============================================================

export function useAIFill() {
  const [states, setStates] = useState<Record<AIFillMode, AIFillState>>({
    foundation:    { isLoading: false, error: null, result: null, mode: 'foundation', input: '' },
    relations:     { isLoading: false, error: null, result: null, mode: 'relations', input: '', secondaryInput: '', secondaryInput2: '' },
    methodology:   { isLoading: false, error: null, result: null, mode: 'methodology', input: '' },
    patterns:      { isLoading: false, error: null, result: null, mode: 'patterns', input: '' },
    domains:       { isLoading: false, error: null, result: null, mode: 'domains', input: '' },
    graph:         { isLoading: false, error: null, result: null, mode: 'graph', input: '' },
    canvas:        { isLoading: false, error: null, result: null, mode: 'canvas', input: '' },
    crud:          { isLoading: false, error: null, result: null, mode: 'crud', input: '' },
    introspection: { isLoading: false, error: null, result: null, mode: 'introspection', input: '' },
    suggestions:   { isLoading: false, error: null, result: null, mode: 'suggestions' },
  });

  const abortRef = useRef<AbortController | null>(null);

  const getState = useCallback((mode: AIFillMode) => states[mode], [states]);

  const setInput = useCallback((mode: AIFillMode, input: string) => {
    setStates(prev => ({
      ...prev,
      [mode]: { ...prev[mode], input, error: null }
    }));
  }, []);

  const setSecondaryInput = useCallback((mode: AIFillMode, value: string, key: 'secondaryInput' | 'secondaryInput2' = 'secondaryInput') => {
    setStates(prev => ({
      ...prev,
      [mode]: { ...prev[mode], [key]: value, error: null }
    }));
  }, []);

  const clearFill = useCallback((mode: AIFillMode) => {
    setStates(prev => ({
      ...prev,
      [mode]: {
        ...prev[mode],
        ...MODE_CLEAR_DEFAULTS[mode],
        error: null,
      }
    }));
  }, []);

  const clearAll = useCallback(() => {
    setStates(prev => {
      const next: Record<AIFillMode, AIFillState> = {} as any;
      (Object.keys(prev) as AIFillMode[]).forEach(key => {
        next[key] = { ...prev[key], ...MODE_CLEAR_DEFAULTS[key], error: null };
      });
      return next;
    });
  }, []);

  const executeFill = useCallback(async (mode: AIFillMode, customInput?: string) => {
    const state = states[mode];
    const topic = customInput ?? state.input;

    if (!topic.trim() && mode !== 'suggestions') {
      setStates(prev => ({
        ...prev,
        [mode]: { ...prev[mode], error: '请输入内容后再进行 AI 填充' }
      }));
      return;
    }

    abortRef.current = new AbortController();
    setStates(prev => ({
      ...prev,
      [mode]: { ...prev[mode], isLoading: true, error: null, result: null }
    }));

    try {
      let result: any;

      switch (mode) {
        case 'foundation':
          result = await ontologyAiService.generateObjectModel(topic);
          break;
        case 'relations':
          result = await ontologyAiService.generateLinkModel(
            topic,
            state.secondaryInput || topic,
            state.secondaryInput2 || ''
          );
          break;
        case 'methodology':
          result = await ontologyAiService.generateMethodologyAdvice(topic);
          break;
        case 'patterns':
          result = await ontologyAiService.generatePatternSQL(topic, state.secondaryInput || '');
          break;
        case 'domains':
          result = await ontologyAiService.generateDomainModel(topic);
          break;
        case 'graph':
          result = await ontologyAiService.generateGraphLayout(topic);
          break;
        case 'canvas':
          result = await ontologyAiService.generateCanvasLayout(topic);
          break;
        case 'crud':
          result = await ontologyAiService.generateCRUDFill(topic, state.secondaryInput || '');
          break;
        case 'introspection':
          result = await ontologyAiService.generateIntrospectionGuidance(topic);
          break;
        case 'suggestions':
          result = await ontologyAiService.generateSuggestions([], [], 0, 0);
          break;
        default:
          throw new Error(`Unknown AI fill mode: ${mode}`);
      }

      setStates(prev => ({
        ...prev,
        [mode]: { ...prev[mode], isLoading: false, result, error: null }
      }));
    } catch (err: any) {
      const message = err?.message || 'AI 填充失败，请稍后重试';
      setStates(prev => ({
        ...prev,
        [mode]: { ...prev[mode], isLoading: false, error: message, result: null }
      }));
    }
  }, [states]);

  const abortFill = useCallback((mode: AIFillMode) => {
    abortRef.current?.abort();
    setStates(prev => ({
      ...prev,
      [mode]: { ...prev[mode], isLoading: false, error: '已取消' }
    }));
  }, []);

  return {
    states,
    getState,
    setInput,
    setSecondaryInput,
    clearFill,
    clearAll,
    executeFill,
    abortFill,
  };
}

// ============================================================
// Mode → Layer mapping
// ============================================================

export function layerToMode(layer: MECELayer): AIFillMode {
  const map: Record<MECELayer, AIFillMode> = {
    foundation:   'foundation',
    relations:    'relations',
    methodology:  'methodology',
    patterns:     'patterns',
    domains:      'domains',
  };
  return map[layer];
}

export const MODE_LABELS: Record<AIFillMode, string> = {
  foundation:    '基础层 · 对象建模',
  relations:     '关系层 · 关系建模',
  methodology:   '方法论层 · 建模方法',
  patterns:      '模式层 · SQL 模式',
  domains:      '领域层 · 领域模型',
  graph:        '图谱视图 · 布局生成',
  canvas:       '画布视图 · 空间布局',
  crud:         'CRUD · 表单预填',
  introspection: '反思引导 · 问题生成',
  suggestions:  '智能推荐 · 图谱补全',
};

export const MODE_DESCRIPTIONS: Record<AIFillMode, string> = {
  foundation:    '输入业务概念，AI 自动生成 object_type + object 实例模型 + 五表 DDL',
  relations:     '选择源/目标对象，AI 生成 link_type + link 实例 + 权重建模方案',
  methodology:   '输入建模场景，AI 推荐建模范式 + 分步实施计划 + 反思问题',
  patterns:      '选择模式类型，AI 生成递归 CTE、时态版本、聚合视图等高级 SQL',
  domains:       '输入领域名称，AI 生成完整概念-关系模型 + 种子数据 + 视图',
  graph:         '输入话题，AI 生成概念图谱节点布局 + 关系边 + 布局算法建议',
  canvas:        '输入场景描述，AI 生成画布空间组织方案（Space/Group/Item）',
  crud:          '描述要创建的实体，AI 预填 CRUD 表单内容',
  introspection: '输入反思主题，AI 生成引导性问题 + 记录模板',
  suggestions:   '基于现有图谱数据，AI 推荐可添加的概念、关系、行动',
};
