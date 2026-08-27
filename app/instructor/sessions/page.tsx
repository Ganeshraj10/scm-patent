'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Filter, ArrowRight, Monitor, Smartphone, Tablet } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

import { formatDate } from '@/lib/formatters';
import { getExamSessions } from '@/lib/services/sessions';
import type { ExamSession, ReviewStatus, DeviceType } from '@/types';

type FilterStatus = 'all' | ReviewStatus;

const DeviceIcon = ({ type }: { type: DeviceType }) => {
  if (type === 'mobile') return <Smartphone size={13} className="text-text-muted" />;
  if (type === 'tablet') return <Tablet size={13} className="text-text-muted" />;
  return <Monitor size={13} className="text-text-muted" />;
};

export default function SessionsPage() {
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getExamSessions()
      .then(setSessions)
      .catch((err) => console.error('[SessionsPage]', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const sorted = [...sessions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const filtered = filter === 'all' ? sorted : sorted.filter((s) => s.reviewStatus === filter);

  const counts = {
    all: sessions.length,
    normal: sessions.filter((s) => s.reviewStatus === 'normal').length,
    review_required: sessions.filter((s) => s.reviewStatus === 'review_required').length,
    verified: sessions.filter((s) => s.reviewStatus === 'verified').length,
    disputed: sessions.filter((s) => s.reviewStatus === 'disputed').length,
  };

  return (
    <div className="space-y-5 max-w-7xl">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Examinations</h2>
        <p className="text-sm text-text-muted mt-0.5">
          {sessions.length} sessions recorded across all students
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={14} className="text-text-muted flex-shrink-0" />
        {(
          [
            { key: 'all', label: 'All' },
            { key: 'normal', label: 'Normal' },
            { key: 'review_required', label: 'Review Required' },
            { key: 'verified', label: 'Verified' },
            { key: 'disputed', label: 'Disputed' },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
              filter === key
                ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30'
                : 'bg-surface-700 text-text-secondary border-border hover:bg-surface-600',
            ].join(' ')}
          >
            {label}
            <span
              className={[
                'inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold',
                filter === key ? 'bg-indigo-500/30 text-indigo-300' : 'bg-surface-600 text-text-muted',
              ].join(' ')}
            >
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl bg-surface-800 border border-border overflow-hidden shadow-lg shadow-black/20">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-900/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Session</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Student</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider hidden md:table-cell">Type</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Deviation</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider hidden lg:table-cell">Threshold</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider hidden lg:table-cell">Device</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider hidden md:table-cell">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-sm text-text-muted">
                    No sessions match this filter.
                  </td>
                </tr>
              ) : (
                filtered.map((session) => (
                  <tr
                    key={session.id}
                    className="hover:bg-surface-700/50 transition-colors group"
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-text-primary">{session.examName}</p>
                      <p className="text-xs font-mono text-text-muted mt-0.5">{session.examCode}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/instructor/students/${session.studentId}`}
                        className="text-sm text-text-secondary hover:text-indigo-400 transition-colors"
                      >
                        {session.studentName}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <Badge
                        variant={session.type === 'graded_examination' ? 'graded' : 'low_stakes'}
                        size="sm"
                      >
                        {session.type === 'graded_examination' ? 'Graded' : 'Low Stakes'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span
                        className={[
                          'text-sm font-bold tabular-nums',
                          session.deviationScore > session.personalizedThreshold
                            ? 'text-rose-400'
                            : session.deviationScore > session.personalizedThreshold * 0.8
                            ? 'text-amber-400'
                            : 'text-emerald-400',
                        ].join(' ')}
                      >
                        {session.deviationScore.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right hidden lg:table-cell">
                      <span className="text-xs text-text-muted tabular-nums">
                        {session.personalizedThreshold.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      <div className="flex items-center gap-1.5">
                        <DeviceIcon type={session.deviceType} />
                        <span className="text-xs text-text-secondary capitalize">{session.deviceType}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge variant={session.reviewStatus as ReviewStatus} dot size="sm">
                        {session.reviewStatus === 'review_required'
                          ? 'Review'
                          : session.reviewStatus.charAt(0).toUpperCase() + session.reviewStatus.slice(1)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <span className="text-xs text-text-secondary">{formatDate(session.date)}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/instructor/sessions/${session.id}`}
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
          <p className="text-xs text-text-muted">Showing {filtered.length} of {sessions.length} sessions</p>
        </div>
      </div>
    </div>
  );
}
