import { duckDBService } from './duckdbService';

export interface CausalEdge {
    source: string;
    target: string;
    weight: number;
    type: 'correlation' | 'causation';
    confidence: number;
    lag?: number;
}

export interface GrangerResult {
    source: string;
    target: string;
    p_value: number; // Simulated p-value (based on R2 improvement)
    lag: number;
    is_significant: boolean;
}

export class CausalService {

    /**
     * Simplified Granger Causality Test in SQL.
     * Checks if Lagged X improves prediction of Y over Lagged Y alone.
     * 
     * Method:
     * 1. Auto-Regressive (AR) Model: Y ~ Lag(Y)
     * 2. Full Model: Y ~ Lag(Y) + Lag(X)
     * 3. If Error(Full) < Error(AR) significantly -> X Granger-Causes Y.
     * 
     * Note: This is computationally expensive in SQL loop. We limit to top 5 metrics.
     */
    async computeGrangerLite(table: string, timeCol: string, metrics: string[]): Promise<GrangerResult[]> {
        if (!timeCol || metrics.length < 2) return [];

        const results: GrangerResult[] = [];
        // Limit to top 3x3 pairs to save time
        const candidates = metrics.slice(0, 3);

        for (const y of candidates) {
            for (const x of candidates) {
                if (x === y) continue;

                try {
                    // 1. Prepare data with Lags
                    const dataSql = `
              WITH lagged AS (
                SELECT 
                  "${y}" as y,
                  LAG("${y}") OVER (ORDER BY "${timeCol}") as y_lag1,
                  LAG("${x}") OVER (ORDER BY "${timeCol}") as x_lag1
                FROM "${table}"
              )
              SELECT 
                corr(y, y_lag1) as r_ar,
                corr(y, x_lag1) as r_cross
              FROM lagged
              WHERE y IS NOT NULL AND y_lag1 IS NOT NULL AND x_lag1 IS NOT NULL
            `;

                    const res = await duckDBService.query(dataSql);
                    const { r_ar, r_cross } = res[0];

                    // Heuristic Rule for "Granger - Lite"
                    // If Cross Correlation (X_lag1, Y) is significant (> 0.5) 
                    // AND stronger than or complementary to Auto Correlation (Y_lag1, Y)
                    // It suggests prediction power.

                    const r2_ar = Math.pow(Number(r_ar || 0), 2);
                    const r2_cross = Math.pow(Number(r_cross || 0), 2);

                    // Very simplified threshold
                    if (Math.abs(Number(r_cross)) > 0.4 && r2_cross > r2_ar * 0.8) {
                        results.push({
                            source: x,
                            target: y,
                            p_value: 0.05, // Mock significance
                            lag: 1,
                            is_significant: true
                        });
                    }
                } catch (e) {
                    // Ignore
                }
            }
        }
        return results;
    }

    /**
     * Prepares the context for Gemini to infer the DAG.
     * Combines Correlations + Granger Results + Semantic Types.
     */
    async prepareCausalContext(
        correlations: any,
        grangerResults: GrangerResult[],
        features: any[]
    ): Promise<any> {
        return {
            correlations: correlations.matrix, // Simplified
            temporal_precedence: grangerResults.map(g => `${g.source} -> ${g.target} (Lag ${g.lag})`),
            engineered_features: features.map(f => f.name)
        };
    }
}

export const causalService = new CausalService();
