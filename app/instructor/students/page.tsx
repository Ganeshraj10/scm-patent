'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Filter, ArrowRight, Monitor, Smartphone, Tablet } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { getStudents } from '@/lib/services/students';
import { formatRelativeTime, formatModelStatus } from '@/lib/formatters';
import type { Student, ReviewStatus, ModelStatus, DeviceType } from '@/types';

import { DemoStudentSelector } from '@/components/demo/DemoStudentSelector';
import { Card, CardHeader } from '@/components/ui/Card';
import { ShieldCheck, Brain, AlertCircle, Info } from 'lucide-react';

const DeviceIcon = ({ type }: { type: DeviceType }) => {
  if (type === 'mobile') return <Smartphone size={14} className="text-text-muted" />;
  if (type === 'tablet') return <Tablet size={14} className="text-text-muted" />;
  return <Monitor size={14} className="text-text-muted" />;
};

export default function StudentsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ReviewStatus>('all');
  const [deviceFilter, setDeviceFilter] = useState<'all' | DeviceType>('all');
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getStudents()
      .then(setStudents)
      .catch((err) => setError(err.message ?? 'Failed to load students.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = students.filter((s) => {
    const matchesSearch =
      search === '' ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.studentId.toLowerCase().includes(search.toLowerCase()) ||
      s.department.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.reviewStatus === statusFilter;
    const matchesDevice = deviceFilter === 'all' || s.deviceType === deviceFilter;
    return matchesSearch && matchesStatus && matchesDevice;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <p className="text-sm text-rose-400 font-medium">{error}</p>
        <button
          onClick={() => { setLoading(true); setError(null); getStudents().then(setStudents).catch((e) => setError(e.message)).finally(() => setLoading(false)); }}
          className="text-xs text-indigo-400 hover:text-indigo-300 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-text-primary">Student Behavioral Profiles</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Prototype / Synthetic Research Data
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Demonstrating personalized longitudinal model maturity progression (Cold Start · Developing · Established)
          </p>
        </div>
        <Link
          href="/instructor/analysis"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-900/30 transition-all self-start sm:self-auto"
        >
          Integrity Analysis Workbench
          <ArrowRight size={13} />
        </Link>
      </div>

      {/* Demo Student Profiles Quick Switcher */}
      <DemoStudentSelector showNavigationLinks={true} />

      {/* Core Principle Notice */}
      <div className="p-4 rounded-2xl bg-surface-800 border border-border/80 flex items-start gap-3.5 text-xs">
        <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 shrink-0 mt-0.5">
          <Info size={18} />
        </div>
        <div className="space-y-1 text-text-secondary leading-relaxed">
          <span className="font-bold text-text-primary">Personalized Baseline Independence Principle</span>
          <p className="text-[11px] text-text-muted">
            Students are evaluated <strong>exclusively against their own prior low-stakes history</strong>.
            Student A (fast responder, ~30s) and Student B (deliberate responder, ~44s) both exhibit normal behavior for themselves.
            The system avoids cross-student suspicion rankings and never applies a one-size-fits-all population baseline.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            placeholder="Search students…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 h-9 rounded-lg bg-surface-700 border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-indigo-500/60 transition-colors"
            id="student-search"
          />
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-text-muted flex-shrink-0" />
          {(['all', 'normal', 'review_required', 'verified', 'disputed'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={[
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                statusFilter === s
                  ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30'
                  : 'bg-surface-700 text-text-secondary border-border hover:bg-surface-600',
              ].join(' ')}
            >
              {s === 'all' ? 'All' : s === 'review_required' ? 'Review Required' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Device filter */}
        <select
          value={deviceFilter}
          onChange={(e) => setDeviceFilter(e.target.value as 'all' | DeviceType)}
          className="h-9 px-3 rounded-lg bg-surface-700 border border-border text-sm text-text-secondary focus:outline-none focus:border-indigo-500/60 transition-colors"
          id="device-filter"
        >
          <option value="all">All Devices</option>
          <option value="desktop">Desktop</option>
          <option value="mobile">Mobile</option>
          <option value="tablet">Tablet</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl bg-surface-800 border border-border overflow-hidden shadow-lg shadow-black/20">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table">
            <thead>
              <tr className="border-b border-border bg-surface-900/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Student</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider hidden md:table-cell">ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Model</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider hidden lg:table-cell">Sessions</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Deviation</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider hidden lg:table-cell">Device</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider hidden md:table-cell">Last Active</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-sm text-text-muted">
                    No students match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((student) => (
                  <tr
                    key={student.id}
                    className="hover:bg-surface-700/50 transition-colors group"
                  >
                    <td className="px-5 py-3.5">
                      <div>
                        <p className="font-medium text-text-primary group-hover:text-indigo-400 transition-colors">
                          {student.name}
                        </p>
                        <p className="text-xs text-text-muted mt-0.5">{student.department}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <span className="text-xs font-mono text-text-secondary">{student.studentId}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-1">
                        <Badge variant={student.modelStatus as ModelStatus} dot size="sm">
                          {formatModelStatus(student.modelStatus)}
                        </Badge>
                        <span className="text-[10px] text-text-muted">{student.modelConfidence}% confidence</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right hidden lg:table-cell">
                      <span className="text-sm tabular-nums text-text-secondary">{student.sessionCount}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span
                        className={[
                          'text-sm font-semibold tabular-nums',
                          student.averageDeviationScore > 40
                            ? 'text-rose-400'
                            : student.averageDeviationScore > 25
                            ? 'text-amber-400'
                            : 'text-emerald-400',
                        ].join(' ')}
                      >
                        {student.averageDeviationScore.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      <div className="flex items-center gap-1.5">
                        <DeviceIcon type={student.deviceType} />
                        <span className="text-xs text-text-secondary capitalize">{student.deviceType}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <span className="text-xs text-text-secondary">
                        {formatRelativeTime(student.lastActivity)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge variant={student.reviewStatus as ReviewStatus} dot size="sm">
                        {student.reviewStatus === 'review_required'
                          ? 'Review'
                          : student.reviewStatus.charAt(0).toUpperCase() + student.reviewStatus.slice(1)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/instructor/students/${student.id}`}
                        className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        View <ArrowRight size={11} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-border bg-surface-900/30">
          <p className="text-xs text-text-muted">
            Showing {filtered.length} of {students.length} students
          </p>
        </div>
      </div>
    </div>
  );
}
