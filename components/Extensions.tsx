import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Cloud, Search, X, Check, Database, Layers, ArrowRight, ExternalLink,
  Play, Copy, CheckCircle2, Sparkles, FileCode, Cpu, ShieldCheck,
  RefreshCw, Box, HelpCircle, Code, Filter, BookOpen, TerminalSquare,
  AlertCircle, Info, Zap, Globe, Table2
} from 'lucide-react';
import { duckDBService } from '../services/duckdbService';
import { toastService } from '../services/toastService';
import { buildExtensionLoadSql } from '../services/extensionPolicy';
import { PageHeader, SearchInput, ActionButton, IconButton, EmptyState, SegmentedTabs } from './ui/Workbench';
import { CodeHighlightBlock } from './ui/CodeHighlightBlock';

export interface Extension {
  name: string;
  displayName: string;
  installed: boolean;
  loaded: boolean;
  description: string;
  category: 'Core' | 'Format' | 'Search' | 'Geo' | 'Connect' | 'AI';
  capabilities: string[];
  example?: string;
  docsUrl?: string;
  tags: string[];
  wasmSupport: 'Native' | 'Emulated' | 'WASM-Direct';
}

interface ExtensionsProps {
  onTryExtension: (code: string) => void;
}

interface LakehousePreset {
  name: string;
  format: 'parquet' | 'csv' | 'json' | 'iceberg';
  url: string;
  tableName: string;
  description: string;
}

const LAKEHOUSE_PRESETS: LakehousePreset[] = [
  {
    name: 'DuckDB 官方 Parquet 演示数据',
    format: 'parquet',
    url: 'https://raw.githubusercontent.com/duckdb/duckdb-data/main/parquet/data.parquet',
    tableName: 'remote_parquet_demo',
    description: '标准列式存储 Parquet 文件，验证 HTTP 范围分片与零拷贝读取'
  },
  {
    name: 'Titanic 经典乘客数据集 (CSV)',
    format: 'csv',
    url: 'https://raw.githubusercontent.com/datasciencedojo/datasets/master/titanic.csv',
    tableName: 'titanic_passengers',
    description: '结构化 CSV 格式，测试自动类型推断与 Dialect 探测'
  },
  {
    name: 'GitHub 活动日志 (JSON 数据集)',
    format: 'json',
    url: 'https://raw.githubusercontent.com/duckdb/duckdb-data/main/json/data.json',
    tableName: 'github_events',
    description: '嵌套 JSON 文档数据源，验证 json_extract 与动态字段投影'
  },
  {
    name: '房价与时序指标数据 (Parquet)',
    format: 'parquet',
    url: 'https://duckdb.org/data/prices.parquet',
    tableName: 'housing_prices_data',
    description: '包含时间戳与浮点数值的高维分析列存数据集'
  }
];

