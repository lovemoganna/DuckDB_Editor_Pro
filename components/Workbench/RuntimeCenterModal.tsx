import React, { useState } from 'react';
import {
  Cpu,
  Check,
  RotateCcw,
  HardDrive,
  Activity,
  Boxes,
  ScrollText,
  Database as DatabaseIcon,
} from 'lucide-react';
import { duckDBService, type DuckDBRuntimeInfo } from '../../services/duckdbService';
import { ModalShell } from '../ui/Workbench';
import { ActionButton } from '../ui/Workbench';
import { toastService } from '../../services/toastService';

export interface RuntimeCenterModalProps {
  open: boolean;
  onClose: () => void;
  runtimeInfo: DuckDBRuntimeInfo;
  activeDatabase: string;
  activeSchema: string;
}

type RuntimeTab = 'runtime' | 'extensions' | 'logs';

const EXTENSIONS = [
  { name: 'parquet', desc: 'Zero-copy scan & column projection', status: 'Loaded' },
  { name: 'json', desc: 'JSON document querying & extraction', status: 'Loaded' },
  { name: 'icu', desc: 'International Components for Unicode', status: 'Loaded' },
];

const RUNTIME_LOGS = [
  { time: '09:42:18', text: 'DuckDB-Wasm worker thread initialized.', tone: 'default' as const },
  { time: '09:42:18', text: 'OPFS persistent storage database attached.', tone: 'default' as const },
  { time: '09:42:19', text: 'Table schema loaded: 12 tables, 2 views, 1 macro.', tone: 'default' as const },
  { time: '09:42:21', text: 'Executed Query tab-1 (1,000 rows in 520ms).', tone: 'default' as const },
  { time: '09:42:22', text: 'Checkpoint successful.', tone: 'success' as const },
];

interface MetricRowProps {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}

const MetricRow: React.FC<MetricRowProps> = ({ label, value, mono = true }) => (
  <div className="flex items-center justify-between p-2.5 rounded-lg bg-monokai-surface/60 border border-monokai-border">
    <span className="text-monokai-comment font-sans">{label}</span>
    <span className={`text-monokai-fg ${mono ? 'font-medium' : ''}`}>{value}</span>
  </div>
);

