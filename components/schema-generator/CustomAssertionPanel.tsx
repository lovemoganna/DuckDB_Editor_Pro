// ============================================================
// Custom Assertion Panel - V6.0 New Feature
// ============================================================
import React, { useState } from 'react';
import {
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Play,
  Copy,
  Settings,
  Database,
  Table,
  Filter,
  Hash,
  Link,
  FileText,
  HelpCircle,
  ArrowRight,
  Trash2
} from 'lucide-react';
import { CustomAssertion, AssertionTemplate } from '../../types';
import { 
  ASSERTION_TEMPLATES, 
  createAssertionFromTemplate, 
  getTemplatesByCategory,
  getAssertionCategories 
} from '../../services/assertionLibrary';

interface CustomAssertionPanelProps {
  tableName: string;
  columns: string[];
  customAssertions: CustomAssertion[];
  onAddAssertion: (assertion: CustomAssertion) => void;
  onRemoveAssertion: (id: string) => void;
  onRunAssertion: (assertion: CustomAssertion, idx: number) => void;
  assertionResults: Record<string, 'pass' | 'fail' | 'running' | undefined>;
}

const categoryIcons: Record<string, React.ReactNode> = {
  null_check: <Filter size={14} />,
  uniqueness: <Hash size={14} />,
  range: <AlertTriangle size={14} />,
  relationship: <Link size={14} />,
  custom: <FileText size={14} />
};

const categoryLabels: Record<string, string> = {
  null_check: '空值校验',
  uniqueness: '唯一性校验',
  range: '范围校验',
  relationship: '关联校验',
  custom: '自定义规则'
};

