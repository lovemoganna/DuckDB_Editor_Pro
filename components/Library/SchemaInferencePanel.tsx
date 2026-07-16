import React, { useState, useEffect } from 'react';
import { X, Wand2, Check, Loader2, ChevronDown, ChevronRight, AlertCircle, Sparkles } from 'lucide-react';
import { TableInfo, InferredOntology, InferredObjectType, InferredLinkType } from '../../services/schemaInferenceEngine';
import { useOntologyStore } from '../../hooks/useOntologyStore';
import { ontologyAiService } from '../../services/ontologyAiService';
import { duckDBService } from '../../services/duckdbService';
import {
  getObjectTypeDbIdByName,
  getLinkTypeDbIdByName,
  getObjectIdsByObjectType,
} from '../../services/schema/schemaInferenceService';

const duckSvc = duckDBService;

interface SchemaInferencePanelProps {
  tables: TableInfo[];
  onClose: () => void;
  onInferDone?: () => void;
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const level = confidence >= 0.9 ? '高' : confidence >= 0.8 ? '中' : '低';
  const color = confidence >= 0.9
    ? 'bg-monokai-green/15 text-monokai-green border-monokai-green/25'
    : confidence >= 0.8
    ? 'bg-monokai-yellow/15 text-monokai-yellow border-monokai-yellow/25'
    : 'bg-monokai-orange/15 text-monokai-orange border-monokai-orange/25';
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-normal shrink-0 ${color}`}>
      {level}置信
    </span>
  );
}

export const SchemaInferencePanel: React.FC<SchemaInferencePanelProps> = ({ tables, onClose, onInferDone }) => {
  const store = useOntologyStore();
  const [inferred, setInferred] = useState<InferredOntology | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingOt, setEditingOt] = useState<Record<string, { name: string; description: string }>>({});
  const [editingLt, setEditingLt] = useState<Record<string, { name: string; description: string }>>({});
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState({ objectTypes: true, links: true });
  const [aiEnhancing, setAiEnhancing] = useState(false);
  const [clearDemoData, setClearDemoData] = useState(true);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const { inferOntology } = await import('../../services/schemaInferenceEngine');
        const result = inferOntology(tables);
        const otEdits: Record<string, { name: string; description: string }> = {};
        const ltEdits: Record<string, { name: string; description: string }> = {};
        for (const ot of result.objectTypes) {
          otEdits[ot.id] = { name: ot.name, description: ot.description };
        }
        for (const lt of result.linkTypes) {
          ltEdits[lt.id] = { name: lt.name, description: lt.description };
        }
        setInferred(result);
        setEditingOt(otEdits);
        setEditingLt(ltEdits);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [tables]);

  const deepImportOntology = async () => {
    if (!inferred) return;
    // 1. Ensure ontology tables exist
    await store.initOntology();
    // 2. Optionally clear demo data before writing inferred schema
    if (clearDemoData) {
      await duckSvc.query('DELETE FROM life_link');
      await duckSvc.query('DELETE FROM life_object');
    }
    // 3. Refresh to pick up cleared state before writing
    await store.refresh();

    const state = store.state;

    const otNameToDbId: Record<string, number> = {};
    for (const ot of state.objectTypes) otNameToDbId[ot.name] = ot.id;
    const ltNameToDbId: Record<string, number> = {};
    for (const lt of state.linkTypes) ltNameToDbId[lt.name] = lt.id;

    const getOtDbIdByName = async (name: string): Promise<number> => {
      return getObjectTypeDbIdByName(name);
    };
    const getLtDbIdByName = async (name: string): Promise<number> => {
      return getLinkTypeDbIdByName(name);
    };

    // 1. Create object types
    for (const ot of inferred.objectTypes) {
      const edit = editingOt[ot.id] ?? { name: ot.name, description: ot.description };
      if (!otNameToDbId[edit.name]) {
        await store.createObjectType(edit.name, edit.description);
        const id = await getOtDbIdByName(edit.name);
        if (id) otNameToDbId[edit.name] = id;
      }
    }

    // 2. Create link types
    for (const lt of inferred.linkTypes) {
      const edit = editingLt[lt.id] ?? { name: lt.name, description: lt.description };
      if (!ltNameToDbId[edit.name]) {
        await store.createLinkType(edit.name, edit.description);
        const id = await getLtDbIdByName(edit.name);
        if (id) ltNameToDbId[edit.name] = id;
      }
    }

    // 3. Read actual table data → create objects (skip junction tables)
    const tableNameToOtId: Record<string, number> = {};
    for (const ot of inferred.objectTypes) {
      const edit = editingOt[ot.id] ?? { name: ot.name, description: ot.description };
      const dbId = otNameToDbId[edit.name];
      if (dbId) tableNameToOtId[ot.tableName] = dbId;
    }

    const processedTables = new Set<string>();
    const batchObjects: Array<{ name: string; objectTypeId: number; properties: string }> = [];

    for (const ot of inferred.objectTypes) {
      const tableName = ot.tableName;
      if (processedTables.has(tableName)) continue;
      if (/_rel|_link|_junction|_map|_assoc/i.test(tableName.toLowerCase())) continue;

      processedTables.add(tableName);
      const objTypeId = tableNameToOtId[tableName];
      if (!objTypeId) continue;

      try {
        const rows = await duckSvc.query(`SELECT * FROM "${tableName}"`);
        console.log(`[SchemaInference] Table "${tableName}": ${rows.length} rows fetched`);
        if (rows.length === 0) {
          batchObjects.push({ name: `来自「${tableName}」的记录（暂无数据）`, objectTypeId, properties: JSON.stringify({ _sourceTable: tableName, _placeholder: true }) });
        }
        for (const row of rows) {
          const pkCol = Object.keys(row).find(k => k.toLowerCase().includes('id') || k.toLowerCase() === 'name');
          const name = row.name || row.title || row.label || row[pkCol ?? Object.keys(row)[0]] || tableName;
          const props: Record<string, any> = { _sourceTable: tableName };
          for (const [k, v] of Object.entries(row)) {
            if (k === 'id' || k === 'name' || k === 'title' || k === 'label') continue;
            if (v !== null && v !== undefined) props[k] = v;
          }
          batchObjects.push({ name: String(name), objectTypeId, properties: JSON.stringify(props) });
        }
        console.log(`[SchemaInference] Queued ${rows.length} objects for table "${tableName}"`);
      } catch (err: any) {
        console.error(`[SchemaInference] Failed to read table "${tableName}":`, err.message);
        batchObjects.push({ name: `来自「${tableName}」（读取失败）`, objectTypeId, properties: JSON.stringify({ _sourceTable: tableName, _error: err.message }) });
      }
    }

    // Insert objects one by one
    for (const obj of batchObjects) {
      try {
        await store.createObject(obj.name, obj.objectTypeId, obj.properties);
      } catch {}
    }

    // 4. Build links from foreign keys
    for (const lt of inferred.linkTypes) {
      const ltDbId = ltNameToDbId[(editingLt[lt.id] ?? { name: lt.name }).name];
      if (!ltDbId) continue;

      const fromOt = inferred.objectTypes.find(o => o.id === lt.fromObjectTypeId);
      const toOt = inferred.objectTypes.find(o => o.id === lt.toObjectTypeId);
      if (!fromOt || !toOt) continue;
      const fromOtName = (editingOt[fromOt.id] ?? { name: fromOt.name }).name;
      const toOtName = (editingOt[toOt.id] ?? { name: toOt.name }).name;
      const fromOtDbId = otNameToDbId[fromOtName];
      const toOtDbId = otNameToDbId[toOtName];

      const fromObjIds = await getObjectIdsByObjectType(fromOtDbId);
      const toObjIds = await getObjectIdsByObjectType(toOtDbId);

      if (fromObjIds.length === 0 || toObjIds.length === 0) continue;
      const maxLinks = 50;
      if (fromObjIds.length * toObjIds.length > maxLinks) continue;

      for (const fromId of fromObjIds) {
        for (const toId of toObjIds) {
          if (fromId !== toId) {
            try {
              await store.createLink(ltDbId, fromId, toId, 0.5);
            } catch (err: any) {
              console.error(`[SchemaInference] Failed to create link (ltDbId=${ltDbId}, from=${fromId}, to=${toId}):`, err);
            }
          }
        }
      }
    }

    // Final refresh
    await store.refresh();
    onInferDone?.();
  };

  const handleImport = async () => {
    console.log('[SchemaInference] handleImport CLICKED');
    setImporting(true);
    setError(null);
    try {
      await deepImportOntology();
      onClose();
    } catch (e: any) {
      setError(`导入失败: ${e.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleAiEnhance = async () => {
    if (!inferred) return;
    setAiEnhancing(true);
    setError(null);
    try {
      const allObjects = [
        ...inferred.objectTypes.map(ot => editingOt[ot.id]?.name ?? ot.name),
        ...inferred.linkTypes.map(lt => editingLt[lt.id]?.name ?? lt.name),
      ];
      const suggestions = await ontologyAiService.generateSuggestions(allObjects, [], 0, 0);
      if (suggestions.length > 0) {
        setEditingOt(prev => {
          const next = { ...prev };
          for (const sug of suggestions.slice(0, 5)) {
            const key = Object.keys(prev).find(k => k.startsWith(sug.id.replace(/[^0-9]/g, '')));
            if (key) next[key] = { name: sug.name, description: sug.description };
          }
          return next;
        });
      }
    } catch (e: any) {
      setError(`AI 优化失败: ${e.message}`);
    } finally {
      setAiEnhancing(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="w-[640px] max-h-[80vh] bg-monokai-bg border border-monokai-border/80 rounded-xl flex flex-col">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-monokai-border/50">
            <Loader2 className="w-4 h-4 animate-spin text-monokai-cyan" />
            <span className="text-sm text-monokai-comment">正在分析 {tables.length} 张表，推断概念和关系...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!inferred) {
    return (
      <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="w-[640px] bg-monokai-bg border border-monokai-border/80 rounded-xl p-5">
          <div className="flex items-center gap-3 text-monokai-orange">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="text-sm">{error || '推断失败'}</span>
          </div>
          <button onClick={onClose} className="mt-4 px-4 py-2 rounded-md bg-monokai-sidebar text-monokai-comment text-sm">关闭</button>
        </div>
      </div>
    );
  }

  const { objectTypes, linkTypes } = inferred;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-[760px] max-h-[88vh] bg-monokai-bg border border-monokai-border/80 rounded-xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-monokai-border/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-monokai-sidebar flex items-center justify-center shrink-0">
              <Wand2 className="w-3.5 h-3.5 text-monokai-amethyst" />
            </div>
            <div>
              <h3 className="text-[13px] font-semibold text-monokai-fg">Schema · 本体推断</h3>
              <p className="text-[9px] text-monokai-comment mt-px">
                基于 {tables.length} 张数据表，推断出 {objectTypes.length} 个概念和 {linkTypes.length} 个关系
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-monokai-comment hover:text-monokai-fg hover:bg-monokai-sidebar transition-colors shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Guide line */}
        <div className="px-5 py-2.5 border-b border-monokai-border/40 shrink-0">
          <p className="text-[10px] text-monokai-comment leading-relaxed">
            系统分析了 {tables.length} 张数据表，发现了其中的概念（如「用户」「订单」）和关系（如「用户拥有订单」），帮助你快速构建知识图谱。修改推断名称后点击「导入本体」。
          </p>
        </div>

        {/* Stats row 1 */}
        <div className="px-5 py-2 border-b border-monokai-border/50 flex items-center gap-3 shrink-0">
          <span className="text-[10px] text-monokai-comment">概念</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-monokai-sidebar text-monokai-fg-muted">{objectTypes.length}</span>
          <div className="w-px h-2.5 bg-monokai-border/60 shrink-0" />
          <span className="text-[10px] text-monokai-comment">关系</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-monokai-sidebar text-monokai-fg-muted">{linkTypes.length}</span>
          <div className="ml-auto flex items-center gap-2">
            <label className="flex items-center gap-1 text-[10px] text-monokai-comment cursor-pointer shrink-0 select-none">
              <input
                type="checkbox"
                checked={clearDemoData}
                onChange={e => setClearDemoData(e.target.checked)}
                className="accent-monokai-amethyst"
              />
              <span>清除示例数据</span>
            </label>
          </div>
        </div>

        {/* Stats row 2 — action buttons */}
        <div className="px-5 py-2 flex items-center justify-between shrink-0">
          <button
            onClick={handleAiEnhance}
            disabled={aiEnhancing}
            title="让 AI 根据表名语义自动优化推断的名称和描述"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px]
              bg-monokai-amethyst/10 text-monokai-amethyst border border-monokai-amethyst/20
              hover:bg-monokai-amethyst/20 hover:border-monokai-amethyst/30 transition-all
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {aiEnhancing
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <Sparkles className="w-3 h-3" />
            }
            AI 优化名称
          </button>
          <button
            onClick={handleImport}
            disabled={importing || objectTypes.length === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11px] font-medium
              bg-monokai-cyan/15 text-monokai-cyan border border-monokai-cyan/25
              hover:bg-monokai-cyan/25 hover:border-monokai-cyan/40 transition-all
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {importing
              ? <><Loader2 className="w-3 h-3 animate-spin" /> 导入中...</>
              : <><Check className="w-3 h-3" /> 导入本体</>
            }
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mt-2 px-3 py-2 rounded text-[10px] text-monokai-orange bg-monokai-orange/10 border border-monokai-orange/20 shrink-0">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-3 space-y-3">

          {/* 概念 section */}
          {objectTypes.length > 0 && (
            <div>
              <button
                className="w-full flex items-center gap-1.5 mb-1.5"
                onClick={() => setExpanded(p => ({ ...p, objectTypes: !p.objectTypes }))}
              >
                {expanded.objectTypes
                  ? <ChevronDown className="w-3 h-3 text-monokai-amethyst shrink-0" />
                  : <ChevronRight className="w-3 h-3 text-monokai-amethyst shrink-0" />
                }
                <span className="text-[11px] font-medium text-monokai-amethyst">概念</span>
                <span className="text-[10px] text-monokai-comment/60">来自数据表的名字，可点击修改</span>
              </button>

              {expanded.objectTypes && (
                <div className="grid grid-cols-2 gap-2">
                  {objectTypes.map(ot => {
                    const edit = editingOt[ot.id] ?? { name: ot.name, description: ot.description };
                    const isDirty = editingOt[ot.id] !== undefined;
                    return (
                      <div
                        key={ot.id}
                        className={`rounded border px-3 py-3 transition-colors ${
                          isDirty
                            ? 'border-monokai-amethyst/40 bg-monokai-amethyst/[0.03]'
                            : 'border-monokai-border/40 bg-monokai-surface hover:border-monokai-border/70'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <input
                            value={edit.name}
                            onChange={e => setEditingOt(prev => ({
                              ...prev,
                              [ot.id]: { ...(prev[ot.id] || ot), name: e.target.value }
                            }))}
                            className="text-[12px] font-medium text-monokai-fg bg-transparent border-b border-transparent focus:border-monokai-amethyst/60 outline-none w-full min-w-0"
                            placeholder="概念名称"
                          />
                          <ConfidenceBadge confidence={ot.confidence} />
                        </div>
                        <p className="text-[10px] text-monokai-comment leading-relaxed mb-1.5">{edit.description}</p>
                        <p className="text-[9px] text-monokai-comment/60">来自「{ot.tableName}」表 · {ot.reason}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 关系 section */}
          {linkTypes.length > 0 && (
            <div>
              <button
                className="w-full flex items-center gap-1.5 mb-1.5"
                onClick={() => setExpanded(p => ({ ...p, links: !p.links }))}
              >
                {expanded.links
                  ? <ChevronDown className="w-3 h-3 text-monokai-green shrink-0" />
                  : <ChevronRight className="w-3 h-3 text-monokai-green shrink-0" />
                }
                <span className="text-[11px] font-medium text-monokai-green">关系</span>
                <span className="text-[10px] text-monokai-comment/60">表之间的关联，可点击修改</span>
              </button>

              {expanded.links && (
                <div className="space-y-1.5">
                  {linkTypes.map(lt => {
                    const edit = editingLt[lt.id] ?? { name: lt.name, description: lt.description };
                    const isDirty = editingLt[lt.id] !== undefined;
                    const fromOt = objectTypes.find(o => o.id === lt.fromObjectTypeId);
                    const toOt = objectTypes.find(o => o.id === lt.toObjectTypeId);

                    return (
                      <div
                        key={lt.id}
                        className={`rounded border px-3 py-2.5 transition-colors ${
                          isDirty
                            ? 'border-monokai-green/40 bg-monokai-green/[0.03]'
                            : 'border-monokai-border/40 bg-monokai-surface hover:border-monokai-border/70'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-[10px] px-1 py-0.5 rounded bg-monokai-amethyst/10 text-monokai-amethyst">
                            {fromOt?.name ?? lt.fromObjectTypeId}
                          </span>
                          <ChevronRight className="w-2.5 h-2.5 text-monokai-comment shrink-0" />
                          <input
                            value={edit.name}
                            onChange={e => setEditingLt(prev => ({
                              ...prev,
                              [lt.id]: { ...(prev[lt.id] || lt), name: e.target.value }
                            }))}
                            className="text-[13px] font-medium text-monokai-green bg-transparent border-b border-transparent focus:border-monokai-green/60 outline-none flex-1 min-w-0"
                            placeholder="关系名称"
                          />
                          <ChevronRight className="w-2.5 h-2.5 text-monokai-comment shrink-0" />
                          <span className="text-[10px] px-1 py-0.5 rounded bg-monokai-blue/10 text-monokai-blue">
                            {toOt?.name ?? lt.toObjectTypeId}
                          </span>
                          <ConfidenceBadge confidence={lt.confidence} />
                        </div>
                        <p className="text-[10px] text-monokai-comment leading-relaxed mb-1.5">{edit.description}</p>
                        <p className="text-[9px] text-monokai-comment/60">{lt.reason}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {objectTypes.length === 0 && (
            <div className="text-center py-10 text-monokai-comment/60">
              <p className="text-sm">未发现可推断的本体结构</p>
              <p className="text-[11px] mt-1">这可能是因为所选数据表中没有包含足够的外键关系</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SchemaInferencePanel;
