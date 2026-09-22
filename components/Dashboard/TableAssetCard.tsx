import React, { useState, useRef, useEffect } from 'react';
import { Table2, MoreHorizontal, AlertCircle, Terminal, Eye, Download, Trash2, CheckCircle, AlertTriangle } from 'lucide-react';
import { TableMeta } from '../../hooks/useTableMeta';

interface TableAssetCardProps {
  meta: TableMeta;
  onPeekTable: (name: string) => void;
  onNavigateToData: (name: string) => void;
  onNavigateToSql: (name: string) => void;
  onExportTable: (name: string) => void;
  onDropTable: (name: string) => void;
}

const TYPE_COLORS: Record<string, string> = {
  INTEGER: 'bg-monokai-cyan',
  BIGINT: 'bg-monokai-cyan',
  SMALLINT: 'bg-monokai-cyan',
  VARCHAR: 'bg-monokai-green',
  TEXT: 'bg-monokai-green',
  DOUBLE: 'bg-monokai-orange',
  FLOAT: 'bg-monokai-orange',
  DECIMAL: 'bg-monokai-orange',
  DATE: 'bg-monokai-yellow',
  TIMESTAMP: 'bg-monokai-yellow',
  BOOLEAN: 'bg-monokai-amethyst',
};

const getTypeColor = (type: string) => {
  const upperType = type.toUpperCase().split('(')[0];
  return TYPE_COLORS[upperType] || 'bg-monokai-comment';
};

