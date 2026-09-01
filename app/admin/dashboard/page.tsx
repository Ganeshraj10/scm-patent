'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DatasetStatusCard } from '@/components/integrity/DatasetStatusCard';
import { getAllUsers, getUsersByRole } from '@/lib/services/userService';
import { getDatasetStatus } from '@/lib/services/datasetService';
import {
  Users,
  GraduationCap,
  Briefcase,
  Shield,
  CheckCircle2,
  AlertTriangle,
  SlidersHorizontal,
  Activity,
  ArrowRight,
  Database,
  UserPlus,
  Key,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const allUsers = useMemo(() => getAllUsers(), []);
  const students = useMemo(() => getUsersByRole('student'), []);
  const instructors = useMemo(() => getUsersByRole('instructor'), []);
  const admins = useMemo(() => getUsersByRole('admin'), []);
  const activeCount = useMemo(() => allUsers.filter((u) => u.status === 'active').length, [allUsers]);
  const disabledCount = useMemo(() => allUsers.filter((u) => u.status === 'disabled').length, [allUsers]);
  const datasetStatus = useMemo(() => getDatasetStatus(), []);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-amber-950/60 via-surface-800 to-surface-800 border border-amber-500/20 p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Administrator Portal
              </span>
              <span className="text-xs text-text-muted">
                Platform Governance & Role-Based Access Control (RBAC)
              </span>
            </div>
            <h2 className="text-xl font-bold text-text-primary mt-2">
              System Administration & User Management
            </h2>
            <p className="text-xs text-text-secondary mt-1 max-w-2xl leading-relaxed">
              Manage student accounts, instructors, and platform administrators. Review system dataset health and verify role-based permissions boundaries.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Link href="/admin/users">
              <Button variant="primary" size="sm" className="text-xs bg-amber-600 hover:bg-amber-500 text-white border-amber-500">
                <Users size={14} className="mr-1.5" />
                Manage Users ({allUsers.length})
              </Button>
            </Link>
            <Link href="/instructor/analysis">
              <Button variant="secondary" size="sm" className="text-xs">
                <Activity size={14} className="mr-1.5 text-indigo-400" />
                Integrity Workbench
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="p-3.5 rounded-xl bg-surface-800 border border-border">
          <div className="flex items-center justify-between text-text-muted text-[11px]">
            <span>Total Accounts</span>
            <Users size={14} className="text-indigo-400" />
          </div>
          <p className="text-2xl font-black text-text-primary mt-1 tabular-nums">
            {allUsers.length}
          </p>
          <span className="text-[10px] text-text-muted">Registered Users</span>
        </div>

        <div className="p-3.5 rounded-xl bg-surface-800 border border-border">
          <div className="flex items-center justify-between text-text-muted text-[11px]">
            <span>Students</span>
            <GraduationCap size={14} className="text-sky-400" />
          </div>
          <p className="text-2xl font-black text-sky-400 mt-1 tabular-nums">
            {students.length}
          </p>
          <span className="text-[10px] text-text-muted">Mapped Cohorts</span>
        </div>

        <div className="p-3.5 rounded-xl bg-surface-800 border border-border">
          <div className="flex items-center justify-between text-text-muted text-[11px]">
            <span>Instructors</span>
            <Briefcase size={14} className="text-indigo-400" />
          </div>
          <p className="text-2xl font-black text-indigo-400 mt-1 tabular-nums">
            {instructors.length}
          </p>
          <span className="text-[10px] text-text-muted">Reviewers</span>
        </div>

        <div className="p-3.5 rounded-xl bg-surface-800 border border-border">
          <div className="flex items-center justify-between text-text-muted text-[11px]">
            <span>Administrators</span>
            <Shield size={14} className="text-amber-400" />
          </div>
          <p className="text-2xl font-black text-amber-400 mt-1 tabular-nums">
            {admins.length}
          </p>
          <span className="text-[10px] text-text-muted">Platform Admins</span>
        </div>

        <div className="p-3.5 rounded-xl bg-surface-800 border border-border">
          <div className="flex items-center justify-between text-text-muted text-[11px]">
            <span>Active Status</span>
            <CheckCircle2 size={14} className="text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400 mt-1 tabular-nums">
            {activeCount}
          </p>
          <span className="text-[10px] text-text-muted">Enabled Accounts</span>
        </div>

        <div className="p-3.5 rounded-xl bg-surface-800 border border-border">
          <div className="flex items-center justify-between text-text-muted text-[11px]">
            <span>Disabled Status</span>
            <AlertTriangle size={14} className="text-rose-400" />
          </div>
          <p className="text-2xl font-black text-rose-400 mt-1 tabular-nums">
            {disabledCount}
          </p>
          <span className="text-[10px] text-text-muted">Suspended</span>
        </div>
      </div>

      {/* Dataset Status Section */}
      <DatasetStatusCard status={datasetStatus} />

      {/* Role-Based Permissions Reference Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card>
          <CardHeader
            title="Student Role Boundary"
            subtitle="Test-Takers (Self-Telemetry Only)"
            badge={<Badge variant="normal">Restricted</Badge>}
          />
          <div className="space-y-2.5 text-xs text-text-secondary mt-2">
            <p className="text-[11px] leading-relaxed">
              Students access only their own assigned coursework, examinations, and personal results. They cannot view other students or reviewer queues.
            </p>
            <div className="p-2.5 rounded-lg bg-surface-700/40 border border-border space-y-1 font-mono text-[11px]">
              <div className="text-emerald-400">✓ /student/dashboard</div>
              <div className="text-emerald-400">✓ /student/practice</div>
              <div className="text-emerald-400">✓ /student/examination</div>
              <div className="text-rose-400">✗ /instructor/* (Blocked)</div>
              <div className="text-rose-400">✗ /admin/* (Blocked)</div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Instructor Role Boundary"
            subtitle="Human Reviewers (Examinations & Analysis)"
            badge={<Badge variant="graded">Reviewer</Badge>}
          />
          <div className="space-y-2.5 text-xs text-text-secondary mt-2">
            <p className="text-[11px] leading-relaxed">
              Instructors review student session telemetry, inspect behavioral deviation reports, and record review resolutions. Forbidden from admin user management.
            </p>
            <div className="p-2.5 rounded-lg bg-surface-700/40 border border-border space-y-1 font-mono text-[11px]">
              <div className="text-emerald-400">✓ /instructor/dashboard</div>
              <div className="text-emerald-400">✓ /instructor/analysis</div>
              <div className="text-emerald-400">✓ /instructor/alerts (Queue)</div>
              <div className="text-emerald-400">✓ /instructor/students</div>
              <div className="text-rose-400">✗ /admin/* (Blocked)</div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Administrator Role Boundary"
            subtitle="Platform Governance & System Oversight"
            badge={<Badge variant="review_required">Admin</Badge>}
          />
          <div className="space-y-2.5 text-xs text-text-secondary mt-2">
            <p className="text-[11px] leading-relaxed">
              Administrators manage user accounts, assign roles, inspect platform health, and adjust application settings without mixing raw private interaction telemetry.
            </p>
            <div className="p-2.5 rounded-lg bg-surface-700/40 border border-border space-y-1 font-mono text-[11px]">
              <div className="text-emerald-400">✓ /admin/dashboard</div>
              <div className="text-emerald-400">✓ /admin/users (CRUD)</div>
              <div className="text-emerald-400">✓ /admin/status (Health)</div>
              <div className="text-emerald-400">✓ /admin/settings</div>
              <div className="text-emerald-400">✓ System-Wide Oversight</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Action Navigation Links */}
      <Card>
        <CardHeader
          title="Administrative Shortcuts"
          subtitle="Direct links to administrative tools and management modules"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
          <Link
            href="/admin/users"
            className="p-3.5 rounded-xl bg-surface-700/40 hover:bg-surface-700 border border-border transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Users size={16} />
              </div>
              <div>
                <span className="text-xs font-bold text-text-primary block">User Directory</span>
                <span className="text-[10px] text-text-muted">Manage roles & status</span>
              </div>
            </div>
            <ArrowRight size={14} className="text-text-muted group-hover:text-text-primary group-hover:translate-x-0.5 transition-all" />
          </Link>

          <Link
            href="/admin/status"
            className="p-3.5 rounded-xl bg-surface-700/40 hover:bg-surface-700 border border-border transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Database size={16} />
              </div>
              <div>
                <span className="text-xs font-bold text-text-primary block">Dataset Status</span>
                <span className="text-[10px] text-text-muted">120 prototype records</span>
              </div>
            </div>
            <ArrowRight size={14} className="text-text-muted group-hover:text-text-primary group-hover:translate-x-0.5 transition-all" />
          </Link>

          <Link
            href="/instructor/analysis"
            className="p-3.5 rounded-xl bg-surface-700/40 hover:bg-surface-700 border border-border transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <Activity size={16} />
              </div>
              <div>
                <span className="text-xs font-bold text-text-primary block">Integrity Analysis</span>
                <span className="text-[10px] text-text-muted">Baseline workbench</span>
              </div>
            </div>
            <ArrowRight size={14} className="text-text-muted group-hover:text-text-primary group-hover:translate-x-0.5 transition-all" />
          </Link>

          <Link
            href="/admin/settings"
            className="p-3.5 rounded-xl bg-surface-700/40 hover:bg-surface-700 border border-border transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <SlidersHorizontal size={16} />
              </div>
              <div>
                <span className="text-xs font-bold text-text-primary block">Platform Settings</span>
                <span className="text-[10px] text-text-muted">RBAC & Security rules</span>
              </div>
            </div>
            <ArrowRight size={14} className="text-text-muted group-hover:text-text-primary group-hover:translate-x-0.5 transition-all" />
          </Link>
        </div>
      </Card>
    </div>
  );
}
