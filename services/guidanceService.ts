import { AnalysisSummary } from '../types';
import { AnalysisLayerResult, AnomalyResult, DriverAnalysis } from '../types';

export interface RecommendedAction {
    type: 'DRILL_DOWN' | 'EXPLAIN' | 'MONITOR' | 'QUALITY_FIX';
    title: string;
    description: string;
    sql?: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export class GuidanceService {

    generateActions(result: AnalysisLayerResult, tableName: string): RecommendedAction[] {
        const actions: RecommendedAction[] = [];

        // 1. Quality Issues -> QUALITY_FIX
        if (result.qualityReport && result.qualityReport.issues.length > 0) {
            result.qualityReport.issues
                .filter(issue => issue.severity === 'error')
                .forEach(issue => {
                    actions.push({
                        type: 'QUALITY_FIX',
                        title: `Fix Data Quality: ${issue.column}`,
                        description: `${issue.type} detected. ${issue.suggestion}`,
                        priority: 'HIGH'
                    });
                });
        }

        // 2. Anomalies -> DRILL_DOWN
        if (result.anomalies && result.anomalies.length > 0) {
            result.anomalies.forEach(anomaly => {
                // Find dimensions to drill down into? 
                // Heuristic: If we have dimensions, suggest grouping by the first one.
                const dim = result.semanticColumns.find(c => c.semanticType === 'DIM');

                let sql = anomaly.sql;
                if (dim) {
                    sql = `SELECT "${dim.name}", COUNT(*) as count FROM (${anomaly.sql}) GROUP BY "${dim.name}" ORDER BY count DESC`;
                }

                actions.push({
                    type: 'DRILL_DOWN',
                    title: `Investigate Anomaly in ${anomaly.column}`,
                    description: `Found ${anomaly.anomalies_count} anomalies (${(anomaly.ratio * 100).toFixed(1)}%). Breakdown by ${dim ? dim.name : 'dimensions'}.`,
                    sql: sql,
                    priority: 'HIGH'
                });
            });
        }

        // 3. Strong Drivers -> EXPLAIN/MONITOR
        if (result.drivers && result.drivers.length > 0) {
            result.drivers.forEach(driver => {
                const topFactor = driver.drivers[0];
                if (topFactor) {
                    actions.push({
                        type: 'EXPLAIN',
                        title: `Analyze Driver: ${driver.metric}`,
                        description: `${topFactor.value} is the primary driver. Investigate its impact over time.`,
                        sql: `SELECT "${topFactor.value}", AVG("${driver.metric}") FROM "${tableName}" GROUP BY 1 ORDER BY 2 DESC`,
                        priority: 'MEDIUM'
                    });
                }
            });
        }

        // 4. Causal Links -> MONITOR (Future: Issue-017 LLM will enhance this)
        if (result.causalGraph && result.causalGraph.edges.length > 0) {
            // Filter for high confidence causal links
            result.causalGraph.edges
                .filter(e => e.label === 'Direct Cause' && e.confidence > 0.7)
                .forEach(e => {
                    actions.push({
                        type: 'MONITOR',
                        title: `Monitor Causal Link: ${e.from} -> ${e.to}`,
                        description: `Strong causal effect detected. Changes in ${e.from} will likely impact ${e.to}.`,
                        priority: 'MEDIUM'
                    });
                });
        }

        return actions.sort((a, b) => {
            const p = { HIGH: 3, MEDIUM: 2, LOW: 1 };
            return p[b.priority] - p[a.priority];
        });
    }
}

export const guidanceService = new GuidanceService();
