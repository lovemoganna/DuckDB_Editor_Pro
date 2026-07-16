import React, { useState } from 'react';
import {
  Info,
  AlertCircle,
  X,
  Copy,
  ChevronDown,
  CheckCircle2,
  Table,
  Columns,
  HelpCircle,
  Keyboard,
  Hash,
  Type,
  AlignLeft,
  ToggleLeft,
} from 'lucide-react';
import { SkillInputField } from '../../types';

interface SkillFormFieldProps {
  field: SkillInputField;
  value: any;
  onChange: (name: string, val: any) => void;
  errors: Record<string, string>;
  currentTable?: string;
  currentColumns?: { name: string; type: string }[];
  /** Show field hints and keyboard shortcuts */
  showHints?: boolean;
}

// Field type metadata for better UX
const FIELD_TYPE_HINTS: Record<string, { hint: string; shortcut?: string; example?: string; icon: React.ReactNode }> = {
  text: { hint: '输入文本内容', shortcut: 'Ctrl+Enter 执行', icon: <Type className="w-3.5 h-3.5" /> },
  textarea: { hint: '支持多行输入，可使用 SQL', shortcut: 'Ctrl+Enter 执行', icon: <AlignLeft className="w-3.5 h-3.5" /> },
  select: { hint: '从下拉列表选择', icon: <ChevronDown className="w-3.5 h-3.5" /> },
  number: { hint: '输入数字，可设置范围', shortcut: '↑↓ 调整', icon: <Hash className="w-3.5 h-3.5" /> },
  boolean: { hint: '开关选项', icon: <ToggleLeft className="w-3.5 h-3.5" /> },
  table: { hint: '选择目标表名', example: 'users, orders', icon: <Table className="w-3.5 h-3.5" /> },
  column: { hint: '选择表列，支持多选', example: 'id, name, created_at', icon: <Columns className="w-3.5 h-3.5" /> },
};

// Field type accent colors
const FIELD_TYPE_COLORS: Record<string, string> = {
  text: '#66d9ef',
  textarea: '#ae81ff',
  select: '#fd971f',
  number: '#a6e22e',
  boolean: '#bd93f9',
  table: '#ff79c6',
  column: '#8be9fd',
};

