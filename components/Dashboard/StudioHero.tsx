import React from 'react';

export const StudioHero: React.FC = () => {
  return (
    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pb-3 pt-1 select-none shrink-0 border-b border-monokai-border mb-3">
      {/* Left text greeting */}
      <div className="flex flex-col space-y-0.5 max-w-2xl">
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-monokai-fg font-sans flex items-center gap-2">
          欢迎使用 <span className="text-monokai-accent">DuckDB Studio</span>
        </h1>
        <p className="text-xs text-monokai-fg-muted font-normal leading-relaxed">
          从连接数据到洞察分析，在一个轻量、高效的本地数据工作台中完成。
        </p>
      </div>

      {/* Right clean status & slogan group */}
      <div className="flex items-center gap-4 shrink-0 self-end lg:self-center">
        {/* IDE Runtime Meta Pill */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-monokai-surface border border-monokai-border text-xs text-monokai-comment font-mono">
          <div className="flex items-center gap-1.5 text-monokai-fg-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-monokai-accent" />
            <span className="text-meta font-medium">DuckDB WASM</span>
          </div>
          <span className="text-monokai-border-strong">|</span>
          <span className="text-meta">本地执行</span>
        </div>

        {/* Slogan typography */}
        <div className="flex flex-col text-right">
          <span className="text-xs font-medium text-monokai-fg-muted tracking-wide">
            本地优先 · 快速分析 · 数据触手可及
          </span>
          <span className="text-meta text-monokai-comment font-mono tracking-tight">
            Fast Analytics for Everyone
          </span>
        </div>
      </div>
    </div>
  );
};
