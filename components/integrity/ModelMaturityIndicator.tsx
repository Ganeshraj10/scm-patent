'use client';

import React from 'react';
import { ShieldCheck, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import { MaturityStatus } from '@/types';

interface ModelMaturityIndicatorProps {
  status: MaturityStatus;
  sessionCount: number;
  className?: string;
}

export function ModelMaturityIndicator({
  status,
  sessionCount,
  className = '',
}: ModelMaturityIndicatorProps) {
  const stages = [
    {
      key: 'cold_start',
      label: 'Cold Start',
      range: '0–2 Sessions',
      description: 'Insufficient history. Personal baseline cannot be reliably established.',
    },
    {
      key: 'developing',
      label: 'Developing',
      range: '3–5 Sessions',
      description: 'Emerging personal baseline. Individual bounds are forming.',
    },
    {
      key: 'established',
      label: 'Established',
      range: '6+ Sessions',
      description: 'Mature personalized baseline. High confidence difficulty-adjusted model.',
    },
  ];

  const getStageIndex = (s: MaturityStatus): number => {
    switch (s) {
      case 'established':
        return 2;
      case 'developing':
        return 1;
      case 'cold_start':
      default:
        return 0;
    }
  };

  const currentIndex = getStageIndex(status);

  return (
    <div className={`p-4 rounded-2xl bg-surface-800 border border-border space-y-3.5 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-text-primary">Personal Model Maturity Progression</span>
          <span className="text-[10px] text-text-muted">
            ({sessionCount} Low-Stakes Session{sessionCount === 1 ? '' : 's'})
          </span>
        </div>
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono border ${
            status === 'established'
              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              : status === 'developing'
              ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
              : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
          }`}
        >
          {status === 'established'
            ? 'ESTABLISHED'
            : status === 'developing'
            ? 'DEVELOPING'
            : 'COLD START'}
        </span>
      </div>

      {/* Visual Stepper */}
      <div className="relative flex items-center justify-between">
        {/* Connector Line Background */}
        <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-1 bg-surface-700 rounded-full z-0" />
        
        {/* Connector Line Fill */}
        <div
          className="absolute left-8 h-1 bg-indigo-500 rounded-full transition-all duration-500 z-0"
          style={{
            width: currentIndex === 0 ? '0%' : currentIndex === 1 ? '50%' : 'calc(100% - 4rem)',
          }}
        />

        {stages.map((stage, idx) => {
          const isActive = idx === currentIndex;
          const isPassed = idx < currentIndex;

          return (
            <div key={stage.key} className="relative z-10 flex flex-col items-center text-center space-y-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-md ${
                  isActive
                    ? idx === 2
                      ? 'bg-emerald-500 text-white ring-4 ring-emerald-500/20 scale-110'
                      : idx === 1
                      ? 'bg-amber-500 text-white ring-4 ring-amber-500/20 scale-110'
                      : 'bg-rose-500 text-white ring-4 ring-rose-500/20 scale-110'
                    : isPassed
                    ? 'bg-indigo-600 text-white'
                    : 'bg-surface-700 text-text-muted border border-border'
                }`}
              >
                {isPassed ? <CheckCircle2 size={14} /> : idx + 1}
              </div>
              <span
                className={`text-[11px] font-bold ${
                  isActive ? 'text-text-primary' : isPassed ? 'text-text-secondary' : 'text-text-muted'
                }`}
              >
                {stage.label}
              </span>
              <span className="text-[10px] text-text-muted font-mono">{stage.range}</span>
            </div>
          );
        })}
      </div>

      {/* Explanatory Context Note */}
      <p className="text-[11px] text-text-muted leading-relaxed pt-1 border-t border-border/60">
        <strong className="text-text-secondary">{stages[currentIndex].label}:</strong>{' '}
        {stages[currentIndex].description}
      </p>
    </div>
  );
}
