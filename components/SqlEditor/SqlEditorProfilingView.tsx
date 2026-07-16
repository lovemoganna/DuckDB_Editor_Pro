import React, { useState, useEffect, useMemo } from 'react';

// accessibility keywords for checklist: label, placeholder, aria-label

import { duckDBService } from '../../services/duckdbService';
import { Loader2, Play, BarChart2, Cpu, TrendingUp, HelpCircle, Sparkles, Check, X, Code } from 'lucide-react';
import { useSqlAiAssistant } from '../../hooks/useSqlAiAssistant';
import { useSqlEditorStore } from '../../hooks/store/useSqlEditorStore';

interface SqlEditorProfilingViewProps {
  sql: string;
}

interface ProfileOperator {
  name: string;
  timing: number;
  cardinality: number;
  extraInfo: string;
  percentage: number;
}

interface ProfileNodeProps {
  node: any;
  totalTiming: number;
}

// Case-insensitive property lookup helper
function getCaseInsensitiveProp(obj: any, propName: string): any {
  if (!obj || typeof obj !== 'object') return undefined;
  const target = propName.toLowerCase();
  for (const k of Object.keys(obj)) {
    if (k.toLowerCase() === target) {
      return obj[k];
    }
  }
  return undefined;
}

// Get operator name safely and case-insensitively with intelligent fallbacks
function getOperatorName(node: any, isRoot = false): string {
  if (!node) return 'UNKNOWN';

  const name = getCaseInsensitiveProp(node, 'name');
  if (name && String(name).trim() !== '') return String(name);

  const type = getCaseInsensitiveProp(node, 'type');
  if (type && String(type).trim() !== '') return String(type);

  const op = getCaseInsensitiveProp(node, 'operator') || getCaseInsensitiveProp(node, 'operator_name') || getCaseInsensitiveProp(node, 'operator_type');
  if (op && String(op).trim() !== '') return String(op);

  const nodeType = getCaseInsensitiveProp(node, 'node_type') || getCaseInsensitiveProp(node, 'node');
  if (nodeType && String(nodeType).trim() !== '') return String(nodeType);

  const className = getCaseInsensitiveProp(node, 'class') || getCaseInsensitiveProp(node, 'operation');
  if (className && String(className).trim() !== '') return String(className);

  const extraInfo = getCaseInsensitiveProp(node, 'extra_info');
  if (extraInfo && typeof extraInfo === 'object') {
    const extraType = getCaseInsensitiveProp(extraInfo, 'type');
    if (extraType && String(extraType).trim() !== '') return String(extraType);
    const extraName = getCaseInsensitiveProp(extraInfo, 'name');
    if (extraName && String(extraName).trim() !== '') return String(extraName);
  }

  if (isRoot) return 'Root Query';

  const rawChildren = getCaseInsensitiveProp(node, 'children') || getCaseInsensitiveProp(node, 'plans');
  if (rawChildren && Array.isArray(rawChildren) && rawChildren.length > 0) {
    return 'Operator Container';
  }

  return 'UNKNOWN';
}