export const SkillFormField: React.FC<SkillFormFieldProps> = ({
  field,
  value,
  onChange,
  errors,
  currentTable,
  currentColumns,
  showHints = true,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const error = errors[field.name];
  const hasValue = value && (typeof value === 'string' ? value.trim() : true);
  const typeHint: typeof FIELD_TYPE_HINTS[string] = FIELD_TYPE_HINTS[field.type] ?? {
    hint: '', icon: <Info className="w-3.5 h-3.5" />,
  };
  const hasHint = showHints && (field.description || typeHint.hint || typeHint.example);
  const accentColor = FIELD_TYPE_COLORS[field.type] || '#66d9ef';

  const fieldId = `field-${field.name}`;

  // Enhanced label with tooltip toggle
  const labelEl = (
    <div className="flex items-center gap-2 mb-2">
      {/* Type icon */}
      <div
        className="w-6 h-6 rounded flex items-center justify-center"
        style={{ background: `${accentColor}15`, color: accentColor }}
      >
        {typeHint.icon}
      </div>
      <label
        htmlFor={fieldId}
        className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-monokai-fg"
      >
        {field.label}
        {field.required && (
          <span className="text-monokai-pink text-[10px]">*</span>
        )}
      </label>

      {/* Tooltip toggle */}
      {hasHint && (
        <button
          type="button"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className="ml-auto text-monokai-comment hover:text-monokai-amethyst transition-colors"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );

  // Enhanced tooltip content
  const tooltipEl = showTooltip && hasHint && (
    <div className="absolute left-0 top-full mt-1 z-50 w-64 p-3 bg-[#272822] border border-monokai-amethyst/30 rounded-lg shadow-xl text-xs">
      {field.description && (
        <div className="mb-3 text-monokai-fg">
          <div className="text-[9px] text-monokai-amethyst uppercase mb-1.5 font-bold tracking-wider">说明</div>
          <div className="text-[11px] leading-relaxed">{field.description}</div>
        </div>
      )}
      {typeHint.hint && (
        <div className="mb-3 text-monokai-comment">
          <div className="text-[9px] text-monokai-amethyst uppercase mb-1.5 font-bold tracking-wider">提示</div>
          <div className="text-[11px]">{typeHint.hint}</div>
        </div>
      )}
      {typeHint.example && (
        <div className="mb-3 text-monokai-green">
          <div className="text-[9px] text-monokai-amethyst uppercase mb-1.5 font-bold tracking-wider">示例</div>
          <code className="text-[11px] font-mono bg-[#1e1f1c] px-2 py-1 rounded inline-block">{typeHint.example}</code>
        </div>
      )}
      {typeHint.shortcut && (
        <div className="flex items-center gap-1.5 text-monokai-comment">
          <Keyboard className="w-3 h-3" />
          <span className="text-[11px]">{typeHint.shortcut}</span>
        </div>
      )}
    </div>
  );

  // Base description (shown below label, not in tooltip)
  const descEl = field.description && !showTooltip ? (
    <p className="text-[10px] text-monokai-comment mb-2 flex items-center gap-1.5">
      <Info className="w-3 h-3 shrink-0" />
      {field.description}
    </p>
  ) : null;

  const errorEl = error ? (
    <p className="mt-2 text-[10px] text-monokai-pink flex items-center gap-1.5 bg-monokai-pink/10 px-3 py-2 rounded-lg border border-monokai-pink/20">
      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
      {error}
    </p>
  ) : null;

  const copyBtn = (text: string) => (
    <div className="absolute right-3 top-3 flex items-center gap-1.5">
      {hasValue && (
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(text)}
          className="p-1 text-monokai-green/60 hover:text-monokai-green transition-colors"
          title="复制"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      )}
      <button
        type="button"
        onClick={() => onChange(field.name, '')}
        className="p-1 text-monokai-comment/60 hover:text-monokai-pink transition-colors"
        title="清除"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  // Common input styles with accent focus
  const inputBaseClass = [
    'w-full px-3 py-2 text-[12px] font-mono',
    'bg-[#1e1e1e] border rounded-lg',
    'focus:outline-none transition-all duration-200',
    'text-monokai-fg placeholder-monokai-comment/50',
  ].join(' ');

  const inputStyle = error ? {
    borderColor: '#f92672',
    boxShadow: `0 0 0 1px #f92672, 0 0 8px rgba(249, 38, 114, 0.15)`,
  } : hasValue ? {
    borderColor: `${accentColor}50`,
    boxShadow: `0 0 0 1px ${accentColor}30`,
  } : {
    borderColor: '#3e3d32',
  };

  switch (field.type) {
    case 'textarea':
      return (
        <div key={field.name} className="group relative">
          {labelEl}
          {descEl}
          <div className="relative">
            <textarea
              id={fieldId}
              value={value || ''}
              onChange={(e) => onChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              rows={field.rows || 4}
              className={`${inputBaseClass} min-h-[100px] resize-y ${error ? 'shake' : ''}`}
              style={inputStyle}
            />
            {copyBtn(value || '')}
          </div>
          {tooltipEl}
          {errorEl}
        </div>
      );

    case 'select':
      return (
        <div key={field.name} className="group relative">
          {labelEl}
          {descEl}
          <div className="relative">
            <select
              id={fieldId}
              value={value || ''}
              onChange={(e) => onChange(field.name, e.target.value)}
              className={`${inputBaseClass} appearance-none cursor-pointer`}
              style={inputStyle}
            >
              <option value="">请选择...</option>
              {field.options?.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: accentColor }}>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
          {tooltipEl}
          {errorEl}
        </div>
      );

    case 'number':
      return (
        <div key={field.name} className="group relative">
          {labelEl}
          {descEl}
          <div className="relative">
            <input
              id={fieldId}
              type="number"
              value={value || ''}
              onChange={(e) => onChange(field.name, parseInt(e.target.value) || 0)}
              min={field.min}
              max={field.max}
              placeholder={field.placeholder}
              className={inputBaseClass}
              style={inputStyle}
            />
            {hasValue && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: accentColor }}>
                <CheckCircle2 className="w-4 h-4" />
              </div>
            )}
          </div>
          {tooltipEl}
          {errorEl}
        </div>
      );

    case 'boolean':
      return (
        <div key={field.name} className="group mb-2 relative">
          <label
            className="flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:scale-[1.01]"
            style={{
              background: value ? `${accentColor}08` : '#1e1e1e',
              borderColor: value ? `${accentColor}40` : '#3e3d32',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `${accentColor}15`, color: accentColor }}
              >
                {typeHint.icon}
              </div>
              <span className="text-[12px] font-medium text-monokai-fg">{field.label}</span>
            </div>
            <div className="flex items-center gap-2">
              {value ? (
                <span className="text-[10px] font-bold px-2 py-1 rounded" style={{ background: `${accentColor}20`, color: accentColor }}>ON</span>
              ) : (
                <span className="text-[10px] font-bold text-monokai-comment px-2 py-1">OFF</span>
              )}
              <input
                id={fieldId}
                type="checkbox"
                checked={value || false}
                onChange={(e) => onChange(field.name, e.target.checked)}
                className="sr-only"
              />
            </div>
          </label>
          {tooltipEl}
          {errorEl}
        </div>
      );

    case 'table':
      return (
        <div key={field.name} className="group relative">
          {labelEl}
          {descEl}
          <div className="relative">
            <select
              id={fieldId}
              value={value || ''}
              onChange={(e) => onChange(field.name, e.target.value)}
              className={`${inputBaseClass} appearance-none cursor-pointer`}
              style={inputStyle}
            >
              <option value="">请选择表...</option>
              {currentTable && <option value={currentTable}>{currentTable}</option>}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: accentColor }}>
              <Table className="w-4 h-4" />
            </div>
          </div>
          {tooltipEl}
          {!currentTable && (
            <div className="flex items-center gap-2 text-[10px] text-monokai-yellow bg-monokai-yellow/10 px-3 py-2 rounded-lg mt-2 border border-monokai-yellow/20">
              <Info className="w-3 h-3 shrink-0" />
              <span>当前没有选中表，请在左侧选择一个表</span>
            </div>
          )}
          {errorEl}
        </div>
      );

    case 'column':
      return (
        <div key={field.name} className="group relative">
          {labelEl}
          {descEl}
          <div className="relative">
            <select
              id={fieldId}
              value={value || ''}
              onChange={(e) => onChange(field.name, e.target.value)}
              className={`${inputBaseClass} appearance-none cursor-pointer`}
              style={inputStyle}
            >
              <option value="">请选择列...</option>
              {currentColumns?.map(col => (
                <option key={col.name} value={col.name}>{col.name} ({col.type})</option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: accentColor }}>
              <Columns className="w-4 h-4" />
            </div>
          </div>
          {tooltipEl}
          {errorEl}
        </div>
      );

    default:
      return (
        <div key={field.name} className="group relative">
          {labelEl}
          {descEl}
          <div className="relative">
            <input
              id={fieldId}
              type="text"
              value={value || ''}
              onChange={(e) => onChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              className={inputBaseClass}
              style={inputStyle}
            />
            {hasValue && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: accentColor }}>
                <CheckCircle2 className="w-4 h-4" />
              </div>
            )}
          </div>
          {tooltipEl}
          {errorEl}
        </div>
      );
  }
};
