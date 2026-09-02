'use client';

import React, { useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  PersonalizedBaseline,
  FeatureBaseline,
  DeviceBaseline,
} from '@/types';
import {
  Brain,
  Clock,
  RotateCcw,
  MousePointer2,
  Scroll,
  Layers,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Info,
  Monitor,
  Laptop,
  Smartphone,
  SlidersHorizontal,
} from 'lucide-react';

import { ModelMaturityIndicator } from '@/components/integrity/ModelMaturityIndicator';

interface PersonalizedBaselineCardProps {
  baseline: PersonalizedBaseline;
  title?: string;
  subtitle?: string;
  isInstructorView?: boolean;
}

export function PersonalizedBaselineCard({
  baseline,
  title = 'Personalized Behavioral Baseline',
  subtitle = 'Trained exclusively from the student’s own prior low-stakes coursework sessions',
  isInstructorView = false,
}: PersonalizedBaselineCardProps) {
  const [selectedDevice, setSelectedDevice] = useState<string>('overall');

  const isColdStart = baseline.maturityStatus === 'cold_start';
  const isDeveloping = baseline.maturityStatus === 'developing';

  // Extract features for active device filter
  const activeFeatures: Record<string, FeatureBaseline> =
    selectedDevice === 'overall'
      ? baseline.overallFeatures
      : baseline.deviceBaselines[selectedDevice]?.features || baseline.overallFeatures;

  const featureKeys = Object.keys(activeFeatures);

  const getMaturityBadge = () => {
    switch (baseline.maturityStatus) {
      case 'established':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Established Baseline
          </span>
        );
      case 'developing':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Developing Baseline
          </span>
        );
      case 'cold_start':
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            Cold Start (Insufficient History)
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Visual Model Maturity Stepper */}
      <ModelMaturityIndicator
        status={baseline.maturityStatus}
        sessionCount={baseline.trainingSessionCount}
      />

      <Card className="border-indigo-500/30 bg-surface-800/90 shadow-xl space-y-5">
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Brain size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-text-primary tracking-tight">
                  {title}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {getMaturityBadge()}
          </div>
        </div>

        {/* Model Metadata Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 rounded-lg bg-surface-700/30 border border-border">
            <span className="text-text-muted block text-[10px]">Training Sessions:</span>
            <span className="font-bold text-text-primary font-mono text-sm">
              {baseline.trainingSessionCount} Low-Stakes
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-surface-700/30 border border-border">
            <span className="text-text-muted block text-[10px]">Observations Count:</span>
            <span className="font-bold text-sky-400 font-mono text-sm">
              {baseline.totalInteractions} Questions
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-surface-700/30 border border-border">
            <span className="text-text-muted block text-[10px]">Student Scope:</span>
            <span className="font-bold text-indigo-300 font-mono text-sm">
              {baseline.studentId} (Exclusively)
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-surface-700/30 border border-border">
            <span className="text-text-muted block text-[10px]">Last Baseline Sync:</span>
            <span className="font-bold text-text-muted font-mono text-xs">
              {baseline.lastUpdated.split(' ')[0]}
            </span>
          </div>
        </div>

        {/* Cold Start Notice if applicable */}
        {isColdStart && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3.5 text-xs text-rose-300">
            <AlertTriangle size={18} className="text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-rose-300">Insufficient History</p>
              <p className="text-[11px] text-text-muted leading-relaxed">
                The system does not yet have enough personal coursework history to establish a reliable behavioral baseline. (Needs ≥ 3 low-stakes coursework sessions). The system refrains from borrowing population data or generating ungrounded risk conclusions.
              </p>
            </div>
          </div>
        )}

      {/* Device Context Switcher Tabs */}
      <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
        <span className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
          <SlidersHorizontal size={13} className="text-indigo-400" />
          Device Context:
        </span>

        <div className="flex items-center gap-1 bg-surface-700/50 p-1 rounded-xl border border-border text-xs">
          <button
            type="button"
            onClick={() => setSelectedDevice('overall')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
              selectedDevice === 'overall'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Overall Baseline
          </button>
          <button
            type="button"
            onClick={() => setSelectedDevice('web_desktop')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
              selectedDevice === 'web_desktop'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Desktop ({baseline.deviceBaselines.web_desktop?.sessionCount || 0})
          </button>
          <button
            type="button"
            onClick={() => setSelectedDevice('web_laptop')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
              selectedDevice === 'web_laptop'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Laptop ({baseline.deviceBaselines.web_laptop?.sessionCount || 0})
          </button>
          <button
            type="button"
            onClick={() => setSelectedDevice('mobile')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
              selectedDevice === 'mobile'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Mobile ({baseline.deviceBaselines.mobile?.sessionCount || 0})
          </button>
        </div>
      </div>

      {/* 9 Modeled Feature Baseline Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {featureKeys.map((k) => {
          const feat = activeFeatures[k];
          if (!feat) return null;

          const isDifficultyAdjusted = feat.method === 'difficulty_adjusted';
          const isFallback = feat.method.includes('fallback');

          return (
            <div
              key={feat.featureName}
              className="p-3.5 rounded-xl bg-surface-700/30 border border-border hover:border-indigo-500/40 transition-all space-y-2"
            >
              {/* Feature Header */}
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-text-primary">
                  {feat.displayName}
                </span>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                    isDifficultyAdjusted
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  }`}
                >
                  {isDifficultyAdjusted ? 'Diff-Adjusted' : 'Mean Fallback'}
                </span>
              </div>

              {/* Expected Value & Uncertainty */}
              <div className="flex items-baseline justify-between pt-1">
                <div>
                  <span className="text-[10px] text-text-muted block">Expected Mean (μ):</span>
                  <span className="text-lg font-black text-emerald-400 font-mono">
                    {feat.expectedValue}{' '}
                    <span className="text-[10px] text-text-muted font-normal">{feat.unit}</span>
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-text-muted block">Uncertainty (±SE):</span>
                  <span className="text-xs font-bold text-indigo-300 font-mono">
                    ±{feat.uncertainty}
                  </span>
                </div>
              </div>

              {/* Supporting Distribution Statistics */}
              <div className="pt-2 border-t border-border/50 grid grid-cols-3 gap-1 text-[10px] text-text-muted font-mono">
                <div>
                  <span>StdDev: </span>
                  <span className="text-text-secondary">{feat.stdDev}</span>
                </div>
                <div>
                  <span>Median: </span>
                  <span className="text-text-secondary">{feat.median}</span>
                </div>
                <div className="text-right">
                  <span>N: </span>
                  <span className="text-sky-400 font-bold">{feat.sampleCount}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Explanatory Footer */}
      <div className="p-3 rounded-xl bg-surface-700/20 border border-border/60 flex items-start gap-2.5 text-[11px] text-text-muted leading-relaxed">
        <Info size={14} className="text-indigo-400 shrink-0 mt-0.5" />
        <p>
          <strong>Patent Integrity Rule:</strong> This baseline is computed exclusively from student <strong>{baseline.studentId}</strong>&apos;s previous low-stakes coursework. Graded exam sessions are strictly excluded from baseline training.
        </p>
      </div>
    </Card>
    </div>
  );
}
