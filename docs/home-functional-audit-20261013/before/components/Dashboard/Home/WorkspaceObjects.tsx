import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Sparkles,
  Layers,
  AlertTriangle,
  Search,
  X,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { dbService } from '../../../services/dbService';
import { listAnalysisObjects, type AnalysisObject } from '../../../services/analysisObjects';
import { addObjectToDashboard, createHomeView, selectHomeView } from '../../../services/homeDashboardService';
import { refreshDatabaseAnalysis, useDatabaseAnalysis } from '../../../services/databaseAnalysis';
import { toastService } from '../../../services/toastService';
import { useAppStore } from '../../../hooks/store/useAppStore';
import type { Dashboard } from '../../../types';
import { openExecutiveWorkspace } from '../../../services/executiveWorkspace';
import { ActionButton, DrawerShell, FormInput, FormSelect } from '../../ui/Workbench';
import { cloneDashboard } from '../../../services/workbench/dashboardFormat';

const labels: Record<string, string> = { metric: '指标', chart: '可视化', analysis: '分析' };

export interface WorkspaceObjectsProps {
  board: Dashboard | null;
  onChange: (board: Dashboard) => void;
  controls?: React.ReactNode;
  createControls?: React.ReactNode;
  settings?: React.ReactNode;
  onCreateChart?: () => void;
}

