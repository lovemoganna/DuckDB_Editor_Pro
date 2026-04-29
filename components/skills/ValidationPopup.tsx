/**
 * ValidationPopup — Skill validation result modal overlay
 *
 * Displays test validation results and diagnostic information.
 * Self-contained modal overlay with auto-fix and diagnose actions.
 */

import React from 'react';
import {
  X,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Wrench,
  Activity,
} from 'lucide-react';
import { AISkill, SkillResult } from '../../types';
import { CATEGORY_DESIGN } from '../theme/ai-skills';
import { getSkillIcon } from '../theme/ai-skills';

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

/** Get status icon and color based on validation result */
function getValidationStatus(result: SkillResult) {
  if (result.success) {
    return {
      Icon: CheckCircle,
      color: '#a6e22e',
      bgColor: 'rgba(166, 226, 46, 0.1)',
      borderColor: 'rgba(166, 226, 46, 0.3)',
      label: '验证通过',
    };
  }
  return {
    Icon: XCircle,
    color: '#f92672',
    bgColor: 'rgba(249, 38, 114, 0.1)',
    borderColor: 'rgba(249, 38, 114, 0.3)',
    label: '验证失败',
  };
}

/** Get diagnostic health status */
function getHealthStatus(health: DiagnosticReport['overallHealth']) {
  switch (health) {
    case 'healthy':
      return { color: '#a6e22e', label: '健康', Icon: CheckCircle };
    case 'degraded':
      return { color: '#e6db74', label: '部分异常', Icon: AlertTriangle };
    case 'broken':
      return { color: '#f92672', label: '严重问题', Icon: XCircle };
  }
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg mx-4 rounded-xl border overflow-hidden"
        style={{
          background: '#1e1f1c',
          borderColor: '#3e3d32',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: '#3e3d32' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center border"
              style={{
                background: `${skillDesign.colors.primary}15`,
                borderColor: `${skillDesign.colors.primary}40`,
              }}
            >
              <SkillIcon
                className="w-5 h-5"
                style={{ color: skillDesign.colors.primary }}
              />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-monokai-fg">
                技能验证结果
              </h3>
              <p className="text-[10px] text-monokai-comment font-mono">
                {selectedSkill.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-monokai-comment hover:text-monokai-fg hover:bg-[#272822] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {/* Validation Status */}
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-lg border"
            style={{
              background: status.bgColor,
              borderColor: status.borderColor,
            }}
          >
            <StatusIcon className="w-5 h-5 shrink-0" style={{ color: status.color }} />
            <div className="flex-1">
              <span className="text-sm font-medium" style={{ color: status.color }}>
                {status.label}
              </span>
              {validationResult.explanation && (
                <p className="text-xs text-monokai-comment mt-1">
                  {validationResult.explanation}
                </p>
              )}
              {validationResult.error && (
                <p className="text-xs text-monokai-red mt-1 font-mono">
                  {validationResult.error}
                </p>
              )}
            </div>
          </div>

          {/* Diagnostic Report */}
          {diagnosticReport && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-monokai-comment" />
                <span className="text-xs font-medium text-monokai-fg">诊断报告</span>
                {(() => {
                  const health = getHealthStatus(diagnosticReport.overallHealth);
                  return (
                    <span
                      className="px-2 py-0.5 text-[10px] rounded border"
                      style={{
                        background: `${health.color}15`,
                        borderColor: `${health.color}40`,
                        color: health.color,
                      }}
                    >
                      {health.label}
                    </span>
                  );
                })()}
              </div>

              {/* Issues */}
              {diagnosticReport.issues.length > 0 && (
                <div className="space-y-2 mb-3">
                  {diagnosticReport.issues.map((issue, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 px-3 py-2 rounded-lg border"
                      style={{
                        background: '#272822',
                        borderColor:
                          issue.severity === 'error'
                            ? 'rgba(249, 38, 114, 0.3)'
                            : issue.severity === 'warning'
                            ? 'rgba(230, 219, 116, 0.3)'
                            : 'rgba(102, 217, 239, 0.3)',
                      }}
                    >
                      {issue.severity === 'error' && (
                        <XCircle className="w-4 h-4 text-monokai-red shrink-0 mt-0.5" />
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

              {/* Suggestions */}
              {diagnosticReport.suggestions.length > 0 && (
                <div>
                  <span className="text-[10px] text-monokai-comment font-mono mb-1 block">
                    建议
                  </span>
                  <ul className="space-y-1">
                    {diagnosticReport.suggestions.map((suggestion, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 text-xs text-monokai-fg"
                      >
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

        {/* Footer Actions */}
        <div
          className="flex items-center justify-end gap-3 px-5 py-4 border-t"
          style={{ borderColor: '#3e3d32' }}
        >
          <button
            onClick={onShowTestPanel}
            className="flex items-center gap-2 px-4 py-2 text-xs rounded-lg border text-monokai-comment hover:text-monokai-fg hover:border-[#49483e] transition-all"
            style={{ background: '#272822', borderColor: '#3e3d32' }}
          >
            <Activity className="w-3.5 h-3.5" />
            测试面板
          </button>
          <button
            onClick={() => onDiagnose(selectedSkill)}
            disabled={isValidating}
            className="flex items-center gap-2 px-4 py-2 text-xs rounded-lg border text-monokai-comment hover:text-monokai-fg hover:border-[#49483e] transition-all disabled:opacity-50"
            style={{ background: '#272822', borderColor: '#3e3d32' }}
          >
            <Wrench className="w-3.5 h-3.5" />
            重新诊断
          </button>
          <button
            onClick={() => onAutoFix(selectedSkill)}
            disabled={isValidating}
            className="flex items-center gap-2 px-4 py-2 text-xs rounded-lg border transition-all disabled:opacity-50"
            style={{
              background: isValidating ? 'rgba(166, 226, 46, 0.3)' : 'rgba(166, 226, 46, 0.15)',
              borderColor: 'rgba(166, 226, 46, 0.4)',
              color: '#a6e22e',
            }}
          >
            <Wrench className="w-3.5 h-3.5" />
            自动修复
          </button>
        </div>
      </div>
    </div>
  );
};

export default ValidationPopup;
