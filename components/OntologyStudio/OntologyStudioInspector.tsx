import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Layers,
  Database,
  Link2,
  Table as TableIcon,
  Play,
  Copy,
  Check,
  Plus,
  Trash2,
  Code2,
  RefreshCw,
  Key,
  HelpCircle,
  Eye,
  BrainCircuit,
  Route,
  Activity,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Compass,
} from 'lucide-react';
import { useOntologyStudioStore } from '../../hooks/useOntologyStudioStore';
import {
  RelationCardinality,
  RelationJoinType,
  MultiHopPath,
} from '../../types/ontologyStudioTypes';

interface OntologyStudioInspectorProps {
  onInsertToEditor?: (sql: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const OntologyStudioInspector: React.FC<OntologyStudioInspectorProps> = ({
  onInsertToEditor,
  isOpen,
  onClose,
}) => {
  const {
    entities,
    relations,
    selectedType,
    selectedId,
    selectElement,
    updateEntity,
    deleteEntity,
    updateRelation,
    deleteRelation,
    physicalTables,
    compileToSql,
    livePreviewData,
    isLoadingPreview,
    previewError,
    fetchLivePreview,
    clearLivePreview,
    findMultiHopPaths,
    setActiveDeductionPath,
    activeDeductionPath,
    deductionRules,
    activeMode,
  } = useOntologyStudioStore();

  const [activeSubTab, setActiveSubTab] = useState<'config' | 'preview' | 'deduction'>('config');
  const [copiedSql, setCopiedSql] = useState(false);
  const [targetEntityId, setTargetEntityId] = useState<string>('');
  const [discoveredPaths, setDiscoveredPaths] = useState<MultiHopPath[]>([]);

  const selectedEntity =
    selectedType === 'entity' ? entities.find((e) => e.id === selectedId) : null;
  const selectedRelation =
    selectedType === 'relation' ? relations.find((r) => r.id === selectedId) : null;

  const sqlPreview = useMemo(() => {
    return compileToSql();
  }, [entities, relations, compileToSql]);

  // Auto-fetch preview when an entity with a mapped table is selected
  useEffect(() => {
    if (selectedEntity?.mappedTable) {
      fetchLivePreview(selectedEntity.mappedTable);
    } else {
      clearLivePreview();
    }
  }, [selectedEntity?.mappedTable, fetchLivePreview, clearLivePreview]);

  // P5: Mode Switcher → Inspector subTab 联动
  // - 'modeling' → 'config' (entity 选中) 或全局 (无选中)
  // - 'deduction' → 'deduction' (聚焦多跳推演)
  // - 'mapping' → 'preview' (聚焦 DuckDB 数据抽样)
  useEffect(() => {
    if (activeMode === 'deduction' && selectedEntity) {
      setActiveSubTab('deduction');
    } else if (activeMode === 'mapping' && selectedEntity) {
      setActiveSubTab('preview');
    } else {
      setActiveSubTab('config');
    }
    // 仅当 activeMode 切换时触发；selectedEntity 变化由其他 effect 处理
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMode]);

  // P6: Inspector 关闭重开时重置 subTab 到合理默认
  const prevIsOpenRef = useRef(isOpen);
  useEffect(() => {
    if (prevIsOpenRef.current && !isOpen) {
      // 关闭时暂存关闭瞬间的状态；不需要主动清理
    } else if (!prevIsOpenRef.current && isOpen) {
      // 重新打开时根据当前选择重置 subTab
      setActiveSubTab('config');
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen]);

  // Reset target entity and discovered paths when entity changes
  useEffect(() => {
    if (selectedEntity) {
      const otherEnt = entities.find((e) => e.id !== selectedEntity.id);
      if (otherEnt) {
        setTargetEntityId(otherEnt.id);
        const initialPaths = findMultiHopPaths(selectedEntity.id, otherEnt.id, 4);
        setDiscoveredPaths(initialPaths);
      } else {
        setTargetEntityId('');
        setDiscoveredPaths([]);
      }
    }
  }, [selectedEntity?.id, entities, findMultiHopPaths]);

  if (!isOpen) return null;

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlPreview);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleRunInEditor = () => {
    if (onInsertToEditor) {
      onInsertToEditor(sqlPreview);
    }
  };

  const handleSearchPaths = (targetId: string) => {
    setTargetEntityId(targetId);
    if (selectedEntity && targetId) {
      const paths = findMultiHopPaths(selectedEntity.id, targetId, 4);
      setDiscoveredPaths(paths);
      if (paths.length > 0) {
        setActiveDeductionPath(paths[0]);
      }
    }
  };

  return (
    <aside className="w-96 shrink-0 border-l border-monokai-border bg-monokai-surface flex flex-col h-full select-none text-monokai-fg-muted">
      {/* 1. INSPECTOR HEADER */}
      <div className="p-3.5 border-b border-monokai-border flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {selectedEntity ? (
            <>
              <span
                className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                style={{ backgroundColor: selectedEntity.color || '#38BDF8' }}
              />
              <span className="font-semibold text-white text-sm truncate">
                实体检视: {selectedEntity.name}
              </span>
            </>
          ) : selectedRelation ? (
            <>
              <Link2 className="w-4 h-4 text-monokai-accent shrink-0" />
              <span className="font-semibold text-white text-sm truncate">
                关联检视: {selectedRelation.label || selectedRelation.name}
              </span>
            </>
          ) : (
            <>
              <Code2 className="w-4 h-4 text-monokai-cyan shrink-0" />
              <span className="font-semibold text-white text-sm">语义模型 &amp; 推演分析</span>
            </>
          )}
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-monokai-comment hover:text-white hover:bg-monokai-surface transition-colors cursor-pointer"
          title="收起检视面板"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 2. MAIN BODY */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {/* ======================================================== */}
        {/* CASE A: ENTITY SELECTED                                   */}
        {/* ======================================================== */}
        {selectedEntity && (
          <div className="space-y-4">
            {/* View Switcher: Config vs Live Preview vs Deduction */}
            <div className="grid grid-cols-3 gap-1 bg-monokai-bg p-1 rounded-lg border border-monokai-border">
              <button
                onClick={() => setActiveSubTab('config')}
                className={`py-1.5 px-1 rounded-md font-medium text-xs transition-colors cursor-pointer text-center ${
                  activeSubTab === 'config'
                    ? 'bg-monokai-surface text-white shadow-sm'
                    : 'text-monokai-comment hover:text-white'
                }`}
              >
                配置 ({selectedEntity.properties.length})
              </button>
              <button
                onClick={() => setActiveSubTab('preview')}
                className={`py-1.5 px-1 rounded-md font-medium text-xs transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                  activeSubTab === 'preview'
                    ? 'bg-monokai-surface text-white shadow-sm'
                    : 'text-monokai-comment hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5 text-monokai-accent" />
                <span>数据抽样</span>
              </button>
              <button
                onClick={() => setActiveSubTab('deduction')}
                className={`py-1.5 px-1 rounded-md font-medium text-xs transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                  activeSubTab === 'deduction'
                    ? 'bg-monokai-surface text-white shadow-sm'
                    : 'text-monokai-comment hover:text-white'
                }`}
              >
                <BrainCircuit className="w-3.5 h-3.5 text-monokai-yellow" />
                <span>多跳推演</span>
              </button>
            </div>

            {activeSubTab === 'config' ? (
              <div className="space-y-4">
                {/* Names */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-medium text-monokai-comment mb-1">
                      实体标识 (Name)
                    </label>
                    <input
                      type="text"
                      value={selectedEntity.name}
                      onChange={(e) => updateEntity(selectedEntity.id, { name: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg bg-monokai-bg border border-monokai-border text-xs text-white font-mono focus:border-monokai-accent focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-monokai-comment mb-1">
                      业务显示名称 (Label)
                    </label>
                    <input
                      type="text"
                      value={selectedEntity.label}
                      onChange={(e) => updateEntity(selectedEntity.id, { label: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg bg-monokai-bg border border-monokai-border text-xs text-white focus:border-monokai-accent focus:outline-none"
                    />
                  </div>
                </div>

                {/* DuckDB Table Mapping */}
                <div>
                  <label className="block text-xs font-medium text-monokai-comment mb-1 flex items-center justify-between">
                    <span>绑定 DuckDB 物理表 / 视图</span>
                    <span className="text-xs text-monokai-cyan font-mono">
                      {selectedEntity.rowCount ? `${selectedEntity.rowCount} 行` : ''}
                    </span>
                  </label>
                  <select
                    value={selectedEntity.mappedTable || ''}
                    onChange={(e) =>
                      updateEntity(selectedEntity.id, { mappedTable: e.target.value })
                    }
                    className="w-full px-3 py-1.5 rounded-lg bg-monokai-bg border border-monokai-border text-xs text-white font-mono focus:border-monokai-accent focus:outline-none"
                  >
                    <option value="">-- 未绑定物理表 (纯逻辑概念) --</option>
                    {physicalTables.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.name} ({t.rowCount} 行)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium text-monokai-comment mb-1">
                    业务定义与说明
                  </label>
                  <textarea
                    rows={2}
                    value={selectedEntity.description || ''}
                    onChange={(e) =>
                      updateEntity(selectedEntity.id, { description: e.target.value })
                    }
                    placeholder="简要描述该实体的业务含义及来源..."
                    className="w-full px-3 py-1.5 rounded-lg bg-monokai-bg border border-monokai-border text-xs text-white focus:border-monokai-accent focus:outline-none resize-none leading-relaxed"
                  />
                </div>

                {/* Properties List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-monokai-fg">
                      实体字段 / 属性清单 ({selectedEntity.properties.length})
                    </span>
                    <button
                      onClick={() => {
                        const newProps = [
                          ...selectedEntity.properties,
                          {
                            name: `prop_${selectedEntity.properties.length + 1}`,
                            type: 'VARCHAR',
                            isNullable: true,
                          },
                        ];
                        updateEntity(selectedEntity.id, { properties: newProps });
                      }}
                      className="flex items-center gap-1 text-xs text-monokai-cyan hover:underline cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>添加字段</span>
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {selectedEntity.properties.map((prop, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-lg bg-monokai-bg border border-monokai-border flex items-center justify-between gap-1.5 text-xs font-mono"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <button
                            onClick={() => {
                              const newProps = selectedEntity.properties.map((p, i) =>
                                i === idx ? { ...p, isPrimaryKey: !p.isPrimaryKey } : p
                              );
                              updateEntity(selectedEntity.id, {
                                properties: newProps,
                                primaryKey: !prop.isPrimaryKey ? prop.name : selectedEntity.primaryKey,
                              });
                            }}
                            className={`p-1 rounded cursor-pointer ${
                              prop.isPrimaryKey
                                ? 'bg-monokai-yellow/15 text-monokai-yellow border border-monokai-yellow/30'
                                : 'text-monokai-comment hover:text-monokai-yellow'
                            }`}
                            title={prop.isPrimaryKey ? '主键列' : '设为主键'}
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="text"
                            value={prop.name}
                            onChange={(e) => {
                              const newProps = [...selectedEntity.properties];
                              newProps[idx] = { ...newProps[idx], name: e.target.value };
                              updateEntity(selectedEntity.id, { properties: newProps });
                            }}
                            className="bg-transparent text-monokai-fg focus:outline-none flex-1 truncate text-xs font-mono"
                          />
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <select
                            value={prop.type}
                            onChange={(e) => {
                              const newProps = [...selectedEntity.properties];
                              newProps[idx] = { ...newProps[idx], type: e.target.value };
                              updateEntity(selectedEntity.id, { properties: newProps });
                            }}
                            className="bg-monokai-surface border border-monokai-border rounded px-1.5 py-0.5 text-xs text-monokai-cyan outline-none"
                          >
                            <option value="INTEGER">INTEGER</option>
                            <option value="VARCHAR">VARCHAR</option>
                            <option value="DATE">DATE</option>
                            <option value="TIMESTAMP">TIMESTAMP</option>
                            <option value="DECIMAL(12,2)">DECIMAL</option>
                            <option value="BOOLEAN">BOOLEAN</option>
                            <option value="DOUBLE">DOUBLE</option>
                          </select>
                          <button
                            onClick={() => {
                              const newProps = selectedEntity.properties.filter((_, i) => i !== idx);
                              updateEntity(selectedEntity.id, { properties: newProps });
                            }}
                            className="text-monokai-comment hover:text-monokai-pink p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Metrics */}
                <div className="space-y-2 pt-2 border-t border-monokai-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-monokai-fg">
                      业务度量指标 ({selectedEntity.metrics.length})
                    </span>
                    <button
                      onClick={() => {
                        const newMetrics = [
                          ...selectedEntity.metrics,
                          {
                            id: `m_${Date.now()}`,
                            name: `metric_${selectedEntity.metrics.length + 1}`,
                            label: '新业务指标',
                            expression: 'COUNT(*)',
                            aggregation: 'COUNT' as const,
                          },
                        ];
                        updateEntity(selectedEntity.id, { metrics: newMetrics });
                      }}
                      className="flex items-center gap-1 text-xs text-monokai-accent hover:underline cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>添加指标</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {selectedEntity.metrics.map((met, mIdx) => (
                      <div
                        key={met.id}
                        className="p-2.5 rounded-lg bg-monokai-bg border border-monokai-border space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-monokai-fg text-xs">{met.label}</span>
                          <button
                            onClick={() => {
                              const newM = selectedEntity.metrics.filter((_, i) => i !== mIdx);
                              updateEntity(selectedEntity.id, { metrics: newM });
                            }}
                            className="text-monokai-comment hover:text-monokai-pink cursor-pointer p-0.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-mono">
                          <span className="text-monokai-comment">{met.name}:</span>
                          <input
                            type="text"
                            value={met.expression}
                            onChange={(e) => {
                              const newM = [...selectedEntity.metrics];
                              newM[mIdx] = { ...newM[mIdx], expression: e.target.value };
                              updateEntity(selectedEntity.id, { metrics: newM });
                            }}
                            className="flex-1 bg-monokai-surface border border-monokai-border rounded px-2 py-1 text-monokai-accent text-xs focus:outline-none focus:border-monokai-accent"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Delete Entity Button */}
                <div className="pt-3">
                  <button
                    onClick={() => deleteEntity(selectedEntity.id)}
                    className="w-full py-2 px-3 rounded-lg bg-monokai-surface hover:bg-rose-500/10 text-monokai-comment hover:text-rose-400 border border-monokai-border hover:border-rose-500/30 text-xs font-medium cursor-pointer transition-colors"
                  >
                    删除当前业务实体
                  </button>
                </div>
              </div>
            ) : activeSubTab === 'preview' ? (
              /* Subtab: LIVE DUCKDB DATA PREVIEW */
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-monokai-fg">
                    DuckDB 物理表采样 (LIMIT 10)
                  </span>
                  <button
                    onClick={() =>
                      selectedEntity.mappedTable && fetchLivePreview(selectedEntity.mappedTable)
                    }
                    disabled={isLoadingPreview || !selectedEntity.mappedTable}
                    className="flex items-center gap-1.5 text-xs text-monokai-accent hover:underline cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPreview ? 'animate-spin' : ''}`} />
                    <span>刷新</span>
                  </button>
                </div>

                {isLoadingPreview ? (
                  <div className="py-10 text-center text-monokai-comment font-mono text-xs">
                    正在从 DuckDB 读取样本...
                  </div>
                ) : previewError ? (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-monokai-border-subtle text-rose-400 text-xs">
                    {previewError}
                  </div>
                ) : !livePreviewData || livePreviewData.length === 0 ? (
                  <div className="py-10 text-center text-monokai-comment text-xs">
                    {selectedEntity.mappedTable ? '暂无数据行' : '该实体未绑定 DuckDB 物理表'}
                  </div>
                ) : (
                  <div className="border border-monokai-border rounded-lg overflow-x-auto max-h-72">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-monokai-bg border-b border-monokai-border text-monokai-comment">
                        <tr>
                          {Object.keys(livePreviewData[0] || {}).map((colKey) => (
                            <th key={colKey} className="px-2.5 py-1.5 font-medium whitespace-nowrap">
                              {colKey}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-monokai-border text-monokai-fg-muted">
                        {livePreviewData.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-monokai-surface">
                            {Object.values(row).map((val: any, cIdx) => (
                              <td
                                key={cIdx}
                                className="px-2.5 py-1.5 whitespace-nowrap truncate max-w-[120px]"
                                title={String(val)}
                              >
                                {val === null || val === undefined ? (
                                  <span className="text-monokai-comment italic">null</span>
                                ) : (
                                  String(val)
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              /* Subtab: DEDUCTION & MULTI-HOP PATHS */
              <div className="space-y-3.5">
                <div className="p-3.5 rounded-lg bg-monokai-bg border border-monokai-border space-y-2.5">
                  <span className="text-xs font-semibold text-monokai-fg block">
                    从「{selectedEntity.name}」探索多跳关系链路
                  </span>
                  <p className="text-xs text-monokai-comment leading-relaxed">
                    自动遍历图谱拓扑，推演实体间可能存在的间接依赖、交易链条或高阶业务事实。
                  </p>

                  <div className="pt-1 space-y-1.5">
                    <label className="block text-xs font-medium text-monokai-fg-muted">目标推演实体</label>
                    <div className="flex items-center gap-2">
                      <select
                        value={targetEntityId}
                        onChange={(e) => handleSearchPaths(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-monokai-surface border border-monokai-border text-xs text-monokai-fg focus:border-monokai-accent focus:outline-none"
                      >
                        <option value="">-- 请选择目标实体 --</option>
                        {entities
                          .filter((e) => e.id !== selectedEntity.id)
                          .map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.name} ({e.label || '无别名'})
                            </option>
                          ))}
                      </select>
                      <button
                        onClick={() => handleSearchPaths(targetEntityId)}
                        disabled={!targetEntityId}
                        className="px-3 py-1.5 rounded-lg bg-monokai-accent hover:bg-monokai-accent text-white font-medium text-xs disabled:opacity-50 cursor-pointer transition-colors shrink-0 shadow-sm"
                      >
                        探查
                      </button>
                    </div>
                  </div>
                </div>

                {/* Discovered Paths */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-monokai-fg flex items-center justify-between">
                    <span>连通拓扑路径 ({discoveredPaths.length})</span>
                    {activeDeductionPath && (
                      <button
                        onClick={() => setActiveDeductionPath(null)}
                        className="text-xs text-monokai-cyan hover:underline cursor-pointer"
                      >
                        清除画布高亮
                      </button>
                    )}
                  </span>

                  {discoveredPaths.length === 0 ? (
                    <div className="p-4 rounded-lg bg-monokai-bg border border-monokai-border text-center text-xs text-monokai-comment">
                      {targetEntityId ? '未找到 4 跳内的直接连通路径' : '请选择目标实体开始推演'}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {discoveredPaths.map((path, idx) => {
                        const isSelectedPath = activeDeductionPath?.id === path.id;
                        return (
                          <div
                            key={path.id}
                            onClick={() => setActiveDeductionPath(path)}
                            className={`p-3 rounded-lg border transition-all cursor-pointer space-y-1.5 ${
                              isSelectedPath
                                ? 'bg-amber-500/10 border-monokai-accent text-monokai-fg shadow-sm'
                                : 'bg-monokai-bg border-monokai-border hover:border-monokai-border-strong text-monokai-fg-muted'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold font-mono text-amber-300">
                                路径 {idx + 1} ({path.nodes.length - 1} 跳)
                              </span>
                              {isSelectedPath && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-monokai-surface text-amber-300 border border-monokai-border-subtle font-mono">
                                  画布高亮中
                                </span>
                              )}
                            </div>
                            <div className="text-xs font-mono leading-relaxed text-monokai-fg">
                              {path.description}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Related Deduction Rules */}
                <div className="space-y-2 pt-1 border-t border-monokai-border">
                  <span className="text-xs font-semibold text-monokai-fg block">
                    当前实体适用的推演规则
                  </span>
                  {deductionRules.filter(
                    (r) => r.sourceEntityId === selectedEntity.id || r.targetEntityId === selectedEntity.id
                  ).length === 0 ? (
                    <div className="p-3 rounded-lg bg-monokai-bg border border-monokai-border text-center text-xs text-monokai-comment">
                      暂无关联的业务规则推演
                    </div>
                  ) : (
                    deductionRules
                      .filter(
                        (r) => r.sourceEntityId === selectedEntity.id || r.targetEntityId === selectedEntity.id
                      )
                      .map((rule) => (
                        <div
                          key={rule.id}
                          className="p-2.5 rounded-lg bg-monokai-bg border border-monokai-border text-xs space-y-1"
                        >
                          <div className="font-semibold text-monokai-fg">{rule.name}</div>
                          <div className="text-monokai-comment font-mono text-xs">
                            <span className="text-monokai-yellow">IF: </span>
                            {rule.condition}
                          </div>
                          <div className="text-monokai-accent font-mono text-xs">
                            <span>THEN: </span>
                            {rule.inferredFact}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* CASE B: RELATION SELECTED                                 */}
        {/* ======================================================== */}
        {selectedRelation && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-monokai-bg border border-monokai-border space-y-1.5">
              <span className="text-xs text-monokai-comment uppercase font-mono tracking-wider">
                关联端点
              </span>
              <div className="flex items-center gap-2 font-mono text-xs text-white">
                <span className="text-monokai-cyan font-semibold">
                  {entities.find((e) => e.id === selectedRelation.sourceEntityId)?.name || '未知'}
                </span>
                <span className="text-monokai-accent font-bold">&rarr;</span>
                <span className="text-monokai-cyan font-semibold">
                  {entities.find((e) => e.id === selectedRelation.targetEntityId)?.name || '未知'}
                </span>
              </div>
            </div>

            {/* Relation Label & Name */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-monokai-comment mb-1">
                  关系名称 (Name)
                </label>
                <input
                  type="text"
                  value={selectedRelation.name}
                  onChange={(e) => updateRelation(selectedRelation.id, { name: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg bg-monokai-bg border border-monokai-border text-xs text-white font-mono focus:border-monokai-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-monokai-comment mb-1">
                  业务释义 (Label)
                </label>
                <input
                  type="text"
                  value={selectedRelation.label}
                  onChange={(e) => updateRelation(selectedRelation.id, { label: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg bg-monokai-bg border border-monokai-border text-xs text-white focus:border-monokai-accent focus:outline-none"
                />
              </div>
            </div>

            {/* Cardinality & Join Type */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-monokai-comment mb-1">
                  关系基数 (Cardinality)
                </label>
                <select
                  value={selectedRelation.cardinality}
                  onChange={(e) =>
                    updateRelation(selectedRelation.id, {
                      cardinality: e.target.value as RelationCardinality,
                    })
                  }
                  className="w-full px-3 py-1.5 rounded-lg bg-monokai-bg border border-monokai-border text-xs text-white font-mono focus:border-monokai-accent focus:outline-none"
                >
                  <option value="1:1">1 : 1 (一对一)</option>
                  <option value="1:N">1 : N (一对多)</option>
                  <option value="N:1">N : 1 (多对一)</option>
                  <option value="N:M">N : M (多对多)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-monokai-comment mb-1">
                  连接方式 (Join Type)
                </label>
                <select
                  value={selectedRelation.joinType}
                  onChange={(e) =>
                    updateRelation(selectedRelation.id, {
                      joinType: e.target.value as RelationJoinType,
                    })
                  }
                  className="w-full px-3 py-1.5 rounded-lg bg-monokai-bg border border-monokai-border text-xs text-white font-mono focus:border-monokai-accent focus:outline-none"
                >
                  <option value="LEFT">LEFT JOIN</option>
                  <option value="INNER">INNER JOIN</option>
                  <option value="RIGHT">RIGHT JOIN</option>
                  <option value="FULL">FULL OUTER JOIN</option>
                </select>
              </div>
            </div>

            {/* Foreign Key Mapping Fields */}
            <div className="p-3.5 rounded-lg bg-monokai-bg border border-monokai-border space-y-2.5">
              <span className="text-xs font-semibold text-monokai-fg block">
                关联键映射条件 (ON Condition)
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-xs text-monokai-comment block mb-1">源字段 (Source)</span>
                  <input
                    type="text"
                    value={selectedRelation.sourceField}
                    onChange={(e) =>
                      updateRelation(selectedRelation.id, { sourceField: e.target.value })
                    }
                    placeholder="如 customer_id"
                    className="w-full px-2.5 py-1.5 rounded-md bg-monokai-surface border border-monokai-border text-white text-xs font-mono focus:outline-none focus:border-monokai-accent"
                  />
                </div>
                <div>
                  <span className="text-xs text-monokai-comment block mb-1">目标字段 (Target)</span>
                  <input
                    type="text"
                    value={selectedRelation.targetField}
                    onChange={(e) =>
                      updateRelation(selectedRelation.id, { targetField: e.target.value })
                    }
                    placeholder="如 customer_id"
                    className="w-full px-2.5 py-1.5 rounded-md bg-monokai-surface border border-monokai-border text-white text-xs font-mono focus:outline-none focus:border-monokai-accent"
                  />
                </div>
              </div>
            </div>

            {/* Delete Relation */}
            <div className="pt-2">
              <button
                onClick={() => deleteRelation(selectedRelation.id)}
                className="w-full py-2 px-3 rounded-lg bg-monokai-surface hover:bg-rose-500/10 text-monokai-comment hover:text-rose-400 border border-monokai-border hover:border-rose-500/30 text-xs font-medium cursor-pointer transition-colors"
              >
                删除当前关联关系
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* CASE C: GLOBAL MODEL & CTE SQL COMPILER                   */}
        {/* ======================================================== */}
        {!selectedEntity && !selectedRelation && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-lg bg-monokai-bg border border-monokai-border space-y-2.5">
              <span className="text-xs font-semibold text-monokai-fg block">语义模型全局拓扑概览</span>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2.5 rounded-lg bg-monokai-surface border border-monokai-border">
                  <span className="text-base font-mono font-bold text-monokai-cyan block">
                    {entities.length}
                  </span>
                  <span className="text-xs text-monokai-comment">业务实体</span>
                </div>
                <div className="p-2.5 rounded-lg bg-monokai-surface border border-monokai-border">
                  <span className="text-base font-mono font-bold text-monokai-accent block">
                    {relations.length}
                  </span>
                  <span className="text-xs text-monokai-comment">语义关联</span>
                </div>
                <div className="p-2.5 rounded-lg bg-monokai-surface border border-monokai-border">
                  <span className="text-base font-mono font-bold text-monokai-yellow block">
                    {entities.filter((e) => Boolean(e.mappedTable)).length}
                  </span>
                  <span className="text-xs text-monokai-comment">物理映射</span>
                </div>
                <div className="p-2.5 rounded-lg bg-monokai-surface border border-monokai-border">
                  <span className="text-base font-mono font-bold text-monokai-fg block">
                    {deductionRules.length}
                  </span>
                  <span className="text-xs text-monokai-comment">推演规则</span>
                </div>
              </div>
            </div>

            {/* SQL Compiler */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-monokai-fg flex items-center gap-1.5">
                  <Code2 className="w-4 h-4 text-monokai-cyan" />
                  <span>编译为多表 CTE 分析 SQL</span>
                </span>
                <button
                  onClick={handleCopySql}
                  className="flex items-center gap-1 text-xs text-monokai-cyan hover:text-monokai-cyan hover:underline cursor-pointer"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5 text-monokai-accent" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSql ? '已复制' : '复制代码'}</span>
                </button>
              </div>

              <div className="p-3 rounded-lg bg-monokai-bg border border-monokai-border font-mono text-xs text-monokai-fg-muted max-h-80 overflow-y-auto leading-relaxed select-text whitespace-pre-wrap">
                {sqlPreview}
              </div>

              {/* Action: Open in SQL Workbench */}
              <button
                onClick={handleRunInEditor}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-monokai-accent hover:bg-monokai-cyan text-[#102022] font-bold text-xs shadow-lg shadow-xs cursor-pointer transition-all"
              >
                <Play className="w-3.5 h-3.5 fill-slate-950" />
                <span>在 SQL 工作台打开并执行</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
