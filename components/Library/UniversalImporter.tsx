import React, { useState } from 'react';
import { Upload, FileCode, FileSpreadsheet, FileJson, AlertCircle, CheckCircle2, Loader2, Database } from 'lucide-react';
import * as XLSX from 'xlsx';
import { duckDBService } from '../../services/duckdbService';

interface UniversalImporterProps {
  onImportSuccess: (tableName: string) => void;
}

export const UniversalImporter: React.FC<UniversalImporterProps> = ({ onImportSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const tableName = `imported_${file.name.split('.')[0].replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_${Date.now().toString().slice(-4)}`;
      const extension = file.name.split('.').pop()?.toLowerCase();

      if (extension === 'xlsx' || extension === 'xls') {
        // Handle Excel via xlsx library
        const reader = new FileReader();
        reader.onload = async (evt) => {
          try {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const csv = XLSX.utils.sheet_to_csv(ws);
            await duckDBService.importText(csv, tableName);
            setSuccess(`Successfully imported Excel sheet as table: ${tableName}`);
            onImportSuccess(tableName);
          } catch (err: any) {
            setError(`Excel Import Error: ${err.message}`);
          } finally {
            setLoading(false);
          }
        };
        reader.readAsBinaryString(file);
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
            await duckDBService.importText(text, tableName);
            setSuccess(`Successfully imported CSV as table: ${tableName}`);
            onImportSuccess(tableName);
          } catch (err: any) {
            setError(`CSV Import Error: ${err.message}`);
          } finally {
            setLoading(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else if (extension === 'json' || extension === 'parquet' || extension === 'duckdb') {
        // Use duckdb-wasm native loaders
        await duckDBService.importFile(file, tableName);
        setSuccess(`Successfully imported ${extension.toUpperCase()} as table: ${tableName}`);
        onImportSuccess(tableName);
        setLoading(false);
      } else {
        const supported = ['csv', 'xlsx', 'xls', 'json', 'parquet', 'duckdb'];
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
          accept=".csv,.json,.xlsx,.xls,.parquet,.duckdb"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          disabled={loading}
        />
        <div className={`p-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 transition-all ${
          loading ? 'bg-monokai-cyan/5 border-monokai-cyan/50' : 'bg-black/20 border-monokai-accent/20 group-hover:bg-monokai-cyan/5 group-hover:border-monokai-cyan/30'
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
                <FileJson className="w-5 h-5 text-monokai-purple" />
                <Database className="w-5 h-5 text-monokai-blue" />
              </div>
              <p className="text-xs font-bold text-monokai-fg text-center uppercase tracking-tighter">
                Drop File or Click to Import<br/>
                <span className="text-monokai-comment font-normal lowercase tracking-normal">CSV, Excel, JSON, Parquet, DuckDB</span>
              </p>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-monokai-red/10 border border-monokai-red/30 rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-4 h-4 text-monokai-red shrink-0 mt-0.5" />
          <p className="text-[10px] text-monokai-red font-medium leading-relaxed">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-3 bg-monokai-green/10 border border-monokai-green/30 rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-monokai-green shrink-0 mt-0.5" />
          <p className="text-[10px] text-monokai-green font-medium leading-relaxed">{success}</p>
        </div>
      )}
    </div>
  );
};
