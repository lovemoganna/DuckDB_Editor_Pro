import React from 'react';
import {
  Clock,
  ChevronRight,
  Terminal,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Code2,
  Sparkles,
} from 'lucide-react';
import { Tab } from '../../types';
import { type RecentQueryDisplayItem } from '../../hooks/useDashboardWorkflow';

interface Step03AnalyzeProps {
  recentQueries: RecentQueryDisplayItem[];
  onNavigate: (tab: Tab) => void;
  onSelectQuery: (sql: string) => void;
}

export const Step03Analyze: React.FC<Step03AnalyzeProps> = ({
  recentQueries,
  onNavigate,
  onSelectQuery,
}) => {
  return (
    <div className="flex flex-col h-full min-h-0 rounded-lg bg-monokai-surface border border-monokai-border p-4 text-monokai-fg shadow-sm overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center gap-3 mb-3 shrink-0">
        <div className="w-7 h-7 rounded-md bg-monokai-elevated border border-monokai-border flex items-center justify-center font-mono font-bold text-xs text-monokai-fg-muted shrink-0">
          03
        </div>
        <div className="flex flex-col">
          <h2 className="text-sm sm:text-base font-semibold text-monokai-fg tracking-tight">开始分析</h2>
          <p className="text-xs text-monokai-comment leading-tight">
            在 SQL 工作台中编写查询，探索数据，生成洞察。
          </p>
        </div>
      </div>

      {/* Big Primary Action Button */}
      <div className="mb-3 shrink-0">
        <button
          type="button"
          onClick={() => onNavigate(Tab.SQL)}
          className="w-full h-8 px-4 rounded-md bg-monokai-accent hover:bg-monokai-accent-hover active:bg-monokai-accent/90 text-black font-semibold text-xs tracking-tight flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer group"
        >
          <div className="w-4 h-4 rounded bg-black/15 flex items-center justify-center text-black text-2xs font-mono font-bold">
            &gt;_
          </div>
          <span>打开 SQL 工作台</span>
          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform text-black stroke-[2.5]" />
        </button>
        <div className="text-center text-meta text-monokai-comment mt-1.5 font-mono">
          编写 SQL · 运行查询 · 可视化结果
        </div>
      </div>

      {/* Middle Flexible Body */}
      <div className="flex-1 min-h-0 flex flex-col justify-between">
        {/* 最近查询 (Recent Queries) */}
        <div className="flex-1 min-h-0 flex flex-col mb-2.5">
          <div className="flex items-center justify-between mb-1.5 shrink-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-monokai-fg">
              <Clock className="w-3.5 h-3.5 text-monokai-comment" />
              <span>最近查询</span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate(Tab.HISTORY)}
              className="text-meta text-monokai-comment hover:text-monokai-fg flex items-center gap-0.5 transition-colors cursor-pointer"
            >
              <span>查看全部</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {/* List of Recent Queries */}
          <div className="flex-1 min-h-[110px] overflow-y-auto custom-scrollbar pr-0.5 space-y-1">
            {recentQueries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 px-2 rounded-md bg-monokai-elevated/20 border border-monokai-border/40 text-center">
                <span className="text-meta text-monokai-comment font-mono">暂无查询记录，点击上方「打开 SQL 工作台」执行即席查询</span>
              </div>
            ) : (
              recentQueries.slice(0, 6).map(q => (
                <div
                  key={q.id}
                  onClick={() => onSelectQuery(q.sql.replace(' ...', ''))}
                  className="flex items-center justify-between p-2 rounded-md bg-monokai-elevated/40 border border-monokai-border hover:bg-monokai-hover hover:border-monokai-border-strong transition-all cursor-pointer text-xs group"
                  title="点击将此查询装载入 SQL 工作台"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="px-1.5 py-0.5 rounded bg-monokai-surface border border-monokai-border text-2xs font-mono font-bold text-monokai-comment shrink-0">
                      SQL
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-mono text-meta text-monokai-fg group-hover:text-monokai-accent transition-colors truncate">
                        {q.sql}
                      </span>
                      <span className="text-2xs text-monokai-comment font-mono truncate">
                        {q.timestamp} · {q.duration}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 ml-2">
                    {q.status === 'success' ? (
                      <div className="w-4 h-4 rounded-full bg-monokai-accent/10 flex items-center justify-center text-monokai-accent">
                        <CheckCircle2 className="w-3.5 h-3.5 text-monokai-accent" />
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-monokai-danger/10 flex items-center justify-center text-monokai-danger">
                        <AlertCircle className="w-3.5 h-3.5 text-monokai-danger" />
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 学习与帮助 (Learning & Help) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-monokai-fg">
              <BookOpen className="w-3.5 h-3.5 text-monokai-comment" />
              <span>学习与帮助</span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate(Tab.LIBRARY)}
              className="text-meta text-monokai-comment hover:text-monokai-fg flex items-center gap-0.5 transition-colors cursor-pointer"
            >
              <span>更多资源</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {/* SQL 基础教程 */}
            <button
              type="button"
              onClick={() => onNavigate(Tab.TUTORIALS)}
              className="flex flex-col p-2.5 rounded-md bg-monokai-elevated/50 border border-monokai-border hover:bg-monokai-hover hover:border-monokai-border-strong text-left transition-colors cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-monokai-fg">
                  SQL 基础教程
                </span>
                <ChevronRight className="w-3 h-3 text-monokai-comment group-hover:text-monokai-accent transition-colors" />
              </div>
              <span className="text-2xs text-monokai-comment leading-tight">
                从查询到分析，快速上手 DuckDB
              </span>
            </button>

            {/* 示例查询 */}
            <button
              type="button"
              onClick={() => {
                onSelectQuery(
                  'SELECT category, COUNT(*) as cnt, AVG(amount) as avg_amount FROM orders GROUP BY category ORDER BY cnt DESC LIMIT 10;',
                );
              }}
              className="flex flex-col p-2.5 rounded-md bg-monokai-elevated/50 border border-monokai-border hover:bg-monokai-hover hover:border-monokai-border-strong text-left transition-colors cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-monokai-fg">
                  示例查询
                </span>
                <ChevronRight className="w-3 h-3 text-monokai-comment group-hover:text-monokai-accent transition-colors" />
              </div>
              <span className="text-2xs text-monokai-comment leading-tight">
                基于示例数据的常用分析案例
              </span>
            </button>

            {/* 知识沉淀 */}
            <button
              type="button"
              onClick={() => onNavigate(Tab.LIBRARY)}
              className="flex flex-col p-2.5 rounded-md bg-monokai-elevated/50 border border-monokai-border hover:bg-monokai-hover hover:border-monokai-border-strong text-left transition-colors cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-monokai-fg">
                  知识沉淀
                </span>
                <ChevronRight className="w-3 h-3 text-monokai-comment group-hover:text-monokai-accent transition-colors" />
              </div>
              <span className="text-2xs text-monokai-comment leading-tight">
                Schema · 数据 · SQL 核心概念
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Action Button */}
      <div className="shrink-0 pt-3 mt-auto border-t border-monokai-border">
        <button
          type="button"
          onClick={() => onNavigate(Tab.SQL)}
          className="w-full h-8 px-4 rounded-md bg-monokai-elevated border border-monokai-border-strong hover:bg-monokai-hover active:bg-monokai-surface text-monokai-fg font-medium text-xs tracking-tight flex items-center justify-center gap-1.5 transition-all cursor-pointer"
        >
          <span>继续分析，发现更多可能</span>
          <ChevronRight className="w-3.5 h-3.5 stroke-[2]" />
        </button>
      </div>
    </div>
  );
};
