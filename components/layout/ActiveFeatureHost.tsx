import React from 'react';
import { CheckCircle2, CircleDot, Command, LayoutPanelTop, PanelRight, Sparkles } from 'lucide-react';
import { getWorkspaceFeature, WORKSPACE_FEATURES, type WorkspaceFeatureSection } from '../../services/workspaceNavigation';
import { Tab } from '../../types';
import { WorkbenchShell } from '../ui/WorkbenchShell';

export type WorkspaceFeatureRenderers = Partial<Record<Tab, () => React.ReactNode>>;

interface ActiveFeatureHostProps {
  activeTab: Tab;
  renderers: WorkspaceFeatureRenderers;
  onNavigate?: (tab: Tab) => void;
  context?: {
    currentTable?: string | null;
    tableCount?: number;
    runtimeLabel?: string;
    persistent?: boolean;
  };
}

const SECTION_LABELS: Record<WorkspaceFeatureSection, string> = {
  database: '数据工程',
  analytics: '分析洞察',
  knowledge: '知识网络',
  capability: 'AI 认知',
};

const INSPECTOR_DEFAULT_OPEN = new Set<Tab>(Object.values(Tab));

const FULL_BLEED_TABS = new Set<Tab>([
  Tab.DASHBOARD,
  Tab.DATA,
  Tab.STRUCTURE,
  Tab.SQL,
  Tab.ONTOLOGY,
  Tab.AI_SKILLS,
  Tab.AI_CAPABILITIES,
  Tab.COMPOSITIONAL_DEDUCTION,
  Tab.DATAFLOW,
  Tab.LIBRARY,
  Tab.TUTORIALS,
]);



