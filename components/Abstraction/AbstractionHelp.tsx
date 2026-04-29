/**
 * AbstractionHelp — 帮助面板组件
 */

import React from 'react';
import {
  Target as TargetIcon,
  AlertTriangle,
  Lightbulb,
  BookOpen,
} from 'lucide-react';

export const ABSTRACTION_HELP_CONTENT = {
  title: '数据抽象表面板',
  description: '基于 MECE 原则设计的数据抽象层。层层展开：概念 → 属性 → 关系 → 实例，快速调用指定 SQL 能力。',
  scenarios: [
    '需要某个抽象层级的 SQL 模板（如"聚合查询"）',
    '想要复用已有的 SQL 逻辑模板',
    '需要基于"我的人生"场景生成 SQL 方案',
    '构建数据模型时的参考模板'
  ],
  commonErrors: [
    '抽象路径填写不完整，缺少必要层级',
    '表名和字段名使用了占位符而非实际名称',
    '生成的 SQL 未经测试直接执行',
    '忽略参数定义，模板不可复用'
  ],
  aiHints: [
    '描述"我的人生场景：心态→影响→工作"，AI 会生成相关的关系路径抽象',
    '输入"聚合分析"，AI 会建议聚合类型的抽象表模板',
    '想让 AI 生成完整抽象表，可以描述"概念→属性→关系→实例"四层结构',
    'AI 生成的 SQL 需要根据实际表名替换参数'
  ],
  quickStart: [
    '1. 选择领域和操作类型筛选',
    '2. 点击抽象表查看详情',
    '3. 查看 SQL 模板和参数定义',
    '4. 使用「AI 生成」创建新抽象表',
    '5. 插入或复制 SQL 到编辑器'
  ],
  bestPractices: [
    '抽象路径要遵循 MECE 原则：概念→属性→关系→实例',
    'SQL 模板使用参数占位符，便于复用',
    '为每个抽象表添加清晰的描述和标签',
    '定期维护抽象表，删除过时模板'
  ]
};

interface AbstractionHelpProps {
  compact?: boolean;
}

export const AbstractionHelp: React.FC<AbstractionHelpProps> = ({ compact = false }) => {
  const help = ABSTRACTION_HELP_CONTENT;

  if (compact) {
    return (
      <div className="space-y-3">
        {/* 适用场景 */}
        <div>
          <div className="flex items-center gap-1 text-[10px] font-medium text-monokai-green mb-1">
            <TargetIcon className="w-3 h-3" /> 适用场景
          </div>
          <ul className="space-y-0.5 text-[10px] text-monokai-comment">
            {help.scenarios.map((s, i) => (
              <li key={i}>• {s}</li>
            ))}
          </ul>
        </div>

        {/* 常见错误 */}
        <div>
          <div className="flex items-center gap-1 text-[10px] font-medium text-monokai-red mb-1">
            <AlertTriangle className="w-3 h-3" /> 常见错误
          </div>
          <ul className="space-y-0.5 text-[10px] text-monokai-comment">
            {help.commonErrors.map((s, i) => (
              <li key={i}>• {s}</li>
            ))}
          </ul>
        </div>

        {/* AI 提示 */}
        <div>
          <div className="flex items-center gap-1 text-[10px] font-medium text-monokai-purple mb-1">
            <Lightbulb className="w-3 h-3" /> AI 生成提示
          </div>
          <ul className="space-y-0.5 text-[10px] text-monokai-comment">
            {help.aiHints.slice(0, 2).map((s, i) => (
              <li key={i}>• {s}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 标题和描述 */}
      <div>
        <div className="text-xs font-semibold text-monokai-yellow mb-1">{help.title}</div>
        <div className="text-[10px] text-monokai-comment">{help.description}</div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {/* 适用场景 */}
        <div>
          <div className="flex items-center gap-1 text-[10px] font-medium text-monokai-green mb-1">
            <TargetIcon className="w-3 h-3" /> 适用场景
          </div>
          <ul className="space-y-0.5 text-[10px] text-monokai-comment">
            {help.scenarios.map((s, i) => (
              <li key={i}>• {s}</li>
            ))}
          </ul>
        </div>

        {/* 常见错误 */}
        <div>
          <div className="flex items-center gap-1 text-[10px] font-medium text-monokai-red mb-1">
            <AlertTriangle className="w-3 h-3" /> 常见错误
          </div>
          <ul className="space-y-0.5 text-[10px] text-monokai-comment">
            {help.commonErrors.map((s, i) => (
              <li key={i}>• {s}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* 最佳实践 */}
      <div className="p-2 bg-monokai-purple/10 rounded border border-monokai-purple/20">
        <div className="flex items-center gap-1 text-[10px] font-medium text-monokai-purple mb-1">
          <BookOpen className="w-3 h-3" /> 最佳实践
        </div>
        <ul className="space-y-0.5 text-[10px] text-monokai-comment">
          {help.bestPractices.map((s, i) => (
            <li key={i}>• {s}</li>
          ))}
        </ul>
      </div>

      {/* MECE 层级说明 */}
      <div className="p-2 bg-monokai-sidebar/50 rounded">
        <div className="text-[10px] font-medium text-monokai-purple mb-2">MECE 抽象层级</div>
        <ul className="space-y-1 text-[10px] text-monokai-comment">
          <li>• <span className="text-monokai-purple">概念(CONCEPT)</span>：业务实体抽象</li>
          <li>• <span className="text-monokai-blue">属性(PROPERTY)</span>：特征与度量</li>
          <li>• <span className="text-monokai-green">关系(RELATION)</span>：表间关联逻辑</li>
          <li>• <span className="text-monokai-yellow">实例(INSTANCE)</span>：具体表名与字段</li>
        </ul>
      </div>
    </div>
  );
};

export default AbstractionHelp;
