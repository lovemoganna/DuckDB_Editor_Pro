import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ActionButton, DrawerShell, FormSelect } from '../ui/Workbench';
import '../Visualization/visualizationUi.css';
import { listChartTypes } from '../../services/analysis/chartRegistry';
import type { ChartConfig, ChartType } from '../../types';

const selectClass =
  'w-full min-h-8 rounded-md border border-monokai-border bg-monokai-bg px-2 py-1.5 text-xs font-mono text-monokai-fg';

export interface WidgetChartConfigPanelProps {
  columns: string[];
  config: ChartConfig;
  onChange: (next: ChartConfig) => void;
  onClose: () => void;
}

/**
 * In-widget field mapping: Label / Value / X / Y + unit + legend.
 */
export const WidgetChartConfigPanel: React.FC<WidgetChartConfigPanelProps> = ({
  columns,
  config,
  onChange,
  onClose,
}) => {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const saveInFlight = useRef(false);
  const apply = async () => {
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    setSaving(true);
    setSaveError('');
    try { await onChange(draft); }
    catch (error) { setSaveError(`配置未保存：${String((error as Error).message)}`); }
    finally { saveInFlight.current = false; setSaving(false); }
  };
  const [draft, setDraft] = useState<ChartConfig>({
    ...config,
    legendPosition: config.legendPosition || 'bottom',
    legendAlign: config.legendAlign || 'center',
    showLegend: config.showLegend !== false,
  });

  const isPie = draft.type === 'pie' || draft.type === 'doughnut';
  const isCounter = draft.type === 'counter' || draft.type === 'kpi';
  const cols = useMemo(() => (columns.length > 0 ? columns : [draft.xKey, ...(draft.yKeys || [])].filter(Boolean)), [
    columns,
    draft.xKey,
    draft.yKeys,
  ]);

  const patch = (partial: Partial<ChartConfig>) => setDraft((prev) => ({ ...prev, ...partial }));

  const toggleY = (key: string) => {
    setDraft((prev) => {
      const exists = prev.yKeys.includes(key);
      return {
        ...prev,
        yKeys: exists ? prev.yKeys.filter((k) => k !== key) : [...prev.yKeys, key],
      };
    });
  };

  return createPortal(
    <DrawerShell open title="图表字段配置" description="调整当前组件的字段、单位与显示方式，应用后保存。" onClose={onClose} closeLabel="关闭图表配置" size="lg" className="visualization-surface"
      footer={<div className="flex justify-end gap-2"><ActionButton size="sm" variant="secondary" onClick={onClose}>取消</ActionButton><ActionButton size="sm" variant="primary" disabled={saving} loading={saving} onClick={() => void apply()}>应用</ActionButton></div>}>
      <div className="space-y-4 text-xs">
      {saveError && <p role="alert" className="rounded border border-monokai-pink/30 bg-monokai-pink/10 p-2 text-monokai-pink">{saveError}</p>}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-0.5 block text-2xs text-monokai-comment">图表类型</label>
          <FormSelect aria-label="图表类型"
            className={selectClass}
            value={draft.type === 'counter' ? 'kpi' : draft.type}
            onChange={(e) => patch({ type: e.target.value as ChartType })}
          >
            {listChartTypes().filter(type => type.id !== 'counter').map(({id: t, label}) => (
              <option key={t} value={t}>
                {label}
              </option>
            ))}
            {draft.type === 'pivot' && <option value="pivot">透视表</option>}
          </FormSelect>
        </div>
        <div>
          <label className="mb-0.5 block text-2xs text-monokai-comment">计量单位</label>
          <input aria-label="计量单位"
            className={selectClass}
            value={draft.unit || ''}
            placeholder="¥ / 笔 / % / 件"
            onChange={(e) => patch({ unit: e.target.value, format: { ...draft.format, unit: e.target.value, percent: e.target.value === '%' } })}
          />
        </div>
      </div>

      {['table', 'pivot'].includes(draft.type) && <div className="space-y-3 rounded-lg border border-monokai-border p-3">
        <label className="block">表格展示
          <FormSelect aria-label="表格展示" value={draft.type} onChange={event => patch({type: event.target.value as ChartType})}>
            <option value="table">明细表</option><option value="pivot">透视表</option>
          </FormSelect>
        </label>
        {draft.type === 'pivot' && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label>行维度<FormSelect aria-label="透视行维度" value={draft.rowKey || draft.xKey} onChange={event => patch({rowKey: event.target.value, xKey: event.target.value})}>{cols.map(column => <option key={column}>{column}</option>)}</FormSelect></label>
          <label>列维度<FormSelect aria-label="透视列维度" value={draft.colKey || ''} onChange={event => patch({colKey: event.target.value})}><option value="">请选择列维度</option>{cols.map(column => <option key={column}>{column}</option>)}</FormSelect></label>
          <label>数值字段<FormSelect aria-label="透视数值字段" value={draft.valKey || draft.yKeys[0] || ''} onChange={event => patch({valKey: event.target.value, yKeys: [event.target.value]})}>{cols.map(column => <option key={column}>{column}</option>)}</FormSelect></label>
          <label>汇总方式<FormSelect aria-label="透视汇总方式" value={draft.aggFunc || 'sum'} onChange={event => patch({aggFunc: event.target.value as ChartConfig['aggFunc']})}><option value="sum">求和</option><option value="count">计数</option><option value="avg">平均值</option><option value="min">最小值</option><option value="max">最大值</option></FormSelect></label>
        </div>}
      </div>}

      <div className="grid grid-cols-2 gap-2">
        <label>小数位<input aria-label="小数位" type="number" min="0" max="20" className={selectClass} value={draft.format?.decimals ?? 2}
          onChange={e => patch({ format: { ...draft.format, decimals: Math.max(0, Math.min(20, Number(e.target.value))) } })}/></label>
        <label>千分位<FormSelect aria-label="千分位" className={selectClass} value={draft.format?.thousandSeparator === false ? 'off' : 'on'}
          onChange={e => patch({ format: { ...draft.format, thousandSeparator: e.target.value === 'on' } })}><option value="on">显示</option><option value="off">隐藏</option></FormSelect></label>
      </div>
      {!isCounter && <div className="grid grid-cols-2 gap-2">
        <label>Label<FormSelect aria-label="Label" className={selectClass} value={draft.labelKey || ''} onChange={e => patch({labelKey:e.target.value || undefined})}>
          <option value="">使用 X 维度</option>{cols.map(c => <option key={c} value={c}>{c}</option>)}
        </FormSelect></label>
        <label>Color<FormSelect aria-label="Color" className={selectClass} value={draft.colorKey || ''} onChange={e => patch({colorKey:e.target.value || undefined})}>
          <option value="">自动配色</option>{cols.map(c => <option key={c} value={c}>{c}</option>)}
        </FormSelect></label>
        <label>联动字段<FormSelect aria-label="联动字段" className={selectClass} value={draft.brushField || draft.xKey} onChange={e => patch({brushField:e.target.value})}>
          {cols.map(c => <option key={c} value={c}>{c}</option>)}
        </FormSelect></label>
      </div>}
      {draft.type === 'histogram' && <label className="block">分箱数量<input aria-label="分箱数量" type="number" min="1" max="200" className={selectClass} value={draft.binCount || ''} placeholder="自动"
        onChange={e => patch({ binCount: e.target.value ? Math.max(1, Math.min(200, Math.floor(Number(e.target.value)))) : undefined })}/></label>}
      {draft.type === 'histogram' && <div className="grid grid-cols-2 gap-2">
        <label>分箱宽度<input aria-label="分箱宽度" type="number" min="0" step="any" className={selectClass} value={draft.binWidth ?? ''}
          onChange={e => patch({ binWidth: e.target.value === '' ? undefined : Number(e.target.value) })}/></label>
        <label>纵轴指标<FormSelect aria-label="直方图纵轴指标" className={selectClass} value={draft.valueMode || 'absolute'} onChange={e => patch({valueMode:e.target.value as ChartConfig['valueMode']})}>
          <option value="absolute">频数</option><option value="percent">占比</option>
        </FormSelect></label>
      </div>}
      {draft.type === 'waterfall' && <label className="block">节点角色字段<FormSelect aria-label="节点角色字段" className={selectClass} value={draft.waterfallRoleKey || ''} onChange={e => patch({waterfallRoleKey:e.target.value || undefined})}>
        <option value="">按阶段名识别</option>{cols.map(column => <option key={column} value={column}>{column}</option>)}
      </FormSelect></label>}
      {isCounter && <div className="grid grid-cols-2 gap-2">
        <label>比较基准字段<FormSelect aria-label="比较基准字段" className={selectClass} value={draft.kpiBaselineKey || ''} onChange={e => patch({kpiBaselineKey:e.target.value || undefined})}>
          <option value="">无比较</option>{cols.filter(column => !draft.yKeys.includes(column)).map(column => <option key={column} value={column}>{column}</option>)}
        </FormSelect></label>
        <label>目标值<input aria-label="指标目标值" type="number" step="any" className={selectClass} value={draft.kpiTarget ?? ''} onChange={e => patch({kpiTarget:e.target.value === '' ? undefined : Number(e.target.value)})}/></label>
      </div>}
      {draft.type === 'combo' && <div className="grid grid-cols-2 gap-2">
        <label>右轴字段<FormSelect style={{height: 120}} aria-label="右轴字段" multiple className={selectClass} value={draft.yRightKeys || []}
          onChange={e => { const keys = Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => option.value); patch({ yRightKeys:keys, yKeys:draft.yKeys.filter(key => !keys.includes(key)) }); }}>
          {cols.map(c => <option key={c} value={c}>{c}</option>)}
        </FormSelect></label>
        <label>右轴单位<input aria-label="右轴单位" className={selectClass} value={draft.unitRight || ''} onChange={e => patch({unitRight:e.target.value})}/></label>
      </div>}

      {isPie ? (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-0.5 block text-2xs text-monokai-comment">Label</label>
            <FormSelect aria-label="Label" className={selectClass} value={draft.xKey} onChange={(e) => patch({ xKey: e.target.value })}>
              {cols.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </FormSelect>
          </div>
          <div>
            <label className="mb-0.5 block text-2xs text-monokai-comment">Value</label>
            <FormSelect aria-label="Value"
              className={selectClass}
              value={draft.yKeys[0] || ''}
              onChange={(e) => patch({ yKeys: e.target.value ? [e.target.value] : [] })}
            >
              {cols.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </FormSelect>
          </div>
        </div>
      ) : isCounter ? (
        <div>
          <label className="mb-0.5 block text-2xs text-monokai-comment">Value</label>
          <FormSelect aria-label="Value"
            className={selectClass}
            value={draft.yKeys[0] || draft.xKey || ''}
            onChange={(e) =>
              patch({
                xKey: e.target.value,
                yKeys: e.target.value ? [e.target.value] : [],
              })
            }
          >
            {cols.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </FormSelect>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-0.5 block text-2xs text-monokai-comment">X 轴</label>
            <FormSelect aria-label="X 轴" className={selectClass} value={draft.xKey} onChange={(e) => patch({ xKey: e.target.value })}>
              {cols.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </FormSelect>
          </div>
          <div>
            <label className="mb-0.5 block text-2xs text-monokai-comment">Y 轴</label>
            <div className="max-h-20 overflow-y-auto rounded border border-monokai-border bg-monokai-bg p-1 custom-scrollbar">
              {cols.map((c) => {
                const on = draft.yKeys.includes(c);
                return (
                  <label key={c} className="flex cursor-pointer items-center gap-1.5 px-1 py-0.5 text-2xs hover:bg-monokai-surface">
                    <input type="checkbox" checked={on} onChange={() => toggleY(c)} />
                    <span className={on ? 'text-monokai-fg' : 'text-monokai-comment'}>{c}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {draft.type === 'scatter' && <div>
        <label className="mb-0.5 block text-2xs text-monokai-comment">点大小映射</label>
        <FormSelect aria-label="点大小映射" className={selectClass} value={draft.sizeKey || ''} onChange={(e) => patch({ sizeKey: e.target.value || undefined })}>
          <option value="">固定大小</option>
          {cols.filter((c) => c !== draft.xKey).map((c) => <option key={c} value={c}>{c}</option>)}
        </FormSelect>
      </div>}

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="mb-0.5 block text-2xs text-monokai-comment">图例</label>
          <FormSelect aria-label="图例"
            className={selectClass}
            value={draft.showLegend === false ? 'off' : 'on'}
            onChange={(e) => patch({ showLegend: e.target.value === 'on' })}
          >
            <option value="on">显示</option>
            <option value="off">隐藏</option>
          </FormSelect>
        </div>
        <div>
          <label className="mb-0.5 block text-2xs text-monokai-comment">位置</label>
          <FormSelect aria-label="位置"
            className={selectClass}
            value={draft.legendPosition || 'bottom'}
            onChange={(e) => patch({ legendPosition: e.target.value as ChartConfig['legendPosition'] })}
          >
            <option value="bottom">底部</option>
            <option value="top">顶部</option>
            <option value="left">左侧</option>
            <option value="right">右侧</option>
          </FormSelect>
        </div>
        <div>
          <label className="mb-0.5 block text-2xs text-monokai-comment">对齐</label>
          <FormSelect aria-label="对齐"
            className={selectClass}
            value={draft.legendAlign || 'center'}
            onChange={(e) => patch({ legendAlign: e.target.value as ChartConfig['legendAlign'] })}
          >
            <option value="center">居中</option>
            <option value="start">起始</option>
            <option value="end">末尾</option>
          </FormSelect>
        </div>
      </div>
      {draft.type === 'scatter' && <div className="flex flex-wrap gap-3 text-xs text-monokai-fg">
        <label><input type="checkbox" checked={!!draft.showTrendLine} onChange={e => patch({showTrendLine:e.target.checked})}/> 趋势线</label>
        <label><input type="checkbox" checked={!!draft.highlightOutliers} onChange={e => patch({highlightOutliers:e.target.checked})}/> 标记异常点（趋势残差 IQR）</label>
      </div>}

      {!isCounter && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-0.5 block text-2xs text-monokai-comment">排序</label>
            <FormSelect aria-label="排序" className={selectClass} value={draft.categorySort || 'none'}
              onChange={(e) => patch({ categorySort: e.target.value as ChartConfig['categorySort'] })}>
              <option value="none">数据顺序</option>
              <option value="value_desc">数值从高到低</option>
              <option value="value_asc">数值从低到高</option>
              <option value="label_asc">标签升序</option>
              <option value="label_desc">标签降序</option>
            </FormSelect>
          </div>
          <div>
            <label className="mb-0.5 block text-2xs text-monokai-comment">Top N</label>
            <input aria-label="Top N" className={selectClass} type="number" min="1" max="1000" value={draft.topN || ''}
              placeholder="全部" onChange={(e) => patch({ topN: e.target.value ? Math.max(1, Math.floor(Number(e.target.value))) : undefined })} />
          </div>
          <div>
            <label className="mb-0.5 block text-2xs text-monokai-comment">分组字段</label>
            <FormSelect aria-label="分组字段" className={selectClass} value={draft.groupBy || ''} onChange={(e) => patch({ groupBy: e.target.value || undefined })}>
              <option value="">无分组</option>
              {cols.filter((c) => c !== draft.xKey && !draft.yKeys.includes(c)).map((c) => <option key={c} value={c}>{c}</option>)}
            </FormSelect>
          </div>
          <div>
            <label className="mb-0.5 block text-2xs text-monokai-comment">重复类别聚合</label>
            <FormSelect aria-label="重复类别聚合" className={selectClass} value={draft.aggregation || 'none'}
              onChange={(e) => patch({ aggregation: e.target.value as ChartConfig['aggregation'] })}>
              <option value="none">保留全部记录</option><option value="sum">求和</option><option value="avg">平均</option>
              <option value="count">计数</option><option value="min">最小</option><option value="max">最大</option>
            </FormSelect>
          </div>
        </div>
      )}

      {!isCounter && (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="mb-0.5 block text-2xs text-monokai-comment">数值标签</label>
            <FormSelect aria-label="数值标签"
              className={selectClass}
              value={draft.showValues === false ? 'off' : 'on'}
              onChange={(e) =>
                patch({
                  showValues: e.target.value === 'on',
                  labelMode: e.target.value === 'on' ? 'auto' : 'never',
                })
              }
            >
              <option value="on">显示 (避让)</option>
              <option value="off">隐藏</option>
            </FormSelect>
          </div>
          <div>
            <label className="mb-0.5 block text-2xs text-monokai-comment">堆叠</label>
            <FormSelect aria-label="堆叠"
              className={selectClass}
              value={draft.stackMode || (draft.stacked ? 'stack' : 'none')}
              onChange={(e) => {
                const stackMode = e.target.value as ChartConfig['stackMode'];
                patch({
                  stackMode,
                  stacked: stackMode === 'stack' || stackMode === 'percent',
                });
              }}
            >
              <option value="none">无</option>
              <option value="stack">堆叠</option>
              <option value="percent">百分比堆叠</option>
            </FormSelect>
          </div>
          <div>
            <label className="mb-0.5 block text-2xs text-monokai-comment">缺失值</label>
            <FormSelect aria-label="缺失值"
              className={selectClass}
              value={draft.missingValue || 'break'}
              onChange={(e) =>
                patch({ missingValue: e.target.value as ChartConfig['missingValue'] })
              }
            >
              <option value="break">断开</option>
              <option value="zero">填 0</option>
              <option value="forward_fill">前值填充</option>
            </FormSelect>
          </div>
        </div>
      )}
      </div>
    </DrawerShell>, document.body
  );
};
