/**
 * Skill Test Panel Component
 * 
 * Interactive UI for testing AI skills,
 * displaying test results and diagnostics.
 * 
 * Follows Monokai theme from DESIGN_SYSTEM.md
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  testSkill, 
  testAllSkills, 
  getTestHistory, 
  getTestSummary,
  downloadTestResultsJSON,
  downloadTestResultsHTML,
  SkillTestResult, 
  TestCaseResult,
  SkillIssue 
} from '../services/skillTester';
import { 
  diagnoseSkill, 
  getLatestDiagnostic,
  DiagnosticReport,
  DiagnosticResult 
} from '../services/skillDiagnostics';
import { getAllSkills } from '../services/skillRegistry';
import { AISkill, SkillCategory } from '../types';
import { 
  X,
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  AlertCircle,
  History,
  FileJson,
  FileCode,
  Download,
  RefreshCw,
  ShieldCheck,
  Beaker,
  Bug,
  Clock,
  Check,
  ChevronRight
} from 'lucide-react';

interface SkillTestPanelProps {
  skillId?: string;
  onClose?: () => void;
}

export const SkillTestPanel: React.FC<SkillTestPanelProps> = ({ skillId, onClose }) => {
  const [selectedSkillId, setSelectedSkillId] = useState<string>(skillId || '');
  const [testResult, setTestResult] = useState<SkillTestResult | null>(null);
  const [diagnosticReport, setDiagnosticReport] = useState<DiagnosticReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'test' | 'diagnostic' | 'history'>('test');
  const [testHistory, setTestHistory] = useState<SkillTestResult[]>([]);
  const [summary, setSummary] = useState({ totalTests: 0, passed: 0, failed: 0, averageExecutionTime: 0 });

  const skills = getAllSkills();

  useEffect(() => {
    if (skillId) {
      setSelectedSkillId(skillId);
    }
  }, [skillId]);

  useEffect(() => {
    setTestHistory(getTestHistory());
    setSummary(getTestSummary());
  }, []);

  const handleRunTest = useCallback(async () => {
    if (!selectedSkillId) return;
    
    setIsRunning(true);
    try {
      const result = await testSkill(selectedSkillId);
      setTestResult(result);
      
      const diagnostics = await diagnoseSkill(selectedSkillId, result);
      setDiagnosticReport(diagnostics);
      
      setTestHistory(getTestHistory());
      setSummary(getTestSummary());
    } catch (error) {
      console.error('Test failed:', error);
    } finally {
      setIsRunning(false);
    }
  }, [selectedSkillId]);

  const handleRunAllTests = useCallback(async () => {
    setIsRunning(true);
    try {
      const results = await testAllSkills();
      setTestHistory(results);
      setSummary(getTestSummary());
    } catch (error) {
      console.error('All tests failed:', error);
    } finally {
      setIsRunning(false);
    }
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-monokai-pink/20 text-monokai-pink border-monokai-pink/30';
      case 'high': return 'bg-monokai-orange/20 text-monokai-orange border-monokai-orange/30';
      case 'medium': return 'bg-monokai-yellow/20 text-monokai-yellow border-monokai-yellow/30';
      case 'low': return 'bg-monokai-blue/20 text-monokai-blue border-monokai-blue/30';
      default: return 'bg-monokai-comment/20 text-monokai-comment border-monokai-comment/30';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'sql': return <FileCode className="w-4 h-4 text-monokai-blue" />;
      case 'analysis': return <Beaker className="w-4 h-4 text-monokai-purple" />;
      case 'transformation': return <RefreshCw className="w-4 h-4 text-monokai-green" />;
      case 'optimization': return <AlertCircle className="w-4 h-4 text-monokai-orange" />;
      case 'utility': return <ShieldCheck className="w-4 h-4 text-monokai-comment" />;
      default: return <ShieldCheck className="w-4 h-4 text-monokai-accent" />;
    }
  };

  return (
    <div className="bg-monokai-bg border border-monokai-accent rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-monokai-accent flex items-center justify-between bg-gradient-to-r from-monokai-purple/10 to-monokai-pink/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-monokai-purple to-monokai-pink flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-monokai-fg">AI Skills 测试面板</h2>
            <p className="text-xs text-monokai-comment">验证技能功能，诊断问题，自动修复</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 text-monokai-comment hover:text-monokai-fg hover:bg-monokai-accent/30 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Skill Selector */}
      <div className="px-6 py-3 border-b border-monokai-accent bg-monokai-sidebar/50">
        <div className="flex items-center gap-3">
          <select
            value={selectedSkillId}
            onChange={(e) => setSelectedSkillId(e.target.value)}
            className="flex-1 px-3 py-2 bg-monokai-bg border border-monokai-accent rounded-lg text-sm text-monokai-fg focus:outline-none focus:ring-2 focus:ring-monokai-purple focus:border-transparent"
          >
            <option value="">选择要测试的技能...</option>
            {skills.map(skill => (
              <option key={skill.id} value={skill.id}>
                {skill.name} ({skill.category})
              </option>
            ))}
          </select>
          
          <button
            onClick={handleRunTest}
            disabled={!selectedSkillId || isRunning}
            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
              !selectedSkillId || isRunning
                ? 'bg-monokai-sidebar text-monokai-comment opacity-50 cursor-not-allowed'
                : 'bg-monokai-purple text-white hover:opacity-90'
            }`}
          >
            {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            <span>运行测试</span>
          </button>
          
          <button
            onClick={handleRunAllTests}
            disabled={isRunning}
            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
              isRunning
                ? 'bg-monokai-sidebar text-monokai-comment opacity-50 cursor-not-allowed'
                : 'bg-monokai-blue text-monokai-bg hover:opacity-90'
            }`}
          >
            {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Beaker className="w-4 h-4" />}
            <span>全部测试</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-4 border-b border-monokai-accent">
        <div className="flex gap-1">
          {([
            { id: 'test' as const, label: '测试结果', icon: Beaker },
            { id: 'diagnostic' as const, label: '诊断报告', icon: Bug },
            { id: 'history' as const, label: '历史记录', icon: History }
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-t-lg font-medium transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-monokai-sidebar text-monokai-purple border-t border-x border-monokai-accent -mb-px'
                  : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-accent/20'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'test' && (
          <div className="space-y-4">
            {testResult ? (
              <>
                {/* Test Summary */}
                <div className={`p-4 rounded-lg border ${
                  testResult.passed 
                    ? 'bg-monokai-green/10 border-monokai-green/30' 
                    : 'bg-monokai-pink/10 border-monokai-pink/30'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {testResult.passed ? (
                        <CheckCircle className="w-6 h-6 text-monokai-green" />
                      ) : (
                        <XCircle className="w-6 h-6 text-monokai-pink" />
                      )}
                      <div>
                        <h3 className="text-base font-semibold text-monokai-fg">
                          {testResult.passed ? '测试通过' : '测试失败'}
                        </h3>
                        <p className="text-xs text-monokai-comment">
                          {testResult.passedTests}/{testResult.totalTests} 测试用例通过
                          {' - '}执行时间: {testResult.executionTime}ms
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${testResult.passed ? 'text-monokai-green' : 'text-monokai-pink'}`}>
                        {testResult.passedTests}
                      </div>
                      <div className="text-xs text-monokai-comment">通过</div>
                    </div>
                  </div>
                </div>

                {/* Test Results List */}
                <div className="space-y-2">
                  <h4 className="font-medium text-monokai-fg text-sm">测试详情</h4>
                  {testResult.testResults.map((result, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border ${
                        result.passed 
                          ? 'bg-monokai-sidebar border-monokai-accent/50' 
                          : 'bg-monokai-pink/10 border-monokai-pink/30'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {result.passed ? (
                            <CheckCircle className="w-4 h-4 text-monokai-green" />
                          ) : (
                            <XCircle className="w-4 h-4 text-monokai-pink" />
                          )}
                          <span className="text-sm text-monokai-fg font-medium">{result.name}</span>
                        </div>
                        <span className="text-xs text-monokai-comment">{result.duration}ms</span>
                      </div>
                      {result.error && (
                        <p className="mt-2 text-xs text-monokai-pink">{result.error}</p>
                      )}
                      {result.details && (
                        <p className="mt-2 text-xs text-monokai-comment">{result.details}</p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Suggestions */}
                {testResult.suggestions.length > 0 && (
                  <div className="mt-4 p-4 bg-monokai-purple/10 rounded-lg border border-monokai-purple/30">
                    <h4 className="font-medium text-monokai-purple text-sm mb-2 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      建议
                    </h4>
                    <ul className="space-y-1">
                      {testResult.suggestions.map((suggestion, index) => (
                        <li key={index} className="text-xs text-monokai-comment flex items-start gap-2">
                          <ChevronRight className="w-3 h-3 text-monokai-purple mt-0.5 flex-shrink-0" />
                          <span>{suggestion}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-monokai-comment">
                <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-monokai-sidebar flex items-center justify-center">
                  <Beaker className="w-8 h-8 text-monokai-purple" />
                </div>
                <p className="text-sm">选择技能并点击"运行测试"开始验证</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'diagnostic' && (
          <div className="space-y-4">
            {diagnosticReport ? (
              <>
                {/* Diagnostic Summary */}
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { label: '严重', count: diagnosticReport.summary.critical, color: 'bg-monokai-pink text-monokai-fg' },
                    { label: '高', count: diagnosticReport.summary.high, color: 'bg-monokai-orange text-monokai-bg' },
                    { label: '中', count: diagnosticReport.summary.medium, color: 'bg-monokai-yellow text-monokai-bg' },
                    { label: '低', count: diagnosticReport.summary.low, color: 'bg-monokai-blue text-monokai-bg' },
                    { label: '可自动修复', count: diagnosticReport.summary.autoFixable, color: 'bg-monokai-green text-monokai-bg' }
                  ].map(item => (
                    <div key={item.label} className="text-center p-3 bg-monokai-sidebar rounded-lg border border-monokai-accent/50">
                      <div className={`text-xl font-bold rounded-full w-8 h-8 flex items-center justify-center mx-auto mb-1 ${item.color}`}>
                        {item.count}
                      </div>
                      <div className="text-xs text-monokai-comment">{item.label}</div>
                    </div>
                  ))}
                </div>

                {/* Diagnostics List */}
                <div className="space-y-2">
                  {diagnosticReport.diagnostics.map((diagnostic, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border ${getSeverityColor(diagnostic.severity)}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm text-monokai-fg">{diagnostic.title}</h4>
                          <p className="text-xs text-monokai-comment mt-1">{diagnostic.description}</p>
                          {diagnostic.location && (
                            <p className="text-xs text-monokai-comment mt-1">位置: {diagnostic.location}</p>
                          )}
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          diagnostic.severity === 'critical' ? 'bg-monokai-pink/30 text-monokai-pink' :
                          diagnostic.severity === 'high' ? 'bg-monokai-orange/30 text-monokai-orange' :
                          diagnostic.severity === 'medium' ? 'bg-monokai-yellow/30 text-monokai-yellow' :
                          'bg-monokai-blue/30 text-monokai-blue'
                        }`}>
                          {diagnostic.severity}
                        </span>
                      </div>
                      
                      {diagnostic.fix && (
                        <div className="mt-3 p-3 bg-monokai-bg rounded-lg border border-monokai-accent/50">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-monokai-fg">
                              {diagnostic.fix.type === 'auto' ? '自动修复' : '手动修复'}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              diagnostic.fix.risk === 'safe' ? 'bg-monokai-green/20 text-monokai-green' :
                              diagnostic.fix.risk === 'moderate' ? 'bg-monokai-yellow/20 text-monokai-yellow' :
                              'bg-monokai-pink/20 text-monokai-pink'
                            }`}>
                              {diagnostic.fix.risk} risk
                            </span>
                          </div>
                          <p className="text-xs text-monokai-comment">{diagnostic.fix.description}</p>
                          {diagnostic.fix.steps && (
                            <ol className="mt-2 list-decimal list-inside text-xs text-monokai-comment space-y-1">
                              {diagnostic.fix.steps.map((step, i) => (
                                <li key={i}>{step}</li>
                              ))}
                            </ol>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Recommendations */}
                {diagnosticReport.recommendations.length > 0 && (
                  <div className="mt-4 p-4 bg-monokai-sidebar rounded-lg border border-monokai-accent/50">
                    <h4 className="font-medium text-monokai-fg text-sm mb-2 flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-monokai-purple" />
                      总结
                    </h4>
                    <ul className="space-y-1">
                      {diagnosticReport.recommendations.map((rec, index) => (
                        <li key={index} className="text-xs text-monokai-comment flex items-start gap-2">
                          <ChevronRight className="w-3 h-3 text-monokai-accent mt-0.5 flex-shrink-0" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-monokai-comment">
                <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-monokai-sidebar flex items-center justify-center">
                  <Bug className="w-8 h-8 text-monokai-orange" />
                </div>
                <p className="text-sm">运行测试后查看诊断报告</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 bg-monokai-sidebar rounded-lg text-center border border-monokai-accent/50">
                <div className="text-2xl font-bold text-monokai-fg">{summary.totalTests}</div>
                <div className="text-xs text-monokai-comment">总测试数</div>
              </div>
              <div className="p-4 bg-monokai-green/10 rounded-lg text-center border border-monokai-green/30">
                <div className="text-2xl font-bold text-monokai-green">{summary.passed}</div>
                <div className="text-xs text-monokai-green">通过</div>
              </div>
              <div className="p-4 bg-monokai-pink/10 rounded-lg text-center border border-monokai-pink/30">
                <div className="text-2xl font-bold text-monokai-pink">{summary.failed}</div>
                <div className="text-xs text-monokai-pink">失败</div>
              </div>
              <div className="p-4 bg-monokai-blue/10 rounded-lg text-center border border-monokai-blue/30">
                <div className="text-2xl font-bold text-monokai-blue">{summary.averageExecutionTime}ms</div>
                <div className="text-xs text-monokai-blue">平均执行时间</div>
              </div>
            </div>

            {/* History List */}
            <div className="space-y-2">
              {testHistory.length > 0 ? (
                testHistory.map((result, index) => (
                  <div
                    key={index}
                    className="p-3 bg-monokai-sidebar border border-monokai-accent/50 rounded-lg hover:border-monokai-purple/50 cursor-pointer transition-colors"
                    onClick={() => {
                      setSelectedSkillId(result.skillId);
                      setTestResult(result);
                      setActiveTab('test');
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {result.passed ? (
                          <CheckCircle className="w-4 h-4 text-monokai-green" />
                        ) : (
                          <XCircle className="w-4 h-4 text-monokai-pink" />
                        )}
                        <span className="text-sm text-monokai-fg font-medium">{result.skillName}</span>
                      </div>
                      <div className="text-xs text-monokai-comment">
                        {result.passedTests}/{result.totalTests} 通过 - {result.executionTime}ms
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-monokai-comment">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-monokai-sidebar flex items-center justify-center">
                    <History className="w-8 h-8 text-monokai-comment" />
                  </div>
                  <p className="text-sm">暂无测试历史</p>
                </div>
              )}
            </div>

            {/* Export Buttons */}
            {testHistory.length > 0 && (
              <div className="flex gap-2 mt-4 pt-4 border-t border-monokai-accent">
                <button
                  onClick={() => downloadTestResultsJSON(testHistory)}
                  className="flex-1 px-4 py-2 bg-monokai-sidebar border border-monokai-accent hover:bg-monokai-accent/20 text-monokai-fg rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <FileJson className="w-4 h-4" />
                  导出JSON
                </button>
                <button
                  onClick={() => downloadTestResultsHTML(testHistory)}
                  className="flex-1 px-4 py-2 bg-monokai-sidebar border border-monokai-accent hover:bg-monokai-accent/20 text-monokai-fg rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <FileCode className="w-4 h-4" />
                  导出HTML
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SkillTestPanel;
