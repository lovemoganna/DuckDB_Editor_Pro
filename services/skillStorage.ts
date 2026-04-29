/**
 * AI Skills Storage Service
 * 
 * Provides persistent storage for custom AI skills,
 * including import/export functionality and external skill marketplace integration.
 */

import { AISkill, SkillCategory } from '../types';
import { skillRegistry, BUILT_IN_SKILLS } from './skillRegistry';

const STORAGE_KEY = 'duckdb_ai_skills';
const MARKETPLACE_URL = 'https://api.duckdb-skills.market';

/**
 * Skill storage interface
 */
export interface StoredSkill {
  skill: AISkill;
  source: 'built-in' | 'custom' | 'marketplace';
  importedAt?: number;
  version?: string;
  author?: string;
  tags?: string[];
  validationStatus?: 'valid' | 'invalid' | 'untested';
  lastTestedAt?: number;
}

/**
 * Storage metadata
 */
export interface StorageMetadata {
  totalSkills: number;
  builtInCount: number;
  customCount: number;
  marketplaceCount: number;
  lastUpdated: number;
}

/**
 * Skill validation result
 */
export interface SkillValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Marketplace skill info (from external source)
 */
export interface MarketplaceSkill {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  author: string;
  version: string;
  downloads: number;
  rating: number;
  tags: string[];
  skillData: AISkill;
}

/**
 * SkillStorage class
 */
class SkillStorage {
  private customSkills: Map<string, StoredSkill> = new Map();
  private initialized = false;

