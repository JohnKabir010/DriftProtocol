"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(err: unknown): State {
    return {
      hasError: true,
      message: err instanceof Error ? err.message : String(err),
    };
  }

  componentDidCatch(err: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary]", err, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen grid place-items-center bg-void px-6">
          <div className="holo-card max-w-md w-full p-8 text-center space-y-4">
            <div className="font-display text-2xl text-neon-magenta tracking-widest">SYSTEM ERROR</div>
            <p className="font-display text-sm text-white/40 leading-relaxed">
              {this.state.message || "An unexpected error occurred."}
            </p>
            <button
              className="mt-4 holo-card px-8 py-3 font-display text-sm text-neon-cyan border border-neon-cyan/30 hover:border-neon-cyan/60 transition-all tracking-widest"
              onClick={() => this.setState({ hasError: false, message: "" })}
            >
              RETRY
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
