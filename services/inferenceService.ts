import { EnrichedColumnStats, SemanticType, ColumnSemanticInfo } from '../types';

export class InferenceService {

    // Issue-002: Field Name Semantic Matching (Dictionary MVP)
    private normalizeFieldName(name: string): string {
        const n = name.toLowerCase().replace(/[^a-z0-9]/g, '');

        const map: Record<string, string[]> = {
            'AMOUNT': ['amt', 'price', 'cost', 'revenue', 'total', 'sales', 'money', 'val'],
            'USER': ['user', 'customer', 'cust', 'client', 'member', 'uid'],
            'DATE': ['date', 'time', 'ts', 'year', 'month', 'day', 'dt', 'created'],
            'STATUS': ['status', 'state', 'type', 'category', 'flag'],
            'LOCATION': ['city', 'province', 'country', 'region', 'area', 'addr', 'loc'],
            'EMAIL': ['email', 'mail'],
            'PHONE': ['phone', 'tel', 'mobile']
        };

        for (const [key, aliases] of Object.entries(map)) {
            if (key.toLowerCase() === n || aliases.some(a => n.includes(a))) {
                return key;
            }
        }
        return 'UNKNOWN';
    }

    /**
     * Main inference entry point.
     * Determines the semantic type based on statistical profile.
     */
    public inferSemanticType(stats: EnrichedColumnStats, colType: string, colName: string): ColumnSemanticInfo {
        const semanticTag = this.normalizeFieldName(colName);

        const info: ColumnSemanticInfo = {
            name: stats.name || colName,
            physicalType: colType,
            semanticType: 'ATTR', // Default
            confidence: 0.5
        };
        const typeUpper = colType.toUpperCase();
        const nameLower = colName.toLowerCase();

        // 1. ID Detection
        // High cardinality (>90%), Uniform distribution (Entropy high), or specific naming
        const isIdNaming = nameLower.endsWith('id') || nameLower.endsWith('key') || nameLower === 'code';
        const uniqueRatio = stats.total_count > 0 ? stats.distinct_count / stats.total_count : 0;

        if (uniqueRatio > 0.99 || (uniqueRatio > 0.8 && isIdNaming)) {
            info.semanticType = 'ID';
            info.confidence = 0.9;
            return info;
        }

        // 2. Time Detection
        if (typeUpper.includes('DATE') || typeUpper.includes('TIME') || typeUpper.includes('TIMESTAMP')) {
            info.semanticType = 'TIME';
            info.confidence = 1.0;
            return info;
        }
        // Implicit time (e.g. "year", "month" integer columns)
        if (['year', 'month', 'day', 'quarter', 'week'].includes(nameLower)) {
            info.semanticType = 'TIME';
            info.confidence = 0.8;
            return info;
        }

        // 3. Metric (MEA) vs Dimension (DIM)
        // Numeric columns are MEA unless they are low cardinality (DIM)
        const isNumeric = typeUpper.includes('INT') || typeUpper.includes('DOUBLE') || typeUpper.includes('DECIMAL') || typeUpper.includes('FLOAT');

        if (isNumeric) {
            // Logic: If low cardinality (e.g. < 50 unique vals OR ratio < 5%), treat as DIM (e.g. Status Code, Quarter)
            // Exception: If implicit time (year), handled above.

            const isLowCardinality = stats.distinct_count < 50 || uniqueRatio < 0.05;

            if (isLowCardinality) {
                info.semanticType = 'DIM';
                info.confidence = 0.7; // It's a numeric dimension (e.g. Status=1,2,3)
            } else {
                // High cardinality numeric -> Likely a Metric
                if (nameLower.includes('price') || nameLower.includes('amount') || nameLower.includes('cost') || nameLower.includes('revenue')) {
                    info.semanticType = 'CURR';
                    info.confidence = 0.9;
                } else if (nameLower.includes('rate') || nameLower.includes('ratio') || nameLower.includes('percent')) {
                    info.semanticType = 'RATIO';
                    info.confidence = 0.9;
                } else {
                    info.semanticType = 'MEA';
                    info.confidence = 0.8;
                }
            }
            return info;
        }

        // 4. String types -> DIM or Text
        // High cardinality string -> ATTR (Description, Comment)
        // Low cardinality string -> DIM (Category, City)
        if (!isNumeric) {
            if (stats.distinct_count < 1000 && uniqueRatio < 0.2) {
                info.semanticType = 'DIM';
                info.confidence = 0.85;
            } else {
                info.semanticType = 'ATTR'; // Free text
                info.confidence = 0.8;
            }
        }

        return info;
    }

    /**
     * Batch inference for full schema
     */
    public inferSchema(enrichedStats: any[]): ColumnSemanticInfo[] {
        return enrichedStats.map(stat => this.inferSemanticType(stat, stat.type, stat.name));
    }
}

export const inferenceService = new InferenceService();