export function WorkspaceObjects({ board, onChange, controls, createControls, settings, onCreateChart }: WorkspaceObjectsProps) {
  const activeDatabase = useAppStore(state => state.currentDatabase);
  const database = board?.databaseName || activeDatabase;
  const revision = useDatabaseAnalysis(state => state.revision);
  const [views, setViews] = useState<Dashboard[]>([]);
  const [objects, setObjects] = useState<AnalysisObject[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('all');
  const [busy, setBusy] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [managing, setManaging] = useState(false);

  const filteredObjects = objects.filter(object =>
    (kind === 'all' || kind === object.kind) &&
    object.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  useEffect(() => {
    let active = true;
    let generation = 0;
    const load = async () => {
      const request = ++generation;
      try {
        const [nextViews, nextObjects] = await Promise.all([
          dbService.getDashboards(database),
          listAnalysisObjects(database)
        ]);
        if (active && request === generation) {
          setViews(nextViews);
          setObjects(nextObjects);
          setError('');
        }
      } catch (err) {
        if (active && request === generation) setError(String((err as Error).message));
      }
    };
    void load();
    const events = [
      'duckdb-analysis-objects-updated',
      'duckdb-metrics-updated',
      'duckdb-metric-charts-updated',
      'duckdb-home-dashboard-updated'
    ];
    events.forEach(event => window.addEventListener(event, load));
    return () => {
      active = false;
      events.forEach(event => window.removeEventListener(event, load));
    };
  }, [database, revision, board?.id]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const handleAddObject = async (object: AnalysisObject) => {
    if (!board || object.unavailableReason) return;
    setAddingId(object.id);
    try {
      await run(async () => {
        const next = await addObjectToDashboard(object, board);
        onChange(next);
        toastService.success(`${object.name} 已加入当前视图`);
      });
    } finally {
      setAddingId(null);
    }
  };

  return (
    <section className="space-y-2.5 text-xs">
      <div className="flex flex-wrap gap-2 items-center">
        <label className="flex items-center gap-1.5 font-medium text-monokai-fg-muted">
          <span className="font-semibold text-monokai-fg">工作台</span>
          <FormSelect
            sizeVariant="sm"
            aria-label="工作台视图"
            value={board?.id || ''}
            disabled={busy}
            className="!w-auto min-w-[130px] max-w-full !text-xs font-medium"
            onChange={event => {
              const id = event.target.value;
              void run(async () => {
                await selectHomeView(id, database);
                const next = (await dbService.getDashboards(database)).find(view => view.id === id);
                if (next) onChange(next);
              });
            }}
          >
            {views.map(view => (
              <option key={view.id} value={view.id}>{view.name}</option>
            ))}
          </FormSelect>
        </label>

        <ActionButton
          size="sm"
          variant="secondary"
          title="高级分析：复用已有指标、图表和分析"
          disabled={busy || !board}
          onClick={() => setOpen(true)}
          icon={Plus}
        >
          添加分析
        </ActionButton>

        {controls}

        <ActionButton
          size="sm"
          variant={managing ? 'primary' : 'secondary'}
          aria-expanded={managing}
          disabled={busy}
          onClick={() => setManaging(value => !value)}
        >
          视图设置
        </ActionButton>
      </div>

      {managing && (
        <div className="flex flex-wrap gap-2 items-center rounded-lg border border-monokai-border/80 bg-monokai-surface/60 p-2.5 transition-all text-xs">
          <ActionButton
            size="sm"
            variant="secondary"
            disabled={busy}
            icon={RefreshCw}
            onClick={() => void run(async () => {
              await refreshDatabaseAnalysis();
              toastService.success('已发现新内容，原有布局与定义已保留');
            })}
          >
            重新发现数据
          </ActionButton>

          {objects.some(object => object.kind === 'metric' && object.id.startsWith('executive:')) && (
            <ActionButton
              size="sm"
              variant="secondary"
              className="text-monokai-cyan hover:text-monokai-cyan"
              disabled={busy}
              onClick={() => void run(async () => {
                onChange(await openExecutiveWorkspace());
              })}
            >
              打开资金总览
            </ActionButton>
          )}

          {settings}

          <div className="h-4 w-px bg-monokai-border/80 hidden sm:block mx-0.5" />

          <FormInput
            sizeVariant="sm"
            aria-label="视图名称"
            placeholder="新视图名称"
            value={name}
            onChange={event => setName(event.target.value)}
            className="!w-44 max-w-full"
          />
          <ActionButton
            size="sm"
            variant="secondary"
            disabled={busy || !name.trim()}
            onClick={() => void run(async () => {
              onChange(await createHomeView(name));
              setName('');
            })}
          >
            创建视图
          </ActionButton>
          <ActionButton
            size="sm"
            variant="secondary"
            disabled={busy || !board || !name.trim()}
            onClick={() => void run(async () => {
              if (!board) return;
              const next = await dbService.updateDashboard(board.id, database, current => ({ ...current, name: name.trim() }));
              onChange(next);
              setViews(views.map(view => view.id === next.id ? next : view));
              setName('');
            })}
          >
            重命名
          </ActionButton>
          <ActionButton
            size="sm"
            variant="secondary"
            disabled={busy || !board || !name.trim()}
            onClick={() => void run(async () => {
              if (!board) return;
              const current = (await dbService.getDashboards(database)).find(view => view.id === board.id);
              if (!current) throw new Error('此视图已移除，请重新选择');
              const next = cloneDashboard(current, name);
              await dbService.saveDashboard(next);
              await selectHomeView(next.id, database);
              onChange(next);
              setName('');
              window.dispatchEvent(new CustomEvent('duckdb-home-dashboard-updated'));
            })}
          >
            复制
          </ActionButton>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded border border-monokai-pink/30 bg-monokai-pink/10 px-2.5 py-1 text-2xs text-monokai-pink font-mono">
          {error}
        </p>
      )}

      <DrawerShell
        open={open}
        title="添加分析"
        description="复用指标、图表与分析内容，或直接创建新分析资产加入当前看板。"
        size="xl"
        onClose={() => setOpen(false)}
        closeLabel="关闭内容库"
      >
        <div className="space-y-3.5 text-xs">
          {/* MECE 快捷创建栏 */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-monokai-border/80 bg-monokai-surface/60 p-2.5">
            <div className="flex items-center gap-2 text-2xs text-monokai-comment">
              <Sparkles size={14} className="text-monokai-accent shrink-0" aria-hidden="true" />
              <span>新建分析资产</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {onCreateChart && (
                <ActionButton
                  size="sm"
                  variant="primary"
                  icon={BarChart3}
                  onClick={() => {
                    setOpen(false);
                    onCreateChart();
                  }}
                >
                  从数据集创建图表
                </ActionButton>
              )}
              {createControls}
            </div>
          </div>

          {/* 搜索与分类筛选栏 */}
          <div className="flex gap-2 items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-monokai-comment pointer-events-none" aria-hidden="true" />
              <FormInput
                sizeVariant="sm"
                aria-label="搜索分析对象"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="搜索指标、图表或分析"
                className="min-w-0 flex-1 pl-8 pr-7"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-monokai-comment hover:text-monokai-fg p-0.5 rounded cursor-pointer"
                  aria-label="清除搜索文字"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <FormSelect
              sizeVariant="sm"
              aria-label="分析对象类型"
              value={kind}
              onChange={event => setKind(event.target.value)}
              className="!w-auto shrink-0 font-medium"
            >
              <option value="all">全部类型 ({objects.length})</option>
              {Object.entries(labels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label} ({objects.filter(o => o.kind === key).length})
                </option>
              ))}
            </FormSelect>
          </div>

          <div className="flex items-center justify-between text-2xs text-monokai-comment px-0.5">
            <p role="status">
              {filteredObjects.length} / {objects.length} 个分析对象
            </p>
            {filteredObjects.length > 0 && (
              <span>点击「加入」添加至当前工作台</span>
            )}
          </div>

          {/* 分析对象网格卡片 */}
          <div className="grid gap-2.5 sm:grid-cols-2">
            {filteredObjects.map(object => {
              const isMetric = object.kind === 'metric';
              const isChart = object.kind === 'chart';
              const Icon = isMetric ? TrendingUp : isChart ? BarChart3 : Sparkles;
              const kindBadgeStyle = isMetric
                ? 'bg-monokai-green/15 text-monokai-green border-monokai-green/30'
                : isChart
                ? 'bg-monokai-cyan/15 text-monokai-cyan border-monokai-cyan/30'
                : 'bg-monokai-yellow/15 text-monokai-yellow border-monokai-yellow/30';
              const isAdding = addingId === object.id;
              const isAlreadyOnBoard = board?.items.some(
                item => item.savedQueryId === object.id || item.i === object.id
              );

              return (
                <div
                  key={`${object.kind}:${object.id}`}
                  className="group flex flex-col justify-between rounded-lg border border-monokai-border/80 bg-monokai-surface/60 p-3 hover:border-monokai-accent/40 hover:bg-monokai-surface transition-all gap-2"
                >
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-3xs font-mono font-medium shrink-0 ${kindBadgeStyle}`}>
                        <Icon size={11} aria-hidden="true" />
                        <span>{labels[object.kind] || object.kind}</span>
                      </span>
                      <span className="font-semibold text-xs text-monokai-fg truncate" title={object.name}>
                        {object.name}
                      </span>
                    </div>

                    {isAlreadyOnBoard && (
                      <span className="rounded bg-monokai-accent/15 border border-monokai-accent/30 px-1.5 py-0.2 text-3xs font-mono font-medium text-monokai-accent shrink-0">
                        已在看板
                      </span>
                    )}
                  </div>

                  {object.unavailableReason && (
                    <div className="flex items-center gap-1.5 text-2xs text-monokai-pink bg-monokai-pink/10 border border-monokai-pink/20 rounded px-2 py-1">
                      <AlertTriangle size={12} className="shrink-0" />
                      <span className="break-words">{object.unavailableReason}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between border-t border-monokai-border/60 pt-2 mt-0.5">
                    <span className="text-3xs font-mono text-monokai-comment truncate max-w-[140px]">
                      {object.id}
                    </span>
                    <ActionButton
                      size="sm"
                      variant="secondary"
                      disabled={busy || !board || !!object.unavailableReason || isAdding}
                      loading={isAdding}
                      title={object.unavailableReason || `将 ${object.name} 添加至当前工作台`}
                      className="shrink-0 text-monokai-cyan font-medium border border-monokai-border/80"
                      aria-label={`添加${labels[object.kind]} ${object.name}`}
                      onClick={() => void handleAddObject(object)}
                    >
                      加入
                    </ActionButton>
                  </div>
                </div>
              );
            })}

            {objects.length === 0 && (
              <div className="col-span-full rounded-lg border border-dashed border-monokai-border/90 bg-monokai-surface/40 p-8 text-center space-y-3">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-monokai-surface border border-monokai-border text-monokai-comment">
                  <Layers size={18} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-monokai-fg">暂无已保存的分析，可从数据集创建。</p>
                  <p className="mt-1 text-2xs text-monokai-comment">从已加载的数据集快速配置图表，或使用只读 SQL 组合数据集。</p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  {onCreateChart && (
                    <ActionButton
                      size="sm"
                      variant="primary"
                      icon={BarChart3}
                      onClick={() => {
                        setOpen(false);
                        onCreateChart();
                      }}
                    >
                      从数据集创建图表
                    </ActionButton>
                  )}
                  {createControls}
                </div>
              </div>
            )}

            {objects.length > 0 && filteredObjects.length === 0 && (
              <div className="col-span-full rounded-lg border border-monokai-border/80 bg-monokai-surface/40 p-6 text-center space-y-2">
                <p className="text-xs font-medium text-monokai-fg">没有匹配的分析内容</p>
                <p className="text-2xs text-monokai-comment">尝试更改搜索关键词或重置分类筛选条件</p>
                <ActionButton
                  size="sm"
                  variant="secondary"
                  className="mt-2"
                  onClick={() => {
                    setSearch('');
                    setKind('all');
                  }}
                >
                  清除筛选
                </ActionButton>
              </div>
            )}
          </div>
        </div>
      </DrawerShell>
    </section>
  );
}

