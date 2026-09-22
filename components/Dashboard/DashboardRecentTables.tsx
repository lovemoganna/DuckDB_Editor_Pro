import React, { useState } from 'react';
import { ArrowRight, Table2, Layers, Key, Code2, Search, Eye, Copy, Trash2, Check, X, Activity, BarChart3, Network } from 'lucide-react';
import { Tab } from '../../types';
import { type TableItemDetail } from '../../hooks/useDashboardWorkflow';
import { toastService } from '../../services/toastService';
import { DB } from './dashboardUi';

interface DashboardRecentTablesProps {
  tables: TableItemDetail[];
  onSelectTable: (tableName: string) => void;
  onNavigate: (tab: Tab) => void;
  onSelectTableStructure?: (tableName: string) => void;
  onSelectTableAnalysis?: (tableName: string) => void;
  onSelectTableMetrics?: (tableName: string) => void;
  onSelectTableDataFlow?: (tableName: string) => void;
  onQuickQuery?: (tableName: string) => void;
  onPeekTable?: (tableName: string) => void;
  onOpenImport?: () => void;
  onOpenCreate?: () => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  typeFilter?: 'all' | 'table' | 'view';
  onTypeFilterChange?: (filter: 'all' | 'table' | 'view') => void;
  onDropTable?: (tableName: string) => void;
}