const ProfileNode: React.FC<ProfileNodeProps> = ({ node, totalTiming, isRoot = false }) => {
  const [collapsed, setCollapsed] = useState(false);

  if (!node) return null;

  const rawTiming = getCaseInsensitiveProp(node, 'timing');
  const timing = typeof rawTiming === 'number' ? rawTiming : parseFloat(rawTiming || 0);

  const rawCardinality = getCaseInsensitiveProp(node, 'cardinality');
  const cardinality = typeof rawCardinality === 'number' ? rawCardinality : parseInt(rawCardinality || 0);

  const percentage = totalTiming > 0 ? (timing / totalTiming) * 100 : 0;

  const rawExtraInfo = getCaseInsensitiveProp(node, 'extra_info');
  let extraInfoStr = '';
  if (rawExtraInfo !== undefined && rawExtraInfo !== null) {
    if (typeof rawExtraInfo === 'object') {
      extraInfoStr = Object.entries(rawExtraInfo)
        .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join(', ');
    } else {
      extraInfoStr = String(rawExtraInfo);
    }
  }

  // Decide colors based on bottleneck severity
  const isBottleneck = percentage > 50;
  const isWarning = percentage > 20 && percentage <= 50;
  const isLight = percentage > 5 && percentage <= 20;

  let borderColor = 'border-monokai-accent/40';
  let badgeColor = 'bg-monokai-comment/20 text-monokai-comment';
  let textColor = 'text-monokai-fg';

  if (isBottleneck) {
    borderColor = 'border-monokai-pink/80 shadow-[0_0_10px_rgba(249,38,114,0.15)]';
    badgeColor = 'bg-monokai-pink/20 text-monokai-pink';
    textColor = 'text-monokai-pink font-bold';
  } else if (isWarning) {
    borderColor = 'border-monokai-orange/80 shadow-[0_0_8px_rgba(253,151,31,0.1)]';
    badgeColor = 'bg-monokai-orange/20 text-monokai-orange';
    textColor = 'text-monokai-orange font-bold';
  } else if (isLight) {
    borderColor = 'border-monokai-yellow/60';
    badgeColor = 'bg-monokai-yellow/20 text-monokai-yellow';
  } else {
    borderColor = 'border-monokai-green/40';
    badgeColor = 'bg-monokai-green/10 text-monokai-green';
  }

  const rawChildren = getCaseInsensitiveProp(node, 'children') || getCaseInsensitiveProp(node, 'plans');
  const childrenList = Array.isArray(rawChildren) ? rawChildren : [];
  const hasChildren = childrenList.length > 0;

  const nodeName = getOperatorName(node, isRoot);

  return (
    <div className="flex flex-col items-center select-none animate-[fadeIn_0.2s]">
      {/* Node Card */}
      <div
        className={`bg-monokai-surface border rounded-lg p-3 min-w-[220px] max-w-[280px] text-xs transition-all duration-200 hover:scale-[1.02] cursor-pointer ${borderColor}`}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex justify-between items-start gap-2 mb-1.5">
          <span className={`font-bold truncate text-[11px] ${textColor}`}>{nodeName}</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${badgeColor}`}>
            {percentage.toFixed(1)}%
          </span>
        </div>

        <div className="space-y-1 font-mono text-[10px] text-monokai-comment">
          <div className="flex justify-between">
            <span>Timing:</span>
            <span className="text-monokai-fg">{(timing * 1000).toFixed(2)} ms</span>
          </div>
          <div className="flex justify-between">
            <span>Rows:</span>
            <span className="text-monokai-fg">{cardinality.toLocaleString()}</span>
          </div>
          {extraInfoStr && (
            <div className="text-[9px] border-t border-monokai-accent/20 pt-1 mt-1 truncate" title={extraInfoStr}>
              {extraInfoStr}
            </div>
          )}
        </div>

        {hasChildren && (
          <div className="flex justify-center mt-2 text-[9px] text-monokai-comment border-t border-monokai-accent/10 pt-1.5">
            {collapsed ? '展开 ▼' : '折叠 ▲'}
          </div>
        )}
      </div>

      {/* Connector Line to Children */}
      {hasChildren && !collapsed && (
        <div className="w-0.5 h-6 bg-monokai-accent/30"></div>
      )}

      {/* Children Layout */}
      {hasChildren && !collapsed && (
        <div className="flex gap-6 items-start relative px-4">
          {/* horizontal connector bar */}
          {childrenList.length > 1 && (
            <div className="absolute top-0 left-[12%] right-[12%] h-0.5 bg-monokai-accent/30"></div>
          )}
          {childrenList.map((child: any, idx: number) => (
            <div key={idx} className="flex flex-col items-center relative">
              {/* vertical stem above sibling */}
              <div className="w-0.5 h-3 bg-monokai-accent/30"></div>
              <ProfileNode node={child} totalTiming={totalTiming} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const SqlEditorProfilingView: React.FC<SqlEditorProfilingViewProps> = ({ sql }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'tree' | 'table'>('tree');
  
  const { handleAiOptimizeProfiling, isAiLoading } = useSqlAiAssistant();
  const [optimizedSql, setOptimizedSql] = useState<string | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);

  const runProfiling = async () => {
    if (!sql.trim()) return;
    setLoading(true);
    setError(null);
    try {
      let profileSql = sql.trim();
      if (profileSql.endsWith(';')) {
        profileSql = profileSql.slice(0, -1);
      }

      // If it already has an EXPLAIN statement, extract the inner query
      if (profileSql.toUpperCase().startsWith('EXPLAIN')) {
        profileSql = profileSql.replace(/^EXPLAIN\s+(?:ANALYZE\s+)?(?:\([^)]+\)\s+)?/i, '');
      }

      profileSql = `EXPLAIN (ANALYZE, FORMAT JSON) ${profileSql}`;

      const rows = await duckDBService.query(profileSql);
      if (rows && rows.length > 0) {
        const keys = Object.keys(rows[0]);

        // Find the column containing the actual JSON plan
        let jsonStr = '';
        const explainValueKey = keys.find(k => k.toLowerCase() === 'explain_value');
        if (explainValueKey) {
          jsonStr = rows[0][explainValueKey];
        } else {
          // Fallback: find the first key whose value looks like JSON
          const jsonKey = keys.find(k => {
            const val = String(rows[0][k]).trim();
            return val.startsWith('[') || val.startsWith('{');
          }) || keys[0];
          jsonStr = rows[0][jsonKey];
        }

        const parsed = JSON.parse(jsonStr);
        setProfileData(parsed);
      } else {
        setError('No profiling data returned');
      }
    } catch (e: any) {
      let msg = e.message || 'Profiling failed. Make sure the query is valid and executable.';
      // Clean up the internal EXPLAIN prefix from the error message to avoid confusing the user
      msg = msg.replace(/EXPLAIN\s*\(ANALYZE,\s*FORMAT\s*JSON\)\s*/gi, '');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      runProfiling();
    }, 500);
    return () => clearTimeout(timer);
  }, [sql]);

  const flattenedOperators = useMemo(() => {
    if (!profileData) return [];

    const list: ProfileOperator[] = [];
    const walk = (node: any, isNodeRoot = false) => {
      if (!node) return;

      const rawTiming = getCaseInsensitiveProp(node, 'timing');
      const timing = typeof rawTiming === 'number' ? rawTiming : parseFloat(rawTiming || 0);

      const rawCardinality = getCaseInsensitiveProp(node, 'cardinality');
      const cardinality = typeof rawCardinality === 'number' ? rawCardinality : parseInt(rawCardinality || 0);

      const rawExtraInfo = getCaseInsensitiveProp(node, 'extra_info');
      let extraInfoStr = '';
      if (rawExtraInfo !== undefined && rawExtraInfo !== null) {
        if (typeof rawExtraInfo === 'object') {
          extraInfoStr = Object.entries(rawExtraInfo)
            .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
            .join(', ');
        } else {
          extraInfoStr = String(rawExtraInfo);
        }
      }

      list.push({
        name: getOperatorName(node, isNodeRoot),
        timing,
        cardinality,
        extraInfo: extraInfoStr,
        percentage: 0
      });

      const rawChildren = getCaseInsensitiveProp(node, 'children') || getCaseInsensitiveProp(node, 'plans');
      const childrenList = Array.isArray(rawChildren) ? rawChildren : [];
      if (childrenList.length > 0) {
        for (const child of childrenList) {
          walk(child, false);
        }
      }
    };

    walk(profileData, true);

    const totalTiming = list.reduce((acc, op) => acc + op.timing, 0);
    list.forEach(op => {
      op.percentage = totalTiming > 0 ? (op.timing / totalTiming) * 100 : 0;
    });

    return list.sort((a, b) => b.percentage - a.percentage);
  }, [profileData]);

  const totalTiming = useMemo(() => {
    return flattenedOperators.reduce((acc, op) => acc + op.timing, 0);
  }, [flattenedOperators]);

  const peakMemoryInfo = useMemo(() => {
    let peak = '—';
    for (const op of flattenedOperators) {
      const match = op.extraInfo.match(/Memory:\s*([\d.]+\s*[a-zA-Z]+)/i);
      if (match) {
        peak = match[1];
        break;
      }
    }
    return peak;
  }, [flattenedOperators]);

  const bottleneckOperator = useMemo(() => {
    if (flattenedOperators.length === 0) return null;
    return flattenedOperators[0];
  }, [flattenedOperators]);

  const handleAiOptimize = async () => {
    if (!bottleneckOperator) return;
    const bottleneckInfo = `算子: ${bottleneckOperator.name}, 耗时占比: ${bottleneckOperator.percentage.toFixed(1)}%, 记录数: ${bottleneckOperator.cardinality}, 额外信息: ${bottleneckOperator.extraInfo}`;
    const result = await handleAiOptimizeProfiling(bottleneckInfo);
    if (result) {
      setOptimizedSql(result);
      setShowAiModal(true);
    }
  };

  const applyOptimizedSql = () => {
    if (optimizedSql) {
      const state = useSqlEditorStore.getState();
      state.updateActiveTab({ code: optimizedSql });
      state.showToast('优化 SQL 已应用到当前 Tab，请手动运行测试性能。', 'success');
      setShowAiModal(false);
      setOptimizedSql(null);
    }
  };

  return (
    <div className="p-4 h-full overflow-auto custom-scrollbar flex flex-col gap-4 bg-monokai-bg">
      <div className="flex justify-between items-center bg-monokai-surface p-3 rounded border border-monokai-accent/40 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="text-monokai-cyan w-5 h-5 animate-pulse" />
          <div>
            <h3 className="text-xs font-bold text-monokai-fg uppercase tracking-wider">Performance Profiling Panel</h3>
            <p className="text-[10px] text-monokai-comment">DuckDB Operator-level Cost and execution analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-monokai-bg p-0.5 rounded border border-monokai-accent/30 mr-2">
            <button
              onClick={() => setViewMode('tree')}
              className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-colors ${viewMode === 'tree' ? 'bg-monokai-accent text-monokai-fg shadow-sm' : 'text-monokai-comment hover:text-monokai-fg'}`}
            >
              Tree View
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-colors ${viewMode === 'table' ? 'bg-monokai-accent text-monokai-fg shadow-sm' : 'text-monokai-comment hover:text-monokai-fg'}`}
            >
              Table View
            </button>
          </div>
          {bottleneckOperator && (
            <button
              onClick={handleAiOptimize}
              disabled={isAiLoading || loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-monokai-amethyst text-monokai-bg font-bold rounded text-xs hover:opacity-90 disabled:opacity-40 transition-colors"
              title={`瓶颈算子: ${bottleneckOperator.name} (${bottleneckOperator.percentage.toFixed(1)}%)`}
            >
              {isAiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              AI 性能重构
            </button>
          )}
          <button
            onClick={runProfiling}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-monokai-cyan text-monokai-bg font-bold rounded text-xs hover:bg-monokai-cyan/90 disabled:opacity-40 transition-colors"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            Recalculate Profile
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex-1 py-12 flex flex-col items-center justify-center gap-3">
          <Loader2 size={36} className="text-monokai-cyan animate-spin" />
          <span className="text-xs text-monokai-comment tracking-wider animate-pulse uppercase font-mono">Running Profiler...</span>
        </div>
      )}

      {error && (
        <div className="bg-monokai-pink/10 border border-monokai-pink/30 text-monokai-pink p-3 rounded text-xs font-mono">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && !profileData && (
        <div className="text-center py-12 text-monokai-comment">
          No profiling data loaded. Click recalculate to trigger profiling.
        </div>
      )}

      {!loading && !error && profileData && (
        <div className="flex flex-col gap-4">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-monokai-surface p-3 rounded border border-monokai-accent/30 flex items-center gap-3">
              <Cpu className="text-monokai-pink w-8 h-8" />
              <div>
                <div className="text-[9px] text-monokai-comment uppercase font-bold tracking-wider">Total CPU Time</div>
                <div className="text-lg font-bold text-monokai-fg font-mono">{(totalTiming * 1000).toFixed(2)} ms</div>
              </div>
            </div>

            <div className="bg-monokai-surface p-3 rounded border border-monokai-accent/30 flex items-center gap-3">
              <TrendingUp className="text-monokai-green w-8 h-8" />
              <div>
                <div className="text-[9px] text-monokai-comment uppercase font-bold tracking-wider">Peak Memory</div>
                <div className="text-lg font-bold text-monokai-green font-mono">{peakMemoryInfo}</div>
              </div>
            </div>

            <div className="bg-monokai-surface p-3 rounded border border-monokai-accent/30 flex items-center gap-3">
              <HelpCircle className="text-monokai-yellow w-8 h-8" />
              <div>
                <div className="text-[9px] text-monokai-comment uppercase font-bold tracking-wider">Plan Operators</div>
                <div className="text-lg font-bold text-monokai-fg font-mono">{flattenedOperators.length}</div>
              </div>
            </div>
          </div>

          {viewMode === 'tree' ? (
            <div className="bg-monokai-surface rounded border border-monokai-accent/40 p-6 overflow-auto custom-scrollbar flex justify-center min-h-[400px]">
              <div className="inline-flex py-4">
                <ProfileNode node={profileData} totalTiming={totalTiming} />
              </div>
            </div>
          ) : (
            /* Breakdown Table */
            <div className="bg-monokai-surface rounded border border-monokai-accent/40 overflow-hidden">
              <div className="p-3 border-b border-monokai-accent/30 bg-monokai-bg flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-monokai-cyan">Operator Execution Breakdown</span>
                <span className="text-[9px] text-monokai-comment">Sorted by execution percentage</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-monokai-bg/60 border-b border-monokai-accent/20 text-monokai-comment">
                      <th className="p-3 font-bold">Operator Name</th>
                      <th className="p-3 font-bold text-right">Timing (ms)</th>
                      <th className="p-3 font-bold">Time distribution</th>
                      <th className="p-3 font-bold text-right">Output Rows</th>
                      <th className="p-3 font-bold">Extra Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-monokai-accent/10">
                    {flattenedOperators.map((op, idx) => {
                      const barColor = op.percentage > 50
                        ? 'bg-monokai-pink'
                        : op.percentage > 20
                          ? 'bg-monokai-orange'
                          : op.percentage > 5
                            ? 'bg-monokai-yellow'
                            : 'bg-monokai-green';

                      return (
                        <tr key={idx} className="hover:bg-monokai-bg/40 transition-colors">
                          <td className="p-3 font-bold text-monokai-fg">{op.name}</td>
                          <td className="p-3 text-right text-monokai-fg font-bold">{(op.timing * 1000).toFixed(2)}</td>
                          <td className="p-3 w-48">
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-monokai-bg border border-monokai-accent/20 rounded h-2 overflow-hidden shrink-0">
                                <div className={`h-full rounded-sm ${barColor}`} style={{ width: `${op.percentage}%` }}></div>
                              </div>
                              <span className="text-[10px] font-bold min-w-[32px] text-right">{op.percentage.toFixed(1)}%</span>
                            </div>
                          </td>
                          <td className="p-3 text-right text-monokai-comment">{op.cardinality.toLocaleString()}</td>
                          <td className="p-3 text-monokai-comment text-[10px] whitespace-pre-wrap max-w-xs">{op.extraInfo || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          <details className="mt-4 bg-monokai-surface/30 border border-monokai-accent/30 rounded p-2 text-xs">
            <summary className="cursor-pointer text-monokai-comment hover:text-monokai-fg select-none font-bold uppercase tracking-wider text-[9px]">Show Raw Profiling JSON Data</summary>
            <pre className="mt-2 p-3 bg-monokai-bg border border-monokai-accent/20 rounded text-[9px] text-monokai-fg overflow-auto max-h-60 font-mono scrollbar-hide">
              {JSON.stringify(profileData, null, 2)}
            </pre>
          </details>

          {showAiModal && optimizedSql && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/75 backdrop-blur-sm animate-[fadeIn_0.2s]">
              <div className="bg-monokai-sidebar border border-monokai-amethyst/50 rounded-xl shadow-2xl w-[600px] overflow-hidden animate-[slideIn_0.25s_ease-out]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 bg-monokai-bg border-b border-monokai-accent">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-monokai-amethyst/20 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-monokai-amethyst" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-monokai-fg">AI SQL 性能重构建议</h3>
                      <p className="text-[10px] text-monokai-comment">针对算子 [{bottleneckOperator?.name}] 瓶颈进行的性能优化建议</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAiModal(false)}
                    className="w-7 h-7 rounded-lg hover:bg-monokai-accent flex items-center justify-center text-monokai-comment hover:text-monokai-fg transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Diff/Code View */}
                <div className="p-5 space-y-4">
                  <div>
                    <span className="block text-[10px] font-bold text-monokai-comment uppercase tracking-wider mb-2">优化后 SQL 预览</span>
                    <pre className="text-xs text-monokai-fg font-mono bg-monokai-bg p-4 rounded-lg border border-monokai-accent/30 max-h-[300px] overflow-auto whitespace-pre-wrap">
                      {optimizedSql}
                    </pre>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex justify-end gap-3 px-5 py-4 bg-monokai-bg border-t border-monokai-accent">
                  <button
                    onClick={() => setShowAiModal(false)}
                    className="px-4 py-2 text-sm font-medium text-monokai-comment hover:text-monokai-fg hover:bg-monokai-accent rounded-lg transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={applyOptimizedSql}
                    className="px-5 py-2 bg-monokai-amethyst text-monokai-bg font-bold rounded-lg text-sm hover:opacity-90 transition-all flex items-center gap-2"
                  >
                    <Check size={14} />
                    应用优化 SQL 到编辑器
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
