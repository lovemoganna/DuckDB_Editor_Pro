import type { ChartConfig, MetricDefinition, MetricPackage } from '../types';
import { duckDBService } from './duckdbService';
import { metricAnalyzer } from './metricAnalyzer';
import { quoteTable } from './analysis/sqlUtils';
import { automaticDismissals } from './metricAssetStorage';
import { extractTablesFromSql } from './queryVizHint';

export interface ExecutiveMetric extends MetricDefinition { presentation: ChartConfig; }
export function executiveMetricPackage(database: string, schema = 'main'): Omit<MetricPackage, 'metrics'> & { metrics: ExecutiveMetric[] } {
  const prefix = `executive:${database}:${schema}`;
  const table = (name: string) => quoteTable(`${database}.${schema}.${name}`);
  const fiat = table('fiat_transactions'), crypto = table('crypto_transactions'), users = table('users'), rates = table('exchange_rates');
  const flows = `SELECT 'fiat' AS family, currency AS unit, direction, amount, channel AS channel, status, created_at FROM ${fiat}
    UNION ALL SELECT 'crypto', asset, direction, amount, network, status, created_at FROM ${crypto}`;
  const definitions: Array<[string, string, string, string, string, string, string[], string]> = [
    ['usd-gmv', 'USD 完成交易总额', 'USD', `SELECT CAST(COALESCE(SUM(amount),0) AS DOUBLE) AS value FROM ${fiat} WHERE status='completed' AND currency='USD'`, 'counter', '', ['value'], '完成入金与出金金额之和，仅 USD，不扣手续费'],
    ['usdt-gmv', 'USDT 完成交易总额', 'USDT', `SELECT CAST(COALESCE(SUM(amount),0) AS DOUBLE) AS value FROM ${crypto} WHERE status='completed' AND asset='USDT'`, 'counter', '', ['value'], '完成入金与出金数量之和，仅 USDT，不换算其他资产'],
    ['success', '交易完成率', '%', `WITH tx AS (${flows}) SELECT CAST(100.0 * COUNT(*) FILTER (WHERE status='completed') / NULLIF(COUNT(*),0) AS DOUBLE) AS value, COUNT(*) FILTER (WHERE status='completed') AS completed, COUNT(*) AS total FROM tx`, 'counter', '', ['value'], '法币与加密交易的 completed 订单数 / 全部订单数；空数据无完成率'],
    ['usd-net', 'USD 净流入', 'USD', `SELECT CAST(COALESCE(SUM(CASE direction WHEN 'deposit' THEN amount WHEN 'withdrawal' THEN -amount ELSE 0 END),0) AS DOUBLE) AS value FROM ${fiat} WHERE status='completed' AND currency='USD'`, 'counter', '', ['value'], '已完成 USD 入金减出金，不扣手续费，非账户余额'],
    ['liquidity', '分资产资金流动', '', `WITH tx AS (${flows}) SELECT family, unit, CAST(SUM(CASE WHEN direction='deposit' THEN amount ELSE 0 END) AS DOUBLE) AS deposits, CAST(SUM(CASE WHEN direction='withdrawal' THEN amount ELSE 0 END) AS DOUBLE) AS withdrawals, CAST(SUM(CASE WHEN direction='deposit' THEN amount WHEN direction='withdrawal' THEN -amount ELSE 0 END) AS DOUBLE) AS net FROM tx WHERE status='completed' GROUP BY family,unit ORDER BY family,unit`, 'table', 'unit', ['deposits','withdrawals','net'], '按资产分别统计已完成订单；不同单位不相加'],
    ['monthly', '月度流入与流出', '', `WITH tx AS (${flows}) SELECT strftime(created_at,'%Y-%m') AS month, family, unit, CAST(SUM(CASE WHEN direction='deposit' THEN amount ELSE 0 END) AS DOUBLE) AS deposits, CAST(SUM(CASE WHEN direction='withdrawal' THEN amount ELSE 0 END) AS DOUBLE) AS withdrawals FROM tx WHERE status='completed' GROUP BY month,family,unit ORDER BY month,family,unit`, 'table', 'month', ['deposits','withdrawals'], '按订单创建月份、资产分别统计已完成交易；使用实际数据月份'],
    ['usd-monthly', 'USD 月度资金趋势', 'USD', `WITH bounds AS (SELECT date_trunc('month',MIN(created_at)) AS first_month,date_trunc('month',MAX(created_at)) AS last_month FROM ${fiat} WHERE currency='USD'), months AS (SELECT month FROM bounds,LATERAL generate_series(first_month,last_month,INTERVAL '1 month') AS m(month)), monthly AS (SELECT date_trunc('month',created_at) AS month,SUM(CASE WHEN direction='deposit' THEN amount ELSE 0 END) AS deposits,SUM(CASE WHEN direction='withdrawal' THEN amount ELSE 0 END) AS withdrawals FROM ${fiat} WHERE currency='USD' AND status='completed' GROUP BY 1) SELECT strftime(m.month,'%Y-%m') AS month,COALESCE(t.deposits,0) AS deposits,COALESCE(t.withdrawals,0) AS withdrawals,COALESCE(t.deposits,0)-COALESCE(t.withdrawals,0) AS net FROM months m LEFT JOIN monthly t USING(month) ORDER BY m.month`, 'line', 'month', ['deposits','withdrawals','net'], '只统计已完成 USD；以实际 USD 订单创建日期范围补齐无交易月份，净流入为入金减出金'],
    ['networks', 'USDT 公链流动', 'USDT', `SELECT network, CAST(SUM(CASE WHEN direction='deposit' THEN amount ELSE 0 END) AS DOUBLE) AS deposits, CAST(SUM(CASE WHEN direction='withdrawal' THEN amount ELSE 0 END) AS DOUBLE) AS withdrawals FROM ${crypto} WHERE status='completed' AND asset='USDT' GROUP BY network ORDER BY network`, 'bar', 'network', ['deposits','withdrawals'], '仅已完成 USDT 订单，按公链对比入金和出金'],
    ['channels', '渠道完成情况', '%', `WITH tx AS (${flows}) SELECT family,unit,channel,COUNT(*) AS orders,COUNT(*) FILTER(WHERE status='completed') AS completed,ROUND(100.0*COUNT(*) FILTER(WHERE status='completed')/NULLIF(COUNT(*),0),2) AS success_pct FROM tx GROUP BY family,unit,channel ORDER BY orders DESC,unit,channel`, 'table', 'channel', ['success_pct'], '渠道订单数和完成率，按资产分别统计'],
    ['exceptions', '未完成交易追踪', '', `SELECT 'fiat' AS family,fiat_order_id AS order_id,uid,currency AS unit,CAST(amount AS DOUBLE) AS amount,status,CAST(created_at AS VARCHAR) AS created_at FROM ${fiat} WHERE status<>'completed' UNION ALL SELECT 'crypto',crypto_order_id,uid,asset,CAST(amount AS DOUBLE),status,CAST(created_at AS VARCHAR) FROM ${crypto} WHERE status<>'completed' ORDER BY created_at DESC`, 'table', 'order_id', ['amount'], '仅展示原始状态与金额，未完成不等于失败，不推断故障原因'],
    ['quality', '业务规则待核对', '', `SELECT '非完成订单带完成时间' AS issue,'fiat_transactions' AS source_table,fiat_order_id AS record_id FROM ${fiat} WHERE status<>'completed' AND completed_at IS NOT NULL UNION ALL SELECT '非完成订单带完成时间','crypto_transactions',crypto_order_id FROM ${crypto} WHERE status<>'completed' AND completed_at IS NOT NULL UNION ALL SELECT '当前冻结用户关联已完成出金，需核对历史状态','fiat_transactions',t.fiat_order_id FROM ${fiat} t JOIN ${users} u USING(uid) WHERE u.account_status='frozen' AND t.status='completed' AND t.direction='withdrawal' UNION ALL SELECT '当前冻结用户关联已完成出金，需核对历史状态','crypto_transactions',t.crypto_order_id FROM ${crypto} t JOIN ${users} u USING(uid) WHERE u.account_status='frozen' AND t.status='completed' AND t.direction='withdrawal'`, 'table', 'issue', [], '业务规则核对项，不等同于数据完整度评分或已确认风控故障'],
    ['rates', '汇率来源与有效日期', '', `SELECT asset,quote_currency,rate_to_usdt,CAST(effective_date AS VARCHAR) AS effective_date,source FROM ${rates} ORDER BY effective_date DESC,asset`, 'table', 'asset', ['rate_to_usdt'], '原始历史汇率快照，不代表实时价格；未按历史汇率换算交易金额'],
  ];
  const now = Date.now();
  return { id: prefix, databaseName: database, name: '资金业务 · 统一指标', description: 'Executive_Dashboard 业务结构；查询四张真实表，保留单位与来源',
    sourceTables: ['users','fiat_transactions','crypto_transactions','exchange_rates'], createdAt: now, updatedAt: now,
    metrics: definitions.map(([id,name,unit,sql,type,xKey,yKeys,definition]) => ({
      id: `${prefix}:${id}`, name, unit, sqlValidation: sql, formula: sql, definition,
      scenario: '资金运营与业务核对', characteristics: '基于本地真实数据重算', value: '首页、指标、图表和分析共用定义',
      example: '', dependencies: extractTablesFromSql(sql), category: '资金业务', createdAt: now, version: 1,
      presentation: { id: `${prefix}:${id}:chart`, title: name, type: type as ChartConfig['type'], xKey, yKeys, unit, aggregation: 'none', showLegend: true,
        format: {unit,compact:false,thousandSeparator:true,decimals:['liquidity','exceptions','rates','monthly'].includes(id) ? 8 : 2} },
    })) };
}

