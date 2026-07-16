import React, { useState, useEffect } from 'react';
import { Database, Table2, Link2, Check, RefreshCw, Layers, UploadCloud, ChevronRight, ChevronDown } from 'lucide-react';
import { duckDBService } from '../../services/duckdbService';
import { useOntologyStore } from '../../hooks/useOntologyStore';
import { UniversalImporter } from './UniversalImporter';

export const MappingConsole: React.FC = () => {
  const { state, dispatch, loadData } = useOntologyStore();
  const [tables, setTables] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [tableCols, setTableCols] = useState<Record<string, string[]>>({});
  const [expandedMapping, setExpandedMapping] = useState<Record<string, boolean>>({
    objectTable: false,
    linkTable: false,
  });

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

  const [showImporter, setShowImporter] = useState(false);

  const updateMapping = (key: string, value: any) => {
    dispatch({ type: 'UPDATE_MAPPING', mapping: { [key]: value } });
  };

  const updateColumnMapping = (tableKey: 'objectFields' | 'linkFields', fieldKey: string, value: string) => {
    const currentFields = state.mapping[tableKey] || {};
    dispatch({
      type: 'UPDATE_MAPPING',
      mapping: {
        [tableKey]: { ...currentFields, [fieldKey]: value }
      }
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

  // Helper to calculate mapping progress
  const getMappingProgress = (tableKey: 'objectFields' | 'linkFields', fields: typeof OBJECT_FIELDS) => {
    const currentFields = state.mapping[tableKey] || {};
    const requiredFields = fields.filter(f => f.required);
    const mappedRequired = requiredFields.filter(f => currentFields[f.key]);
    const totalMapped = fields.filter(f => currentFields[f.key]).length;
    
    return {
      percentage: Math.round((mappedRequired.length / requiredFields.length) * 100),
      isComplete: mappedRequired.length === requiredFields.length,
      totalMapped,
      totalCount: fields.length
    };
  };

  const autoMatchColumns = async (tableKey: 'objectFields' | 'linkFields', tableName: string, fields: typeof OBJECT_FIELDS) => {
    if (!tableName) return;
    const cols = tableCols[tableName] || [];
    if (cols.length === 0) return;

    const newMappings: Record<string, string> = { ...(state.mapping[tableKey] || {}) };
    fields.forEach(f => {
      // Find matching column by checking exact match or synonym match
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
        [tableKey]: newMappings
      }
    });
  };

  const objProgress = getMappingProgress('objectFields', OBJECT_FIELDS);
  const linkProgress = getMappingProgress('linkFields', LINK_FIELDS);

  return (
    <div className="space-y-6 p-4 bg-black/20 rounded-xl border border-monokai-accent/10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold text-monokai-cyan uppercase tracking-widest flex items-center gap-2">
          <Database className="w-3 h-3" />
          Mapping Console 映射中心
        </h3>
        <div className="flex items-center gap-2">
           <button onClick={() => setShowImporter(!showImporter)} className={`p-1.5 rounded-md hover:bg-monokai-cyan/10 transition-colors ${showImporter ? 'text-monokai-cyan bg-monokai-cyan/10' : 'text-monokai-comment'}`} title="Toggle Importer">
             <UploadCloud className="w-4 h-4" />
           </button>
           <button onClick={refreshTables} className={`p-1.5 rounded-md hover:bg-monokai-cyan/10 transition-colors text-monokai-comment ${loading ? 'animate-spin' : ''}`} title="Refresh Tables">
             <RefreshCw className="w-4 h-4" />
           </button>
        </div>
      </div>

      {showImporter && (
        <div className="mb-6 p-4 bg-monokai-cyan/5 border border-monokai-cyan/20 rounded-xl animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between mb-3 text-[11px] uppercase font-black tracking-widest text-monokai-cyan">
             <span>Data Bridge 通用导入器</span>
             <span className="text-monokai-comment font-normal normal-case italic">Excel, CSV, JSON...</span>
          </div>
          <UniversalImporter onImportSuccess={(tbl) => {
             refreshTables();
             if (tbl.includes('node') || tbl.includes('object')) updateMapping('objectTable', tbl);
             if (tbl.includes('link') || tbl.includes('edge')) updateMapping('linkTable', tbl);
          }} />
        </div>
      )}

      <div className="space-y-5">
        {/* Objects Table */}
        <div className="space-y-2 p-3 bg-monokai-sidebar/20 rounded-lg border border-monokai-accent/5">
          <div className="flex items-center justify-between">
            <label className="text-xs text-monokai-comment font-bold uppercase flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-monokai-amethyst" />
              对象表 (Objects Table)
            </label>
            {state.mapping.objectTable && (
              <button
                onClick={() => toggleExpand('objectTable')}
                className="text-[11px] text-monokai-cyan hover:underline flex items-center gap-0.5"
              >
                {expandedMapping.objectTable ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                高级列映射
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <select
              value={state.mapping.objectTable}
              onChange={(e) => updateMapping('objectTable', e.target.value)}
              className="flex-1 bg-monokai-sidebar/50 border border-monokai-accent/20 rounded-md px-3 py-2 text-xs text-monokai-fg outline-none focus:border-monokai-cyan transition-colors"
            >
              <option value="">-- 选择表 --</option>
              {tables.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {state.mapping.objectTable && (
              <button
                onClick={() => autoMatchColumns('objectFields', state.mapping.objectTable, OBJECT_FIELDS)}
                title="智能推荐并绑定列"
                className="px-2 py-1 text-[11px] text-monokai-amethyst bg-monokai-amethyst/10 border border-monokai-amethyst/30 rounded-md hover:bg-monokai-amethyst/20 transition-all font-bold"
              >
                🪄 智能绑定
              </button>
            )}
          </div>

          {state.mapping.objectTable && (
            <div className="mt-1 flex items-center justify-between text-[10px]">
              <span className="text-monokai-comment">配置度: {objProgress.totalMapped}/{objProgress.totalCount} 列</span>
              <span className={`px-1.5 py-0.5 rounded font-bold ${objProgress.isComplete ? 'bg-monokai-green/10 text-monokai-green' : 'bg-monokai-yellow/10 text-monokai-yellow'}`}>
                {objProgress.isComplete ? '✓ 必需列绑定完整' : '⚠️ 缺少必需列'}
              </span>
            </div>
          )}

          {expandedMapping.objectTable && state.mapping.objectTable && (
            <div className="pt-2.5 mt-2.5 border-t border-monokai-accent/5 space-y-2.5 animate-in slide-in-from-top-1 duration-200">
              <p className="text-[11px] text-monokai-comment italic">指定数据源的物理列以映射到 Ontology 核心对象模型：</p>
              {OBJECT_FIELDS.map(f => {
                const cols = tableCols[state.mapping.objectTable] || [];
                const mappedVal = state.mapping.objectFields?.[f.key] || '';
                return (
                  <div key={f.key} className="grid grid-cols-5 items-center gap-2">
                    <span className="col-span-2 text-[11px] text-monokai-fg/80 truncate" title={f.label}>
                      {f.label} {f.required && <span className="text-monokai-red">*</span>}
                    </span>
                    <select
                      value={mappedVal}
                      onChange={(e) => updateColumnMapping('objectFields', f.key, e.target.value)}
                      className="col-span-3 bg-monokai-bg/60 border border-monokai-accent/15 rounded px-2 py-1 text-xs text-monokai-fg outline-none focus:border-monokai-cyan"
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

        {/* Links Table */}
        <div className="space-y-2 p-3 bg-monokai-sidebar/20 rounded-lg border border-monokai-accent/5">
          <div className="flex items-center justify-between">
            <label className="text-xs text-monokai-comment font-bold uppercase flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-monokai-yellow" />
              关系表 (Links Table)
            </label>
            {state.mapping.linkTable && (
              <button
                onClick={() => toggleExpand('linkTable')}
                className="text-[11px] text-monokai-cyan hover:underline flex items-center gap-0.5"
              >
                {expandedMapping.linkTable ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                高级列映射
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <select
              value={state.mapping.linkTable}
              onChange={(e) => updateMapping('linkTable', e.target.value)}
              className="flex-1 bg-monokai-sidebar/50 border border-monokai-accent/20 rounded-md px-3 py-2 text-xs text-monokai-fg outline-none focus:border-monokai-cyan transition-colors"
            >
              <option value="">-- 选择表 --</option>
              {tables.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {state.mapping.linkTable && (
              <button
                onClick={() => autoMatchColumns('linkFields', state.mapping.linkTable, LINK_FIELDS)}
                title="智能推荐并绑定列"
                className="px-2 py-1 text-[11px] text-monokai-amethyst bg-monokai-amethyst/10 border border-monokai-amethyst/30 rounded-md hover:bg-monokai-amethyst/20 transition-all font-bold"
              >
                🪄 智能绑定
              </button>
            )}
          </div>

          {state.mapping.linkTable && (
            <div className="mt-1 flex items-center justify-between text-[10px]">
              <span className="text-monokai-comment">配置度: {linkProgress.totalMapped}/{linkProgress.totalCount} 列</span>
              <span className={`px-1.5 py-0.5 rounded font-bold ${linkProgress.isComplete ? 'bg-monokai-green/10 text-monokai-green' : 'bg-monokai-yellow/10 text-monokai-yellow'}`}>
                {linkProgress.isComplete ? '✓ 必需列绑定完整' : '⚠️ 缺少必需列'}
              </span>
            </div>
          )}

          {expandedMapping.linkTable && state.mapping.linkTable && (
            <div className="pt-2.5 mt-2.5 border-t border-monokai-accent/5 space-y-2.5 animate-in slide-in-from-top-1 duration-200">
              <p className="text-[11px] text-monokai-comment italic">指定数据源的物理列以映射到 Ontology 关系模型：</p>
              {LINK_FIELDS.map(f => {
                const cols = tableCols[state.mapping.linkTable] || [];
                const mappedVal = state.mapping.linkFields?.[f.key] || '';
                return (
                  <div key={f.key} className="grid grid-cols-5 items-center gap-2">
                    <span className="col-span-2 text-[11px] text-monokai-fg/80 truncate" title={f.label}>
                      {f.label} {f.required && <span className="text-monokai-red">*</span>}
                    </span>
                    <select
                      value={mappedVal}
                      onChange={(e) => updateColumnMapping('linkFields', f.key, e.target.value)}
                      className="col-span-3 bg-monokai-bg/60 border border-monokai-accent/15 rounded px-2 py-1 text-xs text-monokai-fg outline-none focus:border-monokai-cyan"
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

        {/* Other default tables */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: '对象类型表', key: 'objectTypeTable' },
            { label: '关系类型表', key: 'linkTypeTable' },
          ].map((item) => (
            <div key={item.key} className="space-y-1">
              <label className="text-[11px] text-monokai-comment font-bold uppercase">{item.label}</label>
              <select
                value={state.mapping[item.key as keyof typeof state.mapping] as string}
                onChange={(e) => updateMapping(item.key, e.target.value)}
                className="w-full bg-monokai-sidebar/40 border border-monokai-accent/15 rounded px-2.5 py-1.5 text-xs text-monokai-fg outline-none focus:border-monokai-cyan transition-colors"
              >
                <option value="">-- 选择表 --</option>
                {tables.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-monokai-accent/10">
        <button 
          onClick={() => loadData()}
          disabled={!objProgress.isComplete || (state.mapping.linkTable && !linkProgress.isComplete)}
          className="w-full py-2.5 bg-monokai-cyan/10 hover:bg-monokai-cyan/20 text-monokai-cyan text-xs font-bold rounded-lg border border-monokai-cyan/30 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Check className="w-3 h-3" />
          应用映射并重载 Apply & Reload
        </button>
      </div>

      <div className="p-3 bg-monokai-bg/40 rounded-lg border border-monokai-accent/5">
        <p className="text-[11px] text-monokai-comment leading-normal italic">
          提示：若导入的临时表列名不匹配，可使用 🪄智能绑定 或展开高级列映射手动指定。
        </p>
      </div>
    </div>
  );
};
