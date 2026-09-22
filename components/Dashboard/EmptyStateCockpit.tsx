import React from 'react';
import {
  UploadCloud,
  Sparkles,
  Loader2,
  AlertCircle,
  Activity,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react';
import { FileImportState } from './types';

interface EmptyStateCockpitProps {
  isDraggingOver: boolean;
  importState: FileImportState;
  isSeedingDemo: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onBrowseFiles: () => void;
  onLoadDemoDataset: (datasetType?: 'ecommerce' | 'logs' | 'funnel') => void;
}

export const EmptyStateCockpit: React.FC<EmptyStateCockpitProps> = ({
  isDraggingOver,
  importState,
  isSeedingDemo,
  onDragOver,
  onDragLeave,
  onDrop,
  onBrowseFiles,
  onLoadDemoDataset,
}) => {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-8 font-sans select-none">
      <div className="w-full max-w-3xl space-y-6">
      {/* 1. PROFESSIONAL DROPZONE */}
      <div
        role="button"
        tabIndex={0}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={onBrowseFiles}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onBrowseFiles();
          }
        }}
        className={`group flex min-h-[170px] flex-col items-center justify-center rounded-md border border-dashed transition-all p-6 text-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monokai-accent/70 focus-visible:ring-offset-1 focus-visible:ring-offset-monokai-bg ${
          isDraggingOver
            ? 'border-monokai-accent/50 bg-monokai-accent/5 scale-[1.01] shadow-lg shadow-black/30'
            : 'border-monokai-border bg-monokai-surface/40 hover:border-monokai-border-strong hover:bg-monokai-surface/60 backdrop-blur-xs shadow-md shadow-black/20'
        }`}
      >
        {importState.status === 'importing' ? (
          <div className="flex flex-col items-center py-4">
            <Loader2 className="h-9 w-9 text-monokai-fg animate-spin mb-3" />
            <p className="text-sm font-bold text-monokai-fg font-mono">
              正在解析并挂载数据表：{importState.filename}…
            </p>
            <p className="text-xs text-monokai-comment mt-1 font-mono">
              DuckDB WASM 正在推断类型与建立表结构
            </p>
          </div>
        ) : (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-md border border-monokai-border bg-monokai-elevated text-monokai-comment group-hover:text-monokai-fg mb-3 group-hover:scale-105 transition-all shadow-xs">
              <UploadCloud className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-monokai-fg">
              {isDraggingOver ? '释放文件以立即挂载' : '拖入数据文件挂载 或 点击选择本地文件'}
            </h3>
            <p className="text-xs text-monokai-comment mt-1 font-mono">
              支持 CSV · TSV · Parquet · JSON · Arrow · DuckDB / SQLite 格式
            </p>

            <div className="mt-3.5 flex items-center gap-2">
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onBrowseFiles();
                }}
                className="rounded-md bg-monokai-accent px-4 py-1.5 text-xs font-semibold text-monokai-bg hover:bg-monokai-accent-hover transition-all cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monokai-accent/70 focus-visible:ring-offset-1 focus-visible:ring-offset-monokai-bg"
              >
                浏览本地文件
              </button>
            </div>

            {importState.status === 'error' && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-monokai-pink font-mono bg-monokai-pink/10 border border-monokai-border px-3 py-1.5 rounded-lg">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{importState.message}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* 2. REAL SCENARIO STARTER DATASETS */}
      <div>
        <div className="flex items-center gap-2 mb-3 px-0.5">
          <Sparkles className="h-4 w-4 text-monokai-yellow" />
          <span className="text-xs font-bold font-mono uppercase tracking-wider text-monokai-fg">
            开箱即用场景数据集 (1 秒极速载入，立即开始分析)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Dataset 1: Ecommerce TPC-H */}
          <div className="flex flex-col justify-between rounded-md border border-monokai-border bg-monokai-surface/40 hover:border-monokai-border-strong hover:bg-monokai-surface/60 p-4 transition-all shadow-md shadow-black/20">
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-monokai-fg">
                  <ShoppingBag className="h-4 w-4 text-monokai-comment" />
                  <span className="text-xs font-bold">电商全链路业务 (6表)</span>
                </div>
                <span className="font-mono text-2xs text-monokai-comment bg-monokai-elevated border border-monokai-border/80 px-2 py-0.5 rounded-md font-semibold">
                  4,000+ 行
                </span>
              </div>
              <p className="text-xs text-monokai-comment mt-2 line-clamp-2 leading-relaxed">
                包含 orders, customers, products, order_items, regions, categories 6 张完整主外键关联表。
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1 font-mono text-2xs text-monokai-comment">
                <span className="bg-monokai-bg/80 px-2 py-0.5 rounded-md border border-monokai-border/60">多表 JOIN</span>
                <span className="bg-monokai-bg/80 px-2 py-0.5 rounded-md border border-monokai-border/60">营收分析</span>
                <span className="bg-monokai-bg/80 px-2 py-0.5 rounded-md border border-monokai-border/60">客单价</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onLoadDemoDataset('ecommerce')}
              disabled={isSeedingDemo}
              className="mt-4 flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-monokai-accent text-xs font-semibold text-monokai-bg hover:bg-monokai-accent-hover transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monokai-accent/70"
            >
              <Sparkles className="h-3.5 w-3.5 text-monokai-bg/80" />
              <span>{isSeedingDemo ? '载入中…' : '装载电商数据集'}</span>
            </button>
          </div>

          {/* Dataset 2: Web API Access Logs */}
          <div className="flex flex-col justify-between rounded-md border border-monokai-border bg-monokai-surface/40 hover:border-monokai-border-strong hover:bg-monokai-surface/60 p-4 transition-all shadow-md shadow-black/20">
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-monokai-fg">
                  <Activity className="h-4 w-4 text-monokai-comment" />
                  <span className="text-xs font-bold">API 流量与时序日志</span>
                </div>
                <span className="font-mono text-2xs text-monokai-comment bg-monokai-elevated border border-monokai-border/80 px-2 py-0.5 rounded-md font-semibold">
                  5,000 条
                </span>
              </div>
              <p className="text-xs text-monokai-comment mt-2 line-clamp-2 leading-relaxed">
                高频时序访问记录：IP、请求路径、HTTP 状态码、延时 (latency_ms) 与客户端 UA。
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1 font-mono text-2xs text-monokai-comment">
                <span className="bg-monokai-bg/80 px-2 py-0.5 rounded-md border border-monokai-border/60">P95/P99 延时</span>
                <span className="bg-monokai-bg/80 px-2 py-0.5 rounded-md border border-monokai-border/60">状态码分布</span>
                <span className="bg-monokai-bg/80 px-2 py-0.5 rounded-md border border-monokai-border/60">时间桶聚合</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onLoadDemoDataset('logs')}
              disabled={isSeedingDemo}
              className="mt-4 flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-monokai-accent text-xs font-semibold text-monokai-bg hover:bg-monokai-accent-hover transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monokai-accent/70"
            >
              <Sparkles className="h-3.5 w-3.5 text-monokai-bg/80" />
              <span>{isSeedingDemo ? '载入中…' : '装载日志时序数据集'}</span>
            </button>
          </div>

          {/* Dataset 3: User Event Funnel */}
          <div className="flex flex-col justify-between rounded-md border border-monokai-border bg-monokai-surface/40 hover:border-monokai-border-strong hover:bg-monokai-surface/60 p-4 transition-all shadow-md shadow-black/20">
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-monokai-fg">
                  <TrendingUp className="h-4 w-4 text-monokai-comment" />
                  <span className="text-xs font-bold">转化与留存漏斗</span>
                </div>
                <span className="font-mono text-2xs text-monokai-comment bg-monokai-elevated border border-monokai-border/80 px-2 py-0.5 rounded-md font-semibold">
                  2,500 条
                </span>
              </div>
              <p className="text-xs text-monokai-comment mt-2 line-clamp-2 leading-relaxed">
                行为追踪：浏览、搜索、加购、结账与支付转化，涵盖 iOS、Android、Web 多端。
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1 font-mono text-2xs text-monokai-comment">
                <span className="bg-monokai-bg/80 px-2 py-0.5 rounded-md border border-monokai-border/60">漏斗转化率</span>
                <span className="bg-monokai-bg/80 px-2 py-0.5 rounded-md border border-monokai-border/60">跨端行为</span>
                <span className="bg-monokai-bg/80 px-2 py-0.5 rounded-md border border-monokai-border/60">GMV 统计</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onLoadDemoDataset('funnel')}
              disabled={isSeedingDemo}
              className="mt-4 flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-monokai-accent text-xs font-semibold text-monokai-bg hover:bg-monokai-accent-hover transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monokai-accent/70"
            >
              <Sparkles className="h-3.5 w-3.5 text-monokai-bg/80" />
              <span>{isSeedingDemo ? '载入中…' : '装载漏斗转化数据集'}</span>
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
