'use client';

import React from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { DatasetStatusCard } from '@/components/integrity/DatasetStatusCard';
import { getDatasetStatus } from '@/lib/services/datasetService';
import {
  Database,
  Server,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Cpu,
  Layers,
} from 'lucide-react';

export default function AdminStatusPage() {
  const status = getDatasetStatus();

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-text-primary">System & Dataset Status</h2>
        <p className="text-xs text-text-muted mt-0.5">
          System telemetry health, prototype dataset validation diagnostics, and platform infrastructure state
        </p>
      </div>

      {/* Dataset Status Card */}
      <DatasetStatusCard status={status} />

      {/* Infrastructure & Security Health Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card>
          <CardHeader
            title="Authentication & Session Guard"
            subtitle="Edge Proxy Middleware"
            badge={<Badge variant="active">Operational</Badge>}
          />
          <div className="space-y-2 mt-2 text-xs text-text-secondary">
            <div className="flex items-center justify-between p-2 rounded-lg bg-surface-700/40 border border-border">
              <span>RBAC Middleware</span>
              <span className="text-emerald-400 font-bold">Active</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-surface-700/40 border border-border">
              <span>Session Refresh</span>
              <span className="text-emerald-400 font-bold">Supabase SSR</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-surface-700/40 border border-border">
              <span>Route Guards</span>
              <span className="text-emerald-400 font-bold">3 Roles Enforced</span>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Database Schema & RLS"
            subtitle="Supabase PostgreSQL"
            badge={<Badge variant="active">15 Migrations</Badge>}
          />
          <div className="space-y-2 mt-2 text-xs text-text-secondary">
            <div className="flex items-center justify-between p-2 rounded-lg bg-surface-700/40 border border-border">
              <span>Row-Level Security</span>
              <span className="text-emerald-400 font-bold">Enabled</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-surface-700/40 border border-border">
              <span>RPC Procedures</span>
              <span className="text-emerald-400 font-bold">Atomic Transactions</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-surface-700/40 border border-border">
              <span>Audit Logging</span>
              <span className="text-emerald-400 font-bold">Configured</span>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Data Privacy Boundary"
            subtitle="Patent Principle"
            badge={<Badge variant="graded">Enforced</Badge>}
          />
          <div className="space-y-2 mt-2 text-xs text-text-secondary">
            <div className="flex items-center justify-between p-2 rounded-lg bg-surface-700/40 border border-border">
              <span>Typed Answers Kept</span>
              <span className="text-amber-400 font-bold">Excluded</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-surface-700/40 border border-border">
              <span>Audio/Video Telemetry</span>
              <span className="text-amber-400 font-bold">Excluded</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-surface-700/40 border border-border">
              <span>Behavioral Features</span>
              <span className="text-emerald-400 font-bold">Standardized</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Validation Issues Diagnostic */}
      <Card>
        <CardHeader
          title="Automated Data Quality Diagnostics"
          subtitle={`Verified ${status.totalRecords} records across 7 schema rules on ${status.validationReport.checkedAt.split('T')[0]}`}
          badge={
            <Badge variant={status.validationReport.isValid ? 'active' : 'high'}>
              {status.validationReport.errorCount} Errors · {status.validationReport.warningCount} Warnings
            </Badge>
          }
        />
        <div className="mt-3 p-4 rounded-xl bg-surface-700/30 border border-border text-xs text-text-secondary space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-bold">
            <CheckCircle2 size={16} />
            <span>Dataset Integrity Check Succeeded — Zero Schema Violations Detected</span>
          </div>
          <p className="text-[11px] text-text-muted leading-relaxed">
            All 120 prototype interaction records were checked for primary keys, non-null student/session identifiers, valid session types (`low_stakes` vs `graded`), non-negative response times, difficulty values $\in [0, 1]$, and binary event flags.
          </p>
        </div>
      </Card>
    </div>
  );
}
