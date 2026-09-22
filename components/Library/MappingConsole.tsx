import React, { useState, useEffect } from 'react';
import {
  Database,
  Table2,
  Link2,
  Check,
  RefreshCw,
  Layers,
  UploadCloud,
  ChevronRight,
  ChevronDown,
  Sparkles,
  ArrowRight,
  Loader2,
  FileCode2,
  Eye,
} from 'lucide-react';
import { duckDBService } from '../../services/duckdbService';
import { useOntologyStore } from '../../hooks/useOntologyStore';
import { UniversalImporter } from './UniversalImporter';
import { IconButton, ActionButton, Badge } from '../ui/Workbench';

export const MappingConsole: React.FC = () => {
  const { state, dispatch, loadData, batchImportModelingResult } = useOntologyStore();
  const [tables, setTables] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [reversingTable, setReversingTable] = useState<string | null>(null);
  const [isReversingAll, setIsReversingAll] = useState(false);
  const [reverseSuccess, setReverseSuccess] = useState<string | null>(null);
  const [tableCols, setTableCols] = useState<Record<string, string[]>>({});
  const [expandedMapping, setExpandedMapping] = useState<Record<string, boolean>>({
    objectTable: false,
    linkTable: false,
  });
  const [showImporter, setShowImporter] = useState(false);
  const [previewTable, setPreviewTable] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [previewCols, setPreviewCols] = useState<any[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const handleTogglePreview = async (tbl: string) => {
    if (previewTable === tbl) {
      setPreviewTable(null);
      return;
    }
    setPreviewTable(tbl);
    setLoadingPreview(true);
    try {
      const schema = await duckDBService.getTableSchema(tbl);
      const rows = await duckDBService.query(`SELECT * FROM "${tbl}" LIMIT 3`);
      setPreviewCols(schema);
      setPreviewRows(rows);
    } catch (err) {
      console.error('Preview table failed:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const refreshTables = async () => {
    setLoading(true);
    try {
      const t = await duckDBService.getTables();
      setTables(t);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchColsForTable = async (tableName: string) => {
    if (!tableName) return;
    try {
      const schema = await duckDBService.getTableSchema(tableName);
      const cols = schema.map((c: any) => c.name);
      setTableCols(prev => ({ ...prev, [tableName]: cols }));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (state.initState !== 'no-tables' && state.initState !== 'loading') {
      refreshTables();
    }
  }, [state.initState]);

  useEffect(() => {
    if (state.initState !== 'no-tables' && state.initState !== 'loading' && state.mapping.objectTable) {
      fetchColsForTable(state.mapping.objectTable);
    }
  }, [state.mapping.objectTable, state.initState]);

  useEffect(() => {
    if (state.initState !== 'no-tables' && state.initState !== 'loading' && state.mapping.linkTable) {
      fetchColsForTable(state.mapping.linkTable);
    }
  }, [state.mapping.linkTable, state.initState]);

  // Physical tables filter (exclude internal ontology tables)
  const physicalTables = tables.filter(t => !t.startsWith('life_') && !t.startsWith('_sys_'));

  // 1-Click Reverse DuckDB Table to Ontology Objects
  const handleReverseTable = async (tableName: string) => {
    setReversingTable(tableName);
    setReverseSuccess(null);
    try {
      const schema = await duckDBService.getTableSchema(tableName);
      const rows = await duckDBService.query(`SELECT * FROM "${tableName}" LIMIT 50`);

      const cols = schema.map((c: any) => c.name);
      const nameCol = cols.find(c => ['name', 'title', 'username', 'label', 'display'].includes(c.toLowerCase())) || cols[0] || 'id';

      // Check foreign key candidates
      const fkCols = cols.filter(c => c.toLowerCase().endsWith('_id') && c.toLowerCase() !== 'id');

      const objects = rows.map((row: any, idx: number) => ({
        name: String(row[nameCol] || `${tableName}#${idx + 1}`),
        objectType: tableName,
        properties: row,
      }));

      const links: Array<{ from: string; to: string; linkType: string; weight?: number }> = [];

      // If foreign keys match other loaded objects
      if (fkCols.length > 0) {
        for (const fk of fkCols) {
          const targetType = fk.replace(/_id$/i, '');
          for (const row of rows) {
            const targetVal = row[fk];
            if (targetVal !== null && targetVal !== undefined) {
              const myName = String(row[nameCol] || `${tableName}#${row.id || 1}`);
              // Try to find matching object in state
              const matchingObj = state.objects.find(o => String(o.id) === String(targetVal) || o.name.includes(String(targetVal)));
              if (matchingObj) {
                links.push({
                  from: myName,
                  to: matchingObj.name,
                  linkType: `关联_${targetType}`,
                  weight: 0.8,
                });
              }
            }
          }
        }
      }

      await batchImportModelingResult({
        objectTypes: [{ name: tableName, description: `DuckDB 物理表 ${tableName} 逆向生成` }],
        objects,
        linkTypes: fkCols.map(fk => ({ name: `关联_${fk.replace(/_id$/i, '')}`, description: `外键 ${fk} 关联` })),
        links,
      });

      setReverseSuccess(`成功从 [${tableName}] 逆向生成 ${objects.length} 个实体！`);
      setTimeout(() => setReverseSuccess(null), 4000);
    } catch (e: any) {
      console.error('逆向物理表失败:', e);
    } finally {
      setReversingTable(null);
    }
  };

  // 1-Click Reverse All Physical Tables
  const handleReverseAllTables = async () => {
    if (physicalTables.length === 0) return;
    setIsReversingAll(true);
    setReverseSuccess(null);
    try {
      for (const tbl of physicalTables) {
        await handleReverseTable(tbl);
      }
      setReverseSuccess(`全库一键逆向完成！已将 ${physicalTables.length} 张业务表全部注入为知识图谱。`);
      setTimeout(() => setReverseSuccess(null), 5000);
    } catch (err: any) {
      console.error('批量逆向失败:', err);
    } finally {
      setIsReversingAll(false);
    }
  };

  const updateMapping = (key: string, value: any) => {
    dispatch({ type: 'UPDATE_MAPPING', mapping: { [key]: value } });
  };

  const updateColumnMapping = (tableKey: 'objectFields' | 'linkFields', fieldKey: string, value: string) => {
    const currentFields = state.mapping[tableKey] || {};
    dispatch({
      type: 'UPDATE_MAPPING',
      mapping: {
        [tableKey]: { ...currentFields, [fieldKey]: value },
      },
    });
  };

  const toggleExpand = (key: string) => {
    setExpandedMapping(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const OBJECT_FIELDS = [
    { key: 'id', label: 'ID 标识符 (id)', required: true, synonyms: ['id', 'object_id', 'key', 'uuid'] },
    { key: 'name', label: '名称 (name)', required: true, synonyms: ['name', 'title', 'label', 'display'] },
    { key: 'object_type_id', label: '类型ID (object_type_id)', required: true, synonyms: ['object_type_id', 'type_id', 'type', 'category'] },
    { key: 'properties', label: '属性JSON (properties)', required: false, synonyms: ['properties', 'props', 'metadata', 'json', 'data'] },
    { key: 'annotations', label: '批注 (annotations)', required: false, synonyms: ['annotations', 'comments', 'notes', 'remarks'] },
  ];

  const LINK_FIELDS = [
    { key: 'id', label: 'ID 标识符 (id)', required: true, synonyms: ['id', 'link_id', 'key', 'uuid'] },
    { key: 'link_type_id', label: '关系类型ID (link_type_id)', required: true, synonyms: ['link_type_id', 'type_id', 'type', 'relation_type'] },
    { key: 'source_object_id', label: '起点对象ID (source_object_id)', required: true, synonyms: ['source_object_id', 'source_id', 'source', 'from_id', 'from'] },
    { key: 'target_object_id', label: '终点对象ID (target_object_id)', required: true, synonyms: ['target_object_id', 'target_id', 'target', 'to_id', 'to'] },
    { key: 'weight', label: '权重 (weight)', required: false, synonyms: ['weight', 'score', 'strength', 'value'] },
  ];

  const getMappingProgress = (tableKey: 'objectFields' | 'linkFields', fields: typeof OBJECT_FIELDS) => {
    const currentFields = state.mapping[tableKey] || {};
    const requiredFields = fields.filter(f => f.required);
    const mappedRequired = requiredFields.filter(f => currentFields[f.key]);
    const totalMapped = fields.filter(f => currentFields[f.key]).length;

    return {
      percentage: Math.round((mappedRequired.length / requiredFields.length) * 100),
      isComplete: mappedRequired.length === requiredFields.length,
      totalMapped,
      totalCount: fields.length,
    };
  };

  const autoMatchColumns = async (tableKey: 'objectFields' | 'linkFields', tableName: string, fields: typeof OBJECT_FIELDS) => {
    if (!tableName) return;
    const cols = tableCols[tableName] || [];
    if (cols.length === 0) return;

    const newMappings: Record<string, string> = { ...(state.mapping[tableKey] || {}) };
    fields.forEach(f => {
      const matchedCol = cols.find(col => {
        const cLower = col.toLowerCase();
        return f.synonyms.some(syn => cLower === syn.toLowerCase() || cLower.includes(syn.toLowerCase()));
      });
      if (matchedCol) {
        newMappings[f.key] = matchedCol;
      }
    });

    dispatch({
      type: 'UPDATE_MAPPING',
      mapping: {
        [tableKey]: newMappings,
      },
    });
  };

  const objProgress = getMappingProgress('objectFields', OBJECT_FIELDS);
  const linkProgress = getMappingProgress('linkFields', LINK_FIELDS);

  return (
    <div className="space-y-5 p-4 bg-monokai-bg text-monokai-fg-muted">
      {/* ── 1. Top Header ── */}
      <div className="flex items-center justify-between pb-3 border-b border-monokai-border">
        <h3 className="text-xs font-bold text-monokai-fg uppercase tracking-wider flex items-center gap-2">
          <Database className="w-4 h-4 text-monokai-cyan" />
          <span>数据物理映射中心</span>
        </h3>
        <div className="flex items-center gap-1">
          <IconButton
            icon={UploadCloud}
            label="数据导入桥接"
            size="sm"
            tone={showImporter ? 'primary' : 'neutral'}
            onClick={() => setShowImporter(!showImporter)}
          />
          <IconButton
            icon={RefreshCw}
            label="刷新数据表"
            size="sm"
            onClick={refreshTables}
            className={loading ? 'animate-spin' : ''}
          />
        </div>
      </div>

      {/* ── 2. Universal Importer Drawer ── */}
      {showImporter && (
        <div className="p-4 bg-monokai-surface border border-monokai-border rounded-xl animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between mb-3 text-xs uppercase font-bold tracking-wider text-monokai-cyan">
            <span>Data Bridge 通用数据导入</span>
            <span className="text-monokai-comment font-normal normal-case">CSV, Excel, JSON</span>
          </div>
          <UniversalImporter
            onImportSuccess={(tbl) => {
              refreshTables();
              if (tbl.includes('node') || tbl.includes('object')) updateMapping('objectTable', tbl);
              if (tbl.includes('link') || tbl.includes('edge')) updateMapping('linkTable', tbl);
            }}
          />
        </div>
      )}

      {/* ── 3. DuckDB Physical Table Reverse Section (方案 A 核心) ── */}
      <div className="p-3.5 bg-monokai-surface rounded-xl border border-monokai-border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-monokai-yellow" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              DuckDB 物理表逆向中心
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-monokai-comment font-mono">
              {physicalTables.length} 张物理表
            </span>
            {physicalTables.length > 0 && (
              <button
                type="button"
                disabled={isReversingAll || reversingTable !== null}
                onClick={handleReverseAllTables}
                className="px-2 py-0.5 text-[11px] font-semibold text-monokai-yellow bg-monokai-yellow/15 border border-monokai-yellow/30 rounded-lg hover:bg-monokai-yellow/25 disabled:opacity-50 transition-all cursor-pointer flex items-center gap-1"
                title="一键将所有物理表及推断外键关系批量注入图谱"
              >
                {isReversingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                <span>全库一键逆向</span>
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-monokai-comment leading-relaxed">
          直接探测 DuckDB Catalog 中的物理业务表，解析主键、字段与外键线索，1-Click 映射注入为知识实体。
        </p>

        {reverseSuccess && (
          <div className="p-2.5 rounded-lg bg-monokai-accent/15 border border-emerald-800 text-monokai-accent text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-monokai-accent shrink-0" />
            <span>{reverseSuccess}</span>
          </div>
        )}

        {physicalTables.length === 0 ? (
          <div className="p-3 bg-monokai-bg rounded-lg text-center text-xs text-monokai-comment">
            未检测到用户物理表。可通过数据导入器或 SQL 编辑器导入业务表。
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
            {physicalTables.map(tbl => (
              <div
                key={tbl}
                className="p-2.5 bg-monokai-bg rounded-lg border border-monokai-border hover:border-monokai-border transition-colors space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                    <Table2 className="w-4 h-4 text-monokai-cyan shrink-0" />
                    <span className="text-xs font-medium text-monokai-fg truncate" title={tbl}>
                      {tbl}
                    </span>
                    {tableCols[tbl] && (
                      <span className="text-[10px] text-monokai-comment/80 font-mono shrink-0">
                        ({tableCols[tbl].length} 列)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleTogglePreview(tbl)}
                      title={previewTable === tbl ? "关闭样本预览" : "预览前3行样本数据"}
                      className={`p-1 rounded-md border transition-colors cursor-pointer ${
                        previewTable === tbl 
                          ? 'bg-monokai-cyan/20 border-monokai-cyan/40 text-monokai-cyan' 
                          : 'bg-monokai-surface border-monokai-border text-monokai-comment hover:text-white'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={reversingTable === tbl || isReversingAll}
                      onClick={() => handleReverseTable(tbl)}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-monokai-accent bg-monokai-accent/15 border border-monokai-accent/30 rounded-lg hover:bg-monokai-accent/25 disabled:opacity-50 transition-all cursor-pointer shrink-0"
                    >
                      {reversingTable === tbl ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>逆向中...</span>
                        </>
                      ) : (
                        <>
                          <ArrowRight className="w-3.5 h-3.5" />
                          <span>逆向为实体</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Table Sample Data Preview Box */}
                {previewTable === tbl && (
                  <div className="mt-2 p-2.5 bg-monokai-surface rounded-lg border border-monokai-cyan/30 text-[11px] space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between text-monokai-comment">
                      <span className="font-mono text-monokai-cyan font-bold">「{tbl}」字段结构与样本数据:</span>
                      <button onClick={() => setPreviewTable(null)} className="text-monokai-comment hover:text-white cursor-pointer px-1">×</button>
                    </div>
                    {loadingPreview ? (
                      <div className="py-3 flex items-center justify-center gap-2 text-monokai-comment text-xs">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-monokai-cyan" />
                        <span>加载样本中...</span>
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-w-full custom-scrollbar">
                        <table className="w-full text-left font-mono text-[10px] border-collapse">
                          <thead>
                            <tr className="border-b border-monokai-border text-monokai-comment">
                              {previewCols.map((c: any) => (
                                <th key={c.name} className="py-1 px-1.5 whitespace-nowrap">{c.name} <span className="opacity-50 text-[9px]">({c.type})</span></th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {previewRows.map((row, rIdx) => (
                              <tr key={rIdx} className="border-b border-white/5 hover:bg-white/5">
                                {previewCols.map((c: any) => (
                                  <td key={c.name} className="py-1 px-1.5 whitespace-nowrap text-monokai-fg/80">{String(row[c.name] ?? '')}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 4. Mapping Configurations ── */}
      <div className="space-y-4">
        {/* Objects Table Mapping */}
        <div className="space-y-2.5 p-3.5 bg-monokai-surface rounded-xl border border-monokai-border">
          <div className="flex items-center justify-between">
            <label className="text-xs text-monokai-fg-muted font-bold uppercase flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-monokai-accent" />
              <span>实体对象表 (Objects Table)</span>
            </label>
            {state.mapping.objectTable && (
              <button
                onClick={() => toggleExpand('objectTable')}
                className="text-xs text-monokai-comment hover:text-monokai-fg flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>{expandedMapping.objectTable ? '收起列映射' : '高级列映射'}</span>
                {expandedMapping.objectTable ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <select
              value={state.mapping.objectTable}
              onChange={(e) => updateMapping('objectTable', e.target.value)}
              className="flex-1 bg-monokai-bg border border-monokai-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-monokai-accent transition-colors"
            >
              <option value="">-- 选择绑定物理表 --</option>
              {tables.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {state.mapping.objectTable && (
              <button
                onClick={() => autoMatchColumns('objectFields', state.mapping.objectTable, OBJECT_FIELDS)}
                title="智能推荐并绑定列"
                className="px-3 py-1.5 text-xs text-monokai-accent bg-monokai-accent/15 border border-monokai-accent/30 rounded-lg hover:bg-monokai-accent/25 transition-all font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-monokai-accent" />
                <span>智能绑定</span>
              </button>
            )}
          </div>

          {state.mapping.objectTable && (
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-monokai-comment">配置进度: {objProgress.totalMapped}/{objProgress.totalCount} 列</span>
              <Badge variant={objProgress.isComplete ? 'success' : 'warning'} size="sm">
                {objProgress.isComplete ? '✓ 必需列已就绪' : '⚠️ 缺少必需列'}
              </Badge>
            </div>
          )}

          {expandedMapping.objectTable && state.mapping.objectTable && (
            <div className="pt-3 mt-2 border-t border-monokai-border space-y-2.5 animate-in slide-in-from-top-1">
              <p className="text-xs text-monokai-comment">指定物理列以映射到实体模型：</p>
              {OBJECT_FIELDS.map(f => {
                const cols = tableCols[state.mapping.objectTable] || [];
                const mappedVal = state.mapping.objectFields?.[f.key] || '';
                return (
                  <div key={f.key} className="grid grid-cols-5 items-center gap-2">
                    <span className="col-span-2 text-xs text-monokai-fg-muted truncate" title={f.label}>
                      {f.label} {f.required && <span className="text-monokai-yellow">*</span>}
                    </span>
                    <select
                      value={mappedVal}
                      onChange={(e) => updateColumnMapping('objectFields', f.key, e.target.value)}
                      className="col-span-3 bg-monokai-bg border border-monokai-border rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-monokai-accent transition-colors"
                    >
                      <option value="">-- 默认 --</option>
                      {cols.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Links Table Mapping */}
        <div className="space-y-2.5 p-3.5 bg-monokai-surface rounded-xl border border-monokai-border">
          <div className="flex items-center justify-between">
            <label className="text-xs text-monokai-fg-muted font-bold uppercase flex items-center gap-1.5">
              <Link2 className="w-4 h-4 text-monokai-yellow" />
              <span>实体关系表 (Links Table)</span>
            </label>
            {state.mapping.linkTable && (
              <button
                onClick={() => toggleExpand('linkTable')}
                className="text-xs text-monokai-comment hover:text-monokai-fg flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>{expandedMapping.linkTable ? '收起列映射' : '高级列映射'}</span>
                {expandedMapping.linkTable ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <select
              value={state.mapping.linkTable}
              onChange={(e) => updateMapping('linkTable', e.target.value)}
              className="flex-1 bg-monokai-bg border border-monokai-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-monokai-accent transition-colors"
            >
              <option value="">-- 选择绑定关系表 --</option>
              {tables.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {state.mapping.linkTable && (
              <button
                onClick={() => autoMatchColumns('linkFields', state.mapping.linkTable, LINK_FIELDS)}
                title="智能推荐并绑定列"
                className="px-3 py-1.5 text-xs text-monokai-accent bg-monokai-accent/15 border border-monokai-accent/30 rounded-lg hover:bg-monokai-accent/25 transition-all font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-monokai-accent" />
                <span>智能绑定</span>
              </button>
            )}
          </div>

          {state.mapping.linkTable && (
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-monokai-comment">配置进度: {linkProgress.totalMapped}/{linkProgress.totalCount} 列</span>
              <Badge variant={linkProgress.isComplete ? 'success' : 'warning'} size="sm">
                {linkProgress.isComplete ? '✓ 必需列已就绪' : '⚠️ 缺少必需列'}
              </Badge>
            </div>
          )}

          {expandedMapping.linkTable && state.mapping.linkTable && (
            <div className="pt-3 mt-2 border-t border-monokai-border space-y-2.5 animate-in slide-in-from-top-1">
              <p className="text-xs text-monokai-comment">指定物理列以映射到关系模型：</p>
              {LINK_FIELDS.map(f => {
                const cols = tableCols[state.mapping.linkTable] || [];
                const mappedVal = state.mapping.linkFields?.[f.key] || '';
                return (
                  <div key={f.key} className="grid grid-cols-5 items-center gap-2">
                    <span className="col-span-2 text-xs text-monokai-fg-muted truncate" title={f.label}>
                      {f.label} {f.required && <span className="text-monokai-yellow">*</span>}
                    </span>
                    <select
                      value={mappedVal}
                      onChange={(e) => updateColumnMapping('linkFields', f.key, e.target.value)}
                      className="col-span-3 bg-monokai-bg border border-monokai-border rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-monokai-accent transition-colors"
                    >
                      <option value="">-- 默认 --</option>
                      {cols.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── 5. Apply & Reload Button ── */}
      <div className="pt-2">
        <ActionButton
          variant="primary"
          size="lg"
          icon={Check}
          onClick={() => loadData()}
          disabled={!objProgress.isComplete || (Boolean(state.mapping.linkTable) && !linkProgress.isComplete)}
          className="w-full"
        >
          应用映射并重载图谱
        </ActionButton>
      </div>
    </div>
  );
};