const KNOWN_EXTENSIONS: Extension[] = [
  {
    name: 'parquet',
    displayName: 'Parquet 列式湖仓引擎',
    description: '工业级列式湖仓格式。支持谓词下推、字典编码与高压缩比，是 OLAP 分析与 Lakehouse 的基石。',
    category: 'Format',
    capabilities: ['read_parquet', 'COPY TO ... PARQUET', 'Parquet Schema Discovery', 'HTTP Range Request'],
    example: "-- 读取远程 Parquet 文件并进行聚合分析\nSELECT \n  * \nFROM read_parquet('https://raw.githubusercontent.com/duckdb/duckdb-data/main/parquet/data.parquet') \nLIMIT 10;",
    docsUrl: 'https://duckdb.org/docs/data/parquet/overview',
    tags: ['Lakehouse', 'Columnar', 'High Perf'],
    wasmSupport: 'Native',
    installed: true,
    loaded: true
  },
  {
    name: 'csv',
    displayName: 'CSV 智能流式解析器',
    description: '高性能 CSV 读取与导出引擎，支持全自动方言探测、表头识别、类型推断与并行块读取。',
    category: 'Format',
    capabilities: ['read_csv_auto', 'COPY ... TO ... (FORMAT CSV)', 'Auto-Dialect Detection', 'Header Inference'],
    example: "-- 自动识别分隔符并流式读取远程 CSV\nSELECT \n  * \nFROM read_csv_auto('https://raw.githubusercontent.com/datasciencedojo/datasets/master/titanic.csv') \nLIMIT 10;",
    docsUrl: 'https://duckdb.org/docs/data/csv/overview',
    tags: ['Core', 'Streaming', 'Auto-Type'],
    wasmSupport: 'Native',
    installed: true,
    loaded: true
  },
  {
    name: 'json',
    displayName: 'JSON 结构化与嵌套解析器',
    description: '高级 JSON/NDJSON 解析扩展。支持嵌套层级下钻、字段抽取、动态 Schema 构建与 JSON 序列化。',
    category: 'Format',
    capabilities: ['read_json_auto', 'json_extract', 'json_extract_string', 'to_json'],
    example: "-- 读取远程 JSON 数据集并提取嵌套属性\nSELECT \n  * \nFROM read_json_auto('https://raw.githubusercontent.com/duckdb/duckdb-data/main/json/data.json') \nLIMIT 10;",
    docsUrl: 'https://duckdb.org/docs/extensions/json',
    tags: ['Document', 'Nested Data', 'Semi-Structured'],
    wasmSupport: 'Native',
    installed: true,
    loaded: true
  },
  {
    name: 'excel',
    displayName: 'Excel 工作簿解析组件',
    description: '浏览器端集成的高性能 Excel 解析内核，支持多工作表直读、.xlsx/.xls 文件导入与公式值解析。',
    category: 'Format',
    capabilities: ['XLSX Sheet Parser', 'Workbook Scanner', 'Client-side VFS'],
    example: "-- 该能力已无缝集成至左侧「导入向导」面板中。\n-- 您可直接拖拽 .xlsx 文件完成持久化数据表创建。",
    docsUrl: 'https://duckdb.org/docs/data/overview',
    tags: ['Workbook', 'Office', 'Interactive'],
    wasmSupport: 'Emulated',
    installed: true,
    loaded: true
  },
  {
    name: 'httpfs',
    displayName: 'HTTPFS 远程文件系统 (云存储直连)',
    description: '通过 HTTP/HTTPS/S3 协议零复制直接访问远程对象存储与公开数据集，无需全量下载即可按需分片拉取。',
    category: 'Connect',
    capabilities: ['HTTPS File Stream', 'S3 Object Storage', 'HTTP Range Requests', 'Glob Patterns'],
    example: "-- 利用 HTTP Range 请求直接读取公开云端 Parquet\nSELECT \n  * \nFROM 'https://duckdb.org/data/prices.parquet' \nLIMIT 5;",
    docsUrl: 'https://duckdb.org/docs/extensions/httpfs',
    tags: ['Cloud Lakehouse', 'Zero-Copy', 'S3'],
    wasmSupport: 'WASM-Direct',
    installed: true,
    loaded: false
  },
  {
    name: 'sqlite',
    displayName: 'SQLite 跨数据库挂载引擎',
    description: '零开销直接挂载与扫描 SQLite 数据库文件，支持跨数据库联合查询与数据表双向复制迁移。',
    category: 'Connect',
    capabilities: ['sqlite_scan', 'ATTACH ... (TYPE SQLITE)', 'Cross-DB Join', 'Catalog Integration'],
    example: "-- 挂载上传的 SQLite 数据库\n-- ATTACH 'local_database.sqlite' AS sqlite_db (TYPE SQLITE);\n-- SELECT * FROM sqlite_db.users LIMIT 10;",
    docsUrl: 'https://duckdb.org/docs/extensions/sqlite',
    tags: ['Relational', 'Embedded', 'Catalog Attach'],
    wasmSupport: 'WASM-Direct',
    installed: true,
    loaded: false
  },
  {
    name: 'tpch',
    displayName: 'TPC-H 决策支持基准套件',
    description: '工业级 TPC-H 决策基准生成器，可一键生成具有复杂关联与业务规律的超大规模分析型数据表。',
    category: 'Core',
    capabilities: ['dbgen(sf=...)', 'Benchmark Queries (22 Templates)', 'OLAP Stress Test'],
    example: "-- 生成比例因子为 0.05 的 TPC-H 测试集\nCALL dbgen(sf=0.05);\nSELECT * FROM customer LIMIT 5;",
    docsUrl: 'https://duckdb.org/docs/extensions/tpch',
    tags: ['Benchmark', 'Stress Test', 'OLAP'],
    wasmSupport: 'Native',
    installed: true,
    loaded: false
  },
  {
    name: 'fts',
    displayName: 'FTS 全文检索引擎',
    description: '内置全文检索与倒排索引内核，支持 BM25 评分算法、词干提取 (Stemming) 与文本相关性排序。',
    category: 'Search',
    capabilities: ['PRAGMA create_fts_index', 'match_bm25', 'Stemming', 'Relevance Scoring'],
    example: "-- 对数据表建立全文索引并进行 BM25 检索\n-- PRAGMA create_fts_index('articles', 'id', 'content');\n-- SELECT *, match_bm25(id, 'duckdb wasm') AS score FROM articles WHERE score IS NOT NULL ORDER BY score DESC;",
    docsUrl: 'https://duckdb.org/docs/extensions/full_text_search',
    tags: ['Full-Text', 'BM25', 'Search Index'],
    wasmSupport: 'WASM-Direct',
    installed: true,
    loaded: false
  },
  {
    name: 'icu',
    displayName: 'ICU 国际化与高精度时区扩展',
    description: '提供 Unicode 国际化组件、全球时区转换 (`TIMESTAMPTZ`)、语言排序规则 (Collation) 与复杂日历计算。',
    category: 'Core',
    capabilities: ['TIMESTAMPTZ Support', 'COLLATE Rules', 'Timezone Conversions', 'Calendar Functions'],
    example: "SELECT current_timestamp::TIMESTAMPTZ AT TIME ZONE 'Asia/Shanghai' AS shanghai_time;",
    docsUrl: 'https://duckdb.org/docs/extensions/icu',
    tags: ['Timezone', 'Unicode', 'Collation'],
    wasmSupport: 'Native',
    installed: true,
    loaded: true
  },
  {
    name: 'spatial',
    displayName: 'Spatial 空间地理信息分析',
    description: '地理信息系统 (GIS) 分析扩展，支持点、线、多边形几何拓扑计算、空间索引与坐标系转换。',
    category: 'Geo',
    capabilities: ['ST_Point', 'ST_Distance', 'ST_Area', 'ST_Contains', 'GeoJSON Parser'],
    example: "SELECT \n  ST_Distance(ST_Point(0, 0), ST_Point(3, 4)) AS distance,\n  ST_Area(ST_PolygonFromText('POLYGON((0 0, 0 5, 5 5, 5 0, 0 0))')) AS area;",
    docsUrl: 'https://duckdb.org/docs/extensions/spatial',
    tags: ['GIS', 'Geometry', 'Spatial Index'],
    wasmSupport: 'WASM-Direct',
    installed: true,
    loaded: false
  },
  {
    name: 'vss',
    displayName: 'VSS 向量相似度检索 (Vector Search)',
    description: '支持高维向量相似度检索、HNSW 向量索引与余弦/欧氏距离计算，赋能 RAG 与 AI 知识库。',
    category: 'AI',
    capabilities: ['HNSW Index', 'array_cosine_similarity', 'array_distance', 'Semantic Search'],
    example: "-- 计算两组 4 维 Embedding 向量的余弦相似度\nSELECT array_cosine_similarity(\n  [1.0, 2.0, 3.0, 4.0]::FLOAT[4], \n  [1.2, 1.8, 3.1, 4.0]::FLOAT[4]\n) AS similarity;",
    docsUrl: 'https://duckdb.org/docs/extensions/vss',
    tags: ['AI Vector', 'HNSW', 'RAG Embeddings'],
    wasmSupport: 'WASM-Direct',
    installed: true,
    loaded: false
  }
];

