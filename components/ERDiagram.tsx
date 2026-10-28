import React, { useEffect, useRef, useState } from 'react';
import { useVisualizationRequest } from '../hooks/useVisualizationRequest';
import { useAppStore } from '../hooks/store/useAppStore';
import { useUiTheme } from '../services/uiTheme';
import mermaid from 'mermaid';
import { duckDBService } from '../services/duckdbService';
import { Copy, Play, Wrench } from 'lucide-react';

interface ERDiagramProps {
    onExecuteSql?: (sql: string) => void;
}

export const ERDiagram: React.FC<ERDiagramProps> = ({ onExecuteSql }) => {
    const [svg, setSvg] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const request = useVisualizationRequest();
    const database = useAppStore(state => state.currentDatabase);
    const theme = useUiTheme(state => state.theme);
    const isLight = theme === 'light';
    const [schemas, setSchemas] = useState<any[]>([]);
    const [relationships, setRelationships] = useState<any[]>([]);
    const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
    const [generatedSql, setGeneratedSql] = useState<string>('');

    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        mermaid.initialize({
            startOnLoad: false,
            theme: isLight ? 'neutral' : 'dark',
            themeCSS: isLight ? `
                .entityTitle { fill: #272822 !important; font-weight: bold; }
                .entityBody { fill: #fcfcfa !important; stroke: #d3d3c7 !important; }
                .attributeTitle { fill: #272822 !important; }
                .relationshipLabel { fill: #272822 !important; background-color: #f1f1eb !important; }
                line { stroke: #b8b8a8 !important; }
                path { stroke: #b8b8a8 !important; }
                .card { fill: #f1f1eb !important; stroke: #d3d3c7 !important; }
                text { fill: #272822 !important; }
            ` : `
                .entityTitle { fill: #f8f8f2 !important; }
                .entityBody { fill: #1e1f1c !important; stroke: #49483e !important; }
                .attributeTitle { fill: #f8f8f2 !important; }
                .relationshipLabel { fill: #f8f8f2 !important; background-color: #272822 !important; }
                line { stroke: #49483e !important; }
                path { stroke: #49483e !important; }
                .card { fill: #272822 !important; stroke: #49483e !important; }
                text { fill: #f8f8f2 !important; }
            `,
            securityLevel: 'loose',
        });
        loadSchema();
        return request.invalidate;
    }, [database, theme, request]);

    const loadSchema = async () => {
        const current = request.begin();
        setLoading(true);
        setSvg(''); setError(null); setSchemas([]); setRelationships([]); setSelectedTables(new Set()); setGeneratedSql('');
        try {
            const s = await duckDBService.getAllTablesSchema();
            if (!current()) return;
            setSchemas(s);
            const rels = await duckDBService.inferRelationships(s);
            if (!current()) return;
            setRelationships(rels);
            await renderDiagram(s, rels, current);
        } catch (e) {
            if (!current()) return;
            setError('无法加载数据库结构');
            console.error("ER Load failed", e);
        } finally {
            if (current()) setLoading(false);
        }
    };

    const renderDiagram = async (schemas: any[], rels: any[], current: () => boolean) => {
        let graph = 'erDiagram\n';
        // Tables
        for (const s of schemas) {
            graph += `  ${s.table} {\n`;
            for (const c of s.columns) {
                const type = c.type.split('(')[0].toLowerCase();
                graph += `    ${type} ${c.name}\n`;
            }
            graph += `  }\n`;
        }
        // Relationships
        for (const r of rels) {
            // Check for plural match to avoid syntax errors in mermaid if names are complex
            // Mermaid names must be alphanumeric
            graph += `  ${r.fromTable} }|--|| ${r.toTable} : "FK: ${r.fromCol}"\n`;
        }

        if (schemas.length === 0) {
            setSvg('');
            return;
        }

        try {
            const { svg } = await mermaid.render('er-diagram-svg-' + Date.now(), graph);
            if (!current()) return;
            setSvg(svg);
        } catch (e) {
            if (!current()) return;
            console.error("Mermaid Render Error", e);
            setSvg(''); setError('无法渲染数据库关系图');
        }
    };

    const toggleTable = (table: string) => {
        const newSet = new Set(selectedTables);
        if (newSet.has(table)) newSet.delete(table);
        else newSet.add(table);
        setSelectedTables(newSet);
        generateSql(newSet);
    };

    const generateSql = (tables: Set<string>) => {
        if (tables.size < 1) {
            setGeneratedSql('');
            return;
        }
        const tableList = Array.from(tables);
        const startTable = tableList[0];
        let sql = `SELECT *\nFROM "${startTable}"\n`;

        const joined = new Set<string>([startTable]);
        const unjoined = new Set(tableList.slice(1));

        // Simple Greedy Join
        while (unjoined.size > 0) {
            let found = false;
            // Find any relationship connecting {Joined} to {Unjoined}
            for (const u of Array.from(unjoined)) {
                for (const j of Array.from(joined)) {
                    // Check j -> u or u -> j
                    const rel = relationships.find(r =>
                        (r.fromTable === j && r.toTable === u) ||
                        (r.fromTable === u && r.toTable === j)
                    );

                    if (rel) {
                        const onClause = rel.fromTable === j
                            ? `"${j}"."${rel.fromCol}" = "${u}"."${rel.toCol}"` // j has FK to u (PK)
                            : `"${j}"."${rel.toCol}" = "${u}"."${rel.fromCol}"`; // u has FK to j (PK)

                        sql += `JOIN "${u}" ON ${onClause}\n`;
                        joined.add(u);
                        unjoined.delete(u);
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }

            if (!found) {
                const remaining = Array.from(unjoined).join(', ');
                sql += `-- Warning: No inferred relationship found for: ${remaining}\n`;
                // Cross join remainder effectively
                for (const u of Array.from(unjoined)) {
                    sql += `-- CROSS JOIN "${u}"\n`;
                }
                break;
            }
        }

        setGeneratedSql(sql);
    };

    return (
        <div className="w-full h-full flex flex-row bg-monokai-surface overflow-hidden">
            {/* Sidebar: Query Builder */}
            <div className="w-80 border-r border-monokai-border p-4 flex flex-col bg-monokai-bg h-full overflow-y-auto">
                <h3 className="font-bold text-monokai-fg mb-4 flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-monokai-comment" /> Query Builder
                </h3>

                <div className="mb-6">
                    <label className="text-xs font-bold text-monokai-comment uppercase tracking-wider mb-2 block">Select Tables to Join</label>
                    <div className="space-y-1 bg-monokai-surface p-2 rounded-lg border border-monokai-border">
                        {schemas.map(s => (
                            <label key={s.table} className="flex items-center gap-2 p-2 rounded hover:bg-monokai-sidebar cursor-pointer text-sm">
                                <input
                                    type="checkbox"
                                    checked={selectedTables.has(s.table)}
                                    onChange={() => toggleTable(s.table)}
                                    className="rounded border-monokai-border text-monokai-accent focus:ring-monokai-blue"
                                />
                                <span className={selectedTables.has(s.table) ? "font-bold text-monokai-fg" : "text-monokai-fg"}>{s.table}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {generatedSql && (
                    <div className="flex-1 flex flex-col min-h-0">
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold text-monokai-comment">Generated SQL</label>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => navigator.clipboard.writeText(generatedSql)}
                                    className="p-1 hover:bg-monokai-sidebar rounded text-monokai-comment" title="Copy"
                                >
                                    <Copy size={12} />
                                </button>
                            </div>
                        </div>
                        <textarea
                            className="w-full h-40 p-2.5 text-xs font-mono border border-monokai-border rounded-lg bg-monokai-surface mb-2 custom-scrollbar resize-none focus:outline-none focus:border-monokai-accent transition-colors"
                            value={generatedSql}
                            readOnly
                        />
                        <button
                            onClick={() => onExecuteSql?.(generatedSql)}
                            className="w-full bg-monokai-accent text-monokai-on-accent py-2 rounded-lg text-xs font-bold hover:opacity-90 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                        >
                            <Play size={14} /> Run in Editor
                        </button>
                    </div>
                )}
            </div>

            {/* Diagram Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="p-4 border-b border-monokai-border flex justify-between items-center bg-monokai-surface shadow-sm z-10">
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold text-monokai-fg">Entity Relationship Diagram</h3>
                        <span className="text-xs text-monokai-comment font-mono hidden md:inline">({relationships.length} relationships detected)</span>
                    </div>
                    <button onClick={loadSchema} className="px-3 py-1 text-xs bg-monokai-sidebar rounded hover:bg-monokai-accent font-bold text-monokai-fg">Refresh</button>
                </div>
                <div className="flex-1 overflow-auto p-8 flex justify-center bg-monokai-bg items-center">
                    {loading ? (
                        <div className="animate-pulse flex flex-col items-center">
                            <div className="w-12 h-12 bg-monokai-sidebar rounded-full mb-4"></div>
                            <div className="h-4 w-32 bg-monokai-sidebar rounded"></div>
                        </div>
                    ) : error || !schemas.length ? <div className="p-4 text-monokai-comment">{error || '当前数据库暂无数据表'}</div> : (
                        <div
                            ref={containerRef}
                            className="max-w-full overflow-auto bg-monokai-surface shadow-sm p-4 rounded-xl border border-monokai-border"
                            dangerouslySetInnerHTML={{ __html: svg }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};
