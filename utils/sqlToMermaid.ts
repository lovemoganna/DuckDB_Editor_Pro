export const generateMermaidFromOps = (tableName: string, operations: any[] = []): string => {
    let mermaid = 'classDiagram\n';
    mermaid += `    direction LR\n`;

    // 1. Base Table (Staging)
    // We don't have its DDL here easily unless we infer from Stats. 
    // Let's rely on Generated SQLs mainly. But we should show the Source Table.
    mermaid += `    class ${tableName} {\n        <<Source>>\n        Raw Data\n    }\n`;

    const tables: string[] = [tableName];

    operations.forEach(op => {
        const sql = op.sql.toUpperCase();

        // Match CREATE TABLE
        const tableMatch = /CREATE\s+TABLE\s+["']?(\w+)["']?/i.exec(sql);
        if (tableMatch) {
            const newTable = tableMatch[1];
            tables.push(newTable);
            mermaid += `    class ${newTable} {\n        <<Table>>\n`;

            // Try to extract columns roughly
            // Look for content inside parens (...)
            const contentMatch = /\(([\s\S]*)\)/.exec(op.sql);
            if (contentMatch) {
                const lines = contentMatch[1].split(',');
                lines.slice(0, 8).forEach(line => { // Limit to 8 col to avoid bloat
                    const clean = line.trim().replace(/['"`]/g, '').split(/\s+/);
                    if (clean.length >= 2) {
                        mermaid += `        ${clean[1]} ${clean[0]}\n`;
                    }
                });
                if (lines.length > 8) mermaid += `        ...\n`;
            }
            mermaid += `    }\n`;

            // Assume derivation relation
            mermaid += `    ${tableName} ..> ${newTable} : Cleans\n`;
        }

        // Match CREATE VIEW
        const viewMatch = /CREATE\s+VIEW\s+["']?(\w+)["']?/i.exec(sql);
        if (viewMatch) {
            const viewName = viewMatch[1];
            mermaid += `    class ${viewName} {\n        <<View>>\n        ${op.title}\n    }\n`;

            // Find which table it selects from
            const fromMatch = /FROM\s+["']?(\w+)["']?/i.exec(sql);
            if (fromMatch) {
                const source = fromMatch[1];
                if (tables.includes(source) || source === tableName) {
                    mermaid += `    ${source} --> ${viewName} : Aggregates\n`;
                }
            } else {
                mermaid += `    ${tableName} --> ${viewName} : Derived\n`;
            }
        }
    });

    return mermaid;
};
