'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  FileText,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Printer,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { generateRiskReport } from '@/lib/services/behavioralReportService';
import { getDemoStudentProfiles } from '@/lib/services/demoStudentService';
import { getAllGradedExamSessions } from '@/lib/services/examSessionService';
import { getStudentGradedRecords } from '@/lib/services/datasetService';
import { BehavioralRiskReportView } from '@/components/integrity/BehavioralRiskReportView';
import { BehavioralRiskReport } from '@/types';

function ReportsContent() {
  const searchParams = useSearchParams();
  const urlStudent = searchParams.get('student') || 'S003';
  const urlSession = searchParams.get('session') || undefined;

  const demoProfiles = useMemo(() => getDemoStudentProfiles(), []);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(urlStudent);
  const [availableSessions, setAvailableSessions] = useState<{ id: string; title: string }[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>(urlSession || '');
  const [report, setReport] = useState<BehavioralRiskReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load sessions for student
  useEffect(() => {
    const liveSessions = getAllGradedExamSessions().filter((s) => s.studentId === selectedStudentId);
    const syntheticGraded = getStudentGradedRecords(selectedStudentId);

    const sessionMap = new Map<string, { id: string; title: string }>();

    liveSessions.forEach((ls) => {
      sessionMap.set(ls.sessionId, {
        id: ls.sessionId,
        title: ls.examTitle || `Live Exam (${ls.sessionId})`,
      });
    });

    syntheticGraded.forEach((sr) => {
      if (!sessionMap.has(sr.session_id)) {
        sessionMap.set(sr.session_id, {
          id: sr.session_id,
          title: sr.human_review_label === 'flagged_mock'
            ? `Anomalous Demo Session (${sr.session_id})`
            : `Clean Graded Session (${sr.session_id})`,
        });
      }
    });

    const sessions = Array.from(sessionMap.values());
    setAvailableSessions(sessions);

    if (sessions.length > 0) {
      const match = sessions.find((s) => s.id === selectedSessionId);
      const chosen = match ? match.id : sessions[0].id;
      setSelectedSessionId(chosen);
    } else {
      setSelectedSessionId('');
    }
  }, [selectedStudentId]);

  // Generate risk report
  useEffect(() => {
    if (!selectedSessionId) return;

    try {
      setLoading(true);
      setError(null);
      const rep = generateRiskReport(selectedSessionId, 'instructor');
      setReport(rep);
    } catch (err: any) {
      setError(err.message || 'Failed to generate behavioral risk report.');
    } finally {
      setLoading(false);
    }
  }, [selectedSessionId]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Demo Student Switcher */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 print:hidden">
        {demoProfiles.map((p) => {
          const isSelected = p.id === selectedStudentId;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedStudentId(p.id)}
              className={`p-3 rounded-2xl border text-left transition-all ${
                isSelected
                  ? 'bg-surface-800 border-indigo-500 ring-2 ring-indigo-500/30 shadow-lg'
                  : 'bg-surface-800/60 border-border hover:border-border-strong'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="font-mono font-bold text-sky-400">{p.id}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                    p.modelMaturity === 'established'
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : p.modelMaturity === 'developing'
                      ? 'bg-amber-500/15 text-amber-300'
                      : 'bg-rose-500/15 text-rose-300'
                  }`}
                >
                  {p.modelMaturity.replace('_', ' ')}
                </span>
              </div>
              <span className="text-xs font-bold text-text-primary block truncate">{p.name}</span>
              <span className="text-[10px] text-text-muted block mt-0.5">{p.lowStakesSessionCount} Low-Stakes Sessions</span>
            </button>
          );
        })}
      </div>

      {/* Session Selector Bar */}
      <Card padding="sm" className="print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2 py-1 text-xs">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-text-muted font-semibold">Select Report Session:</span>
            <select
              aria-label="Select Report Session"
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="bg-surface-700 border border-border text-text-primary text-xs rounded-lg px-3 py-1.5 font-mono focus:outline-none focus:border-indigo-500 max-w-md"
            >
              {availableSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} — {s.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-text-muted">Student Scope:</span>
            <strong className="text-sky-400 font-mono">{selectedStudentId}</strong>
          </div>
        </div>
      </Card>

      {/* Main Report View */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
          {error}
        </div>
      ) : report ? (
        <BehavioralRiskReportView report={report} />
      ) : null}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ReportsContent />
    </Suspense>
  );
}
