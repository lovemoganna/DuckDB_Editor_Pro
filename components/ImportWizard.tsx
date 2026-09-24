import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { duckDBService } from '../services/duckdbService';
import { toastService } from '../services/toastService';
import { useConfirmDialog } from './ui/ConfirmDialog';
import {
  dataImportService,
  ImportSourceMode,
  ImportFileFormat,
  ConflictStrategy,
  ImportLifecycleState,
  ColumnMappingItem,
  ParseOptions,
  FileMetadataResult,
  ExcelSheetMetadata,
  DUCKDB_TYPE_OPTIONS,
  detectFormatFromName,
  formatBytes,
} from '../services/dataImportService';
import {
  UploadCloud,
  Link,
  ClipboardPaste,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Sparkles,
  Layers,
  ArrowUp,
  ArrowDown,
  Table2,
  Check,
  RefreshCw,
  X,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  FileSpreadsheet,
  Columns,
  ArrowUpDown,
  Pencil,
  AlertCircle,
  Database,
  Search,
  RotateCcw,
  ExternalLink,
  Code2,
  History,
  Copy,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  Sliders,
} from 'lucide-react';
import { recentImportsService, type RecentImportItem } from '../services/recentImportsService';

export interface ImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (createdTables?: string[]) => void;
  onRefreshTables: () => Promise<void>;
  onNotify?: (message: string, type: 'success' | 'error' | 'info') => void;
}

const PRESETS = [
  {
    name: 'titanic',
    label: 'Titanic 生存者数据集',
    tag: 'CSV · 891 行',
    desc: '经典二分类机器学习测试集，包含乘客舱位、年龄与生存状态',
    url: 'https://raw.githubusercontent.com/datasciencedojo/datasets/master/titanic.csv',
  },
  {
    name: 'iris',
    label: 'Iris 鸢尾花数据集',
    tag: 'CSV · 150 行',
    desc: '经典多变量测试集，含花萼与花瓣长宽及品种标签',
    url: 'https://raw.githubusercontent.com/mwaskom/seaborn-data/master/iris.csv',
  },
  {
    name: 'tips',
    label: 'Tips 餐饮小费消费集',
    tag: 'CSV · 244 行',
    desc: '餐饮行业消费分析，含账单总额、小费比例、性别与吸烟标记',
    url: 'https://raw.githubusercontent.com/mwaskom/seaborn-data/master/tips.csv',
  },
  {
    name: 'funds_flow',
    label: 'Google Sheets 资金流向多表数据集',
    tag: 'Excel · 8 表',
    desc: 'Google Sheets 远程 Excel 工作簿 (含用户、法币与加密交易数据)',
    url: 'https://docs.google.com/spreadsheets/d/1YRLbfW3qCs2PjSjt87-gqWevgkNRGdRqB-21ngGDWSs/export?format=xlsx',
  },
];

const FORMAT_OPTIONS: ImportFileFormat[] = ['CSV', 'TSV', 'JSON', 'Parquet', 'Excel'];

const DELIMITER_OPTIONS = [
  { value: ',', label: ', (逗号)' },
  { value: '\t', label: '\\t (制表符)' },
  { value: ';', label: '; (分号)' },
  { value: '|', label: '| (竖线)' },
  { value: ' ', label: '空格 (Space)' },
];

const QUOTE_OPTIONS = [
  { value: '"', label: '" (双引号)' },
  { value: "'", label: "' (单引号)" },
  { value: '', label: '无 (None)' },
];

const ENCODING_OPTIONS = [
  { value: 'UTF-8', label: 'UTF-8' },
  { value: 'GBK', label: 'GBK / GB18030' },
  { value: 'ISO-8859-1', label: 'ISO-8859-1' },
  { value: 'Windows-1252', label: 'Windows-1252' },
];

const CONFLICT_CARDS = [
  {
    id: 'replace' as ConflictStrategy,
    title: '覆盖替换',
    en: 'Drop & Replace',
    desc: '如果表已存在，先删除后创建',
    icon: Layers,
  },
  {
    id: 'append' as ConflictStrategy,
    title: '追加行数据',
    en: 'Append Rows',
    desc: '在现有表中追加新数据',
    icon: FileText,
  },
  {
    id: 'fail' as ConflictStrategy,
    title: '存在即报错',
    en: 'Fail If Exists',
    desc: '如果表已存在，则导入失败',
    icon: AlertTriangle,
  },
];

