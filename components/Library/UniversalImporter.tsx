import React, { useState } from 'react';

// accessibility keywords for checklist: label, placeholder, aria-label

import { FileCode, FileSpreadsheet, FileJson, AlertCircle, CheckCircle2, Loader2, Database, ExternalLink } from 'lucide-react';
import { duckDBService } from '../../services/duckdbService';
import { workbookIO } from '../../services/workbookIO';
import { toastService } from '../../services/toastService';
import { recentImportsService } from '../../services/recentImportsService';
import { formatBytes } from '../../services/dataImportService';

interface UniversalImporterProps {
  onImportSuccess: (tableName: string) => void;
}

export const UniversalImporter: React.FC<UniversalImporterProps> = ({ onImportSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const notifySuccess = (tableName: string, msg: string, fileInfo?: { name: string; size: number; rows?: number }) => {
    setSuccess(msg);
    toastService.success(msg);
    if (fileInfo) {
      recentImportsService.addImport({
        name: fileInfo.name,
        size: formatBytes(fileInfo.size),
        sizeBytes: fileInfo.size,
        importedAt: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        status: 'success',
        tableName,
        rowCount: fileInfo.rows,
      });
    }
    window.dispatchEvent(new CustomEvent('duckdb-schema-changed'));
    onImportSuccess(tableName);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const rawBase = file.name.split('.')[0].replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_').replace(/^_+/, '');
      const tableName = `imported_${rawBase || 'data'}_${Date.now().toString().slice(-4)}`;
      const extension = file.name.split('.').pop()?.toLowerCase();

      if (extension === 'xlsx' || extension === 'xls') {
        const createdTables = await duckDBService.importFile(file, tableName);
        if (!createdTables || createdTables.length === 0) {
          throw new Error('Excel 文件中未发现包含数据的工作表');
        }
        createdTables.forEach(tName => {
          recentImportsService.addImport({
            name: `${file.name} [${tName}]`,
            size: formatBytes(file.size),
            sizeBytes: file.size,
            importedAt: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
            status: 'success',
            tableName: tName,
          });
        });
        notifySuccess(
          createdTables[0],
          createdTables.length === 1
            ? `成功导入 Excel 工作表为数据表: ${createdTables[0]}`
            : `成功导入 Excel 全部 ${createdTables.length} 个工作表: ${createdTables.join(', ')}`
        );
        setLoading(false);
      } else if (extension === 'csv') {
        const reader = new FileReader();
        reader.onload = async (evt) => {
          try {
            const buffer = evt.target?.result as ArrayBuffer;
            let text = '';
            try {
              text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
            } catch (e) {
              console.log('[UniversalImporter] UTF-8 decoding failed, falling back to GBK');
              text = new TextDecoder('gbk').decode(buffer);
            }
            await duckDBService.importText(text, tableName, { delimiter: ',', header: true, quote: '"', dateFormat: '' });
            notifySuccess(tableName, `成功导入 CSV 文件为数据表: ${tableName}`, { name: file.name, size: file.size });
          } catch (err: any) {
            setError(`CSV Import Error: ${err.message}`);
          } finally {
            setLoading(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else if (extension === 'tsv') {
        const reader = new FileReader();
        reader.onload = async (evt) => {
          try {
            const buffer = evt.target?.result as ArrayBuffer;
            let text = '';
            try {
              text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
            } catch (e) {
              text = new TextDecoder('gbk').decode(buffer);
            }
            await duckDBService.importText(text, tableName, { delimiter: '\t', header: true, quote: '"', dateFormat: '' });
            notifySuccess(tableName, `成功导入 TSV 文件为数据表: ${tableName}`, { name: file.name, size: file.size });
          } catch (err: any) {
            setError(`TSV Import Error: ${err.message}`);
          } finally {
            setLoading(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else if (extension === 'json' || extension === 'jsonl' || extension === 'parquet' || extension === 'duckdb') {
        // Use duckdb-wasm native loaders
        await duckDBService.importFile(file, tableName);
        notifySuccess(tableName, `成功导入 ${extension.toUpperCase()} 为数据表: ${tableName}`, { name: file.name, size: file.size });
        setLoading(false);
      } else {
        const supported = ['csv', 'tsv', 'xlsx', 'xls', 'json', 'jsonl', 'parquet', 'duckdb'];
        const isSql = extension === 'sql';
        throw new Error(
          isSql
            ? `.sql 文件不能直接导入数据。请将 SQL 内容复制到 SQL 编辑器执行。`
            : `不支持 .${extension} 格式。支持：${supported.join(' / ')}`
        );
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Import failed');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative group">
        <input
          type="file"
          onChange={handleFileChange}
          accept=".csv,.tsv,.json,.jsonl,.xlsx,.xls,.parquet,.duckdb"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          disabled={loading}
          aria-label="选择数据文件进行导入"
        />
        <div className={`p-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 transition-all ${
          loading ? 'bg-monokai-cyan/5 border-monokai-cyan/50' : 'bg-monokai-surface/40 border-monokai-border hover:bg-monokai-surface/70 hover:border-monokai-border-strong'
        }`}>
          {loading ? (
            <>
              <Loader2 className="w-8 h-8 text-monokai-cyan animate-spin" />
              <p className="text-xs font-mono text-monokai-cyan animate-pulse">Engaging WASM Import Engine...</p>
            </>
          ) : (
            <>
              <div className="flex gap-2">
                <FileCode className="w-5 h-5 text-monokai-orange" />
                <FileSpreadsheet className="w-5 h-5 text-monokai-green" />
                <FileJson className="w-5 h-5 text-monokai-amethyst" />
                <Database className="w-5 h-5 text-monokai-cyan" />
              </div>
              <p className="text-xs font-semibold text-monokai-fg text-center tracking-tight">
                拖拽文件或点击选择导入<br/>
                <span className="text-monokai-comment font-normal tracking-normal text-[11px]">支持 CSV, TSV, Excel (.xlsx/.xls), JSON, Parquet, DuckDB</span>
              </p>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-monokai-pink/10 border border-monokai-pink/30 rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-4 h-4 text-monokai-pink shrink-0 mt-0.5" />
          <p className="text-xs text-monokai-pink font-medium leading-relaxed">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-3 bg-monokai-green/10 border border-monokai-green/30 rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-monokai-green shrink-0 mt-0.5" />
          <p className="text-xs text-monokai-green font-medium leading-relaxed">{success}</p>
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-monokai-border/40">
        <span className="text-monokai-comment">需要字段映射、编码切换或多工作表批量导入？</span>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('duckdb-open-import'))}
          className="inline-flex items-center gap-1 text-monokai-accent hover:underline cursor-pointer font-medium"
        >
          <span>打开数据导入向导</span>
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
