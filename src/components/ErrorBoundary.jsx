import { Component } from 'react';

/**
 * Catches unhandled errors in the React render tree and displays a
 * recoverable fallback UI instead of a blank white screen.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] Uncaught error:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-lg font-semibold text-[color:var(--text-primary)]">
            Something went wrong
          </h1>
          <p className="max-w-md text-sm text-[color:var(--text-muted)]">
            An unexpected error occurred. You can try recovering by clicking the
            button below. If the problem persists, restart the application.
          </p>
          {this.state.error?.message ? (
            <pre className="max-w-lg overflow-auto rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-secondary)] p-3 text-left text-xs text-[color:var(--danger)]">
              {this.state.error.message}
            </pre>
          ) : null}
          <button
            className="rounded-lg bg-[color:var(--accent)] px-4 py-2 text-sm text-white hover:opacity-90"
            onClick={this.handleReset}
            type="button"
          >
            Try to recover
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
