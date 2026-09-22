import React, { useState, useEffect } from 'react';
import { RefreshCw, Folder, Database, Layers, Cpu, CheckCircle } from 'lucide-react';
import { type DuckDBRuntimeInfo } from '../../services/duckdbService';
import { useAppStore } from '../../hooks/store/useAppStore';

interface StudioBottomBarProps {
  runtimeInfo?: DuckDBRuntimeInfo;
  onRefresh?: () => void;
  queryStats?: {
    successCount: number;
    errorCount: number;
    canceledCount: number;
  };
}

export const StudioBottomBar: React.FC<StudioBottomBarProps> = ({
  runtimeInfo,
  onRefresh,
}) => {
  const tables = useAppStore(state => state.tables);
  const [timeStr, setTimeStr] = useState<string>('16:30');
  const [isRotating, setIsRotating] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeStr(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      );
    };
    update();
    const timer = setInterval(update, 10000);
    return () => clearInterval(timer);
  }, []);

  const handleRefreshClick = () => {
    setIsRotating(true);
    onRefresh?.();
    setTimeout(() => setIsRotating(false), 600);
  };

  const tableCount = tables.length;
  const dbVersion = runtimeInfo?.version || '1.33.1';
  const storageMode = runtimeInfo?.storageMode ? runtimeInfo.storageMode.toUpperCase() : 'WASM';
  const memoryDisplay = runtimeInfo?.memoryUsage || '2.1 GB / 16 GB';

  return (
    <footer className="h-7 w-full shrink-0 bg-monokai-surface border-t border-monokai-border px-4 flex items-center justify-between text-meta font-mono text-monokai-comment select-none z-30 text-xs">
      {/* Left items matching reference design */}
      <div className="flex items-center gap-3.5 min-w-0 overflow-x-auto no-scrollbar">
        {/* Version */}
        <div className="flex items-center gap-1.5 font-medium text-monokai-fg">
          <span className="w-1.5 h-1.5 rounded-full bg-monokai-green" />
          <span>DuckDB {dbVersion}</span>
        </div>

        <span className="text-monokai-border">|</span>

        {/* Directory / Mode */}
        <div className="flex items-center gap-1 text-monokai-comment hover:text-monokai-fg transition-colors">
          <Folder className="w-3 h-3 text-monokai-comment" />
          <span className="truncate max-w-[120px]">/workspace [{storageMode}]</span>
        </div>

        <span className="text-monokai-border hidden sm:inline">|</span>

        {/* DB count */}
        <div className="hidden sm:flex items-center gap-1">
          <Database className="w-3 h-3 text-monokai-comment" />
          <span>{runtimeInfo?.persistent ? '持久化库' : '内存库'}</span>
        </div>

        <span className="text-monokai-border hidden md:inline">|</span>

        {/* Table count */}
        <div className="hidden md:flex items-center gap-1">
          <Layers className="w-3 h-3 text-monokai-comment" />
          <span>{tableCount} 张表</span>
        </div>

        <span className="text-monokai-border hidden lg:inline">|</span>

        {/* Total objects */}
        <div className="hidden lg:flex items-center gap-1">
          <span>{tableCount > 0 ? `${tableCount} 个活动表` : '暂无表'}</span>
        </div>

        <span className="text-monokai-border hidden xl:inline">|</span>

        {/* Memory */}
        <div className="hidden xl:flex items-center gap-1.5">
          <Cpu className="w-3 h-3 text-monokai-comment" />
          <span>内存: {memoryDisplay}</span>
        </div>
      </div>

      {/* Right items: ● 运行正常 | 16:30 | Refresh */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-1.5 text-monokai-green font-medium font-sans">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-monokai-green opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-monokai-green" />
          </span>
          <span>运行正常</span>
        </div>

        <span className="text-monokai-border">|</span>

        <span className="font-mono text-monokai-comment">{timeStr}</span>

        <button
          type="button"
          onClick={handleRefreshClick}
          className="p-1 rounded-md hover:bg-monokai-elevated text-monokai-comment hover:text-monokai-fg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monokai-accent/70 focus-visible:ring-offset-1 focus-visible:ring-offset-monokai-bg"
          title="刷新运行时状态"
          aria-label="刷新运行时状态"
        >
          <RefreshCw className={`w-3 h-3 ${isRotating ? 'animate-spin text-monokai-green' : ''}`} />
        </button>
      </div>
    </footer>
  );
};

