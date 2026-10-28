/** Calculation, analytical transformation, business domain and governance are independent axes. */
export type MetricAggregation = 'COUNT' | 'COUNT DISTINCT' | 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'MEDIAN' | 'QUANTILE' | 'STDDEV_SAMP' | 'STDDEV_POP' | 'VAR_SAMP' | 'VAR_POP' | 'WEIGHTED_AVG' | 'RATIO';
export type MetricMeasure = { aggregation: 'COUNT' | 'COUNT DISTINCT' | 'SUM'; field?: string; filter?: string };
export interface MetricCalculation {
  aggregation: MetricAggregation;
  field?: string;
  filter?: string;
  groupBy?: string[];
  timeField?: string;
  grain?: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
  weightField?: string;
  quantile?: number;
  numerator?: MetricMeasure;
  denominator?: MetricMeasure;
  scale?: 1 | 100;
  transform?: 'none' | 'cumulative' | 'rolling' | 'previous_growth' | 'year_growth';
  windowPeriods?: number;
}
export interface MetricGovernance {
  owner?: string;
  entity?: string;
  sourceGrain?: string;
  timezone?: string;
  freshness?: string;
  exclusions?: string;
  role?: 'outcome' | 'driver' | 'guardrail' | 'diagnostic';
  /** Additivity of the input measure; time transformations may make their output nonadditive. */
  additivity?: 'additive' | 'semi_additive' | 'non_additive';
  reviewStatus?: 'draft' | 'reviewed' | 'deprecated';
}
