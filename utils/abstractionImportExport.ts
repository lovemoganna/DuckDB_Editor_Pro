/**
 * abstractionImportExport — JSON 导入导出工具
 *
 * 支持抽象表的批量导入导出
 */

import {
  AbstractionTable,
  AbstractionSqlOperation,
  AbstractionLevel,
} from '../types';
import {
  AbstractionExportData,
  AbstractionImportResult,
  AbstractionTemplate,
} from '../types/abstraction';
import {
  saveAbstractionTable,
  getAllAbstractionTables,
  updateAbstractionTable,
} from '../services/libraryStorage';
import { validateImportData } from './abstractionValidator';

const EXPORT_VERSION = '1.0.0';

/**
 * 导出抽象表为 JSON
 */
export const exportAbstractionTables = async (
  tableIds?: string[]
): Promise<string> => {
  const allTables = await getAllAbstractionTables();

  // 如果指定了 IDs，则只导出指定的表格
  const tablesToExport = tableIds && tableIds.length > 0
    ? allTables.filter(t => tableIds.includes(t.id))
    : allTables;

  // 转换为导出格式
  const templates: AbstractionTemplate[] = tablesToExport.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description || '',
    sql: t.sqlConfig.template,
    domain: t.domain,
    tags: t.tags,
    abstractionPath: t.abstractionPath,
    operation: t.sqlConfig.operation,
    parameters: t.sqlConfig.parameters,
    sampleOutput: t.sqlConfig.sampleOutput,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    isFavorite: t.isFavorite,
    isSystem: t.isSystem,
    currentVersion: 1,
  }));

  const exportData: AbstractionExportData = {
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    templates,
  };

  return JSON.stringify(exportData, null, 2);
};

/**
 * 导入抽象表
 */
export const importAbstractionTables = async (
  jsonString: string,
  options?: {
    overwrite?: boolean;
    skipExisting?: boolean;
  }
): Promise<AbstractionImportResult> => {
  const result: AbstractionImportResult = {
    success: true,
    imported: 0,
    skipped: 0,
    errors: [],
  };

  // 解析 JSON
  let data: unknown;
  try {
    data = JSON.parse(jsonString);
  } catch (e) {
    result.success = false;
    result.errors.push(`JSON 解析失败: ${e instanceof Error ? e.message : '未知错误'}`);
    return result;
  }

  // 验证导入数据格式
  const validation = validateImportData(data);
  if (!validation.isValid) {
    result.success = false;
    result.errors.push(validation.error!);
    return result;
  }

  const exportData = data as AbstractionExportData;
  const existingTables = await getAllAbstractionTables();
  const existingNames = new Set(existingTables.map(t => t.name));

  // 批量导入
  for (const template of exportData.templates) {
    try {
      // 检查是否已存在
      if (existingNames.has(template.name)) {
        if (options?.skipExisting) {
          result.skipped++;
          continue;
        }
        if (options?.overwrite) {
          // 找到现有记录并更新
          const existing = existingTables.find(t => t.name === template.name);
          if (existing) {
            const updated: AbstractionTable = {
              ...existing,
              description: template.description,
              abstractionPath: template.abstractionPath,
              sqlConfig: {
                operation: template.operation,
                template: template.sql,
                parameters: template.parameters,
                sampleOutput: template.sampleOutput,
              },
              tags: template.tags,
              domain: template.domain,
              isFavorite: template.isFavorite,
              updatedAt: Date.now(),
            };
            await updateAbstractionTable(updated);
            result.imported++;
            continue;
          }
        }
        // 既不是 skipExisting 也不是 overwrite，报错
        result.errors.push(`模板 "${template.name}" 已存在`);
        result.skipped++;
        continue;
      }

      // 创建新记录
      const newTable: Omit<AbstractionTable, 'id' | 'createdAt' | 'updatedAt'> = {
        name: template.name,
        description: template.description,
        abstractionPath: template.abstractionPath,
        sqlConfig: {
          operation: template.operation,
          template: template.sql,
          parameters: template.parameters || [],
          sampleOutput: template.sampleOutput,
        },
        tags: template.tags,
        domain: template.domain,
        isFavorite: template.isFavorite || false,
        isSystem: false, // 导入的模板默认不是系统模板
      };

      await saveAbstractionTable(newTable);
      result.imported++;
    } catch (e) {
      result.errors.push(
        `导入 "${template.name}" 失败: ${e instanceof Error ? e.message : '未知错误'}`
      );
    }
  }

  result.success = result.errors.length === 0;
  return result;
};

/**
 * 从剪贴板导入
 */
export const importFromClipboard = async (
  options?: { overwrite?: boolean; skipExisting?: boolean }
): Promise<AbstractionImportResult> => {
  try {
    const text = await navigator.clipboard.readText();
    return importAbstractionTables(text, options);
  } catch (e) {
    return {
      success: false,
      imported: 0,
      skipped: 0,
      errors: ['无法读取剪贴板内容'],
    };
  }
};

/**
 * 导出到剪贴板
 */
export const exportToClipboard = async (
  tableIds?: string[]
): Promise<boolean> => {
  try {
    const json = await exportAbstractionTables(tableIds);
    await navigator.clipboard.writeText(json);
    return true;
  } catch (e) {
    console.error('[AbstractionImportExport] Failed to export to clipboard:', e);
    return false;
  }
};

/**
 * 下载为文件
 */
export const downloadAsFile = async (
  filename?: string,
  tableIds?: string[]
): Promise<void> => {
  const json = await exportAbstractionTables(tableIds);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const defaultFilename = `abstraction-tables-${new Date().toISOString().slice(0, 10)}.json`;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || defaultFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * 从文件导入
 */
export const importFromFile = async (
  file: File,
  options?: { overwrite?: boolean; skipExisting?: boolean }
): Promise<AbstractionImportResult> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        resolve(importAbstractionTables(content, options));
      } else {
        resolve({
          success: false,
          imported: 0,
          skipped: 0,
          errors: ['无法读取文件内容'],
        });
      }
    };
    reader.onerror = () => {
      resolve({
        success: false,
        imported: 0,
        skipped: 0,
        errors: ['文件读取失败'],
      });
    };
    reader.readAsText(file);
  });
};

/**
 * 生成示例导出数据
 */
export const generateSampleExport = (): string => {
  const sampleExport: AbstractionExportData = {
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    templates: [
      {
        id: 'sample-1',
        name: '示例：用户统计',
        description: '这是一个示例抽象表',
        sql: 'SELECT user_id, COUNT(*) FROM users GROUP BY user_id',
        domain: '示例',
        tags: ['用户', '统计'],
        abstractionPath: {
          concept: '用户',
          property: '统计',
          instance: 'users',
        },
        operation: 'SELECT',
        parameters: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isFavorite: false,
        isSystem: false,
        currentVersion: 1,
      },
    ],
  };
  return JSON.stringify(sampleExport, null, 2);
};
