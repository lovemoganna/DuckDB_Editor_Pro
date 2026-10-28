import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActionButton, FormInput, FormSelect, ModalShell } from '../../ui/Workbench';
import { ChartRenderer } from '../../charts/ChartRenderer';
import { widgetRowsToChartSpec } from '../../../services/analysis/adapters/dashboardWidgetAdapter';
import { executeWidget, useWorkbenchRevision } from '../../../services/workbench/runtime';
import { fieldChartQuery, isNumericField, isTemporalField } from '../../../services/workbench/fieldChart';
import type { AnalysisFilter, DatasetDefinition, DashboardContext, WidgetSettings, WidgetQuerySpec } from '../../../services/workbench/analysisTypes';
import type { ChartConfig, SavedQuery } from '../../../types';
import { FilterEditor } from './WorkbenchControls';

export function DatasetFieldChartBuilder({open, onClose, datasets, initialDatasetId, query, settings, context, brush, onSave}: {
  open: boolean; onClose: () => void; datasets: DatasetDefinition[]; initialDatasetId?: string;
  query?: SavedQuery; settings?: WidgetSettings; context?: DashboardContext;
  brush?: Parameters<typeof executeWidget>[0]['brush'];
  onSave: (query: SavedQuery, settings: WidgetSettings) => Promise<void>;
}) {
  const [datasetId, setDatasetId] = useState(''), [name, setName] = useState('');
  const [dimension, setDimension] = useState(''), [series, setSeries] = useState(''), [measure, setMeasure] = useState('');
  const [aggregation, setAggregation] = useState<WidgetQuerySpec['aggregation']>('COUNT');
  const [timeGrain, setTimeGrain] = useState<WidgetQuerySpec['timeGrain']>();
  const [type, setType] = useState<ChartConfig['type']>('counter');
  const [filters, setFilters] = useState<AnalysisFilter[]>([]), [linked, setLinked] = useState(true);
  const [preview, setPreview] = useState<{key: string; result: Awaited<ReturnType<typeof executeWidget>>} | null>(null);
  const [fieldSearch, setFieldSearch] = useState('');
  const [activeDropZone, setActiveDropZone] = useState<'dimension' | 'series' | 'measure' | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const generation = useRef(0);
  const revision = useWorkbenchRevision();

  const dataset = datasets.find(d => d.id === datasetId);

  const filteredFields = useMemo(() => {
    if (!dataset) return [];
    if (!fieldSearch.trim()) return dataset.fields;
    const term = fieldSearch.toLowerCase().trim();
    return dataset.fields.filter(f => f.name.toLowerCase().includes(term) || f.type.toLowerCase().includes(term));
  }, [dataset, fieldSearch]);

  const handleResetSlots = () => {
    setDimension('');
    setSeries('');
    setMeasure('');
    setTimeGrain(undefined);
    setAggregation('COUNT');
  };
  useEffect(() => {
    if (!open) return;
    const spec = settings?.querySpec || query?.querySpec;
    setDatasetId(settings?.datasetId || spec?.datasetId || initialDatasetId || '');
    setName(settings?.title || query?.name || ''); setDimension(spec?.dimensions[0] || ''); setSeries(spec?.dimensions[1] || '');
    setMeasure(spec?.measure || ''); setAggregation(spec?.aggregation || 'COUNT'); setTimeGrain(spec?.timeGrain);
    setType(settings?.chartConfig?.type || query?.charts?.[0]?.type || 'counter');
    setFilters(settings?.filters || []); setLinked(settings?.linked !== false); setPreview(null); setError('');
  }, [open]);
  const draft = useMemo(() => {
    if (!dataset) return {error: '选择数据集后开始配置'};
    try { return {query: fieldChartQuery(dataset, datasets, {name, dimension, series, measure, aggregation, timeGrain, type})}; }
    catch (e) { return {error: (e as Error).message}; }
  }, [dataset, datasets, name, dimension, series, measure, aggregation, timeGrain, type]);
  const draftSettings: WidgetSettings = {datasetId, filters, linked};
  const key = JSON.stringify([draft.query, draftSettings, context, brush, revision]);
  useEffect(() => {
    const current = ++generation.current;
    if (!open || !draft.query) return;
    setError('');
    const timer = window.setTimeout(() => {
      void executeWidget({query: draft.query!, settings: draftSettings, datasets, context, brush, refresh: revision, params: {}})
        .then(result => {if (generation.current === current) setPreview({key, result});})
        .catch(e => {if (generation.current === current) setError((e as Error).message);});
    }, 300);
    return () => {window.clearTimeout(timer); generation.current++;};
  }, [open, key]);
  const ready = !!draft.query && preview?.key === key && !error;
  const dateDimension = dataset?.fields.some(f => f.name === dimension && isTemporalField(f.type));
  const fieldOptions = dataset?.fields.map(f => <option key={f.name} value={f.name}>{f.name} · {f.type}</option>);
  return <ModalShell open={open} onClose={() => {if (!saving) onClose();}} title={query ? '编辑字段与图表' : '创建图表'}
    description="选择字段即可建图，结果随配置更新。保存后可在首页继续修改。" size="xl"
    footer={<><ActionButton variant="secondary" disabled={saving} onClick={onClose}>取消</ActionButton>
      <ActionButton disabled={!ready || saving} onClick={() => void (async () => {
        if (!ready || !draft.query) return;
        setSaving(true); setError('');
        try {
          const chartConfig = {...draft.query.charts![0], id: settings?.chartConfig?.id || query?.charts?.[0]?.id || crypto.randomUUID()};
          await onSave({...draft.query, charts: [chartConfig]}, {...draftSettings, title: draft.query.name, chartConfig, querySpec: draft.query.querySpec}); onClose();
        }
        catch(e) {setError((e as Error).message);} finally {setSaving(false);}
      })()}>{saving ? '保存中…' : query ? '保存图表' : '加入首页'}</ActionButton></>}>
    <div className="grid gap-5 lg:grid-cols-[220px_minmax(250px,1.1fr)_minmax(300px,1.4fr)]">
      {/* 左侧：数据集与字段列表 (火山引擎风格字段面板) */}
      <aside className="min-w-0 space-y-3 rounded-lg border border-monokai-border bg-monokai-surface/50 p-3 flex flex-col">
        <div>
          <label className="text-2xs font-semibold text-monokai-fg-muted mb-1 block">选择数据集</label>
          <FormSelect sizeVariant="sm" aria-label="图表数据集" value={datasetId} onChange={e => {
            setDatasetId(e.target.value); setDimension(''); setSeries(''); setMeasure(''); setTimeGrain(undefined); setFilters([]);
          }}>
            <option value="">选择数据集</option>
            {datasets.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </FormSelect>
        </div>

        {dataset && (
          <div className="space-y-2">
            <div className="text-2xs text-monokai-comment flex items-center justify-between border-b border-monokai-border/80 pb-1.5">
              <span>可用字段 ({dataset.fields.length})</span>
              <span className="font-mono text-monokai-cyan text-3xs truncate max-w-[120px]" title={dataset.table || dataset.name}>
                {dataset.table || dataset.name}
              </span>
            </div>

            {/* 字段快速搜索 */}
            <div>
              <FormInput
                sizeVariant="sm"
                aria-label="搜索字段"
                placeholder="搜索字段名或类型..."
                value={fieldSearch}
                onChange={e => setFieldSearch(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>
        )}

        <p className="text-3xs text-monokai-comment">拖拽或点击字段放入槽位。</p>

        <div className="flex-1 space-y-3 overflow-y-auto pr-0.5 custom-scrollbar max-h-[480px]">
          {[false, true].map(numeric => {
            const list = filteredFields.filter(f => isNumericField(f.type) === numeric);
            return (
              <section key={String(numeric)}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-2xs font-bold text-monokai-fg">{numeric ? '指标 (数值度量)' : '维度 (分类/时间)'}</span>
                  <span className="text-3xs font-mono text-monokai-comment">
                    {list.length} / {dataset?.fields.filter(f => isNumericField(f.type) === numeric).length || 0}
                  </span>
                </div>
                <div className="space-y-1">
                  {list.map(f => {
                    const isTemp = isTemporalField(f.type);
                    const isNum = isNumericField(f.type);
                    const badgeColor = isTemp
                      ? 'bg-monokai-yellow/15 text-monokai-yellow border-monokai-yellow/30'
                      : isNum
                      ? 'bg-monokai-green/15 text-monokai-green border-monokai-green/30'
                      : 'bg-monokai-cyan/15 text-monokai-cyan border-monokai-cyan/30';
                    const typeText = isTemp ? '时间' : isNum ? '数值' : '文本';
                    const isSelected = dimension === f.name || series === f.name || measure === f.name;

                    return (
                      <div
                        key={f.name}
                        draggable
                        onDragStart={e => {
                          e.dataTransfer.setData('text/plain', f.name);
                          e.dataTransfer.setData('application/json', JSON.stringify({ name: f.name, isNumeric: numeric, isTemporal: isTemp }));
                        }}
                        aria-label={`选择${numeric ? '指标' : '维度'} ${f.name}`}
                        className={`group flex items-center justify-between gap-1.5 w-full rounded border px-2 py-1 text-left cursor-grab active:cursor-grabbing transition-colors ${
                          isSelected
                            ? 'border-monokai-cyan bg-monokai-cyan/15 text-monokai-fg font-medium'
                            : 'border-monokai-border bg-monokai-surface/80 hover:border-monokai-cyan/60 hover:bg-monokai-surface text-monokai-fg'
                        }`}
                      >
                        <button
                          type="button"
                          className="flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer"
                          onClick={() => {
                            if (numeric) {
                              setMeasure(f.name);
                              if (aggregation === 'COUNT') setAggregation('SUM');
                            } else {
                              if (!dimension) {
                                setDimension(f.name);
                                setTimeGrain(undefined);
                                if (type === 'counter') setType('bar');
                              } else if (!series && dimension !== f.name) {
                                setSeries(f.name);
                              } else {
                                setDimension(f.name);
                                setTimeGrain(undefined);
                              }
                            }
                          }}
                          title="点击选入，或拖拽至右侧槽位"
                        >
                          <span className={`px-1 py-0.2 rounded border text-3xs font-mono shrink-0 ${badgeColor}`}>
                            {typeText}
                          </span>
                          <span className="truncate text-xs font-mono" title={f.name}>{f.name}</span>
                        </button>
                        <span className="text-3xs text-monokai-comment font-mono shrink-0 opacity-60 group-hover:opacity-100">{f.type}</span>
                      </div>
                    );
                  })}
                  {dataset && list.length === 0 && (
                    <p className="text-3xs text-monokai-comment py-1.5 italic">
                      {fieldSearch ? '无匹配字段' : `无可用${numeric ? '数值指标' : '维度字段'}`}
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </aside>

      {/* 中间：配置区 (火山引擎字段槽位 + 聚合方式 + 图表类型 + 筛选) */}
      <section className="min-w-0 space-y-3 rounded-lg border border-monokai-border bg-monokai-surface/50 p-3">
        <label className="block">
          <span className="text-2xs font-semibold text-monokai-fg-muted mb-1 block">图表标题</span>
          <FormInput sizeVariant="sm" aria-label="图表标题" placeholder="自动使用数据集名称" value={name} onChange={e => setName(e.target.value)} />
        </label>

        {/* 字段配置架 (Shelves) - 支持拖放高亮与一键清除 */}
        <div className="space-y-2.5 rounded border border-monokai-border bg-monokai-elevated/40 p-2.5">
          <div className="flex items-center justify-between text-2xs pb-1 border-b border-monokai-border/60">
            <span className="font-bold text-monokai-fg">字段配置架 (拖放槽位)</span>
            {(dimension || series || measure) && (
              <button
                type="button"
                onClick={handleResetSlots}
                className="text-monokai-comment hover:text-monokai-pink text-3xs transition-colors cursor-pointer"
              >
                清空全部槽位
              </button>
            )}
          </div>

          {/* 主维度槽位 */}
          <div
            onDragOver={e => { e.preventDefault(); setActiveDropZone('dimension'); }}
            onDragLeave={() => setActiveDropZone(null)}
            onDrop={e => {
              e.preventDefault();
              setActiveDropZone(null);
              const fieldName = e.dataTransfer.getData('text/plain');
              if (fieldName) { setDimension(fieldName); setTimeGrain(undefined); if (type === 'counter') setType('bar'); }
            }}
            className={`flex flex-col gap-1 rounded border-2 border-dashed p-1.5 transition-colors ${
              activeDropZone === 'dimension'
                ? 'border-monokai-cyan bg-monokai-cyan/10'
                : 'border-monokai-border/80 hover:border-monokai-cyan/60 bg-monokai-surface/40'
            }`}
          >
            <div className="flex items-center justify-between text-2xs">
              <span className="font-semibold text-monokai-fg flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-monokai-cyan"></span>主维度 (X 轴 / 分组)
              </span>
              {dimension && (
                <button type="button" onClick={() => setDimension('')} className="text-monokai-comment hover:text-monokai-pink text-3xs cursor-pointer">
                  清空
                </button>
              )}
            </div>
            <FormSelect sizeVariant="sm" aria-label="图表维度" disabled={aggregation === 'DETAIL'} value={dimension} onChange={e => { setDimension(e.target.value); setTimeGrain(undefined); }}>
              <option value="">拖拽或选择字段（不分组）</option>
              {fieldOptions}
            </FormSelect>
          </div>

          {/* 第二维度 / 系列槽位 */}
          <div
            onDragOver={e => { e.preventDefault(); setActiveDropZone('series'); }}
            onDragLeave={() => setActiveDropZone(null)}
            onDrop={e => {
              e.preventDefault();
              setActiveDropZone(null);
              const fieldName = e.dataTransfer.getData('text/plain');
              if (fieldName) setSeries(fieldName);
            }}
            className={`flex flex-col gap-1 rounded border-2 border-dashed p-1.5 transition-colors ${
              activeDropZone === 'series'
                ? 'border-monokai-amethyst bg-monokai-amethyst/10'
                : 'border-monokai-border/80 hover:border-monokai-amethyst/60 bg-monokai-surface/40'
            }`}
          >
            <div className="flex items-center justify-between text-2xs">
              <span className="font-semibold text-monokai-fg flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-monokai-amethyst"></span>第二维度 / 系列 (颜色 / 堆叠)
              </span>
              {series && (
                <button type="button" onClick={() => setSeries('')} className="text-monokai-comment hover:text-monokai-pink text-3xs cursor-pointer">
                  清空
                </button>
              )}
            </div>
            <FormSelect sizeVariant="sm" aria-label="图表系列" disabled={aggregation === 'DETAIL'} value={series} onChange={e => setSeries(e.target.value)}>
              <option value="">拖拽或选择字段（无）</option>
              {fieldOptions}
            </FormSelect>
          </div>

          {/* 时间粒度 (仅当主维度为日期时间时展示) */}
          {dateDimension && (
            <div className="flex items-center gap-2 p-1.5 bg-monokai-surface/80 rounded border border-monokai-border">
              <span className="text-2xs text-monokai-yellow font-medium shrink-0">时间粒度:</span>
              <FormSelect sizeVariant="sm" aria-label="图表时间粒度" value={timeGrain || ''} onChange={e => setTimeGrain(e.target.value as WidgetQuerySpec['timeGrain'] || undefined)} className="text-xs">
                <option value="">原始时间</option>
                {[['day','日'],['week','周'],['month','月'],['year','年']].map(([id,label]) => (
                  <option key={id} value={id}>按{label}</option>
                ))}
              </FormSelect>
            </div>
          )}

          {/* 指标与聚合配置 */}
          <div
            onDragOver={e => { e.preventDefault(); setActiveDropZone('measure'); }}
            onDragLeave={() => setActiveDropZone(null)}
            onDrop={e => {
              e.preventDefault();
              setActiveDropZone(null);
              const fieldName = e.dataTransfer.getData('text/plain');
              if (fieldName) {
                setMeasure(fieldName);
                if (aggregation === 'COUNT') setAggregation('SUM');
              }
            }}
            className={`flex flex-col gap-1 rounded border-2 border-dashed p-1.5 transition-colors ${
              activeDropZone === 'measure'
                ? 'border-monokai-green bg-monokai-green/10'
                : 'border-monokai-border/80 hover:border-monokai-green/60 bg-monokai-surface/40'
            }`}
          >
            <div className="flex items-center justify-between text-2xs">
              <span className="font-semibold text-monokai-fg flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-monokai-green"></span>指标度量 (Y 轴 / 数值)
              </span>
              {measure && (
                <button type="button" onClick={() => setMeasure('')} className="text-monokai-comment hover:text-monokai-pink text-3xs cursor-pointer">
                  清空
                </button>
              )}
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-1.5">
              <FormSelect sizeVariant="sm" aria-label="图表聚合" value={aggregation} onChange={e => setAggregation(e.target.value as WidgetQuerySpec['aggregation'])}>
                {[['COUNT','记录数'],['SUM','求和'],['AVG','平均值'],['MIN','最小值'],['MAX','最大值'],['DETAIL','明细']].map(([id,label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </FormSelect>
              {!['COUNT','DETAIL'].includes(aggregation) ? (
                <FormSelect aria-label="图表指标" value={measure} onChange={e => setMeasure(e.target.value)}>
                  <option value="">选择数值字段</option>
                  {dataset?.fields.filter(f => isNumericField(f.type)).map(f => (
                    <option key={f.name} value={f.name}>{f.name}</option>
                  ))}
                </FormSelect>
              ) : (
                <div className="flex items-center px-2 py-1 text-2xs text-monokai-comment border border-monokai-border rounded bg-monokai-surface/40">
                  {aggregation === 'COUNT' ? '自动统计行数' : '完整明细数据'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 图表类型选择 */}
        <div>
          <span className="text-2xs font-semibold text-monokai-fg-muted mb-1.5 block">图表展示类型</span>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              ['counter', '指标卡'],
              ['bar', '柱状图'],
              ['line', '折线图'],
              ['area', '面积图'],
              ['pie', '饼图'],
              ['doughnut', '环形图'],
              ['table', '数据表'],
            ].map(([id, label]) => {
              const active = type === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setType(id as ChartConfig['type'])}
                  className={`rounded border px-2 py-1 text-2xs text-center font-medium transition-colors cursor-pointer ${
                    active
                      ? 'border-monokai-accent bg-monokai-accent/15 text-monokai-accent font-semibold shadow-xs'
                      : 'border-monokai-border bg-monokai-surface/80 hover:bg-monokai-surface hover:border-monokai-border-strong text-monokai-fg'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-3xs text-monokai-comment">金额按 currency / asset 等单位自动分组；分组指标卡会自动转为柱图或数据表。</p>
        <label className="flex items-center gap-2 text-2xs text-monokai-fg cursor-pointer select-none">
          <input type="checkbox" checked={linked} onChange={e => setLinked(e.target.checked)} className="rounded border-monokai-border text-monokai-accent focus:ring-monokai-accent/30"/>
          <span>参与首页筛选与图表联动</span>
        </label>
      </section>

      {/* 右侧：实时渲染画布与结果数据 */}
      <section className="min-w-0 flex flex-col rounded-lg border border-monokai-border bg-monokai-surface/50 p-3" aria-label="图表实时预览" aria-busy={!ready}>
        <div className="flex items-center justify-between border-b border-monokai-border/80 pb-2">
          <h3 className="font-semibold text-xs flex items-center gap-1.5 text-monokai-fg">
            <span className={`w-2 h-2 rounded-full ${ready ? 'bg-monokai-green animate-pulse' : 'bg-monokai-yellow'}`}></span>实时预览
          </h3>
          {ready && preview && (
            <span className="text-2xs font-mono text-monokai-comment">
              共 {preview.result.total} 组结果
            </span>
          )}
        </div>

        {!ready && (
          <div className="flex-1 flex flex-col items-center justify-center py-12 text-center min-h-[220px]">
            <p role="status" className="text-xs text-monokai-comment max-w-[240px]">
              {error || draft.error || '正在查询最新配置…'}
            </p>
          </div>
        )}

        {ready && preview && (
          <div className="flex-1 flex flex-col justify-between mt-3">
            <div className="h-72 w-full">
              <ChartRenderer chartSpec={widgetRowsToChartSpec(preview.result.rows, draft.query!.charts![0])}/>
            </div>
            <div className="mt-2 space-y-1.5 border-t border-monokai-border/60 pt-2">
              <p role="status" className="text-3xs text-monokai-comment">
                预览前 {preview.result.rows.length} 组数据 · 结果已通过统一 Registry 映射
              </p>
              {preview.result.notices.map((notice, i) => (
                <p key={i} className="text-3xs text-monokai-comment bg-monokai-surface/90 rounded px-1.5 py-0.5 border border-monokai-border">{notice}</p>
              ))}
              <details className="mt-1 text-2xs">
                <summary className="cursor-pointer text-monokai-cyan hover:underline">查看预览数据结构</summary>
                <pre className="overflow-auto max-h-36 mt-1 rounded border border-monokai-border bg-monokai-bg p-2 font-mono text-3xs text-monokai-fg-muted">
                  {JSON.stringify(preview.result.rows, (_, v) => typeof v === 'bigint' ? String(v) : v, 2)}
                </pre>
              </details>
            </div>
          </div>
        )}
      </section>
    </div>
    <details className="mt-4 rounded-lg border border-monokai-border bg-monokai-surface/40 p-2.5" open={filters.length > 0}>
      <summary className="cursor-pointer text-xs font-semibold text-monokai-fg">
        图表局部筛选条件{filters.length ? `（${filters.length}）` : ''}
      </summary>
      <div className="mt-2.5">
        <FilterEditor key={datasetId} datasets={dataset ? [dataset] : []} filters={filters} onChange={setFilters}/>
      </div>
    </details>
    {error && <p role="alert" className="mt-3 text-xs text-monokai-pink bg-monokai-pink/10 border border-monokai-pink/30 p-2 rounded">{error}</p>}
  </ModalShell>;
}
