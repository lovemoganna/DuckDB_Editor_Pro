/**
 * ValidationPopup — Skill validation result modal overlay
 *
 * Displays test validation results and diagnostic information.
 * Uses ModalShell for consistent workbench overlay chrome.
 */

import React from 'react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Wrench,
  Activity,
} from 'lucide-react';
import { AISkill, SkillResult } from '../../types';
import { CATEGORY_DESIGN } from '../theme/ai-skills';
import { getSkillIcon } from '../theme/ai-skills';
import { ModalShell, ActionButton } from '../ui/Workbench';

interface DiagnosticReport {
  issues: Array<{
    severity: 'error' | 'warning' | 'info';
    message: string;
    field?: string;
  }>;
  suggestions: string[];
  overallHealth: 'healthy' | 'degraded' | 'broken';
}

interface ValidationPopupProps {
  validationResult: SkillResult;
  diagnosticReport: DiagnosticReport | null;
  selectedSkill: AISkill;
  isValidating: boolean;
  onClose: () => void;
  onShowTestPanel: () => void;
  onAutoFix: (skill: AISkill) => void;
  onDiagnose: (skill: AISkill) => void;
}

function getValidationStatus(result: SkillResult) {
  if (result.success) {
    return {
      Icon: CheckCircle,
      tone: 'text-monokai-green',
      wrap: 'bg-monokai-green/10 border-monokai-green/30',
      label: '验证通过',
    };
  }
  return {
    Icon: XCircle,
    tone: 'text-monokai-pink',
    wrap: 'bg-monokai-pink/10 border-monokai-pink/30',
    label: '验证失败',
  };
}

function getHealthStatus(health: DiagnosticReport['overallHealth']) {
  switch (health) {
    case 'healthy':
      return { tone: 'text-monokai-green bg-monokai-green/15 border-monokai-green/40', label: '健康', Icon: CheckCircle };
    case 'degraded':
      return { tone: 'text-monokai-yellow bg-monokai-yellow/15 border-monokai-yellow/40', label: '部分异常', Icon: AlertTriangle };
    case 'broken':
      return { tone: 'text-monokai-pink bg-monokai-pink/15 border-monokai-pink/40', label: '严重问题', Icon: XCircle };
  }
}

const ISSUE_BORDER: Record<'error' | 'warning' | 'info', string> = {
  error: 'border-monokai-pink/30',
  warning: 'border-monokai-yellow/30',
  info: 'border-monokai-cyan/30',
};

export const ValidationPopup: React.FC<ValidationPopupProps> = ({
  validationResult,
  diagnosticReport,
  selectedSkill,
  isValidating,
  onClose,
  onShowTestPanel,
  onAutoFix,
  onDiagnose,
}) => {
  const skillDesign = CATEGORY_DESIGN[selectedSkill.category];
  const SkillIcon = getSkillIcon(selectedSkill.id);
  const status = getValidationStatus(validationResult);
  const StatusIcon = status.Icon;

  return (
    <ModalShell
      open
      title="技能验证结果"
      description={selectedSkill.name}
      onClose={onClose}
      size="md"
      icon={SkillIcon as any}
      iconColor={skillDesign.colors.text}
      footer={
        <>
          <ActionButton variant="secondary" icon={Activity} onClick={onShowTestPanel}>
            测试面板
          </ActionButton>
          <ActionButton
            variant="secondary"
            icon={Wrench}
            onClick={() => onDiagnose(selectedSkill)}
            disabled={isValidating}
          >
            重新诊断
          </ActionButton>
          <ActionButton
            variant="success"
            icon={Wrench}
            onClick={() => onAutoFix(selectedSkill)}
            disabled={isValidating}
          >
            自动修复
          </ActionButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${status.wrap}`}>
          <StatusIcon className={`w-5 h-5 shrink-0 ${status.tone}`} />
          <div className="flex-1">
            <span className={`text-sm font-medium ${status.tone}`}>{status.label}</span>
            {validationResult.explanation && (
              <p className="text-xs text-monokai-comment mt-1">{validationResult.explanation}</p>
            )}
            {validationResult.error && (
              <p className="text-xs text-monokai-pink mt-1 font-mono">{validationResult.error}</p>
            )}
          </div>
        </div>

        {diagnosticReport && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-monokai-comment" />
              <span className="text-xs font-medium text-monokai-fg">诊断报告</span>
              {(() => {
                const health = getHealthStatus(diagnosticReport.overallHealth);
                return (
                  <span className={`px-2 py-0.5 text-[10px] rounded border ${health.tone}`}>
                    {health.label}
                  </span>
                );
              })()}
            </div>

            {diagnosticReport.issues.length > 0 && (
              <div className="space-y-2 mb-3">
                {diagnosticReport.issues.map((issue, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-2 px-3 py-2 rounded-lg border bg-monokai-surface ${ISSUE_BORDER[issue.severity]}`}
                  >
                    {issue.severity === 'error' && (
                      <XCircle className="w-4 h-4 text-monokai-pink shrink-0 mt-0.5" />
                    )}
                    {issue.severity === 'warning' && (
                      <AlertTriangle className="w-4 h-4 text-monokai-yellow shrink-0 mt-0.5" />
                    )}
                    {issue.severity === 'info' && (
                      <Activity className="w-4 h-4 text-monokai-cyan shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      {issue.field && (
                        <span className="text-[10px] font-mono text-monokai-comment">
                          {issue.field}:{' '}
                        </span>
                      )}
                      <span className="text-xs text-monokai-fg">{issue.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {diagnosticReport.suggestions.length > 0 && (
              <div>
                <span className="text-[10px] text-monokai-comment font-mono mb-1 block">建议</span>
                <ul className="space-y-1">
                  {diagnosticReport.suggestions.map((suggestion, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-monokai-fg">
                      <span className="text-monokai-green mt-1">•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </ModalShell>
  );
};

export default ValidationPopup;
