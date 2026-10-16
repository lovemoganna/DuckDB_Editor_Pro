import React, { useState, useEffect } from 'react';
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
  Database
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

export const PivotExtractMetricModal: React.FC<PivotExtractMetricModalProps> = ({
  isOpen,
  onClose,
  definition,
  onInsertSql,
}) => {
  const [extraction, setExtraction] = useState<PivotMetricExtractionResult | null>(null);
  const [metricName, setMetricName] = useState('');
  const [scenario, setScenario] = useState('');
  const [valueExplain, setValueExplain] = useState('');
  const [bizDef, setBizDef] = useState('');
  const [unit, setUnit] = useState('');
  const [sqlCode, setSqlCode] = useState('');

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

  if (!isOpen || !extraction) return null;

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(sqlCode);
      setCopied(true);
      toastService.success('SQL 已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toastService.error('复制失败，请手动选取');
    }
  };

  const handleOpenInSql = () => {
    if (onInsertSql) {
      onInsertSql(sqlCode, true);
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

      const res = saveMetricFromPivot(finalMetric, targetPkgId, targetPkgName);
      toastService.success(`指标「${metricName}」已成功沉淀至指标库！`);
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
              className={`${AH.btnGhost} text-xs py-1.5 px-3`}
              onClick={handleCopySql}
            >
              {copied ? <Check size={14} className="text-monokai-green" /> : <Copy size={14} />}
              {copied ? '已复制 SQL' : '复制标准 SQL'}
            </button>
            {onInsertSql && (
              <button
                type="button"
                className={`${AH.btnGhost} text-xs py-1.5 px-3 text-monokai-yellow hover:text-monokai-yellow/80`}
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
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 text-sm custom-scrollbar">
        {/* 口径治理提示 */}
        <div className="p-3 rounded-lg border border-monokai-border bg-monokai-bg flex items-start gap-2.5">
          {isAdditive ? (
            <ShieldCheck size={18} className="text-monokai-green shrink-0 mt-0.5" />
          ) : (
            <AlertCircle size={18} className="text-monokai-yellow shrink-0 mt-0.5" />
          )}
          <div className="text-xs leading-relaxed">
            <span className="font-semibold text-monokai-fg">
              {isAdditive ? '可加性度量（Additive）' : '非加法指标（Non-additive）'}
            </span>
            <p className="text-monokai-comment mt-0.5">
              {isAdditive
                ? '该指标为求和或计数，支持沿不同维度自由二次汇总累加。'
                : '该指标包含均值、去重或比率计算，跨组或跨维度分析时必须在基础事实表上重新计算，严禁在前端直接 SUM。'}
            </p>
          </div>
        </div>

        {/* 表单字段配置 */}
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

        {/* 指标包选择 */}
        <div className="p-3 rounded-lg border border-monokai-border bg-monokai-surface/60 space-y-2">
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
              className={`${AH.select} w-full text-xs`}
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
                决策价值
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

        {/* 标准 SQL 预览 */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-monokai-fg flex items-center gap-1.5">
              <Code2 size={14} className="text-monokai-blue" /> 生成的标准 DuckDB SQL（只读）
            </span>
            <span className="text-monokai-comment text-2xs">已自动绑定防膨胀 JOIN 与预设维度</span>
          </div>
          <pre className="p-3 bg-monokai-bg border border-monokai-border rounded-lg text-xs font-mono text-monokai-fg overflow-x-auto whitespace-pre-wrap max-h-48 custom-scrollbar">
            {sqlCode}
          </pre>
        </div>
      </div>
    </ModalShell>
  );
};
