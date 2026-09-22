import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { toastService } from '../services/toastService';
import { formatCellValue } from '../utils/typeFormatter';

interface VirtualTableProps {
  columns: string[];
  columnTypes?: string[];
  columnTypeMap?: Record<string, string>;
  rows: any[];
  arrowTable?: any; // Native Apache Arrow Table (if available) for zero-copy column access
  height?: string | number;
  columnWidth?: number;
  sortCol?: string | null;
  sortDir?: 'asc' | 'desc';
  onSort?: (col: string) => void;
}

export const VirtualTable: React.FC<VirtualTableProps> = ({
  columns,
  columnTypes,
  columnTypeMap,
  rows,
  arrowTable,
  height = '100%',
  columnWidth = 180,
  sortCol,
  sortDir = 'asc',
  onSort,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);

  // 1. Vertical Row Virtualizer
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 29,
    overscan: 10,
  });

  // 2. Horizontal Column Virtualizer (P0: Dual Virtualization for Wide Tables)
  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: columns.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => columnWidth,
    overscan: 5,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualColumns = columnVirtualizer.getVirtualItems();

  const totalHeight = rowVirtualizer.getTotalSize();
  const totalWidth = columnVirtualizer.getTotalSize();

  React.useEffect(() => {
    return () => {
      if (parentRef.current) {
        parentRef.current.scrollTop = 0;
      }
    };
  }, [rows]);

  // Helper to extract value with Zero-Copy Arrow fallback
  const getCellValue = (rowIndex: number, colName: string, colIndex: number) => {
    if (arrowTable && typeof arrowTable.getChild === 'function') {
      try {
        const columnVector = arrowTable.getChild(colName) || arrowTable.getChildAt(colIndex);
        if (columnVector && typeof columnVector.get === 'function') {
          return columnVector.get(rowIndex);
        }
      } catch (e) {
        // Fallback to rows object if Arrow indexing fails
      }
    }
    const r = rows ? rows[rowIndex] : null;
    return r ? r[colName] : null;
  };

  return (
    <div
      ref={parentRef}
      className="overflow-auto w-full relative custom-scrollbar"
      style={{ height }}
    >
      <div
        style={{
          height: `${totalHeight + 42}px`,
          width: `${totalWidth}px`,
          position: 'relative',
        }}
      >
        {/* Sticky Header with Column Virtualization & Sorting */}
        <div
          className="bg-monokai-surface sticky top-0 z-20 shadow-sm flex font-mono text-xs border-b border-monokai-border/40"
          style={{
            height: '42px',
            width: `${totalWidth}px`,
          }}
        >
          {virtualColumns.map(virtualCol => {
            const colName = columns[virtualCol.index];
            const colType = columnTypeMap?.[colName] || columnTypes?.[virtualCol.index];
            const isSorted = sortCol === colName;
            return (
              <div
                key={virtualCol.key}
                onClick={() => onSort?.(colName)}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: `${virtualCol.start}px`,
                  width: `${virtualCol.size}px`,
                  height: '42px',
                  resize: 'horizontal',
                  overflow: 'hidden',
                }}
                className="px-2.5 py-1 text-monokai-cyan font-semibold select-none hover:bg-monokai-sidebar/70 transition-colors truncate flex items-center justify-between cursor-pointer group"
                title={`点击按 ${colName} 排序 (类型: ${colType || 'UNKNOWN'})`}
              >
                <div className="flex flex-col min-w-0 justify-center leading-tight">
                  <span className="truncate text-white font-medium">{colName}</span>
                  {colType && (
                    <span className="text-[10px] text-monokai-comment font-normal tracking-wide uppercase">
                      {colType}
                    </span>
                  )}
                </div>
                {isSorted ? (
                  sortDir === 'asc' ? (
                    <ArrowUp size={11} className="text-monokai-yellow shrink-0 ml-1" />
                  ) : (
                    <ArrowDown size={11} className="text-monokai-yellow shrink-0 ml-1" />
                  )
                ) : (
                  <span className="opacity-0 group-hover:opacity-40 text-[10px] text-monokai-comment ml-1">▲</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Dual-Virtualization Rows Body */}
        {virtualRows.map(virtualRow => {
          const rowIndex = virtualRow.index;

          return (
            <div
              key={virtualRow.key}
              data-index={rowIndex}
              ref={rowVirtualizer.measureElement}
              style={{
                position: 'absolute',
                top: `${virtualRow.start + 42}px`,
                left: 0,
                width: `${totalWidth}px`,
                height: `${virtualRow.size}px`,
              }}
              className="flex font-mono text-xs border-b border-monokai-border/20 hover:bg-monokai-surface/60 even:bg-monokai-surface/20 transition-colors"
            >
              {virtualColumns.map(virtualCol => {
                const colName = columns[virtualCol.index];
                const colType = columnTypeMap?.[colName] || columnTypes?.[virtualCol.index];
                const rawVal = getCellValue(rowIndex, colName, virtualCol.index);
                const isNull = rawVal === null || rawVal === undefined;
                const formattedDisplay = formatCellValue(rawVal, colType);
                const rawStr = isNull ? '' : (typeof rawVal === 'bigint' ? rawVal.toString() : String(rawVal));

                return (
                  <div
                    key={virtualCol.key}
                    style={{
                      position: 'absolute',
                      left: `${virtualCol.start}px`,
                      width: `${virtualCol.size}px`,
                      height: '100%',
                    }}
                    onClick={() => {
                      if (!isNull) {
                        navigator.clipboard.writeText(rawStr);
                        toastService.info(`已复制原始值: "${rawStr.slice(0, 30)}${rawStr.length > 30 ? '...' : ''}"`);
                      }
                    }}
                    className="p-2 text-monokai-fg truncate flex items-center hover:bg-monokai-surface/80 cursor-pointer active:bg-monokai-green/20 transition-colors"
                    title={isNull ? 'NULL' : `${formattedDisplay}\n(原始值: ${rawStr}，点击复制)`}
                  >
                    {isNull ? (
                      <span className="text-monokai-comment/60 italic font-sans text-[11px]">NULL</span>
                    ) : (
                      formattedDisplay
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VirtualTable;
