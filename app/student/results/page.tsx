'use client';

import Link from 'next/link';
import {
  BarChart3,
  Clock,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { getStudentSessions, getTrackedSessionsByStudent } from '@/lib/services/sessions';
import { formatRelativeTime, formatDate } from '@/lib/formatters';
import { useState, useEffect } from 'react';

import { getCurrentStudentProfile } from '@/lib/services/students';

// Demo mock fallbacks will be resolved per student UUID where possible
export default function ResultsPage() {
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    getCurrentStudentProfile().then(profile => {
      if (!active) return;
      if (!profile) {
        setProfileError('Student profile not found');
        setLoading(false);
        return;
      }
      
      const studentId = profile.id;
      getStudentSessions(studentId).then(baseSessions => {
        getTrackedSessionsByStudent(studentId).then(tracked => {
          if (!active) return;
          const combined = [...baseSessions, ...tracked];
          const unique = Array.from(new Map(combined.map(s => [s.id, s])).values());
          const sorted = unique.sort((a, b) => new Date(b.date || (b as any).startedAt).getTime() - new Date(a.date || (a as any).startedAt).getTime());
          
          setSessions(sorted);
          setLoading(false);
        }).catch(() => {
          if (active) setLoading(false);
        });
      }).catch(() => {
        if (active) setLoading(false);
      });
    }).catch(err => {
      if (active) {
        setProfileError(err.message);
        setLoading(false);
      }
    });
    
    return () => { active = false; };
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-text-muted">Loading results...</div>;
  }
  if (profileError) {
    return <div className="p-8 text-center text-rose-400">{profileError || 'Unable to load profile'}</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">My Results</h2>
          <p className="text-sm text-text-muted mt-0.5">
            History of your practice and examination sessions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-surface-800 text-xs text-text-secondary hover:bg-surface-700 transition-colors">
            <Filter size={13} />
            Filter
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <div className="rounded-xl bg-surface-800 border border-border p-4 text-center">
          <p className="text-2xl font-bold tabular-nums text-text-primary">{sessions.length}</p>
          <p className="text-xs text-text-muted mt-1">Total Sessions</p>
        </div>
        <div className="rounded-xl bg-surface-800 border border-border p-4 text-center">
          <p className="text-2xl font-bold tabular-nums text-indigo-400">
            {sessions.filter(s => s.type === 'low_stakes').length}
          </p>
          <p className="text-xs text-text-muted mt-1">Practice Sessions</p>
        </div>
        <div className="rounded-xl bg-surface-800 border border-border p-4 text-center">
          <p className="text-2xl font-bold tabular-nums text-emerald-400">
            {sessions.filter(s => s.type === 'graded_examination').length}
          </p>
          <p className="text-xs text-text-muted mt-1">Graded Exams</p>
        </div>
        <div className="rounded-xl bg-surface-800 border border-border p-4 text-center">
          <p className="text-2xl font-bold tabular-nums text-amber-400">
            {sessions.filter(s => s.reviewStatus === 'review_required').length}
          </p>
          <p className="text-xs text-text-muted mt-1">Flags (Review Needed)</p>
        </div>
      </div>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-900/40">
                <th className="text-left px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Exam</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider hidden sm:table-cell">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Integrity Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sessions.map((session) => {
                const isFlagged = session.reviewStatus === 'review_required' || session.reviewStatus === 'disputed';
                return (
                  <tr key={session.id} className="hover:bg-surface-700/40 transition-colors group">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-text-primary">{session.examName}</p>
                      <p className="text-xs font-mono text-text-muted mt-0.5">{session.examCode}</p>
                    </td>
                    <td className="px-4 py-3.5 hidden sm:table-cell">
                      <Badge variant={session.type === 'graded_examination' ? 'graded' : 'low_stakes'} size="sm">
                        {session.type === 'graded_examination' ? 'Graded' : 'Low Stakes'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 text-text-secondary">
                        <Clock size={12} className="text-text-muted" />
                        <span>{formatDate(session.date)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {isFlagged ? (
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle size={14} className="text-amber-400" />
                          <span className="text-sm font-medium text-amber-400">Under Review</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle size={14} className="text-emerald-400" />
                          <span className="text-sm font-medium text-emerald-400">Verified</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors opacity-0 group-hover:opacity-100" onClick={() => alert('Detailed session report coming in later phases.')}>
                        Details <ChevronRight size={11} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
