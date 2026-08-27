'use client';

import { Loader2 } from 'lucide-react';

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  action?: React.ReactNode;
  height?: number;
  className?: string;
}

export function ChartContainer({
  title,
  subtitle,
  children,
  loading = false,
  empty = false,
  emptyMessage = 'No data available',
  action,
  height = 260,
  className = '',
}: ChartContainerProps) {
  return (
    <div
      className={[
        'rounded-xl bg-surface-800 border border-border',
        'shadow-lg shadow-black/20',
        className,
      ].join(' ')}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          {subtitle && (
            <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>

      {/* Body */}
      <div className="p-5" style={{ height }}>
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
              <p className="text-xs text-text-muted">Loading chart data…</p>
            </div>
          </div>
        ) : empty ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-10 h-10 rounded-full bg-surface-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p className="text-sm text-text-muted">{emptyMessage}</p>
            </div>
          </div>
        ) : (
          <div className="h-full w-full">{children}</div>
        )}
      </div>
    </div>
  );
}
