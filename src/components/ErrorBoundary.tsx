'use client'

import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
  scope?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Client-side error boundary. Wraps each page so a render crash in one
 * component (broken chart, bad data row) doesn't blank the whole app.
 *
 * The fallback is deliberately modest — a research DB should *inform* the
 * user that something went wrong, not hide it behind a friendly placeholder.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Log with scope so a researcher reading the console can narrow the page.
    console.error(
      `[CiliaMiner] Render error in "${this.props.scope ?? 'page'}":`,
      error,
      info.componentStack
    )
  }

  private reset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    if (this.props.fallback) return this.props.fallback

    return (
      <div className="card py-12 flex flex-col items-center text-center max-w-xl mx-auto">
        <AlertTriangle className="h-10 w-10 text-accent mb-4" strokeWidth={1.2} />
        <h3 className="font-display text-xl text-primary-700 leading-tight mb-2">
          Something broke while rendering this section.
        </h3>
        <p className="text-sm text-primary-500 max-w-sm leading-relaxed mb-1">
          The error was logged to the browser console. If it persists, open the
          Data Quality Report (<code className="font-mono text-[11px]">window.__ciliaminer_quality_report</code>) and report what you see.
        </p>
        {this.state.error?.message && (
          <pre className="text-[11px] font-mono text-primary-500 bg-surface-muted border border-primary-100 rounded-sm px-3 py-2 mt-4 max-w-md overflow-auto">
            {this.state.error.message}
          </pre>
        )}
        <button
          onClick={this.reset}
          className="btn-secondary mt-5 text-sm"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </button>
      </div>
    )
  }
}
