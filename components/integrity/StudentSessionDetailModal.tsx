'use client';

import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  getStudentSessionDetails,
  ReadableQuestionInteraction,
} from '@/lib/services/studentHistoryService';
import { DatasetSession } from '@/types';
import {
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Activity,
  MousePointer2,
  Scroll,
  Layers,
  Sparkles,
} from 'lucide-react';

interface StudentSessionDetailModalProps {
  studentId: string;
  sessionId: string | null;
  onClose: () => void;
}

export function StudentSessionDetailModal({
  studentId,
  sessionId,
  onClose,
}: StudentSessionDetailModalProps) {
  if (!sessionId) return null;

  const data = getStudentSessionDetails(studentId, sessionId);

  if (!data) {
    return (
      <Modal open={true} onClose={onClose} title="Session Details" size="md">
        <div className="p-6 text-center text-text-muted text-xs space-y-2">
          <p>Unable to retrieve session records or access is restricted.</p>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </Modal>
    );
  }

  const { session, questions } = data;
  const isLowStakes = session.sessionType === 'low_stakes';

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={`Session Telemetry: ${session.sessionId}`}
      size="xl"
    >
      <div className="space-y-4 text-xs">
        {/* Session Metadata Banner */}
        <div className="p-3.5 rounded-xl bg-surface-700/40 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  isLowStakes
                    ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                    : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                }`}
              >
                {isLowStakes ? 'Practice / Low-Stakes' : 'Graded Examination'}
              </span>
              <span className="font-bold text-text-primary">{session.timestamp}</span>
              <span className="text-text-muted font-mono">({session.deviceType})</span>
            </div>
            <p className="text-[11px] text-text-muted">
              {questions.length} Question Interactions Recorded · Student: <strong className="text-indigo-300">{studentId}</strong>
            </p>
          </div>

          <div className="flex items-center gap-3 text-right">
            <div>
              <span className="text-[10px] text-text-muted block">Avg Response</span>
              <span className="text-sm font-bold text-emerald-400 font-mono">
                {session.avgResponseTimeSec}s
              </span>
            </div>
            <div>
              <span className="text-[10px] text-text-muted block">Avg Revisions</span>
              <span className="text-sm font-bold text-indigo-300 font-mono">
                {session.avgRevisionCount}
              </span>
            </div>
          </div>
        </div>

        {/* Question Telemetry Table */}
        <div className="overflow-x-auto border border-border rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-700/50 text-text-muted text-[11px]">
                <th className="py-2.5 px-3 font-semibold">Q#</th>
                <th className="py-2.5 px-3 font-semibold">Question</th>
                <th className="py-2.5 px-3 font-semibold">Difficulty</th>
                <th className="py-2.5 px-3 font-semibold">Response</th>
                <th className="py-2.5 px-3 font-semibold">Revisions</th>
                <th className="py-2.5 px-3 font-semibold">Correctness</th>
                <th className="py-2.5 px-3 font-semibold">Pointer Speed</th>
                <th className="py-2.5 px-3 font-semibold">Scroll Dist</th>
                <th className="py-2.5 px-3 font-semibold">Paste</th>
                <th className="py-2.5 px-3 font-semibold">Burst</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 text-text-secondary font-mono text-[11px]">
              {questions.map((q, i) => (
                <tr key={q.recordId} className="hover:bg-surface-700/30 transition-colors">
                  <td className="py-2.5 px-3 text-text-muted font-sans font-medium">{i + 1}</td>
                  <td className="py-2.5 px-3 text-indigo-300 font-bold">{q.questionId}</td>
                  <td className="py-2.5 px-3 text-text-secondary">{q.questionDifficulty.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-emerald-400 font-bold">{q.responseTimeSec}s</td>
                  <td className="py-2.5 px-3 text-indigo-300 font-bold">{q.answerRevisionCount}</td>
                  <td className="py-2.5 px-3 font-sans">
                    {q.correctnessLabel === 'Correct' ? (
                      <span className="text-emerald-400 font-semibold inline-flex items-center gap-1">
                        <CheckCircle2 size={11} /> Correct
                      </span>
                    ) : (
                      <span className="text-rose-400 font-semibold inline-flex items-center gap-1">
                        <XCircle size={11} /> Incorrect
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-amber-300">{q.pointerAvgSpeedPxS} px/s</td>
                  <td className="py-2.5 px-3 text-sky-300">{q.scrollDistancePx} px</td>
                  <td className="py-2.5 px-3 font-sans">
                    {q.pasteLabel === 'Detected' ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Detected
                      </span>
                    ) : (
                      <span className="text-text-muted">None</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-sans">
                    {q.characterBurstLabel === 'Detected' ? (
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

        {/* Footer info */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-[11px] text-text-muted">
            Telemetry features are captured during question interactions and stored securely in accordance with patent integrity guidelines.
          </p>
          <Button variant="secondary" size="sm" onClick={onClose} className="text-xs">
            Close Inspector
          </Button>
        </div>
      </div>
    </Modal>
  );
}
