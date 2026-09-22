import React, { useState, useEffect, useRef } from 'react';
import {
  Table2,
  ChevronDown,
  ChevronRight,
  Eye,
  Layers,
  Terminal,
  Copy,
  Trash2,
  CheckCircle2,
  FolderTree,
} from 'lucide-react';
import { AssetItem, SchemaGroup } from './types';
import { toastService } from '../../services/toastService';

interface SchemaAssetCatalogProps {
  groups: SchemaGroup[];
  selectedAssetId: string | null;
  onSelectAsset: (asset: AssetItem) => void;
  onNavigateToData: (tableName: string) => void;
  onNavigateToSql: (tableName: string) => void;
  onExportTable: (tableName: string) => void;
  onDropTable: (tableName: string) => void;
  onPeekTable: (tableName: string) => void;
  onToggleSchema: (schemaName: string) => void;
  searchQuery: string;
  onClearSearch: () => void;
}

export const SchemaAssetCatalog: React.FC<SchemaAssetCatalogProps> = ({
  groups,
  selectedAssetId,
  onSelectAsset,
  onNavigateToData,
  onNavigateToSql,
  onExportTable,
  onDropTable,
  onPeekTable,
  onToggleSchema,
  searchQuery,
  onClearSearch,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showMoreMenuId, setShowMoreMenuId] = useState<string | null>(null);

  useEffect(() => {
    const handleOutsideClick = () => {
      if (showMoreMenuId) setShowMoreMenuId(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [showMoreMenuId]);

  const handleCopy = (tableName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    void navigator.clipboard.writeText(tableName);
    setCopiedId(tableName);
    setTimeout(() => setCopiedId(null), 1500);
    toastService.success(`已复制表名: ${tableName}`);
    setShowMoreMenuId(null);
  };

  const getStatusDisplay = (status: AssetItem['status']) => {
    switch (status) {
      case 'analyzing':
        return <span className="text-monokai-cyan font-medium text-xs font-mono animate-pulse">分析中…</span>;
      case 'attention':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-monokai-surface border border-monokai-border/80 px-2 py-0.5 text-xs font-semibold text-monokai-yellow">
            <span className="h-1.5 w-1.5 rounded-full bg-monokai-yellow animate-pulse" />
            需要关注
          </span>
        );
      case 'pending_reanalyze':
        return <span className="text-monokai-orange font-medium text-xs font-mono">待重新分析</span>;
      case 'normal':
        return (
          <span className="inline-flex items-center gap-1 text-monokai-green text-xs font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            正常
          </span>
        );
      case 'error':
        return <span className="text-monokai-pink text-xs font-mono">读取失败</span>;
      default:
        return <span className="text-monokai-comment text-xs font-mono">未分析</span>;
    }
  };

  const totalAssetsCount = groups.reduce((sum, g) => sum + g.assets.length, 0);

  if (totalAssetsCount === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center p-8 text-center font-sans text-xs text-monokai-comment select-none">
        <div className="w-12 h-12 rounded-xl bg-monokai-surface border border-monokai-border flex items-center justify-center mb-3 text-monokai-comment shadow-sm">
          <FolderTree className="w-6 h-6" />
        </div>
        <p className="font-bold text-monokai-fg mb-1 text-sm">未找到匹配的数据资产</p>
        {searchQuery && (
          <p className="text-xs text-monokai-comment mb-4 max-w-xs">
            当前搜索词 “<span className="text-monokai-fg font-mono">{searchQuery}</span>” 在当前筛选条件下无匹配结果
          </p>
        )}
        <button
          type="button"
          onClick={onClearSearch}
          className="px-4 py-1.5 rounded-lg bg-monokai-surface border border-monokai-border text-monokai-fg hover:bg-monokai-hover hover:border-monokai-border-strong transition-all cursor-pointer shadow-xs font-medium"
        >
          清除搜索与筛选
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto custom-scrollbar font-sans select-none px-6 pb-6 bg-monokai-bg">
      <div className="min-w-[650px]">
        {/* Table Header (Sticky with backdrop blur) */}
        <div className="grid grid-cols-12 gap-2 py-2.5 px-3 border-b border-monokai-border bg-monokai-bg/90 backdrop-blur-md text-monokai-comment font-mono text-xs sticky top-0 z-10 select-none">
          <div className="col-span-4 pl-1 font-semibold">名称</div>
          <div className="col-span-1 text-center font-semibold">类型</div>
          <div className="col-span-2 text-right font-semibold">约行数</div>
          <div className="col-span-2 text-right font-semibold">大小</div>
          <div className="col-span-1 text-center font-semibold">状态</div>
          <div className="col-span-2 text-right pr-2 font-semibold">最近分析</div>
        </div>

        {/* Schema Groups */}
        <div className="divide-y divide-transparent">
          {groups.map(group => (
            <div key={group.name} className="flex flex-col pt-3">
              {/* Schema Group Header */}
              <div className="flex items-center gap-2 py-1.5 px-1">
                <button
                  type="button"
                  onClick={() => onToggleSchema(group.name)}
                  className="flex items-center gap-2 text-xs text-monokai-fg hover:text-monokai-yellow bg-transparent border-0 transition-colors cursor-pointer text-left group"
                >
                  {group.isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-monokai-comment group-hover:text-monokai-yellow transition-colors" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-monokai-comment group-hover:text-monokai-yellow transition-colors" />
                  )}
                  <FolderTree className="h-4 w-4 text-monokai-yellow" />
                  <span className="font-bold text-xs font-mono text-monokai-fg">{group.name}</span>
                  <span className="rounded-md bg-monokai-surface px-2 py-0.2 text-2xs font-mono text-monokai-comment border border-monokai-border">
                    {group.assets.length} 项
                  </span>
                </button>
                <div className="flex-1 h-px bg-monokai-border/60 ml-2" />
              </div>

              {/* Group Asset Rows */}
              {group.isExpanded && (
                <div className="flex flex-col mt-1 gap-0.5">
                  {group.assets.map(asset => {
                    const isSelected = selectedAssetId === asset.id;

                    return (
                      <div
                        key={asset.id}
                        onClick={() => onSelectAsset(asset)}
                        className={`group relative grid grid-cols-12 gap-2 items-center py-2.5 px-3 text-xs transition-all cursor-pointer rounded-lg ${
                          isSelected
                            ? 'bg-monokai-elevated text-monokai-fg shadow-xs font-semibold'
                            : 'hover:bg-monokai-surface/60 text-monokai-fg/90'
                        }`}
                      >
                        {/* Name Column */}
                        <div className="col-span-4 flex items-center gap-2.5 min-w-0">
                          {asset.type === 'view' ? (
                            <Layers
                              className={`h-4 w-4 shrink-0 ${
                                isSelected ? 'text-monokai-fg' : 'text-monokai-comment'
                              }`}
                            />
                          ) : (
                            <Table2
                              className={`h-4 w-4 shrink-0 ${
                                isSelected ? 'text-monokai-fg' : 'text-monokai-comment'
                              }`}
                            />
                          )}
                          <span
                            className={`font-mono text-xs truncate ${
                              isSelected ? 'font-bold text-monokai-fg' : 'text-monokai-fg/90'
                            }`}
                            title={asset.name}
                          >
                            {asset.name}
                          </span>
                        </div>

                        {/* Type Column */}
                        <div className="col-span-1 text-center font-sans text-xs">
                          {asset.type === 'view' ? (
                            <span className="inline-block px-2 py-0.5 rounded-md bg-monokai-surface text-monokai-comment font-medium text-2xs border border-monokai-border">
                              视图
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded-md bg-monokai-surface text-monokai-comment font-medium text-2xs border border-monokai-border">
                              表
                            </span>
                          )}
                        </div>

                        {/* Approx Rows Column */}
                        <div className="col-span-2 text-right font-mono text-xs text-monokai-fg/80">
                          {asset.type === 'view'
                            ? '—'
                            : asset.rowCount !== null
                            ? asset.rowCount >= 1000000
                              ? `${(asset.rowCount / 1000000) % 1 === 0 ? (asset.rowCount / 1000000).toFixed(0) : (asset.rowCount / 1000000).toFixed(1)}M`
                              : asset.rowCount >= 1000
                              ? `${(asset.rowCount / 1000) % 1 === 0 ? (asset.rowCount / 1000).toFixed(0) : (asset.rowCount / 1000).toFixed(1)}K`
                              : asset.rowCount.toLocaleString()
                            : '—'}
                        </div>

                        {/* Size Column */}
                        <div className="col-span-2 text-right font-mono text-xs text-monokai-fg/80">
                          {asset.sizeEstimate ?? '—'}
                        </div>

                        {/* Status Column */}
                        <div className="col-span-1 text-center text-xs">
                          {getStatusDisplay(asset.status)}
                        </div>

                        {/* Last Analyzed / Inline Actions on Hover */}
                        <div className="col-span-2 text-right font-mono text-xs text-monokai-comment pr-1 relative">
                          <div
                            className="hidden group-hover:flex items-center justify-end gap-1.5 text-xs font-sans text-monokai-fg"
                            onClick={e => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                onSelectAsset(asset);
                                onPeekTable(asset.name);
                              }}
                              className="px-2 py-0.5 rounded-md bg-monokai-surface border border-monokai-border hover:border-monokai-border-strong hover:bg-monokai-hover text-monokai-fg text-xs font-medium transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                              title="预览数据"
                            >
                              概览
                            </button>
                            <button
                              type="button"
                              onClick={() => onNavigateToData(asset.name)}
                              className="px-2 py-0.5 rounded-md bg-monokai-surface border border-monokai-border hover:border-monokai-border-strong hover:bg-monokai-hover text-monokai-fg text-xs font-medium transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                              title="浏览数据"
                            >
                              浏览
                            </button>
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() =>
                                  setShowMoreMenuId(
                                    showMoreMenuId === asset.id ? null : asset.id
                                  )
                                }
                                className="flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-monokai-surface border border-monokai-border hover:border-monokai-border-strong text-monokai-comment hover:text-monokai-fg text-xs font-medium transition-all cursor-pointer shadow-xs"
                              >
                                <span>更多</span>
                                <ChevronDown className="h-3 w-3" />
                              </button>

                              {showMoreMenuId === asset.id && (
                                <div className="absolute right-0 top-full mt-1.5 w-36 rounded-xl border border-monokai-border-strong/80 bg-monokai-surface/95 backdrop-blur-md shadow-2xl py-1.5 z-30 text-xs font-sans text-left animate-in fade-in zoom-in-95 duration-150">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onPeekTable(asset.name);
                                      setShowMoreMenuId(null);
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-monokai-elevated text-monokai-fg cursor-pointer transition-colors"
                                    title="速览数据"
                                  >
                                    <Eye className="h-3.5 w-3.5 text-monokai-comment" />
                                    <span>预览数据</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onNavigateToSql(asset.name);
                                      setShowMoreMenuId(null);
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-monokai-elevated text-monokai-fg cursor-pointer transition-colors"
                                    title="SQL 查询"
                                  >
                                    <Terminal className="h-3.5 w-3.5 text-monokai-comment" />
                                    <span>SQL 查询</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={e => handleCopy(asset.name, e)}
                                    className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-monokai-elevated text-monokai-fg cursor-pointer transition-colors"
                                  >
                                    <Copy className="h-3.5 w-3.5 text-monokai-comment" />
                                    <span>复制表名</span>
                                  </button>
                                  <div className="h-px bg-monokai-border/80 my-1" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onDropTable(asset.name);
                                      setShowMoreMenuId(null);
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-monokai-pink/15 text-monokai-pink cursor-pointer transition-colors font-medium"
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-monokai-pink" />
                                    <span>删除表</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          <span className="truncate group-hover:hidden">
                            {asset.lastAnalyzedAt || '—'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
