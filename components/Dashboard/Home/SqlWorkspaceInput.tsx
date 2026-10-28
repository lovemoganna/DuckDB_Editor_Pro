import React, { useEffect, useState } from 'react';
import { loadSqlSource, reloadSqlWorkspace, type SqlSource } from '../../../services/sqlWorkspaceService';
import { useAppStore } from '../../../hooks/store/useAppStore';
import { useDatabaseAnalysis } from '../../../services/databaseAnalysis';
import { duckDBService } from '../../../services/duckdbService';

export function SqlWorkspaceInput() {
  const database = useAppStore(state => state.currentDatabase);
  const model = useDatabaseAnalysis(state => state.model), modelError = useDatabaseAnalysis(state => state.error);
  const [source, setSource] = useState<SqlSource | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const load = () => { void loadSqlSource(database).then(value => { if (active) setSource(value); }).catch(err => { if (active) setError(String(err.message)); }); };
    setSource(null); load(); window.addEventListener('duckdb-sql-source-updated', load);
    return () => { active = false; window.removeEventListener('duckdb-sql-source-updated', load); };
  }, [database]);
  const run = async (action: () => Promise<SqlSource>) => { setBusy(true); setError(''); try { setSource(await action()); } catch (err) { setError(String((err as Error).message)); } finally { setBusy(false); } };
  const download = () => {
    if (!source) return;
    const url = URL.createObjectURL(new Blob([source.content], { type: 'application/sql' }));
    const link = document.createElement('a'); link.href = url; link.download = source.name; link.click(); URL.revokeObjectURL(url);
  };
  return <section className="rounded-lg border border-monokai-border bg-monokai-surface p-3 space-y-2">
    <div className="flex flex-wrap justify-between gap-3 items-center">
      <div><h2 className="font-semibold text-xs">SQL 来源</h2>{!source && <p className="text-xs text-monokai-comment mt-1">上传数据库 SQL，自动识别结构并生成可复用的指标、图表与分析。</p>}</div>

    </div>
    <div className="flex flex-wrap gap-3 text-xs text-monokai-comment">
      {source ? <><span>{source.name} · 版本 {source.version} · {new Date(source.savedAt).toLocaleString()}</span><button disabled={busy} className="text-monokai-cyan" onClick={() => void run(() => reloadSqlWorkspace(database))}>从保存的 SQL 重载</button><button onClick={download} className="text-monokai-cyan">下载 SQL 副本</button></> : <span>当前数据来自已连接数据库。</span>}
      {model && <span>{model.tableCount} 张表 · {model.tables.reduce((count, table) => count + table.columnCount, 0)} 个字段 · {model.drillPaths.filter(path => path.hierarchyType === 'relational').length} 个声明或推断的关联</span>}
    </div>
    {source && <details className="text-xs text-monokai-comment"><summary>数据更新与持久化说明</summary><p className="mt-2 leading-relaxed">同名 SQL 重载会原子重建该文件声明的表；编排与分析定义保留。加载修改后的文件后，下游自动重算。</p></details>}
    {busy && <p role="status" aria-live="polite" className="text-xs text-monokai-cyan">正在载入 SQL 并刷新分析，请稍候…</p>}
    {duckDBService.getRuntimeInfo().storageMode !== 'opfs' && <p className="text-xs text-monokai-yellow">当前数据库使用内存模式；原始 SQL 文件保存到本地浏览器。数据库持久化状态请以顶部状态为准。</p>}
    {(error || modelError) && <p role="alert" className="text-xs text-monokai-pink">{error || modelError}</p>}
  </section>;
}
