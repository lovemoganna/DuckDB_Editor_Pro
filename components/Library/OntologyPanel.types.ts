// Shared types for OntologyPanel

export type EditMode = 'none' | 'objectType' | 'object' | 'linkType' | 'link' | 'action';

export interface FormState {
  name: string;
  desc: string;
  objectTypeId: number;
  properties: string;
  linkTypeId: number;
  sourceId: number | null;
  targetId: number | null;
  weight: number;
  status: string;
  executeAt: string;
}

export function normalizeDateToString(raw: any): string {
  if (!raw) return '';
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.slice(0, 10);
  if (typeof raw === 'number' && raw > 1e8) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw.toISOString().slice(0, 10);
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return '';
}
