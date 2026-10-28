import React, { useMemo } from 'react';
import {
  Sparkles,
  TrendingUp,
  PieChart,
  GitBranch,
  Bot,
  Play,
  ArrowRight,
  Compass,
} from 'lucide-react';
import { Tab, type Dashboard } from '../../../types';
import type { TableItemDetail } from '../../../hooks/useDashboardWorkflow';
import type { AnalyticalCatalog } from '../../../types/analyticalCatalog';
import { useAppStore } from '../../../hooks/store/useAppStore';
import { useCopilotStore } from '../../../hooks/store/useCopilotStore';
import { toastService } from '../../../services/toastService';
import { DB } from '../dashboardUi';

export interface ExplorationPath {
  id: string;
  title: string;
  category: string;
  description: string;
  sql?: string;
  icon: 'trend' | 'distribution' | 'join' | 'copilot';
  targetTab?: Tab;
  suggestedPrompt?: string;
}

export interface HomeNextActionsProps {
  tables: TableItemDetail[];
  catalog?: AnalyticalCatalog | null;
  homeDashboard?: Dashboard | null;
  onNavigate: (tab: Tab) => void;
  onSelectQuery?: (sql: string, executeDirectly?: boolean) => void;
}

export const HomeNextActions: React.FC<HomeNextActionsProps> = ({
  tables = [],
  catalog,
  homeDashboard,
  onNavigate,
  onSelectQuery,
}) => {
  const setPendingSql = useAppStore((s) => s.setPendingSql);

  const explorationPaths = useMemo<ExplorationPath[]>(() => {
    if (tables.length === 0) {
      return [
        {
          id: 'import-first',
          title: '挂载或导入第一批数据',
          category: '数据准备',
          description: '支持 CSV、Parquet、Excel、JSON。拖拽文件到窗口或点击顶部「导入数据」开始。',
          icon: 'join',
          targetTab: Tab.DATA,
        },
        {
          id: 'copilot-explore',
          title: '向 AI Copilot 咨询分析思路',
          category: 'AI 引导',
          description: '描述你的业务场景，AI 可协助设计 DuckDB Schema 并生成种子分析 SQL。',
          icon: 'copilot',
          suggestedPrompt: '我想做一个业务分析系统，请推荐适合 DuckDB 的数据建模结构与分析指标设计。',
        },
      ];
    }

    const paths: ExplorationPath[] = [];

    const resolveTableName = (t: { name?: string; tableName?: string } | undefined): string => {
      if (!t) return 'data_table';
      return (t as any).tableName || (t as any).name || 'data_table';
    };

    // 1. Time-series analysis path
    const timeTable = catalog?.tables.find((t) => t.readiness.hasTime) || tables[0];
    const timeTableName = resolveTableName(timeTable);
    const timeCol = catalog?.timeDimensions?.[0]?.columnName || 'order_date';
    if (timeTable) {
      paths.push({
        id: 'trend-analysis',
        title: `时序趋势与周期洞察 (${timeTableName})`,
        category: '趋势探索',
        description: `基于时间字段「${timeCol}」按周期聚合观察指标波动、环比变化与峰值规律。`,
        icon: 'trend',
        sql: `SELECT 
  DATE_TRUNC('month', "${timeCol}") AS time_period,
  COUNT(*) AS total_count
FROM "${timeTableName}"
WHERE "${timeCol}" IS NOT NULL
GROUP BY 1
ORDER BY 1 ASC;`,
        suggestedPrompt: `请基于表 ${timeTableName} 的 ${timeCol} 时间字段，为我设计深度时序分析与环比指标。`,
      });
    }

    // 2. Category distribution path
    const catTable = catalog?.tables.find((t) => t.readiness.hasCategory) || tables[0];
    const catTableName = resolveTableName(catTable);
    const catCol = catalog?.categoryDimensions?.[0]?.columnName || 'category';
    if (catTable) {
      paths.push({
        id: 'distribution-analysis',
        title: `多维分布与 TOP 细分 (${catTableName})`,
        category: '结构细分',
        description: `基于维度「${catCol}」拆解整体构成，挖掘头部贡献与长尾分布。`,
        icon: 'distribution',
        sql: `SELECT 
  "${catCol}",
  COUNT(*) AS item_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS percentage
FROM "${catTableName}"
WHERE "${catCol}" IS NOT NULL
GROUP BY 1
ORDER BY item_count DESC
LIMIT 10;`,
        suggestedPrompt: `请基于表 ${catTableName} 的分类维度 ${catCol}，分析构成占比并寻找潜在异常。`,
      });
    }

    // 3. Multi-table correlation or DataFlow path
    if (tables.length > 1) {
      const t1 = tables[0].name;
      const t2 = tables[1].name;
      paths.push({
        id: 'join-analysis',
        title: `跨表关联与实体流转 (${t1} ⨝ ${t2})`,
        category: '关联分析',
        description: `探查核心业务实体在「${t1}」与「${t2}」之间的关联关系与漏斗流转。`,
        icon: 'join',
        sql: `SELECT * FROM "${t1}" LIMIT 50;`,
        targetTab: Tab.DATAFLOW,
        suggestedPrompt: `请帮我分析表 ${t1} 与表 ${t2} 的关联外键与数据血缘关系，并编写 JOIN 分析查询。`,
      });
    }

    // 4. AI Copilot deep-dive recommendation
    const boardSummary = homeDashboard?.items.length
      ? `看板已沉淀 ${homeDashboard.items.length} 个核心指标组件`
      : '基于当前工作区数据资产';
    paths.push({
      id: 'copilot-deep-dive',
      title: 'AI Copilot 全局下钻与归因分析',
      category: '智能洞察',
      description: `${boardSummary}，结合当前业务上下文寻找潜在增长拐点、异常波动并生成下钻建议。`,
      icon: 'copilot',
      suggestedPrompt: `请基于当前首页看板的真实指标与数据资产，帮我做一次全面的归因分析，并推荐 3 条高价值下钻分析 SQL。`,
    });

    return paths;
  }, [tables, catalog, homeDashboard]);

  const handleLaunchPath = (path: ExplorationPath) => {
    if (path.sql) {
      setPendingSql(path.sql);
      if (onSelectQuery) {
        onSelectQuery(path.sql, false);
      } else {
        onNavigate(Tab.SQL);
      }
      toastService.info(`已载入「${path.title}」分析模版`);
      return;
    }

    if (path.targetTab) {
      onNavigate(path.targetTab);
      return;
    }

    if (path.suggestedPrompt) {
      handleOpenCopilot(path.suggestedPrompt);
    }
  };

  const handleOpenCopilot = (promptText: string) => {
    const store = useCopilotStore.getState();
    store.setIsOpen(true);
    store.setInputValue(promptText);
    toastService.info('Copilot 已唤起并预填分析诉求，可直接发送对话');
  };

  return (
    <section className="flex flex-col gap-3 font-sans select-text">
      <div className={DB.sectionHeader}>
        <div className="flex items-center gap-2 min-w-0">
          <Compass className="h-3.5 w-3.5 text-monokai-accent shrink-0" />
          <h2 className={DB.sectionTitle}>下一步分析建议</h2>
          <span className={DB.sectionMeta}>
            回答「还能继续分析什么」· 基于当前真实资产与看板推荐
          </span>
        </div>
        <button
          type="button"
          onClick={() => handleOpenCopilot('请帮我分析当前工作区数据并推荐高价值分析问题')}
          className={DB.btnGhostLink}
        >
          <Bot className="h-3 w-3" />
          <span>向 Copilot 提问</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {explorationPaths.map((path) => {
          const isAi = path.icon === 'copilot';
          return (
            <div
              key={path.id}
              className={`flex flex-col justify-between rounded-lg border p-3.5 transition-all ${
                isAi
                  ? 'border-monokai-accent/40 bg-monokai-accent/6 hover:border-monokai-accent hover:bg-monokai-accent/10'
                  : 'border-monokai-border bg-monokai-surface/60 hover:border-monokai-border-strong hover:bg-monokai-surface'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded ${
                        path.icon === 'trend'
                          ? 'bg-monokai-green/15 text-monokai-green'
                          : path.icon === 'distribution'
                          ? 'bg-monokai-yellow/15 text-monokai-yellow'
                          : path.icon === 'join'
                          ? 'bg-monokai-cyan/15 text-monokai-cyan'
                          : 'bg-monokai-accent/20 text-monokai-accent'
                      }`}
                    >
                      {path.icon === 'trend' && <TrendingUp className="h-3.5 w-3.5" />}
                      {path.icon === 'distribution' && <PieChart className="h-3.5 w-3.5" />}
                      {path.icon === 'join' && <GitBranch className="h-3.5 w-3.5" />}
                      {path.icon === 'copilot' && <Sparkles className="h-3.5 w-3.5" />}
                    </span>
                    <span className="font-mono text-2xs uppercase tracking-wide text-monokai-comment">
                      {path.category}
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-monokai-fg tracking-tight line-clamp-1">
                    {path.title}
                  </h3>
                  <p className="mt-1 text-2xs text-monokai-comment line-clamp-2 leading-relaxed">
                    {path.description}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-monokai-border/40 font-mono text-2xs">
                {path.sql ? (
                  <button
                    type="button"
                    onClick={() => handleLaunchPath(path)}
                    className="flex items-center gap-1 text-monokai-fg-muted hover:text-monokai-accent transition-colors cursor-pointer"
                  >
                    <Play className="h-2.5 w-2.5 fill-current" />
                    <span>在 SQL 中探索</span>
                  </button>
                ) : path.targetTab ? (
                  <button
                    type="button"
                    onClick={() => onNavigate(path.targetTab!)}
                    className="flex items-center gap-1 text-monokai-fg-muted hover:text-monokai-cyan transition-colors cursor-pointer"
                  >
                    <ArrowRight className="h-2.5 w-2.5" />
                    <span>查看关联与流向</span>
                  </button>
                ) : (
                  <span className="text-monokai-comment">智能分析助理就绪</span>
                )}

                {path.suggestedPrompt && (
                  <button
                    type="button"
                    onClick={() => handleOpenCopilot(path.suggestedPrompt!)}
                    className="flex items-center gap-1 text-monokai-accent hover:underline cursor-pointer"
                    title="在右侧 Copilot 中深入分析"
                  >
                    <Bot className="h-2.5 w-2.5" />
                    <span>AI 深度探索</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
