'use client';

import React from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  SlidersHorizontal,
  Shield,
  Lock,
  Eye,
  CheckCircle2,
  FileCheck,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

export default function AdminSettingsPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-text-primary">Platform Settings & Governance</h2>
        <p className="text-xs text-text-muted mt-0.5">
          Configure role-based access rules, ethical review policies, and baseline update eligibility criteria
        </p>
      </div>

      {/* Role-Based Policy Settings */}
      <Card>
        <CardHeader
          title="Role-Based Access Control (RBAC) Policies"
          subtitle="Enforced platform access permissions for the 3 distinct roles"
        />
        <div className="space-y-4 mt-3 text-xs text-text-secondary">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3.5 rounded-xl bg-surface-700/40 border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sky-400">Student Role Policy</span>
                <Badge variant="active">Active</Badge>
              </div>
              <p className="text-[11px] text-text-muted leading-relaxed">
                Test-takers can only view their own coursework and mapped telemetry. Cross-student data queries are strictly blocked.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-700/40 border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-indigo-400">Instructor Role Policy</span>
                <Badge variant="active">Active</Badge>
              </div>
              <p className="text-[11px] text-text-muted leading-relaxed">
                Reviewers have read-only access to student examination telemetry and write access to the human review queue.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-700/40 border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-400">Admin Role Policy</span>
                <Badge variant="active">Active</Badge>
              </div>
              <p className="text-[11px] text-text-muted leading-relaxed">
                Administrators manage platform users and system health, with administrative data logically decoupled from behavioral telemetry.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Baseline Update & Model Governance Policy */}
      <Card>
        <CardHeader
          title="Baseline Update & Human Review Policy"
          subtitle="Patent Core Requirement: Model-Update Eligibility Rule"
          badge={<Badge variant="verified">Patent Compliant</Badge>}
        />
        <div className="mt-3 space-y-3 text-xs text-text-secondary">
          <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-500/20 space-y-2">
            <div className="flex items-center gap-2 text-indigo-300 font-bold">
              <FileCheck size={16} />
              <span>Model Update Eligibility Rule</span>
            </div>
            <p className="text-[11px] text-text-muted leading-relaxed">
              Only sessions from `low_stakes` coursework OR exam sessions explicitly verified as <strong>&ldquo;Verified Clean&rdquo;</strong> by an authorized human reviewer may update a student&apos;s personalized baseline model. Unverified, pending, or flagged sessions are permanently excluded from baseline retraining.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-700/40 border border-border space-y-2">
            <div className="flex items-center gap-2 text-text-primary font-bold">
              <Shield size={16} className="text-emerald-400" />
              <span>Non-Accusatory Terminology Standard</span>
            </div>
            <p className="text-[11px] text-text-muted leading-relaxed">
              The platform strictly enforces non-accusatory terminology (&ldquo;Behavioral Deviation&rdquo;, &ldquo;Review Recommended&rdquo;, &ldquo;Personalized Baseline&rdquo;, &ldquo;Insufficient History&rdquo;, &ldquo;Verified Clean&rdquo;). The system never makes automated misconduct declarations.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
