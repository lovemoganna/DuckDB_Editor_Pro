const STORAGE_KEY = 'duckdb_learn_experiments';
const MAX_RECORDS = 100;
const MAX_RESULT_ROWS = 100;
const MAX_RESULT_COLUMNS = 50;

export interface LearnExperimentInput {
  tutorialId: string;
  codeBlockId: string;
  sql: string;
  executedSql: string;
  engineVersion: string;
  durationMs: number;
  rows?: unknown[];
  error?: string;
  timestamp?: number;
}

export interface LearnExperimentRecord extends LearnExperimentInput {
  id: string;
  timestamp: number;
  rowCount: number;
  resultSnapshot: Array<Record<string, unknown>>;
}

function normalizeValue(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, MAX_RESULT_COLUMNS)
        .map(([key, nested]) => [key, normalizeValue(nested)]),
    );
  }
  return value;
}

export function createLearnExperimentRecord(input: LearnExperimentInput): LearnExperimentRecord {
  const timestamp = input.timestamp ?? Date.now();
  const rows = input.rows ?? [];
  return {
    ...input,
    id: `${timestamp}-${input.codeBlockId}`,
    timestamp,
    rowCount: rows.length,
    resultSnapshot: rows
      .slice(0, MAX_RESULT_ROWS)
      .map(row => normalizeValue(row) as Record<string, unknown>),
  };
}

export function recordLearnExperiment(
  input: LearnExperimentInput,
  storage: Storage = localStorage,
): LearnExperimentRecord {
  const record = createLearnExperimentRecord(input);
  try {
    const existing = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]') as LearnExperimentRecord[];
    storage.setItem(STORAGE_KEY, JSON.stringify([record, ...existing].slice(0, MAX_RECORDS)));
  } catch (error) {
    console.warn('[Learn] Failed to persist experiment record', error);
  }
  return record;
}
