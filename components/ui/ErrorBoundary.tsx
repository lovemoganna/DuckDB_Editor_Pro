/**
 * ErrorBoundary — Global React error boundary
 *
 * Catches any uncaught JavaScript errors in the component tree,
 * prevents white screens, and shows a recoverable error UI.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Bug } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Called when error is caught — useful for logging services */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Fallback UI component name for context */
  section?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
    // Log to console in development
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error, errorInfo);
    }
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 200,
          padding: 32,
          background: '#1e1f1c',
          color: '#f8f8f2',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          <AlertTriangle
            className="w-10 h-10 mb-4"
            style={{ color: '#f92672' }}
          />
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: '#f92672' }}>
            {this.props.section ? `Error in ${this.props.section}` : 'Something went wrong'}
          </h2>
          <p style={{ fontSize: 12, color: '#75715e', marginBottom: 16, maxWidth: 480, textAlign: 'center' }}>
            {this.state.error?.message || 'An unexpected error occurred. The application is still running — this component just needs a refresh.'}
          </p>
          <button
            onClick={this.handleReload}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 20px',
              background: '#272822',
              border: '1px solid #49483e',
              borderRadius: 6,
              color: '#a6e22e',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
          {import.meta.env.DEV && this.state.error?.stack && (
            <details style={{ marginTop: 16, maxWidth: 600, textAlign: 'left' }}>
              <summary style={{ cursor: 'pointer', color: '#75715e', fontSize: 11, marginBottom: 8 }}>
                Stack trace
              </summary>
              <pre style={{
                fontSize: 10,
                color: '#f92672',
                background: '#0d0d0d',
                padding: 12,
                borderRadius: 6,
                overflow: 'auto',
                maxHeight: 200,
                lineHeight: 1.6,
              }}>
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