  /**
   * Initialize storage from localStorage
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored) as Record<string, StoredSkill>;
        Object.entries(data).forEach(([id, value]) => {
          this.customSkills.set(id, value);
        });
      }
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize skill storage:', error);
      this.initialized = true;
    }
  }

  /**
   * Save custom skills to localStorage
   */
  private saveToStorage(): void {
    try {
      const data: Record<string, StoredSkill> = {};
      this.customSkills.forEach((value, key) => {
        data[key] = value;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save skills to storage:', error);
    }
  }

  /**
   * Get all stored skills (including built-in)
   */
  getAllStoredSkills(): StoredSkill[] {
    const builtIn: StoredSkill[] = BUILT_IN_SKILLS.map(skill => ({
      skill,
      source: 'built-in' as const,
      validationStatus: 'valid' as const
    }));

    const custom: StoredSkill[] = Array.from(this.customSkills.values());

    return [...builtIn, ...custom];
  }

  /**
   * Get storage metadata
   */
  getMetadata(): StorageMetadata {
    const custom = Array.from(this.customSkills.values());
    const marketplace = custom.filter(s => s.source === 'marketplace');
    const userCustom = custom.filter(s => s.source === 'custom');

    return {
      totalSkills: BUILT_IN_SKILLS.length + this.customSkills.size,
      builtInCount: BUILT_IN_SKILLS.length,
      customCount: userCustom.length,
      marketplaceCount: marketplace.length,
      lastUpdated: Date.now()
    };
  }

  /**
   * Add or update a custom skill
   */
  saveSkill(skill: AISkill, source: 'custom' | 'marketplace' = 'custom'): StoredSkill {
    const stored: StoredSkill = {
      skill,
      source,
      importedAt: Date.now(),
      version: '1.0.0',
      validationStatus: 'untested' as const
    };

    this.customSkills.set(skill.id, stored);
    this.saveToStorage();
    
    // Register with skill registry
    skillRegistry.register(skill);

    return stored;
  }

  /**
   * Delete a custom skill
   */
  deleteSkill(skillId: string): boolean {
    const stored = this.customSkills.get(skillId);
    if (!stored || stored.source === 'built-in') {
      return false;
    }

    this.customSkills.delete(skillId);
    skillRegistry.unregister(skillId);
    this.saveToStorage();
    return true;
  }

  /**
   * Get a specific skill by ID
   */
  getSkill(skillId: string): StoredSkill | null {
    // Check custom skills first
    const custom = this.customSkills.get(skillId);
    if (custom) return custom;

    // Check built-in skills
    const builtIn = BUILT_IN_SKILLS.find(s => s.id === skillId);
    if (builtIn) {
      return {
        skill: builtIn,
        source: 'built-in',
        validationStatus: 'valid'
      };
    }

    return null;
  }

  /**
   * Get custom skills only
   */
  getCustomSkills(): StoredSkill[] {
    return Array.from(this.customSkills.values());
  }

  /**
   * Validate a skill structure
   */
  validateSkill(skill: AISkill): SkillValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!skill.id) errors.push('Missing required field: id');
    if (!skill.name) errors.push('Missing required field: name');
    if (!skill.description) errors.push('Missing required field: description');
    if (!skill.category) errors.push('Missing required field: category');
    if (!skill.inputSchema || !Array.isArray(skill.inputSchema)) {
      errors.push('Missing or invalid field: inputSchema');
    }

    // Validate input schema
    if (skill.inputSchema) {
      skill.inputSchema.forEach((field, index) => {
        if (!field.name) errors.push(`Input field ${index}: missing name`);
        if (!field.type) errors.push(`Input field ${index}: missing type`);
        
        // Check for valid field types
        const validTypes = ['text', 'textarea', 'number', 'boolean', 'select', 'table', 'column', 'date'];
        if (field.type && !validTypes.includes(field.type)) {
          warnings.push(`Input field "${field.name}": unusual type "${field.type}"`);
        }
      });
    }

    // Check for examples
    if (!skill.examples || skill.examples.length === 0) {
      warnings.push('No examples provided - users may have difficulty understanding how to use this skill');
    }

    // ID format check
    if (skill.id && !/^[a-z][a-z0-9-]*$/.test(skill.id)) {
      warnings.push('Skill ID should use kebab-case (e.g., "my-custom-skill")');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Import skills from JSON string
   */
  importFromJSON(jsonString: string): { success: boolean; imported: number; errors: string[] } {
    const errors: string[] = [];
    let imported = 0;

    try {
      const data = JSON.parse(jsonString);
      const skills: AISkill[] = Array.isArray(data) ? data : [data];

      skills.forEach((skill, index) => {
        const validation = this.validateSkill(skill);
        
        if (!validation.valid) {
          errors.push(`Skill at index ${index}: ${validation.errors.join(', ')}`);
          return;
        }

        // Check for ID conflicts
        const existing = this.getSkill(skill.id);
        if (existing && existing.source === 'built-in') {
          errors.push(`Skill "${skill.id}" conflicts with built-in skill`);
          return;
        }

        this.saveSkill(skill, 'custom');
        imported++;
      });

      return { success: imported > 0, imported, errors };
    } catch (error) {
      return { success: false, imported: 0, errors: [`Invalid JSON: ${(error as Error).message}`] };
    }
  }

  /**
   * Import skills from file
   */
  async importFromFile(file: File): Promise<{ success: boolean; imported: number; errors: string[] }> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const result = this.importFromJSON(content);
        resolve(result);
      };
      
      reader.onerror = () => {
        resolve({ success: false, imported: 0, errors: ['Failed to read file'] });
      };
      
      reader.readAsText(file);
    });
  }

  /**
   * Import skills from URL (supports raw JSON files)
   */
  async importFromURL(url: string): Promise<{ success: boolean; imported: number; errors: string[] }> {
    try {
      // Validate URL
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return { success: false, imported: 0, errors: ['Invalid URL protocol. Only HTTP and HTTPS are supported.'] };
      }

      // Check if it's a raw JSON URL
      const isJsonUrl = url.endsWith('.json') || url.includes('/raw/') || url.includes('raw.githubusercontent.com');

      const response = await fetch(url, {
        method: 'GET',
        headers: isJsonUrl ? { 'Accept': 'application/json' } : {}
      });

      if (!response.ok) {
        return { success: false, imported: 0, errors: [`Failed to fetch: ${response.status} ${response.statusText}`] };
      }

      const content = await response.text();
      
      // Try to parse as JSON
      try {
        JSON.parse(content);
      } catch {
        return { success: false, imported: 0, errors: ['URL content is not valid JSON'] };
      }

      return this.importFromJSON(content);
    } catch (error) {
      return { success: false, imported: 0, errors: [`Failed to import from URL: ${(error as Error).message}`] };
    }
  }

  /**
   * Import skills from GitHub Gist
   */
  async importFromGitHubGist(gistIdOrUrl: string): Promise<{ success: boolean; imported: number; errors: string[] }> {
    try {
      // Extract Gist ID from URL if necessary
      let gistId = gistIdOrUrl;
      
      // Handle different Gist URL formats
      if (gistIdOrUrl.includes('gist.github.com')) {
        const match = gistIdOrUrl.match(/gist\.github\.com\/[\w-]+\/([a-f0-9]+)/i) 
                   || gistIdOrUrl.match(/gist\.github\.com\/([a-f0-9]+)/i);
        if (match) {
          gistId = match[1];
        }
      }

      // Validate Gist ID format (typically 20+ character hex string)
      if (!/^[a-f0-9]{20,}$/i.test(gistId)) {
        return { success: false, imported: 0, errors: ['Invalid GitHub Gist ID or URL'] };
      }

      // Fetch Gist data from GitHub API
      const response = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'GET',
        headers: { 'Accept': 'application/vnd.github.v3+json' }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return { success: false, imported: 0, errors: ['Gist not found. Check the Gist ID or URL.'] };
        }
        return { success: false, imported: 0, errors: [`GitHub API error: ${response.status} ${response.statusText}`] };
      }

      const gistData = await response.json();
      
      // Find JSON files in the Gist
      const jsonFiles = Object.values(gistData.files as Record<string, { content: string, filename: string }>)
        .filter(file => file.content && (file.filename.endsWith('.json') || file.filename.includes('skill')));

      if (jsonFiles.length === 0) {
        return { success: false, imported: 0, errors: ['No JSON skill files found in this Gist'] };
      }

      // Import all JSON files from the Gist
      let totalImported = 0;
      const allErrors: string[] = [];

      for (const file of jsonFiles) {
        try {
          // Validate JSON content
          JSON.parse(file.content);
          const result = this.importFromJSON(file.content);
          totalImported += result.imported;
          if (result.errors.length > 0) {
            allErrors.push(...result.errors.map(e => `${file.filename}: ${e}`));
          }
        } catch (e) {
          allErrors.push(`${file.filename}: Invalid JSON content`);
        }
      }

      return { 
        success: totalImported > 0, 
        imported: totalImported, 
        errors: allErrors 
      };
    } catch (error) {
      return { success: false, imported: 0, errors: [`Failed to import from GitHub Gist: ${(error as Error).message}`] };
    }
  }

  /**
   * Export skills to JSON
   */
  exportToJSON(skillIds?: string[]): string {
    let skills: StoredSkill[];

    if (skillIds && skillIds.length > 0) {
      skills = skillIds
        .map(id => this.customSkills.get(id))
        .filter((s): s is StoredSkill => s !== undefined);
    } else {
      skills = this.getCustomSkills();
    }

    return JSON.stringify(
      skills.map(s => s.skill),
      null,
      2
    );
  }

  /**
   * Download skills as JSON file
   */
  downloadSkills(skillIds?: string[]): void {
    const json = this.exportToJSON(skillIds);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-skills-export-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Search marketplace for skills (simulated)
   */
  async searchMarketplace(query: string, category?: SkillCategory): Promise<MarketplaceSkill[]> {
    // Simulated marketplace search
    // In production, this would call actual marketplace API
    
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay

    // Simulated results - in real implementation, fetch from actual API
    const mockMarketplaceSkills: MarketplaceSkill[] = [
      {
        id: 'marketplace-advanced-join',
        name: '高级 JOIN 查询',
        description: '复杂多表关联查询，支持多对多关系和递归查询',
        category: 'modeling',
        author: 'DuckDB Community',
        version: '1.2.0',
        downloads: 15420,
        rating: 4.8,
        tags: ['join', 'advanced', 'multi-table'],
        skillData: {
          id: 'marketplace-advanced-join',
          name: '高级 JOIN 查询',
          description: '复杂多表关联查询',
          category: 'modeling',
          icon: '🔗',
          inputSchema: [
            { name: 'joinType', type: 'select', required: true, label: '连接类型', options: ['INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS'] },
            { name: 'tables', type: 'textarea', required: true, label: '表列表', rows: 3 },
            { name: 'conditions', type: 'textarea', required: true, label: '连接条件', rows: 2 }
          ],
          outputType: 'sql',
          requiresTable: true,
          requiresColumns: true
        }
      },
      {
        id: 'marketplace-time-series-forecast',
        name: '时间序列预测',
        description: '基于历史数据进行时间序列分析和简单预测',
        category: 'insights',
        author: 'DataScience Hub',
        version: '2.0.1',
        downloads: 8930,
        rating: 4.6,
        tags: ['time-series', 'forecast', 'analysis'],
        skillData: {
          id: 'marketplace-time-series-forecast',
          name: '时间序列预测',
          description: '基于历史数据进行时间序列分析',
          category: 'insights',
          icon: '📊',
          inputSchema: [
            { name: 'timeColumn', type: 'column', required: true, label: '时间列' },
            { name: 'valueColumn', type: 'column', required: true, label: '数值列' },
            { name: 'forecastPeriods', type: 'number', required: true, label: '预测周期数', defaultValue: 7 }
          ],
          outputType: 'sql',
          requiresTable: true,
          requiresColumns: true
        }
      },
      {
        id: 'marketplace-json-parser',
        name: 'JSON 数据解析',
        description: '高效解析和提取 JSON 数据，支持 nesting 结构',
        category: 'wrangling',
        author: 'JSON Tools',
        version: '1.5.0',
        downloads: 12300,
        rating: 4.9,
        tags: ['json', 'parse', 'transform'],
        skillData: {
          id: 'marketplace-json-parser',
          name: 'JSON 数据解析',
          description: '高效解析和提取 JSON 数据',
          category: 'wrangling',
          icon: '{}',
          inputSchema: [
            { name: 'jsonColumn', type: 'column', required: true, label: 'JSON 列' },
            { name: 'path', type: 'text', required: true, label: 'JSON 路径', placeholder: '$.data.items[*].name' },
            { name: 'outputType', type: 'select', required: true, label: '输出类型', options: ['ARRAY', 'STRING', 'STRUCT'] }
          ],
          outputType: 'sql',
          requiresTable: true,
          requiresColumns: true
        }
      }
    ];

    // Filter by query
    let results = mockMarketplaceSkills.filter(skill => 
      skill.name.toLowerCase().includes(query.toLowerCase()) ||
      skill.description.toLowerCase().includes(query.toLowerCase()) ||
      skill.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
    );

    // Filter by category
    if (category) {
      results = results.filter(skill => skill.category === category);
    }

    return results;
  }

  /**
   * Import skill from marketplace
   */
  async importFromMarketplace(marketplaceId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Search for the skill
      const results = await this.searchMarketplace(marketplaceId);
      const skill = results.find(s => s.id === marketplaceId);

      if (!skill) {
        return { success: false, error: 'Skill not found in marketplace' };
      }

      // Save the skill
      const stored = this.saveSkill(skill.skillData, 'marketplace');
      stored.author = skill.author;
      stored.version = skill.version;
      stored.tags = skill.tags;

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Update skill validation status
   */
  updateValidationStatus(skillId: string, status: 'valid' | 'invalid' | 'untested'): void {
    const stored = this.customSkills.get(skillId);
    if (stored) {
      stored.validationStatus = status;
      stored.lastTestedAt = Date.now();
      this.saveToStorage();
    }
  }

  /**
   * Get skills by category
   */
  getSkillsByCategory(category: SkillCategory): StoredSkill[] {
    return this.getAllStoredSkills().filter(s => s.skill.category === category);
  }

  /**
   * Search skills
   */
  searchSkills(query: string): StoredSkill[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllStoredSkills().filter(s => 
      s.skill.name.toLowerCase().includes(lowerQuery) ||
      s.skill.description.toLowerCase().includes(lowerQuery) ||
      s.skill.id.toLowerCase().includes(lowerQuery) ||
      s.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Clear all custom skills
   */
  clearCustomSkills(): void {
    this.customSkills.forEach((_, skillId) => {
      skillRegistry.unregister(skillId);
    });
    this.customSkills.clear();
    this.saveToStorage();
  }

  /**
   * Backup skills to a downloadable file
   */
  backupSkills(): string {
    const metadata = this.getMetadata();
    const customSkills = this.getCustomSkills();
    
    const backup = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      metadata,
      skills: customSkills.map(s => s.skill)
    };

    return JSON.stringify(backup, null, 2);
  }

  /**
   * Restore skills from backup
   */
  restoreFromBackup(backupJSON: string): { success: boolean; restored: number; errors: string[] } {
    const errors: string[] = [];
    
    try {
      const backup = JSON.parse(backupJSON);
      
      if (!backup.skills || !Array.isArray(backup.skills)) {
        return { success: false, restored: 0, errors: ['Invalid backup format'] };
      }

      let restored = 0;
      backup.skills.forEach((skill: AISkill) => {
        const validation = this.validateSkill(skill);
        if (validation.valid) {
          this.saveSkill(skill, 'custom');
          restored++;
        } else {
          errors.push(`Skill "${skill.id}": ${validation.errors.join(', ')}`);
        }
      });

      return { success: restored > 0, restored, errors };
    } catch (error) {
      return { success: false, restored: 0, errors: [(error as Error).message] };
    }
  }
}

// Singleton instance
export const skillStorage = new SkillStorage();

// Export convenience functions
export const initializeSkillStorage = () => skillStorage.initialize();
export const getAllStoredSkills = () => skillStorage.getAllStoredSkills();
export const getSkillStorageMetadata = () => skillStorage.getMetadata();
export const saveCustomSkill = (skill: AISkill) => skillStorage.saveSkill(skill);
export const deleteCustomSkill = (skillId: string) => skillStorage.deleteSkill(skillId);
export const getStoredSkill = (skillId: string) => skillStorage.getSkill(skillId);
export const validateSkill = (skill: AISkill) => skillStorage.validateSkill(skill);
export const importSkillsFromJSON = (json: string) => skillStorage.importFromJSON(json);
export const importSkillsFromFile = (file: File) => skillStorage.importFromFile(file);
export const importSkillsFromURL = (url: string) => skillStorage.importFromURL(url);
export const importSkillsFromGitHubGist = (gistIdOrUrl: string) => skillStorage.importFromGitHubGist(gistIdOrUrl);
export const exportSkillsToJSON = (skillIds?: string[]) => skillStorage.exportToJSON(skillIds);
export const downloadSkills = (skillIds?: string[]) => skillStorage.downloadSkills(skillIds);
export const searchMarketplaceSkills = (query: string, category?: SkillCategory) => 
  skillStorage.searchMarketplace(query, category);
export const importFromMarketplace = (id: string) => skillStorage.importFromMarketplace(id);
export const searchStoredSkills = (query: string) => skillStorage.searchSkills(query);
export const getStoredSkillsByCategory = (category: SkillCategory) => skillStorage.getSkillsByCategory(category);
export const backupAllSkills = () => skillStorage.backupSkills();
export const restoreSkillsFromBackup = (backup: string) => skillStorage.restoreFromBackup(backup);
