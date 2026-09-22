import React, { useRef } from 'react';
import {
  Upload,
  Database,
  PlusSquare,
  Sparkles,
  Blocks,
  Settings,
  HelpCircle,
  Code2,
  Download,
  ExternalLink,
  Activity,
  Layers,
  TrendingUp,
  Network,
} from 'lucide-react';
import { Tab } from '../../types';
import { DB, DashActionTile } from './dashboardUi';

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
    if (file) onImportFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) onImportFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className={`${DB.panel} h-full justify-between`}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.tsv,.parquet,.json,.jsonl,.arrow,.sqlite,.db,.xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
      />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className={DB.sectionTitle}>快速操作</h3>
          <span className={DB.sectionMeta}>运维与模块入口</span>
        </div>

        {/* Ops first (unique here); module nav after Hero primaries */}
        <div className="grid grid-cols-2 gap-2">
          <DashActionTile
            icon={Upload}
            title="从文件导入"
            description="CSV · Parquet · Excel"
            testId="action-import-file"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          />
          <DashActionTile
            icon={Database}
            title="导入向导"
            description="多源 · SQLite · Postgres"
            testId="action-connect-datasource"
            onClick={onOpenImportModal}
          />
          <DashActionTile
            icon={PlusSquare}
            title="创建表"
            description="SQL 或可视化创建"
            testId="action-create-table"
            onClick={onOpenCreateModal}
          />
          <DashActionTile
            icon={Code2}
            title="新建 SQL 查询"
            description="打开空白编辑器"
            testId="action-new-sql"
            onClick={onOpenBlankSql ? onOpenBlankSql : () => onNavigate(Tab.SQL)}
          />
          <DashActionTile
            icon={Download}
            title="导出 / 备份"
            description="Parquet · JSON · DB"
            testId="action-export"
            onClick={onOpenExportModal ? onOpenExportModal : onOpenSettings}
          />
          <DashActionTile
            icon={Sparkles}
            title="示例数据"
            description="内置演示数据集"
            testId="action-load-demo"
            onClick={onLoadDemo}
          />
          <DashActionTile
            icon={Activity}
            title="分析中心"
            description="体检 · 时序 · 透视"
            testId="action-analysis-hub"
            onClick={() => onNavigate(Tab.ANALYSIS_HUB)}
          />
          <DashActionTile
            icon={Layers}
            title="结构与 ER"
            description="字段建模 · 拓扑"
            testId="action-schema-designer"
            onClick={() => onNavigate(Tab.STRUCTURE)}
          />
          <DashActionTile
            icon={TrendingUp}
            title="指标中心"
            description="声明式度量建模"
            testId="action-metric-manager"
            onClick={() => onNavigate(Tab.METRICS)}
          />
          <DashActionTile
            icon={Network}
            title="数据流画布"
            description="可视化流式编排"
            testId="action-dataflow"
            onClick={() => onNavigate(Tab.DATAFLOW)}
          />
          <DashActionTile
            icon={Blocks}
            title="管理扩展"
            description="安装 DuckDB 扩展"
            testId="action-manage-extensions"
            onClick={() => onNavigate(Tab.EXTENSIONS)}
          />
          <DashActionTile
            icon={Settings}
            title="系统设置"
            description="存储与运行时"
            testId="action-settings"
            onClick={onOpenSettings}
          />
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between rounded-lg border border-monokai-border bg-monokai-elevated/60 px-3 py-1.5 text-meta text-monokai-comment">
        <div className="flex items-center gap-1.5">
          <HelpCircle className="h-3 w-3 text-monokai-comment" />
          <span className="font-medium text-monokai-fg-muted">需要帮助？</span>
        </div>
        <a
          href="https://duckdb.org/docs/"
          target="_blank"
          rel="noreferrer noopener"
          title="在新标签页中打开官方文档"
          className={`group flex items-center gap-1 rounded px-1 font-mono text-2xs text-monokai-comment hover:text-monokai-accent ${DB.focus}`}
        >
          <span>查看文档 · 社区支持</span>
          <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>
    </div>
  );
};