const WorkspaceContextInspector: React.FC<{
  activeTab: Tab;
  onNavigate?: (tab: Tab) => void;
  context?: ActiveFeatureHostProps['context'];
}> = ({ activeTab, onNavigate, context }) => {
  const feature = getWorkspaceFeature(activeTab);
  const peers = WORKSPACE_FEATURES.filter(item => item.section === feature.section);

  return (
    <div className="flex h-full min-h-0 flex-col font-sans">
      <div className="context-ide-panel__header flex items-center gap-2 px-3">
        <PanelRight className="h-3.5 w-3.5 text-monokai-accent" />
        <span className="text-xs font-semibold text-monokai-fg">上下文</span>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3 custom-scrollbar">
        <section>
          <div className="mb-2 flex items-center gap-2 text-[10.5px] font-medium uppercase tracking-wider text-monokai-comment">
            <LayoutPanelTop className="h-3.5 w-3.5" /> 当前工作面
          </div>
          <div className="rounded-md border border-monokai-border bg-monokai-surface p-3">
            <div className="flex items-center gap-2">
              <CircleDot className="h-3.5 w-3.5 text-monokai-accent" />
              <span className="text-xs font-semibold text-monokai-fg">{feature.label}</span>
            </div>
            <p className="mt-1.5 text-[11px] leading-5 text-monokai-comment">{SECTION_LABELS[feature.section]} · Context IDE 工作面</p>
          </div>
        </section>

        <section>
          <div className="mb-2 text-[10.5px] font-medium uppercase tracking-wider text-monokai-comment">数据上下文</div>
          <dl className="overflow-hidden rounded-md border border-monokai-border bg-monokai-surface/60 text-[11px]">
            <div className="flex min-h-8 items-center justify-between gap-3 border-b border-monokai-border/70 px-2.5">
              <dt className="text-monokai-comment">当前表</dt>
              <dd className="max-w-[150px] truncate font-mono text-monokai-fg">{context?.currentTable || '未选择'}</dd>
            </div>
            <div className="flex min-h-8 items-center justify-between gap-3 border-b border-monokai-border/70 px-2.5">
              <dt className="text-monokai-comment">数据资产</dt>
              <dd className="font-mono text-monokai-fg">{context?.tableCount ?? 0} 张表</dd>
            </div>
            <div className="flex min-h-8 items-center justify-between gap-3 px-2.5">
              <dt className="text-monokai-comment">运行引擎</dt>
              <dd className="flex items-center gap-1.5 font-mono text-monokai-fg"><span className={`h-1.5 w-1.5 rounded-full ${context?.persistent ? 'bg-monokai-accent' : 'bg-monokai-warning'}`} />{context?.runtimeLabel || 'DuckDB'}</dd>
            </div>
          </dl>
        </section>

        <section>
          <div className="mb-2 text-[10.5px] font-medium uppercase tracking-wider text-monokai-comment">同组功能</div>
          <div className="overflow-hidden rounded-md border border-monokai-border bg-monokai-surface/60">
            {peers.map(peer => {
              const active = peer.tab === activeTab;
              return (
                <button
                  key={peer.tab}
                  type="button"
                  onClick={() => onNavigate?.(peer.tab)}
                  disabled={!onNavigate}
                  className={`flex h-8 w-full items-center gap-2 border-b border-monokai-border/70 px-2.5 text-left text-xs last:border-b-0 ${active ? 'bg-monokai-accent/10 text-monokai-accent' : 'text-monokai-fg-muted hover:bg-white/[0.04] hover:text-monokai-fg'} disabled:cursor-default`}
                >
                  {active ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="h-3.5 w-3.5" />}
                  <span>{peer.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2 text-[10.5px] font-medium uppercase tracking-wider text-monokai-comment">
            <Command className="h-3.5 w-3.5" /> 快捷操作
          </div>
          <div className="space-y-1 rounded-md border border-monokai-border bg-monokai-surface/60 p-2.5 text-[11px] text-monokai-fg-muted">
            <div className="flex items-center justify-between"><span>全局命令</span><kbd className="rounded border border-monokai-border bg-monokai-bg px-1.5 py-0.5 font-mono text-[10px]">Ctrl K</kbd></div>
            {activeTab === Tab.SQL && <div className="flex items-center justify-between"><span>执行查询</span><kbd className="rounded border border-monokai-border bg-monokai-bg px-1.5 py-0.5 font-mono text-[10px]">Ctrl Enter</kbd></div>}
          </div>
        </section>
      </div>
      <div className="flex h-7 shrink-0 items-center gap-2 border-t border-monokai-border px-3 text-[10px] font-mono text-monokai-comment">
        <Sparkles className="h-3 w-3 text-monokai-amethyst" />
        <span>Monokai Context IDE</span>
      </div>
    </div>
  );
};

export const ActiveFeatureHost: React.FC<ActiveFeatureHostProps> = ({
  activeTab,
  renderers,
  onNavigate,
  context,
}) => {
  const feature = getWorkspaceFeature(activeTab);
  const render = renderers[activeTab];

  if (!render) {
    return (
      <div
        role="alert"
        className="m-4 rounded border border-monokai-orange/40 bg-monokai-orange/10 p-4 text-sm text-monokai-orange"
      >
        {feature.label} is unavailable
      </div>
    );
  }

  // For standalone full-screen workbenches (Dashboard / SQL / AI Cognition features), render full-bleed directly
  if (FULL_BLEED_TABS.has(activeTab)) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden" data-workspace-feature={feature.tab}>
        {render()}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden" data-workspace-feature={feature.tab}>
      <WorkbenchShell
        featureId={feature.tab}
        right={<WorkspaceContextInspector activeTab={activeTab} onNavigate={onNavigate} context={context} />}
        commandBar={(
          <div className="flex h-full min-w-0 items-center gap-2 px-1 font-sans">
            <span className="text-[10.5px] text-monokai-comment">{SECTION_LABELS[feature.section]}</span>
            <span className="text-monokai-border-strong">/</span>
            <span className="truncate text-xs font-semibold text-monokai-fg">{feature.label}</span>
          </div>
        )}
        status={(
          <div className="flex w-full items-center justify-between gap-3">
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-monokai-accent" />工作区就绪</span>
            <span>{feature.label}</span>
          </div>
        )}
        defaultLayout={{ rightOpen: INSPECTOR_DEFAULT_OPEN.has(activeTab) }}
      >
        {render()}
      </WorkbenchShell>
    </div>
  );
};
