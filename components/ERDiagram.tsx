import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { duckDBService } from '../services/duckdbService';
import { Copy, Play } from 'lucide-react';

interface ERDiagramProps {
    onExecuteSql?: (sql: string) => void;
}

export const ERDiagram: React.FC<ERDiagramProps> = ({ onExecuteSql }) => {
    const [svg, setSvg] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [schemas, setSchemas] = useState<any[]>([]);
    const [relationships, setRelationships] = useState<any[]>([]);
    const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
    const [generatedSql, setGeneratedSql] = useState<string>('');

    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose' });
        loadSchema();
    }, []);

    const loadSchema = async () => {
        setLoading(true);
        try {
            const s = await duckDBService.getAllTablesSchema();
            setSchemas(s);
            const rels = await duckDBService.inferRelationships(s);
            setRelationships(rels);
            renderDiagram(s, rels);
        } catch (e) {
            console.error("ER Load failed", e);
        } finally {
            setLoading(false);
        }
    };

    const renderDiagram = async (schemas: any[], rels: any[]) => {
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
            setSvg('<div class="text-center p-4">No tables found</div>');
            return;
        }

        try {
            const { svg } = await mermaid.render('er-diagram-svg-' + Date.now(), graph);
            setSvg(svg);
        } catch (e) {
            console.error("Mermaid Render Error", e);
            setSvg('<div class="text-red-500">Failed to render diagram</div>');
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
        <div className="w-full h-full flex flex-row bg-white overflow-hidden">
            {/* Sidebar: Query Builder */}
            <div className="w-80 border-r border-gray-200 p-4 flex flex-col bg-gray-50 h-full overflow-y-auto">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span>🛠️</span> Query Builder
                </h3>

                <div className="mb-6">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Select Tables to Join</label>
                    <div className="space-y-1 bg-white p-2 rounded border border-gray-200">
                        {schemas.map(s => (
                            <label key={s.table} className="flex items-center gap-2 p-2 rounded hover:bg-gray-100 cursor-pointer text-sm">
                                <input
                                    type="checkbox"
                                    checked={selectedTables.has(s.table)}
                                    onChange={() => toggleTable(s.table)}
                                    className="rounded border-gray-300 text-black focus:ring-black"
                                />
                                <span className={selectedTables.has(s.table) ? "font-bold text-black" : "text-gray-600"}>{s.table}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {generatedSql && (
                    <div className="flex-1 flex flex-col min-h-0">
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold text-gray-500">Generated SQL</label>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => navigator.clipboard.writeText(generatedSql)}
                                    className="p-1 hover:bg-gray-200 rounded text-gray-500" title="Copy"
                                >
                                    <Copy size={12} />
                                </button>
                            </div>
                        </div>
                        <textarea
                            className="w-full h-40 p-2 text-xs font-mono border border-gray-300 rounded bg-white mb-2 custom-scrollbar resize-none focus:outline-none focus:border-black"
                            value={generatedSql}
                            readOnly
                        />
                        <button
                            onClick={() => onExecuteSql?.(generatedSql)}
                            className="w-full bg-black text-white py-2 rounded-lg text-sm font-bold hover:bg-gray-800 flex items-center justify-center gap-2 transition-colors"
                        >
                            <Play size={14} /> Run in Editor
                        </button>
                    </div>
                )}
            </div>

            {/* Diagram Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white shadow-sm z-10">
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-700">Entity Relationship Diagram</h3>
                        <span className="text-xs text-gray-400 font-mono hidden md:inline">({relationships.length} relationships detected)</span>
                    </div>
                    <button onClick={loadSchema} className="px-3 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200 font-bold text-gray-600">Refresh</button>
                </div>
                <div className="flex-1 overflow-auto p-8 flex justify-center bg-gray-50 items-center">
                    {loading ? (
                        <div className="animate-pulse flex flex-col items-center">
                            <div className="w-12 h-12 bg-gray-300 rounded-full mb-4"></div>
                            <div className="h-4 w-32 bg-gray-300 rounded"></div>
                        </div>
                    ) : (
                        <div
                            ref={containerRef}
                            className="max-w-full overflow-auto bg-white shadow-sm p-4 rounded-xl border border-gray-100"
                            dangerouslySetInnerHTML={{ __html: svg }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};