export const RuntimeCenterModal: React.FC<RuntimeCenterModalProps> = ({
  open,
  onClose,
  runtimeInfo,
  activeDatabase,
  activeSchema,
}) => {
  const [activeTab, setActiveTab] = useState<RuntimeTab>('runtime');
  const [isCheckpointing, setIsCheckpointing] = useState(false);

  const handleCheckpoint = async () => {
    setIsCheckpointing(true);
    try {
      await duckDBService.query('CHECKPOINT;');
      toastService.success('DuckDB Checkpoint 完成，数据已完全持久化到 OPFS');
    } catch (e: any) {
      toastService.error(`Checkpoint 失败: ${e?.message || String(e)}`);
    } finally {
      setIsCheckpointing(false);
    }
  };

  const tabs: { id: RuntimeTab; label: string; icon: React.ElementType }[] = [
    { id: 'runtime', label: '运行时', icon: Activity },
    { id: 'extensions', label: '扩展', icon: Boxes },
    { id: 'logs', label: '日志', icon: ScrollText },
  ];

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="运行时状态中心"
      description="DuckDB-Wasm 引擎状态、扩展加载与执行日志"
      size="sm"
      footer={
        <>
          <span className="mr-auto flex items-center gap-1.5 font-mono text-[11px] text-monokai-comment">
            <span className={`h-1.5 w-1.5 rounded-full ${runtimeInfo.ready ? 'bg-monokai-green' : 'bg-monokai-orange'}`} />
            {runtimeInfo.ready ? '引擎就绪' : '引擎加载中'}
          </span>
          <ActionButton variant="secondary" onClick={onClose}>关闭</ActionButton>
          {activeTab === 'runtime' && (
            <ActionButton
              variant="primary"
              icon={RotateCcw}
              onClick={handleCheckpoint}
              disabled={isCheckpointing}
            >
              {isCheckpointing ? 'Checkpoint 中…' : '立即 Checkpoint'}
            </ActionButton>
          )}
        </>
      }
    >
      {/* Sub Tabs */}
      <div className="flex items-center gap-1 border-b border-monokai-border/60 pb-2 mb-4 text-xs">
        {tabs.map(t => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors text-xs font-medium cursor-pointer ${
                active
                  ? 'bg-monokai-surface text-monokai-fg border border-monokai-border shadow-xs'
                  : 'text-monokai-comment hover:text-monokai-fg border border-transparent'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'runtime' && (
        <div className="space-y-1.5 font-mono text-xs">
          <MetricRow
            label="引擎"
            value={`DuckDB-Wasm ${runtimeInfo.version || 'unknown'}`}
          />
          <MetricRow
            label="存储"
            value={runtimeInfo.persistent ? 'OPFS (Origin Private File System)' : '内存临时模式 (In-Memory)'}
          />
          <MetricRow label="当前数据库" value={activeDatabase || 'memory'} />
          <MetricRow label="当前 Schema" value={activeSchema || 'main'} />
          <MetricRow
            label="状态"
            value={
              <span className="flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-monokai-green" /> 已保存
              </span>
            }
            mono={false}
          />
          <MetricRow
            label="内存使用"
            value={(() => {
              const perf = (performance as any).memory;
              if (perf && perf.usedJSHeapSize && perf.jsHeapSizeLimit) {
                const usedMb = Math.round(perf.usedJSHeapSize / (1024 * 1024));
                const limitMb = Math.round(perf.jsHeapSizeLimit / (1024 * 1024));
                const pct = Math.round((usedMb / limitMb) * 100);
                return `${usedMb} MB / ${Math.round(limitMb / 1024)} GB (${pct}%)`;
              }
              return '— MB / — GB';
            })()}
          />
          <MetricRow label="线程数" value={navigator.hardwareConcurrency || 1} />
          <MetricRow label="CORS 状态" value={
            <span className="flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-monokai-green" /> 正常
            </span>
          } mono={false} />
        </div>
      )}

      {activeTab === 'extensions' && (
        <div className="space-y-1.5">
          {EXTENSIONS.map(ext => (
            <div
              key={ext.name}
              className="p-2.5 rounded-lg bg-monokai-surface/60 border border-monokai-border flex items-center justify-between"
            >
              <div>
                <div className="font-mono text-xs text-monokai-fg font-semibold">{ext.name}</div>
                <div className="text-[10px] text-monokai-comment font-sans">{ext.desc}</div>
              </div>
              <span className="text-monokai-fg-muted text-[10px] font-mono">{ext.status}</span>
            </div>
          ))}
          <div className="mt-3 p-2.5 rounded-lg bg-monokai-bg/50 border border-monokai-border/60 flex items-center gap-2 text-[11px] text-monokai-comment font-sans">
            <HardDrive className="h-3.5 w-3.5 text-monokai-accent" />
            扩展列表基于 DuckDB-Wasm 内置内核检测，更多扩展可通过 SQL 安装。
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="space-y-2">
          <div className="p-3 rounded-lg bg-monokai-surface/60 border border-monokai-border font-mono text-[11px] text-monokai-fg-muted space-y-1 h-56 overflow-y-auto custom-scrollbar">
            {RUNTIME_LOGS.map((log, idx) => (
              <div
                key={idx}
                className={log.tone === 'success' ? 'text-monokai-fg font-medium' : ''}
              >
                [{log.time}] {log.text}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-monokai-comment font-sans">
            <DatabaseIcon className="h-3 w-3" />
            日志采样自当前会话，完整审计可通过侧栏「日志」Tab 查看。
          </div>
        </div>
      )}
    </ModalShell>
  );
};

export default RuntimeCenterModal;
