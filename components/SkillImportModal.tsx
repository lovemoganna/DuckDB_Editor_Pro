/**
 * Skill Import Modal Component
 * 
 * UI for importing AI skills from JSON, files,
 * or marketplace.
 * 
 * Follows Monokai theme from DESIGN_SYSTEM.md
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  skillStorage,
  importSkillsFromJSON, 
  importSkillsFromFile, 
  importSkillsFromURL,
  importSkillsFromGitHubGist,
  downloadSkills,
  searchMarketplaceSkills,
  MarketplaceSkill,
  StoredSkill,
  validateSkill
} from '../services/skillStorage';
import { AISkill, SkillCategory } from '../types';
import { initializeSkillStorage } from '../services/skillStorage';
import { 
  X,
  FileJson,
  FolderOpen,
  Link,
  Github,
  ShoppingCart,
  PlusCircle,
  Upload,
  Download,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle,
  FileCode,
  ExternalLink,
  Sparkles,
  Settings,
  RefreshCw,
  Copy,
  Check
} from 'lucide-react';

interface SkillImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport?: (skill: AISkill) => void;
}

type ImportTab = 'json' | 'file' | 'url' | 'github' | 'marketplace' | 'custom';

export const SkillImportModal: React.FC<SkillImportModalProps> = ({ 
  isOpen, 
  onClose,
  onImport 
}) => {
  const [activeTab, setActiveTab] = useState<ImportTab>('json');
  const [jsonInput, setJsonInput] = useState('');
  const [fileInput, setFileInput] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [githubInput, setGithubInput] = useState('');
  const [marketplaceQuery, setMarketplaceQuery] = useState('');
  const [marketplaceResults, setMarketplaceResults] = useState<MarketplaceSkill[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<SkillCategory | ''>('');
  const [validationResult, setValidationResult] = useState<{ valid: boolean; errors: string[]; warnings: string[] } | null>(null);
  const [previewSkill, setPreviewSkill] = useState<AISkill | null>(null);
  const [importedSkills, setImportedSkills] = useState<AISkill[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize storage
  useEffect(() => {
    if (isOpen) {
      initializeSkillStorage();
    }
  }, [isOpen]);

  // Validate JSON when input changes
  useEffect(() => {
    if (activeTab === 'json' && jsonInput.trim()) {
      try {
        const parsed = JSON.parse(jsonInput);
        const skills = Array.isArray(parsed) ? parsed : [parsed];
        if (skills.length > 0) {
          const result = validateSkill(skills[0]);
          setValidationResult(result);
          
          if (result.valid) {
            setPreviewSkill(skills[0]);
          } else {
            setPreviewSkill(null);
          }
        }
      } catch (e) {
        setValidationResult({ valid: false, errors: ['Invalid JSON format'], warnings: [] });
        setPreviewSkill(null);
      }
    } else {
      setValidationResult(null);
      setPreviewSkill(null);
    }
  }, [jsonInput, activeTab]);

  // Search marketplace
  const handleSearchMarketplace = useCallback(async () => {
    if (!marketplaceQuery.trim()) return;
    
    setIsSearching(true);
    setError(null);
    
    try {
      const results = await searchMarketplaceSkills(
        marketplaceQuery, 
        selectedCategory || undefined
      );
      setMarketplaceResults(results);
    } catch (e) {
      setError('Search failed: ' + (e as Error).message);
    } finally {
      setIsSearching(false);
    }
  }, [marketplaceQuery, selectedCategory]);

  // Handle JSON import
  const handleJsonImport = async () => {
    if (!jsonInput.trim()) {
      setError('Please enter JSON content');
      return;
    }
    
    setIsImporting(true);
    setError(null);
    setSuccess(null);
    
    try {
      const result = importSkillsFromJSON(jsonInput);
      if (result.success) {
        setSuccess(`成功导入 ${result.imported} 个技能!`);
        setJsonInput('');
        setPreviewSkill(null);
      } else {
        setError(result.errors.join('\n'));
      }
    } catch (e) {
      setError('Import failed: ' + (e as Error).message);
    } finally {
      setIsImporting(false);
    }
  };

  // Handle file import
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsImporting(true);
    setError(null);
    setSuccess(null);
    
    try {
      const result = await importSkillsFromFile(file);
      if (result.success) {
        setSuccess(`成功导入 ${result.imported} 个技能!`);
        setFileInput(file.name);
      } else {
        setError(result.errors.join('\n'));
      }
    } catch (e) {
      setError('Import failed: ' + (e as Error).message);
    } finally {
      setIsImporting(false);
    }
  };

  // Handle marketplace import
  const handleMarketplaceImport = async (marketplaceSkill: MarketplaceSkill) => {
    setIsImporting(true);
    setError(null);
    setSuccess(null);
    
    try {
      const result = await skillStorage.importFromMarketplace(marketplaceSkill.id);
      if (result.success) {
        setSuccess(`成功导入 "${marketplaceSkill.name}"!`);
        if (onImport) {
          onImport(marketplaceSkill.skillData);
        }
      } else {
        setError(result.error || 'Import failed');
      }
    } catch (e) {
      setError('Import failed: ' + (e as Error).message);
    } finally {
      setIsImporting(false);
    }
  };

  // Handle URL import
  const handleURLImport = async () => {
    if (!urlInput.trim()) {
      setError('Please enter a URL');
      return;
    }

    setIsImporting(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await importSkillsFromURL(urlInput);
      if (result.success) {
        setSuccess(`成功从 URL 导入 ${result.imported} 个技能!`);
        setUrlInput('');
        setImportedSkills(prev => [...prev]);
      } else {
        setError(result.errors.join('\n'));
      }
    } catch (e) {
      setError('Import failed: ' + (e as Error).message);
    } finally {
      setIsImporting(false);
    }
  };

  // Handle GitHub Gist import
  const handleGitHubImport = async () => {
    if (!githubInput.trim()) {
      setError('Please enter a GitHub Gist ID or URL');
      return;
    }

    setIsImporting(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await importSkillsFromGitHubGist(githubInput);
      if (result.success) {
        setSuccess(`成功从 GitHub Gist 导入 ${result.imported} 个技能!`);
        setGithubInput('');
        setImportedSkills(prev => [...prev]);
      } else {
        setError(result.errors.join('\n'));
      }
    } catch (e) {
      setError('Import failed: ' + (e as Error).message);
    } finally {
      setIsImporting(false);
    }
  };

  // Handle auto-validation after import (Deprecated, always mark success)
  const handleValidateAfterImport = async () => {
    if (importedSkills.length === 0) return;

    setIsValidating(true);
    try {
      // Mock validation since skillTester is deprecated
      await new Promise(resolve => setTimeout(resolve, 500));
      setSuccess('技能导入完成!');
      setImportedSkills([]);
    } catch (e) {
      console.error('Validation failed:', e);
    } finally {
      setIsValidating(false);
    }
  };

  // Handle export
  const handleExport = () => {
    downloadSkills();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-monokai-bg border border-monokai-accent rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-monokai-accent flex items-center justify-between bg-gradient-to-r from-monokai-purple/10 to-monokai-pink/10 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-monokai-purple to-monokai-pink flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-monokai-fg">AI Skills 导入/导出</h2>
              <p className="text-xs text-monokai-comment">从JSON、文件或市场导入技能</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-monokai-comment hover:text-monokai-fg hover:bg-monokai-accent/30 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4 border-b border-monokai-accent">
          <div className="flex gap-1 overflow-x-auto">
            {[
              { id: 'json' as const, label: 'JSON导入', icon: FileJson },
              { id: 'file' as const, label: '文件导入', icon: FolderOpen },
              { id: 'url' as const, label: 'URL导入', icon: Link },
              { id: 'github' as const, label: 'GitHub', icon: Github },
              { id: 'marketplace' as const, label: '技能市场', icon: ShoppingCart },
              { id: 'custom' as const, label: '自定义创建', icon: PlusCircle }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 rounded-t-lg font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-monokai-sidebar text-monokai-purple border-t border-x border-monokai-accent -mb-px'
                    : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-accent/20'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* JSON Tab */}
          {activeTab === 'json' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-monokai-fg mb-2">
                  输入技能 JSON
                </label>
                <textarea
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder={`{
  "id": "my-custom-skill",
  "name": "我的自定义技能",
  "description": "技能描述",
  "category": "sql",
  "inputSchema": [...]
}`}
                  className="w-full h-48 px-3 py-2 bg-monokai-bg border border-monokai-accent rounded-lg text-sm text-monokai-fg font-mono focus:outline-none focus:ring-2 focus:ring-monokai-purple focus:border-transparent placeholder-monokai-comment"
                />
              </div>
              
              {validationResult && (
                <div className={`p-3 rounded-lg border ${
                  validationResult.valid 
                    ? 'bg-monokai-green/10 border-monokai-green/30' 
                    : 'bg-monokai-pink/10 border-monokai-pink/30'
                }`}>
                  <div className="flex items-center gap-2">
                    {validationResult.valid ? (
                      <CheckCircle className="w-4 h-4 text-monokai-green" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-monokai-pink" />
                    )}
                    <span className={`font-medium text-sm ${
                      validationResult.valid ? 'text-monokai-green' : 'text-monokai-pink'
                    }`}>
                      {validationResult.valid ? '验证通过' : '验证失败'}
                    </span>
                  </div>
                  {validationResult.errors.length > 0 && (
                    <ul className="mt-2 text-xs text-monokai-pink list-disc list-inside">
                      {validationResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  )}
                  {validationResult.warnings.length > 0 && (
                    <ul className="mt-2 text-xs text-monokai-yellow list-disc list-inside">
                      {validationResult.warnings.map((warn, i) => (
                        <li key={i}>{warn}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {error && (
                <div className="p-3 bg-monokai-pink/10 border border-monokai-pink/30 rounded-lg text-monokai-pink text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 bg-monokai-green/10 border border-monokai-green/30 rounded-lg text-monokai-green text-sm">
                  {success}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleJsonImport}
                  disabled={isImporting || !validationResult?.valid}
                  className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                    isImporting || !validationResult?.valid
                      ? 'bg-monokai-sidebar text-monokai-comment opacity-50 cursor-not-allowed'
                      : 'bg-monokai-purple text-white hover:opacity-90'
                  }`}
                >
                  {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  <span>导入 JSON</span>
                </button>
              </div>
            </div>
          )}

          {/* File Tab */}
          {activeTab === 'file' && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-monokai-accent rounded-lg p-8 text-center hover:border-monokai-purple hover:bg-monokai-purple/10 transition-colors cursor-pointer"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="w-16 h-16 mx-auto mb-3 rounded-xl bg-monokai-sidebar flex items-center justify-center">
                  <FolderOpen className="w-8 h-8 text-monokai-purple" />
                </div>
                <p className="text-monokai-fg">
                  {fileInput ? `已选择: ${fileInput}` : '点击选择 JSON 文件或拖拽到此处'}
                </p>
                <p className="text-xs text-monokai-comment mt-1">
                  支持 .json 格式
                </p>
              </div>

              {error && (
                <div className="p-3 bg-monokai-pink/10 border border-monokai-pink/30 rounded-lg text-monokai-pink text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 bg-monokai-green/10 border border-monokai-green/30 rounded-lg text-monokai-green text-sm">
                  {success}
                </div>
              )}

              <div className="border-t border-monokai-accent pt-4">
                <h4 className="font-medium text-monokai-fg text-sm mb-2">导出技能</h4>
                <button
                  onClick={handleExport}
                  className="px-4 py-2 bg-monokai-sidebar border border-monokai-accent hover:bg-monokai-accent/20 text-monokai-fg rounded-lg transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  导出所有自定义技能
                </button>
              </div>
            </div>
          )}

          {/* URL Tab */}
          {activeTab === 'url' && (
            <div className="space-y-4">
              <div className="p-4 bg-monokai-purple/10 rounded-lg border border-monokai-purple/30">
                <div className="flex items-center gap-2 mb-2">
                  <Link className="w-4 h-4 text-monokai-purple" />
                  <h4 className="font-medium text-monokai-purple text-sm">从URL导入</h4>
                </div>
                <p className="text-xs text-monokai-comment">
                  支持从任何公开的JSON文件URL导入技能。例如：raw GitHub文件、CDN托管的技能文件等。
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-monokai-fg mb-2">
                  技能文件 URL
                </label>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/skills/my-skill.json"
                  className="w-full px-3 py-2 bg-monokai-bg border border-monokai-accent rounded-lg text-sm text-monokai-fg focus:outline-none focus:ring-2 focus:ring-monokai-purple focus:border-transparent placeholder-monokai-comment"
                />
              </div>

              <button
                onClick={handleURLImport}
                disabled={isImporting || !urlInput.trim()}
                className={`w-full px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                  isImporting || !urlInput.trim()
                    ? 'bg-monokai-sidebar text-monokai-comment opacity-50 cursor-not-allowed'
                    : 'bg-monokai-purple text-white hover:opacity-90'
                }`}
              >
                {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <span>从URL导入</span>
              </button>

              {error && (
                <div className="p-3 bg-monokai-pink/10 border border-monokai-pink/30 rounded-lg text-monokai-pink text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 bg-monokai-green/10 border border-monokai-green/30 rounded-lg text-monokai-green text-sm">
                  {success}
                </div>
              )}
            </div>
          )}

          {/* GitHub Tab */}
          {activeTab === 'github' && (
            <div className="space-y-4">
              <div className="p-4 bg-monokai-sidebar rounded-lg border border-monokai-accent/50">
                <div className="flex items-center gap-2 mb-2">
                  <Github className="w-4 h-4 text-monokai-fg" />
                  <h4 className="font-medium text-monokai-fg text-sm">从GitHub Gist导入</h4>
                </div>
                <p className="text-xs text-monokai-comment">
                  从GitHub Gist导入技能。支持输入Gist ID或完整的Gist URL。
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-monokai-fg mb-2">
                  GitHub Gist ID 或 URL
                </label>
                <input
                  type="text"
                  value={githubInput}
                  onChange={(e) => setGithubInput(e.target.value)}
                  placeholder="e.g., 8f7a9b2c3d4e5f6a7b8c9d0e1f2a3b4c"
                  className="w-full px-3 py-2 bg-monokai-bg border border-monokai-accent rounded-lg text-sm text-monokai-fg focus:outline-none focus:ring-2 focus:ring-monokai-purple focus:border-transparent placeholder-monokai-comment"
                />
              </div>

              <button
                onClick={handleGitHubImport}
                disabled={isImporting || !githubInput.trim()}
                className={`w-full px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                  isImporting || !githubInput.trim()
                    ? 'bg-monokai-sidebar text-monokai-comment opacity-50 cursor-not-allowed'
                    : 'bg-monokai-fg text-monokai-bg hover:opacity-90'
                }`}
              >
                {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Github className="w-4 h-4" />}
                <span>从GitHub导入</span>
              </button>

              <div className="text-xs text-monokai-comment p-3 bg-monokai-sidebar rounded">
                <strong>提示：</strong> 可以在Gist中创建包含技能定义的JSON文件，系统会自动识别并导入。
              </div>

              {error && (
                <div className="p-3 bg-monokai-pink/10 border border-monokai-pink/30 rounded-lg text-monokai-pink text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 bg-monokai-green/10 border border-monokai-green/30 rounded-lg text-monokai-green text-sm">
                  {success}
                </div>
              )}
            </div>
          )}

          {/* Marketplace Tab */}
          {activeTab === 'marketplace' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={marketplaceQuery}
                  onChange={(e) => setMarketplaceQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchMarketplace()}
                  placeholder="搜索技能市场..."
                  className="flex-1 px-3 py-2 bg-monokai-bg border border-monokai-accent rounded-lg text-sm text-monokai-fg focus:outline-none focus:ring-2 focus:ring-monokai-purple focus:border-transparent placeholder-monokai-comment"
                />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value as SkillCategory | '')}
                  className="px-3 py-2 bg-monokai-bg border border-monokai-accent rounded-lg text-sm text-monokai-fg focus:outline-none focus:ring-2 focus:ring-monokai-purple"
                >
                  <option value="">全部分类</option>
                  <option value="sql">SQL</option>
                  <option value="analysis">分析</option>
                  <option value="transformation">转换</option>
                  <option value="optimization">优化</option>
                  <option value="utility">工具</option>
                </select>
                <button
                  onClick={handleSearchMarketplace}
                  disabled={isSearching || !marketplaceQuery.trim()}
                  className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                    isSearching || !marketplaceQuery.trim()
                      ? 'bg-monokai-sidebar text-monokai-comment opacity-50 cursor-not-allowed'
                      : 'bg-monokai-purple text-white hover:opacity-90'
                  }`}
                >
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </button>
              </div>

              {/* Results */}
              <div className="space-y-2 max-h-80 overflow-auto">
                {marketplaceResults.length > 0 ? (
                  marketplaceResults.map(skill => (
                    <div
                      key={skill.id}
                      className="p-4 bg-monokai-sidebar border border-monokai-accent/50 rounded-lg hover:border-monokai-purple/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-monokai-fg text-sm">{skill.name}</h4>
                          <p className="text-xs text-monokai-comment mt-1">{skill.description}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs px-2 py-1 bg-monokai-purple/20 text-monokai-purple rounded">
                              {skill.category}
                            </span>
                            <span className="text-xs text-monokai-comment">by {skill.author}</span>
                            <span className="text-xs text-monokai-comment">v{skill.version}</span>
                            <span className="text-xs text-monokai-yellow">★ {skill.rating}</span>
                            <span className="text-xs text-monokai-comment">↓ {skill.downloads}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleMarketplaceImport(skill)}
                          disabled={isImporting}
                          className="ml-4 px-3 py-1.5 bg-monokai-purple/20 text-monokai-purple rounded-lg hover:bg-monokai-purple/30 transition-colors text-sm flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          导入
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-monokai-comment">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-monokai-sidebar flex items-center justify-center">
                      <ShoppingCart className="w-8 h-8 text-monokai-purple" />
                    </div>
                    <p className="text-sm">输入关键词搜索技能市场</p>
                  </div>
                )}
              </div>

              {error && (
                <div className="p-3 bg-monokai-pink/10 border border-monokai-pink/30 rounded-lg text-monokai-pink text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 bg-monokai-green/10 border border-monokai-green/30 rounded-lg text-monokai-green text-sm">
                  {success}
                </div>
              )}
            </div>
          )}

          {/* Custom Tab */}
          {activeTab === 'custom' && (
            <div className="space-y-4">
              <div className="p-4 bg-monokai-purple/10 rounded-lg border border-monokai-purple/30">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-monokai-purple" />
                  <h4 className="font-medium text-monokai-purple text-sm">创建自定义技能</h4>
                </div>
                <p className="text-xs text-monokai-comment">
                  使用内置的编辑器创建您自己的AI技能。自定义技能可以保存到本地并在以后使用。
                </p>
              </div>

              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-monokai-sidebar flex items-center justify-center">
                  <Settings className="w-8 h-8 text-monokai-comment" />
                </div>
                <p className="text-monokai-comment">自定义技能编辑器开发中...</p>
                <p className="text-xs text-monokai-comment mt-2">请先使用JSON或文件方式导入技能</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-monokai-accent bg-monokai-sidebar/50 rounded-b-xl">
          <div className="flex justify-between items-center">
            <div className="text-xs text-monokai-comment flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-monokai-purple" />
              <span>提示: 导入的技能将保存到浏览器本地存储</span>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-monokai-sidebar border border-monokai-accent hover:bg-monokai-accent/20 text-monokai-fg rounded-lg transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkillImportModal;
