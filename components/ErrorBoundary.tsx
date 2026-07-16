import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 m-4 rounded-xl border border-monokai-pink/30 bg-monokai-sidebar/40 text-center max-w-lg mx-auto">
          <div className="text-3xl text-monokai-pink mb-3">⚠️</div>
          <h2 className="text-base font-bold text-white mb-2">组件渲染发生错误</h2>
          <p className="text-xs text-monokai-comment mb-4">
            {this.state.error?.message || '未知渲染错误，请检查教程格式或数据语法。'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-monokai-blue hover:bg-monokai-blue/80 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            重试
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
