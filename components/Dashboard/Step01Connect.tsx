import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  Table,
  FolderInput,
  Box,
  FileText,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { type RecentImportItem } from '../../services/recentImportsService';

interface Step01ConnectProps {
  onImportFile: (file: File) => Promise<void>;
  onLoadDemo: () => Promise<void>;
  onShowCreateModal: () => void;
  onShowImportModal: () => void;
  recentImports: RecentImportItem[];
  importState: {
    status: 'idle' | 'importing' | 'error' | 'success';
    filename?: string;
    message?: string;
  };
  onProceedToStep02: () => void;
}

export const Step01Connect: React.FC<Step01ConnectProps> = ({
  onImportFile,
  onLoadDemo,
  onShowCreateModal,
  onShowImportModal,
  recentImports,
  importState,
  onProceedToStep02,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      void onImportFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void onImportFile(file);
    }
    e.target.value = '';
  };

  return (
    <div className="flex flex-col h-full min-h-0 rounded-lg bg-monokai-surface border border-monokai-border p-4 text-monokai-fg shadow-sm overflow-hidden">
      {/* Hidden native input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".csv,.tsv,.parquet,.json,.arrow,.duckdb,.sqlite,.db,.xlsx,.xls,.sql"
        className="hidden"
        aria-label="选择本地数据文件"
      />

      {/* Top Header */}
      <div className="flex items-center gap-3 mb-3 shrink-0">
        <div className="w-7 h-7 rounded-md bg-monokai-elevated border border-monokai-border flex items-center justify-center font-mono font-bold text-xs text-monokai-fg-muted shrink-0">
          01
        </div>
        <div className="flex flex-col">
          <h2 className="text-sm sm:text-base font-semibold text-monokai-fg tracking-tight">连接数据</h2>
          <p className="text-xs text-monokai-comment leading-tight">
            导入您的数据文件，或使用示例数据开始探索。
          </p>
        </div>
      </div>

      {/* Scrollable / Flexible Content Area */}
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto custom-scrollbar pr-0.5 space-y-2.5">
        {/* Drag & Drop Card */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center text-center p-5 rounded-md border border-dashed cursor-pointer transition-all duration-150 ${
            isDragOver
              ? 'border-monokai-accent bg-monokai-elevated'
              : 'border-monokai-border bg-monokai-bg/40 hover:border-monokai-border-strong hover:bg-monokai-elevated/40'
          }`}
        >
          {importState.status === 'importing' ? (
            <div className="flex flex-col items-center py-2">
              <Loader2 className="w-7 h-7 text-monokai-accent animate-spin mb-2" />
              <span className="text-xs font-medium text-monokai-fg">
                正在挂载 {importState.filename}...
              </span>
            </div>
          ) : (
            <>
              <div className="w-8 h-8 rounded-md bg-monokai-elevated border border-monokai-border flex items-center justify-center text-monokai-comment mb-2">
                <UploadCloud className="w-4 h-4 text-monokai-comment" />
              </div>

              <div className="text-xs sm:text-sm font-semibold text-monokai-fg mb-1">
                拖入数据文件 或 <span className="text-monokai-accent font-medium">点击选择文件</span>
              </div>
              <div className="text-meta text-monokai-comment mb-2.5 font-mono">
                支持 CSV · Excel (.xlsx/.xls) · Parquet · JSON · Arrow · DuckDB · SQLite
              </div>

              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="h-7 px-3 rounded-md bg-monokai-elevated border border-monokai-border-strong hover:bg-monokai-hover text-monokai-fg font-medium text-xs tracking-tight transition-colors cursor-pointer shadow-xs inline-flex items-center justify-center"
              >
                选择本地文件
              </button>
            </>
          )}

          {importState.status === 'error' && (
            <div className="mt-2 flex items-center gap-1.5 text-meta text-monokai-pink bg-monokai-pink/10 px-2.5 py-1 rounded-md border border-monokai-border">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{importState.message || '导入遇到错误'}</span>
            </div>
          )}
        </div>

        {/* Action Row: 新建表 & 导入数据 */}
        <div className="grid grid-cols-2 gap-2 mt-2">
          {/* 新建表 */}
          <button
            type="button"
            onClick={onShowCreateModal}
            className="flex items-center gap-2.5 p-2.5 rounded-md bg-monokai-elevated/60 border border-monokai-border hover:bg-monokai-hover hover:border-monokai-border-strong text-left transition-all cursor-pointer group"
          >
            <div className="w-7 h-7 rounded-md bg-monokai-surface border border-monokai-border flex items-center justify-center text-monokai-fg-muted group-hover:text-monokai-accent shrink-0 transition-colors">
              <Table className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-monokai-fg">
                新建表
              </span>
              <span className="text-meta text-monokai-comment truncate">在当前数据库中创建空表</span>
            </div>
          </button>

          {/* 导入数据 */}
          <button
            type="button"
            onClick={onShowImportModal}
            className="flex items-center gap-2.5 p-2.5 rounded-md bg-monokai-elevated/60 border border-monokai-border hover:bg-monokai-hover hover:border-monokai-border-strong text-left transition-all cursor-pointer group"
          >
            <div className="w-7 h-7 rounded-md bg-monokai-surface border border-monokai-border flex items-center justify-center text-monokai-fg-muted group-hover:text-monokai-accent shrink-0 transition-colors">
              <FolderInput className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-monokai-fg">
                导入数据
              </span>
              <span className="text-meta text-monokai-comment truncate">从文件导入到新表</span>
            </div>
          </button>
        </div>

        {/* Divider 或 */}
        <div className="flex items-center my-2">
          <div className="flex-1 h-px bg-monokai-border" />
          <span className="px-2 text-2xs text-monokai-comment font-mono">或</span>
          <div className="flex-1 h-px bg-monokai-border" />
        </div>

        {/* 使用示例数据 */}
        <button
          type="button"
          onClick={() => void onLoadDemo()}
          className="w-full flex items-center gap-3 p-2.5 rounded-md bg-monokai-elevated/60 border border-monokai-border hover:bg-monokai-hover hover:border-monokai-border-strong transition-all cursor-pointer text-left group"
        >
          <div className="w-8 h-8 rounded-md bg-monokai-surface border border-monokai-border flex items-center justify-center text-monokai-comment group-hover:text-monokai-accent shrink-0 transition-colors">
            <Box className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="text-xs font-semibold text-monokai-fg flex items-center gap-1.5">
              <span>使用示例数据</span>
            </div>
            <div className="text-meta text-monokai-comment truncate">
              快速加载电商、API、时序等示例数据集
            </div>
          </div>
        </button>

        {/* 最近导入 Section */}
        <div className="mt-2 flex flex-col">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-monokai-fg">
              <Sparkles className="w-3.5 h-3.5 text-monokai-accent" />
              <span>最近导入</span>
            </div>
            <button
              type="button"
              onClick={onShowImportModal}
              className="text-meta text-monokai-comment hover:text-monokai-fg flex items-center gap-0.5 transition-colors cursor-pointer"
            >
              <span>查看全部</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="flex flex-col space-y-1">
            {recentImports.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-3.5 px-2 rounded-md bg-monokai-elevated/20 border border-monokai-border/40 text-center">
                <span className="text-meta text-monokai-comment font-mono">暂无导入记录，请拖入文件或点击上方按钮导入</span>
              </div>
            ) : (
              recentImports.slice(0, 4).map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 rounded-md bg-monokai-elevated/40 border border-monokai-border hover:bg-monokai-hover transition-colors text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded bg-monokai-surface border border-monokai-border/60 flex items-center justify-center text-monokai-comment shrink-0">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-mono text-meta text-monokai-fg truncate">
                        {item.name}
                      </span>
                      <span className="text-2xs text-monokai-comment font-mono truncate">
                        {item.size} · {item.importedAt}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-2xs font-mono text-monokai-fg-muted bg-monokai-surface px-1.5 py-0.5 rounded border border-monokai-border shrink-0 ml-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-monokai-accent" />
                    <span>已导入</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Main Action Button */}
      <div className="shrink-0 pt-3 mt-auto border-t border-monokai-border">
        <button
          type="button"
          onClick={onProceedToStep02}
          className="w-full h-8 px-4 rounded-md bg-monokai-elevated border border-monokai-border-strong hover:bg-monokai-hover active:bg-monokai-surface text-monokai-fg font-medium text-xs tracking-tight flex items-center justify-center gap-1.5 transition-all cursor-pointer"
        >
          <span>完成数据导入，进入数据准备</span>
          <ChevronRight className="w-3.5 h-3.5 stroke-[2]" />
        </button>
      </div>
    </div>
  );
};