const required: Record<string,string[]> = {
  users: ['uid','account_status'], fiat_transactions: ['fiat_order_id','uid','currency','direction','amount','channel','status','created_at','completed_at'],
  crypto_transactions: ['crypto_order_id','uid','asset','direction','amount','network','status','created_at','completed_at'],
  exchange_rates: ['asset','quote_currency','rate_to_usdt','effective_date','source'],
};
export async function ensureExecutiveMetrics(): Promise<ReturnType<typeof executiveMetricPackage> | null> {
  const scope = await duckDBService.getCurrentCatalogAndSchema();
  const columns = await duckDBService.readQuery(`SELECT table_name,column_name FROM duckdb_columns() WHERE database_name=current_database() AND schema_name=current_schema()`);
  if (!Object.entries(required).every(([table, fields]) => fields.every(field => columns.some(c => c.table_name === table && c.column_name === field)))) return null;
  const built = executiveMetricPackage(scope.catalog, scope.schema);
  if (automaticDismissals().some(item => item.kind === 'package' && item.id === built.id)) return null;
  const existing = metricAnalyzer.loadMetricPackages().find(p => p.id === built.id);
  const current = await duckDBService.getCurrentCatalogAndSchema();
  if (current.catalog !== scope.catalog || current.schema !== scope.schema) return null;
  const result = existing ? { ...existing, metrics: [...existing.metrics.map(m => ({ ...m, presentation:
    m.presentation ? { ...m.presentation, format: m.presentation.format || built.metrics.find(candidate => candidate.id === m.id)?.presentation.format }
      : built.metrics.find(candidate => candidate.id === m.id)?.presentation || { id: m.id, title: m.name, type: 'table' as const, xKey: '', yKeys: [] } })),
    ...built.metrics.filter(m => !existing.metrics.some(item => item.id === m.id) && !existing.dismissedMetricIds?.includes(m.id))] } : built;
  if (!existing || JSON.stringify(result.metrics) !== JSON.stringify(existing.metrics)) metricAnalyzer.saveMetricPackage(result);
  return result;
}
