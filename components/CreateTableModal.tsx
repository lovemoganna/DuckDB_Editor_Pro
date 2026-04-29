/**
 * CreateTableModal - Create New Table Dialog
 * 
 * Self-contained modal for creating a new DuckDB table.
 * Extracted from App.tsx (formerly lines 780-791 + handleCreateTable handler).
 */

import React, { useState } from 'react';
import { duckDBService } from '../services/duckdbService';

interface CreateTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTableCreated: (tableName: string) => void;
  onRefreshTables: () => Promise<void>;
  onNotify: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const CreateTableModal: React.FC<CreateTableModalProps> = ({
  isOpen,
  onClose,
  onTableCreated,
  onRefreshTables,
  onNotify,
}) => {
  const [tableName, setTableName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!tableName.trim()) return;
    setLoading(true);
    try {
      await duckDBService.createTable(tableName.trim(), [
        { name: 'id', type: 'INTEGER', pk: true },
      ]);
      onNotify(`Table "${tableName}" created`, 'success');
      await onRefreshTables();
      onTableCreated(tableName.trim());
      onClose();
      setTableName('');
    } catch (e: any) {
      onNotify(e.message || 'Failed to create table', 'error');
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
        <h2 className="text-xl font-bold mb-4 text-monokai-green">Create New Table</h2>
        <input
          type="text"
          value={tableName}
          onChange={e => setTableName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !loading && handleCreate()}
          placeholder="Table Name"
          autoFocus
          className="w-full bg-monokai-surface border border-monokai-accent p-2 rounded mb-4 text-monokai-fg focus:border-monokai-green outline-none"
        />
        <div className="text-xs text-monokai-comment mb-6">
          Creates a table with a default <code>id INTEGER PRIMARY KEY</code> column.
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded text-sm text-monokai-fg hover:bg-monokai-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading || !tableName.trim()}
            className="px-4 py-2 bg-monokai-green text-monokai-bg font-bold rounded text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
};
