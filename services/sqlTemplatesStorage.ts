/**
 * sqlTemplatesStorage — Persistent Storage for System & Custom SQL Templates
 */

import { QUICK_SQL_TEMPLATES, DuckDbQuickTemplate, TemplateCategoryKey } from '../data/duckdbTemplatesData';
export type { DuckDbQuickTemplate, TemplateCategoryKey };

const CUSTOM_TEMPLATES_STORAGE_KEY = 'duckdb_custom_sql_templates_v1';

/**
 * Load all templates (System Defaults + Custom Templates from LocalStorage)
 */
export function getStoredSqlTemplates(): DuckDbQuickTemplate[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TEMPLATES_STORAGE_KEY);
    if (!raw) {
      return [...QUICK_SQL_TEMPLATES];
    }
    const customList: DuckDbQuickTemplate[] = JSON.parse(raw);
    // Filter out stale system overrides or corrupted templates from previous versions
    const systemIds = new Set(QUICK_SQL_TEMPLATES.map(s => s.id));
    const validCustoms = customList.filter(c => 
      !systemIds.has(c.id) && 
      !c.sqlExample?.includes('AVG(TRY_CAST') &&
      (!c.sqlExample?.includes('orders') || c.sqlExample?.includes('WITH orders')) &&
      (!c.sqlExample?.includes('transactions') || c.sqlExample?.includes('WITH transactions'))
    );
    return [...QUICK_SQL_TEMPLATES, ...validCustoms];
  } catch (e) {
    console.error('Failed to parse custom sql templates from localStorage', e);
    return [...QUICK_SQL_TEMPLATES];
  }
}

/**
 * Get only custom templates
 */
export function getCustomSqlTemplatesOnly(): DuckDbQuickTemplate[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TEMPLATES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export const TEMPLATES_CHANGED_EVENT = 'duckdb_templates_changed';

function notifyTemplatesChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TEMPLATES_CHANGED_EVENT));
  }
}

/**
 * Save or update a custom template
 */
export function saveCustomSqlTemplate(template: DuckDbQuickTemplate): void {
  const currentCustom = getCustomSqlTemplatesOnly();
  const existingIdx = currentCustom.findIndex(t => t.id === template.id);

  let updatedCustom: DuckDbQuickTemplate[];
  if (existingIdx >= 0) {
    updatedCustom = [...currentCustom];
    updatedCustom[existingIdx] = { ...template, isSystem: false };
  } else {
    updatedCustom = [
      ...currentCustom,
      { ...template, isSystem: false }
    ];
  }

  localStorage.setItem(CUSTOM_TEMPLATES_STORAGE_KEY, JSON.stringify(updatedCustom));
  notifyTemplatesChanged();
}

/**
 * Delete a custom template by ID
 */
export function deleteCustomSqlTemplate(id: string): void {
  const currentCustom = getCustomSqlTemplatesOnly();
  const filtered = currentCustom.filter(t => t.id !== id);
  localStorage.setItem(CUSTOM_TEMPLATES_STORAGE_KEY, JSON.stringify(filtered));
  notifyTemplatesChanged();
}

/**
 * Reset all custom templates
 */
export function resetDefaultSqlTemplates(): void {
  localStorage.removeItem(CUSTOM_TEMPLATES_STORAGE_KEY);
  notifyTemplatesChanged();
}

/**
 * Save editor SQL as a new custom template
 */
export function saveEditorSqlAsTemplate(
  title: string,
  sql: string,
  category: TemplateCategoryKey = 'basic_query',
  purpose: string = '由 SQL 编辑器快速沉淀',
  tags: string[] = ['编辑器沉淀']
): DuckDbQuickTemplate {
  const matches = sql.match(/\{[a-zA-Z0-9_]+\}/g);
  const keyParameters = matches ? Array.from(new Set(matches)) : ['{table_name}', '{column_name}'];

  const template: DuckDbQuickTemplate = {
    id: `custom_editor_${Date.now().toString(36)}`,
    title,
    category,
    categoryLabel: category === 'basic_query' ? '🔍 基础查询' : '⭐ 我的自定义',
    purpose,
    keyParameters,
    sqlExample: sql,
    tags,
    isSystem: false,
    createdAt: Date.now(),
  };

  saveCustomSqlTemplate(template);
  return template;
}

/**
 * Export all templates to JSON file
 */
export function exportSqlTemplatesJson(): void {
  const allTemplates = getStoredSqlTemplates();
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allTemplates, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `duckdb_sql_templates_backup_${Date.now()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

