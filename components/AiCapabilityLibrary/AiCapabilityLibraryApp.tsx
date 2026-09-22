import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles, Wand2, ShieldCheck, Code, Play, Cpu, Zap, Search,
  AlertTriangle, BarChart2, Check, Copy, Plus, Edit3, Trash2, X, Save,
  RefreshCw, Layers, Download, Upload, CheckCircle2, Terminal,
  Tag
} from 'lucide-react';
import {
  AiCapabilityDefinition,
  getStoredAiCapabilities,
  saveStoredAiCapability,
  deleteStoredAiCapability,
  resetToSystemDefaultCapabilities,
  AI_CAPABILITIES_CHANGED_EVENT,
  AI_CAPABILITY_CATEGORIES,
  CapabilityCategoryKey
} from '../../services/aiCapabilitiesStorage';
import { toastService } from '../../services/toastService';
import { useAppStore } from '../../hooks/store/useAppStore';
import { Tab } from '../../types';
import { PageHeader, SearchInput, ActionButton } from '../ui/Workbench';
import { CodeHighlightBlock } from '../ui/CodeHighlightBlock';
import { duckDBService } from '../../services/duckdbService';
import { useConfirmDialog } from '../ui/ConfirmDialog';


interface AiCapabilityLibraryAppProps {
  isOpen?: boolean;
  onClose?: () => void;
  onExecuteCapabilityInEditor?: (capability: AiCapabilityDefinition) => void;
}

const CATEGORY_THEME: Record<string, {
  primary: string;
  text: string;
  bg: string;
  border: string;
  badgeBg: string;
  icon: React.ElementType;
}> = {
  generation: {
    primary: '#66d9ef',
    text: 'text-monokai-blue',
    bg: 'bg-monokai-blue/10',
    border: '',
    badgeBg: 'bg-monokai-blue/15 text-monokai-blue',
    icon: Zap,
  },
  diagnosis: {
    primary: '#ae81ff',
    text: 'text-monokai-amethyst',
    bg: 'bg-monokai-amethyst/10',
    border: '',
    badgeBg: 'bg-monokai-amethyst/15 text-monokai-amethyst',
    icon: AlertTriangle,
  },
  optimization: {
    primary: '#66d9ef',
    text: 'text-monokai-accent',
    bg: 'bg-monokai-accent/10',
    border: '',
    badgeBg: 'bg-monokai-accent/15 text-monokai-accent',
    icon: Wand2,
  },
  insight: {
    primary: '#ae81ff',
    text: 'text-monokai-amethyst',
    bg: 'bg-monokai-amethyst/10',
    border: '',
    badgeBg: 'bg-monokai-amethyst/15 text-monokai-amethyst',
    icon: BarChart2,
  },
  quality: {
    primary: '#66d9ef',
    text: 'text-monokai-accent',
    bg: 'bg-monokai-accent/10',
    border: '',
    badgeBg: 'bg-monokai-accent/15 text-monokai-accent',
    icon: ShieldCheck,
  },
  schema: {
    primary: '#ae81ff',
    text: 'text-monokai-amethyst',
    bg: 'bg-monokai-amethyst/10',
    border: '',
    badgeBg: 'bg-monokai-amethyst/15 text-monokai-amethyst',
    icon: Code,
  },
};

const PROMPT_VARIABLES = [
  { key: '{userPrompt}', label: '用户自然语言需求', desc: '用户在调用界面中补充的具体业务描述' },
  { key: '{schemaContext}', label: '数据库 Schema 上下文', desc: '自动注入当前激活表/全局表结构定义与列类型' },
  { key: '{currentSql}', label: '编辑器当前 SQL', desc: 'SQL 编辑器当前选区或当前活动 Tab 的 SQL 代码' },
  { key: '{errorMessage}', label: '运行时报错日志', desc: 'DuckDB 引擎抛出的错误堆栈或语法错误提示' },
  { key: '{sampleData}', label: '数据采样切片', desc: '当前查询结果或表的前 N 行预览样本' },
  { key: '{rowCount}', label: '结果行数统计', desc: '当前查询执行返回的总记录数' },
];

