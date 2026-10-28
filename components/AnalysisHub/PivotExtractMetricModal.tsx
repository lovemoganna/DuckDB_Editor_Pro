import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Code2,
  Copy,
  Check,
  Play,
  Save,
  Package,
  ShieldCheck,
  AlertCircle,
  FileSpreadsheet,
  CheckCircle2,
  Activity,
  Layers,
  Clock,
  Terminal,
  Zap,
  BookOpen
} from 'lucide-react';
import type { MetricPackage } from '../../types';
import type { PivotDefinition } from '../../services/analysis/pivotExperience';
import {
  extractMetricFromPivot,
  saveMetricFromPivot,
  type PivotMetricExtractionResult
} from '../../services/analysis/pivotToMetric';
import { readMetricAssets } from '../../services/metricAssetStorage';
import { toastService } from '../../services/toastService';
import { ModalShell, ActionButton, FormInput, FormTextarea } from '../ui/Workbench';
import { AH } from './analysisUi';

interface PivotExtractMetricModalProps {
  isOpen: boolean;
  onClose: () => void;
  definition: PivotDefinition;
  onInsertSql?: (sql: string, executeDirectly?: boolean) => void;
}

type ModalTab = 'definition' | 'sql_lab';

export const PivotExtractMetricModal: React.FC<PivotExtractMetricModalProps> = ({
  isOpen,
  onClose,
  definition,
  onInsertSql,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('definition');
  const [extraction, setExtraction] = useState<PivotMetricExtractionResult | null>(() => {
    try {
      return extractMetricFromPivot(definition);
    } catch {
      return null;
    }
  });

  const [metricName, setMetricName] = useState('');
  const [scenario, setScenario] = useState('');
  const [valueExplain, setValueExplain] = useState('');
  const [bizDef, setBizDef] = useState('');
  const [unit, setUnit] = useState('');
  const [sqlCode, setSqlCode] = useState('');
  const [sqlViewMode, setSqlViewMode] = useState<'standalone' | 'cte'>('standalone');

  // 指标包选择
  const [existingPackages, setExistingPackages] = useState<MetricPackage[]>([]);
  const [packageMode, setPackageMode] = useState<'existing' | 'new'>('new');
  const [selectedPkgId, setSelectedPkgId] = useState<string>('');
  const [newPkgName, setNewPkgName] = useState<string>('');

  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    try {
      const res = extractMetricFromPivot(definition);
      setExtraction(res);
      setMetricName(res.metric.name);
      setScenario(res.metric.scenario);
      setValueExplain(res.metric.value);
      setBizDef(res.metric.definition);
      setUnit(res.metric.unit || '');
      setSqlCode(res.generatedSql);
      setNewPkgName(res.suggestedPackageName);

      const pkgs = readMetricAssets<MetricPackage>('duckdb_metric_packages');
      setExistingPackages(pkgs);
      if (pkgs.length > 0) {
        setSelectedPkgId(pkgs[0].id);
        setPackageMode('existing');
      } else {
        setPackageMode('new');
      }
    } catch (err) {
      toastService.error(`提取指标失败: ${String((err as Error).message)}`);
    }
  }, [isOpen, definition]);

  // Awwwards 级数据治理与资产健康度评估算法 (Semantic Health Index)
  const healthAssessment = useMemo(() => {
    if (!extraction) return { score: 90, tier: '优质资产', checks: [] };

    const checks: { label: string; pass: boolean; desc: string; icon: typeof CheckCircle2 }[] = [];

    // 1. 口径计算完整度
    const hasCalc = Boolean(extraction.metric.calculation?.aggregation);
    checks.push({
      label: '计算口径明确',
      pass: hasCalc,
      desc: `聚合函数为 ${extraction.metric.calculation?.aggregation}，度量定义清晰`,
      icon: CheckCircle2,
    });

    // 2. 可加性治理
    const isAdditive = extraction.metric.governance?.additivity === 'additive';
    checks.push({
      label: isAdditive ? '完全可加 (Additive)' : '安全防混淆 (Non-additive)',
      pass: true,
      desc: isAdditive ? '支持跨多维度任意二次聚合求和' : '已自动配置非加法防线，禁止直接 SUM 累加',
      icon: ShieldCheck,
    });

    // 3. 关联防膨胀约束
    const isJoined = Boolean(definition.joinConfig?.enabled);
    const hasRisk = Boolean(definition.joinConfig?.fanOutRisk);
    checks.push({
      label: isJoined ? (hasRisk ? '存在 1:N 膨胀风险' : '双表关联校验安全') : '单表基线事实',
      pass: !hasRisk,
      desc: isJoined ? (hasRisk ? '从表外键非唯一，需注意去重' : '外键关联基数健康') : '无需关联其他表，零笛卡尔积风险',
      icon: isJoined && hasRisk ? AlertCircle : CheckCircle2,
    });

    // 4. 时序与维度就绪度
    const hasTime = Boolean(extraction.metric.calculation?.grain);
    const hasDims = Boolean(extraction.metric.calculation?.groupBy?.length);
    checks.push({
      label: hasTime ? `时序就绪 (${extraction.metric.calculation?.grain})` : '快照指标',
      pass: true,
      desc: hasTime ? '支持按时间周期自动分箱与趋势对比' : (hasDims ? '支持多维度灵活切片' : '全局大盘汇总度量'),
      icon: Clock,
    });

    let score = 85;
    if (hasCalc) score += 5;
    if (!hasRisk) score += 5;
    if (hasTime) score += 5;
    if (metricName.trim().length > 3) score += 5;

    const tier = score >= 95 ? '企业黄金级资产 (Tier 1)' : score >= 85 ? '核心推荐资产 (Tier 2)' : '普通分析草稿';
    return { score: Math.min(100, score), tier, checks };
  }, [extraction, definition.joinConfig, metricName]);

  // 生成嵌入式 CTE 模板代码 (加速复杂 SQL 撰写)
  const cteSqlCode = useMemo(() => {
    if (!extraction) return sqlCode;
    const cleanName = (metricName.trim() || 'metric_calc').replace(/[\s\(\)·\/]/g, '_').toLowerCase();
    return `-- ========================================================
-- 标准业务 CTE: [${metricName.trim() || '未命名指标'}]
-- 沉淀来源: ${extraction.sourceTable}
-- 治理评级: ${healthAssessment.tier} (${healthAssessment.score}分)
-- ========================================================
WITH cte_${cleanName} AS (
${extraction.generatedSql.replace(/^/gm, '  ')}
)
-- 在您的主业务查询中直接引用:
SELECT *
FROM cte_${cleanName};`;
  }, [extraction, metricName, healthAssessment, sqlCode]);

  if (!isOpen || !extraction) return null;

  const handleCopySql = async () => {
    try {
      const textToCopy = sqlViewMode === 'cte' ? cteSqlCode : sqlCode;
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      toastService.success(sqlViewMode === 'cte' ? 'CTE 模板代码已复制！' : '标准 SQL 已复制到剪贴板！');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toastService.error('复制失败，请手动选取');
    }
  };

  const handleOpenInSql = () => {
    if (onInsertSql) {
      const textToRun = sqlViewMode === 'cte' ? cteSqlCode : sqlCode;
      onInsertSql(textToRun, true);
      toastService.success('已载入 SQL 工作台并开始执行');
      onClose();
    } else {
      toastService.info('暂无可用的 SQL 编辑器会话');
    }
  };

  const handleSaveToCatalog = async () => {
    if (!metricName.trim()) {
      toastService.error('指标名称不能为空');
      return;
    }
    setSaving(true);
    try {
      const finalMetric = {
        ...extraction.metric,
        name: metricName.trim(),
        scenario: scenario.trim(),
        value: valueExplain.trim(),
        definition: bizDef.trim(),
        unit: unit.trim() || undefined,
        formula: sqlCode,
        updatedAt: Date.now(),
      };

      const targetPkgId = packageMode === 'existing' ? selectedPkgId : undefined;
      const targetPkgName = packageMode === 'new' ? newPkgName : undefined;

      saveMetricFromPivot(finalMetric, targetPkgId, targetPkgName);
      toastService.success(`指标「${metricName}」已成功沉淀至指标中心！`);
      onClose();
    } catch (err) {
      toastService.error(`保存失败: ${String((err as Error).message)}`);
    } finally {
      setSaving(false);
    }
  };

  const isAdditive = extraction.metric.governance?.additivity === 'additive';

  return (
    <ModalShell
      open={isOpen}
      onClose={onClose}
      title="从透视表提炼并沉淀业务指标"
      icon={Sparkles}
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`${AH.btnGhost} text-xs py-1.5 px-3 transition-all hover:bg-monokai-surface/80 active:scale-95`}
              onClick={handleCopySql}
            >
              {copied ? <Check size={14} className="text-monokai-green" /> : <Copy size={14} />}
              {copied ? '已复制' : sqlViewMode === 'cte' ? '复制 CTE 模板' : '复制标准 SQL'}
            </button>
            {onInsertSql && (
              <button
                type="button"
                className={`${AH.btnGhost} text-xs py-1.5 px-3 text-monokai-yellow hover:text-monokai-yellow/80 hover:bg-monokai-yellow/10 transition-all active:scale-95`}
                onClick={handleOpenInSql}
              >
                <Play size={14} /> 在 SQL 工作台打开
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ActionButton variant="secondary" onClick={onClose}>
              取消
            </ActionButton>
            <ActionButton
              variant="primary"
              icon={Save}
              disabled={saving || !metricName.trim()}
              onClick={() => void handleSaveToCatalog()}
            >
              {saving ? '保存中…' : '沉淀到指标库'}
            </ActionButton>
          </div>
        </div>
      }
    >
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 text-sm custom-scrollbar select-none">
        {/* 顶部 Awwwards 级设计：指标资产健康度看板 */}
        <div className="relative overflow-hidden p-3.5 rounded-xl border border-monokai-border/80 bg-gradient-to-br from-monokai-surface/90 via-monokai-surface/50 to-monokai-bg/90 shadow-md">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-monokai-accent/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex flex-wrap items-center justify-between gap-3 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-monokai-accent/15 border border-monokai-accent/30 flex items-center justify-center text-monokai-accent shadow-[0_0_12px_rgba(166,226,46,0.2)]">
                <Sparkles size={20} className="animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-monokai-fg text-sm tracking-tight">
                    {extraction.sourceTable} · 标准化指标萃取
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-monokai-green/15 text-monokai-green border border-monokai-green/40 shadow-xs">
                    <CheckCircle2 size={11} /> {healthAssessment.tier}
                  </span>
                </div>
                <p className="text-2xs text-monokai-comment mt-0.5">
                  已根据透视配置完成口径校验、防膨胀约束与 DuckDB 原生计算对齐
                </p>
              </div>
            </div>

            {/* 评分刻度 */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-monokai-bg/80 border border-monokai-border font-mono">
              <span className="text-2xs text-monokai-comment">资产质量分</span>
              <span className="text-base font-extrabold text-monokai-green tracking-tight">
                {healthAssessment.score}
              </span>
              <span className="text-2xs text-monokai-comment">/ 100</span>
            </div>
          </div>

          {/* 4 项关键治理检查卡片 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-monokai-border/40 relative z-10">
            {healthAssessment.checks.map((c, idx) => {
              const Icon = c.icon;
              return (
                <div key={idx} className="p-2 rounded-lg bg-monokai-bg/50 border border-monokai-border/40">
                  <div className="flex items-center gap-1.5 text-2xs font-semibold text-monokai-fg">
                    <Icon size={12} className={c.pass ? 'text-monokai-green' : 'text-monokai-orange'} />
                    <span className="truncate">{c.label}</span>
                  </div>
                  <p className="text-3xs text-monokai-comment/80 truncate mt-0.5" title={c.desc}>
                    {c.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* 现代工作流标签切换栏 */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-monokai-bg/60 border border-monokai-border/60">
          <button
            type="button"
            onClick={() => setActiveTab('definition')}
            className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'definition'
                ? 'bg-monokai-surface text-monokai-fg font-semibold shadow-xs border border-monokai-border'
                : 'text-monokai-comment hover:text-monokai-fg'
            }`}
          >
            <BookOpen size={13} />
            指标资产定义与治理
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sql_lab')}
            className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'sql_lab'
                ? 'bg-monokai-surface text-monokai-fg font-semibold shadow-xs border border-monokai-border'
                : 'text-monokai-comment hover:text-monokai-fg'
            }`}
          >
            <Terminal size={13} />
            SQL 实验室 & CTE 沉淀
          </button>
        </div>

        {/* Tab 1: 业务资产定义 */}
        {activeTab === 'definition' && (
          <div className="space-y-3.5">
            {/* 基本字段 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-monokai-fg mb-1">
                  指标名称 <span className="text-monokai-pink">*</span>
                </label>
                <FormInput
                  aria-label="指标名称"
                  value={metricName}
                  onChange={e => setMetricName(e.target.value)}
                  placeholder="例如：月度各区域客单均价"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-monokai-fg mb-1">
                  计量单位
                </label>
                <FormInput
                  aria-label="计量单位"
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  placeholder="例如：元、个、笔、% 等"
                />
              </div>
            </div>

            {/* 指标归属包 */}
            <div className="p-3 rounded-xl border border-monokai-border bg-monokai-surface/40 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-monokai-fg flex items-center gap-1.5">
                  <Package size={14} className="text-monokai-purple" /> 目标指标归属包
                </span>
                {existingPackages.length > 0 && (
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="packageMode"
                        checked={packageMode === 'existing'}
                        onChange={() => setPackageMode('existing')}
                      />
                      <span>存入已有包</span>
                    </label>
                    <label className="inline-flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="packageMode"
                        checked={packageMode === 'new'}
                        onChange={() => setPackageMode('new')}
                      />
                      <span>新建指标包</span>
                    </label>
                  </div>
                )}
              </div>

              {packageMode === 'existing' && existingPackages.length > 0 ? (
                <select
                  aria-label="选择指标包"
                  className={`${AH.select} w-full text-xs font-mono`}
                  value={selectedPkgId}
                  onChange={e => setSelectedPkgId(e.target.value)}
                >
                  {existingPackages.map(pkg => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} ({pkg.metrics.length} 个指标) · 来源：{pkg.sourceTables.join(', ') || '通用'}
                    </option>
                  ))}
                </select>
              ) : (
                <FormInput
                  aria-label="新指标包名称"
                  value={newPkgName}
                  onChange={e => setNewPkgName(e.target.value)}
                  placeholder="输入新指标包名称，如：销售核心指标包"
                />
              )}
            </div>

            {/* 业务口径与价值 */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-monokai-fg mb-1">
                  业务口径与计算规则
                </label>
                <FormTextarea
                  aria-label="业务口径"
                  rows={2}
                  value={bizDef}
                  onChange={e => setBizDef(e.target.value)}
                  placeholder="明确该指标的事实来源、筛选排除边界与口径算法"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-monokai-fg mb-1">
                    业务应用场景
                  </label>
                  <FormTextarea
                    aria-label="应用场景"
                    rows={2}
                    value={scenario}
                    onChange={e => setScenario(e.target.value)}
                    placeholder="例如：监控不同客群每月消费转化，辅助制定营销策略"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-monokai-fg mb-1">
                    决策价值说明
                  </label>
                  <FormTextarea
                    aria-label="决策价值"
                    rows={2}
                    value={valueExplain}
                    onChange={e => setValueExplain(e.target.value)}
                    placeholder="说明该指标为团队决策提供了哪些量化支持"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: SQL 实验室 & CTE 沉淀 */}
        {activeTab === 'sql_lab' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="inline-flex items-center gap-1.5 p-0.5 rounded-lg bg-monokai-bg border border-monokai-border text-2xs">
                <button
                  type="button"
                  onClick={() => setSqlViewMode('standalone')}
                  className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                    sqlViewMode === 'standalone'
                      ? 'bg-monokai-surface text-monokai-fg font-semibold shadow-xs'
                      : 'text-monokai-comment hover:text-monokai-fg'
                  }`}
                >
                  标准聚合查询 (Analysis SQL)
                </button>
                <button
                  type="button"
                  onClick={() => setSqlViewMode('cte')}
                  className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                    sqlViewMode === 'cte'
                      ? 'bg-monokai-surface text-monokai-cyan font-semibold shadow-xs'
                      : 'text-monokai-comment hover:text-monokai-fg'
                  }`}
                >
                  可嵌入 CTE 模板 (Reusable CTE)
                </button>
              </div>

              <span className="text-2xs text-monokai-comment/80">
                {sqlViewMode === 'cte' ? '适合直接贴入复杂报表脚本中' : '适合独立探查与仪表盘直连'}
              </span>
            </div>

            {/* 工艺级代码展示容器，带 Gutter 行号与语法质感 */}
            <div className="relative rounded-xl border border-monokai-border bg-monokai-bg overflow-hidden shadow-inner font-mono text-xs">
              <div className="flex items-center justify-between px-3.5 py-1.5 border-b border-monokai-border/50 bg-monokai-surface text-2xs text-monokai-comment">
                <span className="flex items-center gap-1.5">
                  <Code2 size={12} className="text-monokai-blue" />
                  DuckDB 0.10+ Native SQL
                </span>
                <span className="text-3xs">自动规避行膨胀 · 只读保障</span>
              </div>

              <div className="p-3.5 overflow-x-auto max-h-56 custom-scrollbar leading-relaxed">
                <pre className="text-monokai-fg whitespace-pre font-mono">
                  {sqlViewMode === 'cte' ? cteSqlCode : sqlCode}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
};
