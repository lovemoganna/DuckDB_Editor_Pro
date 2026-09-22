import React, { useState, useEffect } from 'react';
import { duckDBService } from '../services/duckdbService';
import { ModalShell, ActionButton } from './ui/Workbench';
import { Trash2, AlertTriangle, Table as TableIcon, Layers, FileSpreadsheet, Check, Code2 } from 'lucide-react';
import { toastService } from '../services/toastService';
import { useAppStore } from '../hooks/store/useAppStore';

interface ClearWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCleared?: () => void;
  onRefreshTables: () => Promise<void>;
  onNotify?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const ClearWorkspaceModal: React.FC<ClearWorkspaceModalProps> = ({
  isOpen,
  onClose,
  onCleared,
  onRefreshTables,
  onNotify,
}) => {
  const [clearTables, setClearTables] = useState(true);
  const [clearViews, setClearViews] = useState(true);
  const [clearMacros, setClearMacros] = useState(true);
  const [clearFiles, setClearFiles] = useState(true);
  const [loading, setLoading] = useState(false);

  const [tableCount, setTableCount] = useState(0);
  const [viewCount, setViewCount] = useState(0);
  const [macroCount, setMacroCount] = useState(0);
  const [fileCount, setFileCount] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const fetchCounts = async () => {
      try {
        const [tables, views, macros] = await Promise.all([
          duckDBService.getBaseTables().catch(() => []),
          duckDBService.getViews().catch(() => []),
          duckDBService.getMacros().catch(() => []),
        ]);
        const files = duckDBService.getRegisteredFiles();
        setTableCount(tables.length);
        setViewCount(views.length);
        setMacroCount(macros.length);
        setFileCount(files.length);
      } catch (e) {
        console.warn('Failed to load counts for clear modal', e);
      }
    };
    void fetchCounts();
  }, [isOpen]);

  const handleConfirmClear = async () => {
    if (!clearTables && !clearViews && !clearMacros && !clearFiles) {
      toastService.warning('请至少勾选一项要清理的资源类型');
      return;
    }

    setLoading(true);
    try {
      const res = await duckDBService.clearAllData({
        tables: clearTables,
        views: clearViews,
        macros: clearMacros,
        files: clearFiles,
      });

      const summaryParts: string[] = [];
      if (clearTables) summaryParts.push(`${res.droppedTables} 个数据表`);
      if (clearViews) summaryParts.push(`${res.droppedViews} 个视图`);
      if (clearMacros && (res.droppedMacros ?? 0) > 0) summaryParts.push(`${res.droppedMacros} 个宏`);
      if (clearFiles) summaryParts.push(`${res.droppedFiles} 个挂载文件`);

      const msg = `已清空：${summaryParts.join('、') || '所选资源'}`;
      toastService.success(msg);
      if (onNotify) onNotify(msg, 'success');

      if (clearTables) {
        useAppStore.getState().setCurrentTable(null);
      }
      await onRefreshTables();
      window.dispatchEvent(new CustomEvent('duckdb-schema-changed'));
      if (onCleared) onCleared();
      onClose();
    } catch (err: any) {
      const errMsg = `清空失败: ${err.message || String(err)}`;
      toastService.error(errMsg);
      if (onNotify) onNotify(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const totalSelected = (clearTables ? tableCount : 0) + (clearViews ? viewCount : 0) + (clearMacros ? macroCount : 0) + (clearFiles ? fileCount : 0);

  return (
    <ModalShell
      open={isOpen}
      onClose={onClose}
      title="清空工作区资源 (Clear Workspace)"
      description="批量清理当前数据库中的数据表、视图、宏与自定义函数以及已挂载的本地/虚拟文件"
      size="md"
      footer={
        <div className="flex w-full items-center justify-between">
          <ActionButton onClick={onClose} variant="secondary" disabled={loading}>
            取消
          </ActionButton>
          <ActionButton
            onClick={handleConfirmClear}
            variant="danger"
            disabled={loading || (!clearTables && !clearViews && !clearMacros && !clearFiles)}
            icon={Trash2}
            loading={loading}
          >
            {loading ? '正在清理...' : '确认彻底清空'}
          </ActionButton>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Warning Banner */}
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-monokai-pink/10 border border-monokai-pink/30 text-monokai-pink text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">
            <span className="font-semibold block mb-0.5">⚠️ 警告：此操作不可撤销</span>
            清空后所有勾选的数据表记录、逻辑视图、自定义宏函数和虚拟文件定义将永久被删除。
          </div>
        </div>

        {/* Selection Checklist */}
        <div className="space-y-2 pt-1">
          <span className="block text-[11px] font-bold text-monokai-comment uppercase tracking-wider">
            选择需要清空的资产类型
          </span>

          {/* Tables */}
          <label className="flex items-center justify-between p-2.5 rounded-lg bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border cursor-pointer transition-colors">
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={clearTables}
                onChange={e => setClearTables(e.target.checked)}
                className="w-4 h-4 rounded border-monokai-border bg-monokai-bg text-monokai-pink focus:ring-monokai-pink/30 cursor-pointer"
              />
              <TableIcon className="w-4 h-4 text-monokai-cyan" />
              <span className="text-xs font-medium text-monokai-fg">数据表 (TABLES)</span>
            </div>
            <span className="text-xs font-mono text-monokai-comment">{tableCount} 个表</span>
          </label>

          {/* Views */}
          <label className="flex items-center justify-between p-2.5 rounded-lg bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border cursor-pointer transition-colors">
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={clearViews}
                onChange={e => setClearViews(e.target.checked)}
                className="w-4 h-4 rounded border-monokai-border bg-monokai-bg text-monokai-pink focus:ring-monokai-pink/30 cursor-pointer"
              />
              <Layers className="w-4 h-4 text-monokai-yellow" />
              <span className="text-xs font-medium text-monokai-fg">分析视图 (VIEWS)</span>
            </div>
            <span className="text-xs font-mono text-monokai-comment">{viewCount} 个视图</span>
          </label>

          {/* Macros */}
          <label className="flex items-center justify-between p-2.5 rounded-lg bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border cursor-pointer transition-colors">
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={clearMacros}
                onChange={e => setClearMacros(e.target.checked)}
                className="w-4 h-4 rounded border-monokai-border bg-monokai-bg text-monokai-pink focus:ring-monokai-pink/30 cursor-pointer"
              />
              <Code2 className="w-4 h-4 text-monokai-orange" />
              <span className="text-xs font-medium text-monokai-fg">宏与自定义函数 (MACROS)</span>
            </div>
            <span className="text-xs font-mono text-monokai-comment">{macroCount} 个宏</span>
          </label>

          {/* Files */}
          <label className="flex items-center justify-between p-2.5 rounded-lg bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border cursor-pointer transition-colors">
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={clearFiles}
                onChange={e => setClearFiles(e.target.checked)}
                className="w-4 h-4 rounded border-monokai-border bg-monokai-bg text-monokai-pink focus:ring-monokai-pink/30 cursor-pointer"
              />
              <FileSpreadsheet className="w-4 h-4 text-monokai-green" />
              <span className="text-xs font-medium text-monokai-fg">挂载文件 (FILES)</span>
            </div>
            <span className="text-xs font-mono text-monokai-comment">{fileCount} 个文件</span>
          </label>
        </div>
      </div>
    </ModalShell>
  );
};
