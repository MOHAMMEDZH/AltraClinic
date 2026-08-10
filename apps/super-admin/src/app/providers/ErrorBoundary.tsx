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
 * Root error boundary — no PHI, secrets, or stack traces in UI.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    /* Observability hooks land in later steps; avoid logging sensitive data. */
  }

  private retry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="sa-state" role="alert">
          <h1>{this.props.fallbackTitle ?? 'Something went wrong'}</h1>
          <p>The Super Admin application encountered an unexpected error. No sensitive details are shown.</p>
          <button type="button" className="sa-button" onClick={this.retry}>
            {this.props.fallbackRetryLabel ?? 'Try again'}
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
