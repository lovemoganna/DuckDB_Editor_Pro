/**
 * Semantic type classification for analysis fields.
 */

export type ColumnSemanticType = 'numeric' | 'temporal' | 'categorical' | 'boolean' | 'identifier' | 'text';

export function classifySemanticType(colName: string, colType: string): ColumnSemanticType {
  const upperType = (colType || '').toUpperCase();
  const lowerName = (colName || '').toLowerCase();

  if (lowerName === 'uid' || lowerName.endsWith('_uid')) return 'identifier';

  if (
    upperType.includes('INT') ||
    upperType.includes('FLOAT') ||
    upperType.includes('DOUBLE') ||
    upperType.includes('DECIMAL') ||
    upperType.includes('NUMERIC') ||
    upperType.includes('REAL') ||
    upperType.includes('HUGEINT')
  ) {
    if (lowerName.endsWith('_id') || lowerName === 'id') {
      return 'identifier';
    }
    return 'numeric';
  }

  if (
    upperType.includes('DATE') ||
    upperType.includes('TIME') ||
    upperType.includes('TIMESTAMP')
  ) {
    return 'temporal';
  }

  if (upperType.includes('BOOL')) {
    return 'boolean';
  }

  if (lowerName.endsWith('_id') || lowerName === 'id' || lowerName.endsWith('uuid') || lowerName.endsWith('code')) {
    return 'identifier';
  }

  return 'categorical';
}
