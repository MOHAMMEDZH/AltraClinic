import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackRetryLabel?: string;
}

interface State {
  hasError: boolean;
}

/**
 * Phase 46a error boundary — no PHI in fallback UI.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    /* Observability hooks land later; avoid logging PHI. */
  }

  private retry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="portal-unavailable" role="alert">
          <h1>{this.props.fallbackTitle ?? 'Something went wrong'}</h1>
          <button type="button" className="portal-button" onClick={this.retry}>
            {this.props.fallbackRetryLabel ?? 'Try again'}
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
