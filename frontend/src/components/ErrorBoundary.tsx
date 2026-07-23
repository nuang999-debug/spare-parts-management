import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Without this, a crash in a chart library (e.g. Recharts' internal animation code, which has
 * no error boundary of its own) unmounts the ENTIRE app to a blank white screen — this was the
 * cause of the "white screen after fast navigation" report: rapid item switches re-mount charts
 * faster than an in-flight animation frame can finish, and that stray callback throwing had
 * nowhere to be caught.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  componentDidUpdate(prevProps: Props) {
    // Give the panel a chance to recover once its underlying data changes again (e.g. switching
    // to a different item) instead of staying stuck on the fallback forever.
    if (this.state.hasError && prevProps.children !== this.props.children) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
