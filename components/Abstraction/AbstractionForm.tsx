/**
 * AbstractionForm — 抽象表表单组件
 *
 * 用于创建和编辑抽象表，包含参数定义和示例输出编辑
 */

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { AbstractionTable, AbstractionSqlOperation, AbstractionLevel, SqlParameter } from '../../types';
import { OPERATION_CONFIG, LEVEL_CONFIG } from '../../types/abstraction';

const PARAM_TYPES: SqlParameter['type'][] = ['string', 'number', 'date', 'column', 'table'];

interface AbstractionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<AbstractionTable, 'id' | 'createdAt' | 'updatedAt'>) => void;
  editingTable?: AbstractionTable | null;
  domains: string[];
}

export const AbstractionForm: React.FC<AbstractionFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingTable,
  domains,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [domain, setDomain] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [operation, setOperation] = useState<AbstractionSqlOperation>('SELECT');
  const [concept, setConcept] = useState('');
  const [property, setProperty] = useState('');
  const [relation, setRelation] = useState('');
  const [instance, setInstance] = useState('');
  const [template, setTemplate] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  // 参数编辑状态
  const [parameters, setParameters] = useState<SqlParameter[]>([]);

  // 示例输出编辑状态
  const [sampleOutput, setSampleOutput] = useState('');

  // 初始化表单数据
  useEffect(() => {
    if (editingTable) {
      setName(editingTable.name);
      setDescription(editingTable.description || '');
      setDomain(editingTable.domain);
      setOperation(editingTable.sqlConfig.operation);
      setConcept(editingTable.abstractionPath.concept || '');
      setProperty(editingTable.abstractionPath.property || '');
      setRelation(editingTable.abstractionPath.relation || '');
      setInstance(editingTable.abstractionPath.instance || '');
      setTemplate(editingTable.sqlConfig.template);
      setTags(editingTable.tags);
      setParameters(editingTable.sqlConfig.parameters || []);
      setSampleOutput(editingTable.sqlConfig.sampleOutput || '');
    } else {
      setName('');
      setDescription('');
      setDomain(domains[0] || '通用');
      setOperation('SELECT');
      setConcept('');
      setProperty('');
      setRelation('');
      setInstance('');
      setTemplate('');
      setTags([]);
      setParameters([]);
      setSampleOutput('');
    }
    setNewDomain('');
    setNewTag('');
  }, [editingTable, isOpen, domains]);

  const handleSubmit = () => {
    if (!name.trim() || !template.trim() || !concept.trim()) {
      return;
    }

    const finalDomain = domain === '__new__' ? newDomain.trim() : domain;
    if (!finalDomain) return;

    const isPrefill = editingTable?.id === '__prefill__';

    onSubmit({
      name: name.trim(),
      description: description.trim(),
      domain: finalDomain,
      abstractionPath: {
        concept: concept.trim(),
        property: property.trim() || undefined,
        relation: relation.trim() || undefined,
        instance: instance.trim() || undefined,
      },
      sqlConfig: {
        operation,
        template: template.trim(),
        parameters: parameters.length > 0 ? parameters : undefined,
        sampleOutput: sampleOutput.trim() || undefined,
      },
      tags,
      isSystem: false,
      isFavorite: isPrefill ? false : (editingTable?.isFavorite || false),
    });
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  // 参数操作
  const handleAddParam = () => {
    setParameters([
      ...parameters,
      { name: '', type: 'string', description: '', required: false },
    ]);
  };

  const handleRemoveParam = (index: number) => {
    setParameters(parameters.filter((_, i) => i !== index));
  };

  const handleParamChange = (index: number, field: keyof SqlParameter, value: string | boolean) => {
    setParameters(parameters.map((p, i) => {
      if (i !== index) return p;
      return { ...p, [field]: value };
    }));
  };

  if (!isOpen) return null;

  const operations: AbstractionSqlOperation[] = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'AGGREGATE', 'JOIN', 'WINDOW', 'CTE'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="bg-monokai-sidebar border border-monokai-border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-monokai-border bg-monokai-sidebar">
          <h3 className="text-base font-semibold text-monokai-fg">
            {editingTable?.id === '__prefill__' ? '保存 AI 生成的模板' : editingTable ? '编辑抽象表' : '新建抽象表'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-monokai-surface text-monokai-comment hover:text-monokai-fg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 表单内容 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar bg-monokai-bg">
          {/* 基本信息 */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-monokai-fg uppercase tracking-wider">基本信息</h4>

            <div>
              <label className="block text-xs text-monokai-comment mb-1 font-medium">
                名称 <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：用户行为分析"
                className="w-full px-3 py-2 text-xs bg-monokai-surface border border-monokai-border rounded-lg text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-accent transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-monokai-comment mb-1 font-medium">描述</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="描述这个抽象表的用途..."
                rows={2}
                className="w-full px-3 py-2 text-xs bg-monokai-surface border border-monokai-border rounded-lg text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-accent transition-colors resize-none"
              />
            </div>

            <div>
              <label className="block text-xs text-monokai-comment mb-1 font-medium">
                领域 <span className="text-rose-400">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs bg-monokai-surface border border-monokai-border rounded-lg text-monokai-fg cursor-pointer"
                >
                  {domains.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                  <option value="__new__">+ 新建领域</option>
                </select>
                {domain === '__new__' && (
                  <input
                    type="text"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    placeholder="新领域名称"
                    className="flex-1 px-3 py-2 text-xs bg-monokai-surface border border-monokai-border rounded-lg text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-accent transition-colors"
                  />
                )}
              </div>
            </div>
          </div>

          {/* 抽象路径 */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-monokai-fg uppercase tracking-wider">抽象路径</h4>
            <p className="text-xs text-monokai-comment">
              基于 MECE 原则的四层抽象路径，从概念到实例逐层定义
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-monokai-comment mb-1 font-medium">
                  概念 <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  placeholder="例如：用户、订单"
                  className="w-full px-3 py-2 text-xs bg-monokai-surface border border-monokai-border rounded-lg text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-accent transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-monokai-comment mb-1 font-medium">属性</label>
                <input
                  type="text"
                  value={property}
                  onChange={(e) => setProperty(e.target.value)}
                  placeholder="例如：金额、日期"
                  className="w-full px-3 py-2 text-xs bg-monokai-surface border border-monokai-border rounded-lg text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-accent transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-monokai-comment mb-1 font-medium">关系</label>
                <input
                  type="text"
                  value={relation}
                  onChange={(e) => setRelation(e.target.value)}
                  placeholder="例如：AGGREGATE、JOIN"
                  className="w-full px-3 py-2 text-xs bg-monokai-surface border border-monokai-border rounded-lg text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-accent transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-monokai-comment mb-1 font-medium">实例</label>
                <input
                  type="text"
                  value={instance}
                  onChange={(e) => setInstance(e.target.value)}
                  placeholder="例如：orders、users"
                  className="w-full px-3 py-2 text-xs bg-monokai-surface border border-monokai-border rounded-lg text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-accent transition-colors"
                />
              </div>
            </div>
          </div>

          {/* SQL 配置 */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-monokai-fg uppercase tracking-wider">SQL 配置</h4>

            <div>
              <label className="block text-xs text-monokai-comment mb-1 font-medium">
                操作类型 <span className="text-rose-400">*</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {operations.map((op) => (
                  <button
                    key={op}
                    type="button"
                    onClick={() => setOperation(op)}
                    className={`px-3 py-1 text-xs rounded-lg transition-colors cursor-pointer ${
                      operation === op
                        ? 'bg-monokai-surface text-monokai-accent border border-monokai-border font-medium shadow-xs'
                        : 'bg-monokai-surface/60 text-monokai-comment border border-monokai-border hover:text-monokai-fg'
                    }`}
                  >
                    {OPERATION_CONFIG[op].label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-monokai-comment mb-1 font-medium">
                SQL 模板 <span className="text-rose-400">*</span>
              </label>
              <textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                placeholder="SELECT ... FROM ..."
                rows={8}
                className="w-full px-3 py-2 text-xs bg-monokai-surface border border-monokai-border rounded-lg text-monokai-fg font-mono placeholder-monokai-comment focus:outline-none focus:border-monokai-accent transition-colors resize-none"
              />
            </div>

            {/* 参数定义 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-monokai-comment font-medium">
                  参数定义
                </label>
                <button
                  type="button"
                  onClick={handleAddParam}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs text-monokai-fg bg-monokai-surface hover:bg-monokai-sidebar rounded-lg border border-monokai-border transition-colors cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 text-monokai-accent" />
                  添加参数
                </button>
              </div>

              {parameters.length === 0 ? (
                <p className="text-xs text-monokai-comment/70 py-2.5 px-3 bg-monokai-surface rounded-lg border border-monokai-border">
                  暂无参数，使用 {"{{param}}"} 格式在 SQL 模板中定义占位符
                </p>
              ) : (
                <div className="space-y-2">
                  {parameters.map((param, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-2.5 bg-monokai-surface rounded-lg border border-monokai-border">
                      <div className="flex-1 grid grid-cols-5 gap-2">
                        {/* 参数名 */}
                        <div>
                          <input
                            type="text"
                            value={param.name}
                            onChange={(e) => handleParamChange(idx, 'name', e.target.value)}
                            placeholder="名称"
                            className="w-full px-2 py-1.5 text-xs bg-monokai-bg border border-monokai-border rounded text-monokai-fg font-mono focus:outline-none focus:border-monokai-accent placeholder-monokai-comment/40"
                          />
                        </div>
                        {/* 类型 */}
                        <div>
                          <select
                            value={param.type}
                            onChange={(e) => handleParamChange(idx, 'type', e.target.value as SqlParameter['type'])}
                            className="w-full px-2 py-1.5 text-xs bg-monokai-bg border border-monokai-border rounded text-monokai-fg focus:outline-none focus:border-monokai-accent"
                          >
                            {PARAM_TYPES.map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>
                        {/* 描述 */}
                        <div className="col-span-2">
                          <input
                            type="text"
                            value={param.description}
                            onChange={(e) => handleParamChange(idx, 'description', e.target.value)}
                            placeholder="描述"
                            className="w-full px-2 py-1.5 text-xs bg-monokai-bg border border-monokai-border rounded text-monokai-fg focus:outline-none focus:border-monokai-accent placeholder-monokai-comment/40"
                          />
                        </div>
                        {/* 默认值 */}
                        <div>
                          <input
                            type="text"
                            value={param.defaultValue || ''}
                            onChange={(e) => handleParamChange(idx, 'defaultValue', e.target.value)}
                            placeholder="默认值"
                            className="w-full px-2 py-1.5 text-xs bg-monokai-bg border border-monokai-border rounded text-monokai-fg focus:outline-none focus:border-monokai-accent placeholder-monokai-comment/40"
                          />
                        </div>
                      </div>
                      {/* 必填 + 删除 */}
                      <div className="flex flex-col items-center gap-1.5">
                        <label className="flex items-center gap-1 cursor-pointer" title="必填">
                          <input
                            type="checkbox"
                            checked={param.required || false}
                            onChange={(e) => handleParamChange(idx, 'required', e.target.checked)}
                            className="w-3.5 h-3.5 rounded accent-rose-500 cursor-pointer"
                          />
                          <span className="text-[10px] text-rose-400">必填</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleRemoveParam(idx)}
                          className="p-1 text-monokai-comment hover:text-rose-400 transition-colors cursor-pointer"
                          title="删除参数"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 示例输出 */}
            <div>
              <label className="block text-xs text-monokai-comment mb-1 font-medium">
                示例输出
              </label>
              <textarea
                value={sampleOutput}
                onChange={(e) => setSampleOutput(e.target.value)}
                placeholder={"user_id | amount | rolling_sum\n101    | 1234  | 8765"}
                rows={4}
                className="w-full px-3 py-2 text-xs bg-monokai-surface border border-monokai-border rounded-lg text-monokai-fg font-mono placeholder-monokai-comment focus:outline-none focus:border-monokai-accent transition-colors resize-none"
              />
              <p className="text-[10px] text-monokai-comment/60 mt-1">
                使用管道符分隔列，换行分隔行。如需 Markdown 格式请保留 |---| 分隔行
              </p>
            </div>
          </div>

          {/* 标签 */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-monokai-fg uppercase tracking-wider">标签</h4>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 px-2 py-0.5 text-xs bg-monokai-surface text-monokai-fg-muted border border-monokai-border rounded-md"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-rose-400 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                placeholder="添加标签"
                className="flex-1 px-3 py-1.5 text-xs bg-monokai-surface border border-monokai-border rounded-lg text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-accent transition-colors"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3 py-1.5 text-xs bg-monokai-surface border border-monokai-border text-monokai-fg rounded-lg hover:bg-monokai-sidebar transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 text-monokai-accent" />
              </button>
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-3 px-5 py-3.5 border-t border-monokai-border bg-monokai-sidebar">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-monokai-comment hover:text-monokai-fg transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!name.trim() || !template.trim() || !concept.trim() || (domain === '__new__' && !newDomain.trim())}
            className="px-4 py-2 text-xs font-semibold bg-monokai-accent text-monokai-bg rounded-lg hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-xs"
          >
            {editingTable?.id === '__prefill__' || !editingTable ? '创建' : '保存修改'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AbstractionForm;
