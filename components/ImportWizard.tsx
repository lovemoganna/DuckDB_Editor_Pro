/**
 * ImportWizard - Multi-step data import wizard
 * 
 * Supports three import modes: local file, URL, or clipboard paste.
 * Extracted from App.tsx (formerly lines 997-1092 + handlers).
 */

import React, { useState } from 'react';
import { duckDBService } from '../services/duckdbService';
import { ImportOptions } from '../types';

interface ImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
  onRefreshTables: () => Promise<void>;
  onNotify: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const ImportWizard: React.FC<ImportWizardProps> = ({
  isOpen,
  onClose,
  onImportComplete,
  onRefreshTables,
  onNotify,
}) => {
  const [mode, setMode] = useState<'local' | 'url' | 'paste'>('local');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [tableName, setTableName] = useState('');
  const [options, setOptions] = useState<ImportOptions>({
    header: true,
    delimiter: ',',
    quote: '"',
    dateFormat: '%Y-%m-%d',
  });
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setMode('local');
    setFile(null);
    setUrl('');
    setText('');
    setTableName('');
    setOptions({ header: true, delimiter: ',', quote: '"', dateFormat: '%Y-%m-%d' });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      if (!tableName) {
        const name = selected.name.split('.')[0].replace(/[^a-zA-Z0-9_]/g, '_');
        setTableName(name);
      }
    }
  };

  const applyPreset = (name: string, presetUrl: string) => {
    setMode('url');
    setUrl(presetUrl);
    setTableName(name);
  };

  const handleImport = async () => {
    if (!tableName.trim()) return;
    setLoading(true);
    try {
      if (mode === 'local') {
        if (!file) return;
        await duckDBService.importFile(file, tableName.trim(), options);
        onNotify(`Imported ${file.name} as ${tableName.trim()}`, 'success');
      } else if (mode === 'paste') {
        if (!text) return;
        await duckDBService.importText(text, tableName.trim());
        onNotify(`Imported from clipboard as ${tableName.trim()}`, 'success');
      } else {
        if (!url) return;
        const isParquet = url.endsWith('.parquet');
        const sql = isParquet
          ? `CREATE TABLE "${tableName.trim()}" AS SELECT * FROM read_parquet('${url}')`
          : `CREATE TABLE "${tableName.trim()}" AS SELECT * FROM read_csv_auto('${url}')`;
        await duckDBService.executeAndAudit(sql, 'IMPORT', tableName.trim(), `Imported from URL: ${url}`);
        onNotify(`Imported from URL as ${tableName.trim()}`, 'success');
      }
      await onRefreshTables();
      onImportComplete();
      onClose();
      reset();
    } catch (e: any) {
      const msg = e.message.includes('HTTP')
        ? `CORS Error: The server hosting the file must allow cross-origin requests. (${e.message})`
        : `Import failed: ${e.message}`;
      onNotify(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    reset();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-md animate-[fadeIn_0.2s]"
      onClick={handleClose}
    >
      <div
        className="bg-monokai-bg border border-monokai-accent p-5 rounded-lg shadow-2xl w-full max-w-lg animate-[slideIn_0.2s_ease-out] flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-3 text-monokai-fg flex items-center gap-2">
          <span>📥</span> Import Wizard
        </h2>

        {/* Mode Tabs */}
        <div className="flex mb-4 border-b border-monokai-accent shrink-0">
          {[
            { id: 'local', label: 'Local File', icon: '📁', color: 'orange' },
            { id: 'url', label: 'From URL', icon: '🔗', color: 'blue' },
            { id: 'paste', label: 'Paste Text', icon: '📋', color: 'green' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setMode(tab.id as 'local' | 'url' | 'paste')}
              className={`flex-1 py-2 text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
                mode === tab.id
                  ? `text-monokai-${tab.color} border-b-2 border-monokai-${tab.color} bg-monokai-accent/20`
                  : 'text-monokai-comment hover:text-monokai-fg'
              }`}
            >
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Table Name */}
          <div className="mb-3">
            <label className="block text-xs text-monokai-comment mb-1">📋 Target Table Name</label>
            <input
              value={tableName}
              onChange={e => setTableName(e.target.value)}
              className="w-full bg-monokai-surface border border-monokai-accent p-2 rounded text-sm text-monokai-fg focus:border-monokai-orange outline-none"
              placeholder="e.g., my_table"
            />
          </div>

          {/* URL Mode */}
          {mode === 'url' && (
            <div className="mb-3">
              {!url && (
                <div className="mb-3">
                  <label className="block text-xs text-monokai-comment mb-2">🚀 Quick Presets (Public Data)</label>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => applyPreset('titanic', 'https://raw.githubusercontent.com/datasciencedojo/datasets/master/titanic.csv')}
                      className="px-2 py-1 text-xs bg-monokai-accent rounded hover:bg-monokai-blue hover:text-monokai-bg transition-colors"
                    >
                      🚢 Titanic
                    </button>
                    <button
                      onClick={() => applyPreset('iris', 'https://raw.githubusercontent.com/mwaskom/seaborn-data/master/iris.csv')}
                      className="px-2 py-1 text-xs bg-monokai-accent rounded hover:bg-monokai-green hover:text-monokai-bg transition-colors"
                    >
                      🌸 Iris
                    </button>
                    <button
                      onClick={() => applyPreset('tips', 'https://raw.githubusercontent.com/mwaskom/seaborn-data/master/tips.csv')}
                      className="px-2 py-1 text-xs bg-monokai-accent rounded hover:bg-monokai-yellow hover:text-monokai-bg transition-colors"
                    >
                      💰 Tips
                    </button>
                  </div>
                </div>
              )}
              <label className="block text-xs text-monokai-comment mb-1">🔗 File URL (CSV/Parquet)</label>
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://raw.githubusercontent.com/..."
                className="w-full bg-monokai-surface border border-monokai-accent p-2 rounded text-sm text-monokai-fg focus:border-monokai-blue outline-none"
              />
              <div className="text-[10px] text-monokai-comment mt-1">
                Note: Server must support CORS (Cross-Origin Resource Sharing).
              </div>
            </div>
          )}

          {/* Local File Mode */}
          {mode === 'local' && (
            <div className="mb-3">
              <label className="block w-full py-6 px-4 border-2 border-dashed border-monokai-accent rounded text-center cursor-pointer hover:border-monokai-orange hover:bg-monokai-accent/20 transition-all">
                <div className="text-xl mb-2 text-monokai-comment">📄</div>
                <div className="text-sm font-bold text-monokai-fg">
                  {file ? file.name : 'Click to select a file'}
                </div>
                <div className="text-xs text-monokai-comment mt-1">Supports CSV, JSON, Parquet</div>
                <input type="file" className="hidden" onChange={handleFileSelect} accept=".csv,.json,.parquet,.txt" />
              </label>
            </div>
          )}

          {/* Paste Mode */}
          {mode === 'paste' && (
            <div className="mb-3 h-40">
              <label className="block text-xs text-monokai-comment mb-1">📝 Paste CSV/TSV Data</label>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                className="w-full h-full bg-monokai-surface border border-monokai-accent p-2 rounded text-xs font-mono text-monokai-fg outline-none resize-none focus:border-monokai-green"
                placeholder={`id,name,value\n1,Alice,100\n2,Bob,200`}
              />
            </div>
          )}

          {/* CSV Options */}
          {((mode === 'local' && (file?.name.endsWith('.csv') || file?.name.endsWith('.txt'))) || mode === 'paste') && (
            <div className="grid grid-cols-2 gap-3 mb-2 p-3 bg-monokai-surface border border-monokai-accent rounded">
              <div className="col-span-2 text-xs font-bold text-monokai-blue uppercase tracking-wider mb-1">
                ⚙️ CSV Options (Auto-detected if empty)
              </div>
              <label className="flex items-center gap-2 cursor-pointer col-span-2">
                <input
                  type="checkbox"
                  checked={options.header}
                  onChange={e => setOptions({ ...options, header: e.target.checked })}
                />
                <span className="text-sm text-monokai-fg">File has Header</span>
              </label>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-3 pt-3 border-t border-monokai-accent">
          <button
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-1.5 rounded text-xs text-monokai-fg hover:bg-monokai-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={loading || !tableName.trim()}
            className="px-4 py-1.5 bg-monokai-green text-monokai-bg font-bold rounded text-xs hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Importing...' : 'Import Data'}
          </button>
        </div>
      </div>
    </div>
  );
};