export const DashboardRecentTables: React.FC<DashboardRecentTablesProps> = ({
  tables,
  onSelectTable,
  onNavigate,
  onSelectTableStructure,
  onSelectTableAnalysis,
  onSelectTableMetrics,
  onSelectTableDataFlow,
  onQuickQuery,
  onPeekTable,
  onOpenImport,
  onOpenCreate,
  searchTerm = '',
  onSearchChange,
  typeFilter = 'all',
  onTypeFilterChange,
  onDropTable,
}) => {
  const [copiedTable, setCopiedTable] = useState<string | null>(null);
  const [tableToConfirmDrop, setTableToConfirmDrop] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const displayedTables = showAll ? tables : tables.slice(0, 8);

  const handleCopy = (tableName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    void navigator.clipboard.writeText(tableName);
    setCopiedTable(tableName);
    toastService.success(`已复制表名: ${tableName}`);
    setTimeout(() => setCopiedTable(null), 1500);
  };

  const handleConfirmDrop = (tableName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDropTable) {
      onDropTable(tableName);
    }
    setTableToConfirmDrop(null);
  };

  return (
    <div className={`${DB.panel} h-full justify-between`}>
      <div>
        {/* Header */}
        <div className="mb-2 flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Table2 className="h-3.5 w-3.5 text-monokai-fg-muted" />
            <h3 className={DB.sectionTitle}>最近的表</h3>
            <span className={DB.chip}>{tables.length} 个对象</span>
            {typeFilter !== 'all' && onTypeFilterChange && (
              <span className={`${DB.chip} border-monokai-border text-monokai-fg-muted`}>
                <span>{typeFilter === 'view' ? '仅视图' : '仅数据表'}</span>
                <button
                  type="button"
                  onClick={() => onTypeFilterChange('all')}
                  className={`p-0.5 hover:text-monokai-fg cursor-pointer ${DB.focus}`}
                  title="清除类型过滤"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onNavigate(Tab.DATA)}
            className={`group ${DB.btnGhostLink} ${DB.focus}`}
          >
            <span>进入网格</span>
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        {/* Search Bar */}
        {onSearchChange && (
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-monokai-comment" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="搜索数据表名或视图…"
              className={DB.input}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-monokai-comment hover:text-monokai-fg cursor-pointer ${DB.focus}`}
                title="清除搜索"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {/* Table List Header */}
        <div className="grid grid-cols-12 gap-2 text-2xs sm:text-meta text-monokai-comment pb-1.5 border-b border-monokai-border/70 px-2 font-medium">
          <div className="col-span-5">表名 / 类型</div>
          <div className="col-span-2 text-right">行数</div>
          <div className="col-span-2 text-right">大小</div>
          <div className="col-span-3 text-right">快捷操作</div>
        </div>

        {/* Table Rows or Empty State */}
        {tables.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-7 px-4 text-center">
            <div className="w-9 h-9 rounded-full bg-monokai-elevated border border-monokai-border flex items-center justify-center text-monokai-comment mb-2">
              <Layers className="w-4 h-4" />
            </div>
            <p className="text-meta font-medium text-monokai-fg-muted">
              {searchTerm ? '未找到匹配的数据表' : '暂无数据表'}
            </p>
            <p className="text-2xs text-monokai-comment mt-0.5 max-w-[200px]">
              {searchTerm ? '尝试更换搜索关键词' : '当前数据库尚未创建或导入任何表资产'}
            </p>
            {!searchTerm && (
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => (onOpenCreate ? onOpenCreate() : onNavigate(Tab.DATA))}
                  className={`${DB.btnSecondary} ${DB.focus}`}
                >
                  新建数据集
                </button>
                <button
                  type="button"
                  onClick={() => (onOpenImport ? onOpenImport() : onNavigate(Tab.DATA))}
                  className={`${DB.btnSecondary} ${DB.focus}`}
                >
                  导入数据
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-0.5 pt-1 max-h-[250px] overflow-y-auto custom-scrollbar">
            {displayedTables.map(tbl => (
              <div
                key={tbl.name}
                data-testid={`recent-table-${tbl.name}`}
                onClick={() => onSelectTable(tbl.name)}
                title="点击进入数据浏览视图"
                className="group grid grid-cols-12 gap-2 items-center px-2 py-1.5 rounded-lg hover:bg-monokai-elevated transition-all duration-150 cursor-pointer text-meta"
              >
                {/* Table Name + Icon + PK Indicator */}
                <div className="col-span-5 flex items-center gap-1.5 min-w-0">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tbl.type === 'view' ? 'bg-monokai-amethyst' : 'bg-monokai-yellow'}`} />
                  <span className="font-mono text-monokai-fg-muted group-hover:text-monokai-fg truncate font-medium text-meta">
                    {tbl.name}
                  </span>
                  {tbl.hasPrimaryKey && (
                    <span title="包含主键" className="shrink-0 text-2xs text-monokai-yellow">
                      <Key className="w-2.5 h-2.5" />
                    </span>
                  )}
                  {tbl.type === 'view' && (
                    <span className="px-1 py-0.2 text-3xs font-mono font-semibold rounded bg-monokai-amethyst/15 text-monokai-amethyst border border-monokai-amethyst/30 shrink-0">
                      VIEW
                    </span>
                  )}
                </div>

                {/* Row Count */}
                <div className="col-span-2 text-right font-mono text-monokai-fg text-meta">
                  {tbl.formattedRowCount}
                </div>

                {/* Size */}
                <div className="col-span-2 text-right font-mono text-monokai-comment text-meta">
                  {tbl.formattedSize}
                </div>

                <div className="col-span-3 flex items-center justify-end gap-0.5" onClick={e => e.stopPropagation()}>
                  {onPeekTable && (
                    <button
                      type="button"
                      onClick={() => onPeekTable(tbl.name)}
                      title="快速预览样本与画像 (不跳转页面)"
                      className={`rounded p-1 text-monokai-comment hover:bg-monokai-border/50 hover:text-monokai-fg cursor-pointer ${DB.focus}`}
                    >
                      <Eye className="h-3 w-3" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={e => handleCopy(tbl.name, e)}
                    title="复制表名"
                    className={`rounded p-1 text-monokai-comment hover:bg-monokai-border/50 hover:text-monokai-fg cursor-pointer ${DB.focus}`}
                  >
                    {copiedTable === tbl.name ? (
                      <Check className="h-3 w-3 text-monokai-accent" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                  {onSelectTableStructure && (
                    <button
                      type="button"
                      onClick={() => onSelectTableStructure(tbl.name)}
                      title="表结构设计与 ER 关系"
                      className={`rounded p-1 text-monokai-comment hover:bg-monokai-border/50 hover:text-monokai-fg cursor-pointer ${DB.focus}`}
                    >
                      <Layers className="h-3 w-3" />
                    </button>
                  )}
                  {onSelectTableAnalysis && (
                    <button
                      type="button"
                      onClick={() => onSelectTableAnalysis(tbl.name)}
                      title="在分析中心探查此表"
                      className={`rounded p-1 text-monokai-comment hover:bg-monokai-border/50 hover:text-monokai-fg cursor-pointer ${DB.focus}`}
                    >
                      <Activity className="h-3 w-3" />
                    </button>
                  )}
                  {onSelectTableMetrics && (
                    <button
                      type="button"
                      onClick={() => onSelectTableMetrics(tbl.name)}
                      title="在指标中心为此表建模"
                      className={`rounded p-1 text-monokai-comment hover:bg-monokai-border/50 hover:text-monokai-fg cursor-pointer ${DB.focus}`}
                    >
                      <BarChart3 className="h-3 w-3" />
                    </button>
                  )}
                  {onSelectTableDataFlow && (
                    <button
                      type="button"
                      onClick={() => onSelectTableDataFlow(tbl.name)}
                      title="在数据流画布中定位此表"
                      className={`rounded p-1 text-monokai-comment hover:bg-monokai-border/50 hover:text-monokai-fg cursor-pointer ${DB.focus}`}
                    >
                      <Network className="h-3 w-3" />
                    </button>
                  )}
                  {onQuickQuery && (
                    <button
                      type="button"
                      onClick={() => onQuickQuery(tbl.name)}
                      title="快速查询前100行"
                      className={`rounded p-1 text-monokai-comment hover:bg-monokai-border/50 hover:text-monokai-fg cursor-pointer ${DB.focus}`}
                    >
                      <Code2 className="h-3 w-3" />
                    </button>
                  )}
                  {onDropTable && (
                    tableToConfirmDrop === tbl.name ? (
                      <div className="flex items-center gap-1 rounded-md border border-monokai-pink/40 bg-monokai-pink/15 px-1.5 py-0.5 shadow-2xs">
                        <button
                          type="button"
                          data-testid={`confirm-drop-table-${tbl.name}`}
                          onClick={e => handleConfirmDrop(tbl.name, e)}
                          title="确认删除数据表"
                          className="cursor-pointer text-2xs font-bold text-monokai-pink hover:underline"
                        >
                          确认删除
                        </button>
                        <button
                          type="button"
                          onClick={() => setTableToConfirmDrop(null)}
                          title="取消删除"
                          className="cursor-pointer p-0.5 text-monokai-comment hover:text-monokai-fg"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        data-testid={`delete-table-${tbl.name}`}
                        onClick={e => {
                          e.stopPropagation();
                          setTableToConfirmDrop(tbl.name);
                        }}
                        title="删除数据表"
                        className={`rounded p-1 text-monokai-comment hover:bg-monokai-pink/20 hover:text-monokai-pink cursor-pointer ${DB.focus}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}
            {tables.length > 8 && (
              <div className="pt-1.5 text-center">
                <button
                  type="button"
                  onClick={() => setShowAll(!showAll)}
                  className={`${DB.btnGhostLink} font-mono ${DB.focus}`}
                >
                  {showAll ? '收起部分列表' : `展开查看全部 (${tables.length} 个对象) ↓`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