export const TableAssetCard: React.FC<TableAssetCardProps> = ({
  meta,
  onPeekTable,
  onNavigateToData,
  onNavigateToSql,
  onExportTable,
  onDropTable,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  if (meta.error) {
    return (
      <div className="rounded-xl border border-monokai-border bg-monokai-surface/60 p-4 group flex flex-col gap-2 shadow-sm text-monokai-pink">
        <div className="flex items-center gap-2">
          <Table2 className="w-4 h-4 text-monokai-pink" />
          <span className="font-mono font-bold text-xs truncate text-monokai-pink">{meta.name}</span>
        </div>
        <div className="flex items-start gap-2 text-monokai-pink text-xs mt-1">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="break-all font-mono">{meta.error}</span>
        </div>
      </div>
    );
  }

  // Calculate type distribution for the bar
  const totalCols = meta.columnCount || meta.columns.length || 0;
  const typeEntries = Object.entries(meta.typeDistribution).sort((a, b) => b[1] - a[1]);

  return (
    <div 
      className="rounded-xl border border-monokai-border bg-monokai-surface/40 hover:border-monokai-border-strong hover:bg-monokai-surface/70 hover:shadow-lg hover:shadow-black/20 transition-all duration-200 group flex flex-col space-y-3 p-4 select-none"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '0 220px' } as any}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between relative">
        {/* 表名跳转使用语义化 button 并补充 focus-visible 键盘焦点支持 */}
        <button
          type="button"
          onClick={() => onNavigateToData(meta.name)}
          title={`浏览数据表 ${meta.name}`}
          aria-label={`浏览数据表 ${meta.name}`}
          className="flex items-center gap-2 overflow-hidden text-left cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-border-strong rounded-md group/title"
        >
          <div className="p-1 rounded-md bg-monokai-bg border border-monokai-border group-hover/title:border-monokai-border-strong transition-colors">
            <Table2 className="w-3.5 h-3.5 text-monokai-comment shrink-0 group-hover/title:text-monokai-fg transition-colors" />
          </div>
          <span className="font-mono font-bold text-xs truncate text-monokai-fg group-hover/title:text-monokai-fg transition-colors">{meta.name}</span>
        </button>
        
        <div className="relative shrink-0" ref={menuRef}>
          {/* 更多菜单补充 aria-expanded 与 aria-haspopup 属性 */}
          <button 
            type="button"
            aria-expanded={showMenu}
            aria-haspopup="true"
            className="p-1.5 hover:bg-monokai-elevated rounded-lg text-monokai-comment hover:text-monokai-fg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-border-strong transition-colors cursor-pointer"
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            aria-label={`数据表 ${meta.name} 操作菜单`}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          
          {showMenu && (
            <div className="absolute right-0 top-full mt-1.5 w-36 bg-monokai-surface/95 backdrop-blur-md border border-monokai-border-strong rounded-xl shadow-2xl z-20 py-1.5 animate-in fade-in zoom-in-95 duration-100 font-sans">
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 text-xs text-monokai-fg hover:bg-monokai-elevated focus-visible:outline-none focus-visible:bg-monokai-elevated cursor-pointer transition-colors flex items-center gap-2"
                onClick={() => { setShowMenu(false); onPeekTable(meta.name); }}
              >
                <Eye className="w-3.5 h-3.5 text-monokai-comment" />
                <span>预览数据</span>
              </button>
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 text-xs text-monokai-fg hover:bg-monokai-elevated focus-visible:outline-none focus-visible:bg-monokai-elevated cursor-pointer transition-colors flex items-center gap-2"
                onClick={() => { setShowMenu(false); onNavigateToSql(meta.name); }}
              >
                <Terminal className="w-3.5 h-3.5 text-monokai-comment" />
                <span>SQL 查询</span>
              </button>
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 text-xs text-monokai-fg hover:bg-monokai-elevated focus-visible:outline-none focus-visible:bg-monokai-elevated cursor-pointer transition-colors flex items-center gap-2"
                onClick={() => { setShowMenu(false); onExportTable(meta.name); }}
              >
                <Download className="w-3.5 h-3.5 text-monokai-comment" />
                <span>导出数据</span>
              </button>
              <div className="my-1 border-t border-monokai-border"></div>
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 text-xs text-monokai-pink hover:bg-monokai-pink/10 focus-visible:outline-none focus-visible:bg-monokai-pink/10 cursor-pointer transition-colors flex items-center gap-2"
                onClick={() => { setShowMenu(false); onDropTable(meta.name); }}
              >
                <Trash2 className="w-3.5 h-3.5 text-monokai-pink" />
                <span>删除表</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div>
        {meta.loading ? (
          <div className="animate-pulse bg-monokai-surface h-3 w-32 rounded"></div>
        ) : (
          <div className="font-mono text-meta text-monokai-comment">
            <span className="text-monokai-fg font-semibold">{meta.rowCount?.toLocaleString() ?? '--'}</span> 行 · <span className="text-monokai-fg font-semibold">{meta.columnCount ?? '--'}</span> 列 · <span>{meta.sizeEstimate ?? '--'}</span>
          </div>
        )}
      </div>

      {/* Type distribution bar */}
      <div className="flex flex-col gap-1.5">
        {meta.loading ? (
          <div className="animate-pulse bg-monokai-surface h-1.5 rounded-full w-full"></div>
        ) : (
          <>
            <div className="flex h-1.5 rounded-full overflow-hidden w-full bg-monokai-surface">
              {typeEntries.map(([type, count]) => {
                const width = totalCols > 0 ? (count / totalCols) * 100 : 0;
                return (
                  <div 
                    key={type} 
                    className={getTypeColor(type)} 
                    style={{ width: `${width}%` }}
                    title={`${type}: ${count}`}
                  ></div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-x-2 gap-y-1 font-mono text-2xs text-monokai-comment">
              {typeEntries.slice(0, 3).map(([type, count]) => (
                <span key={type} className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${getTypeColor(type)}`}></span>
                  {type}({count})
                </span>
              ))}
              {typeEntries.length > 3 && <span>...</span>}
            </div>
          </>
        )}
      </div>

      {/* Data quality row */}
      <div>
        {meta.loading ? (
          <div className="animate-pulse bg-monokai-surface h-3 w-24 rounded"></div>
        ) : (
          <div className="flex items-center gap-2 text-2xs">
            {meta.nullRate !== null && (
              <span className="text-monokai-comment font-mono">
                NULL 率: <span className={meta.nullRate > 0.05 ? 'text-monokai-yellow font-bold' : 'text-monokai-fg'}>{(meta.nullRate * 100).toFixed(1)}%</span>
              </span>
            )}
            {meta.highNullColumns.length > 0 && (
              <span className="flex items-center gap-1 text-monokai-yellow bg-monokai-surface border border-monokai-border/80 px-1.5 py-0.5 rounded-md font-mono" title={meta.highNullColumns.join(', ')}>
                <AlertTriangle className="w-3 h-3" />
                {meta.highNullColumns.length}列高NULL
              </span>
            )}
            {meta.nullRate !== null && meta.nullRate < 0.01 && meta.highNullColumns.length === 0 && (
              <span className="flex items-center gap-1 text-monokai-green bg-monokai-surface border border-monokai-border/80 px-1.5 py-0.5 rounded-md font-mono">
                <CheckCircle className="w-3 h-3" />
                数据完整度优秀
              </span>
            )}
          </div>
        )}
      </div>

      {/* FK relations row */}
      {!meta.loading && meta.foreignKeys && meta.foreignKeys.length > 0 && (
        <div className="font-mono text-2xs text-monokai-comment truncate" title={meta.foreignKeys.map(fk => `${fk.fromCol} → ${fk.toTable}(${fk.toCol})`).join(', ')}>
          FK → {meta.foreignKeys.slice(0, 2).map(fk => `${fk.toTable}(${fk.toCol})`).join(', ')}
          {meta.foreignKeys.length > 2 && ` (+${meta.foreignKeys.length - 2} more)`}
        </div>
      )}

      {/* Action buttons row */}
      <div className="flex items-center gap-1.5 pt-1 mt-auto">
        <button 
          type="button"
          className="flex items-center justify-center flex-1 gap-1 border border-monokai-border/80 bg-monokai-surface/60 hover:bg-monokai-hover hover:border-monokai-border-strong rounded-lg px-2 py-1.5 text-meta font-mono text-monokai-comment hover:text-monokai-fg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-border-strong transition-all cursor-pointer active:scale-[0.98]"
          onClick={() => onNavigateToSql(meta.name)}
          title="SQL 查询"
          aria-label={`SQL 查询表 ${meta.name}`}
        >
          <Terminal className="w-3 h-3 text-monokai-comment" /> 查询
        </button>
        <button 
          type="button"
          className="flex items-center justify-center flex-1 gap-1 border border-monokai-border/80 bg-monokai-surface/60 hover:bg-monokai-hover hover:border-monokai-border-strong rounded-lg px-2 py-1.5 text-meta font-mono text-monokai-comment hover:text-monokai-fg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-border-strong transition-all cursor-pointer active:scale-[0.98]"
          onClick={() => onPeekTable(meta.name)}
          title="预览数据"
          aria-label={`预览数据表 ${meta.name}`}
        >
          <Eye className="w-3 h-3 text-monokai-comment" /> 预览
        </button>
        <button 
          type="button"
          className="flex items-center justify-center flex-1 gap-1 border border-monokai-border/80 bg-monokai-surface/60 hover:bg-monokai-hover hover:border-monokai-border-strong rounded-lg px-2 py-1.5 text-meta font-mono text-monokai-comment hover:text-monokai-fg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-border-strong transition-all cursor-pointer active:scale-[0.98]"
          onClick={() => onExportTable(meta.name)}
          title="导出数据"
          aria-label={`导出数据表 ${meta.name}`}
        >
          <Download className="w-3 h-3 text-monokai-comment" /> 导出
        </button>
        <button 
          type="button"
          className="flex items-center justify-center flex-1 gap-1 border border-monokai-border/80 bg-monokai-surface/60 hover:bg-monokai-pink/10 hover:border-monokai-border-strong rounded-lg px-2 py-1.5 text-meta font-mono text-monokai-comment hover:text-monokai-pink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-border-strong transition-all cursor-pointer active:scale-[0.98]"
          onClick={() => onDropTable(meta.name)}
          title="删除表"
          aria-label={`删除数据表 ${meta.name}`}
        >
          <Trash2 className="w-3 h-3 text-monokai-pink" /> 删除
        </button>
      </div>
    </div>
  );
};
