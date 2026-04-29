import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { AISkill } from '../../../types';
import { SkillFormField } from '../SkillFormField';
import { getSkillIcon, CATEGORY_DESIGN } from '../../theme/ai-skills';
import { Play, Check, AlertCircle, Loader2 } from 'lucide-react';

export type SkillNodeData = {
  skill: AISkill;
  inputs: Record<string, any>;
  status: 'idle' | 'running' | 'success' | 'error';
  errorMessage?: string;
  resultSql?: string;
  onChangeInput: (nodeId: string, fieldName: string, value: any) => void;
  currentTable?: string;
  currentColumns?: { name: string; type: string }[];
};

const SkillNode = ({ id, data, isConnectable }: NodeProps<SkillNodeData>) => {
  const { skill, inputs, onChangeInput, currentTable, currentColumns, status, errorMessage, resultSql } = data;
  const Icon = getSkillIcon(skill.id);
  const design = CATEGORY_DESIGN[skill.category] || CATEGORY_DESIGN.engineering;

  return (
    <div className={`w-[320px] rounded-lg border bg-monokai-surface shadow-xl ${status === 'running' ? 'border-monokai-green shadow-[0_0_15px_rgba(166,226,46,0.3)]' : status === 'error' ? 'border-monokai-pink' : 'border-monokai-sidebar'}`}>
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="!w-3 !h-3 !bg-monokai-green !border-2 !border-monokai-surface" />
      
      {/* Header */}
      <div className={`flex items-center gap-3 px-4 py-3 border-b border-monokai-sidebar rounded-t-lg ${design.colors.bgSubtle}`}>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${design.colors.bgSubtle} ${design.colors.text}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-monokai-fg truncate">{skill.name}</h3>
          <p className="text-[10px] text-monokai-comment truncate">{skill.description}</p>
        </div>
        <div>
          {status === 'running' && <Loader2 className="w-4 h-4 text-monokai-green animate-spin" />}
          {status === 'success' && <Check className="w-4 h-4 text-monokai-green" />}
          {status === 'error' && <AlertCircle className="w-4 h-4 text-monokai-pink" />}
        </div>
      </div>

      {/* Body: Form */}
      <div className="p-4 space-y-3 nodrag cursor-default">
        {skill.inputSchema.map(field => (
          <SkillFormField
            key={field.name}
            field={field}
            value={inputs[field.name]}
            onChange={(name, val) => onChangeInput(id, name, val)}
            errors={{}}
            currentTable={currentTable}
            currentColumns={currentColumns}
          />
        ))}
        {skill.inputSchema.length === 0 && (
          <div className="text-xs text-monokai-comment italic text-center py-2">无需参数</div>
        )}
      </div>

      {/* Status Output Previews */}
      {(resultSql || errorMessage) && (
        <div className="p-3 border-t border-monokai-sidebar bg-monokai-bg rounded-b-lg">
           {errorMessage && (
             <p className="text-[10px] text-monokai-pink font-mono break-all line-clamp-3">Error: {errorMessage}</p>
           )}
           {resultSql && !errorMessage && (
             <p className="text-[10px] text-monokai-green font-mono break-all line-clamp-3 overflow-hidden opacity-80">
               {resultSql}
             </p>
           )}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="!w-3 !h-3 !bg-monokai-green !border-2 !border-monokai-surface" />
    </div>
  );
};

export default memo(SkillNode);
