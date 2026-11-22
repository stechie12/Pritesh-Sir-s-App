import React from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import { clearAppStorageCache } from '../utils/storageSafety';
import {
  clearServiceWorkerAndCaches,
  isChunkLoadError,
  triggerChunkRecoveryReload,
} from '../utils/chunkRecovery';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  isChunkError: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '', isChunkError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'An unexpected interface error occurred.',
      isChunkError: isChunkLoadError(error),
    };
  }

  componentDidCatch(error: Error) {
    console.error('App ErrorBoundary caught error:', error?.message || error);
    if (isChunkLoadError(error)) {
      triggerChunkRecoveryReload();
    }
  }

  handleReload = () => {
    void clearServiceWorkerAndCaches().finally(() => {
      window.location.reload();
    });
  };

  handleClearAndReload = () => {
    clearAppStorageCache();
    void clearServiceWorkerAndCaches().finally(() => {
      window.location.reload();
    });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div
          role="alert"
          className="max-w-md w-full rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl"
        >
          <div className="flex items-center gap-2.5 text-amber-400">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <h1 className="text-base font-semibold text-white">
              {this.state.isChunkError
                ? 'A newer version of the workspace is ready'
                : 'Something went wrong in the workspace'}
            </h1>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            {this.state.isChunkError
              ? 'Your browser had a cached script from an earlier build. Reload to fetch the latest version — your chat history and progress are preserved.'
              : 'Your progress is preserved locally. Reload the workspace or reset cached preferences if the issue persists.'}
          </p>

          {this.state.errorMessage && (
            <div className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-[11px] text-slate-400 break-words">
              {this.state.errorMessage}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reload Workspace</span>
            </button>
            <button
              type="button"
              onClick={this.handleClearAndReload}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-300 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Local Cache</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
