import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

interface VirtualTableProps {
  columns: string[];
  rows: any[];
  height?: string | number;
}

export const VirtualTable: React.FC<VirtualTableProps> = ({
  columns,
  rows,
  height = '100%',
}) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 29, // Average row height including borders
    overscan: 15,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom = virtualItems.length > 0
    ? totalSize - virtualItems[virtualItems.length - 1].end
    : 0;

  return (
    <div
      ref={parentRef}
      className="overflow-auto w-full custom-scrollbar"
      style={{ height }}
    >
      <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
        <thead className="bg-monokai-surface sticky top-0 z-10 shadow-md">
          <tr>
            {columns.map(c => (
              <th
                key={c}
                className="p-2 font-mono text-xs text-monokai-blue border-b border-r border-monokai-accent/50 last:border-r-0 select-none hover:bg-monokai-accent/20 transition-colors"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="font-mono text-xs">
          {paddingTop > 0 && (
            <tr>
              <td style={{ height: `${paddingTop}px` }} colSpan={columns.length} />
            </tr>
          )}
          {virtualItems.map(virtualRow => {
            const r = rows[virtualRow.index];
            if (!r) return null;

            return (
              <tr
                key={virtualRow.index}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                className="border-b border-monokai-accent/20 hover:bg-monokai-accent/30 transition-colors even:bg-white/5"
              >
                {columns.map(c => (
                  <td
                    key={c}
                    className="p-2 text-monokai-fg border-r border-monokai-accent/20 last:border-r-0 max-w-[300px] truncate"
                    title={String(r[c] ?? '')}
                  >
                    {r[c] === null ? (
                      <span className="text-monokai-comment italic">NULL</span>
                    ) : (
                      String(r[c])
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
          {paddingBottom > 0 && (
            <tr>
              <td style={{ height: `${paddingBottom}px` }} colSpan={columns.length} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default VirtualTable;
