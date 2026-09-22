import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  UploadCloud,
  FileText,
  Table2,
  Terminal,
  Database,
  Play,
  ArrowRight,
  Sparkles,
  ClipboardPaste,
  Globe,
  Loader2,
  Check,
  Download,
  X,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { duckDBService } from '../../services/duckdbService';
import { toastService } from '../../services/toastService';
import { DataProbeResult } from './types';
import { Tab } from '../../types';

interface InstantDataProbeProps {
  tables: string[];
  onNavigate: (tab: Tab) => void;
  setPendingSql: (sql: string) => void;
  setCurrentTable: (table: string) => void;
  onLoadDemoDataset: () => Promise<void>;
  isSeedingDemo: boolean;
  onRefreshTables: () => Promise<void>;
}

export const InstantDataProbe: React.FC<InstantDataProbeProps> = ({
  tables,
  onNavigate,
  setPendingSql,
  setCurrentTable,
  onLoadDemoDataset,
  isSeedingDemo,
  onRefreshTables,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Probe Source Mode
  const [probeMode, setProbeMode] = useState<'drop' | 'table' | 'url'>('drop');
  const [selectedExistingTable, setSelectedExistingTable] = useState<string>(tables[0] || '');
  const [urlInput, setUrlInput] = useState('');

  // Probing State
  const [isProbing, setIsProbing] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [probeResult, setProbeResult] = useState<DataProbeResult | null>(null);

  // Materialization state
  const [isMaterializing, setIsMaterializing] = useState(false);
  const [materializeTableName, setMaterializeTableName] = useState('');
  const [showMaterializeInput, setShowMaterializeInput] = useState(false);

  // Auto-sync selected existing table when tables change
  useEffect(() => {
    if (tables.length > 0 && (!selectedExistingTable || !tables.includes(selectedExistingTable))) {
      setSelectedExistingTable(tables[0]);
    }
  }, [tables, selectedExistingTable]);

  // Handle file probing
  const handleProbeFile = async (file: File) => {
    setIsProbing(true);
    try {
      const res = await duckDBService.probeFile(file);
      setProbeResult({
        name: res.name,
        sourceType: 'file',
        sizeBytes: res.sizeBytes,
        columns: res.columns,
        previewRows: res.previewRows,
        selectSource: res.selectSource,
        elapsedMs: res.elapsedMs,
      });
      const cleanName = file.name
        .split('.')[0]
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .toLowerCase() || 'probed_table';
      setMaterializeTableName(cleanName);
      setShowMaterializeInput(false);
      toastService.success(`已探测文件：“${file.name}”（耗时 ${res.elapsedMs}ms）`);
    } catch (err: any) {
      console.error('Probe file error:', err);
      toastService.error(`文件探测失败: ${err?.message || '无法解析文件'}`);
    } finally {
      setIsProbing(false);
    }
  };

  // Handle table probing
  const handleProbeTable = async (tableName: string) => {
    if (!tableName) return;
    setIsProbing(true);
    try {
      const res = await duckDBService.probeTable(tableName);
      setProbeResult({
        name: res.name,
        sourceType: 'table',
        rowCount: res.rowCount,
        columns: res.columns,
        previewRows: res.previewRows,
        selectSource: res.selectSource,
        elapsedMs: res.elapsedMs,
      });
      setSelectedExistingTable(tableName);
      setShowMaterializeInput(false);
    } catch (err: any) {
      console.error('Probe table error:', err);
      toastService.error(`数据表探测失败: ${err?.message || '无法读取表'}`);
    } finally {
      setIsProbing(false);
    }
  };

  // Handle clipboard text probing
  const handleProbeText = async (text: string) => {
    if (!text.trim()) return;
    setIsProbing(true);
    try {
      const res = await duckDBService.probeText(text);
      setProbeResult({
        name: '剪贴板表格',
        sourceType: 'clipboard',
        sizeBytes: res.sizeBytes,
        columns: res.columns,
        previewRows: res.previewRows,
        selectSource: res.selectSource,
        elapsedMs: res.elapsedMs,
      });
      setMaterializeTableName(`paste_${Date.now().toString().slice(-4)}`);
      setShowMaterializeInput(false);
      toastService.success(`已成功从剪贴板解析表格（耗时 ${res.elapsedMs}ms）`);
    } catch (err: any) {
      console.error('Probe text error:', err);
      toastService.error(`剪贴板解析失败: ${err?.message || '请确认包含规范表格文本'}`);
    } finally {
      setIsProbing(false);
    }
  };

  // Handle remote URL probing
  const handleProbeUrl = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      toastService.warning('请输入有效的远程 Parquet 或数据 URL');
      return;
    }
    setIsProbing(true);
    const start = performance.now();
    try {
      const selectSource = `'${trimmed.replace(/'/g, "''")}'`;
      const schemaRes = await duckDBService.query(`DESCRIBE SELECT * FROM ${selectSource};`);
      const cols = (schemaRes || []).map((r: any) => ({
        name: String(r.column_name || r.name || ''),
        type: String(r.column_type || r.type || 'UNKNOWN'),
      }));
      const previewRows = await duckDBService.query(`SELECT * FROM ${selectSource} LIMIT 5;`);
      const elapsedMs = +(performance.now() - start).toFixed(2);

      const urlName = trimmed.split('/').pop()?.split('?')[0] || 'remote_data';
      setProbeResult({
        name: urlName,
        sourceType: 'url',
        columns: cols,
        previewRows: previewRows || [],
        selectSource,
        elapsedMs,
      });
      setMaterializeTableName(urlName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase());
      setShowMaterializeInput(false);
      toastService.success(`已成功探查远程数据源（耗时 ${elapsedMs}ms）`);
    } catch (err: any) {
      console.error('Probe url error:', err);
      toastService.error(`远程数据源探查失败: ${err?.message || '网络或格式异常'}`);
    } finally {
      setIsProbing(false);
    }
  };

  // Clipboard paste listener on container
  const handlePasteEvent = useCallback((e: ClipboardEvent) => {
    const text = e.clipboardData?.getData('text');
    if (text && (text.includes('\t') || text.includes(',') || text.includes('\n'))) {
      void handleProbeText(text);
    }
  }, []);

  useEffect(() => {
    const elem = containerRef.current;
    if (!elem) return;
    const onPaste = (e: ClipboardEvent) => handlePasteEvent(e);
    elem.addEventListener('paste', onPaste);
    return () => elem.removeEventListener('paste', onPaste);
  }, [handlePasteEvent]);

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0];
      const cleanName = file.name
        .split('.')[0]
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .toLowerCase() || 'imported_table';
      if (tables.length === 0 && typeof duckDBService.importFile === 'function') {
        void duckDBService.importFile(file, cleanName).then(() => onRefreshTables()).catch(() => {});
      }
      void handleProbeFile(file);
    }
  };

  // File input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleProbeFile(file);
    }
    e.target.value = '';
  };

  // 1-Click Materialize to Table
  const handleExecuteMaterialize = async () => {
    if (!probeResult || !materializeTableName.trim()) return;
    const cleanName = materializeTableName.trim().replace(/"/g, '""');
    setIsMaterializing(true);
    try {
      await duckDBService.query(
        `CREATE TABLE "${cleanName}" AS SELECT * FROM ${probeResult.selectSource};`
      );
      await onRefreshTables();
      setCurrentTable(cleanName);
      toastService.success(`已成功物化入库为表：“${cleanName}”`);
      setShowMaterializeInput(false);
      // Switch to table mode for this table
      void handleProbeTable(cleanName);
    } catch (err: any) {
      console.error('Materialize error:', err);
      toastService.error(`物化入库失败: ${err?.message || 'SQL 执行异常'}`);
    } finally {
      setIsMaterializing(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative rounded-md border border-monokai-border bg-monokai-surface/95 backdrop-blur-sm overflow-hidden font-sans transition-all shadow-xs"
    >
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept=".parquet,.csv,.tsv,.json,.xlsx,.xls,.arrow,.duckdb,.db,.sqlite"
        className="hidden"
        aria-label="选择数据文件进行探测"
      />

      {/* Top Header & Source Mode Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-monokai-border bg-monokai-elevated/70 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-monokai-cyan/15 text-monokai-cyan">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div className="flex items-center gap-1.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-monokai-fg">
              DuckDB 原生即席探查雷达
            </h2>
            <span className="rounded-md bg-monokai-bg border border-monokai-border px-1.5 py-0.2 font-mono text-2xs text-monokai-comment">
              Instant Data Probe
            </span>
          </div>
        </div>

        {/* Source Switcher Pills */}
        <div className="flex items-center gap-1 bg-monokai-bg p-0.5 rounded-md border border-monokai-border">
          <button
            type="button"
            onClick={() => {
              setProbeMode('drop');
              setProbeResult(null);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-colors cursor-pointer ${
              probeMode === 'drop'
                ? 'bg-monokai-surface text-monokai-cyan font-bold shadow-2xs'
                : 'text-monokai-comment hover:text-monokai-fg'
            }`}
          >
            <UploadCloud className="h-3 w-3" />
            <span>本地文件 / 剪贴板</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setProbeMode('table');
              if (tables.length > 0) {
                void handleProbeTable(selectedExistingTable || tables[0]);
              } else {
                setProbeResult(null);
              }
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-colors cursor-pointer ${
              probeMode === 'table'
                ? 'bg-monokai-surface text-monokai-green font-bold shadow-2xs'
                : 'text-monokai-comment hover:text-monokai-fg'
            }`}
          >
            <Database className="h-3 w-3" />
            <span>库中已有表 ({tables.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setProbeMode('url');
              setProbeResult(null);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-colors cursor-pointer ${
              probeMode === 'url'
                ? 'bg-monokai-surface text-monokai-yellow font-bold shadow-2xs'
                : 'text-monokai-comment hover:text-monokai-fg'
            }`}
          >
            <Globe className="h-3 w-3" />
            <span>远程 URL</span>
          </button>
        </div>
      </div>

      {/* Main Probe Stage */}
      <div className="p-4 space-y-4">
        {/* URL Input Bar if in URL mode */}
        {probeMode === 'url' && !probeResult && (
          <div className="flex items-center gap-2 p-3 rounded-md border border-monokai-border bg-monokai-bg">
            <Globe className="h-4 w-4 text-monokai-yellow shrink-0 ml-1" />
            <input
              type="text"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') void handleProbeUrl();
              }}
              placeholder="输入公共 Parquet 或 CSV 文件的 HTTPS/S3 URL（例如 https://shell.duckdb.org/data/tpch/0_01/parquet/orders.parquet）"
              className="flex-1 bg-transparent text-xs text-monokai-fg placeholder:text-monokai-comment outline-none font-mono"
            />
            <button
              type="button"
              onClick={() => void handleProbeUrl()}
              disabled={isProbing || !urlInput.trim()}
              className="flex h-7 items-center gap-1.5 rounded-md border border-monokai-border bg-monokai-surface px-3 text-xs font-semibold text-monokai-fg hover:border-monokai-border-strong hover:bg-monokai-elevated transition-all cursor-pointer disabled:opacity-50"
            >
              {isProbing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3 w-3" />}
              <span>探查源</span>
            </button>
          </div>
        )}

        {/* Existing Table Selector if in Table mode */}
        {probeMode === 'table' && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-md border border-monokai-border bg-monokai-bg">
            <div className="flex items-center gap-2.5">
              <Database className="h-4 w-4 text-monokai-comment shrink-0" />
              <span className="text-xs text-monokai-fg-muted">选择要探查的原生数据表：</span>
              {tables.length === 0 ? (
                <span className="text-xs font-mono text-monokai-comment">库中暂无数据表</span>
              ) : (
                <select
                  value={selectedExistingTable}
                  onChange={e => void handleProbeTable(e.target.value)}
                  className="rounded-md border border-monokai-border bg-monokai-surface px-2.5 py-1 text-xs font-mono font-medium text-monokai-fg outline-none focus:border-monokai-border-strong cursor-pointer"
                >
                  {tables.map(tbl => (
                    <option key={tbl} value={tbl}>
                      {tbl}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {tables.length > 0 && (
              <button
                type="button"
                onClick={() => void handleProbeTable(selectedExistingTable)}
                disabled={isProbing}
                className="flex items-center gap-1 text-xs text-monokai-comment hover:text-monokai-cyan transition-colors cursor-pointer"
              >
                <RefreshCw className={`h-3 w-3 ${isProbing ? 'animate-spin' : ''}`} />
                <span>刷新探查</span>
              </button>
            )}
          </div>
        )}

        {/* Probing In-Progress Indicator */}
        {isProbing && (
          <div className="flex h-36 flex-col items-center justify-center gap-2.5 rounded-md border border-dashed border-monokai-border bg-monokai-surface/40">
            <Loader2 className="h-6 w-6 animate-spin text-monokai-fg" />
            <span className="text-xs font-mono text-monokai-fg">
              DuckDB WASM 正在实时分析 Schema 与行样本…
            </span>
          </div>
        )}

        {/* IDLE STATE: DROPZONE & 3 LAUNCHPAD CARDS */}
        {!isProbing && !probeResult && probeMode === 'drop' && (
          <div className="space-y-3.5">
            {/* Drop Zone Box */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`group flex flex-col items-center justify-center rounded-md border-2 border-dashed py-8 px-4 text-center transition-all cursor-pointer ${
                isDraggingOver
                  ? 'border-monokai-border-strong bg-monokai-elevated/40 scale-[1.005]'
                  : 'border-monokai-border hover:border-monokai-border-strong hover:bg-monokai-surface/40'
              }`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-monokai-elevated border border-monokai-border group-hover:border-monokai-border-strong group-hover:text-monokai-fg transition-colors mb-2.5">
                <UploadCloud className="h-5 w-5 text-monokai-comment group-hover:text-monokai-fg" />
              </div>
              <p className="text-xs font-semibold text-monokai-fg transition-colors">
                {isDraggingOver ? '释放文件以立即导入' : '拖入数据文件 或 点击选择'}
              </p>
              <p className="mt-1 text-meta font-mono text-monokai-comment">
                支持 Parquet · CSV · TSV · JSON · Excel (.xlsx) · DuckDB · Arrow（零复制免落盘即席探查）
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded bg-monokai-bg border border-monokai-border px-2 py-0.5 text-2xs font-mono text-monokai-comment">
                  <ClipboardPaste className="h-3 w-3 text-monokai-comment" />
                  支持直接在此处 Ctrl+V 粘贴表格文本
                </span>
              </div>
            </div>

            {/* 3 Core Launchpad Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Card 1: New Query */}
              <div
                onClick={() => onNavigate(Tab.SQL)}
                className="group flex flex-col justify-between p-4 rounded-md border border-monokai-border bg-monokai-bg hover:border-monokai-border-strong hover:bg-monokai-elevated/40 transition-all cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded bg-monokai-surface text-monokai-comment border border-monokai-border">
                      <Terminal className="h-4 w-4" />
                    </div>
                    <span className="text-2xs font-mono text-monokai-comment">Ctrl + Enter</span>
                  </div>
                  <h3 className="text-xs font-bold text-monokai-fg group-hover:text-monokai-fg transition-colors">
                    新建空白 SQL 查询
                  </h3>
                  <p className="mt-1 text-meta text-monokai-comment leading-relaxed">
                    打开全功能三栏式 SQL 即席编辑台，编写并执行高性能分析查询。
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-1 text-xs font-mono font-medium text-monokai-fg">
                  <span>直达查询台</span>
                  <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              {/* Card 2: Demo Dataset */}
              <div
                onClick={() => void onLoadDemoDataset()}
                className="group flex flex-col justify-between p-4 rounded-md border border-monokai-border bg-monokai-surface/40 hover:border-monokai-border-strong hover:bg-monokai-surface/70 transition-all cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded bg-monokai-surface text-monokai-fg border border-monokai-border">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <span className="text-2xs font-mono text-monokai-comment font-bold">1-Click</span>
                  </div>
                  <h3 className="text-xs font-bold text-monokai-fg">
                    载入官方电商 6 表 Demo
                  </h3>
                  <p className="mt-1 text-meta text-monokai-comment leading-relaxed">
                    一键初始化真实业务数据：客户、订单、明细、商品、类目与事件流。
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-1 text-xs font-mono font-bold text-monokai-green">
                  <span>{isSeedingDemo ? '正在载入…' : '立即载入示例'}</span>
                  <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              {/* Card 3: Tables Overview or Quick Navigation */}
              <div
                onClick={() => onNavigate(Tab.DATA)}
                className="group flex flex-col justify-between p-4 rounded-md border border-monokai-border bg-monokai-bg hover:border-monokai-border-strong hover:bg-monokai-elevated/40 transition-all cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded bg-monokai-surface text-monokai-amethyst border border-monokai-border">
                      <Table2 className="h-4 w-4" />
                    </div>
                    <span className="text-2xs font-mono text-monokai-comment">
                      {tables.length} 张已有表
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-monokai-fg group-hover:text-monokai-amethyst transition-colors">
                    数据表格与结构网格
                  </h3>
                  <p className="mt-1 text-meta text-monokai-comment leading-relaxed">
                    以电子表格形式直接浏览、筛选、排序与原地编辑库中的真实数据行。
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-1 text-xs font-mono font-bold text-monokai-amethyst">
                  <span>打开数据网格</span>
                  <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ACTIVE PROBE RESULT VIEW (100% REAL DUCKDB OUTPUT) */}
        {!isProbing && probeResult && (
          <div className="space-y-3 rounded-md border border-monokai-border bg-monokai-bg p-3.5">
            {/* Result Header Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-monokai-border pb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-monokai-surface text-monokai-comment border border-monokai-border">
                  {probeResult.sourceType === 'table' ? (
                    <Database className="h-4 w-4" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-mono font-bold text-monokai-fg truncate">
                      {probeResult.name}
                    </h3>
                    <span className="rounded bg-monokai-surface border border-monokai-border px-1.5 py-0.2 font-mono text-2xs text-monokai-green">
                      DuckDB 原生解析就绪 · {probeResult.elapsedMs}ms
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-meta text-monokai-comment mt-0.5">
                    {probeResult.sizeBytes !== undefined && (
                      <span>大小：{(probeResult.sizeBytes / 1024).toFixed(1)} KB</span>
                    )}
                    {probeResult.rowCount !== undefined && (
                      <span>总计：{probeResult.rowCount} 行</span>
                    )}
                    <span>·</span>
                    <span>{probeResult.columns.length} 个字段</span>
                    <span>·</span>
                    <span className="text-monokai-fg-muted">已就绪前 5 行样本</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {/* Action 1: Straight to SQL */}
                <button
                  type="button"
                  onClick={() => {
                    setPendingSql(`SELECT * FROM ${probeResult.selectSource} LIMIT 50;`);
                    onNavigate(Tab.SQL);
                  }}
                  className="flex h-7 items-center gap-1.5 rounded-md border border-monokai-border bg-monokai-surface px-3 text-xs font-semibold text-monokai-fg hover:border-monokai-border-strong hover:bg-monokai-elevated transition-all cursor-pointer shadow-xs"
                >
                  <Terminal className="h-3 w-3" />
                  <span>免导直通 SQL 查询 →</span>
                </button>

                {/* Action 2: Materialize to Table if external */}
                {probeResult.sourceType !== 'table' && (
                  <button
                    type="button"
                    onClick={() => setShowMaterializeInput(!showMaterializeInput)}
                    className="flex h-7 items-center gap-1.5 rounded-md border border-monokai-border bg-monokai-surface px-3 text-xs font-semibold text-monokai-fg hover:border-monokai-border-strong hover:bg-monokai-elevated transition-all cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    <span>物化为表</span>
                  </button>
                )}

                {/* Action for existing table: view in Data Tab */}
                {probeResult.sourceType === 'table' && (
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentTable(probeResult.name);
                      onNavigate(Tab.DATA);
                    }}
                    className="flex h-7 items-center gap-1.5 rounded-md border border-monokai-border bg-monokai-surface px-3 text-xs font-semibold text-monokai-fg hover:border-monokai-border-strong hover:bg-monokai-elevated transition-all cursor-pointer"
                  >
                    <Table2 className="h-3 w-3" />
                    <span>在数据网格中查看</span>
                  </button>
                )}

                {/* Action: SUMMARIZE */}
                <button
                  type="button"
                  onClick={() => {
                    setPendingSql(`SUMMARIZE ${probeResult.selectSource};`);
                    onNavigate(Tab.SQL);
                  }}
                  className="flex h-7 items-center gap-1.5 rounded-md border border-monokai-border bg-monokai-elevated px-2.5 text-xs font-mono text-monokai-fg hover:border-monokai-border-strong hover:bg-monokai-hover transition-all cursor-pointer"
                  title="执行 DuckDB 原生 SUMMARIZE 数据质量画像"
                >
                  <span>SUMMARIZE 画像</span>
                </button>

                {/* Dismiss Probe */}
                <button
                  type="button"
                  onClick={() => setProbeResult(null)}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-monokai-border bg-monokai-surface text-monokai-comment hover:text-monokai-fg hover:bg-monokai-elevated transition-colors cursor-pointer"
                  title="关闭探测视图"
                  aria-label="关闭探测视图"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Inline Materialize Input Panel if opened */}
            {showMaterializeInput && (
              <div className="flex items-center gap-2 p-2.5 rounded-md border border-monokai-border bg-monokai-surface/40">
                <span className="text-xs font-semibold text-monokai-fg">物化为表：</span>
                <input
                  type="text"
                  value={materializeTableName}
                  onChange={e => setMaterializeTableName(e.target.value)}
                  placeholder="输入目标表名"
                  className="h-7 w-48 rounded-md border border-monokai-border bg-monokai-surface px-2 text-xs font-mono text-monokai-fg outline-none focus:border-monokai-border-strong"
                />
                <button
                  type="button"
                  onClick={() => void handleExecuteMaterialize()}
                  disabled={isMaterializing || !materializeTableName.trim()}
                  className="flex h-7 items-center gap-1 rounded-md bg-monokai-green px-3 text-xs font-bold text-monokai-bg hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isMaterializing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  <span>执行写入</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowMaterializeInput(false)}
                  className="text-xs text-monokai-comment hover:text-monokai-fg cursor-pointer ml-1"
                >
                  取消
                </button>
              </div>
            )}

            {/* Column Schema Type Badges */}
            <div className="flex flex-wrap items-center gap-1.5 py-1">
              <span className="text-meta font-mono text-monokai-comment mr-1">推断字段：</span>
              {probeResult.columns.map(col => (
                <span
                  key={col.name}
                  className="inline-flex items-center gap-1 rounded-md border border-monokai-border bg-monokai-surface px-2 py-0.5 font-mono text-2xs"
                >
                  <span className="font-semibold text-monokai-fg">{col.name}</span>
                  <span className="text-2xs text-monokai-cyan">{col.type}</span>
                </span>
              ))}
            </div>

            {/* Real 5-Row Mini-Table Preview */}
            <div className="rounded-md border border-monokai-border overflow-x-auto max-h-56 custom-scrollbar bg-monokai-bg">
              <table className="w-full border-collapse text-left font-mono text-meta">
                <thead>
                  <tr className="border-b border-monokai-border bg-monokai-elevated/80 sticky top-0 text-monokai-comment">
                    <th className="py-1.5 px-3 w-10 text-center font-normal">#</th>
                    {probeResult.columns.map(col => (
                      <th key={col.name} className="py-1.5 px-3 font-semibold text-monokai-fg-muted whitespace-nowrap">
                        {col.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {probeResult.previewRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={probeResult.columns.length + 1}
                        className="py-4 text-center text-monokai-comment text-xs"
                      >
                        （空数据源，未返回数据行）
                      </td>
                    </tr>
                  ) : (
                    probeResult.previewRows.map((row, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-monokai-border/40 hover:bg-monokai-surface/60 transition-colors"
                      >
                        <td className="py-1 px-3 text-center text-monokai-comment select-none">{idx + 1}</td>
                        {probeResult.columns.map(col => {
                          const val = row[col.name];
                          return (
                            <td key={col.name} className="py-1 px-3 whitespace-nowrap text-monokai-fg select-text">
                              {val === null || val === undefined ? (
                                <span className="text-monokai-comment italic">NULL</span>
                              ) : typeof val === 'object' ? (
                                JSON.stringify(val)
                              ) : (
                                String(val)
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
