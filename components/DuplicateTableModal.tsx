/**
 * DuplicateTableModal - Duplicate Table Dialog
 * 
 * Self-contained modal for duplicating an existing DuckDB table.
 * Extracted from App.tsx (formerly lines 795-807 + handleDuplicateTable handler).
 */

import React, { useState } from 'react';
import { duckDBService } from '../services/duckdbService';

interface DuplicateTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceTable: string | null;
  onTableCreated: (tableName: string) => void;
  onRefreshTables: () => Promise<void>;
  onNotify: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const DuplicateTableModal: React.FC<DuplicateTableModalProps> = ({
  isOpen,
  onClose,
  sourceTable,
  onTableCreated,
  onRefreshTables,
  onNotify,
}) => {
  const [targetName, setTargetName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDuplicate = async () => {
    if (!sourceTable || !targetName.trim()) return;
    setLoading(true);
    try {
      const sql = `CREATE TABLE "${targetName.trim()}" AS SELECT * FROM "${sourceTable}"`;
      await duckDBService.executeAndAudit(sql, 'CREATE', targetName.trim(), `Duplicated from ${sourceTable}`);
      onNotify(`Table "${targetName.trim()}" duplicated successfully`, 'success');
      await onRefreshTables();
      onTableCreated(targetName.trim());
      onClose();
      setTargetName('');
    } catch (e: any) {
      onNotify(e.message || 'Failed to duplicate table', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-md animate-[fadeIn_0.2s]"
      onClick={onClose}
    >
      <div
        className="bg-monokai-bg border border-monokai-accent p-6 rounded shadow-2xl w-full max-w-md animate-[slideIn_0.2s_ease-out]"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-4 text-monokai-blue">Duplicate Table</h2>
        <p className="text-sm text-monokai-comment mb-2">
          Source: <span className="text-monokai-fg font-mono">{sourceTable}</span>
        </p>
        <input
          type="text"
          value={targetName}
          onChange={e => setTargetName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !loading && handleDuplicate()}
          placeholder="New Table Name"
          autoFocus
          className="w-full bg-monokai-surface border border-monokai-accent p-2 rounded mb-6 text-monokai-fg focus:border-monokai-blue outline-none"
        />
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded text-sm text-monokai-fg hover:bg-monokai-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDuplicate}
            disabled={loading || !targetName.trim()}
            className="px-4 py-2 bg-monokai-blue text-monokai-bg font-bold rounded text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Duplicating...' : 'Duplicate'}
          </button>
        </div>
      </div>
    </div>
  );
};