export const ImportWizard: React.FC<ImportWizardProps> = ({
  isOpen,
  onClose,
  onImportComplete,
  onRefreshTables,
  onNotify,
}) => {
  const { confirm } = useConfirmDialog();
  // ── 基础状态 ───────────────────────────────────────────
  const [mode, setMode] = useState<ImportSourceMode>('local');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');

  // ── 解析配置 ───────────────────────────────────────────
  const [parseOptions, setParseOptions] = useState<ParseOptions>({
    format: 'CSV',
    delimiter: ',',
    quote: '"',
    header: true,
    encoding: 'UTF-8',
    skipRows: 0,
    dateFormat: '',
  });
  const [showAdvanced, setShowAdvanced] = useState(false);

  // ── 目标表与冲突策略 ───────────────────────────────────
  const [schema, setSchema] = useState('main');
  const [availableSchemas, setAvailableSchemas] = useState<string[]>(['main']);
  const [tableName, setTableName] = useState('');
  const [conflictStrategy, setConflictStrategy] = useState<ConflictStrategy>('replace');

  // ── 多工作表 (Excel Multi-Sheet) 状态 ────────────────────
  const [sheets, setSheets] = useState<ExcelSheetMetadata[]>([]);
  const [activeSheetName, setActiveSheetName] = useState<string>('');
  const [showSheetNamesDrawer, setShowSheetNamesDrawer] = useState(false);

  // ── 生命周期与反馈 ─────────────────────────────────────
  const [lifecycleState, setLifecycleState] = useState<ImportLifecycleState>('IDLE');
  const [statusMessage, setStatusMessage] = useState('请选择或上传数据源文件');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationWarning, setValidationWarning] = useState<string | null>(null);

  // ── 数据与推断结果 ─────────────────────────────────────
  const [metadata, setMetadata] = useState<FileMetadataResult | null>(null);
  const [columns, setColumns] = useState<ColumnMappingItem[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, any>[]>([]);
  const [isRefreshingPreview, setIsRefreshingPreview] = useState(false);

  // ── 弹窗与二次确认 ─────────────────────────────────────
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSqlPreviewModal, setShowSqlPreviewModal] = useState(false);
  const [showRecentImportsModal, setShowRecentImportsModal] = useState(false);
  const [recentImportsList, setRecentImportsList] = useState<RecentImportItem[]>([]);
  const [copiedSql, setCopiedSql] = useState(false);
  const [editingColumnIdx, setEditingColumnIdx] = useState<number | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // ── 字段映射检索与过滤 ──────────────────────────────────
  const [columnSearch, setColumnSearch] = useState('');

  // ── 预览数据客户端轻量排序 ───────────────────────────────
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // 加载可用 Schema 列表
  const fetchSchemas = useCallback(async () => {
    try {
      const list = await duckDBService.getAvailableSchemas();
      const uniqueSchemas = Array.from(new Set(list));
      setAvailableSchemas(uniqueSchemas);
      if (!uniqueSchemas.includes(schema)) {
        setSchema(uniqueSchemas[0] || 'main');
      }
    } catch {
      setAvailableSchemas(['main']);
    }
  }, [schema]);

  useEffect(() => {
    if (isOpen) {
      void fetchSchemas();
    }
  }, [isOpen, fetchSchemas]);

  // 重置整个状态
  const handleReset = useCallback(() => {
    setMode('local');
    setFile(null);
    setIsDragging(false);
    setUrl('');
    setText('');
    setParseOptions({
      format: 'CSV',
      delimiter: ',',
      quote: '"',
      header: true,
      encoding: 'UTF-8',
      skipRows: 0,
      dateFormat: '',
    });
    setSchema('main');
    setTableName('');
    setConflictStrategy('replace');
    setSheets([]);
    setActiveSheetName('');
    setShowSheetNamesDrawer(false);
    setSortColumn(null);
    setSortDirection('asc');
    setColumnSearch('');
    setLifecycleState('IDLE');
    setStatusMessage('请选择或上传数据源文件');
    setValidationError(null);
    setValidationWarning(null);
    setMetadata(null);
    setColumns([]);
    setPreviewRows([]);
    setShowAdvanced(false);
    setShowHelpModal(false);
    setShowConfirmModal(false);
    setShowSqlPreviewModal(false);
    setShowRecentImportsModal(false);
    setCopiedSql(false);
    setIsSidebarCollapsed(false);
    setEditingColumnIdx(null);
    void dataImportService.cleanupVirtualFiles();
  }, []);

  const handleClose = () => {
    handleReset();
    onClose();
  };

  // 支持键盘 Escape 快捷键平滑关闭与 Ctrl+B 侧边栏切换
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        setIsSidebarCollapsed(prev => !prev);
        return;
      }
      if (e.key === 'Escape') {
        if (showHelpModal) {
          setShowHelpModal(false);
        } else if (showConfirmModal) {
          setShowConfirmModal(false);
        } else if (showSqlPreviewModal) {
          setShowSqlPreviewModal(false);
        } else if (showRecentImportsModal) {
          setShowRecentImportsModal(false);
        } else if (editingColumnIdx !== null) {
          setEditingColumnIdx(null);
        } else {
          handleClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showHelpModal, showConfirmModal, showSqlPreviewModal, showRecentImportsModal, editingColumnIdx]);

  // 点击空白区域自动收起字段类型下拉弹窗
  useEffect(() => {
    if (editingColumnIdx === null) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && !target.closest('[data-column-type-dropdown]')) {
        setEditingColumnIdx(null);
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [editingColumnIdx]);


  // ── 真实推断与嗅探 Pipeline ─────────────────────────────
  const runSniff = useCallback(async (
    targetMode: ImportSourceMode,
    targetFile: File | null,
    targetUrl: string,
    targetText: string,
    targetOptions: ParseOptions
  ) => {
    const hasSource =
      (targetMode === 'local' && targetFile) ||
      (targetMode === 'url' && targetUrl.trim()) ||
      (targetMode === 'paste' && targetText.trim());

    if (!hasSource) {
      return;
    }

    setLifecycleState('PARSING');
    setStatusMessage('正在解析文件结构与推断列类型...');
    setIsRefreshingPreview(true);
    setValidationError(null);

    try {
      const result = await dataImportService.sniffSource(
        targetMode,
        targetFile,
        targetUrl,
        targetText,
        targetOptions
      );

      setMetadata(result);

      if (result.sheets && result.sheets.length > 0) {
        setSheets(result.sheets);
        const active = result.sheets.find(s => s.name === result.activeSheetName) || result.sheets[0];
        setActiveSheetName(active.name);
        setColumns(active.columns);
        setPreviewRows(active.previewRows);
      } else {
        setSheets([]);
        setActiveSheetName('');
        setColumns(result.columns);
        setPreviewRows(result.previewRows);
      }

      setLifecycleState('READY');
      setStatusMessage('已准备好导入数据');

      // 若未设置表名，根据文件名自动填入
      setTableName(prev => {
        if (prev) return prev;
        const clean = result.fileName
          .split('.')[0]
          .replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_')
          .replace(/^_+/, '');
        return clean ? `${clean}_imported` : 'imported_table';
      });
    } catch (err: any) {
      console.warn('Sniffing source failed:', err);
      setLifecycleState('PARSE_ERROR');
      setStatusMessage(`解析错误: ${err?.message || '无法识别数据结构'}`);
    } finally {
      setIsRefreshingPreview(false);
    }
  }, []);

  // 监听数据源与配置变更，自动触发重新解析
  useEffect(() => {
    if (!isOpen) return;
    if (file || url.trim() || text.trim()) {
      const timer = setTimeout(() => {
        void runSniff(mode, file, url, text, parseOptions);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen, mode, file, url, text, parseOptions, runSniff]);

  // ── 工作表切换与配置交互 ────────────────────────────────
  const handleSheetTabClick = (sheetName: string) => {
    const targetSheet = sheets.find(s => s.name === sheetName);
    if (!targetSheet) return;
    setActiveSheetName(sheetName);
    setColumns(targetSheet.columns);
    setPreviewRows(targetSheet.previewRows);
    setSortColumn(null);
    setSortDirection('asc');
  };

  const handleToggleSheetSelection = (sheetName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSheets(prev =>
      prev.map(s => (s.name === sheetName ? { ...s, selected: !s.selected } : s))
    );
  };

  const handleToggleAllSheets = (selected: boolean) => {
    setSheets(prev => prev.map(s => (s.isEmpty || s.rowCount === 0 ? s : { ...s, selected })));
  };

  const handleSelectOnlyNonEmptySheets = () => {
    setSheets(prev => prev.map(s => ({ ...s, selected: !s.isEmpty && s.rowCount > 0 })));
  };

  const handleResetSheetNames = () => {
    const base = tableName.trim() || 'imported';
    setSheets(prev =>
      prev.map(s => {
        const cleanSheetName = s.name.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_').replace(/^_+/, '') || 'sheet';
        return {
          ...s,
          targetTableName: `${base}_${cleanSheetName}`,
        };
      })
    );
  };

  // 客户端轻量排序
  const handleSortColumn = (colName: string) => {
    if (sortColumn === colName) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn(null);
        setSortDirection('asc');
      }
    } else {
      setSortColumn(colName);
      setSortDirection('asc');
    }
  };

  // 智能文本粘贴检测
  const handleTextChange = (val: string) => {
    setText(val);
    const firstLine = val.trim().split(/\r?\n/)[0] || '';
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    if (tabCount > 0 && tabCount >= commaCount) {
      setParseOptions(prev => ({
        ...prev,
        format: 'TSV',
        delimiter: '\t',
      }));
    } else if (commaCount > 0 && commaCount > tabCount && parseOptions.delimiter === '\t') {
      setParseOptions(prev => ({
        ...prev,
        format: 'CSV',
        delimiter: ',',
      }));
    }
  };

  const handleBaseTableNameChange = (val: string) => {
    setTableName(val);
    if (sheets.length > 1) {
      setSheets(prev =>
        prev.map(s => {
          const cleanSheetName = s.name.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_').replace(/^_+/, '') || 'sheet';
          return {
            ...s,
            targetTableName: val.trim() ? `${val.trim()}_${cleanSheetName}` : `imported_${cleanSheetName}`,
          };
        })
      );
    } else if (sheets.length === 1) {
      setSheets(prev =>
        prev.map(s => ({
          ...s,
          targetTableName: val.trim() || 'imported_table',
        }))
      );
    }
  };

  const handleSheetTableNameChange = (sheetName: string, customName: string) => {
    setSheets(prev =>
      prev.map(s => (s.name === sheetName ? { ...s, targetTableName: customName } : s))
    );
  };

  // ── 目标表与冲突模式校验 ────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    if (lifecycleState === 'PARSING') return;

    let isMounted = true;
    const validate = async () => {
      const hasSource =
        (mode === 'local' && !!file) ||
        (mode === 'url' && !!url.trim()) ||
        (mode === 'paste' && !!text.trim());

      if (!hasSource) {
        if (isMounted) {
          setValidationError(null);
          setValidationWarning(null);
          setLifecycleState('IDLE');
          setStatusMessage('请选择或上传数据源文件');
        }
        return;
      }

      if (sheets.length > 1) {
        const selected = sheets.filter(s => s.selected);
        if (selected.length === 0) {
          if (isMounted) {
            setValidationError('请至少勾选一个要导入的工作表');
            setValidationWarning(null);
            setLifecycleState('VALIDATION_ERROR');
            setStatusMessage('请选择工作表');
          }
          return;
        }

        const names = selected.map(s => s.targetTableName.trim());
        if (names.some(n => !n)) {
          if (isMounted) {
            setValidationError('选中的工作表目标表名不能为空');
            setValidationWarning(null);
            setLifecycleState('VALIDATION_ERROR');
            setStatusMessage('请输入表名');
          }
          return;
        }

        const unique = new Set(names);
        if (unique.size !== names.length) {
          if (isMounted) {
            setValidationError('不同工作表的目标表名不能重复');
            setValidationWarning(null);
            setLifecycleState('VALIDATION_ERROR');
            setStatusMessage('表名冲突');
          }
          return;
        }
      } else {
        if (!tableName.trim()) {
          if (isMounted) {
            setValidationError('目标表名不能为空');
            setValidationWarning(null);
            setLifecycleState('VALIDATION_ERROR');
            setStatusMessage('请输入目标表名');
          }
          return;
        }
      }

      const checkTable = sheets.length > 1
        ? (sheets.find(s => s.selected)?.targetTableName || tableName)
        : tableName;

      const val = await dataImportService.validateTarget(
        schema,
        checkTable,
        conflictStrategy,
        columns
      );

      if (!isMounted) return;

      if (!val.valid) {
        setValidationError(val.error || '校验失败');
        setValidationWarning(null);
        setLifecycleState('VALIDATION_ERROR');
        setStatusMessage(val.error || '校验未通过');
      } else {
        setValidationError(null);
        setValidationWarning(val.warning || null);
        setLifecycleState('READY');
        setStatusMessage('已准备好导入数据');
      }
    };

    const timer = setTimeout(() => {
      void validate();
    }, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isOpen, schema, tableName, conflictStrategy, columns, lifecycleState, sheets, mode, file, url, text]);

  // ── 文件选择交互 ────────────────────────────────────────
  const handleFileChange = (selected: File) => {
    const detectedFmt = detectFormatFromName(selected.name);
    setFile(selected);
    const nextOpts: ParseOptions = {
      ...parseOptions,
      format: detectedFmt,
      delimiter: detectedFmt === 'TSV' ? '\t' : ',',
    };
    setParseOptions(nextOpts);
    void runSniff('local', selected, url, text, nextOpts);
  };

  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl);
    if (newUrl.trim()) {
      const detectedFmt = detectFormatFromName(newUrl);
      setParseOptions(prev => {
        if (prev.format === detectedFmt) return prev;
        return {
          ...prev,
          format: detectedFmt,
          delimiter: detectedFmt === 'TSV' ? '\t' : prev.delimiter === '\t' ? ',' : prev.delimiter,
        };
      });
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileChange(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // ── 格式选择器变更 ──────────────────────────────────────
  const handleFormatSelect = (fmt: ImportFileFormat) => {
    setParseOptions(prev => ({
      ...prev,
      format: fmt,
      delimiter: fmt === 'TSV' ? '\t' : prev.delimiter === '\t' ? ',' : prev.delimiter,
    }));
  };

  // ── 列映射修改 ──────────────────────────────────────────
  const handleColumnTargetNameChange = (idx: number, newName: string) => {
    setColumns(prev => {
      const next = prev.map((c, i) => (i === idx ? { ...c, targetName: newName } : c));
      if (sheets.length > 0 && activeSheetName) {
        setSheets(currSheets =>
          currSheets.map(s => (s.name === activeSheetName ? { ...s, columns: next } : s))
        );
      }
      return next;
    });
  };

  const handleColumnTypeChange = (idx: number, newType: string) => {
    setColumns(prev => {
      const next = prev.map((c, i) => (i === idx ? { ...c, overrideType: newType } : c));
      if (sheets.length > 0 && activeSheetName) {
        setSheets(currSheets =>
          currSheets.map(s => (s.name === activeSheetName ? { ...s, columns: next } : s))
        );
      }
      return next;
    });
  };

  const handleColumnNullableToggle = (idx: number) => {
    setColumns(prev => {
      const next = prev.map((c, i) => (i === idx ? { ...c, nullable: !c.nullable } : c));
      if (sheets.length > 0 && activeSheetName) {
        setSheets(currSheets =>
          currSheets.map(s => (s.name === activeSheetName ? { ...s, columns: next } : s))
        );
      }
      return next;
    });
  };

  // ── 导入执行 Pipeline ───────────────────────────────────
  const executeImportPipeline = async () => {
    // 1. 多工作表批量导入分支
    if (parseOptions.format === 'Excel' && sheets.length > 0) {
      const selectedSheets = sheets.filter(s => s.selected);
      if (selectedSheets.length === 0) {
        toastService.error('请至少勾选一个要导入的工作表');
        return;
      }
      const nonBlankSelected = selectedSheets.filter(s => !s.isEmpty && s.rawSqlSource);
      if (nonBlankSelected.length === 0) {
        toastService.error('选中的工作表均为空表，未包含可导入的数据');
        return;
      }

      setLifecycleState('IMPORTING');
      setStatusMessage(`正在写入 DuckDB 数据库 (${nonBlankSelected.length} 个工作表)...`);

      try {
        const batchItems = nonBlankSelected.map(s => ({
          sheetName: s.name,
          tableName: s.targetTableName || `${tableName}_${s.name}`,
          rawSqlSource: s.rawSqlSource,
          columns: s.columns,
        }));

        const { results, totalRows, createdTables } = await dataImportService.executeBatchImport(
          schema,
          batchItems,
          conflictStrategy
        );

        createdTables.forEach((tblName, i) => {
          const item = batchItems[i];
          const sMeta = nonBlankSelected.find(s => s.name === item?.sheetName);
          recentImportsService.addImport({
            name: `${file?.name || metadata?.fileName || 'excel_workbook'} [${item?.sheetName || tblName}]`,
            size: sMeta?.rowCount ? `${sMeta.rowCount.toLocaleString()} 行` : '—',
            sizeBytes: file?.size || metadata?.fileSizeBytes,
            importedAt: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
            status: 'success',
            tableName: tblName,
            rowCount: sMeta?.rowCount || 0,
          });
        });

        setLifecycleState('SUCCESS');
        const successMsg = `已成功导入 ${results.length} 个工作表，共 ${totalRows.toLocaleString()} 行数据`;
        setStatusMessage(successMsg);
        toastService.success(
          `成功导入 ${results.length} 个工作表 (${totalRows.toLocaleString()} 行): ${createdTables.join(', ')}`
        );
        if (onNotify) {
          onNotify(`成功导入 ${results.length} 个工作表到 Schema "${schema}"`, 'success');
        }

        await onRefreshTables();
        onImportComplete(createdTables);
        setShowConfirmModal(false);
        handleClose();
      } catch (err: any) {
        console.error('Batch import execution error:', err);
        setLifecycleState('IMPORT_ERROR');
        setStatusMessage(`写入失败: ${err?.message || 'DuckDB 执行异常'}`);
        toastService.error('导入失败', err?.message || '写入数据库失败');
        if (onNotify) {
          onNotify(`导入失败: ${err?.message}`, 'error');
        }
      }
      return;
    }

    // 2. 单表导入分支 (CSV / TSV / Parquet / JSON / 单表)
    let rawSqlSource = metadata?.rawSqlSource;
    let targetCols = columns;

    if (!rawSqlSource && (file || (mode === 'url' && url.trim()) || (mode === 'paste' && text.trim()))) {
      const res = await dataImportService.sniffSource(mode, file, url, text, parseOptions);
      rawSqlSource = res.rawSqlSource;
      targetCols = res.columns;
    }

    if (!rawSqlSource) {
      toastService.error('请先选择有效的数据源文件');
      return;
    }

    setLifecycleState('IMPORTING');
    setStatusMessage('正在写入 DuckDB 数据库并校验物理落库...');

    try {
      const result = await dataImportService.executeImport(
        rawSqlSource,
        schema,
        tableName,
        conflictStrategy,
        targetCols
      );

      const srcName = file?.name || metadata?.fileName || (mode === 'url' ? url.split('/').pop()?.split('?')[0] || 'remote_data' : 'pasted_data.txt');
      recentImportsService.addImport({
        name: srcName,
        size: metadata?.formattedSize || (file ? formatBytes(file.size) : `${result.rowCount} 行`),
        sizeBytes: file?.size || metadata?.fileSizeBytes,
        importedAt: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        status: 'success',
        tableName: result.tableName,
        rowCount: result.rowCount,
      });

      setLifecycleState('SUCCESS');
      setStatusMessage(`已成功导入 ${result.rowCount.toLocaleString()} 行数据`);
      toastService.success(
        `成功导入数据表 "${result.schema}.${result.tableName}" (${result.rowCount.toLocaleString()} 行)`
      );
      if (onNotify) {
        onNotify(`成功导入数据表 "${result.schema}.${result.tableName}"`, 'success');
      }

      await onRefreshTables();
      onImportComplete([result.tableName]);
      setShowConfirmModal(false);
      handleClose();
    } catch (err: any) {
      console.error('Import execution error:', err);
      setLifecycleState('IMPORT_ERROR');
      setStatusMessage(`写入失败: ${err?.message || 'DuckDB 执行异常'}`);
      toastService.error('导入失败', err?.message || '写入数据库失败');
      if (onNotify) {
        onNotify(`导入失败: ${err?.message}`, 'error');
      }
    }
  };

  const handleImportClick = () => {
    if (lifecycleState !== 'READY') return;
    if (conflictStrategy === 'replace' && validationWarning) {
      setShowConfirmModal(true);
      return;
    }
    void executeImportPipeline();
  };

  const displayColumns: ColumnMappingItem[] = columns;
  const displayPreviewRows = useMemo(() => {
    if (!sortColumn) return previewRows;
    return [...previewRows].sort((a, b) => {
      const valA = a[sortColumn];
      const valB = b[sortColumn];
      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      const numA = Number(valA);
      const numB = Number(valB);
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortDirection === 'asc' ? numA - numB : numB - numA;
      }
      const strA = String(valA);
      const strB = String(valB);
      return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [previewRows, sortColumn, sortDirection]);
  const filteredColumnsWithIndices = useMemo(() => {
    return columns
      .map((col, originalIndex) => ({ col, originalIndex }))
      .filter(({ col }) => {
        if (!columnSearch.trim()) return true;
        const q = columnSearch.toLowerCase();
        return (
          col.sourceName.toLowerCase().includes(q) ||
          col.targetName.toLowerCase().includes(q) ||
          (col.overrideType || col.inferredType).toLowerCase().includes(q)
        );
      });
  }, [columns, columnSearch]);

  const handleBatchResetColumns = () => {
    setColumns(prev =>
      prev.map(c => ({
        ...c,
        targetName: c.sourceName,
        overrideType: c.inferredType,
      }))
    );
  };

  const handleBatchLowercaseColumns = () => {
    setColumns(prev =>
      prev.map(c => ({
        ...c,
        targetName: c.targetName.toLowerCase(),
      }))
    );
  };

  const handleBatchSnakeCaseColumns = () => {
    setColumns(prev =>
      prev.map(c => ({
        ...c,
        targetName: c.targetName
          .trim()
          .replace(/[\s\-]+/g, '_')
          .replace(/([a-z])([A-Z])/g, '$1_$2')
          .replace(/__+/g, '_')
          .toLowerCase(),
      }))
    );
  };


  const generatedDuckDBSql = useMemo(() => {
    const cleanSchema = schema.trim() || 'main';
    const cleanTable = tableName.trim() || 'imported_table';

    if (parseOptions.format === 'Excel' && sheets.length > 0) {
      const selectedSheets = sheets.filter(s => s.selected && !s.isEmpty);
      if (selectedSheets.length === 0) {
        return '-- 尚未勾选有效的工作表进行导入';
      }
      return selectedSheets
        .map((s, idx) => {
          const targetT = s.targetTableName || `${cleanTable}_${s.name}`;
          const dropLine =
            conflictStrategy === 'replace'
              ? `DROP TABLE IF EXISTS "${cleanSchema}"."${targetT}";\n`
              : '';
          const proj =
            s.columns && s.columns.length > 0
              ? s.columns
                  .map(c => {
                    const castType = c.overrideType || c.inferredType;
                    return castType && castType !== 'ANY'
                      ? `CAST("${c.sourceName.replace(/"/g, '""')}" AS ${castType}) AS "${c.targetName.replace(/"/g, '""')}"`
                      : `"${c.sourceName.replace(/"/g, '""')}" AS "${c.targetName.replace(/"/g, '""')}"`;
                  })
                  .join(',\n    ')
              : '*';
          return `-- [${idx + 1}/${selectedSheets.length}] 工作表: ${s.name} (${s.rowCount.toLocaleString()} 行)\n${dropLine}CREATE TABLE "${cleanSchema}"."${targetT}" AS\nSELECT\n    ${proj}\nFROM ${s.rawSqlSource || "read_csv_auto('...')"};`;
        })
        .join('\n\n');
    }

    const rawSrc = metadata?.rawSqlSource || "read_csv_auto('...')";
    const proj =
      columns.length > 0
        ? columns
            .map(c => {
              const castType = c.overrideType || c.inferredType;
              return castType && castType !== 'ANY'
                ? `CAST("${c.sourceName.replace(/"/g, '""')}" AS ${castType}) AS "${c.targetName.replace(/"/g, '""')}"`
                : `"${c.sourceName.replace(/"/g, '""')}" AS "${c.targetName.replace(/"/g, '""')}"`;
            })
            .join(',\n    ')
        : '*';

    if (conflictStrategy === 'append') {
      const colList = columns.length > 0 ? columns.map(c => `"${c.targetName.replace(/"/g, '""')}"`).join(', ') : '*';
      return `-- 追加数据至现有表\nINSERT INTO "${cleanSchema}"."${cleanTable}" (${colList})\nSELECT\n    ${proj}\nFROM ${rawSrc};`;
    }

    const dropLine =
      conflictStrategy === 'replace'
        ? `-- 如果表已存在则先删除\nDROP TABLE IF EXISTS "${cleanSchema}"."${cleanTable}";\n\n`
        : '';

    return `${dropLine}-- 执行建表与数据导入\nCREATE TABLE "${cleanSchema}"."${cleanTable}" AS\nSELECT\n    ${proj}\nFROM ${rawSrc};`;
  }, [schema, tableName, parseOptions.format, sheets, conflictStrategy, metadata, columns]);

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(generatedDuckDBSql);
      setCopiedSql(true);
      toastService.success('SQL 已成功复制到剪贴板');
      setTimeout(() => setCopiedSql(false), 2000);
    } catch {
      toastService.error('复制失败，请手动选择复制');
    }
  };

  const activeSheet = sheets.find(s => s.name === activeSheetName) || sheets[0];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col bg-monokai-bg text-monokai-fg font-sans select-none antialiased animate-fade-in">
      {/* ── 顶部 Header ── */}
      <header className="h-11 border-b border-monokai-border px-5 flex items-center justify-between bg-monokai-surface shrink-0">
        <div className="flex items-center gap-2.5">
          {/* DuckDB Logo */}
          <div className="w-5 h-5 rounded-full border-2 border-[#e6db74] flex items-center justify-center p-0.5 bg-[#2d2e27]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#e6db74]" />
          </div>
          <span className="font-bold text-xs text-monokai-fg tracking-tight">DuckDB</span>
          <span className="text-[#55574f] font-light mx-1">|</span>
          <h1 className="text-xs font-medium text-monokai-fg flex items-center gap-1.5">
            <span>数据导入</span>
            <span className="text-meta text-monokai-comment font-normal font-mono">Import Data</span>
          </h1>

          {/* 切换隐藏/显示侧边栏按钮 */}
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(prev => !prev)}
            className="flex items-center gap-1 px-2 py-0.5 ml-1.5 rounded text-2xs text-[#d8d7cc] hover:text-monokai-yellow hover:bg-[#34352f] transition-all cursor-pointer border border-monokai-border hover:border-[#55574f]"
            title={isSidebarCollapsed ? '展开左侧配置面板 (Ctrl+B)' : '收起左侧配置面板 (Ctrl+B)'}
            aria-label={isSidebarCollapsed ? '展开配置面板' : '收起配置面板'}
          >
            {isSidebarCollapsed ? (
              <>
                <PanelLeftOpen className="w-3.5 h-3.5 text-monokai-yellow" />
                <span className="font-medium text-monokai-yellow">展开配置</span>
              </>
            ) : (
              <>
                <PanelLeftClose className="w-3.5 h-3.5 text-monokai-comment" />
                <span>收起侧栏</span>
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSqlPreviewModal(true)}
            className="flex items-center gap-1.5 text-meta text-[#d8d7cc] hover:text-monokai-cyan transition-colors cursor-pointer py-1 px-2.5 rounded bg-monokai-bg border border-monokai-border hover:border-[#55574f]"
            title="查看当前生成的 DuckDB 执行 SQL"
          >
            <Code2 className="w-3.5 h-3.5 text-monokai-cyan" />
            <span>SQL 预览</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setRecentImportsList(recentImportsService.getImports());
              setShowRecentImportsModal(true);
            }}
            className="flex items-center gap-1.5 text-meta text-[#d8d7cc] hover:text-monokai-accent transition-colors cursor-pointer py-1 px-2.5 rounded bg-monokai-bg border border-monokai-border hover:border-[#55574f]"
            title="查看近期导入记录"
          >
            <History className="w-3.5 h-3.5 text-monokai-accent" />
            <span>导入历史</span>
          </button>
          <button
            type="button"
            onClick={() => setShowHelpModal(true)}
            className="flex items-center gap-1.5 text-meta text-[#d8d7cc] hover:text-monokai-yellow transition-colors cursor-pointer py-1 px-2.5 rounded bg-monokai-bg border border-monokai-border hover:border-[#55574f]"
          >
            <HelpCircle className="w-3.5 h-3.5 text-monokai-yellow" />
            <span>使用帮助</span>
          </button>
          <button
            type="button"
            onClick={handleClose}
            aria-label="关闭"
            className="p-1 rounded-md text-monokai-comment hover:text-monokai-fg hover:bg-[#34352f] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── 主体双栏内容区 ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── 左侧配置面板 (支持展开/收起) ── */}
        {isSidebarCollapsed ? (
          <aside className="w-[42px] shrink-0 border-r border-monokai-border py-3 flex flex-col items-center justify-between bg-[#20211d] select-none transition-all duration-200 ease-in-out z-20">
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(false)}
                className="w-7 h-7 rounded flex items-center justify-center text-monokai-yellow hover:bg-[#34352f] transition-colors cursor-pointer"
                title="展开配置侧边栏 (Ctrl+B)"
                aria-label="展开配置面板"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
              <div className="w-4 h-px bg-[#34352f]" />
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(false)}
                className="flex flex-col items-center gap-2 cursor-pointer group py-2"
                title="点击展开导入配置面板 (Ctrl+B)"
              >
                <span className="text-2xs font-mono font-medium text-monokai-comment group-hover:text-monokai-yellow [writing-mode:vertical-lr] tracking-widest transition-colors">
                  导入配置
                </span>
                <Sliders className="w-3.5 h-3.5 text-monokai-comment group-hover:text-monokai-yellow transition-colors" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-2 text-2xs text-monokai-comment font-mono pb-2">
              <span className="w-2 h-2 rounded-full bg-[#a6e22e]" title="DuckDB 引擎就绪" />
            </div>
          </aside>
        ) : (
          <aside className="w-full md:w-[400px] lg:w-[420px] shrink-0 border-r border-monokai-border p-4 pb-12 overflow-y-auto space-y-3.5 custom-scrollbar bg-[#20211d] transition-all duration-200 ease-in-out">
            {/* 顶部标题与快速收起按钮 */}
            <div className="flex items-center justify-between pb-2 border-b border-[#34352f]">
              <div className="flex items-center gap-1.5 text-xs font-bold text-monokai-fg">
                <Sliders className="w-3.5 h-3.5 text-monokai-yellow" />
                <span>导入配置面板</span>
                <span className="text-2xs text-monokai-comment font-mono font-normal">Config</span>
              </div>
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(true)}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs text-monokai-comment hover:text-monokai-fg hover:bg-[#34352f] transition-colors cursor-pointer border border-transparent hover:border-monokai-border"
                title="收起配置面板 (宽屏预览数据)"
              >
                <PanelLeftClose className="w-3 h-3" />
                <span>收起</span>
              </button>
            </div>

            {/* 1. 数据来源 Source */}
            <section className="space-y-2.5">
            <h2 className="text-xs font-bold text-monokai-fg flex items-center gap-1.5">
              <span>1. 数据来源</span>
              <span className="text-2xs text-monokai-comment font-normal font-mono">Source</span>
            </h2>

            {/* 模式选择三项卡片 */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'local' as const, label: '本地文件', icon: UploadCloud },
                { id: 'url' as const, label: '远程 URL', icon: Link },
                { id: 'paste' as const, label: '粘贴文本', icon: ClipboardPaste },
              ].map(tab => {
                const Icon = tab.icon;
                const active = mode === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setMode(tab.id)}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-meta transition-all cursor-pointer ${
                      active
                        ? 'bg-[#2d2e27] text-monokai-yellow border border-[#e6db74] font-semibold shadow-xs'
                        : 'bg-monokai-surface text-[#d8d7cc] hover:text-monokai-fg border border-monokai-border hover:border-[#55574f]'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${active ? 'text-monokai-yellow' : 'text-monokai-comment'}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* 本地文件交互区 */}
            {mode === 'local' && (
              <div>
                {file ? (
                  /* 已选择真实文件展示卡片 */
                  <div className="p-3 rounded-lg bg-monokai-surface border border-monokai-border space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-9 rounded bg-monokai-elevated border border-monokai-border flex items-center justify-center text-[#d8d7cc] shrink-0">
                          <FileText className="w-4 h-4 text-monokai-yellow" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11.5px] font-bold text-monokai-fg truncate">{file.name}</p>
                          <p className="text-2xs text-monokai-comment font-mono truncate">
                            {(file as any).path || file.name}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFile(null);
                          setColumns([]);
                          setPreviewRows([]);
                          setLifecycleState('IDLE');
                        }}
                        className="w-5 h-5 rounded-full bg-monokai-bg hover:bg-[#f92672]/20 text-monokai-comment hover:text-monokai-pink flex items-center justify-center cursor-pointer shrink-0 transition-colors"
                        title="移除文件"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="text-2xs text-[#d8d7cc] flex items-center gap-3 pt-1 border-t border-[#34352f] flex-wrap font-mono">
                      <span>大小: {metadata?.formattedSize || formatBytes(file.size)}</span>
                      <span>行数: {metadata ? metadata.rowCount.toLocaleString() : (previewRows.length ? previewRows.length.toLocaleString() : '未知')}</span>
                      <span>修改时间: {metadata?.lastModified || (file.lastModified ? new Date(file.lastModified).toLocaleString() : '刚刚')}</span>
                    </div>
                  </div>
                ) : (
                  /* 拖拽上传真实文件区域 */
                  <label
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`flex flex-col items-center justify-center p-6 rounded-lg border border-dashed transition-all cursor-pointer text-center ${
                      isDragging
                        ? 'border-[#e6db74] bg-[#2d2e27]/70'
                        : 'border-monokai-border bg-monokai-surface hover:border-[#55574f] hover:bg-[#282925]'
                    }`}
                  >
                    <UploadCloud className="w-7 h-7 text-monokai-comment mb-2 group-hover:text-monokai-yellow" />
                    <span className="text-[11.5px] text-monokai-fg font-medium">点击或拖入真实业务文件</span>
                    <span className="text-2xs text-monokai-comment mt-1 font-mono">
                      支持 .csv, .parquet, .json, .xlsx, .tsv
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleFileInputChange}
                      accept=".csv,.tsv,.tab,.json,.jsonl,.parquet,.xlsx,.xls,.txt"
                    />
                  </label>
                )}
              </div>
            )}

            {/* 远程 URL 交互区 */}
            {mode === 'url' && (
              <div className="space-y-2.5">
                <div className="relative flex items-center">
                  <div className="absolute left-3 flex items-center pointer-events-none text-monokai-comment">
                    <Link className="h-3.5 w-3.5" />
                  </div>
                  <input
                    type="text"
                    value={url}
                    onChange={e => handleUrlChange(e.target.value)}
                    placeholder="https://.../data.xlsx, .csv, .parquet 或 Google Sheets 导出链接"
                    className="w-full h-8 pl-8 pr-7 rounded bg-monokai-bg border border-monokai-border focus:border-[#e6db74] text-meta font-mono text-monokai-fg placeholder-[#75715e] outline-none transition-all"
                  />
                  {url && (
                    <button
                      type="button"
                      onClick={() => handleUrlChange('')}
                      className="absolute right-2 text-monokai-comment hover:text-monokai-fg p-0.5 rounded cursor-pointer"
                      title="清空 URL"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <span className="text-2xs text-monokai-comment font-semibold uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-monokai-yellow" />
                    <span>常用公开测试数据集预设</span>
                  </span>
                  <div className="grid grid-cols-1 gap-1.5">
                    {PRESETS.map(p => (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => {
                          handleUrlChange(p.url);
                          setTableName(p.name);
                        }}
                        className="p-2 rounded bg-monokai-surface border border-monokai-border hover:border-[#e6db74]/60 text-left transition-all cursor-pointer flex items-center justify-between group"
                      >
                        <div>
                          <p className="text-[11.5px] font-semibold text-monokai-fg group-hover:text-monokai-yellow">
                            {p.label}
                          </p>
                          <p className="text-2xs text-monokai-comment line-clamp-1">{p.desc}</p>
                        </div>
                        <span className="text-2xs font-mono text-monokai-accent bg-[#a6e22e]/10 border border-[#a6e22e]/25 px-1.5 py-0.5 rounded shrink-0">
                          {p.tag}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 粘贴文本交互区 */}
            {mode === 'paste' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-meta text-monokai-comment">
                    {text.trim() ? `${text.trim().split(/\r?\n/).length} 行` : '等待粘贴'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        handleTextChange('id,name,score\n1,Alice,95.5\n2,Bob,88.0\n3,Charlie,92.0');
                        setTableName('raw_events_imported');
                      }}
                      className="text-meta text-monokai-accent hover:underline cursor-pointer"
                    >
                      填入示例数据
                    </button>
                    {text.trim() && (
                      <button
                        type="button"
                        onClick={() => handleTextChange('')}
                        className="text-meta text-monokai-pink hover:underline cursor-pointer"
                      >
                        清空
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  value={text}
                  onChange={e => handleTextChange(e.target.value)}
                  placeholder="在此直接粘贴 CSV 或 TSV 文本 (支持制表符自动推断)..."
                  rows={3}
                  className="w-full p-2 rounded bg-monokai-bg border border-monokai-border focus:border-[#e6db74] text-meta font-mono text-monokai-fg placeholder-[#75715e] outline-none resize-none leading-relaxed custom-scrollbar"
                />
                {parseOptions.format === 'TSV' && (
                  <div className="flex items-center gap-1.5 text-2xs text-monokai-accent font-mono bg-[#a6e22e]/10 border border-[#a6e22e]/20 px-2 py-1 rounded">
                    <Sparkles className="w-3 h-3 text-monokai-accent" />
                    <span>检测到制表符 (Tab)，已自动启用 TSV 解析</span>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* 2. 文件解析设置 Parse Options */}
          <section className="space-y-3 pt-3 border-t border-[#34352f]">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-monokai-fg flex items-center gap-1.5">
                <span>2. 文件解析设置</span>
                <span className="text-2xs text-monokai-comment font-normal font-mono">Parse Options</span>
              </h2>
              <button
                type="button"
                onClick={() => void runSniff(mode, file, url, text, parseOptions)}
                className="text-meta text-monokai-cyan hover:text-monokai-accent flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-monokai-cyan" />
                <span>自动识别配置</span>
              </button>
            </div>

            {/* 格式单选 Pill 组 */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-meta text-[#d8d7cc] shrink-0">文件格式</span>
              <div className="flex items-center gap-1">
                {FORMAT_OPTIONS.map(fmt => {
                  const active = parseOptions.format === fmt;
                  return (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => handleFormatSelect(fmt)}
                      className={`px-2 py-0.5 text-center text-meta rounded transition-all cursor-pointer ${
                        active
                          ? 'border border-[#e6db74] text-monokai-yellow bg-[#2d2e27] font-bold shadow-xs'
                          : 'border border-monokai-border text-monokai-comment hover:text-monokai-fg bg-monokai-surface'
                      }`}
                    >
                      {fmt === 'Excel' ? 'Excel (.xlsx)' : fmt}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 分隔符 与 引号 (仅纯文本格式需要，Excel / Parquet 自动跳过) */}
            {parseOptions.format !== 'Excel' && parseOptions.format !== 'Parquet' ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-meta text-[#d8d7cc] block" htmlFor="parse-delimiter">
                    分隔符
                  </label>
                  <div className="relative">
                    <select
                      id="parse-delimiter"
                      value={parseOptions.delimiter}
                      onChange={e =>
                        setParseOptions(prev => ({ ...prev, delimiter: e.target.value }))
                      }
                      className="w-full h-7 px-2 bg-monokai-bg border border-monokai-border rounded text-meta font-mono text-monokai-fg outline-none focus:border-[#e6db74] appearance-none cursor-pointer"
                    >
                      {DELIMITER_OPTIONS.map(d => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-monokai-comment absolute right-2 top-2 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-meta text-[#d8d7cc] block" htmlFor="parse-quote">
                    引号
                  </label>
                  <div className="relative">
                    <select
                      id="parse-quote"
                      value={parseOptions.quote}
                      onChange={e =>
                        setParseOptions(prev => ({ ...prev, quote: e.target.value }))
                      }
                      className="w-full h-7 px-2 bg-monokai-bg border border-monokai-border rounded text-meta font-mono text-monokai-fg outline-none focus:border-[#e6db74] appearance-none cursor-pointer"
                    >
                      {QUOTE_OPTIONS.map(q => (
                        <option key={q.value} value={q.value}>
                          {q.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-monokai-comment absolute right-2 top-2 pointer-events-none" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-2 rounded bg-monokai-surface border border-monokai-border text-2xs text-[#d8d7cc] flex items-center gap-1.5 font-mono">
                <Sparkles className="w-3.5 h-3.5 text-monokai-yellow shrink-0" />
                <span>
                  {parseOptions.format === 'Excel'
                    ? 'Excel 工作簿自动解析全部工作表结构，无需指定字符分隔符。'
                    : 'Parquet 为原生列式二进制存储，自带精确类型元数据，无需配置分隔符。'}
                </span>
              </div>
            )}

            {/* 首行是否表头 Switch */}
            <div className="flex items-center justify-between py-0.5">
              <span className="text-meta text-[#d8d7cc]">首行是否表头</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={parseOptions.header}
                  onClick={() =>
                    setParseOptions(prev => ({ ...prev, header: !prev.header }))
                  }
                  className={`w-8 h-4 rounded-full transition-colors relative cursor-pointer ${
                    parseOptions.header ? 'bg-[#a6e22e]' : 'bg-[#3a3b36]'
                  }`}
                >
                  <div
                    className={`w-3.5 h-3.5 rounded-full bg-white transition-transform transform ${
                      parseOptions.header ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>
                <span className="text-meta text-[#d8d7cc]">
                  {parseOptions.header ? '是，使用第一行作为列名' : '否，自动编号列名'}
                </span>
              </div>
            </div>

            {/* 编码 */}
            <div className="flex items-center justify-between gap-2">
              <label className="text-meta text-[#d8d7cc] shrink-0" htmlFor="parse-encoding">
                字符编码
              </label>
              <div className="relative flex-1 max-w-[200px]">
                <select
                  id="parse-encoding"
                  value={parseOptions.encoding}
                  onChange={e =>
                    setParseOptions(prev => ({ ...prev, encoding: e.target.value }))
                  }
                  className="w-full h-7 px-2 bg-monokai-bg border border-monokai-border rounded text-meta text-monokai-fg outline-none focus:border-[#e6db74] appearance-none cursor-pointer"
                >
                  {ENCODING_OPTIONS.map(enc => (
                    <option key={enc.value} value={enc.value}>
                      {enc.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-monokai-comment absolute right-2 top-2 pointer-events-none" />
              </div>
            </div>

            {/* 高级选项折叠卡 */}
            <div className="border-t border-[#34352f] pt-1.5">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1 text-meta text-monokai-comment hover:text-monokai-fg cursor-pointer transition-colors"
              >
                {showAdvanced ? (
                  <ChevronDown className="w-3.5 h-3.5 text-monokai-comment" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-monokai-comment" />
                )}
                <span>高级选项 (跳过行数与日期格式)</span>
              </button>

              {showAdvanced && (
                <div className="mt-2 p-2.5 rounded bg-monokai-surface border border-monokai-border space-y-2 animate-fade-in text-meta">
                  <div className="space-y-1">
                    <label className="text-meta text-[#d8d7cc] block">跳过前 N 行 (Skip Rows)</label>
                    <input
                      type="number"
                      min={0}
                      value={parseOptions.skipRows || 0}
                      onChange={e =>
                        setParseOptions(prev => ({
                          ...prev,
                          skipRows: Math.max(0, parseInt(e.target.value, 10) || 0),
                        }))
                      }
                      className="w-full h-7 px-2 bg-monokai-bg border border-monokai-border rounded text-meta text-monokai-fg outline-none focus:border-[#e6db74]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-meta text-[#d8d7cc] block">日期时间格式 (Date Format)</label>
                    <input
                      type="text"
                      placeholder="%Y-%m-%d"
                      value={parseOptions.dateFormat || ''}
                      onChange={e =>
                        setParseOptions(prev => ({ ...prev, dateFormat: e.target.value }))
                      }
                      className="w-full h-7 px-2 bg-monokai-bg border border-monokai-border rounded text-meta text-monokai-fg outline-none focus:border-[#e6db74]"
                    />
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 3. 目标表设置 Target Table */}
          <section className="space-y-2.5 pt-3 border-t border-[#34352f]">
            <h2 className="text-xs font-bold text-monokai-fg flex items-center gap-1.5">
              <span>3. 目标表设置</span>
              <span className="text-2xs text-monokai-comment font-normal font-mono">Target Table</span>
            </h2>

            <div className="space-y-2">
              {/* Schema 下拉 */}
              <div className="flex items-center justify-between gap-2">
                <label className="text-meta text-[#d8d7cc] shrink-0" htmlFor="target-schema">
                  Schema
                </label>
                <div className="relative flex-1 flex items-center gap-1.5">
                  <select
                    id="target-schema"
                    value={schema}
                    onChange={e => setSchema(e.target.value)}
                    className="w-full h-7 px-2 bg-monokai-bg border border-monokai-border rounded text-meta text-monokai-fg outline-none focus:border-[#e6db74] appearance-none cursor-pointer"
                  >
                    {availableSchemas.map(s => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-monokai-comment absolute right-8 top-2 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => void fetchSchemas()}
                    className="w-7 h-7 rounded bg-monokai-bg border border-monokai-border hover:border-[#55574f] text-monokai-comment hover:text-monokai-fg flex items-center justify-center shrink-0 cursor-pointer"
                    title="刷新 Schema 列表"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* 表名输入 */}
              <div className="flex items-center justify-between gap-2">
                <label className="text-meta text-[#d8d7cc] shrink-0" htmlFor="target-table-name">
                  {sheets.length > 1 ? '基础表名' : '表名'} <span className="text-monokai-pink">*</span>
                </label>
                <div className="flex-1">
                  <input
                    id="target-table-name"
                    type="text"
                    value={tableName}
                    onChange={e =>
                      sheets.length > 1
                        ? handleBaseTableNameChange(e.target.value)
                        : setTableName(e.target.value)
                    }
                    placeholder="例如: raw_events_imported"
                    className="w-full h-7 px-2 bg-monokai-bg border border-monokai-border rounded text-meta font-mono text-monokai-fg outline-none focus:border-[#e6db74]"
                  />
                </div>
              </div>

              {sheets.length > 1 && (
                <div className="border border-monokai-border bg-monokai-surface rounded-lg p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowSheetNamesDrawer(prev => !prev)}
                      className="flex items-center gap-1 text-meta text-monokai-cyan hover:underline cursor-pointer font-medium"
                    >
                      {showSheetNamesDrawer ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                      <span>各工作表目标表名映射 ({sheets.length} 个)</span>
                    </button>
                    <span className="text-2xs text-monokai-comment font-mono">
                      已选 {sheets.filter(s => s.selected).length}/{sheets.length}
                    </span>
                  </div>

                  {showSheetNamesDrawer && (
                    <div className="space-y-1.5 pt-1.5 border-t border-[#34352f] max-h-44 overflow-y-auto custom-scrollbar pr-0.5">
                      <div className="flex items-center justify-between pb-0.5 text-2xs">
                        <span className="text-monokai-comment font-mono">自定义各表名称:</span>
                        <button
                          type="button"
                          onClick={handleResetSheetNames}
                          className="text-monokai-cyan hover:underline cursor-pointer"
                        >
                          重置为默认名
                        </button>
                      </div>
                      {sheets.map(s => (
                        <div
                          key={s.name}
                          className="flex items-center gap-1.5 bg-monokai-bg p-1.5 rounded border border-[#34352f]"
                        >
                          <input
                            type="checkbox"
                            checked={s.selected}
                            disabled={s.isEmpty}
                            onChange={() => handleToggleSheetSelection(s.name)}
                            className="rounded border-monokai-border text-monokai-yellow focus:ring-0 cursor-pointer disabled:opacity-40"
                          />
                          <span
                            className={`text-meta font-mono truncate w-24 shrink-0 ${
                              s.name === activeSheetName ? 'text-monokai-yellow font-bold' : 'text-[#d8d7cc]'
                            }`}
                            title={s.name}
                          >
                            {s.name}
                          </span>
                          <input
                            type="text"
                            value={s.targetTableName}
                            disabled={!s.selected}
                            onChange={e => handleSheetTableNameChange(s.name, e.target.value)}
                            className="flex-1 h-6 px-1.5 bg-monokai-surface border border-monokai-border rounded text-meta font-mono text-monokai-fg outline-none focus:border-[#e6db74] disabled:opacity-40"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {validationError && (
                <p className="text-2xs text-monokai-pink flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{validationError}</span>
                </p>
              )}
              {validationWarning && !validationError && (
                <p className="text-2xs text-monokai-yellow flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{validationWarning}</span>
                </p>
              )}
            </div>
          </section>

          {/* 4. 同名表冲突策略 Conflict Strategy */}
          <section className="space-y-2.5 pt-3 border-t border-[#34352f]">
            <h2 className="text-xs font-bold text-monokai-fg flex items-center gap-1.5">
              <span>4. 同名表冲突策略</span>
              <span className="text-2xs text-monokai-comment font-normal font-mono">Conflict Strategy</span>
            </h2>

            <div className="grid grid-cols-3 gap-2">
              {CONFLICT_CARDS.map(item => {
                const isSelected = conflictStrategy === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setConflictStrategy(item.id)}
                    className={`p-2 rounded-lg border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#2d2e27] border-[#e6db74] text-monokai-fg shadow-xs'
                        : 'bg-monokai-surface border-monokai-border text-monokai-comment hover:border-[#55574f] hover:text-[#d8d7cc]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Icon
                          className={`w-3.5 h-3.5 ${isSelected ? 'text-monokai-yellow' : 'text-monokai-comment'}`}
                        />
                        {isSelected && (
                          <div className="w-3.5 h-3.5 rounded-full bg-[#e6db74] text-[#1e1f1c] flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <p
                        className={`text-[11.5px] font-bold ${
                          isSelected ? 'text-monokai-fg' : 'text-[#d8d7cc]'
                        }`}
                      >
                        {item.title}
                      </p>
                      <p className="text-2xs text-monokai-comment font-mono">{item.en}</p>
                    </div>
                    <p className="text-2xs text-monokai-comment mt-1.5 leading-tight">{item.desc}</p>
                  </button>
                );
              })}
            </div>
          </section>
          </aside>
        )}

        {/* ── 右侧面板 (65% 左右，实时数据与元数据预览) ── */}
        <main className="flex-1 flex flex-col p-4 overflow-y-auto space-y-4 custom-scrollbar bg-[#181916]">
          {/* 5. 数据预览 Preview 标头 */}
          <div className="flex items-center justify-between shrink-0">
            <h2 className="text-xs font-bold text-monokai-fg flex items-center gap-1.5">
              <span>5. 数据预览</span>
              <span className="text-2xs text-monokai-comment font-normal font-mono">Preview</span>
            </h2>

            <div className="flex items-center gap-2">
              {lifecycleState === 'PARSING' ? (
                <div className="flex items-center gap-1.5 text-xs text-monokai-yellow">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>正在解析数据源...</span>
                </div>
              ) : lifecycleState === 'PARSE_ERROR' ? (
                <div className="flex items-center gap-1.5 text-xs text-monokai-pink">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>解析异常，请检查配置</span>
                </div>
              ) : metadata ? (
                <div className="flex items-center gap-1.5 text-xs text-[#d8d7cc]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#a6e22e]" />
                  <span>已自动识别文件结构，修改左侧配置可实时更新预览</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-monokai-comment">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#3a3b36]" />
                  <span>等待选择数据源，载入后将自动识别结构</span>
                </div>
              )}
            </div>
          </div>

          {/* 多工作表 Sheet 切换与多选栏 (Excel Multi-Sheet Bar) */}
          {sheets.length > 0 && (
            <section className="p-2.5 rounded-lg bg-monokai-surface border border-monokai-border space-y-2 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-monokai-accent" />
                  <span className="text-xs font-bold text-monokai-fg">工作表列表 (Sheets)</span>
                  <span className="text-2xs text-monokai-comment font-mono">
                    已选 {sheets.filter(s => s.selected).length}/{sheets.length} 个工作表
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleAllSheets(true)}
                    className="text-meta text-monokai-cyan hover:underline cursor-pointer"
                  >
                    全选
                  </button>
                  <span className="text-[#55574f] text-2xs">|</span>
                  <button
                    type="button"
                    onClick={handleSelectOnlyNonEmptySheets}
                    className="text-meta text-monokai-yellow hover:underline cursor-pointer"
                  >
                    仅选非空表
                  </button>
                  <span className="text-[#55574f] text-2xs">|</span>
                  <button
                    type="button"
                    onClick={() => handleToggleAllSheets(false)}
                    className="text-meta text-monokai-comment hover:text-monokai-fg cursor-pointer"
                  >
                    取消全选
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 pt-0.5">
                {sheets.map(s => {
                  const isActive = s.name === activeSheetName;
                  return (
                    <div
                      key={s.name}
                      onClick={() => handleSheetTabClick(s.name)}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border cursor-pointer select-none shrink-0 transition-all ${
                        isActive
                          ? 'bg-[#2d2e27] border-[#e6db74] text-monokai-fg shadow-xs'
                          : 'bg-monokai-bg border-monokai-border text-monokai-comment hover:border-[#55574f] hover:text-[#d8d7cc]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={s.selected}
                        disabled={s.isEmpty || s.rowCount === 0}
                        onChange={e => handleToggleSheetSelection(s.name, e as any)}
                        onClick={e => e.stopPropagation()}
                        className="rounded border-monokai-border text-monokai-yellow focus:ring-0 cursor-pointer disabled:opacity-30"
                        title={s.isEmpty || s.rowCount === 0 ? '空工作表无有效数据，不可导入' : '勾选导入此工作表'}
                      />
                      <span className={`text-meta font-mono font-medium ${isActive ? 'text-monokai-yellow font-bold' : ''}`}>
                        {s.name}
                      </span>
                      <span className="text-2xs text-monokai-comment font-mono">
                        {s.rowCount.toLocaleString()} 行
                        {s.columnCount > 0 ? ` · ${s.columnCount} 列` : ''}
                      </span>
                      {s.isHidden && (
                        <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono bg-[#ae81ff]/15 text-monokai-purple border border-[#ae81ff]/30">
                          隐藏表
                        </span>
                      )}
                      {(s.isEmpty || s.rowCount === 0) && (
                        <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono bg-monokai-bg text-monokai-comment border border-monokai-border">
                          空工作表
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* A. 文件信息与识别结果看板 */}
          <section className="p-3 rounded-lg bg-monokai-surface border border-monokai-border space-y-2 shrink-0">
            <div className="flex items-center gap-2 text-xs font-bold text-monokai-fg">
              <FileText className="w-4 h-4 text-monokai-cyan" />
              <span>文件信息与识别结果</span>
            </div>

            <div className="flex items-center justify-between gap-4 flex-wrap pt-0.5">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-11 rounded flex items-center justify-center shrink-0 shadow-sm ${
                  metadata || file ? 'bg-[#2d2e27] border border-[#e6db74]/40 text-monokai-yellow' : 'bg-monokai-bg border border-monokai-border text-monokai-comment'
                }`}>
                  <FileText className="w-5 h-5" />
                </div>
                <span className="text-xs font-mono font-bold text-monokai-fg truncate">
                  {metadata?.fileName || file?.name || '未选择数据文件'}
                </span>
              </div>

              <div className="flex items-center gap-6 text-meta font-mono">
                <div>
                  <span className="text-2xs text-monokai-comment block">格式</span>
                  <span className="text-monokai-fg">{metadata?.format || (file ? parseOptions.format : '—')}</span>
                </div>
                <div>
                  <span className="text-2xs text-monokai-comment block">大小</span>
                  <span className="text-monokai-fg">
                    {metadata?.formattedSize || (file ? formatBytes(file.size) : '—')}
                  </span>
                </div>
                {sheets.length > 1 && (
                  <div>
                    <span className="text-2xs text-monokai-comment block">工作表</span>
                    <span className="text-monokai-yellow font-bold">
                      {sheets.filter(s => s.selected).length}/{sheets.length} 个
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-2xs text-monokai-comment block">
                    {sheets.length > 1 ? '当前工作表行数' : '总行数'}
                  </span>
                  <span className="text-monokai-fg">
                    {metadata || file
                      ? sheets.length > 1
                        ? (sheets.find(s => s.name === activeSheetName)?.rowCount ?? 0).toLocaleString()
                        : (metadata ? metadata.rowCount.toLocaleString() : '0')
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-2xs text-monokai-comment block">列数</span>
                  <span className="text-monokai-fg">{metadata || file ? displayColumns.length : '—'}</span>
                </div>
                <div>
                  <span className="text-2xs text-monokai-comment block">编码</span>
                  <span className="text-monokai-fg">{metadata || file ? parseOptions.encoding : '—'}</span>
                </div>
                <div>
                  <span className="text-2xs text-monokai-comment block">首行表头</span>
                  <span className={metadata || file ? 'text-monokai-yellow font-bold' : 'text-monokai-comment'}>
                    {metadata || file ? (parseOptions.header ? '是' : '否') : '—'}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* B. 字段映射与类型推断 Schema Mapping */}
          <section className="p-3 rounded-lg bg-monokai-surface border border-monokai-border space-y-2 shrink-0">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-monokai-fg">
                <Columns className="w-4 h-4 text-monokai-cyan" />
                <span>字段映射与类型推断</span>
                <span className="text-2xs text-monokai-comment font-normal font-mono">
                  ({filteredColumnsWithIndices.length === columns.length
                    ? `共 ${columns.length} 列`
                    : `匹配 ${filteredColumnsWithIndices.length} / ${columns.length} 列`})
                </span>
              </div>

              {/* 字段搜索与快捷操作组 */}
              <div className="flex items-center gap-2">
                {columns.length > 0 && (
                  <div className="relative flex items-center">
                    <Search className="w-3 h-3 text-monokai-comment absolute left-2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="过滤字段名/类型..."
                      value={columnSearch}
                      onChange={e => setColumnSearch(e.target.value)}
                      className="h-6 pl-6 pr-5 rounded bg-monokai-bg border border-monokai-border focus:border-[#e6db74] text-2xs font-mono text-monokai-fg placeholder-[#75715e] outline-none w-32 focus:w-44 transition-all"
                    />
                    {columnSearch && (
                      <button
                        type="button"
                        onClick={() => setColumnSearch('')}
                        className="text-monokai-comment hover:text-monokai-fg px-1 text-meta absolute right-1 cursor-pointer"
                        title="清空搜索"
                      >
                        ×
                      </button>
                    )}
                  </div>
                )}
                {columns.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={handleBatchLowercaseColumns}
                      className="text-2xs text-[#d8d7cc] hover:text-monokai-yellow px-2 py-0.5 rounded bg-monokai-bg border border-monokai-border hover:border-[#55574f] cursor-pointer transition-colors"
                      title="将所有目标列名转为小写规范"
                    >
                      转小写
                    </button>
                    <button
                      type="button"
                      onClick={handleBatchSnakeCaseColumns}
                      className="text-2xs text-[#d8d7cc] hover:text-monokai-accent px-2 py-0.5 rounded bg-monokai-bg border border-monokai-border hover:border-[#55574f] cursor-pointer transition-colors"
                      title="将所有目标列名转换为蛇形下划线命名 (snake_case)"
                    >
                      转蛇形
                    </button>
                    <button
                      type="button"
                      onClick={handleBatchResetColumns}
                      className="text-2xs text-[#d8d7cc] hover:text-monokai-cyan px-2 py-0.5 rounded bg-monokai-bg border border-monokai-border hover:border-[#55574f] cursor-pointer transition-colors"
                      title="重置全部列名为源列名并还原推断类型"
                    >
                      重置映射
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* 映射表格 */}
            <div className="border border-monokai-border rounded overflow-visible">
              {displayColumns.length === 0 ? (
                <div className="py-8 text-center text-meta text-monokai-comment font-mono bg-monokai-bg">
                  等待选择或上传数据文件，嗅探后将在此展示列结构映射
                </div>
              ) : filteredColumnsWithIndices.length === 0 ? (
                <div className="py-6 text-center text-meta text-monokai-comment font-mono bg-monokai-bg">
                  未找到与 "{columnSearch}" 匹配的字段列
                </div>
              ) : (
                <table className="w-full text-left font-mono text-meta border-collapse">
                  <thead className="bg-monokai-surface text-monokai-comment border-b border-monokai-border select-none text-2xs">
                    <tr>
                      <th className="px-2.5 py-1.5 w-10 text-center border-r border-monokai-border">#</th>
                      <th className="px-2.5 py-1.5">源列名</th>
                      <th className="px-2.5 py-1.5">目标列名</th>
                      <th className="px-2.5 py-1.5">推断类型</th>
                      <th className="px-2.5 py-1.5 w-20 text-center">可空</th>
                      <th className="px-2.5 py-1.5">示例值</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2d2e29] text-[#d8d7cc] bg-monokai-bg">
                    {filteredColumnsWithIndices.map(({ col, originalIndex }) => {
                      const displayType = col.overrideType || col.inferredType;
                      let badgeClass = 'bg-[#66d9ef]/15 text-monokai-cyan border-[#66d9ef]/30';
                      if (displayType.includes('VARCHAR') || displayType.includes('TEXT')) {
                        badgeClass = 'bg-[#a6e22e]/15 text-monokai-accent border-[#a6e22e]/30';
                      } else if (
                        displayType.includes('DOUBLE') ||
                        displayType.includes('FLOAT') ||
                        displayType.includes('DECIMAL') ||
                        displayType.includes('INT') ||
                        displayType.includes('BIGINT')
                      ) {
                        badgeClass = 'bg-[#e6db74]/15 text-monokai-yellow border-[#e6db74]/30';
                      } else if (
                        displayType.includes('TIMESTAMP') ||
                        displayType.includes('DATE')
                      ) {
                        badgeClass = 'bg-[#ae81ff]/15 text-monokai-purple border-[#ae81ff]/30';
                      } else if (displayType.includes('JSON')) {
                        badgeClass = 'bg-monokai-surface text-[#d8d7cc] border-monokai-border';
                      }

                      const isNearBottom = originalIndex >= Math.max(1, columns.length - 2);

                      return (
                        <tr key={originalIndex} className="hover:bg-monokai-surface transition-colors">
                          <td className="px-2.5 py-1 text-center text-monokai-comment border-r border-monokai-border text-2xs">
                            {originalIndex + 1}
                          </td>
                          <td className="px-2.5 py-1 text-[#d8d7cc] font-mono font-medium">
                            {col.sourceName}
                          </td>
                          <td className="px-2.5 py-1">
                            <input
                              type="text"
                              value={col.targetName}
                              onChange={e => handleColumnTargetNameChange(originalIndex, e.target.value)}
                              className="bg-transparent border-b border-transparent hover:border-[#55574f] focus:border-[#e6db74] focus:bg-monokai-surface text-monokai-fg px-1 py-0.5 rounded outline-none w-full text-meta font-mono transition-colors"
                            />
                          </td>
                          <td className="px-2.5 py-1">
                            <div data-column-type-dropdown="true" className="relative inline-block">
                              <button
                                type="button"
                                onClick={() => setEditingColumnIdx(editingColumnIdx === originalIndex ? null : originalIndex)}
                                className={`px-2 py-0.5 rounded text-2xs font-bold tracking-wide border ${badgeClass} cursor-pointer hover:brightness-110`}
                                title="点击更改类型"
                              >
                                {displayType}
                              </button>
                              {editingColumnIdx === originalIndex && (
                                <div
                                  className={`absolute left-0 z-50 bg-monokai-surface border border-monokai-border rounded-lg shadow-2xl py-1 w-36 max-h-48 overflow-y-auto custom-scrollbar ${
                                    isNearBottom ? 'bottom-7' : 'top-7'
                                  }`}
                                >
                                  {DUCKDB_TYPE_OPTIONS.map(t => (
                                    <button
                                      key={t}
                                      type="button"
                                      onClick={() => {
                                        handleColumnTypeChange(originalIndex, t);
                                        setEditingColumnIdx(null);
                                      }}
                                      className={`w-full text-left px-2.5 py-1 text-meta font-mono transition-colors flex items-center justify-between cursor-pointer ${
                                        displayType === t
                                          ? 'bg-[#2d2e27] text-monokai-yellow font-bold'
                                          : 'text-[#d8d7cc] hover:bg-[#34352f] hover:text-monokai-fg'
                                      }`}
                                    >
                                      <span>{t}</span>
                                      {displayType === t && <Check className="w-3 h-3 text-monokai-yellow" />}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-2.5 py-1 text-center">
                            {col.nullable ? (
                              <div className="inline-flex items-center gap-1 cursor-pointer" onClick={() => handleColumnNullableToggle(originalIndex)}>
                                <div className="w-3.5 h-3.5 rounded bg-[#a6e22e] text-[#1e1f1c] flex items-center justify-center">
                                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                                </div>
                                <span className="text-2xs text-monokai-comment font-mono">YES</span>
                              </div>
                            ) : (
                              <div className="inline-flex items-center cursor-pointer" onClick={() => handleColumnNullableToggle(originalIndex)}>
                                <div className="w-3.5 h-3.5 rounded border border-[#55574f] bg-monokai-bg" />
                              </div>
                            )}
                          </td>
                          <td className="px-2.5 py-1 text-monokai-comment truncate max-w-[200px] text-2xs">
                            {col.sampleValue === '-' || col.sampleValue === '' || col.sampleValue === 'null' ? (
                              <span className="italic text-[#55574f]">NULL</span>
                            ) : (
                              col.sampleValue
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          {/* C. 数据预览 Data Preview (前 100 行) */}
          <section className="flex-1 min-h-[200px] p-3 rounded-lg bg-monokai-surface border border-monokai-border flex flex-col space-y-2 overflow-hidden">
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-xs font-bold text-monokai-fg">
                <Table2 className="w-4 h-4 text-monokai-cyan" />
                <span>数据预览</span>
                <span className="text-2xs text-monokai-comment font-normal font-mono">Data Preview (前 100 行样本)</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-2xs text-monokai-comment font-mono">
                  共 {metadata ? metadata.rowCount.toLocaleString() : '0'} 行 | 显示前 {displayPreviewRows.length} 行
                </span>
                <button
                  type="button"
                  onClick={() => void runSniff(mode, file, url, text, parseOptions)}
                  disabled={isRefreshingPreview}
                  className="flex items-center gap-1 text-meta text-[#d8d7cc] hover:text-monokai-fg px-2 py-0.5 rounded bg-monokai-bg border border-monokai-border hover:border-[#55574f] cursor-pointer transition-colors disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3 h-3 text-monokai-cyan ${
                      isRefreshingPreview ? 'animate-spin' : ''
                    }`}
                  />
                  <span>刷新预览</span>
                </button>
              </div>
            </div>

            {/* 表格容器 */}
            <div className="flex-1 border border-monokai-border rounded overflow-auto custom-scrollbar bg-monokai-bg">
              {displayPreviewRows.length === 0 ? (
                lifecycleState === 'PARSE_ERROR' ? (
                  <div className="h-full min-h-[160px] p-6 flex flex-col items-center justify-center text-center space-y-3">
                    <div className="w-10 h-10 rounded-full bg-[#f92672]/15 border border-[#f92672]/30 flex items-center justify-center text-monokai-pink shrink-0">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div className="space-y-1.5 max-w-lg">
                      <p className="text-xs font-bold text-monokai-pink">数据源解析失败</p>
                      <p className="text-meta text-monokai-comment leading-relaxed break-words whitespace-pre-wrap font-mono">
                        {statusMessage.replace(/^解析错误:\s*/, '')}
                      </p>
                    </div>
                    {mode === 'url' && url.trim() && (
                      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => window.open(url, '_blank')}
                          className="px-3 py-1 rounded bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border text-meta text-monokai-cyan hover:text-monokai-fg flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>在浏览器中直接下载此文件</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setMode('local')}
                          className="px-3 py-1 rounded bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border text-meta text-[#d8d7cc] hover:text-monokai-fg transition-colors cursor-pointer"
                        >
                          切换到本地文件上传
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full min-h-[140px] flex items-center justify-center text-meta text-monokai-comment font-mono">
                    暂无数据预览，请先在左侧选择文件或解析数据源
                  </div>
                )
              ) : (
                <table className="w-full text-left font-mono text-meta border-collapse">
                  <thead className="bg-monokai-surface text-monokai-comment border-b border-monokai-border sticky top-0 select-none text-2xs z-10">
                    <tr>
                      <th className="px-2.5 py-1.5 w-12 text-center border-r border-monokai-border">#</th>
                      {displayColumns.map((col, cIdx) => (
                        <th
                          key={cIdx}
                          onClick={() => handleSortColumn(col.sourceName)}
                          className="px-2.5 py-1.5 whitespace-nowrap font-semibold text-monokai-fg cursor-pointer hover:bg-monokai-elevated transition-colors select-none"
                          title={`点击按 "${col.targetName}" 排序`}
                        >
                          <div className="flex items-center gap-1">
                            <span className={sortColumn === col.sourceName ? 'text-monokai-yellow' : ''}>
                              {col.targetName}
                            </span>
                            {sortColumn === col.sourceName ? (
                              sortDirection === 'asc' ? (
                                <ArrowUp className="w-3 h-3 text-monokai-yellow" />
                              ) : (
                                <ArrowDown className="w-3 h-3 text-monokai-yellow" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-[#55574f] hover:text-[#d8d7cc]" />
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2d2e29] text-[#d8d7cc]">
                    {displayPreviewRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-monokai-surface transition-colors">
                        <td className="px-2.5 py-1 text-center text-monokai-comment border-r border-monokai-border select-none text-2xs">
                          {rIdx + 1}
                        </td>
                        {displayColumns.map((col, cIdx) => {
                          const rawVal = row[col.sourceName];
                          const displayVal =
                            rawVal !== undefined && rawVal !== null
                              ? typeof rawVal === 'object'
                                ? JSON.stringify(rawVal)
                                : String(rawVal)
                              : '-';
                          return (
                            <td
                              key={cIdx}
                              className="px-2.5 py-1 whitespace-nowrap max-w-[220px] truncate"
                              title={displayVal !== '-' ? displayVal : ''}
                            >
                              {displayVal === '-' || displayVal === 'null' || displayVal === null || displayVal === undefined ? (
                                <span className="text-[#55574f] italic text-2xs">NULL</span>
                              ) : displayVal === '' ? (
                                <span className="text-[#55574f] text-2xs">""</span>
                              ) : (
                                displayVal
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </main>
      </div>

      {/* ── 底部状态与操作栏 ── */}
      <footer className="h-12 border-t border-monokai-border px-5 flex items-center justify-between bg-monokai-surface shrink-0">
        {/* 左侧状态指示灯与文案 */}
        <div className="flex items-center gap-2 text-meta">
          <div
            className={`w-2 h-2 rounded-full ${
              lifecycleState === 'READY' || lifecycleState === 'SUCCESS'
                ? 'bg-[#a6e22e]'
                : lifecycleState === 'PARSING' || lifecycleState === 'IMPORTING'
                ? 'bg-[#e6db74] animate-spin'
                : lifecycleState === 'PARSE_ERROR' || lifecycleState === 'VALIDATION_ERROR'
                ? 'bg-[#f92672]'
                : 'bg-[#55574f]'
            }`}
          />
          <span className="font-bold text-monokai-fg">
            {lifecycleState === 'READY'
              ? '就绪'
              : lifecycleState === 'PARSING'
              ? '解析中'
              : lifecycleState === 'IMPORTING'
              ? '写入中'
              : lifecycleState === 'SUCCESS'
              ? '导入完成'
              : lifecycleState === 'PARSE_ERROR'
              ? '解析错误'
              : lifecycleState === 'VALIDATION_ERROR'
              ? '校验未通过'
              : '待选择数据'}
          </span>
          <span className="text-monokai-comment">{statusMessage}</span>
        </div>

        {/* 右侧主副按钮 */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleClose}
            disabled={lifecycleState === 'IMPORTING'}
            className="h-7 px-3.5 rounded bg-monokai-bg hover:bg-[#34352f] text-[#d8d7cc] hover:text-monokai-fg border border-monokai-border hover:border-[#55574f] text-meta font-medium cursor-pointer transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleImportClick}
            disabled={lifecycleState !== 'READY'}
            className="h-7 flex items-center gap-1.5 px-4 rounded bg-[#e6db74] hover:bg-[#d8cc60] active:scale-[0.98] text-[#1e1f1c] text-meta font-bold transition-all shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {lifecycleState === 'IMPORTING' ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
            )}
            <span>
              {sheets.length > 1
                ? `批量导入选中的 ${sheets.filter(s => s.selected).length} 个工作表`
                : '开始导入 Import'}
            </span>
          </button>
        </div>
      </footer>

      {/* ── 二次确认覆盖弹窗 ── */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[1010] bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-monokai-surface border border-[#f92672]/60 rounded-xl p-5 shadow-2xl space-y-4 font-sans">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#f92672]/15 border border-[#f92672]/30 flex items-center justify-center text-monokai-pink shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-monokai-fg">确认覆盖替换现有表？</h3>
                <p className="text-meta text-monokai-comment mt-0.5">目标数据表已存在且包含历史数据</p>
              </div>
            </div>

            <div className="p-3 rounded bg-monokai-bg border border-monokai-border text-meta space-y-1.5">
              <p className="text-[#d8d7cc]">
                目标表: <code className="text-monokai-yellow font-mono font-bold px-1 py-0.5 bg-monokai-surface border border-monokai-border rounded">{schema}.{tableName}</code>
              </p>
              <p className="text-monokai-comment leading-relaxed">
                执行【覆盖替换 (Drop & Replace)】将先执行 <code className="text-monokai-pink font-mono px-1 py-0.2 rounded bg-[#f92672]/10 border border-[#f92672]/30">DROP TABLE</code>，原有所有行数据将被彻底重写并重新建表。此操作不可逆！
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-3.5 py-1.5 rounded bg-monokai-bg border border-monokai-border text-meta font-medium text-[#d8d7cc] hover:text-monokai-fg hover:border-[#55574f] cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void executeImportPipeline()}
                className="px-4 py-1.5 rounded bg-[#f92672] hover:bg-[#ff3b82] text-meta font-bold text-white cursor-pointer shadow-md"
              >
                确认删除并重新建表
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 使用帮助模态框 ── */}
      {showHelpModal && (
        <div className="fixed inset-0 z-[1010] bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-xl bg-monokai-surface border border-monokai-border rounded-xl p-5 shadow-2xl space-y-4 font-sans">
            <div className="flex items-center justify-between border-b border-[#34352f] pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-monokai-yellow" />
                <h3 className="text-xs font-bold text-monokai-fg">数据导入指南与格式规范 (Import Guide)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="text-monokai-comment hover:text-monokai-fg p-1 rounded hover:bg-[#34352f] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-meta space-y-3.5 text-[#d8d7cc] leading-relaxed max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
              {/* 1. 支持的数据格式 */}
              <div>
                <h4 className="font-bold text-monokai-fg mb-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#66d9ef]" />
                  <span>1. 支持的数据格式与特性</span>
                </h4>
                <div className="grid grid-cols-2 gap-2 text-2xs">
                  <div className="p-2 rounded bg-monokai-bg border border-[#34352f] space-y-1">
                    <span className="font-bold text-monokai-yellow font-mono">CSV / TSV</span>
                    <p className="text-monokai-comment">纯文本表格，支持逗号、制表符(\t)、分号等自定义分隔符，粘贴模式下自动感知制表符。</p>
                  </div>
                  <div className="p-2 rounded bg-monokai-bg border border-[#34352f] space-y-1">
                    <span className="font-bold text-monokai-accent font-mono">Excel (.xlsx / .xls)</span>
                    <p className="text-monokai-comment">完整读取全部工作表，支持隐藏表标记、空表过滤、独立改名及批量一键落库。</p>
                  </div>
                  <div className="p-2 rounded bg-monokai-bg border border-[#34352f] space-y-1">
                    <span className="font-bold text-monokai-cyan font-mono">Parquet</span>
                    <p className="text-monokai-comment">高效列式二进制存储，自带精确类型元数据与统计信息，DuckDB 零拷贝极速载入。</p>
                  </div>
                  <div className="p-2 rounded bg-monokai-bg border border-[#34352f] space-y-1">
                    <span className="font-bold text-monokai-purple font-mono">JSON / JSONL</span>
                    <p className="text-monokai-comment">结构化与按行换行 JSON 数据，自动探测多层嵌套结构并推断字段类型。</p>
                  </div>
                </div>
              </div>

              {/* 2. 类型推断与转换 */}
              <div>
                <h4 className="font-bold text-monokai-fg mb-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#a6e22e]" />
                  <span>2. 字段映射与类型转换 (Schema Casting)</span>
                </h4>
                <p className="text-monokai-comment mb-2 leading-relaxed">
                  系统默认嗅探前 20,480 行样本自动推断类型。可在映射表格中点击类型标签手动切换类型（如 VARCHAR 改为 BIGINT 或 TIMESTAMP），导入时将执行底层精准转换。
                </p>
                <div className="rounded border border-[#34352f] overflow-hidden bg-monokai-bg">
                  <table className="w-full text-left font-mono text-2xs">
                    <thead className="bg-monokai-surface text-monokai-comment border-b border-[#34352f]">
                      <tr>
                        <th className="px-2 py-1">目标类型</th>
                        <th className="px-2 py-1">底层 DuckDB 类型</th>
                        <th className="px-2 py-1">适用数据示例</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2d2e29] text-[#d8d7cc]">
                      <tr>
                        <td className="px-2 py-1 text-monokai-accent">VARCHAR</td>
                        <td className="px-2 py-1">VARCHAR / TEXT</td>
                        <td className="px-2 py-1 text-monokai-comment">"Beijing", "Pending"</td>
                      </tr>
                      <tr>
                        <td className="px-2 py-1 text-monokai-yellow">BIGINT / DOUBLE</td>
                        <td className="px-2 py-1">INT8 / FLOAT8</td>
                        <td className="px-2 py-1 text-monokai-comment">1001, 99.85</td>
                      </tr>
                      <tr>
                        <td className="px-2 py-1 text-monokai-purple">TIMESTAMP</td>
                        <td className="px-2 py-1">TIMESTAMP / DATE</td>
                        <td className="px-2 py-1 text-monokai-comment">2026-03-15 08:30:00</td>
                      </tr>
                      <tr>
                        <td className="px-2 py-1 text-monokai-cyan">BOOLEAN</td>
                        <td className="px-2 py-1">BOOL</td>
                        <td className="px-2 py-1 text-monokai-comment">true / false / 1 / 0</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3. 冲突策略说明 */}
              <div>
                <h4 className="font-bold text-monokai-fg mb-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#e6db74]" />
                  <span>3. 同名表冲突策略</span>
                </h4>
                <div className="space-y-1 text-monokai-comment">
                  <p>• <strong className="text-monokai-fg">覆盖替换 (Drop & Replace)</strong>：先 DROP 原有同名表，再根据新结构完整重新建表。</p>
                  <p>• <strong className="text-monokai-fg">追加行数据 (Append Rows)</strong>：保留现有数据表，执行 INSERT INTO 写入新行（需列名及类型兼容）。</p>
                  <p>• <strong className="text-monokai-fg">存在即报错 (Fail If Exists)</strong>：若目标表已存在则阻断写入，确保物理表不被误覆盖。</p>
                </div>
              </div>

              {/* 4. 性能建议 Blockquote Callout */}
              <div className="p-2.5 rounded-lg bg-[#2d2e27] border-l-2 border-[#e6db74] text-[#d8d7cc] space-y-1">
                <span className="font-bold text-monokai-yellow flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>性能黄金建议 (Performance Tip)</span>
                </span>
                <p className="text-monokai-comment leading-relaxed">
                  DuckDB 采用向量化执行引擎。对于 10 万行以上的大型数据集，强烈推荐使用 <code className="text-monokai-accent font-mono px-1 py-0.2 bg-monokai-bg rounded">Parquet</code> 格式，零拷贝载入速度可达 CSV 的 10~50 倍且大幅降低浏览器内存峰值。
                </p>
              </div>

              {/* 5. 官方文档外链 */}
              <div className="flex items-center justify-between pt-1 border-t border-[#34352f]">
                <span className="text-monokai-comment">官方资源:</span>
                <a
                  href="https://duckdb.org/docs/data/overview"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-monokai-cyan hover:underline cursor-pointer"
                >
                  <span>DuckDB 数据导入官方文档 (Overview)</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[#34352f]">
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-1.5 rounded bg-[#e6db74] hover:bg-[#d8cc60] text-[#1e1f1c] text-meta font-bold cursor-pointer transition-colors shadow-xs"
              >
                我知道了 (OK)
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── SQL 预览模态框 (DuckDB SQL Preview) ── */}
      {showSqlPreviewModal && (
        <div className="fixed inset-0 z-[1010] bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-2xl bg-monokai-surface border border-monokai-border rounded-xl p-5 shadow-2xl space-y-4 font-sans">
            <div className="flex items-center justify-between border-b border-[#34352f] pb-3">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-monokai-cyan" />
                <h3 className="text-xs font-bold text-monokai-fg">DuckDB SQL 执行预览 (SQL Preview)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSqlPreviewModal(false)}
                className="text-monokai-comment hover:text-monokai-fg p-1 rounded hover:bg-[#34352f] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-meta space-y-3 text-[#d8d7cc]">
              <p className="text-monokai-comment leading-relaxed">
                以下为基于当前配置（Schema: <code className="text-monokai-yellow font-mono">{schema}</code>、表名: <code className="text-monokai-yellow font-mono">{tableName || 'auto'}</code>、字段映射与冲突策略）实时生成的底层 DuckDB SQL 语句：
              </p>

              <div className="relative group">
                <pre className="p-3.5 rounded-lg bg-[#181916] border border-monokai-border text-meta font-mono text-monokai-fg max-h-72 overflow-auto custom-scrollbar leading-relaxed whitespace-pre-wrap select-text">
                  {generatedDuckDBSql}
                </pre>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="absolute top-2.5 right-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded bg-monokai-surface border border-monokai-border hover:border-[#66d9ef] text-2xs font-mono text-[#d8d7cc] hover:text-monokai-cyan transition-colors cursor-pointer shadow-xs"
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-3 h-3 text-monokai-accent" />
                      <span className="text-monokai-accent">已复制</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>复制 SQL</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-2.5 rounded-lg bg-[#2d2e27] border-l-2 border-[#66d9ef] space-y-1">
                <span className="font-bold text-monokai-cyan flex items-center gap-1">
                  <Database className="w-3.5 h-3.5" />
                  <span>零拷贝向量化流式执行机制</span>
                </span>
                <p className="text-2xs text-monokai-comment leading-relaxed">
                  DuckDB WASM 直接通过虚拟文件系统 (VFS) 内存映射读取数据源，无需经由后端服务器中转。建表与类型 CAST 操作均采用矢量化 SIMD 并行管道，即使面对百万级单元格也能秒级完成落库。
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#34352f]">
              <span className="text-2xs text-monokai-comment font-mono">
                {parseOptions.format === 'Excel' && sheets.length > 0
                  ? `Excel 多工作表模式 · 勾选 ${sheets.filter(s => s.selected).length} 个表`
                  : `单表模式 · ${columns.length} 个字段列`}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="px-3.5 py-1.5 rounded bg-monokai-bg border border-monokai-border hover:border-[#55574f] text-[#d8d7cc] hover:text-monokai-fg text-meta font-medium cursor-pointer"
                >
                  复制语句
                </button>
                <button
                  type="button"
                  onClick={() => setShowSqlPreviewModal(false)}
                  className="px-4 py-1.5 rounded bg-[#e6db74] hover:bg-[#d8cc60] text-[#1e1f1c] text-meta font-bold cursor-pointer transition-colors"
                >
                  关闭 (Close)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 导入历史记录模态框 (Recent Imports) ── */}
      {showRecentImportsModal && (
        <div className="fixed inset-0 z-[1010] bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-xl bg-monokai-surface border border-monokai-border rounded-xl p-5 shadow-2xl space-y-4 font-sans">
            <div className="flex items-center justify-between border-b border-[#34352f] pb-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-monokai-accent" />
                <h3 className="text-xs font-bold text-monokai-fg">近期数据导入历史 (Recent Imports)</h3>
                <span className="text-2xs text-monokai-comment font-mono">({recentImportsList.length} 条)</span>
              </div>
              <div className="flex items-center gap-2">
                {recentImportsList.length > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await confirm({
                        title: '清空导入历史',
                        message: '确定要清空近期导入历史记录吗？',
                        variant: 'warning',
                      });
                      if (ok) {
                        recentImportsService.clearImports();
                        setRecentImportsList([]);
                        toastService.info('已清空导入历史记录');
                      }
                    }}
                    className="flex items-center gap-1 text-2xs text-monokai-comment hover:text-monokai-pink cursor-pointer px-2 py-0.5 rounded hover:bg-monokai-bg transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>清空历史</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowRecentImportsModal(false)}
                  className="text-monokai-comment hover:text-monokai-fg p-1 rounded hover:bg-[#34352f] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar space-y-2 pr-1">
              {recentImportsList.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-2 bg-monokai-bg rounded-lg border border-[#34352f]">
                  <Database className="w-8 h-8 text-[#55574f]" />
                  <p className="text-[11.5px] font-medium text-[#d8d7cc]">暂无近期导入记录</p>
                  <p className="text-2xs text-monokai-comment font-mono max-w-xs">
                    在当前会话中通过本地文件、远程 URL 或文本导入的数据表将自动登记于此。
                  </p>
                </div>
              ) : (
                recentImportsList.map(item => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg bg-monokai-bg border border-[#34352f] hover:border-[#55574f] transition-all flex items-center justify-between gap-3 text-meta"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded bg-monokai-surface border border-monokai-border flex items-center justify-center text-monokai-accent shrink-0">
                        <Table2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-monokai-fg truncate font-mono">{item.tableName}</span>
                          <span className="text-[9.5px] font-mono text-monokai-cyan bg-[#66d9ef]/10 border border-[#66d9ef]/25 px-1.5 py-0.2 rounded">
                            {item.rowCount ? `${item.rowCount.toLocaleString()} 行` : '已导入'}
                          </span>
                        </div>
                        <p className="text-2xs text-monokai-comment font-mono truncate">
                          源: {item.name} · 大小: {item.size} · 时间: {item.importedAt}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const sql = `SELECT * FROM "${item.tableName}" LIMIT 50;`;
                          handleClose();
                          setTimeout(() => {
                            window.dispatchEvent(new CustomEvent('duckdb_execute_sql', { detail: { sql } }));
                          }, 100);
                        }}
                        className="px-2 py-1 rounded bg-monokai-surface border border-monokai-border hover:border-[#66d9ef] text-2xs font-mono text-monokai-cyan hover:bg-[#66d9ef]/10 transition-colors cursor-pointer flex items-center gap-1"
                        title="在 SQL 编辑器中直接执行 SELECT 查询"
                      >
                        <Code2 className="w-3 h-3" />
                        <span>在 SQL 中查询</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(item.tableName);
                            toastService.success(`表名 "${item.tableName}" 已复制`);
                          } catch {
                            toastService.error('复制失败');
                          }
                        }}
                        className="px-2 py-1 rounded bg-monokai-surface border border-monokai-border hover:border-[#a6e22e] text-2xs font-mono text-[#d8d7cc] hover:text-monokai-accent transition-colors cursor-pointer flex items-center gap-1"
                        title="复制数据表名"
                      >
                        <Copy className="w-3 h-3" />
                        <span>复制表名</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-[#34352f]">
              <button
                type="button"
                onClick={() => setShowRecentImportsModal(false)}
                className="px-4 py-1.5 rounded bg-monokai-bg border border-monokai-border hover:border-[#55574f] text-[#d8d7cc] hover:text-monokai-fg text-meta font-medium cursor-pointer"
              >
                完成 (Done)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportWizard;
