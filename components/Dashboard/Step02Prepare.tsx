import React, { useState } from 'react';
import {
  Database,
  ExternalLink,
  Table2,
  ChevronRight,
  MoreHorizontal,
  Lightbulb,
  FileCode,
  Eye,
  Trash2,
  Columns,
  Play,
  Loader2,
} from 'lucide-react';
import { Tab } from '../../types';
import { type TableItemDetail } from '../../hooks/useDashboardWorkflow';

interface Step02PrepareProps {
  tables: string[];
  tableDetails: TableItemDetail[];
  loadingDetails: boolean;
  selectedTable: string;
  onSelectTable: (name: string) => void;
  step02Tab: 'tables' | 'schema' | 'preview';
  onSetStep02Tab: (tab: 'tables' | 'schema' | 'preview') => void;
  schemaColumns: any[];
  previewRows: any[];
  previewLoading: boolean;
  dbMetrics: {
    tableCount: number;
    dataSize: string;
    lastUpdated: string;
    modeLabel: string;
    modeTag: string;
    isPersistent: boolean;
  };
  onNavigate: (tab: Tab) => void;
  onQuickQuery: (tableName: string) => void;
  onDropTable: (tableName: string) => void;
  onProceedToStep03: () => void;
}

export const Step02Prepare: React.FC<Step02PrepareProps> = ({
  tables,
  tableDetails,
  loadingDetails,
  selectedTable,
  onSelectTable,
  step02Tab,
  onSetStep02Tab,
  schemaColumns,
  previewRows,
  previewLoading,
  dbMetrics,
  onNavigate,
  onQuickQuery,
  onDropTable,
  onProceedToStep03,
}) => {
  const [activeMenuTable, setActiveMenuTable] = useState<string | null>(null);

  // Close popup menu on outside click or selection
  const handleMenuAction = (action: () => void) => {
    action();
    setActiveMenuTable(null);
  };

  React.useEffect(() => {
    if (!activeMenuTable) return;
    const handleClickOutside = () => setActiveMenuTable(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [activeMenuTable]);

  return (
    <div className="flex flex-col h-full min-h-0 rounded-lg bg-monokai-surface border border-monokai-border p-4 text-monokai-fg shadow-sm overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-monokai-elevated border border-monokai-border flex items-center justify-center font-mono font-bold text-xs text-monokai-fg-muted shrink-0">
            02
          </div>
          <div className="flex flex-col">
            <h2 className="text-sm sm:text-base font-semibold text-monokai-fg tracking-tight">准备数据</h2>
            <p className="text-xs text-monokai-comment leading-tight">
              查看和管理当前数据库的表与结构，为分析做好准备。
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigate(Tab.SQL)}
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-monokai-elevated border border-monokai-border hover:bg-monokai-hover text-xs font-medium text-monokai-fg-muted hover:text-monokai-fg transition-colors cursor-pointer shrink-0"
        >
          <span>打开 SQL 工作台</span>
          <ExternalLink className="w-3 h-3 text-monokai-comment" />
        </button>
      </div>

      {/* Middle Flexible Body */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Current Database Overview Card */}
        <div className="p-2.5 rounded-md bg-monokai-elevated/60 border border-monokai-border mb-2.5 shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded bg-monokai-surface border border-monokai-border/80 flex items-center justify-center text-monokai-accent">
              <Database className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-monokai-fg">当前数据库</span>
            <span className="text-xs text-monokai-fg-muted font-mono">{dbMetrics.modeLabel}</span>
            <span className="text-2xs font-mono px-1.5 py-0.5 rounded bg-monokai-surface text-monokai-fg-muted border border-monokai-border">
              {dbMetrics.modeTag}
            </span>
          </div>

          {/* 3 Metrics Row */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-monokai-border">
            <div className="flex flex-col">
              <span className="text-2xs text-monokai-comment font-mono">表数量</span>
              <span className="text-sm sm:text-base font-semibold text-monokai-fg font-mono mt-0.5">
                {dbMetrics.tableCount}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xs text-monokai-comment font-mono">数据量</span>
              <span className="text-sm sm:text-base font-semibold text-monokai-fg font-mono mt-0.5">
                {dbMetrics.dataSize}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xs text-monokai-comment font-mono">最近更新</span>
              <span className="text-xs sm:text-sm font-semibold text-monokai-fg mt-0.5 truncate">
                {dbMetrics.lastUpdated}
              </span>
            </div>
          </div>
        </div>

        {/* Inner Tabs: 表 (N) | Schema (N) | 数据预览 */}
        <div className="flex items-center gap-4 border-b border-monokai-border pb-1.5 mb-2.5 text-xs font-medium">
          <button
            type="button"
            onClick={() => onSetStep02Tab('tables')}
            className={`flex items-center gap-1.5 pb-1 transition-colors cursor-pointer ${
              step02Tab === 'tables'
                ? 'text-monokai-fg border-b-2 border-monokai-accent'
                : 'text-monokai-comment hover:text-monokai-fg-muted border-b-2 border-transparent'
            }`}
          >
            <span>表</span>
            <span className="text-2xs font-mono text-monokai-comment">({tables.length})</span>
          </button>

          <button
            type="button"
            onClick={() => onSetStep02Tab('schema')}
            className={`flex items-center gap-1.5 pb-1 transition-colors cursor-pointer ${
              step02Tab === 'schema'
                ? 'text-monokai-fg border-b-2 border-monokai-accent'
                : 'text-monokai-comment hover:text-monokai-fg-muted border-b-2 border-transparent'
            }`}
          >
            <span>Schema</span>
            <span className="text-2xs font-mono text-monokai-comment">
              ({schemaColumns.length || tables.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => onSetStep02Tab('preview')}
            className={`flex items-center gap-1.5 pb-1 transition-colors cursor-pointer ${
              step02Tab === 'preview'
                ? 'text-monokai-fg border-b-2 border-monokai-accent'
                : 'text-monokai-comment hover:text-monokai-fg-muted border-b-2 border-transparent'
            }`}
          >
            <span>数据预览</span>
            {selectedTable && (
              <span className="text-2xs font-mono text-monokai-comment">({selectedTable})</span>
            )}
          </button>
        </div>

        {/* Dynamic Content based on inner Tab */}
        <div className="flex-1 min-h-[140px] overflow-y-auto custom-scrollbar pr-0.5">
          {step02Tab === 'tables' && (
            <div className="flex flex-col">
              {/* Table Header */}
              <div className="grid grid-cols-12 px-2 py-1 text-2xs text-monokai-comment font-mono border-b border-monokai-border sticky top-0 bg-monokai-surface z-10">
                <div className="col-span-4">表名</div>
                <div className="col-span-2 text-right">行数</div>
                <div className="col-span-2 text-right">大小</div>
                <div className="col-span-3 text-right">更新时间</div>
                <div className="col-span-1 text-center"></div>
              </div>

              {/* Table Rows */}
              {tableDetails.length === 0 ? (
                <div className="py-8 text-center text-xs text-monokai-comment">
                  当前尚无表，请在步骤 01 导入数据或加载示例
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-monokai-border/60">
                  {tableDetails.map(tbl => {
                    const isSelected = tbl.name === selectedTable;
                    const isMenuOpen = activeMenuTable === tbl.name;

                    return (
                      <div
                        key={tbl.name}
                        onClick={() => onSelectTable(tbl.name)}
                        className={`grid grid-cols-12 items-center px-2 py-1.5 text-xs transition-colors cursor-pointer relative ${
                          isSelected
                            ? 'bg-monokai-elevated text-monokai-fg'
                            : 'hover:bg-monokai-elevated/50 text-monokai-fg-muted'
                        }`}
                      >
                        {/* Name */}
                        <div className="col-span-4 flex items-center gap-1.5 min-w-0">
                          <Table2 className="w-3.5 h-3.5 text-monokai-comment shrink-0" />
                          <span className="font-mono text-meta truncate">{tbl.name}</span>
                        </div>

                        {/* Row count */}
                        <div className="col-span-2 text-right font-mono text-meta text-monokai-fg-muted">
                          {tbl.formattedRowCount}
                        </div>

                        {/* Size */}
                        <div className="col-span-2 text-right font-mono text-meta text-monokai-comment">
                          {tbl.formattedSize}
                        </div>

                        {/* Update time */}
                        <div className="col-span-3 text-right font-mono text-2xs text-monokai-comment">
                          {tbl.updatedAt}
                        </div>

                        {/* More Action Menu */}
                        <div className="col-span-1 flex justify-center relative">
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setActiveMenuTable(isMenuOpen ? null : tbl.name);
                            }}
                            className="w-5 h-5 rounded hover:bg-monokai-hover flex items-center justify-center text-monokai-comment hover:text-monokai-fg cursor-pointer"
                            title="表操作菜单"
                          >
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </button>

                          {/* Action Popover Menu */}
                          {isMenuOpen && (
                            <div className="absolute right-0 top-6 w-36 rounded-md bg-monokai-surface border border-monokai-border shadow-xl py-1 z-50 text-xs text-monokai-fg animate-in fade-in zoom-in-95 duration-100">
                              <button
                                type="button"
                                onClick={() =>
                                  handleMenuAction(() => {
                                    onSelectTable(tbl.name);
                                    onSetStep02Tab('preview');
                                  })
                                }
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-monokai-hover text-left cursor-pointer transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5 text-monokai-comment" />
                                <span>预览数据</span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleMenuAction(() => {
                                    onSelectTable(tbl.name);
                                    onSetStep02Tab('schema');
                                  })
                                }
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-monokai-hover text-left cursor-pointer transition-colors"
                              >
                                <Columns className="w-3.5 h-3.5 text-monokai-comment" />
                                <span>查看结构</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleMenuAction(() => onQuickQuery(tbl.name))}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-monokai-hover text-left cursor-pointer transition-colors"
                              >
                                <Play className="w-3.5 h-3.5 text-monokai-accent" />
                                <span>在 SQL 中查询</span>
                              </button>

                              <div className="h-px bg-monokai-border my-1" />

                              <button
                                type="button"
                                onClick={() => handleMenuAction(() => onDropTable(tbl.name))}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-monokai-hover text-monokai-pink text-left cursor-pointer transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-monokai-pink" />
                                <span>删除表</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {step02Tab === 'schema' && (
            <div className="flex flex-col p-1">
              <div className="flex items-center justify-between mb-2 text-meta text-monokai-comment font-mono">
                <span>当前表: {selectedTable}</span>
                <button
                  type="button"
                  onClick={() => onNavigate(Tab.STRUCTURE)}
                  className="text-monokai-accent hover:underline cursor-pointer"
                >
                  在 Schema 工作台中打开
                </button>
              </div>

              {schemaColumns.length === 0 ? (
                <div className="py-6 text-center text-xs text-monokai-comment">暂无字段信息</div>
              ) : (
                <div className="flex flex-col space-y-1">
                  {schemaColumns.map((c: any, idx: number) => (
                    <div
                      key={c.name || idx}
                      className="flex items-center justify-between px-2 py-1 rounded bg-monokai-elevated/60 text-meta font-mono border border-monokai-border/60"
                    >
                      <span className="text-monokai-fg font-medium">{c.name}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-monokai-comment">{c.type}</span>
                        {c.pk && (
                          <span className="px-1.5 py-0.5 rounded-md bg-monokai-surface border border-monokai-border text-monokai-warning font-mono text-2xs font-semibold">
                            PK
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step02Tab === 'preview' && (
            <div className="flex flex-col p-1 overflow-x-auto">
              <div className="flex items-center justify-between mb-2 text-meta text-monokai-comment font-mono">
                <span>预览: {selectedTable} (前 10 行)</span>
                <button
                  type="button"
                  onClick={() => onNavigate(Tab.DATA)}
                  className="text-monokai-accent hover:underline cursor-pointer"
                >
                  在数据表格中浏览
                </button>
              </div>

              {previewLoading ? (
                <div className="py-8 flex items-center justify-center gap-2 text-xs text-monokai-comment">
                  <Loader2 className="w-4 h-4 animate-spin text-monokai-accent" />
                  <span>加载预览中...</span>
                </div>
              ) : previewRows.length === 0 ? (
                <div className="py-6 text-center text-xs text-monokai-comment">该表暂无数据</div>
              ) : (
                <table className="w-full text-left text-meta font-mono divide-y divide-monokai-border">
                  <thead>
                    <tr className="text-monokai-comment">
                      {Object.keys(previewRows[0]).map(col => (
                        <th key={col} className="px-2 py-1 bg-monokai-elevated font-medium truncate max-w-[120px]">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-monokai-border/60">
                    {previewRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-monokai-elevated/40">
                        {Object.keys(previewRows[0]).map(col => (
                          <td key={col} className="px-2 py-1 text-monokai-fg-muted truncate max-w-[120px]">
                            {row[col] !== null && row[col] !== undefined ? String(row[col]) : 'NULL'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {/* Data Preparation Tips (数据准备小贴士) */}
        <div className="mt-2 pt-2 border-t border-monokai-border shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-monokai-fg">
              <Lightbulb className="w-3.5 h-3.5 text-monokai-warning" />
              <span>数据准备小贴士</span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate(Tab.TUTORIALS)}
              className="text-meta text-monokai-comment hover:text-monokai-fg flex items-center gap-0.5 transition-colors cursor-pointer"
            >
              <span>查看更多</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {/* 探索表结构 */}
            <button
              type="button"
              onClick={() => onNavigate(Tab.STRUCTURE)}
              className="flex flex-col p-2 rounded-md bg-monokai-elevated/50 border border-monokai-border hover:bg-monokai-hover hover:border-monokai-border-strong text-left transition-colors cursor-pointer group"
            >
              <span className="text-xs font-semibold text-monokai-fg">
                探索表结构
              </span>
              <span className="text-2xs text-monokai-comment leading-tight mt-0.5">
                使用 Schema 查看字段类型和完整结构
              </span>
            </button>

            {/* 预览数据 */}
            <button
              type="button"
              onClick={() => onNavigate(Tab.DATA)}
              className="flex flex-col p-2 rounded-md bg-monokai-elevated/50 border border-monokai-border hover:bg-monokai-hover hover:border-monokai-border-strong text-left transition-colors cursor-pointer group"
            >
              <span className="text-xs font-semibold text-monokai-fg">
                预览数据
              </span>
              <span className="text-2xs text-monokai-comment leading-tight mt-0.5">
                快速浏览数据内容，确认导入是否正确
              </span>
            </button>

            {/* 清洗与转换 */}
            <button
              type="button"
              onClick={() => onNavigate(Tab.SQL)}
              className="flex flex-col p-2 rounded-md bg-monokai-elevated/50 border border-monokai-border hover:bg-monokai-hover hover:border-monokai-border-strong text-left transition-colors cursor-pointer group"
            >
              <span className="text-xs font-semibold text-monokai-fg">
                清洗与转换
              </span>
              <span className="text-2xs text-monokai-comment leading-tight mt-0.5">
                在 SQL 工作台中编写转换和清洗语句
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Action Button */}
      <div className="shrink-0 pt-3 mt-auto border-t border-monokai-border">
        <button
          type="button"
          onClick={onProceedToStep03}
          className="w-full h-8 px-4 rounded-md bg-monokai-elevated border border-monokai-border-strong hover:bg-monokai-hover active:bg-monokai-surface text-monokai-fg font-medium text-xs tracking-tight flex items-center justify-center gap-1.5 transition-all cursor-pointer"
        >
          <span>数据已准备好，开始分析</span>
          <ChevronRight className="w-3.5 h-3.5 stroke-[2]" />
        </button>
      </div>
    </div>
  );
};
