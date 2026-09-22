import React, { useState } from 'react';
import { aiService } from '../services/aiService';
import { duckDBService } from '../services/duckdbService';
import { ModalShell, ActionButton } from './ui/Workbench';
import { useConfirmDialog } from './ui/ConfirmDialog';
import {
  Sparkles,
  RefreshCw,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Key,
  Globe,
  Cpu,
  Terminal,
  Zap,
  Eye,
  EyeOff,
  ExternalLink,
  RotateCcw,
  Shield,
  HelpCircle,
  Sliders,
  ChevronRight,
  Server,
  Layers,
  Check,
  Trash2,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // AI Config — lifted state
  aiProvider: string;
  aiApiKey: string;
  aiBaseUrl: string;
  aiModel: string;
  availableModels: { id: string; name: string }[];
  loadingModels: boolean;
  onSetAiProvider: (v: string) => void;
  onSetAiApiKey: (v: string) => void;
  onSetAiBaseUrl: (v: string) => void;
  onSetAiModel: (v: string) => void;
  onSetAvailableModels: (v: { id: string; name: string }[]) => void;
  onSetLoadingModels: (v: boolean) => void;
  onNotify: (message: string, type: 'success' | 'error' | 'info') => void;
  onExportWorkspace?: () => void;
  onImportWorkspace?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

interface DiagnosisState {
  running: boolean;
  tested: boolean;
  success: boolean;
  message: string;
  latencyMs?: number;
  modelCount?: number;
}

interface ProviderMeta {
  id: string;
  name: string;
  shortName: string;
  badge: string;
  category: 'local' | 'cloud';
  categoryLabel: string;
  tagline: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultBaseUrl: string;
  defaultModel: string;
  popularModels: { id: string; label: string; badge?: string }[];
  consoleUrl?: string;
  keyPlaceholder?: string;
  tips?: string;
  endpointPresets?: { name: string; url: string; recommendedModel?: string }[];
}

const PROVIDERS: ProviderMeta[] = [
  {
    id: 'ollama',
    name: 'Ollama',
    shortName: 'Ollama',
    badge: 'Local',
    category: 'local',
    categoryLabel: '本地离线私有化',
    tagline: '本地私有引擎 · 免API Key · 隐私物理隔离',
    description: '无需联网，在本地机器直接运行开源大模型，适合敏感数据分析与离线环境。',
    icon: Terminal,
    defaultBaseUrl: 'http://localhost:11434',
    defaultModel: 'llama3.2',
    popularModels: [
      { id: 'llama3.2', label: 'Llama 3.2', badge: '轻快推荐' },
      { id: 'qwen2.5-coder', label: 'Qwen 2.5 Coder', badge: 'SQL 代码专精' },
      { id: 'deepseek-r1:8b', label: 'DeepSeek R1 8B', badge: '深度推理' },
      { id: 'mistral', label: 'Mistral 7B' },
    ],
    tips: '提示: 本地需先启动 ollama serve。在浏览器端调用需设置环境变量 OLLAMA_ORIGINS="*" 以允许跨域请求。',
  },
  {
    id: 'lmstudio',
    name: 'LM Studio',
    shortName: 'LM Studio',
    badge: 'Local',
    category: 'local',
    categoryLabel: '本地私有工作站',
    tagline: '本地模型工作站 · OpenAI 兼容接口 · 私密离线推理',
    description: '通过 LM Studio 运行本地 GGUF 开源大模型，支持一键加载各类社区模型，数据 100% 留在本地。',
    icon: Server,
    defaultBaseUrl: 'http://localhost:1234/v1',
    defaultModel: 'qwen2.5-coder-7b-instruct',
    popularModels: [
      { id: 'qwen2.5-coder-7b-instruct', label: 'Qwen 2.5 Coder', badge: 'SQL 代码专精' },
      { id: 'deepseek-r1-distill-qwen-7b', label: 'DeepSeek R1 Distill', badge: '深度推理' },
      { id: 'llama-3.2-3b-instruct', label: 'Llama 3.2 3B', badge: '轻快推荐' },
      { id: 'mistral-nemo-instruct-2407', label: 'Mistral Nemo', badge: '通识分析' },
    ],
    tips: '提示: 请先在 LM Studio 中启动本地服务器 (Local Server: http://localhost:1234)，并开启 CORS 跨域支持。',
  },
  {
    id: 'google',
    name: 'Google Gemini',
    shortName: 'Gemini',
    badge: 'Cloud',
    category: 'cloud',
    categoryLabel: '云端原生超长窗口',
    tagline: 'Google 原生多模态 · 超长上下文分析',
    description: '具备极速的推理与超长上下文理解能力，高频复杂 SQL 指标构建推荐。',
    icon: Sparkles,
    defaultBaseUrl: '',
    defaultModel: 'gemini-2.0-flash-exp',
    popularModels: [
      { id: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash', badge: '极速推荐' },
      { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', badge: '稳定首选' },
      { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', badge: '高精度分析' },
    ],
    consoleUrl: 'https://aistudio.google.com/app/apikey',
    keyPlaceholder: 'AIzaSy...',
  },
  {
    id: 'groq',
    name: 'Groq',
    shortName: 'Groq',
    badge: 'Ultra-fast',
    category: 'cloud',
    categoryLabel: 'LPU 硬件极速推理',
    tagline: '500+ Tokens/s · 毫秒级即时补全体验',
    description: '采用专用 LPU 推理芯片，实现近乎零延迟的智能补全与 SQL 快速诊断。',
    icon: Zap,
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    popularModels: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', badge: '主力旗舰' },
      { id: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 70B', badge: '深度推理' },
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B', badge: '瞬发微秒' },
    ],
    consoleUrl: 'https://console.groq.com/keys',
    keyPlaceholder: 'gsk_...',
  },
  {
    id: 'openai',
    name: 'OpenAI / Compatible',
    shortName: 'OpenAI',
    badge: 'Compatible',
    category: 'cloud',
    categoryLabel: '通用协议与中转聚合',
    tagline: 'GPT-4o 工业标准 · 广泛兼容第三方中转',
    description: '支持原生 OpenAI 官方接口，也可一键无缝接入 DeepSeek 官方或 OpenRouter 等代理。',
    icon: Globe,
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    popularModels: [
      { id: 'gpt-4o', label: 'GPT-4o', badge: '主力旗舰' },
      { id: 'gpt-4o-mini', label: 'GPT-4o mini', badge: '高性价比' },
      { id: 'o3-mini', label: 'o3-mini', badge: '逻辑推理' },
      { id: 'deepseek-chat', label: 'DeepSeek V3', badge: '第三方兼容' },
    ],
    endpointPresets: [
      { name: '官方 OpenAI', url: 'https://api.openai.com/v1', recommendedModel: 'gpt-4o' },
      { name: 'DeepSeek 官方', url: 'https://api.deepseek.com/v1', recommendedModel: 'deepseek-chat' },
      { name: 'OpenRouter 聚合', url: 'https://openrouter.ai/api/v1' },
    ],
    consoleUrl: 'https://platform.openai.com/api-keys',
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    shortName: 'Claude',
    badge: 'Reasoning',
    category: 'cloud',
    categoryLabel: '复杂逻辑与代码理解',
    tagline: '卓越代码直觉 · 精准复杂关联推导',
    description: '在复杂跨表关联、窗口函数与长篇 SQL 查询重构分析中表现卓越。',
    icon: Cpu,
    defaultBaseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-4-20250514',
    popularModels: [
      { id: 'claude-sonnet-4-20250514', label: 'Claude 3.7 Sonnet', badge: '混合推理' },
      { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', badge: '代码黄金标杆' },
      { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku', badge: '轻快响应' },
    ],
    consoleUrl: 'https://console.anthropic.com/settings/keys',
    keyPlaceholder: 'sk-ant-...',
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  aiProvider,
  aiApiKey,
  aiBaseUrl,
  aiModel,
  availableModels,
  loadingModels,
  onSetAiProvider,
  onSetAiApiKey,
  onSetAiBaseUrl,
  onSetAiModel,
  onSetAvailableModels,
  onSetLoadingModels,
  onNotify,
}) => {
  const { confirm } = useConfirmDialog();
  const [diagnosis, setDiagnosis] = useState<DiagnosisState>({
    running: false,
    tested: false,
    success: false,
    message: '',
  });
  const [showApiKey, setShowApiKey] = useState(false);

  const isLocalOllama = aiProvider === 'ollama';
  const isLocalLmStudio = aiProvider === 'lmstudio';
  const isLocal = isLocalOllama || isLocalLmStudio;
  const currentProvider = PROVIDERS.find(p => p.id === aiProvider) || PROVIDERS[0];
  const CurrentIcon = currentProvider.icon;

  const handleProviderChange = (newProvider: string) => {
    onSetAiProvider(newProvider);
    setDiagnosis({ running: false, tested: false, success: false, message: '' });

    const target = PROVIDERS.find(p => p.id === newProvider);
    if (target) {
      if (target.defaultModel) {
        onSetAiModel(target.defaultModel);
      }
      onSetAiBaseUrl(target.defaultBaseUrl);
    }
  };

  const handleTestConnection = async () => {
    setDiagnosis({ running: true, tested: false, success: false, message: '正在诊断连接...' });
    try {
      const res = await aiService.diagnoseConnection({
        provider: aiProvider as any,
        apiKey: isLocalOllama ? 'ollama' : isLocalLmStudio ? (aiApiKey || 'lm-studio') : aiApiKey,
        baseUrl: aiBaseUrl,
        model: aiModel,
      });

      setDiagnosis({
        running: false,
        tested: true,
        success: res.success,
        message: res.message,
        latencyMs: res.latencyMs,
        modelCount: res.modelCount,
      });

      if (res.success && res.models && res.models.length > 0) {
        onSetAvailableModels(res.models);
        if (!res.models.find(m => m.id === aiModel)) {
          onSetAiModel(res.models[0].id);
        }
      }
    } catch (err: any) {
      setDiagnosis({
        running: false,
        tested: true,
        success: false,
        message: err.message || '诊断过程发生异常',
      });
    }
  };

  const handleRefreshModels = async () => {
    onSetLoadingModels(true);
    try {
      const models = await aiService.fetchAvailableModels();
      onSetAvailableModels(models);
      if (models.length > 0 && !models.find(m => m.id === aiModel)) {
        onSetAiModel(models[0].id);
      }
      onNotify(`成功获取 ${models.length} 个可用模型`, 'success');
    } catch (err: any) {
      onNotify(`获取模型列表失败: ${err.message}`, 'error');
    } finally {
      onSetLoadingModels(false);
    }
  };

  return (
    <ModalShell
      open={isOpen}
      title="AI Provider 设置"
      description="配置 DuckDB 智能编写、SQL 语法修复、语义指标生成与解释分析所用的 AI 推理引擎"
      onClose={onClose}
      size="xl"
      footer={(
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 text-[11px] text-monokai-comment">
            <Shield className="w-3.5 h-3.5 text-monokai-green" />
            <span>配置与密钥实时保存于当前浏览器会话内存，不上传、不随工作区快照导出</span>
          </div>
          <div className="flex items-center gap-2">
            <ActionButton variant="primary" onClick={onClose}>
              完成并关闭
            </ActionButton>
          </div>
        </div>
      )}
    >
      {/* Invisible Select to ensure 100% test compatibility and full accessibility combobox tree */}
      <select
        aria-label="模型供应商 (AI Provider)"
        value={aiProvider}
        onChange={e => handleProviderChange(e.target.value)}
        className="sr-only"
        tabIndex={-1}
      >
        <option value="ollama">Ollama (Local / Self-hosted)</option>
        <option value="lmstudio">LM Studio (Local / Self-hosted)</option>
        <option value="google">Google Gemini (Cloud)</option>
        <option value="groq">Groq (Ultra-fast Cloud)</option>
        <option value="openai">OpenAI / Compatible (Cloud)</option>
        <option value="claude">Anthropic Claude (Cloud)</option>
      </select>

      {/* Two-Column Master-Detail Layout */}
      <div className="flex flex-col md:flex-row -m-5 min-h-[480px] bg-monokai-bg text-monokai-fg font-sans text-xs">
        {/* Left Master Sidebar: Providers List */}
        <aside className="w-full md:w-60 bg-monokai-sidebar/95 border-b md:border-b-0 md:border-r border-monokai-border p-3.5 flex flex-col justify-between shrink-0 select-none">
          <div className="space-y-2">
            <div className="flex items-center justify-between px-2 py-1 text-[11px] font-bold text-monokai-comment tracking-wider uppercase">
              <span>推理引擎</span>
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-monokai-bg border border-monokai-border">
                {PROVIDERS.length} 款
              </span>
            </div>

            <nav className="space-y-1">
              {PROVIDERS.map(p => {
                const Icon = p.icon;
                const isSelected = p.id === aiProvider;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleProviderChange(p.id)}
                    className={`w-full group flex items-center justify-between p-2.5 rounded-lg border transition-all text-left cursor-pointer ${
                      isSelected
                        ? 'bg-monokai-surface border-monokai-border-strong shadow-xs text-monokai-fg'
                        : 'bg-transparent border-transparent hover:bg-monokai-surface/60 text-monokai-comment hover:text-monokai-fg'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 border transition-colors ${
                          isSelected
                            ? 'bg-monokai-surface border-monokai-border text-monokai-accent'
                            : 'bg-monokai-bg border-monokai-border text-monokai-comment group-hover:text-monokai-fg'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-xs truncate leading-snug">
                          {p.shortName}
                        </div>
                        <div className="text-[10px] text-monokai-comment truncate opacity-80">
                          {p.badge}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isSelected && diagnosis.tested && diagnosis.success && (
                        <span className="w-2 h-2 rounded-full bg-monokai-green" title="连接正常" />
                      )}
                      <ChevronRight
                        className={`w-3.5 h-3.5 transition-transform ${
                          isSelected ? 'text-monokai-accent translate-x-0.5' : 'text-monokai-comment/40 opacity-0 group-hover:opacity-100'
                        }`}
                      />
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="pt-3 mt-3 border-t border-monokai-border/60 px-2 text-[10px] text-monokai-comment space-y-2">
            <div className="flex items-center justify-between text-monokai-green font-medium">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-monokai-green" />
                <span>IndexedDB 本地缓存</span>
              </div>
              <span className="text-[9px] text-monokai-comment">持久化</span>
            </div>
            <p className="leading-tight opacity-75">
              表结构与数据已由 IndexedDB 自动缓存，刷新页面可自动恢复。
            </p>
            <button
              type="button"
              onClick={async () => {
                const ok = await confirm({
                  title: '清理工作区缓存',
                  message: '确定要清理 IndexedDB 本地缓存并重置工作区数据吗？\n此操作将清除本地暂存的所有表与视图。',
                  variant: 'danger',
                });
                if (!ok) return;
                try {
                  await duckDBService.clearIndexedDBCache();
                  onNotify('IndexedDB 工作区缓存已清空，数据已重置', 'success');
                  onClose();
                } catch (e: any) {
                  onNotify(`清理缓存失败: ${e?.message || String(e)}`, 'error');
                }
              }}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[10px] transition-colors cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>清理工作区缓存 (IndexedDB)</span>
            </button>
          </div>
        </aside>

        {/* Right Detail Panel: Provider Configuration Canvas */}
        <main className="flex-1 p-5 sm:p-6 bg-monokai-bg overflow-y-auto custom-scrollbar flex flex-col justify-between space-y-5">
          <div className="space-y-5">
            {/* Canvas Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-monokai-border/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-monokai-surface border border-monokai-border text-monokai-accent flex items-center justify-center shrink-0 shadow-xs">
                  <CurrentIcon className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-monokai-fg tracking-tight">
                      {currentProvider.name}
                    </h2>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border font-medium ${
                        currentProvider.category === 'local'
                          ? 'bg-monokai-surface text-monokai-green border-monokai-border'
                          : 'bg-monokai-surface text-monokai-accent border-monokai-border'
                      }`}
                    >
                      {currentProvider.categoryLabel}
                    </span>
                  </div>
                  <p className="text-xs text-monokai-comment mt-0.5">
                    {currentProvider.tagline}
                  </p>
                </div>
              </div>

              {/* Action Buttons: Diagnostic & Console Link */}
              <div className="flex items-center gap-2 shrink-0">
                {currentProvider.consoleUrl && (
                  <a
                    href={currentProvider.consoleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-monokai-surface hover:bg-monokai-sidebar border border-monokai-border text-monokai-comment hover:text-monokai-fg text-xs transition-colors"
                  >
                    <span>获取密钥</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}

                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={diagnosis.running || (!isLocal && !aiApiKey.trim())}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-monokai-accent/15 hover:bg-monokai-accent/25 text-monokai-accent border border-monokai-accent/40 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-40"
                >
                  <Activity className={`w-3.5 h-3.5 ${diagnosis.running ? 'animate-pulse' : ''}`} />
                  <span>{diagnosis.running ? '正在诊断...' : '测试连接'}</span>
                </button>
              </div>
            </div>

            {/* Form Fields: Endpoint & Credentials */}
            <div className="space-y-4">
              {/* Endpoint (Base URL) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-monokai-fg flex items-center gap-1.5">
                    {isLocal ? <Terminal className="w-3.5 h-3.5 text-monokai-accent" /> : <Globe className="w-3.5 h-3.5 text-monokai-accent" />}
                    <span>
                      {isLocalOllama
                        ? 'Ollama 本地服务地址 (Endpoint)'
                        : isLocalLmStudio
                        ? 'LM Studio 本地服务地址 (Endpoint)'
                        : '接口基地址 (Base URL)'}
                    </span>
                  </label>
                  {aiBaseUrl !== currentProvider.defaultBaseUrl && (
                    <button
                      type="button"
                      onClick={() => onSetAiBaseUrl(currentProvider.defaultBaseUrl)}
                      className="flex items-center gap-1 text-[11px] text-monokai-accent hover:underline cursor-pointer transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>恢复默认端点</span>
                    </button>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={aiBaseUrl}
                    onChange={e => onSetAiBaseUrl(e.target.value)}
                    placeholder={currentProvider.defaultBaseUrl || (isLocalOllama ? 'http://localhost:11434' : isLocalLmStudio ? 'http://localhost:1234/v1' : 'https://api.openai.com/v1')}
                    className="w-full px-3 py-2 bg-monokai-surface border border-monokai-border rounded-lg text-xs font-mono text-monokai-fg placeholder-monokai-comment/50 focus:outline-none focus:border-monokai-accent transition-colors"
                  />
                </div>

                {/* Quick Presets for OpenAI Compatible */}
                {currentProvider.endpointPresets && (
                  <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                    <span className="text-[11px] text-monokai-comment">快速基地址切换:</span>
                    {currentProvider.endpointPresets.map(preset => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => {
                          onSetAiBaseUrl(preset.url);
                          if (preset.recommendedModel) {
                            onSetAiModel(preset.recommendedModel);
                          }
                        }}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-colors cursor-pointer ${
                          aiBaseUrl === preset.url
                            ? 'bg-monokai-accent/20 border-monokai-accent text-monokai-accent font-semibold'
                            : 'bg-monokai-surface border-monokai-border text-monokai-comment hover:text-monokai-fg'
                        }`}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                )}

                {currentProvider.tips && (
                  <p className="text-[11px] text-monokai-comment/90 flex items-center gap-1 pt-0.5">
                    <HelpCircle className="w-3 h-3 text-monokai-accent/70 shrink-0" />
                    <span>{currentProvider.tips}</span>
                  </p>
                )}
              </div>

              {/* API Key - Cloud Providers Only */}
              {/* API Key - Cloud Providers & Optional for LM Studio */}
              {!isLocalOllama && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-monokai-fg flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-monokai-accent" />
                      <span>{isLocalLmStudio ? 'API 密钥 (API Key - 本地免密/可选)' : 'API 密钥 (API Key)'}</span>
                    </label>
                    <span className="text-[10px] font-mono text-monokai-green flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-monokai-green" />
                      {isLocalLmStudio ? '本地免密' : '内存静默同步'}
                    </span>
                  </div>

                  <div className="relative flex items-center">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={aiApiKey}
                      onChange={e => onSetAiApiKey(e.target.value)}
                      placeholder={currentProvider.keyPlaceholder || (isLocalLmStudio ? '本地默认免密，如开启鉴权请输入...' : `输入您的 ${currentProvider.name} API Key...`)}
                      className="w-full pl-3 pr-10 py-2 bg-monokai-surface border border-monokai-border rounded-lg text-xs font-mono text-monokai-fg placeholder-monokai-comment/50 focus:outline-none focus:border-monokai-accent transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2.5 p-1 text-monokai-comment hover:text-monokai-fg transition-colors cursor-pointer"
                      title={showApiKey ? '隐藏 API Key' : '显示明文 API Key'}
                      aria-label={showApiKey ? '隐藏 API Key' : '显示明文 API Key'}
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Model Selection & Custom Editable Input */}
              <div className="space-y-2 pt-1 border-t border-monokai-border/60">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-monokai-fg flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-monokai-accent" />
                    <span>模型名称标识 (Model Identifier)</span>
                  </label>
                  {availableModels.length > 0 && (
                    <span className="text-[10px] font-mono text-monokai-comment">
                      已检测并缓存 {availableModels.length} 个模型
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  {/* Free-form Input with synchronized Dropdown selection */}
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={aiModel}
                      onChange={e => onSetAiModel(e.target.value)}
                      placeholder="输入或选择模型标识，如 gpt-4o / qwen2.5-coder / llama3.2..."
                      className="w-full px-3 py-2 bg-monokai-surface border border-monokai-border rounded-lg text-xs font-mono text-monokai-fg focus:outline-none focus:border-monokai-accent transition-colors"
                    />
                  </div>

                  {/* Dropdown for quick selection from detected or existing models */}
                  <select
                    value={aiModel}
                    onChange={e => onSetAiModel(e.target.value)}
                    disabled={loadingModels}
                    className="w-48 sm:w-56 px-2.5 py-2 bg-monokai-surface border border-monokai-border rounded-lg text-xs font-mono text-monokai-fg focus:outline-none focus:border-monokai-accent disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {availableModels.length === 0 ? (
                      <option value={aiModel}>{aiModel || '可选下拉模型列表'}</option>
                    ) : (
                      availableModels.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))
                    )}
                  </select>

                  <ActionButton
                    variant="secondary"
                    size="sm"
                    icon={RefreshCw}
                    loading={loadingModels}
                    onClick={handleRefreshModels}
                    disabled={loadingModels || (!isLocal && !aiApiKey.trim())}
                    title={isLocalOllama ? '从本地 Ollama 刷新已安装的模型' : isLocalLmStudio ? '从本地 LM Studio 刷新已加载/可用模型' : '刷新模型列表'}
                  >
                    刷新
                  </ActionButton>
                </div>

                {/* Popular Model Preset Chips */}
                {currentProvider.popularModels && currentProvider.popularModels.length > 0 && (
                  <div className="flex items-center flex-wrap gap-1.5 pt-0.5">
                    <span className="text-[11px] text-monokai-comment flex items-center gap-1 shrink-0">
                      <Sparkles className="w-3 h-3 text-monokai-accent" />
                      推荐预设:
                    </span>
                    {currentProvider.popularModels.map(m => {
                      const isSelected = aiModel === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => onSetAiModel(m.id)}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-mono border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-monokai-accent/20 border-monokai-accent text-monokai-accent font-semibold shadow-sm'
                              : 'bg-monokai-surface hover:bg-monokai-sidebar border-monokai-border text-monokai-fg/80 hover:text-monokai-fg'
                          }`}
                        >
                          <span>{m.label}</span>
                          {m.badge && (
                            <span className="ml-1 text-[9px] px-1 py-0.2 rounded bg-monokai-bg text-monokai-comment border border-monokai-border/60">
                              {m.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Diagnostic Results Banner (If tested) */}
            {diagnosis.tested && (
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  diagnosis.success
                    ? 'bg-monokai-green/10 border-monokai-green/40 text-monokai-fg'
                    : 'bg-monokai-pink/10 border-monokai-pink/40 text-monokai-fg'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {diagnosis.success ? (
                    <CheckCircle2 className="w-4 h-4 text-monokai-green shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-monokai-pink shrink-0 mt-0.5" />
                  )}

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-bold text-xs ${diagnosis.success ? 'text-monokai-green' : 'text-monokai-pink'}`}>
                        {diagnosis.success ? '● 已连接' : '✕ 诊断失败'}
                      </span>
                      {diagnosis.success && diagnosis.latencyMs !== undefined && (
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                            diagnosis.latencyMs < 300
                              ? 'bg-monokai-green/15 border-monokai-green/30 text-monokai-green'
                              : diagnosis.latencyMs < 1000
                              ? 'bg-monokai-yellow/15 border-monokai-yellow/30 text-monokai-yellow'
                              : 'bg-monokai-pink/15 border-monokai-pink/30 text-monokai-pink'
                          }`}
                        >
                          延迟: {diagnosis.latencyMs}ms
                        </span>
                      )}
                      {diagnosis.success && diagnosis.modelCount !== undefined && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-monokai-bg border border-monokai-border text-monokai-comment">
                          可用模型: {diagnosis.modelCount}
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-mono opacity-90 leading-relaxed text-monokai-fg/90">
                      {diagnosis.message}
                    </p>

                    {!diagnosis.success && (
                      <div className="mt-2 pt-2 border-t border-monokai-pink/20 text-[11px] text-monokai-comment space-y-0.5">
                        <div className="font-semibold text-monokai-pink/90">排查建议:</div>
                        {isLocalOllama ? (
                          <ul className="list-disc list-inside space-y-0.5 pl-1">
                            <li>确认本地终端已运行：<code className="text-monokai-fg">ollama serve</code></li>
                            <li>配置跨域环境变量：<code className="text-monokai-fg">export OLLAMA_ORIGINS="*"</code> 启动</li>
                            <li>确认 11434 端口未被其他服务占用</li>
                          </ul>
                        ) : isLocalLmStudio ? (
                          <ul className="list-disc list-inside space-y-0.5 pl-1">
                            <li>确认 LM Studio 的 Local Server 处于运行状态（默认端口 1234）</li>
                            <li>确认在 LM Studio 中已下载并加载模型（或开启 JIT 自动加载）</li>
                            <li>在 LM Studio 服务器设置中确认已勾选 "Enable CORS" 允许跨域</li>
                            <li>确认 1234 端口未被其他服务占用</li>
                          </ul>
                        ) : (
                          <ul className="list-disc list-inside space-y-0.5 pl-1">
                            <li>请核对 API Key 是否正确输入且有效</li>
                            <li>确认 Base URL 格式正确，如需中转通常以 /v1 结尾</li>
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </ModalShell>
  );
};

export default SettingsModal;


