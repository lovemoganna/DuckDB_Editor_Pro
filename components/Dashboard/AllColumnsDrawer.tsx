import React, { useState, useMemo } from 'react';
import { Key, Copy, Check, Search, X } from 'lucide-react';
import { ActionButton, DrawerShell } from '../ui/Workbench';
import { AssetItem } from './types';
import { toastService } from '../../services/toastService';

interface AllColumnsDrawerProps {
  asset: AssetItem | null;
  onClose: () => void;
}

export const AllColumnsDrawer: React.FC<AllColumnsDrawerProps> = ({ asset, onClose }) => {
  const [copiedCol, setCopiedCol] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  const filteredColumns = useMemo(() => {
    if (!asset) return [];
    if (!searchFilter.trim()) return asset.columns;
    const q = searchFilter.toLowerCase();
    return asset.columns.filter(c => c.name.toLowerCase().includes(q) || c.type.toLowerCase().includes(q));
  }, [asset, searchFilter]);

  const handleCopy = (colName: string) => {
    void navigator.clipboard.writeText(colName);
    setCopiedCol(colName);
    setTimeout(() => setCopiedCol(null), 1500);
    toastService.success(`已复制字段名: ${colName}`);
  };

  const handleCopyAllDDL = () => {
    if (!asset) return;
    const ddl = `CREATE TABLE ${asset.name} (\n  ${asset.columns
      .map(c => `${c.name} ${c.type}${c.pk ? ' PRIMARY KEY' : ''}${!c.nullable ? ' NOT NULL' : ''}`)
      .join(',\n  ')}\n);`;
    void navigator.clipboard.writeText(ddl);
    toastService.success(`已复制完整建表 DDL`);
  };

  return (
    <DrawerShell
      open={!!asset}
      onClose={onClose}
      title={asset ? `${asset.schema}.${asset.name} · 全部字段定义` : '字段定义'}
      description={
        asset
          ? `共 ${asset.columns.length} 个字段 · ${asset.hasPrimaryKey ? '包含主键' : '无主键'}`
          : undefined
      }
      side="right"
      size="lg"
      headerActions={
        <ActionButton variant="secondary" size="sm" icon={Copy} onClick={handleCopyAllDDL}>
          复制 DDL
        </ActionButton>
      }
      contentClassName="!p-0"
      className="bg-monokai-bg"
    >
      {asset && (
        <>
          <div className="px-4 py-2.5 border-b border-monokai-border/80 bg-monokai-sidebar/50">
            <div className="flex items-center h-8 px-2.5 rounded-lg bg-monokai-surface border border-monokai-border focus-within:border-monokai-accent focus-within:ring-1 focus-within:ring-monokai-accent/40 transition-all">
              <Search className="w-3.5 h-3.5 text-monokai-comment shrink-0" />
              <input
                type="text"
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                placeholder="快速过滤字段名称或类型…"
                className="w-full h-full bg-transparent px-2 text-xs text-monokai-fg outline-none placeholder:text-monokai-comment/60 font-mono"
              />
              {searchFilter && (
                <button
                  type="button"
                  onClick={() => setSearchFilter('')}
                  className="text-monokai-comment hover:text-monokai-fg p-0.5 cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monokai-accent/70"
                  aria-label="清空过滤"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-monokai-bg">
            <div className="overflow-hidden rounded-lg bg-monokai-surface/40 border border-monokai-border shadow-sm">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-monokai-border bg-monokai-sidebar text-monokai-comment text-xs">
                    <th className="py-2.5 px-3.5 w-10 text-center font-semibold">#</th>
                    <th className="py-2.5 px-3.5 font-semibold">字段名称</th>
                    <th className="py-2.5 px-3.5 font-semibold">数据类型</th>
                    <th className="py-2.5 px-3.5 font-semibold">NULL</th>
                    <th className="py-2.5 px-3.5 font-semibold">默认值</th>
                    <th className="py-2.5 px-3.5 w-12 text-right font-semibold">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-monokai-border/60 bg-monokai-bg/60">
                  {filteredColumns.map(col => (
                    <tr key={col.name} className="hover:bg-monokai-surface/60 transition-colors group">
                      <td className="py-2 px-3.5 text-center text-monokai-comment text-xs font-mono">
                        {col.idx}
                      </td>
                      <td className="py-2 px-3.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {col.pk && (
                            <span className="flex items-center gap-0.5 rounded-md bg-monokai-surface border border-monokai-border px-1.5 py-0.5 text-2xs font-bold text-monokai-fg shrink-0">
                              <Key className="h-2.5 w-2.5" />
                              PK
                            </span>
                          )}
                          <span className="font-bold text-monokai-fg truncate">{col.name}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3.5">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-monokai-surface border border-monokai-border text-monokai-cyan text-meta font-mono">
                          {col.type}
                        </span>
                      </td>
                      <td className="py-2 px-3.5 text-xs">
                        {col.nullable ? (
                          <span className="text-monokai-comment">可空</span>
                        ) : (
                          <span className="text-monokai-orange font-semibold">NOT NULL</span>
                        )}
                      </td>
                      <td className="py-2 px-3.5 text-monokai-comment text-xs truncate max-w-[100px]">
                        {col.defaultValue ?? '—'}
                      </td>
                      <td className="py-2 px-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleCopy(col.name)}
                          className="p-1 rounded-md text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monokai-accent/70"
                          title="复制列名"
                          aria-label={`复制 ${col.name}`}
                        >
                          {copiedCol === col.name ? (
                            <Check className="h-3.5 w-3.5 text-monokai-green" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </DrawerShell>
  );
};
