import React, { useState } from 'react';
import {
  Sparkles,
  Loader2,
  Check,
  Code2,
  Target,
  BookMarked,
  AlertCircle,
  Lightbulb
} from 'lucide-react';
import { ModalShell } from '../../ui/Workbench';
import { KnowledgeAsset, AssetType, CodeAsset, MetricAsset, NoteAsset } from '../types';
import { aiService } from '../../../services/aiService';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetAsset?: KnowledgeAsset | null;
  onSaveExtractedAsset: (asset: KnowledgeAsset) => void;
}

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  targetAsset,
  onSaveExtractedAsset,
}) => {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedAsset, setExtractedAsset] = useState<KnowledgeAsset | null>(null);

  React.useEffect(() => {
    if (targetAsset) {
      if (targetAsset.type === 'code') {
        setInputText(`请帮我优化并润色以下 DuckDB SQL，补全适用场景说明和参数占位符：\n\n${targetAsset.sql}`);
      } else if (targetAsset.type === 'metric') {
        setInputText(`请帮我完善指标口径?{targetAsset.name}」的业务定义与计算公式：\n\n${targetAsset.sqlExpression}`);
      } else if (targetAsset.type === 'note') {
        setInputText(`请帮我润色并扩充以下知识笔记，增加避坑实践与最佳建议：\n\n${targetAsset.content}`);
      }
    } else {
      setInputText('');
    }
    setExtractedAsset(null);
    setError(null);
  }, [targetAsset, isOpen]);

  if (!isOpen) return null;


  const handleAnalyze = async () => {
    if (!inputText.trim()) return;
    setIsLoading(true);
    setError(null);
    setExtractedAsset(null);

    const isAiReady = aiService.isConfigured();

    if (!isAiReady) {
      setTimeout(() => {
        const text = inputText.trim();
        const isSql = /SELECT|WITH|CREATE|INSERT|FROM/i.test(text);

        if (isSql) {
          const tableMatch = text.match(/FROM\s+([a-zA-Z0-9_]+)/i);
          const tableName = tableMatch ? tableMatch[1] : 'my_table';
          const asset: CodeAsset = {
            id: 'ai-code-' + Date.now(),
            type: 'code',
            title: 'AI 提炼：基于 ' + tableName + ' 的查询资产',
            category: 'template',
            description: '由 AI 自动从输入脚本中提炼的高效查询模版',
            sql: text,
            tags: ['AI提炼', tableName, 'DuckDB'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setExtractedAsset(asset);
        } else {
          const asset: NoteAsset = {
            id: 'ai-note-' + Date.now(),
            type: 'note',
            title: text.slice(0, 24) + '...',
            topic: 'best_practice',
            summary: text.slice(0, 80),
            content: '## 核心经验沉淀\n\n' + text + '\n\n### 建议行动\n- 纳入日常开发规范\n- 定期复盘',
            tags: ['AI归档', '经验沉淀'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setExtractedAsset(asset);
        }
        setIsLoading(false);
      }, 500);
      return;
    }

    try {
      const prompt =
        '你是一个资深 DuckDB 与数据分析专家。请分析以下内容，并提炼为符合规格的知识资产 JSON。\n' +
        '内容：\n' + inputText + '\n\n' +
        '请严格输出且仅输出合法 JSON，包含 type/title/category/description/sql/name/businessMeaning/calculationFormula/sqlExpression/topic/summary/content/tags 字段。';

      const res = await aiService.robustCall(
        'sql_explain',
        prompt,
        '你是一个数据资产提炼专家，严格返回 JSON。',
        true,
        2
      );

      const parsed = typeof res === 'string' ? JSON.parse(res) : res;
      const now = new Date().toISOString();

      let newAsset;
      if (parsed.type === 'metric') {
        newAsset = {
          id: 'ai-metric-' + Date.now(),
          type: 'metric',
          name: parsed.name || parsed.title || '未命名指标',
          businessMeaning: parsed.businessMeaning || '',
          calculationFormula: parsed.calculationFormula || '',
          sqlExpression: parsed.sqlExpression || parsed.sql || '',
          sourceTables: parsed.sourceTables || [],
          dimensions: parsed.dimensions || [],
          owner: parsed.owner || '',
          tags: parsed.tags || ['AI提炼'],
          isFavorite: false,
          createdAt: now,
          updatedAt: now,
        };
      } else if (parsed.type === 'note') {
        newAsset = {
          id: 'ai-note-' + Date.now(),
          type: 'note',
          title: parsed.title || '未命名笔记',
          topic: parsed.topic || 'memo',
          summary: parsed.summary || '',
          content: parsed.content || inputText,
          references: parsed.references || [],
          tags: parsed.tags || ['AI提炼'],
          isFavorite: false,
          createdAt: now,
          updatedAt: now,
        };
      } else {
        newAsset = {
          id: 'ai-code-' + Date.now(),
          type: 'code',
          title: parsed.title || '未命名代码资产',
          category: parsed.category || 'snippet',
          description: parsed.description || '',
          sql: parsed.sql || inputText,
          tags: parsed.tags || ['AI提炼'],
          isFavorite: false,
          createdAt: now,
          updatedAt: now,
        };
      }

      setExtractedAsset(newAsset);
    } catch (err) {
      setError((err && err.message) || 'AI 提炼失败，请检查网络或配置');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (extractedAsset) {
      onSaveExtractedAsset(extractedAsset);
      onClose();
    }
  };

  return (
    <ModalShell
      open={isOpen}
      onClose={onClose}
      title="AI 知识资产智能提炼"
      description="输入 SQL、业务口径描述或踩坑心得，AI 自动提炼并结构化归档"
      size="lg"
      icon={Sparkles}
      iconColor="text-monokai-accent"
    >
      <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-monokai-fg-muted mb-1.5">输入原始文本 / SQL / 经验心得</label>
            <textarea
              rows={6}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="例如粘贴一段正在调优的 DuckDB 复杂查询，或输入一段关于业务指标的业务要求..."
              className="w-full bg-monokai-bg border border-monokai-border rounded-xl p-3 text-xs text-monokai-fg-muted font-mono focus:outline-none focus:border-monokai-accent resize-none"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-monokai-comment flex items-center gap-1">
              <Lightbulb className="w-3.5 h-3.5 text-monokai-yellow" />
              <span>未配置外部 API Key 时将自动启用本地快速智能规则提炼</span>
            </span>

            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isLoading || !inputText.trim()}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-monokai-accent hover:bg-monokai-accent-hover text-monokai-bg transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>AI 正在提炼...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>开始提炼资产</span>
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-monokai-pink/10 border border-monokai-pink/40 text-monokai-pink text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-monokai-pink flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 提炼结果预览 */}
          {extractedAsset && (
            <div className="rounded-xl border border-monokai-border bg-monokai-elevated p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-monokai-border text-monokai-accent font-medium flex items-center gap-1">
                    {extractedAsset.type === 'code' && <Code2 className="w-3 h-3" />}
                    {extractedAsset.type === 'metric' && <Target className="w-3 h-3" />}
                    {extractedAsset.type === 'note' && <BookMarked className="w-3 h-3" />}
                    <span>已提炼为：{extractedAsset.type.toUpperCase()} 资产</span>
                  </span>
                  <span className="text-xs font-semibold text-monokai-fg-muted">
                    {extractedAsset.type === 'metric' ? extractedAsset.name : extractedAsset.title}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleApply}
                  className="px-3 py-1 rounded-md text-xs font-semibold bg-monokai-accent text-monokai-bg hover:bg-monokai-accent-hover flex items-center gap-1 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>确认归档入库</span>
                </button>
              </div>

              {extractedAsset.type === 'code' && (
                <pre className="p-3 rounded-lg bg-monokai-bg text-xs font-mono text-monokai-fg-muted overflow-x-auto max-h-48 border border-monokai-border">
                  {extractedAsset.sql}
                </pre>
              )}

              {extractedAsset.type === 'metric' && (
                <div className="text-xs text-monokai-fg-muted space-y-1">
                  <p><span className="text-monokai-comment">计算公式：</span>{extractedAsset.calculationFormula}</p>
                  <p><span className="text-monokai-comment">业务含义：</span>{extractedAsset.businessMeaning}</p>
                </div>
              )}

              {extractedAsset.type === 'note' && (
                <div className="text-xs text-monokai-fg-muted space-y-1">
                  <p><span className="text-monokai-comment">摘要：</span>{extractedAsset.summary}</p>
                </div>
              )}
            </div>
          )}
        </div>

    </ModalShell>
  );
};
