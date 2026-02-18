import React, { useState } from 'react';
import { MetricDefinition } from '../types';
import { 
  Edit2, Trash2, Copy, Check, X, 
  Tag, Lightbulb, Star, BookOpen, Calculator, 
  FileText, Link, ChevronDown, ChevronUp,
  Play, Wrench, AlertCircle, CheckCircle, BarChart2
} from 'lucide-react';

interface MetricCardProps {
  metric: MetricDefinition;
  onEdit: (metric: MetricDefinition) => void;
  onDelete: (id: string) => void;
  onValidate?: (metric: MetricDefinition) => void;
  onFix?: (metric: MetricDefinition) => void;
  onGenerateChart?: (metric: MetricDefinition) => void;
  sourceTable?: string;
  hasChart?: boolean;
  onToggleFavorite?: (id: string) => void;
  isFavorite?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({ 
  metric, 
  onEdit, 
  onDelete,
  onValidate,
  onFix,
  onGenerateChart,
  sourceTable,
  hasChart = false,
  onToggleFavorite,
  isFavorite = false
}) => {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<MetricDefinition>(metric);
  const [isValidating, setIsValidating] = useState(false);
  const [isGeneratingChart, setIsGeneratingChart] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(metric, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdit = () => {
    onEdit(editForm);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditForm(metric);
    setIsEditing(false);
  };

  const handleValidate = async () => {
    if (!onValidate) return;
    setIsValidating(true);
    try {
      await onValidate(metric);
    } finally {
      setIsValidating(false);
    }
  };

  const handleFix = async () => {
    if (!onFix) return;
    setIsValidating(true);
    try {
      await onFix(metric);
    } finally {
      setIsValidating(false);
    }
  };

  const handleGenerateChart = async () => {
    if (!onGenerateChart) return;
    setIsGeneratingChart(true);
    try {
      await onGenerateChart(metric);
    } finally {
      setIsGeneratingChart(false);
    }
  };

  const handleCopySql = async () => {
    if (metric.sqlValidation) {
      await navigator.clipboard.writeText(metric.sqlValidation);
    }
  };

  const FieldView: React.FC<{ icon: React.ReactNode; label: string; value: string | string[] }> = ({ 
    icon, 
    label, 
    value 
  }) => (
    <div className="flex gap-2">
      <div className="text-monokai-blue mt-0.5">{icon}</div>
      <div className="flex-1">
        <div className="text-xs text-monokai-comment uppercase">{label}</div>
        {Array.isArray(value) ? (
          <div className="flex flex-wrap gap-1 mt-1">
            {value.map((v, i) => (
              <span key={i} className="px-2 py-0.5 bg-monokai-accent/30 rounded text-xs text-monokai-fg">
                {v}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-sm text-white mt-0.5">{value}</div>
        )}
      </div>
    </div>
  );

  const FieldEdit: React.FC<{ label: string; field: keyof MetricDefinition; multiline?: boolean }> = ({ 
    label, 
    field,
    multiline 
  }) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-monokai-comment uppercase">{label}</label>
      {multiline ? (
        <textarea
          value={editForm[field] as string}
          onChange={(e) => setEditForm({ ...editForm, [field]: e.target.value })}
          className="w-full bg-monokai-bg border border-monokai-accent p-2 rounded text-sm text-white focus:border-monokai-blue outline-none resize-none"
          rows={3}
        />
      ) : (
        <input
          type="text"
          value={editForm[field] as string}
          onChange={(e) => setEditForm({ ...editForm, [field]: e.target.value })}
          className="w-full bg-monokai-bg border border-monokai-accent p-2 rounded text-sm text-white focus:border-monokai-blue outline-none"
        />
      )}
    </div>
  );

  if (isEditing) {
    return (
      <div className="bg-[#272822] border border-monokai-green rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-monokai-green">编辑指标</h3>
          <div className="flex gap-2">
            <button
              onClick={handleSaveEdit}
              className="p-1.5 bg-monokai-green text-monokai-bg rounded hover:opacity-90"
              title="保存"
            >
              <Check size={14} />
            </button>
            <button
              onClick={handleCancelEdit}
              className="p-1.5 bg-monokai-accent text-white rounded hover:bg-monokai-comment"
              title="取消"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <FieldEdit label="指标名称" field="name" />
          <FieldEdit label="指标场景" field="scenario" />
          <FieldEdit label="指标特点" field="characteristics" />
          <FieldEdit label="价值说明" field="value" />
          <FieldEdit label="指标定义" field="definition" multiline />
          <FieldEdit label="计算公式" field="formula" />
          <FieldEdit label="典型案例" field="example" />
          <FieldEdit label="单位" field="unit" />
          <FieldEdit label="分类" field="category" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#272822] border border-monokai-accent rounded-lg p-4 hover:border-monokai-blue transition-colors">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span className="text-monokai-pink">{metric.name}</span>
            {metric.category && (
              <span className="px-2 py-0.5 bg-monokai-purple/30 rounded text-xs text-monokai-purple">
                {metric.category}
              </span>
            )}
            {metric.version && metric.version > 1 && (
              <span className="px-2 py-0.5 bg-monokai-blue/30 rounded text-xs text-monokai-blue" title={`版本 ${metric.version}`}>
                v{metric.version}
              </span>
            )}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            {metric.unit && (
              <span className="text-xs text-monokai-comment">单位: {metric.unit}</span>
            )}
            {/* Validation Status */}
            {metric.isValid === true && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-monokai-green/20 rounded text-xs text-monokai-green">
                <CheckCircle size={10} /> 已验证
              </span>
            )}
            {metric.isValid === false && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-monokai-pink/20 rounded text-xs text-monokai-pink">
                <AlertCircle size={10} /> 验证失败
              </span>
            )}
            {/* Health Score */}
            {hasChart && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-monokai-blue/20 rounded text-xs text-monokai-blue" title="健康度评分">
                <CheckCircle size={10} /> 满分
              </span>
            )}
            {/* Version indicator */}
            {metric.version && metric.version > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-monokai-purple/20 rounded text-xs text-monokai-purple" title={`版本: v${metric.version}`}>
                v{metric.version}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          {/* Validate Button */}
          {onValidate && (
            <button
              onClick={handleValidate}
              disabled={isValidating}
              className="p-1.5 hover:bg-monokai-accent rounded text-monokai-comment hover:text-monokai-green transition-colors disabled:opacity-50"
              title="验证SQL"
            >
              {isValidating ? (
                <div className="w-3.5 h-3.5 border-2 border-monokai-green border-t-transparent rounded-full animate-spin" />
              ) : (
                <Play size={14} />
              )}
            </button>
          )}
          {/* Fix Button */}
          {onFix && metric.isValid === false && (
            <button
              onClick={handleFix}
              disabled={isValidating}
              className="p-1.5 hover:bg-monokai-accent rounded text-monokai-comment hover:text-monokai-orange transition-colors disabled:opacity-50"
              title="修复字段"
            >
              <Wrench size={14} />
            </button>
          )}
          {/* Generate Chart Button */}
          {onGenerateChart && (
            <button
              onClick={handleGenerateChart}
              disabled={isGeneratingChart}
              className={`p-1.5 hover:bg-monokai-accent rounded transition-colors disabled:opacity-50 ${
                hasChart 
                  ? 'text-monokai-purple hover:text-monokai-purple' 
                  : 'text-monokai-comment hover:text-monokai-purple'
              }`}
              title={hasChart ? "已生成图表" : "生成图表"}
            >
              {isGeneratingChart ? (
                <div className="w-3.5 h-3.5 border-2 border-monokai-purple border-t-transparent rounded-full animate-spin" />
              ) : (
                <BarChart2 size={14} />
              )}
            </button>
          )}
          {onToggleFavorite && (
            <button
              onClick={() => onToggleFavorite(metric.id)}
              className={`p-1.5 hover:bg-monokai-accent rounded transition-colors ${
                isFavorite 
                  ? 'text-yellow-400 hover:text-yellow-300' 
                  : 'text-monokai-comment hover:text-yellow-400'
              }`}
              title={isFavorite ? "取消收藏" : "收藏指标"}
            >
              <Star size={14} className={isFavorite ? 'fill-current' : ''} />
            </button>
          )}
          <button
            onClick={handleCopy}
            className="p-1.5 hover:bg-monokai-accent rounded text-monokai-comment hover:text-white transition-colors"
            title="复制JSON"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
          <button
            onClick={() => setIsEditing(true)}
            className="p-1.5 hover:bg-monokai-accent rounded text-monokai-comment hover:text-monokai-blue transition-colors"
            title="编辑"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => onDelete(metric.id)}
            className="p-1.5 hover:bg-monokai-accent rounded text-monokai-comment hover:text-monokai-pink transition-colors"
            title="删除"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-2">
        <FieldView icon={<Tag size={12} />} label="指标场景" value={metric.scenario} />
        <FieldView icon={<Star size={12} />} label="指标特点" value={metric.characteristics} />
        <FieldView icon={<Lightbulb size={12} />} label="价值说明" value={metric.value} />
        
        {expanded && (
          <>
            <FieldView icon={<BookOpen size={12} />} label="指标定义" value={metric.definition} />
            <FieldView icon={<Calculator size={12} />} label="计算公式" value={metric.formula} />
            <FieldView icon={<FileText size={12} />} label="典型案例" value={metric.example} />
            <FieldView icon={<Link size={12} />} label="数据依赖" value={metric.dependencies} />
            
            {/* SQL Validation Section */}
            {metric.sqlValidation && (
              <div className="mt-2 p-2 bg-monokai-bg rounded border border-monokai-accent">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs text-monokai-comment uppercase flex items-center gap-1">
                    <Calculator size={12} /> SQL验证语句
                  </div>
                  <button
                    onClick={handleCopySql}
                    className="text-xs text-monokai-blue hover:underline"
                  >
                    复制
                  </button>
                </div>
                <pre className="text-xs font-mono text-monokai-green overflow-x-auto whitespace-pre-wrap">
                  {metric.sqlValidation}
                </pre>
                {/* Validation Error */}
                {metric.validationError && (
                  <div className="mt-2 p-2 bg-monokai-pink/20 rounded text-xs text-monokai-pink">
                    <AlertCircle size={12} className="inline mr-1" />
                    {metric.validationError}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Expand/Collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full mt-3 pt-2 border-t border-monokai-accent/50 flex items-center justify-center gap-1 text-xs text-monokai-comment hover:text-white transition-colors"
      >
        {expanded ? (
          <>收起详细信息 <ChevronUp size={14} /></>
        ) : (
          <>展开详细信息 <ChevronDown size={14} /></>
        )}
      </button>
    </div>
  );
};
