import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Changing this resets the boundary — used to clear the error on navigation. */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time crashes.
 *
 * Without this, React 19 unmounts the entire tree when a component throws and
 * the user is left staring at a blank white page with no explanation. This
 * keeps the app shell alive, shows what went wrong, and offers a way out.
 *
 * It resets whenever `resetKey` changes, so navigating to another route
 * recovers instead of trapping the user on the error screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidUpdate(prevProps: Props) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep the stack in the console — the overlay deliberately shows only a
    // short message so it stays readable on a phone.
    console.error('Render error:', error, info.componentStack);
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="h-7 w-7" />
        </span>

        <div>
          <h2 className="text-lg font-semibold">This screen hit a problem</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            The rest of the app still works — use the navigation to move on, or
            reload to try again.
          </p>
        </div>

        <pre className="max-w-full overflow-x-auto rounded-2xl bg-muted px-4 py-3 text-left text-xs text-muted-foreground">
          {error.message}
        </pre>

        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
        >
          <RefreshCw className="h-4 w-4" />
          Reload
        </button>
      </div>
    );
  }
}