export const AiCapabilityLibraryApp: React.FC<AiCapabilityLibraryAppProps> = ({
  onExecuteCapabilityInEditor,
}) => {
  const { confirm } = useConfirmDialog();
  const [capabilities, setCapabilities] = useState<AiCapabilityDefinition[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedCapabilityId, setSelectedCapabilityId] = useState<string | null>(null);

  // Edit / Create Modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCap, setEditingCap] = useState<Partial<AiCapabilityDefinition>>({});
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reloadCapabilities = () => {
    setCapabilities(getStoredAiCapabilities());
  };

  useEffect(() => {
    reloadCapabilities();
    const handleChanged = () => reloadCapabilities();
    window.addEventListener(AI_CAPABILITIES_CHANGED_EVENT, handleChanged);
    return () => window.removeEventListener(AI_CAPABILITIES_CHANGED_EVENT, handleChanged);
  }, []);

  const filteredCapabilities = capabilities.filter((cap) => {
    let matchesCategory = false;
    if (selectedCategory === 'all') {
      matchesCategory = true;
    } else if (selectedCategory === 'custom_only') {
      matchesCategory = cap.isSystem === false;
    } else {
      matchesCategory = cap.category === selectedCategory;
    }

    const term = searchTerm.toLowerCase().trim();
    if (!term) return matchesCategory;

    const matchesSearch =
      cap.name.toLowerCase().includes(term) ||
      cap.description.toLowerCase().includes(term) ||
      (cap.purpose || '').toLowerCase().includes(term) ||
      (cap.tags || []).some(t => t.toLowerCase().includes(term));

    return matchesCategory && matchesSearch;
  });

  useEffect(() => {
    if (filteredCapabilities.some((cap) => cap.id === selectedCapabilityId)) return;
    setSelectedCapabilityId(filteredCapabilities[0]?.id ?? null);
  }, [filteredCapabilities, selectedCapabilityId]);

  const selectedCapability = filteredCapabilities.find((cap) => cap.id === selectedCapabilityId) ?? null;

  const handleCopyPrompt = (cap: AiCapabilityDefinition) => {
    navigator.clipboard.writeText(cap.promptTemplate);
    setCopiedId(cap.id);
    toastService.success(`已复制「${cap.name}」Prompt 模板`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyVariable = (varKey: string) => {
    navigator.clipboard.writeText(varKey);
    toastService.info(`已复制变量代币 ${varKey}`);
  };

  const handleInsertVariableInEditor = (varKey: string) => {
    const textarea = promptTextareaRef.current;
    if (!textarea) {
      setEditingCap(prev => ({
        ...prev,
        promptTemplate: `${prev.promptTemplate || ''} ${varKey}`,
      }));
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = editingCap.promptTemplate || '';
    const newText = currentText.substring(0, start) + varKey + currentText.substring(end);
    setEditingCap(prev => ({ ...prev, promptTemplate: newText }));
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + varKey.length, start + varKey.length);
    }, 50);
  };

  const handleOpenCreateModal = () => {
    setEditingCap({
      id: `cap_custom_${Date.now().toString(36)}`,
      name: '',
      category: 'generation',
      description: '',
      purpose: '指定该 AI 能力的业务解决场景...',
      inputRequirement: 'Schema 上下文 + 业务需求',
      outputRule: '输出可直接执行替换的 SQL 代码段',
      promptTemplate: '请为 DuckDB 生成 SQL:\n【需求描述】: {userPrompt}\n\n【表结构】:\n{schemaContext}',
      contextParams: ['Schema 上下文', '用户需求'],
      tags: ['自定义', 'AI能力'],
      isSystem: false,
    });
    setShowEditModal(true);
  };

  const handleOpenEditModal = (cap: AiCapabilityDefinition) => {
    setEditingCap({ ...cap });
    setShowEditModal(true);
  };

  const handleDuplicateCapability = (cap: AiCapabilityDefinition) => {
    const duplicatedCap: AiCapabilityDefinition = {
      ...cap,
      id: `${cap.id}_copy_${Date.now().toString(36).slice(-4)}`,
      name: `${cap.name} (副本)`,
      isSystem: false,
      createdAt: Date.now(),
    };
    saveStoredAiCapability(duplicatedCap);
    reloadCapabilities();
    setSelectedCapabilityId(duplicatedCap.id);
    toastService.success(`已复制创建新能力「${duplicatedCap.name}」`);
  };

  const handleSaveCapability = () => {
    if (!editingCap.name?.trim() || !editingCap.promptTemplate?.trim()) {
      toastService.warning('请填写能力名称和 Prompt 模板！');
      return;
    }
    const fullCap: AiCapabilityDefinition = {
      id: editingCap.id?.trim() || `cap_custom_${Date.now().toString(36)}`,
      name: editingCap.name.trim(),
      category: editingCap.category || 'generation',
      description: editingCap.description?.trim() || '',
      purpose: editingCap.purpose?.trim() || '通用 SQL/数据分析场景',
      inputRequirement: editingCap.inputRequirement?.trim() || 'Schema 上下文',
      outputRule: editingCap.outputRule?.trim() || '输出 SQL 代码或 Markdown 报告',
      promptTemplate: editingCap.promptTemplate.trim(),
      contextParams: editingCap.contextParams || ['Schema 上下文'],
      tags: editingCap.tags || ['自定义'],
      isSystem: editingCap.isSystem || false,
      createdAt: editingCap.createdAt || Date.now(),
    };

    saveStoredAiCapability(fullCap);
    reloadCapabilities();
    setSelectedCapabilityId(fullCap.id);
    setShowEditModal(false);
    toastService.success(`AI 能力「${fullCap.name}」已配置并成功保存！`);
  };

  const handleDeleteCapability = async (id: string) => {
    const ok = await confirm({
      title: '删除自定义 AI 能力',
      message: '确定要删除此自定义 AI 能力吗？此操作无法撤销。',
      variant: 'danger',
    });
    if (ok) {
      deleteStoredAiCapability(id);
      reloadCapabilities();
      toastService.info('已删除该自定义 AI 能力');
    }
  };

  const handleResetDefaults = async () => {
    const ok = await confirm({
      title: '恢复预设能力',
      message: '确定要重置并恢复系统内置预设 AI 能力吗？自定义添加的能力将被覆盖。',
      variant: 'warning',
    });
    if (ok) {
      resetToSystemDefaultCapabilities();
      reloadCapabilities();
      toastService.success('已成功重置为系统预设 AI 能力');
    }
  };

  const handleExportCapabilities = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(capabilities, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `duckdb_ai_capabilities_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toastService.success('AI 能力库已成功导出 JSON 配置文件');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (!Array.isArray(parsed)) {
          toastService.warning('导入失败：JSON 文件必须包含能力数组！');
          return;
        }
        let importedCount = 0;
        parsed.forEach((item) => {
          if (item && item.id && item.name && item.promptTemplate) {
            saveStoredAiCapability({
              ...item,
              isSystem: false,
              createdAt: Date.now(),
            });
            importedCount++;
          }
        });
        reloadCapabilities();
        toastService.success(`已成功导入 ${importedCount} 项自定义 AI 能力！`);
      } catch (err: any) {
        console.error(err);
        toastService.warning(`解析配置文件失败: ${err.message || err}`);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const categoryStats = {
    total: capabilities.length,
    generation: capabilities.filter(c => c.category === 'generation' || c.category === 'optimization').length,
    diagnosis: capabilities.filter(c => c.category === 'diagnosis' || c.category === 'quality').length,
    insights: capabilities.filter(c => c.category === 'insight' || c.category === 'schema').length,
    custom: capabilities.filter(c => !c.isSystem).length,
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-monokai-bg font-sans text-monokai-fg">
      {/* Hidden File Input for JSON import */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".json"
        onChange={handleImportFile}
        className="hidden"
      />

      {/* Standard Page Header */}
      <PageHeader
        title="AI 能力库 (Capability Hub)"
        description="沉淀、检索与调用专精 AI 提示词与工程策略，支持一键调起并带入 DuckDB SQL 编辑器"
        icon={Cpu}
        badge={
          <span className="rounded bg-monokai-surface px-2 py-0.5 text-[10px] font-mono font-medium text-monokai-comment border border-monokai-border">
            {capabilities.length} 项已就绪
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <ActionButton
              variant="secondary"
              size="md"
              icon={Download}
              onClick={handleExportCapabilities}
              title="导出全部能力配置为 JSON 文件"
            >
              <span className="hidden md:inline">导出配置</span>
            </ActionButton>

            <ActionButton
              variant="secondary"
              size="md"
              icon={Upload}
              onClick={() => fileInputRef.current?.click()}
              title="从 JSON 文件导入能力配置"
            >
              <span className="hidden md:inline">导入配置</span>
            </ActionButton>

            <ActionButton
              variant="ghost"
              size="md"
              icon={RefreshCw}
              onClick={handleResetDefaults}
              title="恢复系统内置预设能力"
            >
              <span className="hidden md:inline">重置预设</span>
            </ActionButton>

            <ActionButton
              variant="primary"
              size="md"
              icon={Plus}
              onClick={handleOpenCreateModal}
            >
              新建 AI 能力
            </ActionButton>
          </div>
        }
      />

      {/* Main Workspace Body */}
      <div className="flex flex-1 flex-col overflow-hidden p-3 sm:p-4 gap-3">
        {/* Quick Overview Stat Cards */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 shrink-0">
          <div className="flex items-center justify-between rounded-md border border-monokai-border bg-monokai-surface p-3 shadow-xs">
            <div>
              <div className="text-[11px] font-medium text-monokai-comment">注册能力总数</div>
              <div className="mt-1 font-mono text-xl font-bold text-monokai-fg">{categoryStats.total}</div>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-monokai-sidebar border border-monokai-border text-monokai-comment">
              <Layers className="h-4 w-4" />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-monokai-border bg-monokai-surface p-3 shadow-xs">
            <div>
              <div className="text-[11px] font-medium text-monokai-comment">代码生成与性能</div>
              <div className="mt-1 font-mono text-xl font-bold text-monokai-fg">{categoryStats.generation}</div>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-monokai-sidebar border border-monokai-border text-monokai-comment">
              <Zap className="h-4 w-4" />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-monokai-border bg-monokai-surface p-3 shadow-xs">
            <div>
              <div className="text-[11px] font-medium text-monokai-comment">诊断与质量审计</div>
              <div className="mt-1 font-mono text-xl font-bold text-monokai-fg">{categoryStats.diagnosis}</div>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-monokai-sidebar border border-monokai-border text-monokai-comment">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-monokai-border bg-monokai-surface p-3 shadow-xs">
            <div>
              <div className="text-[11px] font-medium text-monokai-comment">商业洞察与模型</div>
              <div className="mt-1 font-mono text-xl font-bold text-monokai-fg">{categoryStats.insights}</div>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-monokai-sidebar border border-monokai-border text-monokai-comment">
              <BarChart2 className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
          <div className="flex flex-wrap items-center gap-1 rounded-md border border-monokai-border bg-monokai-surface p-1">
            {[
              { key: 'all', label: '全部能力', count: capabilities.length },
              ...AI_CAPABILITY_CATEGORIES.map(c => ({
                key: c.key,
                label: c.label,
                count: capabilities.filter(item => item.category === c.key).length,
              })),
              { key: 'custom_only', label: '自定义能力', count: capabilities.filter(item => !item.isSystem).length }
            ].map((cat) => {
              const isSelected = selectedCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setSelectedCategory(cat.key)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-monokai-elevated text-monokai-fg font-bold shadow-xs'
                      : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-sidebar/50'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                    isSelected ? 'bg-monokai-surface text-monokai-fg' : 'bg-monokai-bg text-monokai-comment'
                  }`}>
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-72 shrink-0">
            <Search className="absolute left-3 top-2 h-3.5 w-3.5 text-monokai-comment" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索能力名称、场景、标签或 Prompt..."
              className="w-full h-8 rounded-md bg-monokai-surface border border-monokai-border pl-8 pr-8 text-xs text-monokai-fg placeholder-monokai-comment/50 outline-none focus:border-monokai-fg/40 transition-colors font-sans"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2 text-monokai-comment hover:text-monokai-fg cursor-pointer"
                title="清空搜索"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Master-Detail Split Workspace */}
        <div className="grid flex-1 min-h-0 grid-cols-1 gap-3 lg:grid-cols-[300px_minmax(0,1fr)] overflow-hidden">
          {/* Left Column: Capability List */}
          <div className="flex flex-col rounded-md border border-monokai-border bg-monokai-surface overflow-hidden">
            <div className="bg-monokai-sidebar/50 px-3 py-2 text-[11px] font-medium text-monokai-comment flex items-center justify-between border-b border-monokai-border">
              <span>匹配能力列表 ({filteredCapabilities.length})</span>
              <span className="font-mono text-[10px]">点击查看详情</span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5 space-y-1" role="listbox" aria-label="AI 能力列表">
              {filteredCapabilities.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-monokai-comment">
                  <Cpu className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-xs">未找到符合条件的能力</p>
                  <button
                    type="button"
                    onClick={() => { setSearchTerm(''); setSelectedCategory('all'); }}
                    className="mt-2 text-xs text-monokai-comment hover:text-monokai-fg hover:underline cursor-pointer"
                  >
                    重置筛选条件
                  </button>
                </div>
              ) : (
                filteredCapabilities.map((cap) => {
                  const theme = CATEGORY_THEME[cap.category] || CATEGORY_THEME.schema;
                  const isSelected = selectedCapabilityId === cap.id;
                  const CategoryIcon = theme.icon;

                  return (
                    <button
                      type="button"
                      key={cap.id}
                      onClick={() => setSelectedCapabilityId(cap.id)}
                      className={`group w-full rounded-md p-2.5 text-left transition-all relative cursor-pointer ${
                        isSelected
                          ? 'bg-monokai-elevated text-monokai-fg shadow-xs font-semibold'
                          : 'hover:bg-monokai-surface text-monokai-comment'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded ${theme.bg} ${theme.text}`}>
                          <CategoryIcon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className={`truncate text-xs font-semibold ${isSelected ? 'text-monokai-fg' : 'text-monokai-fg/90'}`}>
                              {cap.name}
                            </span>
                            {cap.isSystem ? (
                              <span className="shrink-0 rounded bg-monokai-green/10 px-1.5 py-0.2 text-[9px] font-medium text-monokai-green">
                                预设
                              </span>
                            ) : (
                              <span className="shrink-0 rounded bg-monokai-yellow/10 px-1.5 py-0.2 text-[9px] font-medium text-monokai-yellow">
                                自定义
                              </span>
                            )}
                          </div>
                          <p className="mt-1 line-clamp-2 text-[11px] text-monokai-comment leading-relaxed">
                            {cap.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Selected Capability Detail Inspector */}
          <div className="flex flex-col rounded-md border border-monokai-border bg-monokai-surface overflow-hidden">
            {selectedCapability ? (
              <div className="flex flex-1 flex-col overflow-y-auto custom-scrollbar p-4 sm:p-5 gap-4">
                {/* Header Banner of Selected Capability */}
                {(() => {
                  const theme = CATEGORY_THEME[selectedCapability.category] || CATEGORY_THEME.schema;
                  const catMeta = AI_CAPABILITY_CATEGORIES.find(c => c.key === selectedCapability.category);
                  const CategoryIcon = theme.icon;

                  return (
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-monokai-border">
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${theme.bg} ${theme.text}`}>
                          <CategoryIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-base font-bold text-monokai-fg">
                              {selectedCapability.name}
                            </h2>
                            <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium ${theme.badgeBg}`}>
                              <span>{catMeta?.label || selectedCapability.category}</span>
                            </span>
                            {selectedCapability.isSystem ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-monokai-green/10 px-2 py-0.5 text-[10px] font-medium text-monokai-green">
                                <CheckCircle2 className="h-3 w-3" /> 系统内置
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md bg-monokai-yellow/10 px-2 py-0.5 text-[10px] font-medium text-monokai-yellow">
                                自定义
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-monokai-comment leading-relaxed">
                            {selectedCapability.description}
                          </p>
                        </div>
                      </div>

                      {/* Top Action Buttons for this Capability */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0 self-end sm:self-start">
                        <button
                          type="button"
                          onClick={() => handleCopyPrompt(selectedCapability)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-monokai-border bg-monokai-elevated px-2.5 text-xs font-medium text-monokai-fg hover:bg-monokai-hover transition-colors cursor-pointer"
                          title="复制提示词模板"
                        >
                          {copiedId === selectedCapability.id ? (
                            <Check className="h-3.5 w-3.5 text-monokai-green" />
                          ) : (
                            <Copy className="h-3.5 w-3.5 text-monokai-comment" />
                          )}
                          <span>{copiedId === selectedCapability.id ? '已复制' : '复制 Prompt'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDuplicateCapability(selectedCapability)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-monokai-border bg-monokai-elevated px-2.5 text-xs font-medium text-monokai-fg hover:bg-monokai-hover transition-colors cursor-pointer"
                          title="克隆此能力为自定义副本"
                        >
                          <Copy className="h-3.5 w-3.5 text-monokai-comment" />
                          <span>克隆副本</span>
                        </button>

                        {!selectedCapability.isSystem && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(selectedCapability)}
                              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-monokai-border bg-monokai-elevated px-2.5 text-xs font-medium text-monokai-fg hover:bg-monokai-hover transition-colors cursor-pointer"
                              title="编辑能力定义"
                            >
                              <Edit3 className="h-3.5 w-3.5 text-monokai-comment" />
                              <span>编辑</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteCapability(selectedCapability.id)}
                              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-monokai-border bg-monokai-elevated px-2.5 text-xs font-medium text-monokai-pink hover:bg-monokai-hover transition-colors cursor-pointer"
                              title="删除此自定义能力"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>删除</span>
                            </button>
                          </>
                        )}

                        {onExecuteCapabilityInEditor && (
                          <button
                            type="button"
                            onClick={async () => {
                              let populatedPrompt = selectedCapability.promptTemplate;
                              if (populatedPrompt.includes('{schemaContext}')) {
                                try {
                                  const schemaMap = await duckDBService.getSchemaContext();
                                  const schemaText = Object.entries(schemaMap)
                                    .map(([tbl, cols]) => `${tbl}(${cols.map(c => `${c.name}: ${c.type}`).join(', ')})`)
                                    .join('\n');
                                  populatedPrompt = populatedPrompt.replace(/\{schemaContext\}/g, schemaText || '暂无数据表');
                                } catch {}
                              }
                              useAppStore.getState().setActiveTab(Tab.SQL);
                              onExecuteCapabilityInEditor({
                                ...selectedCapability,
                                promptTemplate: populatedPrompt,
                              });
                              toastService.info(`已自动切回 SQL 编辑器并关联调起「${selectedCapability.name}」`);
                            }}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-monokai-green px-3.5 text-xs font-semibold text-monokai-bg hover:bg-monokai-green/90 transition-all cursor-pointer"
                          >
                            <Play className="h-3.5 w-3.5 fill-current" />
                            <span>在 SQL 编辑器中运行</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Metadata & Specification Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-md border border-monokai-border bg-monokai-bg p-3.5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1.5">
                        <Wand2 className="h-3.5 w-3.5 text-monokai-comment" />
                        <span>适用场景与用途</span>
                      </div>
                      <p className="text-xs text-monokai-fg/90 leading-relaxed">
                        {selectedCapability.purpose || selectedCapability.description}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-md border border-monokai-border bg-monokai-bg p-3.5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1.5">
                        <Terminal className="h-3.5 w-3.5 text-monokai-comment" />
                        <span>输入要求 / 上下文</span>
                      </div>
                      <p className="text-xs text-monokai-fg/90 leading-relaxed">
                        {selectedCapability.inputRequirement || (selectedCapability.contextParams || []).join(', ')}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-md border border-monokai-border bg-monokai-bg p-3.5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-monokai-comment" />
                        <span>输出交付规则</span>
                      </div>
                      <p className="text-xs text-monokai-fg/90 leading-relaxed">
                        {selectedCapability.outputRule || '输出可直接执行的 SQL 代码段或 Markdown 结构化分析'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Prompt Template Code Block Inspector */}
                <div className="rounded-md border border-monokai-border bg-monokai-bg overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between border-b border-monokai-border bg-monokai-sidebar/70 px-3.5 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full bg-monokai-comment" />
                        <div className="h-2.5 w-2.5 rounded-full bg-monokai-comment/60" />
                        <div className="h-2.5 w-2.5 rounded-full bg-monokai-comment/40" />
                      </div>
                      <span className="text-xs font-semibold text-monokai-fg ml-1">
                        提示词模板 (Prompt Template)
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[10px] text-monokai-comment">
                        ID: {selectedCapability.id}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyPrompt(selectedCapability)}
                        className="inline-flex items-center gap-1 text-[11px] text-monokai-fg-muted hover:text-monokai-accent hover:underline font-medium cursor-pointer"
                      >
                        {copiedId === selectedCapability.id ? (
                          <>
                            <Check className="h-3 w-3 text-monokai-green" />
                            <span className="text-monokai-green">已复制</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>复制模板</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Variable helper ribbon */}
                  <div className="border-b border-monokai-border/60 bg-monokai-surface/60 px-3.5 py-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="text-monokai-comment text-[10px] font-medium mr-1">支持变量注入 (点击复制):</span>
                    {PROMPT_VARIABLES.map((v) => (
                      <button
                        type="button"
                        key={v.key}
                        onClick={() => handleCopyVariable(v.key)}
                        className="rounded border border-monokai-border bg-monokai-sidebar px-1.5 py-0.5 font-mono text-[10px] text-monokai-fg-muted hover:text-monokai-accent hover:border-monokai-accent transition-colors cursor-pointer"
                        title={`${v.label}: ${v.desc}`}
                      >
                        {v.key}
                      </button>
                    ))}
                  </div>

                  <div className="p-2 bg-monokai-bg">
                    <CodeHighlightBlock
                      code={selectedCapability.promptTemplate}
                      language="markdown"
                      title="PROMPT TEMPLATE"
                      maxHeight="280px"
                      onCopy={() => handleCopyPrompt(selectedCapability)}
                    />
                  </div>
                </div>

                {/* Tags and Meta */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-monokai-border">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-monokai-comment flex items-center gap-1">
                      <Tag className="h-3 w-3" /> 标签:
                    </span>
                    {(selectedCapability.tags || []).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md border border-monokai-border bg-monokai-sidebar px-2 py-0.5 text-[10px] font-mono text-monokai-comment"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>

                  <div className="text-[11px] font-mono text-monokai-comment">
                    {selectedCapability.createdAt
                      ? `更新于 ${new Date(selectedCapability.createdAt).toLocaleDateString()}`
                      : '系统内置预设标准'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center p-8 text-monokai-comment">
                <p className="text-xs">请在左侧列表选择一项 AI 能力查看详情</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create / Edit Capability Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="flex flex-col max-h-[90vh] w-full max-w-2xl rounded-md border border-monokai-border bg-monokai-sidebar text-monokai-fg shadow-2xl overflow-hidden font-sans">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-monokai-border px-5 py-3.5 bg-monokai-surface">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-monokai-comment" />
                <h3 className="text-sm font-bold text-monokai-fg">
                  {editingCap.isSystem ? '查看系统预设 AI 能力定义' : editingCap.createdAt ? '编辑 AI 能力配置' : '新建自定义 AI 能力'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="text-monokai-comment hover:text-monokai-pink transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Form Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-monokai-comment font-semibold mb-1">能力名称 (*):</label>
                  <input
                    type="text"
                    value={editingCap.name || ''}
                    onChange={(e) => setEditingCap({ ...editingCap, name: e.target.value })}
                    placeholder="例如: 智能生成 GROUP BY 报表 SQL"
                    className="w-full rounded-md border border-monokai-border bg-monokai-bg px-3 py-1.5 text-xs text-monokai-fg outline-none focus:border-monokai-fg/40 font-sans"
                  />
                </div>

                <div>
                  <label className="block text-monokai-comment font-semibold mb-1">唯一标识符 (ID):</label>
                  <input
                    type="text"
                    value={editingCap.id || ''}
                    onChange={(e) => setEditingCap({ ...editingCap, id: e.target.value })}
                    placeholder="cap_group_by_report"
                    className="w-full rounded-md border border-monokai-border bg-monokai-bg px-3 py-1.5 text-xs text-monokai-fg outline-none focus:border-monokai-fg/40 font-mono"
                    disabled={!!editingCap.isSystem}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-monokai-comment font-semibold mb-1">能力分类:</label>
                  <select
                    value={editingCap.category || 'generation'}
                    onChange={(e) => setEditingCap({ ...editingCap, category: e.target.value as CapabilityCategoryKey })}
                    className="w-full rounded-md border border-monokai-border bg-monokai-bg px-3 py-1.5 text-xs text-monokai-fg outline-none focus:border-monokai-fg/40 font-sans"
                  >
                    <option value="generation">⚡ SQL 生成与转换 (generation)</option>
                    <option value="diagnosis">🔍 错误诊断与修复 (diagnosis)</option>
                    <option value="optimization">🚀 性能重构与向量化 (optimization)</option>
                    <option value="insight">📊 数据与结果洞察 (insight)</option>
                    <option value="quality">🛡️ 数据质量审计 (quality)</option>
                    <option value="schema">📐 Schema 模型演进 (schema)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-monokai-comment font-semibold mb-1">标签 (逗号分隔):</label>
                  <input
                    type="text"
                    value={(editingCap.tags || []).join(', ')}
                    onChange={(e) => setEditingCap({ ...editingCap, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                    placeholder="报表, 聚合, SQL"
                    className="w-full rounded-md border border-monokai-border bg-monokai-bg px-3 py-1.5 text-xs text-monokai-fg outline-none focus:border-monokai-fg/40 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-monokai-comment font-semibold mb-1">能力简短说明:</label>
                <input
                  type="text"
                  value={editingCap.description || ''}
                  onChange={(e) => setEditingCap({ ...editingCap, description: e.target.value })}
                  placeholder="简要描述该能力的功能与输出..."
                  className="w-full rounded-md border border-monokai-border bg-monokai-bg px-3 py-1.5 text-xs text-monokai-fg outline-none focus:border-monokai-fg/40"
                />
              </div>

              <div>
                <label className="block text-monokai-comment font-semibold mb-1">适用用途与场景 (Purpose):</label>
                <input
                  type="text"
                  value={editingCap.purpose || ''}
                  onChange={(e) => setEditingCap({ ...editingCap, purpose: e.target.value })}
                  placeholder="例如：从自然语言快速转译为 DuckDB 方言 SQL"
                  className="w-full rounded-md border border-monokai-border bg-monokai-bg px-3 py-1.5 text-xs text-monokai-fg outline-none focus:border-monokai-fg/40"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-monokai-comment font-semibold mb-1">输入要求描述:</label>
                  <input
                    type="text"
                    value={editingCap.inputRequirement || ''}
                    onChange={(e) => setEditingCap({ ...editingCap, inputRequirement: e.target.value })}
                    placeholder="Schema 上下文 + 用户需求"
                    className="w-full rounded-md border border-monokai-border bg-monokai-bg px-3 py-1.5 text-xs text-monokai-fg outline-none focus:border-monokai-fg/40"
                  />
                </div>
                <div>
                  <label className="block text-monokai-comment font-semibold mb-1">输出交付规则:</label>
                  <input
                    type="text"
                    value={editingCap.outputRule || ''}
                    onChange={(e) => setEditingCap({ ...editingCap, outputRule: e.target.value })}
                    placeholder="输出可替换的 SQL 代码段"
                    className="w-full rounded-md border border-monokai-border bg-monokai-bg px-3 py-1.5 text-xs text-monokai-fg outline-none focus:border-monokai-fg/40"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-monokai-comment font-semibold">
                    提示词模板 (*) (点击下方变量可快捷插入到光标处):
                  </label>
                </div>

                {/* Variable insertion buttons */}
                <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                  {PROMPT_VARIABLES.map((v) => (
                    <button
                      type="button"
                      key={v.key}
                      onClick={() => handleInsertVariableInEditor(v.key)}
                      className="rounded border border-monokai-border bg-monokai-bg px-1.5 py-0.5 font-mono text-[10px] text-monokai-fg-muted hover:text-monokai-fg hover:border-monokai-border-strong transition-colors cursor-pointer"
                      title={v.desc}
                    >
                      + {v.key}
                    </button>
                  ))}
                </div>

                <textarea
                  ref={promptTextareaRef}
                  rows={6}
                  value={editingCap.promptTemplate || ''}
                  onChange={(e) => setEditingCap({ ...editingCap, promptTemplate: e.target.value })}
                  placeholder="请为 DuckDB 生成 SQL:&#10;【需求】: {userPrompt}&#10;&#10;【表结构】:&#10;{schemaContext}"
                  className="w-full rounded-md border border-monokai-border bg-monokai-bg p-3 text-xs font-mono text-monokai-fg outline-none focus:border-monokai-fg/40 custom-scrollbar"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-monokai-border px-5 py-3 bg-monokai-surface">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="inline-flex h-8 items-center justify-center rounded-md border border-monokai-border bg-monokai-elevated px-4 text-xs font-medium text-monokai-fg hover:bg-monokai-hover transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveCapability}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-monokai-green text-monokai-bg hover:bg-monokai-green/90 px-4 text-xs font-semibold shadow-xs transition-all cursor-pointer"
              >
                <Save className="h-3.5 w-3.5" />
                <span>保存能力配置</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
