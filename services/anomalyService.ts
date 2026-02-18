import { duckDBService } from './duckdbService';

export interface AnomalyResult {
    column: string;
    strategy: 'IQR' | 'Z-Score';
    anomalies_count: number;
    total_count: number;
    ratio: number;
    bounds: { lower: number, upper: number };
    sample_values: any[];
    sql: string; // SQL to retrieve these anomalies
}

export class AnomalyService {

    /**
     * Detect anomalies using IQR (Interquartile Range) method.
     * Best for non-normal distributions.
     * Bounds: [Q1 - 1.5*IQR, Q3 + 1.5*IQR]
     */
    async detectIQR(table: string, col: string): Promise<AnomalyResult | null> {
        try {
            // 1. Calculate Quartiles
            const statsSql = `
        SELECT 
          quantile_cont("${col}", 0.25) as q1,
          quantile_cont("${col}", 0.75) as q3,
          COUNT(*) as total
        FROM "${table}"
        WHERE "${col}" IS NOT NULL
      `;
            const stats = await duckDBService.query(statsSql);
            const { q1, q3, total } = stats[0];

            const iqr = q3 - q1;
            const lower = q1 - 1.5 * iqr;
            const upper = q3 + 1.5 * iqr;

            // 2. Count Anomalies
            const countSql = `
        SELECT COUNT(*) as count 
        FROM "${table}" 
        WHERE "${col}" < ${lower} OR "${col}" > ${upper}
      `;
            const countRes = await duckDBService.query(countSql);
            const count = Number(countRes[0].count);

            if (count === 0) return null;

            // 3. Get Samples
            const sampleSql = `
        SELECT "${col}" as val 
        FROM "${table}" 
        WHERE "${col}" < ${lower} OR "${col}" > ${upper} 
        LIMIT 5
      `;
            const samples = await duckDBService.query(sampleSql);

            return {
                column: col,
                strategy: 'IQR',
                anomalies_count: count,
                total_count: Number(total),
                ratio: count / Number(total),
                bounds: { lower, upper },
                sample_values: samples.map(r => r.val),
                sql: `SELECT * FROM "${table}" WHERE "${col}" < ${lower} OR "${col}" > ${upper}`
            };

        } catch (e) {
            console.error(`[AnomalyService] IQR Check failed for ${col}`, e);
            return null;
        }
    }

    /**
     * Detect anomalies using Z-Score method.
     * Best for roughly normal distributions.
     * Threshold: > 3 stddev
     */
    async detectZScore(table: string, col: string): Promise<AnomalyResult | null> {
        try {
            // 1. Calculate Mean/StdDev
            const statsSql = `
        SELECT 
          AVG("${col}") as mean,
          STDDEV("${col}") as std,
          COUNT(*) as total
        FROM "${table}"
        WHERE "${col}" IS NOT NULL
      `;
            const stats = await duckDBService.query(statsSql);
            const { mean, std, total } = stats[0];

            if (!std || std === 0) return null;

            const lower = mean - 3 * std;
            const upper = mean + 3 * std;

            // 2. Count
            const countSql = `
        SELECT COUNT(*) as count 
        FROM "${table}" 
        WHERE "${col}" < ${lower} OR "${col}" > ${upper}
      `;
            const countRes = await duckDBService.query(countSql);
            const count = Number(countRes[0].count);

            if (count === 0) return null;

            // 3. Get Samples
            const sampleSql = `
        SELECT "${col}" as val 
        FROM "${table}" 
        WHERE "${col}" < ${lower} OR "${col}" > ${upper} 
        LIMIT 5
      `;
            const samples = await duckDBService.query(sampleSql);

            return {
                column: col,
                strategy: 'Z-Score',
                anomalies_count: count,
                total_count: Number(total),
                ratio: count / Number(total),
                bounds: { lower, upper },
                sample_values: samples.map(r => r.val),
                sql: `SELECT * FROM "${table}" WHERE "${col}" < ${lower} OR "${col}" > ${upper}`
            };

        } catch (e) {
            console.error(`[AnomalyService] Z-Score Check failed for ${col}`, e);
            return null;
        }
    }

    /**
     * Run full anomaly scan on a list of numeric columns
     */
    async scanAnomalies(table: string, columns: string[]): Promise<AnomalyResult[]> {
        const results: AnomalyResult[] = [];

        for (const col of columns) {
            // Try IQR first (more robust)
            let res = await this.detectIQR(table, col);

            // If no IQR anomalies (or very few), maybe check Z-Score? 
            // Actually IQR is usually wider. If IQR finds nothing, Z-Score (3-sigma) might also find nothing unless distribution is weird.
            // Let's stick to IQR as primary for now to avoid noise.

            if (res && res.ratio > 0 && res.ratio < 0.2) {
                // Only report if anomalies are rare (<20%), otherwise it's just a spread distribution
                results.push(res);
            }
        }
        return results;
    }
}

export const anomalyService = new AnomalyService();
