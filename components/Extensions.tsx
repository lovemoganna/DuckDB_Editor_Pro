import React, { useEffect, useState } from 'react';
import { duckDBService } from '../services/duckdbService';


interface Extension {
    name: string;
    installed: boolean;
    loaded: boolean;
    description: string;
    category: 'Core' | 'Format' | 'Search' | 'Geo' | 'Connect' | 'Other';
    capabilities: string[];
    example?: string;
    docsUrl?: string;
}

interface ExtensionsProps {
    onTryExtension: (code: string) => void;
}

export const Extensions: React.FC<ExtensionsProps> = ({ onTryExtension }) => {
    const [extensions, setExtensions] = useState<Extension[]>([]);
    const [loading, setLoading] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [expandedCard, setExpandedCard] = useState<string | null>(null);

    // Categorized List with Capabilities & Examples
    const KNOWN_EXTENSIONS: Partial<Extension>[] = [
        {
            name: 'csv',
            description: 'High-performance CSV reader/writer. Automatically detects dialect, types, and headers.',
            category: 'Format',
            capabilities: ['read_csv_auto', 'COPY ... TO ... (FORMAT CSV)'],
            example: "-- Read CSV file directly\nSELECT * FROM read_csv_auto('https://raw.githubusercontent.com/datasciencedojo/datasets/master/titanic.csv');",
            docsUrl: 'https://duckdb.org/docs/data/csv/overview'
        },
        {
            name: 'excel',
            description: 'Client-side Excel parsing support. Import .xlsx and .xls files directly via the Import Wizard.',
            category: 'Format',
            capabilities: ['xlsx', 'xls', 'Client-Side'],
            example: "-- This feature is integrated into the UI Import Wizard.\n-- Use the 'Import Data' button on the sidebar to load Excel files.",
            docsUrl: 'https://sheetjs.com/' // SheetJS since we use it client-side
        },
        {
            name: 'json',
            description: 'Advanced JSON manipulation. Read nested JSON, extract fields, and structure JSON schemas.',
            category: 'Format',
            capabilities: ['read_json_auto', 'json_extract', 'to_json'],
            example: "-- Read JSON file directly\nSELECT * FROM read_json_auto('https://raw.githubusercontent.com/duckdb/duckdb-data/main/json/data.json');",
            docsUrl: 'https://duckdb.org/docs/extensions/json'
        },
        {
            name: 'parquet',
            description: 'Industry standard columnar storage. High compression and fast reads.',
            category: 'Format',
            capabilities: ['read_parquet', 'COPY TO ... PARQUET'],
            example: "-- Read remote Parquet file\nSELECT * FROM read_parquet('https://raw.githubusercontent.com/duckdb/duckdb-data/main/parquet/data.parquet') LIMIT 5;",
            docsUrl: 'https://duckdb.org/docs/data/parquet'
        },
        {
            name: 'sqlite',
            description: 'Read and write SQLite database files directly. Attach SQLite databases as DuckDB catalogs.',
            category: 'Connect',
            capabilities: ['sqlite_scan', 'ATTACH ... (TYPE SQLITE)'],
            example: "-- Attach a SQLite DB (requires file upload first)\n-- ATTACH 'my_db.sqlite' AS lite (TYPE SQLITE);\n-- SELECT * FROM lite.some_table;",
            docsUrl: 'https://duckdb.org/docs/extensions/sqlite'
        },
        {
            name: 'tpch',
            description: 'TPC-H benchmark data generator. Instantly create massive datasets for performance testing.',
            category: 'Core',
            capabilities: ['dbgen'],
            example: "-- Generate TPC-H tables (scale factor 0.1)\nCALL dbgen(sf=0.1);\nSELECT * FROM customer LIMIT 5;",
            docsUrl: 'https://duckdb.org/docs/extensions/tpch'
        },
        {
            name: 'fts',
            description: 'Full Text Search engine. Adds BM25 scoring and stemming capabilities.',
            category: 'Search',
            capabilities: ['fts_index', 'match_bm25'],
            example: "-- Assuming 'articles' table exists\nPRAGMA create_fts_index('articles', 'id', 'content');\nSELECT *, match_bm25(id, 'search term') AS score \nFROM articles \nWHERE score IS NOT NULL \nORDER BY score DESC;",
            docsUrl: 'https://duckdb.org/docs/extensions/full_text_search'
        },
        {
            name: 'icu',
            description: 'International Components for Unicode. Required for correct timezones and collations.',
            category: 'Core',
            capabilities: ['TIMESTAMPTZ', 'COLLATE'],
            example: "SELECT current_timestamp::TIMESTAMPTZ AT TIME ZONE 'Asia/Tokyo';",
            docsUrl: 'https://duckdb.org/docs/extensions/icu'
        },
        {
            name: 'spatial',
            description: 'Geospatial analytics. Points, lines, polygons and geometric operations. (WASM Limited)',
            category: 'Geo',
            capabilities: ['st_point', 'st_area', 'st_distance'],
            example: "SELECT st_distance(\n  st_point(0, 0),\n  st_point(3, 4)\n) as dist;",
            docsUrl: 'https://duckdb.org/docs/extensions/spatial'
        },
        {
            name: 'httpfs',
            description: 'Remote file system access. Read data directly from S3, HTTP, or HTTPS URLs.',
            category: 'Connect',
            capabilities: ['s3://', 'https://'],
            example: "SELECT * FROM read_csv_auto('https://raw.githubusercontent.com/datasciencedojo/datasets/master/titanic.csv') LIMIT 5;",
            docsUrl: 'https://duckdb.org/docs/extensions/httpfs'
        },
    ];

    const fetchExtensions = async () => {
        try {
            const installed = await duckDBService.getExtensions();
            const merged: Extension[] = KNOWN_EXTENSIONS.map(k => {
                const found = installed.find((i: any) => i.extension_name === k.name || i.name === k.name);
                // Excel is client-side, always "loaded" in UI terms
                const isClientSide = k.capabilities?.includes('Client-Side');
                // CSV is core/always available
                const isCore = k.name === 'csv';

                return {
                    name: k.name!,
                    description: k.description!,
                    category: (k.category as any) || 'Other',
                    capabilities: k.capabilities || [],
                    example: k.example,
                    docsUrl: k.docsUrl,
                    installed: isClientSide || isCore ? true : (!!found && found.installed),
                    loaded: isClientSide || isCore ? true : (!!found && found.loaded)
                };
            });
            setExtensions(merged);
        } catch (e) {
            console.error("Failed to fetch extensions", e);
        }
    };

    useEffect(() => {
        fetchExtensions();
    }, []);

    const handleLoad = async (name: string) => {
        // Skip for client-side or core
        if (name === 'excel' || name === 'csv') return;

        setLoading(name);
        try {
            await duckDBService.loadExtension(name);
            await fetchExtensions();
        } catch (e) {
            alert(`Failed to load ${name}. DuckDB WASM has specific limitations on dynamic loading.`);
        } finally {
            setLoading(null);
        }
    };

    const grouped = extensions.reduce((acc, ext) => {
        if (!ext.name.includes(search) && !ext.description.includes(search)) return acc;
        if (!acc[ext.category]) acc[ext.category] = [];
        acc[ext.category].push(ext);
        return acc;
    }, {} as Record<string, Extension[]>);

    return (
        <div className="p-8 h-full overflow-auto bg-monokai-bg">
            <header className="mb-8 flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold text-monokai-yellow mb-2 flex items-center gap-3">
                        <span>🧩</span> System Modules
                    </h2>
                    <p className="text-monokai-comment">Extend the core kernel with specialized capabilities.</p>
                </div>
                <div className="relative">
                    <span className="absolute left-3 top-2.5 text-monokai-comment">🔍</span>
                    <input
                        className="bg-monokai-sidebar border border-monokai-accent rounded-full pl-10 pr-4 py-2 text-white outline-none focus:border-monokai-blue w-64 transition-colors"
                        placeholder="Find module..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </header>

            {Object.keys(grouped).length === 0 && (
                <div className="text-center py-20 opacity-50">
                    <div className="text-4xl mb-4">📦</div>
                    <div>No modules found matching "{search}"</div>
                </div>
            )}

            {Object.keys(grouped).map((category) => {
                const exts = grouped[category];
                return (
                    <div key={category} className="mb-8 animate-[slideIn_0.3s_ease-out]">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-monokai-comment mb-4 border-b border-monokai-accent pb-2">
                            {category} Layer
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {exts.map(ext => (
                                <div
                                    key={ext.name}
                                    className={`bg-monokai-sidebar border rounded-lg p-5 flex flex-col justify-between transition-all duration-200 group relative overflow-hidden cursor-pointer ${ext.loaded ? 'border-monokai-green/30 shadow-[0_0_15px_-5px_rgba(166,226,46,0.1)]' : 'border-monokai-accent hover:border-monokai-comment'}`}
                                    onClick={() => setExpandedCard(expandedCard === ext.name ? null : ext.name)}
                                >
                                    {/* Status Indicator */}
                                    <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-white/5 to-transparent -mr-8 -mt-8 rounded-full blur-xl transition-opacity ${ext.loaded ? 'opacity-100 from-monokai-green/20' : 'opacity-0'}`}></div>

                                    <div>
                                        <div className="flex justify-between items-start mb-3">
                                            <h4 className="text-xl font-mono font-bold text-monokai-fg flex items-center gap-2">
                                                {ext.name}
                                                {ext.loaded && <span className="text-[10px] text-monokai-bg bg-monokai-green px-1.5 rounded font-sans uppercase font-bold">Active</span>}
                                            </h4>
                                            {ext.docsUrl && (
                                                <a
                                                    href={ext.docsUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    onClick={e => e.stopPropagation()}
                                                    className="text-[10px] text-monokai-comment hover:text-monokai-blue bg-monokai-bg px-2 py-0.5 rounded border border-monokai-accent"
                                                >
                                                    Docs ↗
                                                </a>
                                            )}
                                        </div>
                                        <p className="text-sm text-monokai-comment leading-relaxed mb-4 min-h-[40px]">
                                            {ext.description}
                                        </p>

                                        {/* Capabilities Tags */}
                                        <div className="flex flex-wrap gap-1.5 mb-4">
                                            {ext.capabilities.map(cap => (
                                                <span key={cap} className="text-[10px] font-mono bg-monokai-bg border border-monokai-accent px-1.5 py-0.5 rounded text-monokai-blue opacity-80">
                                                    {cap}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {expandedCard === ext.name && ext.example && (
                                        <div className="mb-4 bg-monokai-bg rounded p-3 border border-monokai-accent/50 animate-[fadeIn_0.2s]">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[10px] font-bold text-monokai-yellow uppercase">Quick Start</span>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onTryExtension(ext.example!); }}
                                                    className="text-[10px] bg-monokai-green text-monokai-bg px-2 py-0.5 rounded font-bold hover:opacity-80"
                                                >
                                                    Try Example
                                                </button>
                                            </div>
                                            <pre className="text-[10px] font-mono overflow-x-auto text-monokai-comment">
                                                <code className="select-text">{ext.example}</code>
                                            </pre>
                                        </div>
                                    )}

                                    <div className="mt-auto pt-4 border-t border-monokai-accent/30 flex justify-between items-center">
                                        <div className="flex items-center gap-2 text-xs text-monokai-comment">
                                            <div className={`w-1.5 h-1.5 rounded-full ${ext.loaded ? 'bg-monokai-green animate-pulse' : 'bg-monokai-comment/50'}`}></div>
                                            {ext.loaded ? 'Module Loaded' : 'Not Loaded'}
                                        </div>
                                        <div className="flex gap-2">
                                            <button className="text-xs text-monokai-comment hover:text-white underline decoration-dashed">
                                                {expandedCard === ext.name ? 'Less info' : 'More info'}
                                            </button>
                                            {!ext.loaded && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleLoad(ext.name); }}
                                                    disabled={loading === ext.name}
                                                    className="px-4 py-1.5 bg-monokai-accent hover:bg-monokai-blue hover:text-monokai-bg text-monokai-blue text-xs font-bold rounded uppercase tracking-wider transition-colors disabled:opacity-50"
                                                >
                                                    {loading === ext.name ? 'Installing...' : 'Install'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            })}
        </div>
    );
};