export const Extensions: React.FC<ExtensionsProps> = ({ onTryExtension }) => {
  const [extensions, setExtensions] = useState<Extension[]>(KNOWN_EXTENSIONS);
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'loaded' | 'unloaded'>('all');
  const [activeDrawerExt, setActiveDrawerExt] = useState<Extension | null>(null);
  const [copiedExample, setCopiedExample] = useState(false);

  // Lakehouse Wizard State
  const [showLakehouseModal, setShowLakehouseModal] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState(LAKEHOUSE_PRESETS[0].url);
  const [remoteFormat, setRemoteFormat] = useState<'parquet' | 'csv' | 'json' | 'iceberg'>(LAKEHOUSE_PRESETS[0].format);
  const [targetTableName, setTargetTableName] = useState(LAKEHOUSE_PRESETS[0].tableName);
  const [isImportingLakehouse, setIsImportingLakehouse] = useState(false);
  const [lakehouseError, setLakehouseError] = useState<string | null>(null);

  // Fetch installed and loaded extensions from DuckDB
  const fetchExtensions = useCallback(async () => {
    setIsRefreshing(true);
    try {
      let liveInstalled: any[] = [];
      try {
        const res = await duckDBService.query('SELECT extension_name, loaded, installed FROM duckdb_extensions()');
        liveInstalled = Array.isArray(res) ? res : [];
      } catch {
        // Fallback for mock/test environments
        liveInstalled = [];
      }

      const merged = KNOWN_EXTENSIONS.map(k => {
        const found = liveInstalled.find(
          (i: any) => (i.extension_name || i.name)?.toLowerCase() === k.name.toLowerCase()
        );
        const isClientSide = k.wasmSupport === 'Emulated';
        const isCore = k.name === 'csv' || k.name === 'icu';

        const isLoaded = isClientSide || isCore ? true : Boolean(found?.loaded);
        const isInstalled = isClientSide || isCore ? true : Boolean(found?.installed || found?.loaded);

        return {
          ...k,
          installed: isInstalled,
          loaded: isLoaded,
        };
      });

      setExtensions(merged);
    } catch (e) {
      console.warn('[Extensions] Fetch extension metadata warning:', e);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchExtensions();
  }, [fetchExtensions]);

  // Load extension dynamically
  const handleLoadExtension = async (name: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (name === 'excel' || name === 'csv' || name === 'icu') {
      toastService.info('已内置就绪', `${name.toUpperCase()} 为系统内置或纯前端解析模块，可直接使用。`);
      return;
    }

    setLoadingMap(prev => ({ ...prev, [name]: true }));
    try {
      const sql = buildExtensionLoadSql(name);
      await duckDBService.query(sql);
      toastService.success(`插件 ${name.toUpperCase()} 加载成功`, 'DuckDB 内核已激活该扩展算子与解析引擎。');
      await fetchExtensions();
    } catch (err: any) {
      console.error(`[Extensions] Load error on ${name}:`, err);
      toastService.error(
        `插件 ${name.toUpperCase()} 加载遇到限制`,
        err?.message || 'DuckDB WASM 运行于沙箱环境，部分 C++ 动态扩展依赖浏览器 WebWorker 预编译支持。'
      );
    } finally {
      setLoadingMap(prev => ({ ...prev, [name]: false }));
    }
  };

  // Keyboard navigation for drawer and modal (ESC to exit)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeDrawerExt) setActiveDrawerExt(null);
        if (showLakehouseModal) setShowLakehouseModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeDrawerExt, showLakehouseModal]);

  // Category counts
  const categories = useMemo(() => ['All', 'Format', 'Core', 'Connect', 'Search', 'Geo', 'AI'], []);

  // Filtered extensions
  const filteredExtensions = useMemo(() => {
    return extensions.filter(ext => {
      const q = search.toLowerCase().trim();
      const matchesSearch = !q ||
        ext.name.toLowerCase().includes(q) ||
        ext.displayName.toLowerCase().includes(q) ||
        ext.description.toLowerCase().includes(q) ||
        ext.capabilities.some(c => c.toLowerCase().includes(q)) ||
        ext.tags.some(t => t.toLowerCase().includes(q));

      const matchesCat = selectedCategory === 'All' || ext.category === selectedCategory;

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'loaded' && ext.loaded) ||
        (statusFilter === 'unloaded' && !ext.loaded);

      return matchesSearch && matchesCat && matchesStatus;
    });
  }, [extensions, search, selectedCategory, statusFilter]);

  // Grouping
  const grouped = useMemo(() => {
    return filteredExtensions.reduce((acc, ext) => {
      if (!acc[ext.category]) acc[ext.category] = [];
      acc[ext.category].push(ext);
      return acc;
    }, {} as Record<string, Extension[]>);
  }, [filteredExtensions]);

  // Stats calculation
  const stats = useMemo(() => {
    const total = extensions.length;
    const loadedCount = extensions.filter(e => e.loaded).length;
    const formatCount = extensions.filter(e => e.category === 'Format').length;
    return { total, loadedCount, formatCount };
  }, [extensions]);

  const categoryTabItems = useMemo(() => {
    return categories.map(cat => ({
      value: cat,
      label: cat === 'All' ? '全部' : cat,
      badge: cat === 'All' ? extensions.length : extensions.filter(e => e.category === cat).length,
    }));
  }, [categories, extensions]);

  const statusTabItems = useMemo(() => [
    { value: 'all' as const, label: '全部', badge: extensions.length },
    { value: 'loaded' as const, label: '已激活', badge: stats.loadedCount },
    { value: 'unloaded' as const, label: '待命', badge: stats.total - stats.loadedCount },
  ], [extensions.length, stats.loadedCount, stats.total]);

  // Lakehouse SQL generator
  const generatedRemoteSql = useMemo(() => {
    const url = remoteUrl.trim();
    if (!url) return '-- 请输入远程文件 URL';
    if (remoteFormat === 'parquet') return `SELECT * FROM read_parquet('${url}') LIMIT 100;`;
    if (remoteFormat === 'csv') return `SELECT * FROM read_csv_auto('${url}') LIMIT 100;`;
    if (remoteFormat === 'json') return `SELECT * FROM read_json_auto('${url}') LIMIT 100;`;
    return `SELECT * FROM read_parquet('${url}') LIMIT 100;`;
  }, [remoteUrl, remoteFormat]);

  // Handle Preset Fill
  const handleApplyPreset = (preset: LakehousePreset) => {
    setRemoteFormat(preset.format);
    setRemoteUrl(preset.url);
    setTargetTableName(preset.tableName);
    setLakehouseError(null);
  };

  // Lakehouse table importer
  const handleCreateRemoteTable = async () => {
    const url = remoteUrl.trim();
    const tableName = targetTableName.trim() || 'remote_lakehouse_data';
    if (!url) {
      setLakehouseError('远程文件 URL 不能为空');
      return;
    }

    setIsImportingLakehouse(true);
    setLakehouseError(null);

    try {
      let createSql = `CREATE TABLE "${tableName}" AS SELECT * FROM read_parquet('${url}');`;
      if (remoteFormat === 'csv') {
        createSql = `CREATE TABLE "${tableName}" AS SELECT * FROM read_csv_auto('${url}');`;
      } else if (remoteFormat === 'json') {
        createSql = `CREATE TABLE "${tableName}" AS SELECT * FROM read_json_auto('${url}');`;
      }

      await duckDBService.query(createSql);
      toastService.success(
        `持久化数据表 "${tableName}" 创建成功`,
        `已成功通过 HTTPFS 协议拉取 ${remoteFormat.toUpperCase()} 远程数据并落库。`
      );
      setShowLakehouseModal(false);
      window.dispatchEvent(new CustomEvent('duckdb-schema-changed'));
    } catch (err: any) {
      console.error('[Lakehouse] Import table error:', err);
      const errMsg = err?.message || String(err);
      setLakehouseError(errMsg);
      toastService.error('远程湖仓数据表导入失败', errMsg);
    } finally {
      setIsImportingLakehouse(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedExample(true);
    toastService.info('代码已复制到剪贴板');
    setTimeout(() => setCopiedExample(false), 2000);
  };

  return (
    <div className="h-full flex flex-col bg-monokai-bg font-sans select-none overflow-hidden text-monokai-fg">
      {/* ── Page Header ────────────────────────────────────────────── */}
      <PageHeader
        title="扩展插件与 Lakehouse 湖仓引擎"
        description="管理 DuckDB 插件生态能力，支持 HTTPFS / Parquet / S3 远程零拷贝数据湖直连与即席算子加速"
        icon={Cloud}
        badge={
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-monokai-surface border border-monokai-border text-monokai-blue text-xs font-mono font-medium shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-monokai-blue" />
            {stats.loadedCount}/{stats.total} 引擎已就绪
          </div>
        }
        actions={
          <div className="flex items-center gap-2.5">
            <IconButton
              label="刷新插件状态"
              icon={RefreshCw}
              tone="primary"
              size="md"
              onClick={fetchExtensions}
              className={isRefreshing ? 'animate-spin' : ''}
            />
            <ActionButton
              variant="primary"
              icon={Cloud}
              onClick={() => {
                setLakehouseError(null);
                setShowLakehouseModal(true);
              }}
            >
              远程数据湖向导 (Lakehouse)
            </ActionButton>
          </div>
        }
      />

      {/* ── KPI & Ecosystem Metrics Strip ───────────────────────────── */}
      <div className="border-b border-monokai-border bg-monokai-sidebar/60 px-5 py-2 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-monokai-comment font-medium">生态插件:</span>
            <span className="font-mono font-bold text-monokai-blue">{stats.total}</span>
            <span className="text-[10px] text-monokai-comment">个可用模组</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-monokai-comment font-medium">已激活加载:</span>
            <span className="font-mono font-bold text-monokai-green">{stats.loadedCount}</span>
            <span className="text-[10px] text-monokai-comment">Active</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-monokai-comment font-medium">湖仓格式引擎:</span>
            <span className="font-mono font-bold text-monokai-yellow">{stats.formatCount}</span>
            <span className="text-[10px] text-monokai-comment">Parquet/CSV/JSON/Excel</span>
          </div>

          <div className="flex items-center gap-1.5 text-monokai-comment">
            <ShieldCheck size={14} className="text-monokai-blue" />
            <span>沙箱环境:</span>
            <span className="font-mono text-monokai-fg">WebWorker In-Browser WASM</span>
          </div>
        </div>

        <div className="text-[11px] text-monokai-comment font-mono flex items-center gap-1.5">
          <Info size={13} className="text-monokai-blue" />
          <span>点击任意卡片查看详细 API 与即席测试代码</span>
        </div>
      </div>

      {/* ── Secondary Toolbar: Search, Categories & Status Filter ──── */}
      <div className="flex min-h-13 flex-wrap items-center justify-between gap-3 border-b border-monokai-border bg-monokai-sidebar px-5 py-2.5 shrink-0 backdrop-blur-md">
        <div className="flex flex-1 flex-wrap items-center gap-3 min-w-[280px]">
          <SearchInput
            value={search}
            onChange={setSearch}
            onClear={() => setSearch('')}
            placeholder="搜索插件名称、描述、SQL 算子或能力标签..."
            className="w-full sm:w-80"
          />

          {/* Category Filter Tabs */}
          <SegmentedTabs
            aria-label="插件分类过滤"
            value={selectedCategory}
            items={categoryTabItems}
            onChange={setSelectedCategory}
            size="sm"
            tone="accent"
          />
        </div>

        {/* Status Toggle Filter */}
        <div className="flex items-center gap-2">
          <SegmentedTabs
            aria-label="插件状态过滤"
            value={statusFilter}
            items={statusTabItems}
            onChange={(val) => setStatusFilter(val as 'all' | 'loaded' | 'unloaded')}
            size="sm"
            tone="accent"
          />
        </div>
      </div>

      {/* ── Main Content Area: Tier 1 Discovery Board ───────────────── */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
        {filteredExtensions.length === 0 ? (
          <EmptyState
            icon={Cloud}
            title={`未找到匹配条件的插件`}
            description="请尝试调整搜索关键词、切换分类标签或重置状态筛选。"
            action={
              <ActionButton
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setSelectedCategory('All');
                  setStatusFilter('all');
                }}
              >
                重置所有筛选条件
              </ActionButton>
            }
          />
        ) : (
          Object.keys(grouped).map(category => {
            const exts = grouped[category];
            return (
              <section key={category} className="mb-8 last:mb-2 animate-[slideIn_0.25s_ease-out]">
                {/* Category Header */}
                <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-monokai-border">
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-1 rounded-full bg-monokai-accent" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-monokai-comment">
                      {category} 层级能力
                    </h3>
                    <span className="text-[11px] font-mono text-monokai-comment bg-monokai-surface px-1.5 py-0.5 rounded border border-monokai-border">
                      {exts.length} 个模组
                    </span>
                  </div>
                </div>

                {/* Card Grid with Intrinsic Sizing (Tier 1) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {exts.map(ext => {
                    const isLoading = Boolean(loadingMap[ext.name]);
                    return (
                      <div
                        key={ext.name}
                        onClick={() => setActiveDrawerExt(ext)}
                        className="h-full flex flex-col justify-between rounded-xl border border-monokai-border bg-monokai-surface/60 hover:bg-monokai-surface hover:border-monokai-border-strong p-4 transition-all duration-200 cursor-pointer group relative overflow-hidden select-text shadow-xs"
                      >
                        {/* Card Header */}
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono font-bold text-sm text-monokai-fg truncate group-hover:text-monokai-accent transition-colors">
                                {ext.name}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-monokai-sidebar text-monokai-comment border border-monokai-border font-mono shrink-0">
                                {ext.category}
                              </span>
                            </div>

                            {/* Status Beacon */}
                            <div className="shrink-0 flex items-center">
                              {ext.loaded ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-emerald-400 bg-emerald-500/10 border border-monokai-border-subtle px-1.5 py-0.5 rounded">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-monokai-comment bg-monokai-sidebar border border-monokai-border px-1.5 py-0.5 rounded">
                                  <span className="w-1.5 h-1.5 rounded-full bg-monokai-comment/50" />
                                  Ready
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Display Name & Description */}
                          <div className="mb-2 text-xs font-medium text-monokai-fg/90">
                            {ext.displayName}
                          </div>
                          <p className="text-[11px] text-monokai-comment line-clamp-2 leading-relaxed mb-3">
                            {ext.description}
                          </p>

                          {/* Capability Tags */}
                          <div className="flex flex-wrap gap-1 mb-3">
                            {ext.capabilities.slice(0, 3).map(cap => (
                              <span
                                key={cap}
                                className="text-[10px] font-mono bg-monokai-sidebar text-monokai-fg-muted border border-monokai-border px-1.5 py-0.5 rounded truncate max-w-[140px]"
                                title={cap}
                              >
                                {cap}
                              </span>
                            ))}
                            {ext.capabilities.length > 3 && (
                              <span className="text-[10px] font-mono bg-monokai-surface text-monokai-comment px-1 py-0.5 rounded">
                                +{ext.capabilities.length - 3}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Card Footer Actions */}
                        <div className="pt-3 border-t border-monokai-border/60 flex items-center justify-between gap-2 mt-auto">
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setActiveDrawerExt(ext);
                            }}
                            className="text-xs text-monokai-comment hover:text-monokai-blue font-medium flex items-center gap-1 cursor-pointer transition-colors group-hover:translate-x-0.5"
                          >
                            <span>详情与示例</span>
                            <ArrowRight size={12} />
                          </button>

                          <div className="flex items-center gap-1.5">
                            {ext.example && (
                              <button
                                type="button"
                                title="在 SQL 编辑器中运行测试"
                                onClick={e => {
                                  e.stopPropagation();
                                  onTryExtension(ext.example!);
                                  toastService.info('已将插件示例 SQL 载入编辑器');
                                }}
                                className="h-7 px-2 text-xs rounded-md bg-monokai-surface hover:bg-monokai-blue/15 hover:text-monokai-blue text-monokai-comment border border-monokai-border transition-colors flex items-center gap-1 font-mono cursor-pointer"
                              >
                                <Play size={11} /> 运行
                              </button>
                            )}

                            {!ext.loaded && (
                              <ActionButton
                                variant="primary"
                                size="sm"
                                loading={isLoading}
                                onClick={e => handleLoadExtension(ext.name, e)}
                              >
                                {isLoading ? '加载中' : '激活'}
                              </ActionButton>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </div>

      {/* ── Tier 2: Dedicated Extension Inspector Drawer ────────────── */}
      {activeDrawerExt && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${activeDrawerExt.displayName} 扩展详情`}
          className="fixed inset-0 z-[150] flex justify-end bg-black/60 backdrop-blur-xs animate-[fadeIn_0.2s_ease-out]"
          onClick={() => setActiveDrawerExt(null)}
        >
          <div
            className="w-full max-w-xl h-full bg-monokai-sidebar border-l border-monokai-border shadow-2xl flex flex-col justify-between overflow-hidden animate-[slideLeft_0.25s_ease-out]"
            onClick={e => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-monokai-border bg-monokai-sidebar/95 flex items-start justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-monokai-surface border border-monokai-border flex items-center justify-center text-monokai-blue shrink-0">
                  <Box size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-mono font-bold text-monokai-fg">
                      {activeDrawerExt.name}
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-monokai-surface border border-monokai-border text-monokai-blue">
                      {activeDrawerExt.category}
                    </span>
                    {activeDrawerExt.loaded ? (
                      <span className="text-[10px] font-mono font-bold text-monokai-green bg-monokai-green/10 border border-monokai-green/30 px-2 py-0.5 rounded">
                        Active
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-monokai-yellow bg-monokai-yellow/10 border border-monokai-yellow/30 px-2 py-0.5 rounded">
                        Available
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-monokai-fg/80 mt-0.5 font-medium">
                    {activeDrawerExt.displayName}
                  </p>
                </div>
              </div>

              <IconButton
                label="关闭抽屉"
                icon={X}
                size="sm"
                onClick={() => setActiveDrawerExt(null)}
              />
            </div>

            {/* Drawer Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar text-xs font-sans">
              {/* Section 1: Overview & Documentation */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-monokai-comment mb-2 flex items-center gap-1.5">
                  <BookOpen size={13} className="text-monokai-blue" />
                  插件概览与设计定位
                </h4>
                <p className="text-xs text-monokai-fg/90 leading-relaxed bg-monokai-surface p-3.5 rounded-lg border border-monokai-border">
                  {activeDrawerExt.description}
                </p>

                {activeDrawerExt.docsUrl && (
                  <div className="mt-2.5 flex justify-end">
                    <a
                      href={activeDrawerExt.docsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-monokai-blue hover:underline font-mono"
                    >
                      <span>查看 DuckDB 官方技术文档</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                )}
              </div>

              {/* Section 2: Capability & Operator Matrix */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-monokai-comment mb-2.5 flex items-center gap-1.5">
                  <Zap size={13} className="text-monokai-yellow" />
                  导出的 SQL 算子与核心能力
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeDrawerExt.capabilities.map((cap, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2.5 rounded-lg bg-monokai-surface border border-monokai-border text-monokai-fg"
                    >
                      <CheckCircle2 size={13} className="text-monokai-green shrink-0" />
                      <span className="font-mono text-xs text-monokai-blue truncate">{cap}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 3: Interactive Quick Start Example */}
              {activeDrawerExt.example && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-monokai-comment flex items-center gap-1.5">
                      <TerminalSquare size={13} className="text-monokai-green" />
                      快速上手与测试 SQL (Quick Start)
                    </h4>
                  </div>
                  <CodeHighlightBlock
                    code={activeDrawerExt.example}
                    language="sql"
                    title={`QUICK START: ${activeDrawerExt.name.toUpperCase()}`}
                    allowFormat={true}
                    maxHeight="280px"
                  />
                </div>
              )}

              {/* Section 4: Engine Architecture & WASM Runtime Notes */}
              <div className="bg-monokai-surface/60 border border-monokai-border p-3.5 rounded-lg flex items-start gap-2.5">
                <Info size={16} className="text-monokai-blue shrink-0 mt-0.5" />
                <div className="text-[11px] text-monokai-comment leading-relaxed">
                  <span className="font-bold text-monokai-fg block mb-0.5">WASM 运行机制说明:</span>
                  本工作区运行在 WebAssembly 沙箱中。大部分格式解析（Parquet/CSV/JSON）与核心算子已内置于内存引擎，部分高级 C++ 动态加载插件遵循浏览器安全策略。
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-monokai-border bg-monokai-sidebar/95 flex items-center justify-between gap-3 shrink-0">
              <div>
                {!activeDrawerExt.loaded ? (
                  <ActionButton
                    variant="primary"
                    loading={Boolean(loadingMap[activeDrawerExt.name])}
                    onClick={() => handleLoadExtension(activeDrawerExt.name)}
                  >
                    {loadingMap[activeDrawerExt.name] ? '加载中...' : '一键激活扩展'}
                  </ActionButton>
                ) : (
                  <div className="flex items-center gap-1.5 text-monokai-green text-xs font-mono">
                    <Check size={14} /> 扩展已激活就绪
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {activeDrawerExt.example && (
                  <ActionButton
                    variant="success"
                    icon={Play}
                    onClick={() => {
                      onTryExtension(activeDrawerExt.example!);
                      setActiveDrawerExt(null);
                      toastService.info('已将示例 SQL 载入 SQL 编辑器');
                    }}
                  >
                    在 SQL 编辑器运行
                  </ActionButton>
                )}
                <ActionButton
                  variant="secondary"
                  onClick={() => setActiveDrawerExt(null)}
                >
                  关闭
                </ActionButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Lakehouse Remote File Loader Modal (Upgraded) ────────────── */}
      {showLakehouseModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Lakehouse 远程文件与数据湖直连向导"
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-[fadeIn_0.2s_ease-out]"
          onClick={() => setShowLakehouseModal(false)}
        >
          <div
            className="bg-monokai-sidebar border border-monokai-border rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden relative flex flex-col animate-[scaleUp_0.2s_ease-out]"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-monokai-border bg-monokai-sidebar flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-monokai-surface border border-monokai-border flex items-center justify-center text-monokai-accent shrink-0">
                  <Cloud size={22} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-monokai-fg">
                    Lakehouse 远程文件与数据湖直连向导
                  </h3>
                  <p className="text-xs text-monokai-comment mt-0.5">
                    基于 DuckDB HTTPFS/Parquet 引擎零复制直连远程 Parquet / CSV / JSON 云端数据源
                  </p>
                </div>
              </div>

              <IconButton
                label="关闭弹窗"
                icon={X}
                size="sm"
                onClick={() => setShowLakehouseModal(false)}
              />
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs font-sans max-h-[70vh] overflow-y-auto custom-scrollbar">
              {/* Presets Bar */}
              <div>
                <label className="block text-monokai-fg font-medium mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Sparkles size={12} className="text-monokai-accent" />
                    推荐预设示例 (一键填充):
                  </span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {LAKEHOUSE_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                        remoteUrl === preset.url
                          ? 'bg-monokai-surface border-monokai-accent/70 text-monokai-fg shadow-xs'
                          : 'bg-monokai-surface/60 border-monokai-border text-monokai-comment hover:text-monokai-fg hover:border-monokai-border/90'
                      }`}
                    >
                      <div className="font-medium text-xs text-monokai-fg flex items-center justify-between">
                        <span className="truncate">{preset.name}</span>
                        <span className="font-mono text-[9px] uppercase px-1 py-0.2 rounded bg-monokai-bg border border-monokai-border text-monokai-fg-muted">
                          {preset.format}
                        </span>
                      </div>
                      <div className="text-[10px] text-monokai-comment truncate mt-0.5">
                        {preset.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Data Format Selector */}
              <div>
                <label className="block text-monokai-fg font-medium mb-1.5">
                  数据格式 (Data Format)
                </label>
                <div className="flex gap-2">
                  {(['parquet', 'csv', 'json', 'iceberg'] as const).map(fmt => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setRemoteFormat(fmt)}
                      className={`flex-1 py-1.5 rounded-lg font-mono text-xs uppercase border transition-all cursor-pointer font-semibold ${
                        remoteFormat === fmt
                          ? 'bg-monokai-accent text-monokai-bg border-monokai-accent shadow-xs'
                          : 'bg-monokai-surface text-monokai-comment border-monokai-border hover:text-monokai-fg hover:border-monokai-border/90'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Remote URL Input */}
              <div>
                <label className="block text-monokai-fg font-medium mb-1.5">
                  远程文件 URL (HTTPS / S3 / GitHub Raw URL)
                </label>
                <input
                  type="text"
                  value={remoteUrl}
                  onChange={e => {
                    setRemoteUrl(e.target.value);
                    setLakehouseError(null);
                  }}
                  placeholder="https://example.com/lakehouse_data.parquet"
                  className="w-full bg-monokai-surface border border-monokai-border focus:border-monokai-accent text-monokai-fg px-3 py-2 rounded-lg outline-none text-xs font-mono transition-colors"
                />
              </div>

              {/* Target Table Name Input */}
              <div>
                <label className="block text-monokai-fg font-medium mb-1.5">
                  持久化目标表名 (Target Table Name)
                </label>
                <input
                  type="text"
                  value={targetTableName}
                  onChange={e => setTargetTableName(e.target.value)}
                  placeholder="remote_lakehouse_table"
                  className="w-full bg-monokai-surface border border-monokai-border focus:border-monokai-accent text-monokai-fg px-3 py-2 rounded-lg outline-none text-xs font-mono transition-colors"
                />
              </div>

              {/* Generated SQL Code Block */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-monokai-comment font-semibold uppercase">
                    生成的 DuckDB 执行 SQL
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyCode(generatedRemoteSql)}
                    className="text-[10px] text-monokai-comment hover:text-monokai-fg flex items-center gap-1 cursor-pointer"
                  >
                    <Copy size={10} /> 复制
                  </button>
                </div>
                <div className="p-3 bg-monokai-bg rounded-lg border border-monokai-border font-mono text-xs text-monokai-fg-muted break-all select-text">
                  <code>{generatedRemoteSql}</code>
                </div>
              </div>

              {/* Error Box if any */}
              {lakehouseError && (
                <div className="p-3 bg-monokai-surface border border-rose-500/20 rounded-lg flex items-start gap-2 text-rose-400 text-xs">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <div className="break-all">{lakehouseError}</div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-monokai-border bg-monokai-sidebar flex items-center justify-between gap-3">
              <ActionButton
                variant="ghost"
                onClick={() => setShowLakehouseModal(false)}
              >
                取消
              </ActionButton>

              <div className="flex items-center gap-2">
                <ActionButton
                  variant="secondary"
                  onClick={() => {
                    onTryExtension(generatedRemoteSql);
                    setShowLakehouseModal(false);
                    toastService.info('已将远程查询载入 SQL 编辑器');
                  }}
                >
                  在 SQL 编辑器试用
                </ActionButton>
                <ActionButton
                  variant="primary"
                  icon={Table2}
                  loading={isImportingLakehouse}
                  onClick={handleCreateRemoteTable}
                >
                  {isImportingLakehouse ? '正在拉取创建...' : '一键导入为持久化数据表'}
                </ActionButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};