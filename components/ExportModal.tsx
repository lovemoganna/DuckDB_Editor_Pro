/**
 * ExportModal - 基于 MECE 原则的 DuckDB 导出模态框
 *
 * 支持三种导出类型：
 * 1. Schema（DDL）- 数据库结构定义
 * 2. Data（DML）- 数据内容
 * 3. Full Backup - 完整备份
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  FileCode,
  Database,
  Package,
  Check,
  ChevronRight,
  Loader2,
  FileText,
  FileJson,
  FileSpreadsheet
} from 'lucide-react';
import { duckDBService } from '../services/duckdbService';
import { encodeCSV, downloadExcel } from '../utils/exportUtils';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// MECE 导出类型
type ExportType = 'schema' | 'data' | 'full';

// 导出格式
type ExportFormat = 'sql' | 'csv' | 'parquet' | 'json' | 'excel';

// MECE 分类配置
const EXPORT_TYPES = [
  {
    id: 'schema' as ExportType,
    label: 'Schema 导出',
    icon: FileCode,
    color: 'blue',
    description: '导出数据库结构定义（CREATE TABLE/VIEW/SEQUENCE）',
    formats: ['sql'] as ExportFormat[]
  },
  {
    id: 'data' as ExportType,
    label: '数据导出',
    icon: Database,
    color: 'green',
    description: '导出数据内容（INSERT 语句或查询结果）',
    formats: ['sql', 'csv', 'excel', 'parquet', 'json'] as ExportFormat[]
  },
  {
    id: 'full' as ExportType,
    label: '完整备份',
    icon: Package,
    color: 'purple',
    description: '导出完整数据库（Schema + Data）',
    formats: ['sql', 'json'] as ExportFormat[]
  }
];

// 格式配置
const FORMAT_CONFIG: Record<ExportFormat, { label: string; ext: string; icon: React.ElementType; color: string }> = {
  sql: { label: 'SQL', ext: 'sql', icon: FileCode, color: 'orange' },
  csv: { label: 'CSV', ext: 'csv', icon: FileSpreadsheet, color: 'green' },
  parquet: { label: 'Parquet', ext: 'parquet', icon: Database, color: 'blue' },
  json: { label: 'JSON', ext: 'json', icon: FileJson, color: 'yellow' },
  excel: { label: 'Excel', ext: 'xlsx', icon: FileSpreadsheet, color: 'green' }
};

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  const [exportType, setExportType] = useState<ExportType>('schema');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('sql');
  const [isExporting, setIsExporting] = useState(false);
  const [preview, setPreview] = useState<string>('');
  const [tables, setTables] = useState<string[]>([]);

  // 加载表列表
  useEffect(() => {
    const loadTables = async () => {
      try {
        const t = await duckDBService.getTables();
        setTables(t);
      } catch (e) {
        console.error('Failed to load tables:', e);
      }
    };
    if (isOpen) loadTables();
  }, [isOpen]);

  // 当类型或格式改变时，更新可用格式
  useEffect(() => {
    const typeConfig = EXPORT_TYPES.find(t => t.id === exportType);
    if (typeConfig && typeConfig.formats.includes(exportFormat)) {
      // 格式可用，保持不变
    } else {
      // 默认选择第一个可用格式
      setExportFormat(typeConfig?.formats[0] || 'sql');
    }
  }, [exportType]);

  // 生成预览
  useEffect(() => {
    const generatePreview = async () => {
      if (!isOpen) return;

      try {
        if (exportType === 'schema') {
          const schema = await duckDBService.exportSchema();
          setPreview(schema.slice(0, 1000) + (schema.length > 1000 ? '\n...' : ''));
        } else if (exportType === 'data') {
          if (exportFormat === 'sql') {
            const data = await duckDBService.exportDataAsSQL();
            setPreview(data.slice(0, 1000) + (data.length > 1000 ? '\n...' : ''));
          } else {
            setPreview(`# ${exportFormat.toUpperCase()} 格式预览\n# 实际导出将包含 ${tables.length} 个表的数据`);
          }
        } else {
          if (exportFormat === 'sql') {
            const schema = await duckDBService.exportSchema();
            const data = await duckDBService.exportDataAsSQL();
            setPreview((schema + '\n' + data).slice(0, 1000) + '...');
          } else {
            setPreview(`# JSON 完整备份预览\n# 将包含 ${tables.length} 个表的结构和数据`);
          }
        }
      } catch (e: any) {
        setPreview(`预览生成失败: ${e.message}`);
      }
    };

    generatePreview();
  }, [isOpen, exportType, exportFormat, tables]);

  // 执行导出
  const handleExport = async () => {
    setIsExporting(true);

    try {
      let blob: Blob;
      let filename: string;
      const timestamp = new Date().toISOString().split('T')[0];

      if (exportType === 'schema') {
        const content = await duckDBService.exportSchema();
        blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        filename = `duckdb_schema_${timestamp}.sql`;
      } else if (exportType === 'data') {
        if (exportFormat === 'sql') {
          const content = await duckDBService.exportDataAsSQL();
          blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
          filename = `duckdb_data_${timestamp}.sql`;
        } else if (exportFormat === 'csv') {
          // 导出为 CSV - 合并所有表
          let csvContent = '';
          for (const table of tables) {
            const data = await duckDBService.query(`SELECT * FROM "${table}"`);
            const rows = Array.isArray(data) ? data : [data];
            if (rows.length > 0) {
              const headers = Object.keys(rows[0]);
              csvContent += `# Table: ${table}\n`;
              csvContent += headers.join(',') + '\n';
              for (const row of rows) {
                csvContent += headers.map(h => JSON.stringify(row[h] ?? '')).join(',') + '\n';
              }
              csvContent += '\n';
            }
          }
          blob = encodeCSV(csvContent);
          filename = `duckdb_data_${timestamp}.csv`;
        } else if (exportFormat === 'excel') {
          // 导出为 Excel - 每个表一个 sheet
          const sheets = [];
          for (const table of tables) {
            const data = await duckDBService.query(`SELECT * FROM "${table}"`);
            const rows = Array.isArray(data) ? data : [data];
            if (rows.length > 0) {
              const headers = Object.keys(rows[0]);
              sheets.push({
                name: table.length > 30 ? table.slice(0, 30) : table,
                headers,
                rows: rows.map(row => headers.map(h => row[h] ?? null as unknown as undefined)),
              });
            }
          }
          downloadExcel(sheets, `duckdb_data_${timestamp}.xlsx`);
          return; // skip the blob download below
        } else if (exportFormat === 'parquet') {
          // 导出为 Parquet（第一个表）
          if (tables.length > 0) {
            blob = await duckDBService.exportParquet(`SELECT * FROM "${tables[0]}"`, `export_${tables[0]}.parquet`);
          } else {
            blob = new Blob(['No data'], { type: 'text/plain' });
          }
          filename = `duckdb_data_${timestamp}.parquet`;
        } else {
          // JSON
          const dump: any = { tables: {} };
          for (const table of tables) {
            const data = await duckDBService.query(`SELECT * FROM "${table}"`);
            dump.tables[table] = data;
          }
          blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
          filename = `duckdb_data_${timestamp}.json`;
        }
      } else {
        // Full backup
        if (exportFormat === 'sql') {
          blob = await duckDBService.exportFullBackup('sql');
          filename = `duckdb_full_backup_${timestamp}.sql`;
        } else {
          blob = await duckDBService.exportFullBackup('json');
          filename = `duckdb_full_backup_${timestamp}.json`;
        }
      }

      // 下载文件
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      onClose();
    } catch (e: any) {
      console.error('Export failed:', e);
      alert(`导出失败: ${e.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  const currentTypeConfig = EXPORT_TYPES.find(t => t.id === exportType);
  const currentFormatConfig = FORMAT_CONFIG[exportFormat];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-4xl bg-monokai-bg border border-monokai-accent rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-monokai-accent bg-monokai-sidebar">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-monokai-orange to-monokai-yellow flex items-center justify-center">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-monokai-fg">导出数据库</h2>
              <p className="text-xs text-monokai-comment">基于 MECE 原则的分类导出</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-monokai-accent/30 text-monokai-comment transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex">
          {/* Left Panel - MECE Type Selection */}
          <div className="w-64 border-r border-monokai-accent p-4 bg-monokai-bg/50">
            <h3 className="text-sm font-semibold text-monokai-fg mb-3">导出类型</h3>
            <div className="space-y-2">
              {EXPORT_TYPES.map((type) => {
                const Icon = type.icon;
                const isActive = exportType === type.id;

                return (
                  <button
                    key={type.id}
                    onClick={() => setExportType(type.id)}
                    className={`w-full p-3 rounded-lg border transition-all text-left ${
                      isActive
                        ? `bg-monokai-${type.color}/10 border-monokai-${type.color} shadow-sm`
                        : 'bg-monokai-bg border-monokai-accent/50 hover:border-monokai-accent'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-4 h-4 text-monokai-${type.color}`} />
                      <span className={`text-sm font-medium ${isActive ? `text-monokai-${type.color}` : 'text-monokai-fg'}`}>
                        {type.label}
                      </span>
                      {isActive && <Check className={`w-3 h-3 text-monokai-${type.color} ml-auto`} />}
                    </div>
                    <p className="text-[10px] text-monokai-comment leading-tight">{type.description}</p>
                  </button>
                );
              })}
            </div>

            {/* Stats */}
            <div className="mt-6 p-3 bg-monokai-bg rounded-lg border border-monokai-accent/30">
              <div className="flex items-center justify-between text-xs">
                <span className="text-monokai-comment">表数量</span>
                <span className="text-monokai-fg font-bold">{tables.length}</span>
              </div>
            </div>
          </div>

          {/* Right Panel - Format & Preview */}
          <div className="flex-1 p-4">
            {/* Format Selection */}
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-monokai-fg mb-3">导出格式</h3>
              <div className="flex flex-wrap gap-2">
                {currentTypeConfig?.formats.map((fmt) => {
                  const config = FORMAT_CONFIG[fmt];
                  const Icon = config.icon;
                  const isSelected = exportFormat === fmt;

                  return (
                    <button
                      key={fmt}
                      onClick={() => setExportFormat(fmt)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                        isSelected
                          ? `bg-monokai-${config.color}/10 border-monokai-${config.color}`
                          : 'bg-monokai-bg border-monokai-accent/50 hover:border-monokai-accent'
                      }`}
                    >
                      <Icon className={`w-4 h-4 text-monokai-${config.color}`} />
                      <span className={`text-sm ${isSelected ? `text-monokai-${config.color}` : 'text-monokai-comment'}`}>
                        {config.label}
                      </span>
                      <span className="text-[10px] text-monokai-comment">.{config.ext}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Preview */}
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-monokai-fg mb-3">预览</h3>
              <div className="bg-monokai-sidebar rounded-lg border border-monokai-accent/50 p-3 h-64 overflow-auto">
                <pre className="text-xs font-mono text-monokai-comment whitespace-pre-wrap">
                  {preview || '加载预览中...'}
                </pre>
              </div>
            </div>

            {/* Export Button */}
            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-monokai-comment hover:text-monokai-fg rounded-lg hover:bg-monokai-accent/30 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleExport}
                disabled={isExporting || tables.length === 0}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-monokai-orange to-monokai-yellow text-white font-medium rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    导出中...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    导出 {currentTypeConfig?.label} ({currentFormatConfig.label})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
