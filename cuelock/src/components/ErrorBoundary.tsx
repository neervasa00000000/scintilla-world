"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("CueLock recovered from", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0f1113] px-6 text-[#e8eaed]">
        <p className="text-[15px]">Something went wrong. CueLock is still here.</p>
        <button
          type="button"
          className="rounded border border-[#c49a3c] bg-[#c49a3c]/20 px-3 py-1.5 text-[13px]"
          onClick={() => this.setState({ error: null })}
        >
          Back to demo
        </button>
      </div>
    );
  }
}
