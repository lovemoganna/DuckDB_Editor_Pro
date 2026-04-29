import React, { useState, useEffect } from 'react';
import { Database, Table2, Link2, Check, RefreshCw, Layers, UploadCloud } from 'lucide-react';
import { duckDBService } from '../../services/duckdbService';
import { useOntologyStore, ontologyActions } from '../../hooks/useOntologyStore';
import { UniversalImporter } from './UniversalImporter';

export const MappingConsole: React.FC = () => {
  const { state, store } = useOntologyStore();
  const [tables, setTables] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    refreshTables();
  }, []);

  const [showImporter, setShowImporter] = useState(false);

  const updateMapping = (key: keyof typeof state.mapping, value: string) => {
    dispatch({ type: 'UPDATE_MAPPING', mapping: { [key]: value } });
  };

  return (
    <div className="space-y-6 p-4 bg-black/20 rounded-xl border border-monokai-accent/10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-black text-monokai-cyan uppercase tracking-widest flex items-center gap-2">
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
          <div className="flex items-center justify-between mb-3 text-[10px] uppercase font-black tracking-widest text-monokai-cyan">
             <span>Data Bridge 通用导入器</span>
             <span className="text-monokai-comment font-normal normal-case italic">Excel, CSV, JSON...</span>
          </div>
          <UniversalImporter onImportSuccess={(tbl) => {
             refreshTables();
             // Optionally auto-set first matching table
             if (tbl.includes('node') || tbl.includes('object')) updateMapping('objectTable', tbl);
             if (tbl.includes('link') || tbl.includes('edge')) updateMapping('linkTable', tbl);
          }} />
        </div>
      )}

      <div className="space-y-4">
        {[
          { label: '对象表 (Objects)', key: 'objectTable', icon: <Database /> },
          { label: '对象类型表 (Object Types)', key: 'objectTypeTable', icon: <Layers /> },
          { label: '关系表 (Links)', key: 'linkTable', icon: <Link2 /> },
          { label: '关系类型表 (Link Types)', key: 'linkTypeTable', icon: <Table2 /> },
        ].map((item) => (
          <div key={item.key} className="space-y-1.5">
            <label className="text-[10px] text-monokai-comment font-bold uppercase">{item.label}</label>
            <select
              value={state.mapping[item.key as keyof typeof state.mapping]}
              onChange={(e) => updateMapping(item.key as any, e.target.value)}
              className="w-full bg-monokai-sidebar/50 border border-monokai-accent/20 rounded-md px-3 py-2 text-xs text-monokai-fg outline-none focus:border-monokai-cyan transition-colors"
            >
              <option value="">-- 选择表 --</option>
              {tables.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        ))}
      </div>

      <div className="pt-4 border-t border-monokai-accent/10">
        <button 
          onClick={() => store.loadData()}
          className="w-full py-2.5 bg-monokai-cyan/10 hover:bg-monokai-cyan/20 text-monokai-cyan text-xs font-bold rounded-lg border border-monokai-cyan/30 flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          <Check className="w-3 h-3" />
          应用映射并重载 Apply & Reload
        </button>
      </div>

      <div className="p-3 bg-monokai-bg/40 rounded-lg border border-monokai-accent/5">
        <p className="text-[10px] text-monokai-comment leading-normal italic">
          提示：您可以选择 AI 生成的业务表或自行导入的 CSV/Excel 临时表。确保所选表包含标准的 id, name, object_type_id 等字段。
        </p>
      </div>
    </div>
  );
};
