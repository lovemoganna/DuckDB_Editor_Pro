import React, { Component, createRef, type ReactNode } from 'react';
import { reportDashboardIncident } from '../../services/dashboardDiagnostics';

interface Props {
  children: ReactNode;
  catalog?: string;
  boardId: string;
  widgetId: string;
  formatVersion?: number;
}
/** Deliberately scoped to one instance, including its fullscreen portal. */
export class WidgetErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };
  private host = createRef<HTMLDivElement>();
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() {
    const { catalog, boardId, widgetId, formatVersion } = this.props;
    const size=this.host.current?.getBoundingClientRect();
    reportDashboardIncident({ stage: 'render', catalog, boardId, widgetId, formatVersion, code: 'widget-render-failed',width:size?.width,height:size?.height });
  }
  render() {
    if (!this.state.failed) return <div ref={this.host} className="h-full min-h-0 min-w-0">{this.props.children}</div>;
    return <div role="alert" className="flex h-full min-h-0 flex-col items-center justify-center gap-3 overflow-auto rounded-lg border border-monokai-border bg-monokai-surface p-3 text-center text-xs">
      <p className="text-monokai-pink">组件显示失败</p>
      <p className="text-monokai-comment">其他组件仍可使用，已保存的分析和布局保留。</p>
      <button type="button" className="rounded border border-monokai-border px-3 py-2 text-monokai-fg" onClick={() => this.setState({ failed: false })}>重试此组件</button>
    </div>;
  }
}
