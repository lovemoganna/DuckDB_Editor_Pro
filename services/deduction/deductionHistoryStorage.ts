import type { DeductionHistoryRecord } from './deductionTypes';

const STORAGE_KEY = 'duckdb-manager.deduction-history';
const STORAGE_VERSION = 1;
const MAX_RECORDS = 20;

interface StoredHistory {
  version: number;
  records: DeductionHistoryRecord[];
}

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isStructureNode = (value: unknown): boolean => isObject(value)
  && typeof value.id === 'string'
  && typeof value.type === 'string'
  && typeof value.label === 'string'
  && Array.isArray(value.children)
  && value.children.every(isStructureNode);

const isSupportedStatement = (value: unknown): boolean => isObject(value)
  && typeof value.text === 'string'
  && Array.isArray(value.supportingFeatureIds)
  && Array.isArray(value.supportingRelationIds);

const isEvidence = (value: unknown): boolean => isObject(value)
  && typeof value.quote === 'string'
  && typeof value.start === 'number'
  && typeof value.end === 'number';

const isSource = (value: unknown): boolean => isObject(value)
  && typeof value.id === 'string'
  && typeof value.title === 'string'
  && typeof value.content === 'string';

const isFeature = (value: unknown): boolean => isObject(value)
  && typeof value.id === 'string'
  && typeof value.kind === 'string'
  && typeof value.statement === 'string'
  && (value.classification === 'fact' || value.classification === 'judgment')
  && (value.certainty === 'confirmed' || value.certainty === 'uncertain')
  && Array.isArray(value.evidence)
  && value.evidence.every(isEvidence);

const isRelation = (value: unknown): boolean => isObject(value)
  && typeof value.id === 'string'
  && typeof value.type === 'string'
  && typeof value.statement === 'string'
  && (value.certainty === 'confirmed' || value.certainty === 'uncertain')
  && Array.isArray(value.fromFeatureIds)
  && Array.isArray(value.toFeatureIds)
  && Array.isArray(value.evidence)
  && value.evidence.every(isEvidence);

const isContext = (value: unknown): boolean => isObject(value)
  && typeof value.id === 'string'
  && typeof value.label === 'string'
  && Array.isArray(value.featureIds)
  && Array.isArray(value.evidence)
  && value.evidence.every(isEvidence);

const isMapping = (value: unknown): boolean => isObject(value)
  && typeof value.id === 'string'
  && (value.targetKind === 'feature' || value.targetKind === 'relation')
  && typeof value.targetId === 'string'
  && typeof value.sourceId === 'string'
  && typeof value.correspondingObject === 'string'
  && typeof value.correspondingContent === 'string'
  && ['直接对应', '高度匹配', '部分匹配', '仅相关', '无法确认'].includes(String(value.matchLevel))
  && typeof value.validationNote === 'string'
  && (value.basis === undefined || isEvidence(value.basis));

const isHistoryRecord = (value: unknown): value is DeductionHistoryRecord => {
  if (!isObject(value) || typeof value.id !== 'string' || typeof value.createdAt !== 'string') return false;
  const request = value.request;
  const result = value.result;
  return isObject(request)
    && typeof request.input === 'string'
    && typeof request.externalMappingRequested === 'boolean'
    && (request.sources === undefined || (Array.isArray(request.sources) && request.sources.every(isSource)))
    && isObject(result)
    && result.version === 1
    && typeof result.input === 'string'
    && Array.isArray(result.features) && result.features.every(isFeature)
    && Array.isArray(result.relations) && result.relations.every(isRelation)
    && Array.isArray(result.contexts) && result.contexts.every(isContext)
    && (result.externalMappings === undefined || (Array.isArray(result.externalMappings) && result.externalMappings.every(isMapping)))
    && isStructureNode(result.structure)
    && isSupportedStatement(result.coreMeaning)
    && isSupportedStatement(result.punchline)
    && isObject(result.validation)
    && (result.validation.status === 'valid' || result.validation.status === 'valid_with_uncertainty')
    && Array.isArray(result.validation.issues);
};

export function loadDeductionHistory(): DeductionHistoryRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<StoredHistory>;
    if (parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.records)) return [];
    return parsed.records.filter(isHistoryRecord).slice(0, MAX_RECORDS);
  } catch {
    return [];
  }
}

export function saveDeductionHistory(record: DeductionHistoryRecord): DeductionHistoryRecord[] {
  const records = [record, ...loadDeductionHistory().filter(item => item.id !== record.id)].slice(0, MAX_RECORDS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, records } satisfies StoredHistory));
  return records;
}

export function deleteDeductionHistory(id: string): DeductionHistoryRecord[] {
  const records = loadDeductionHistory().filter(record => record.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, records } satisfies StoredHistory));
  return records;
}

export function clearDeductionHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}
