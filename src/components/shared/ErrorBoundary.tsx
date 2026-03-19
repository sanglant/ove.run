import { Component, type ErrorInfo, type ReactNode } from "react";
import classes from "./ErrorBoundary.module.css";

interface Props {
  children: ReactNode;
  label?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? ` — ${this.props.label}` : ""}]`, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      const { error } = this.state;
      const { label } = this.props;

      return (
        <div className={classes.container} role="alert" aria-live="assertive">
          <div className={classes.card}>
            <div className={classes.iconRow}>
              <span className={classes.icon} aria-hidden="true">!</span>
            </div>
            <h2 className={classes.heading}>
              {label ? `${label} crashed` : "Something went wrong"}
            </h2>
            <p className={classes.subheading}>
              A render error occurred in this panel. The rest of the app is
              unaffected.
            </p>
            {error && (
              <pre className={classes.errorMessage}>
                {error.message || String(error)}
              </pre>
            )}
            <div className={classes.buttonRow}>
              <button
                className={classes.retryButton}
                onClick={() => this.setState({ hasError: false, error: null })}
              >
                Try again
              </button>
              <button
                className={classes.reloadButton}
                onClick={() => window.location.reload()}
              >
                Reload app
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