export const CustomAssertionPanel: React.FC<CustomAssertionPanelProps> = ({
  tableName,
  columns,
  customAssertions,
  onAddAssertion,
  onRemoveAssertion,
  onRunAssertion,
  assertionResults
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<AssertionTemplate | null>(null);
  const [templateParams, setTemplateParams] = useState<Record<string, string>>({});
  const [selectedColumn, setSelectedColumn] = useState<string>('');

  // Get available categories
  const categories = getAssertionCategories();

  // Handle template selection
  const handleTemplateSelect = (template: AssertionTemplate) => {
    setSelectedTemplate(template);
    // Set default params
    const defaults: Record<string, string> = {};
    template.params.forEach(p => {
      if (p.default !== undefined) {
        defaults[p.name] = String(p.default);
      }
    });
    setTemplateParams(defaults);
    // Auto-select first column if needed
    if (template.params.some(p => p.name === 'column' && p.required) && columns.length > 0) {
      setSelectedColumn(columns[0]);
    }
  };

  // Handle adding assertion from template
  const handleAddFromTemplate = () => {
    if (!selectedTemplate) return;
    
    const params = {
      ...templateParams,
      table: tableName,
      column: selectedColumn
    };
    
    const assertion = createAssertionFromTemplate(selectedTemplate, params, tableName, selectedColumn);
    onAddAssertion(assertion);
    
    // Reset
    setSelectedTemplate(null);
    setTemplateParams({});
    setShowTemplateSelector(false);
  };

  // Get result status for an assertion
  const getResultStatus = (assertionId: string): 'pass' | 'fail' | 'running' | undefined => {
    return assertionResults[assertionId];
  };

  return (
    <div className="bg-monokai-surface rounded-xl border border-monokai-border overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-monokai-red/5 border-b border-monokai-border cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Settings size={16} className="text-monokai-red" />
          <h3 className="text-sm font-bold text-monokai-fg">自定义断言</h3>
          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-monokai-red/20 text-monokai-red rounded-full">
            {customAssertions.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowTemplateSelector(!showTemplateSelector);
            }}
            className="flex items-center gap-1 px-2 py-1 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-lg transition-colors"
          >
            <Plus size={12} />
            添加
          </button>
          {isExpanded ? <ChevronUp size={16} className="text-monokai-comment" /> : <ChevronDown size={16} className="text-monokai-comment" />}
        </div>
      </div>

      {/* Template Selector */}
      {showTemplateSelector && (
        <div className="p-4 bg-monokai-bg border-b border-monokai-border">
          {/* Category Tabs */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-monokai-red text-white'
                    : 'bg-monokai-surface text-monokai-fg hover:bg-monokai-sidebar border border-monokai-border'
                }`}
              >
                {categoryIcons[cat]}
                {categoryLabels[cat]}
              </button>
            ))}
          </div>

          {/* Template List */}
          {selectedCategory && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
              {getTemplatesByCategory(selectedCategory as any).map(template => (
                <button
                  key={template.id}
                  onClick={() => handleTemplateSelect(template)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    selectedTemplate?.id === template.id
                      ? 'border-monokai-red bg-monokai-red/10'
                      : 'border-monokai-border hover:border-monokai-red bg-monokai-surface'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-monokai-fg">{template.name}</span>
                  </div>
                  <p className="text-[10px] text-monokai-comment">{template.description}</p>
                </button>
              ))}
            </div>
          )}

          {/* Template Config */}
          {selectedTemplate && (
            <div className="p-3 bg-monokai-surface rounded-lg border border-monokai-border mb-3">
              <div className="text-xs font-bold text-monokai-fg mb-2">
                配置 {selectedTemplate.name}
              </div>

              {/* Column Selector (if needed) */}
              {selectedTemplate.params.some(p => p.name === 'column') && (
                <div className="mb-2">
                  <label className="block text-[10px] text-monokai-comment mb-1">选择字段</label>
                  <select
                    value={selectedColumn}
                    onChange={(e) => setSelectedColumn(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-monokai-accent rounded-lg bg-monokai-bg text-monokai-fg"
                  >
                    <option value="">选择字段...</option>
                    {columns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Dynamic Params */}
              {selectedTemplate.params
                .filter(p => p.name !== 'table' && p.name !== 'column')
                .map(param => (
                  <div key={param.name} className="mb-2">
                    <label className="block text-[10px] text-monokai-comment mb-1">
                      {param.name} {param.required && '*'}
                    </label>
                    {param.type === 'number' ? (
                      <input
                        type="number"
                        value={templateParams[param.name] || ''}
                        onChange={(e) => setTemplateParams({ ...templateParams, [param.name]: e.target.value })}
                        className="w-full px-2 py-1.5 text-xs border border-monokai-accent rounded-lg bg-monokai-bg text-monokai-fg"
                        placeholder={param.default ? String(param.default) : ''}
                      />
                    ) : (
                      <input
                        type="text"
                        value={templateParams[param.name] || ''}
                        onChange={(e) => setTemplateParams({ ...templateParams, [param.name]: e.target.value })}
                        className="w-full px-2 py-1.5 text-xs border border-monokai-accent rounded-lg bg-monokai-bg text-monokai-fg"
                        placeholder={param.default ? String(param.default) : ''}
                      />
                    )}
                  </div>
                ))}
            </div>
          )}

          {/* Add Button */}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setShowTemplateSelector(false);
                setSelectedTemplate(null);
              }}
              className="px-3 py-1.5 text-xs text-monokai-comment hover:text-monokai-fg"
            >
              取消
            </button>
            <button
              onClick={handleAddFromTemplate}
              disabled={!selectedTemplate || (selectedTemplate.params.some(p => p.name === 'column' && p.required) && !selectedColumn)}
              className="flex items-center gap-1 px-3 py-1.5 bg-monokai-red hover:bg-monokai-red/80 disabled:bg-monokai-sidebar text-white text-xs font-bold rounded-lg transition-colors"
            >
              <Plus size={12} />
              添加断言
            </button>
          </div>
        </div>
      )}

      {/* Assertions List */}
      {isExpanded && (
        <div className="p-4">
          {customAssertions.length === 0 ? (
            <div className="text-center py-8 text-monokai-comment">
              <HelpCircle size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-xs">暂无自定义断言</p>
              <p className="text-[10px] mt-1">点击上方"添加"按钮创建数据质量校验规则</p>
            </div>
          ) : (
            <div className="space-y-2">
              {customAssertions.map((assertion, idx) => {
                const status = getResultStatus(assertion.id);
                
                return (
                  <div 
                    key={assertion.id}
                    className="p-3 bg-monokai-bg rounded-lg border border-monokai-border hover:border-monokai-accent transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded flex items-center justify-center ${
                          assertion.category === 'null_check' ? 'bg-monokai-blue/20 text-monokai-blue' :
                          assertion.category === 'uniqueness' ? 'bg-monokai-amethyst/20 text-monokai-amethyst' :
                          assertion.category === 'range' ? 'bg-monokai-orange/20 text-monokai-orange' :
                          'bg-monokai-sidebar text-monokai-comment'
                        }`}>
                          {categoryIcons[assertion.category] || <FileText size={14} />}
                        </div>
                        <span className="text-xs font-bold text-monokai-fg">{assertion.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {/* Status Indicator */}
                        {status === 'pass' && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-monokai-green/20 text-monokai-green text-[10px] font-bold rounded">
                            <CheckCircle2 size={10} /> 通过
                          </span>
                        )}
                        {status === 'fail' && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-monokai-red/20 text-monokai-red text-[10px] font-bold rounded">
                            <AlertTriangle size={10} /> 失败
                          </span>
                        )}
                        {status === 'running' && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-monokai-blue/20 text-monokai-blue text-[10px] font-bold rounded">
                            <div className="w-3 h-3 border-2 border-monokai-blue border-t-transparent rounded-full animate-spin" />
                            运行中
                          </span>
                        )}
                        <button
                          onClick={() => onRunAssertion(assertion, idx)}
                          className="p-1 hover:bg-monokai-sidebar rounded transition-colors"
                          title="运行"
                        >
                          <Play size={12} className="text-monokai-comment" />
                        </button>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(assertion.sql);
                          }}
                          className="p-1 hover:bg-monokai-sidebar rounded transition-colors"
                          title="复制"
                        >
                          <Copy size={12} className="text-monokai-comment" />
                        </button>
                        <button
                          onClick={() => onRemoveAssertion(assertion.id)}
                          className="p-1 hover:bg-monokai-red/10 rounded transition-colors"
                          title="删除"
                        >
                          <Trash2 size={12} className="text-monokai-red/70" />
                        </button>
                      </div>
                    </div>

                    <p className="text-[10px] text-monokai-comment mb-2">{assertion.description}</p>
                    
                    <pre className="text-[10px] font-mono bg-slate-900 text-slate-300 p-2 rounded overflow-x-auto">
                      {assertion.sql}
                    </pre>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomAssertionPanel;
