import { duckDBService } from './duckdbService';
import { ColumnSemanticInfo } from '../types';

export interface GeneratedFeature {
    name: string;
    expression: string;
    type: 'RATIO' | 'LAG' | 'MOVING_AVG' | 'INTERACTION';
    description: string;
    sql: string;
}

export class FeatureEngineeringService {

    /**
     * Generates Ratio features for pairs of metrics (MEA/CURR).
     * E.g., Revenue / UserCount = ARPU
     * Heuristic: Only generate if they are positively correlated? Or just generate all pairs for small N?
     * For M2 MVP: Generate pairwise ratios for top 5 metrics.
     */
    generateRatioFeatures(metrics: string[]): GeneratedFeature[] {
        const features: GeneratedFeature[] = [];

        // Limit to O(N^2) complexity, max 5 metrics => 25 pairs
        const topMetrics = metrics.slice(0, 5);

        for (let i = 0; i < topMetrics.length; i++) {
            for (let j = 0; j < topMetrics.length; j++) {
                if (i === j) continue;

                const num = topMetrics[i];
                const den = topMetrics[j];
                const name = `${num}_per_${den}`;

                features.push({
                    name: name,
                    expression: `${num} / ${den}`,
                    type: 'RATIO',
                    description: `Ratio of ${num} to ${den}`,
                    sql: `CASE WHEN "${den}" = 0 OR "${den}" IS NULL THEN NULL ELSE "${num}" / "${den}" END as "${name}"`
                });
            }
        }
        return features;
    }

    /**
     * Generates Time-Series features (Lags, Moving Avg) for a metric.
     * Requires a Time Column to be present.
     */
    generateTimeFeatures(metric: string, timeCol: string): GeneratedFeature[] {
        const features: GeneratedFeature[] = [];

        // 1. Lag Features (Previous Period)
        features.push({
            name: `${metric}_lag1`,
            expression: `LAG(${metric})`,
            type: 'LAG',
            description: `Previous period value of ${metric}`,
            sql: `LAG("${metric}", 1) OVER (ORDER BY "${timeCol}") as "${metric}_lag1"`
        });

        // 2. Year-over-Year Lag (assuming monthly data? Hard without knowing granularity)
        // Let's stick to simple Lag-1 for now.

        // 3. Moving Average (3-period)
        features.push({
            name: `${metric}_ma3`,
            expression: `AVG(${metric}) 3-period`,
            type: 'MOVING_AVG',
            description: `3-period Moving Average of ${metric}`,
            sql: `AVG("${metric}") OVER (ORDER BY "${timeCol}" ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) as "${metric}_ma3"`
        });

        return features;
    }

    /**
     * Main entry point to suggest features for a dataset
     */
    suggestFeatures(semanticCols: ColumnSemanticInfo[]): GeneratedFeature[] {
        const metrics = semanticCols
            .filter(c => c.semanticType === 'MEA' || c.semanticType === 'CURR')
            .map(c => c.name);

        const timeCol = semanticCols.find(c => c.semanticType === 'TIME');

        let features: GeneratedFeature[] = [];

        // 1. Ratio Features
        features = features.concat(this.generateRatioFeatures(metrics));

        // 2. Time Series Features (if Time Col exists)
        if (timeCol) {
            // Generate for top 3 metrics to save compute/space
            metrics.slice(0, 3).forEach(m => {
                features = features.concat(this.generateTimeFeatures(m, timeCol.name));
            });
        }

        return features;
    }
}

export const featureEngineeringService = new FeatureEngineeringService();
