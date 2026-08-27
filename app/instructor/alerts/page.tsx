'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Filter,
  ChevronRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { getReviewQueue } from '@/lib/services/reviews';
import { formatDate, formatRelativeTime } from '@/lib/formatters';
import type { ReviewStatus, AlertSeverity } from '@/types';
import { useEffect } from 'react';

type SeverityFilter = 'all' | AlertSeverity;
type StatusFilter = 'all' | ReviewStatus;

export default function AlertsPage() {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getReviewQueue().then((data) => {
      if (active) {
        setAlerts(data);
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-text-muted">Loading review queue...</div>;
  }

  const filtered = alerts.filter((a) => {
    const matchesSeverity = severityFilter === 'all' || a.severity === severityFilter;
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
    return matchesSeverity && matchesStatus;
  });

  const pendingCount = alerts.filter((a) => a.status === 'review_required').length;
  const disputedCount = alerts.filter((a) => a.status === 'disputed').length;
  const verifiedCount = alerts.filter((a) => a.status === 'verified').length;

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Review Queue</h2>
        <p className="text-sm text-text-muted mt-0.5">
          Human review required for all flagged sessions — no automatic action is taken.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-amber-500/8 border border-amber-500/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={15} className="text-amber-400" />
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Pending Review</span>
          </div>
          <p className="text-3xl font-bold tabular-nums text-text-primary">{pendingCount}</p>
        </div>
        <div className="rounded-xl bg-rose-500/8 border border-rose-500/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={15} className="text-rose-400" />
            <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">Disputed</span>
          </div>
          <p className="text-3xl font-bold tabular-nums text-text-primary">{disputedCount}</p>
        </div>
        <div className="rounded-xl bg-sky-500/8 border border-sky-500/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={15} className="text-sky-400" />
            <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider">Verified</span>
          </div>
          <p className="text-3xl font-bold tabular-nums text-text-primary">{verifiedCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-text-muted flex-shrink-0" />
          <span className="text-xs text-text-muted">Severity:</span>
          {(['all', 'high', 'medium', 'low'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSeverityFilter(s)}
              className={[
                'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border',
                severityFilter === s
                  ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30'
                  : 'bg-surface-700 text-text-secondary border-border hover:bg-surface-600',
              ].join(' ')}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-text-muted">Status:</span>
          {(['all', 'review_required', 'disputed', 'verified'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={[
                'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border',
                statusFilter === s
                  ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30'
                  : 'bg-surface-700 text-text-secondary border-border hover:bg-surface-600',
              ].join(' ')}
            >
              {s === 'all' ? 'All' : s === 'review_required' ? 'Review Required' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Alert cards */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 rounded-xl bg-surface-800 border border-border">
            <CheckCircle size={28} className="text-emerald-400 mx-auto mb-3" />
            <p className="text-sm text-text-secondary">No items match your filters.</p>
          </div>
        ) : (
          filtered.map((reviewItem) => (
            <Card key={reviewItem.id} padding="sm">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                {/* Left: severity indicator */}
                <div
                  className={[
                    'w-1 self-stretch rounded-full flex-shrink-0 hidden sm:block',
                    reviewItem.severity === 'high' ? 'bg-rose-500' :
                    reviewItem.severity === 'medium' ? 'bg-amber-500' :
                    'bg-emerald-500',
                  ].join(' ')}
                />

                {/* Center: content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="text-sm font-semibold text-text-primary">{reviewItem.studentName}</span>
                    <Badge variant={reviewItem.severity} size="sm">
                      {reviewItem.severity.toUpperCase()}
                    </Badge>
                    <Badge variant={reviewItem.status as ReviewStatus} dot size="sm">
                      {reviewItem.status === 'review_required' ? 'Review Required' : reviewItem.status.charAt(0).toUpperCase() + reviewItem.status.slice(1)}
                    </Badge>
                  </div>
                  <p className="text-sm text-text-secondary mb-2">{reviewItem.examName}</p>

                  {/* Deviation vs threshold */}
                  <div className="flex items-center gap-4 mb-3">
                    <div>
                      <p className="text-[10px] text-text-muted uppercase tracking-wide">Deviation</p>
                      <p
                        className={[
                          'text-lg font-bold tabular-nums',
                          reviewItem.deviationScore > reviewItem.personalizedThreshold
                            ? 'text-rose-400'
                            : 'text-amber-400',
                        ].join(' ')}
                      >
                        {reviewItem.deviationScore.toFixed(1)}
                      </p>
                    </div>
                    <div className="text-text-muted text-lg font-thin">vs</div>
                    <div>
                      <p className="text-[10px] text-text-muted uppercase tracking-wide">Threshold</p>
                      <p className="text-lg font-bold tabular-nums text-text-secondary">
                        {reviewItem.personalizedThreshold.toFixed(1)}
                      </p>
                    </div>
                    <div className="flex-1">
                      <ProgressBar
                        value={reviewItem.deviationScore}
                        max={Math.max(reviewItem.deviationScore * 1.2, reviewItem.personalizedThreshold * 1.5)}
                        colorThresholds={{
                          low: reviewItem.personalizedThreshold * 0.8,
                          high: reviewItem.personalizedThreshold,
                        }}
                        size="sm"
                        className="mt-4"
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  {reviewItem.notes && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-surface-700 border border-border mb-3">
                      <AlertTriangle size={12} className="text-text-muted mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-text-secondary italic">{reviewItem.notes}</p>
                    </div>
                  )}

                  {/* Meta */}
                  <div className="flex items-center gap-3 text-xs text-text-muted flex-wrap">
                    <div className="flex items-center gap-1">
                      <Clock size={11} />
                      <span>{formatRelativeTime(reviewItem.createdAt)}</span>
                    </div>
                    {reviewItem.reviewedBy && (
                      <>
                        <span>·</span>
                        <span>Reviewed by {reviewItem.reviewedBy} on {formatDate(reviewItem.reviewedAt!)}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Right: actions */}
                <div className="flex sm:flex-col items-center sm:items-end gap-2 flex-shrink-0">
                  <Link
                    href={`/instructor/sessions/${reviewItem.sessionId}`}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600/10 border border-indigo-500/25 text-xs text-indigo-400 hover:bg-indigo-600/20 transition-colors font-medium"
                  >
                    View Report
                    <ChevronRight size={12} />
                  </Link>
                  {reviewItem.status === 'review_required' && (
                    <div className="flex gap-2">
                      <button
                        className="px-2.5 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-400 hover:bg-emerald-500/20 transition-colors font-medium"
                        onClick={() => window.alert('Phase 11: Review decision coming')}
                      >
                        ✓ Verified
                      </button>
                      <button
                        className="px-2.5 py-2 rounded-lg bg-rose-500/10 border border-rose-500/25 text-xs text-rose-400 hover:bg-rose-500/20 transition-colors font-medium"
                        onClick={() => window.alert('Phase 11: Review decision coming')}
                      >
                        ✕ Not Verified
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Human review notice */}
      <Card padding="sm">
        <div className="flex items-start gap-3">
          <CheckCircle size={15} className="text-sky-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-sky-400">Human Review Policy</p>
            <p className="text-xs text-text-secondary mt-0.5">
              ExamGuard does not automatically penalize students. All flagged sessions require a qualified
              instructor to review the behavioral evidence and make a determination. Review decisions
              are recorded and update the student&apos;s personalized model accordingly.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
