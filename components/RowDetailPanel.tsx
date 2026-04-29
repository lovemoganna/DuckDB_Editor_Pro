/**
 * RowDetailPanel - Row Detail Modal
 * 
 * Self-contained modal for viewing full row data with navigation.
 * Extracted from App.tsx (formerly lines 697-738).
 * 
 * NOTE: The original code referenced an undefined `expandedRow` variable.
 * This component derives it correctly from `expandedRowIdx` + `tableData`.
 */

import React from 'react';

interface RowDetailPanelProps {
  isOpen: boolean;
  expandedRowIdx: number | null;
  tableData: any[];
  onClose: () => void;
  onNavigatePrev: () => void;
  onNavigateNext: () => void;
}

export const RowDetailPanel: React.FC<RowDetailPanelProps> = ({
  isOpen,
  expandedRowIdx,
  tableData,
  onClose,
  onNavigatePrev,
  onNavigateNext,
}) => {
  if (!isOpen || expandedRowIdx === null) return null;

  const row = tableData[expandedRowIdx];
  const total = tableData.length;
  const isFirst = expandedRowIdx === 0;
  const isLast = expandedRowIdx === total - 1;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-md animate-[fadeIn_0.2s]"
      onClick={onClose}
    >
      <div
        className="bg-monokai-bg border border-monokai-accent p-6 rounded shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col relative animate-[slideIn_0.2s_ease-out]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4 border-b border-monokai-accent pb-2">
          <h2 className="text-xl font-bold text-monokai-blue font-mono">Row Details</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-monokai-comment font-mono mr-2">Row {expandedRowIdx + 1}</span>
            <button
              onClick={onNavigatePrev}
              disabled={isFirst}
              className="px-2 py-1 bg-monokai-surface hover:bg-monokai-comment text-monokai-fg rounded disabled:opacity-30 text-xs"
            >
              ◀
            </button>
            <button
              onClick={onNavigateNext}
              disabled={isLast}
              className="px-2 py-1 bg-monokai-surface hover:bg-monokai-comment text-monokai-fg rounded disabled:opacity-30 text-xs"
            >
              ▶
            </button>
            <button onClick={onClose} className="ml-4 text-monokai-pink hover:text-monokai-orange text-lg font-bold">
              ✕
            </button>
          </div>
        </div>

        {/* Row Data */}
        <div className="overflow-auto flex-1 font-mono text-sm">
          <table className="w-full">
            <tbody>
              {Object.entries(row).map(([key, val]) => (
                <tr key={key} className="border-b border-monokai-accent/30 hover:bg-monokai-surface/50">
                  <td className="p-3 text-monokai-comment w-1/3 align-top font-bold select-none">{key}</td>
                  <td className="p-3 text-monokai-fg break-all whitespace-pre-wrap selection:bg-monokai-pink selection:text-white">
                    {typeof val === 'object' && val !== null ? JSON.stringify(val, null, 2) : String(val)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
