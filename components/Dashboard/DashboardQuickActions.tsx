import React, { useRef } from 'react';
import {
  Upload,
  Database,
  PlusSquare,
  Sparkles,
  Blocks,
  Settings,
  HelpCircle,
  ArrowRight,
  Code2,
  Download,
  ExternalLink,
  Activity,
  Layers,
  TrendingUp,
  Network,
  BookOpen,
} from 'lucide-react';
import { Tab } from '../../types';

interface DashboardQuickActionsProps {
  onImportFile: (file: File) => void;
  onOpenImportModal: () => void;
  onOpenCreateModal: () => void;
  onOpenBlankSql?: () => void;
  onOpenExportModal?: () => void;
  onLoadDemo: () => void;
  onOpenSettings: () => void;
  onNavigate: (tab: Tab) => void;
}

export const DashboardQuickActions: React.FC<DashboardQuickActionsProps> = ({
  onImportFile,
  onOpenImportModal,
  onOpenCreateModal,
  onOpenBlankSql,
  onOpenExportModal,
  onLoadDemo,
  onOpenSettings,
  onNavigate,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onImportFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="flex flex-col p-3.5 sm:p-4 rounded-xl bg-monokai-surface border border-monokai-border shadow-sm h-full justify-between">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.tsv,.parquet,.json,.jsonl,.arrow,.sqlite,.db,.xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
      />

      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-monokai-fg tracking-wide">快速操作</h3>
          <span className="text-2xs text-monokai-comment font-mono">全景运维矩阵</span>
        </div>

        {/* 2x4 Action Grid */}
        <div className="grid grid-cols-2 gap-2">
          {/* 1. 导入数据文件 (CSV / Excel / Parquet) */}
          <div
            role="button"
            tabIndex={0}
            data-testid="action-import-file"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="group flex items-start gap-2.5 p-2 rounded-lg bg-monokai-elevated hover:bg-monokai-border/40 border border-monokai-border hover:border-monokai-border-strong transition-all duration-150 cursor-pointer text-left shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent"
          >
            <div className="w-7 h-7 rounded bg-monokai-accent/10 border border-monokai-accent/20 flex items-center justify-center text-monokai-accent shrink-0 mt-0.5">
              <Upload className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-meta font-medium text-monokai-fg group-hover:text-monokai-accent truncate">
                导入 CSV / Parquet
              </span>
              <span className="text-2xs text-monokai-comment truncate mt-0.5 font-mono">
                支持拖拽多 Sheet 自动挂载
              </span>
            </div>
          </div>

          {/* 2. 连接外部数据源 */}
          <div
            role="button"
            tabIndex={0}
            data-testid="action-connect-datasource"
            onClick={onOpenImportModal}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenImportModal();
              }
            }}
            className="group flex items-start gap-2.5 p-2 rounded-lg bg-monokai-elevated hover:bg-monokai-border/40 border border-monokai-border hover:border-monokai-border-strong transition-all duration-150 cursor-pointer text-left shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent"
          >
            <div className="w-7 h-7 rounded bg-monokai-cyan/10 border border-monokai-cyan/20 flex items-center justify-center text-monokai-cyan shrink-0 mt-0.5">
              <Database className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-meta font-medium text-monokai-fg group-hover:text-monokai-cyan truncate">
                连接数据源
              </span>
              <span className="text-2xs text-monokai-comment truncate mt-0.5 font-mono">
                SQLite · Postgres …
              </span>
            </div>
          </div>

          {/* 3. 创建表 */}
          <div
            role="button"
            tabIndex={0}
            data-testid="action-create-table"
            onClick={onOpenCreateModal}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenCreateModal();
              }
            }}
            className="group flex items-start gap-2.5 p-2 rounded-lg bg-monokai-elevated hover:bg-monokai-border/40 border border-monokai-border hover:border-monokai-border-strong transition-all duration-150 cursor-pointer text-left shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent"
          >
            <div className="w-7 h-7 rounded bg-monokai-amethyst/10 border border-monokai-amethyst/20 flex items-center justify-center text-monokai-amethyst shrink-0 mt-0.5">
              <PlusSquare className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-meta font-medium text-monokai-fg group-hover:text-monokai-amethyst truncate">
                创建表
              </span>
              <span className="text-2xs text-monokai-comment truncate mt-0.5 font-mono">
                通过 SQL 或可视化创建
              </span>
            </div>
          </div>

          {/* 4. 新建 SQL 查询 */}
          <div
            role="button"
            tabIndex={0}
            data-testid="action-new-sql"
            onClick={onOpenBlankSql ? onOpenBlankSql : () => onNavigate(Tab.SQL)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (onOpenBlankSql) onOpenBlankSql();
                else onNavigate(Tab.SQL);
              }
            }}
            className="group flex items-start gap-2.5 p-2 rounded-lg bg-monokai-elevated hover:bg-monokai-border/40 border border-monokai-border hover:border-monokai-border-strong transition-all duration-150 cursor-pointer text-left shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent"
          >
            <div className="w-7 h-7 rounded bg-monokai-cyan/10 border border-monokai-cyan/20 flex items-center justify-center text-monokai-cyan shrink-0 mt-0.5">
              <Code2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-meta font-medium text-monokai-fg group-hover:text-monokai-cyan truncate">
                新建 SQL 查询
              </span>
              <span className="text-2xs text-monokai-comment truncate mt-0.5 font-mono">
                打开空白编辑器
              </span>
            </div>
          </div>

          {/* 5. 导出与备份工作区 */}
          <div
            role="button"
            tabIndex={0}
            data-testid="action-export"
            onClick={onOpenExportModal ? onOpenExportModal : () => onOpenSettings()}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (onOpenExportModal) onOpenExportModal();
                else onOpenSettings();
              }
            }}
            className="group flex items-start gap-2.5 p-2 rounded-lg bg-monokai-elevated hover:bg-monokai-border/40 border border-monokai-border hover:border-monokai-border-strong transition-all duration-150 cursor-pointer text-left shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent"
          >
            <div className="w-7 h-7 rounded bg-monokai-pink/10 border border-monokai-pink/20 flex items-center justify-center text-monokai-pink shrink-0 mt-0.5">
              <Download className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-meta font-medium text-monokai-fg group-hover:text-monokai-pink truncate">
                导出 / 备份数据
              </span>
              <span className="text-2xs text-monokai-comment truncate mt-0.5 font-mono">
                Parquet · JSON · DB
              </span>
            </div>
          </div>

          {/* 6. 浏览示例数据 */}
          <div
            role="button"
            tabIndex={0}
            data-testid="action-load-demo"
            onClick={onLoadDemo}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onLoadDemo();
              }
            }}
            className="group flex items-start gap-2.5 p-2 rounded-lg bg-monokai-elevated hover:bg-monokai-border/40 border border-monokai-border hover:border-monokai-border-strong transition-all duration-150 cursor-pointer text-left shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent"
          >
            <div className="w-7 h-7 rounded bg-monokai-yellow/10 border border-monokai-yellow/20 flex items-center justify-center text-monokai-yellow shrink-0 mt-0.5">
              <Sparkles className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-meta font-medium text-monokai-fg group-hover:text-monokai-yellow truncate">
                浏览示例数据
              </span>
              <span className="text-2xs text-monokai-comment truncate mt-0.5 font-mono">
                内置示例数据集
              </span>
            </div>
          </div>

          {/* 7. 管理扩展 */}
          <div
            role="button"
            tabIndex={0}
            data-testid="action-manage-extensions"
            onClick={() => onNavigate(Tab.EXTENSIONS)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onNavigate(Tab.EXTENSIONS);
              }
            }}
            className="group flex items-start gap-2.5 p-2 rounded-lg bg-monokai-elevated hover:bg-monokai-border/40 border border-monokai-border hover:border-monokai-border-strong transition-all duration-150 cursor-pointer text-left shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent"
          >
            <div className="w-7 h-7 rounded bg-monokai-accent/10 border border-monokai-accent/20 flex items-center justify-center text-monokai-accent shrink-0 mt-0.5">
              <Blocks className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-meta font-medium text-monokai-fg group-hover:text-monokai-accent truncate">
                管理扩展
              </span>
              <span className="text-2xs text-monokai-comment truncate mt-0.5 font-mono">
                安装 DuckDB 扩展
              </span>
            </div>
          </div>

          {/* 8. 系统设置 */}
          <div
            role="button"
            tabIndex={0}
            data-testid="action-settings"
            onClick={onOpenSettings}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenSettings();
              }
            }}
            className="group flex items-start gap-2.5 p-2 rounded-lg bg-monokai-elevated hover:bg-monokai-border/40 border border-monokai-border hover:border-monokai-border-strong transition-all duration-150 cursor-pointer text-left shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent"
          >
            <div className="w-7 h-7 rounded bg-monokai-surface border border-monokai-border flex items-center justify-center text-monokai-comment shrink-0 mt-0.5">
              <Settings className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-meta font-medium text-monokai-fg group-hover:text-monokai-fg truncate">
                系统设置
              </span>
              <span className="text-2xs text-monokai-comment truncate mt-0.5 font-mono">
                存储与运行时配置
              </span>
            </div>
          </div>
          {/* 9. 分析中心 */}
          <div
            role="button"
            tabIndex={0}
            data-testid="action-analysis-hub"
            onClick={() => onNavigate(Tab.ANALYSIS_HUB)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onNavigate(Tab.ANALYSIS_HUB);
              }
            }}
            className="group flex items-start gap-2.5 p-2 rounded-lg bg-monokai-elevated hover:bg-monokai-border/40 border border-monokai-border hover:border-monokai-border-strong transition-all duration-150 cursor-pointer text-left shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-green"
          >
            <div className="w-7 h-7 rounded bg-monokai-green/10 border border-monokai-green/20 flex items-center justify-center text-monokai-green shrink-0 mt-0.5">
              <Activity className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-meta font-medium text-monokai-fg group-hover:text-monokai-green truncate">
                分析中心
              </span>
              <span className="text-2xs text-monokai-comment truncate mt-0.5 font-mono">
                数据体检 · 时序分析
              </span>
            </div>
          </div>

          {/* 10. 结构与 ER 关系 */}
          <div
            role="button"
            tabIndex={0}
            data-testid="action-schema-designer"
            onClick={() => onNavigate(Tab.STRUCTURE)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onNavigate(Tab.STRUCTURE);
              }
            }}
            className="group flex items-start gap-2.5 p-2 rounded-lg bg-monokai-elevated hover:bg-monokai-border/40 border border-monokai-border hover:border-monokai-border-strong transition-all duration-150 cursor-pointer text-left shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-cyan"
          >
            <div className="w-7 h-7 rounded bg-monokai-cyan/10 border border-monokai-cyan/20 flex items-center justify-center text-monokai-cyan shrink-0 mt-0.5">
              <Layers className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-meta font-medium text-monokai-fg group-hover:text-monokai-cyan truncate">
                结构与 ER 图
              </span>
              <span className="text-2xs text-monokai-comment truncate mt-0.5 font-mono">
                字段建模 · 拓扑图谱
              </span>
            </div>
          </div>

          {/* 11. 指标中心 */}
          <div
            role="button"
            tabIndex={0}
            data-testid="action-metric-manager"
            onClick={() => onNavigate(Tab.METRICS)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onNavigate(Tab.METRICS);
              }
            }}
            className="group flex items-start gap-2.5 p-2 rounded-lg bg-monokai-elevated hover:bg-monokai-border/40 border border-monokai-border hover:border-monokai-border-strong transition-all duration-150 cursor-pointer text-left shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-amethyst"
          >
            <div className="w-7 h-7 rounded bg-monokai-amethyst/10 border border-monokai-amethyst/20 flex items-center justify-center text-monokai-amethyst shrink-0 mt-0.5">
              <TrendingUp className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-meta font-medium text-monokai-fg group-hover:text-monokai-amethyst truncate">
                指标管理中心
              </span>
              <span className="text-2xs text-monokai-comment truncate mt-0.5 font-mono">
                声明式度量建模
              </span>
            </div>
          </div>

          {/* 12. 数据流画布 */}
          <div
            role="button"
            tabIndex={0}
            data-testid="action-dataflow"
            onClick={() => onNavigate(Tab.DATAFLOW)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onNavigate(Tab.DATAFLOW);
              }
            }}
            className="group flex items-start gap-2.5 p-2 rounded-lg bg-monokai-elevated hover:bg-monokai-border/40 border border-monokai-border hover:border-monokai-border-strong transition-all duration-150 cursor-pointer text-left shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-orange"
          >
            <div className="w-7 h-7 rounded bg-monokai-orange/10 border border-monokai-orange/20 flex items-center justify-center text-monokai-orange shrink-0 mt-0.5">
              <Network className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-meta font-medium text-monokai-fg group-hover:text-monokai-orange truncate">
                数据流画布
              </span>
              <span className="text-2xs text-monokai-comment truncate mt-0.5 font-mono">
                可视化流式编排
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Help Banner */}
      <div className="flex items-center justify-between mt-2.5 px-3 py-1.5 rounded-lg bg-monokai-elevated/60 border border-monokai-border text-meta text-monokai-comment">
        <div className="flex items-center gap-1.5 text-monokai-fg">
          <HelpCircle className="w-3 h-3 text-monokai-comment" />
          <span className="font-medium text-monokai-fg-muted">需要帮助？</span>
        </div>
        <a
          href="https://duckdb.org/docs/"
          target="_blank"
          rel="noreferrer noopener"
          title="在新标签页中打开官方文档"
          className="group flex items-center gap-1 text-monokai-comment hover:text-monokai-accent transition-colors text-2xs font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent rounded px-1"
        >
          <span>查看文档 · 社区支持</span>
          <ExternalLink className="w-2.5 h-2.5 group-hover:text-monokai-accent transition-colors" />
        </a>
      </div>
    </div>
  );
};
