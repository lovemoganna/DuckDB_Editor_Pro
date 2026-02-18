/**
 * ERDetector.ts
 * Detects ER relationships from column names and generates Mermaid diagrams
 * Part of AI Handbook Generation Architecture (Phase 8.1)
 */

import { ColumnSemanticInfo } from '../types';

// Use ColumnSemanticInfo as SemanticColumn for internal consistency
type SemanticColumn = ColumnSemanticInfo;

export interface ERColumn {
    name: string;
    type: 'PK' | 'FK' | 'ATTR';
    dataType: string;
    referencedTable?: string;
    referencedColumn?: string;
    nullable: boolean;
}

export interface ERRelationship {
    from: string;
    to: string;
    type: '1:1' | '1:N' | 'M:N';
    via?: string;        // For M:N bridge tables
    foreignKey: string;
}

export interface ERDiagram {
    mermaid: string;
    relationships: ERRelationship[];
    columns: ERColumn[];
}

// Common FK patterns
const FK_PATTERNS = [
    /^(.+)_id$/i,           // user_id, order_id
    /^(.+)Id$/,             // userId, orderId
    /^fk_(.+)$/i,           // fk_user, fk_order
    /^ref_(.+)$/i,          // ref_user
    /^(.+)_fk$/i,           // user_fk
];

// Common PK patterns
const PK_PATTERNS = [
    /^id$/i,
    /^pk$/i,
    /^uuid$/i,
    /^(.+)_pk$/i,
    /^primary_key$/i,
];

export class ERDetector {

    /**
     * Detect PK/FK columns based on naming patterns and semantic info
     */
    detectRelations(tableName: string, columns: SemanticColumn[]): ERColumn[] {
        return columns.map(col => {
            const erCol: ERColumn = {
                name: col.name,
                type: 'ATTR',
                dataType: this.mapSemanticToDataType(col),
                nullable: col.semanticType !== 'ID',
            };

            // Check for PK
            if (this.isPrimaryKey(col)) {
                erCol.type = 'PK';
                erCol.nullable = false;
                return erCol;
            }

            // Check for FK
            const fkMatch = this.detectForeignKey(col.name);
            if (fkMatch) {
                erCol.type = 'FK';
                erCol.referencedTable = fkMatch.table;
                erCol.referencedColumn = fkMatch.column;
                return erCol;
            }

            return erCol;
        });
    }

    /**
     * Check if column is a primary key
     */
    private isPrimaryKey(col: SemanticColumn): boolean {
        // Explicit PK flag from semantic analysis
        if (col.isPrimaryKey) return true;

        // Pattern matching
        const name = col.name.toLowerCase();
        return PK_PATTERNS.some(pattern => pattern.test(name));
    }

    /**
     * Detect foreign key and infer referenced table
     */
    private detectForeignKey(colName: string): { table: string; column: string } | null {
        for (const pattern of FK_PATTERNS) {
            const match = colName.match(pattern);
            if (match && match[1]) {
                const tableName = this.singularize(match[1]);
                return {
                    table: tableName,
                    column: 'id'
                };
            }
        }
        return null;
    }

    /**
     * Simple singularization (English)
     */
    private singularize(word: string): string {
        if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
        if (word.endsWith('es')) return word.slice(0, -2);
        if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
        return word;
    }

    /**
     * Map semantic type to SQL data type for display
     */
    private mapSemanticToDataType(col: SemanticColumn): string {
        switch (col.semanticType) {
            case 'ID': return 'INTEGER';
            case 'DIM': return 'VARCHAR';
            case 'MEA': return 'DECIMAL';
            case 'TIME': return 'DATE';
            case 'CURR': return 'DECIMAL(10,2)';
            case 'ATTR': return 'VARCHAR';
            case 'RATIO': return 'DECIMAL';
            default: return 'VARCHAR';
        }
    }

    /**
     * Generate Mermaid ER diagram
     */
    generateMermaidER(tableName: string, erColumns: ERColumn[]): ERDiagram {
        const relationships: ERRelationship[] = [];
        const fkColumns = erColumns.filter(c => c.type === 'FK');

        // Build relationships from FK columns
        for (const fk of fkColumns) {
            if (fk.referencedTable) {
                relationships.push({
                    from: tableName,
                    to: fk.referencedTable,
                    type: '1:N', // Default assumption: FK points to parent (1:N)
                    foreignKey: fk.name
                });
            }
        }

        // Generate Mermaid syntax
        const mermaid = this.buildMermaidSyntax(tableName, erColumns, relationships);

        return {
            mermaid,
            relationships,
            columns: erColumns
        };
    }

    /**
     * Build Mermaid erDiagram syntax
     */
    private buildMermaidSyntax(
        tableName: string,
        columns: ERColumn[],
        relationships: ERRelationship[]
    ): string {
        const lines: string[] = ['```mermaid', 'erDiagram'];

        // Add relationships
        for (const rel of relationships) {
            const relSymbol = rel.type === '1:1' ? '||--||' :
                rel.type === '1:N' ? '||--o{' :
                    '}o--o{';
            lines.push(`    ${rel.to} ${relSymbol} ${tableName} : "${rel.foreignKey}"`);
        }

        // Add main table entity
        lines.push('');
        lines.push(`    ${tableName} {`);
        for (const col of columns) {
            const pkMarker = col.type === 'PK' ? ' PK' : col.type === 'FK' ? ' FK' : '';
            const nullable = col.nullable ? '' : ' "NOT NULL"';
            lines.push(`        ${col.dataType} ${col.name}${pkMarker}${nullable}`);
        }
        lines.push('    }');

        // Add referenced tables (simplified)
        const referencedTables = new Set(relationships.map(r => r.to));
        for (const refTable of referencedTables) {
            lines.push(`    ${refTable} {`);
            lines.push(`        INTEGER id PK`);
            lines.push(`        VARCHAR name`);
            lines.push('    }');
        }

        lines.push('```');
        return lines.join('\n');
    }

    /**
     * Generate seed INSERT statements from sample data
     */
    generateSeedInserts(tableName: string, columns: ERColumn[], sampleRows: any[]): string {
        if (!sampleRows || sampleRows.length === 0) {
            return `-- No sample data available for ${tableName}`;
        }

        const colNames = columns.map(c => c.name).join(', ');
        const lines: string[] = [
            `-- ═══ ${tableName} (${sampleRows.length} 行) ═══`,
            `INSERT INTO "${tableName}" (${colNames}) VALUES`
        ];

        const valueLines = sampleRows.slice(0, 5).map((row, idx) => {
            const values = columns.map(col => {
                const val = row[col.name];
                if (val === null || val === undefined) return 'NULL';
                if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
                if (typeof val === 'number') return val.toString();
                if (val instanceof Date) return `'${val.toISOString().split('T')[0]}'`;
                return `'${String(val)}'`;
            }).join(', ');

            const isLast = idx === Math.min(4, sampleRows.length - 1);
            return `    (${values})${isLast ? ';' : ','}`;
        });

        lines.push(...valueLines);
        return lines.join('\n');
    }
}

// Singleton export
export const erDetector = new ERDetector();
