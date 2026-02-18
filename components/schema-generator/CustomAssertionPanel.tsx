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
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div 
        className="flex items-center justify-between px-4 py-3 bg-rose-50/50 border-b border-gray-100 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Settings size={16} className="text-rose-500" />
          <h3 className="text-sm font-bold text-gray-800">自定义断言</h3>
          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-700 rounded-full">
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
          {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </div>

      {/* Template Selector */}
      {showTemplateSelector && (
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          {/* Category Tabs */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat 
                    ? 'bg-rose-500 text-white' 
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
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
                      ? 'border-rose-500 bg-rose-50'
                      : 'border-gray-200 hover:border-rose-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-gray-800">{template.name}</span>
                  </div>
                  <p className="text-[10px] text-gray-500">{template.description}</p>
                </button>
              ))}
            </div>
          )}

          {/* Template Config */}
          {selectedTemplate && (
            <div className="p-3 bg-white rounded-lg border border-gray-200 mb-3">
              <div className="text-xs font-bold text-gray-700 mb-2">
                配置 {selectedTemplate.name}
              </div>
              
              {/* Column Selector (if needed) */}
              {selectedTemplate.params.some(p => p.name === 'column') && (
                <div className="mb-2">
                  <label className="block text-[10px] text-gray-500 mb-1">选择字段</label>
                  <select
                    value={selectedColumn}
                    onChange={(e) => setSelectedColumn(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg"
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
                    <label className="block text-[10px] text-gray-500 mb-1">
                      {param.name} {param.required && '*'}
                    </label>
                    {param.type === 'number' ? (
                      <input
                        type="number"
                        value={templateParams[param.name] || ''}
                        onChange={(e) => setTemplateParams({ ...templateParams, [param.name]: e.target.value })}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg"
                        placeholder={param.default ? String(param.default) : ''}
                      />
                    ) : (
                      <input
                        type="text"
                        value={templateParams[param.name] || ''}
                        onChange={(e) => setTemplateParams({ ...templateParams, [param.name]: e.target.value })}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg"
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
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
            >
              取消
            </button>
            <button
              onClick={handleAddFromTemplate}
              disabled={!selectedTemplate || (selectedTemplate.params.some(p => p.name === 'column' && p.required) && !selectedColumn)}
              className="flex items-center gap-1 px-3 py-1.5 bg-rose-500 hover:bg-rose-600 disabled:bg-gray-300 text-white text-xs font-bold rounded-lg transition-colors"
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
            <div className="text-center py-8 text-gray-400">
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
                    className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded flex items-center justify-center ${
                          assertion.category === 'null_check' ? 'bg-blue-100 text-blue-600' :
                          assertion.category === 'uniqueness' ? 'bg-purple-100 text-purple-600' :
                          assertion.category === 'range' ? 'bg-orange-100 text-orange-600' :
                          'bg-gray-200 text-gray-600'
                        }`}>
                          {categoryIcons[assertion.category] || <FileText size={14} />}
                        </div>
                        <span className="text-xs font-bold text-gray-800">{assertion.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {/* Status Indicator */}
                        {status === 'pass' && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded">
                            <CheckCircle2 size={10} /> 通过
                          </span>
                        )}
                        {status === 'fail' && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded">
                            <AlertTriangle size={10} /> 失败
                          </span>
                        )}
                        {status === 'running' && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded">
                            <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                            运行中
                          </span>
                        )}
                        <button
                          onClick={() => onRunAssertion(assertion, idx)}
                          className="p-1 hover:bg-gray-200 rounded transition-colors"
                          title="运行"
                        >
                          <Play size={12} className="text-gray-500" />
                        </button>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(assertion.sql);
                          }}
                          className="p-1 hover:bg-gray-200 rounded transition-colors"
                          title="复制"
                        >
                          <Copy size={12} className="text-gray-500" />
                        </button>
                        <button
                          onClick={() => onRemoveAssertion(assertion.id)}
                          className="p-1 hover:bg-red-100 rounded transition-colors"
                          title="删除"
                        >
                          <Trash2 size={12} className="text-red-400" />
                        </button>
                      </div>
                    </div>
                    
                    <p className="text-[10px] text-gray-500 mb-2">{assertion.description}</p>
                    
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
