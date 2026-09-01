'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  Database,
  Users,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Monitor,
  Laptop,
  Smartphone,
  Info,
} from 'lucide-react';
import { DatasetStatusSummary } from '@/types';
import { getDatasetStatus } from '@/lib/services/datasetService';

interface DatasetStatusCardProps {
  status?: DatasetStatusSummary;
  className?: string;
}

export function DatasetStatusCard({
  status = getDatasetStatus(),
  className = '',
}: DatasetStatusCardProps) {
  return (
    <Card padding="lg" className={`border-indigo-500/20 bg-surface-800/90 shadow-xl ${className}`}>
      {/* Header with Prototype Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Database size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-text-primary">Dataset Status & Health</h3>
              <Badge variant="active" size="sm">
                Prototype / Synthetic Dataset
              </Badge>
              <Badge variant="normal" size="sm" dot>
                {status.dataQualityStatus}
              </Badge>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              120 Unified Behavioral Telemetry Records · Longitudinal Coursework Model
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-text-secondary bg-surface-700/60 px-3 py-1.5 rounded-lg border border-border">
          <CheckCircle2 size={14} className="text-emerald-400" />
          <span>Schema Validation: <strong>0 Errors</strong> (120/120 Valid)</span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 my-4">
        <div className="p-3 rounded-xl bg-surface-700/40 border border-border">
          <div className="flex items-center justify-between text-text-muted text-[11px]">
            <span>Total Records</span>
            <Database size={13} className="text-indigo-400" />
          </div>
          <p className="text-xl font-extrabold text-text-primary mt-1 tabular-nums">
            {status.totalRecords}
          </p>
          <span className="text-[10px] text-text-muted">Interactions</span>
        </div>

        <div className="p-3 rounded-xl bg-surface-700/40 border border-border">
          <div className="flex items-center justify-between text-text-muted text-[11px]">
            <span>Total Students</span>
            <Users size={13} className="text-sky-400" />
          </div>
          <p className="text-xl font-extrabold text-text-primary mt-1 tabular-nums">
            {status.totalStudents}
          </p>
          <span className="text-[10px] text-text-muted">S001 – S010</span>
        </div>

        <div className="p-3 rounded-xl bg-surface-700/40 border border-border">
          <div className="flex items-center justify-between text-text-muted text-[11px]">
            <span>Total Sessions</span>
            <Layers size={13} className="text-violet-400" />
          </div>
          <p className="text-xl font-extrabold text-text-primary mt-1 tabular-nums">
            {status.totalSessions}
          </p>
          <span className="text-[10px] text-text-muted">Distinct Sessions</span>
        </div>

        <div className="p-3 rounded-xl bg-surface-700/40 border border-border">
          <div className="flex items-center justify-between text-text-muted text-[11px]">
            <span>Low-Stakes</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
          </div>
          <p className="text-xl font-extrabold text-emerald-400 mt-1 tabular-nums">
            {status.lowStakesRecords}
          </p>
          <span className="text-[10px] text-text-muted">Baseline Coursework</span>
        </div>

        <div className="p-3 rounded-xl bg-surface-700/40 border border-border">
          <div className="flex items-center justify-between text-text-muted text-[11px]">
            <span>Graded Exams</span>
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
          </div>
          <p className="text-xl font-extrabold text-indigo-400 mt-1 tabular-nums">
            {status.gradedRecords}
          </p>
          <span className="text-[10px] text-text-muted">Evaluated Sessions</span>
        </div>

        <div className="p-3 rounded-xl bg-surface-700/40 border border-border">
          <div className="flex items-center justify-between text-text-muted text-[11px]">
            <span>Flagged Mock</span>
            <AlertTriangle size={13} className="text-rose-400" />
          </div>
          <p className="text-xl font-extrabold text-rose-400 mt-1 tabular-nums">
            {status.flaggedRecords}
          </p>
          <span className="text-[10px] text-text-muted">Preset Test Deviations</span>
        </div>
      </div>

      {/* Devices & Source Transparency Footer */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-border/70 text-xs text-text-secondary">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
            Device Breakdown:
          </span>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface-700 border border-border text-[11px]">
            <Monitor size={12} className="text-sky-400" />
            <span>Desktop: <strong>{status.deviceCounts['web_desktop'] || 0}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface-700 border border-border text-[11px]">
            <Laptop size={12} className="text-indigo-400" />
            <span>Laptop: <strong>{status.deviceCounts['web_laptop'] || 0}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface-700 border border-border text-[11px]">
            <Smartphone size={12} className="text-emerald-400" />
            <span>Mobile: <strong>{status.deviceCounts['mobile'] || 0}</strong></span>
          </div>
        </div>

        {/* Source Composition Transparency */}
        <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
          <Info size={13} className="text-indigo-400 shrink-0" />
          <span className="italic">{status.sourceComposition}</span>
        </div>
      </div>
    </Card>
  );
}
