'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Clock,
  RotateCcw,
  MousePointer,
  ArrowDown,
  ClipboardX,
  Monitor,
  Smartphone,
  Laptop,
  CheckCircle,
  ShieldCheck,
  Info,
  Layers,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getGradedExamSession } from '@/lib/services/examSessionService';
import { GradedExamSession } from '@/types';

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<GradedExamSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const data = getGradedExamSession(id);
    setSession(data);
    setLoading(false);
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="space-y-4 max-w-4xl">
        <Link href="/instructor/sessions" className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary">
          <ArrowLeft size={14} /> Back to Sessions
        </Link>
        <Card padding="lg">
          <div className="p-8 text-center text-text-muted text-xs space-y-2">
            <p>Examination session <strong>{id}</strong> could not be found.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Top Header */}
      <div className="flex items-start gap-4">
        <Link
          href="/instructor/sessions"
          className="mt-1 p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-700 transition-colors flex-shrink-0"
          aria-label="Back to sessions"
        >
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h2 className="text-lg font-semibold text-text-primary font-mono">{session.sessionId}</h2>
            <Badge variant="active" size="sm">
              Student: {session.studentId}
            </Badge>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
              Graded Examination
            </span>
          </div>
          <p className="text-xs text-text-muted">
            {session.examTitle} · Completed at {session.completedAt || session.startedAt} · Device: {session.deviceType}
          </p>
        </div>
      </div>

      {/* Objective Telemetry Banner */}
      <div className="p-4 rounded-2xl bg-surface-800 border border-indigo-500/30 flex items-start gap-3.5 shadow-lg">
        <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 shrink-0 mt-0.5">
          <ShieldCheck size={20} />
        </div>
        <div className="space-y-1 text-xs text-text-secondary leading-relaxed">
          <span className="font-bold text-text-primary">Objective Behavioral Telemetry Collection</span>
          <p className="text-[11px] text-text-muted">
            This view presents the derived interaction telemetry captured during this graded session.
            In accordance with patent specifications, baseline comparison and deviation analysis will occur in subsequent evaluation stages. No automated cheating verdicts or penalty conclusions are generated here.
          </p>
        </div>
      </div>

      {/* Session Metadata KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-surface-800 border border-border">
          <span className="text-[10px] text-text-muted block">Questions Completed</span>
          <span className="text-lg font-bold text-text-primary font-mono">
            {session.completedQuestionsCount} / {session.questionCount}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-surface-800 border border-border">
          <span className="text-[10px] text-text-muted block">Avg Response Time</span>
          <span className="text-lg font-bold text-emerald-400 font-mono">
            {session.avgResponseTimeSec || 0}s
          </span>
        </div>
        <div className="p-3 rounded-xl bg-surface-800 border border-border">
          <span className="text-[10px] text-text-muted block">Avg Revisions</span>
          <span className="text-lg font-bold text-indigo-300 font-mono">
            {session.avgRevisionCount || 0}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-surface-800 border border-border">
          <span className="text-[10px] text-text-muted block">Hardware Context</span>
          <span className="text-sm font-bold text-sky-400 capitalize">
            {session.deviceType.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Question-by-Question Derived Telemetry Table */}
      <Card>
        <CardHeader
          title="Question-Level Derived Telemetry Records"
          subtitle={`Derived interaction metrics captured across ${session.interactions.length} questions`}
          badge={
            <div className="flex items-center gap-2">
              <Badge variant="active">{session.interactions.length} Question Records</Badge>
              <Link href="/instructor/validation">
                <Button variant="ghost" size="sm" className="text-xs h-7 text-indigo-400">
                  Detailed Validation View →
                </Button>
              </Link>
            </div>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-700/40 text-text-muted text-[11px]">
                <th className="py-2.5 px-3 font-semibold">Q#</th>
                <th className="py-2.5 px-3 font-semibold">Question ID</th>
                <th className="py-2.5 px-3 font-semibold">Type</th>
                <th className="py-2.5 px-3 font-semibold">Difficulty</th>
                <th className="py-2.5 px-3 font-semibold">Response</th>
                <th className="py-2.5 px-3 font-semibold">Ans Rev</th>
                <th className="py-2.5 px-3 font-semibold">Code Rev</th>
                <th className="py-2.5 px-3 font-semibold">Correctness</th>
                <th className="py-2.5 px-3 font-semibold">Pointer Speed</th>
                <th className="py-2.5 px-3 font-semibold">Scroll Dist</th>
                <th className="py-2.5 px-3 font-semibold">Paste</th>
                <th className="py-2.5 px-3 font-semibold">Burst</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-mono text-[11px] text-text-secondary">
              {session.interactions.map((q, idx) => (
                <tr key={q.recordId || idx} className="hover:bg-surface-700/30 transition-colors">
                  <td className="py-2.5 px-3 text-text-muted font-sans font-medium">{q.sessionPosition || idx + 1}</td>
                  <td className="py-2.5 px-3 text-sky-300 font-bold">{q.questionId}</td>
                  <td className="py-2.5 px-3 font-sans">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-surface-700 border border-border text-text-secondary uppercase">
                      {q.questionType || 'mcq'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-text-muted">{q.questionDifficulty.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-emerald-400 font-bold">{q.responseTimeSec}s</td>
                  <td className="py-2.5 px-3 text-indigo-300 font-bold">{q.answerRevisionCount}</td>
                  <td className="py-2.5 px-3 text-sky-300 font-bold">{q.codeRevisionCount || 0}</td>
                  <td className="py-2.5 px-3 font-sans">
                    {q.isAnswerCorrect ? (
                      <span className="text-emerald-400 font-semibold inline-flex items-center gap-1">
                        <CheckCircle size={11} /> Correct
                      </span>
                    ) : (
                      <span className="text-rose-400 font-semibold">
                        Incorrect
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-amber-300">{q.pointerAvgSpeedPxS} px/s</td>
                  <td className="py-2.5 px-3 text-sky-300">{q.scrollDistancePx} px</td>
                  <td className="py-2.5 px-3 font-sans">
                    {q.pasteDetected === 1 ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Detected
                      </span>
                    ) : (
                      <span className="text-text-muted">None</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-sans">
                    {q.characterBurstFlag === 1 ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        Detected
                      </span>
                    ) : (
                      <span className="text-text-muted">Normal</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
