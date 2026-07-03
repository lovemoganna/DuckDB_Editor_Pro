import React, { useState, useEffect } from 'react';
import { QueryHistoryItem } from '../types';
import { Clock, CheckCircle2, XCircle, Search, Trash2 } from 'lucide-react';

const HISTORY_KEY = 'duckdb_sql_history';

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

function fmtMs(ms: number): string {
  if (ms === 0) return '0ms';
  if (ms < 1) return '<1ms';
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function loadHistory(): QueryHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 200) : [];
  } catch { return []; }
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

export const HistoryTab: React.FC = () => {
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [filter, setFilter] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const filtered = filter.trim()
    ? history.filter(h => h.sql.toLowerCase().includes(filter.toLowerCase()))
    : history;

  const handleCopy = (sql: string, id: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(sql);
    } else {
      const ta = document.createElement('textarea');
      ta.value = sql;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleClear = () => {
    if (confirm('Clear all query history?')) {
      clearHistory();
      setHistory([]);
    }
  };

  return (
    <div className="h-full flex flex-col bg-monokai-bg">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-monokai-accent shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-monokai-blue/15 border border-monokai-blue/30 flex items-center justify-center">
              <Clock size={16} className="text-monokai-blue" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-monokai-fg leading-none">Query History</h2>
              <p className="text-[10px] text-monokai-comment mt-0.5">{history.length} queries in session</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <label htmlFor="history-filter" className="sr-only">Filter SQL</label>
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-monokai-comment pointer-events-none" />
              <input
                id="history-filter"
                type="text"
                placeholder="Filter..."
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="pl-7 pr-3 py-1.5 bg-monokai-surface border border-monokai-accent text-[11px] text-monokai-fg rounded outline-none focus:border-monokai-blue w-36 font-mono focus-ring transition-colors"
              />
            </div>
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold text-monokai-pink border border-monokai-pink/30 rounded hover:bg-monokai-pink/10 transition-colors"
            >
              <Trash2 size={11} /> Clear
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-monokai-comment">
            <Clock size={40} className="mb-3 opacity-20" />
            <p className="text-sm">{filter ? 'No matching queries' : 'No query history yet'}</p>
            <p className="text-[11px] opacity-50 mt-1">{filter ? 'Try a different filter' : 'Run SQL to see history here'}</p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="group relative flex items-center gap-4 px-4 py-3 rounded-lg border border-monokai-accent/40 hover:border-monokai-accent/70 bg-monokai-surface/40 hover:bg-monokai-surface/70 transition-all cursor-pointer"
                onClick={() => handleCopy(item.sql, item.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCopy(item.sql, item.id); } }}
                tabIndex={0}
                role="button"
                aria-label={`Copy SQL: ${item.sql}`}
                title="Click to copy SQL"
              >
                {/* Status indicator */}
                <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${item.status === 'success' ? 'bg-monokai-green/20 border border-monokai-green/40' : 'bg-monokai-pink/20 border border-monokai-pink/40'}`}>
                  {item.status === 'success'
                    ? <CheckCircle2 size={12} className="text-monokai-green" />
                    : <XCircle size={12} className="text-monokai-pink" />
                  }
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <pre className="text-[12px] text-monokai-fg/90 font-mono truncate leading-snug">
                    {item.sql}
                  </pre>
                </div>

                {/* Meta: time + duration */}
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <span className="text-[10px] text-monokai-comment/70 font-mono whitespace-nowrap">{timeAgo(item.timestamp)}</span>
                  <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${item.status === 'success' ? 'text-monokai-green bg-monokai-green/10' : 'text-monokai-pink bg-monokai-pink/10'}`}>
                    {item.status === 'success' ? fmtMs(item.executionTime ?? 0) : 'ERR'}
                  </span>
                </div>

                {/* Copy hint on hover */}
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-monokai-bg/90 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <span className="text-[11px] text-monokai-blue font-bold flex items-center gap-1.5">
                    <Search size={12} className="opacity-70" /> Click to copy
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-2 border-t border-monokai-accent shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-monokai-comment/50">{filtered.length} of {history.length} records</span>
          {copiedId && <span className="text-[10px] text-monokai-green font-bold animate-success-flash">Copied to clipboard</span>}
        </div>
      </div>
    </div>
  );
};

export default HistoryTab;
