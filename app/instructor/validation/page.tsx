'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Code2,
  Bug,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  MousePointer,
  ArrowDown,
  ClipboardX,
  Zap,
  Terminal,
  Search,
  Filter,
  Eye,
  ArrowLeft,
  Sliders,
  AlertCircle,
  CheckCircle,
  Info,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getAllGradedExamSessions, getGradedExamSession } from '@/lib/services/examSessionService';
import { CHARACTER_BURST_CONFIG } from '@/lib/services/examFeatureExtractor';
import { GradedExamSession, ExamQuestionTelemetry } from '@/types';

export default function BehaviorValidationPage() {
  const [sessions, setSessions] = useState<GradedExamSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedSession, setSelectedSession] = useState<GradedExamSession | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<ExamQuestionTelemetry | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    const all = getAllGradedExamSessions();
    setSessions(all);
    if (all.length > 0) {
      setSelectedSessionId(all[0].sessionId);
      setSelectedSession(all[0]);
      if (all[0].interactions.length > 0) {
        setSelectedQuestion(all[0].interactions[0]);
      }
    }
  }, []);

  const handleSelectSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    const found = getGradedExamSession(sessionId);
    setSelectedSession(found);
    if (found && found.interactions.length > 0) {
      setSelectedQuestion(found.interactions[0]);
    } else {
      setSelectedQuestion(null);
    }
  };

  const filteredInteractions = selectedSession
    ? selectedSession.interactions.filter((q) => {
        if (filterType === 'all') return true;
        return q.questionType === filterType;
      })
    : [];

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-text-primary">Behavior Validation Mode</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Debug / Telemetry Verification
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Stage 7: Real-time validation of derived feature extraction, paste detection, and rapid insertion burst measurement.
          </p>
        </div>

        <Link href="/instructor/sessions">
          <Button variant="secondary" size="sm" className="text-xs">
            <ArrowLeft size={13} className="mr-1.5" />
            Back to Sessions
          </Button>
        </Link>
      </div>

      {/* Purpose & Disclaimer Box */}
      <div className="p-4 rounded-2xl bg-surface-800 border border-amber-500/30 flex items-start gap-3.5 shadow-lg">
        <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0 mt-0.5">
          <Sliders size={20} />
        </div>
        <div className="space-y-1 text-xs text-text-secondary leading-relaxed">
          <span className="font-bold text-text-primary">Independent Telemetry Signals (No Cheating Conclusions)</span>
          <p className="text-[11px] text-text-muted">
            This mode demonstrates that <strong>Paste Detection</strong> and <strong>Character-Burst Detection</strong> operate independently.
            A paste records <code className="text-amber-300 font-bold">paste_detected = 1</code> without accessing clipboard text.
            If a sufficiently large insertion occurs rapidly, <code className="text-rose-300 font-bold">character_burst_flag = 1</code> is triggered based on the insertion rate.
            <strong> No automated cheating decisions or risk scores are computed.</strong>
          </p>
        </div>
      </div>

      {/* Session Selector & Filter Bar */}
      <Card padding="sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2 py-1">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs text-text-muted font-semibold">Select Session:</span>
            <select
              aria-label="Select Examination Session"
              value={selectedSessionId}
              onChange={(e) => handleSelectSession(e.target.value)}
              className="bg-surface-700 border border-border text-text-primary text-xs rounded-lg px-3 py-1.5 font-mono focus:outline-none focus:border-indigo-500 max-w-xs"
            >
              {sessions.map((s) => (
                <option key={s.sessionId} value={s.sessionId}>
                  {s.sessionId} ({s.studentId} · {s.startedAt.split(' ')[0]})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-text-muted">Filter Question Type:</span>
            <select
              aria-label="Filter Question Type"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-surface-700 border border-border text-text-primary text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Question Types</option>
              <option value="mcq">MCQ (Single Choice)</option>
              <option value="multiple_select">Multiple Select</option>
              <option value="short_answer">Short Answer</option>
              <option value="coding">Coding Problems</option>
              <option value="debugging">Code Debugging</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Session Diagnostics Overview */}
      {selectedSession && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-surface-800 border border-border">
            <span className="text-[10px] text-text-muted block">Student ID</span>
            <span className="text-sm font-bold text-sky-400 font-mono">{selectedSession.studentId}</span>
          </div>
          <div className="p-3 rounded-xl bg-surface-800 border border-border">
            <span className="text-[10px] text-text-muted block">Questions Answered</span>
            <span className="text-sm font-bold text-text-primary font-mono">
              {selectedSession.completedQuestionsCount} / {selectedSession.questionCount}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-surface-800 border border-border">
            <span className="text-[10px] text-text-muted block">Avg Response Time</span>
            <span className="text-sm font-bold text-emerald-400 font-mono">{selectedSession.avgResponseTimeSec || 0}s</span>
          </div>
          <div className="p-3 rounded-xl bg-surface-800 border border-border">
            <span className="text-[10px] text-text-muted block">Total Code Revisions</span>
            <span className="text-sm font-bold text-indigo-300 font-mono">{selectedSession.totalCodeRevisions || 0}</span>
          </div>
          <div className="p-3 rounded-xl bg-surface-800 border border-border">
            <span className="text-[10px] text-text-muted block">Paste Signal Event</span>
            <span className={`text-sm font-bold ${selectedSession.hasPasteEvent ? 'text-amber-400' : 'text-text-muted'}`}>
              {selectedSession.hasPasteEvent ? 'Detected (1)' : 'None (0)'}
            </span>
          </div>
        </div>
      )}

      {/* Selected Question Deep-Dive Inspector Panel */}
      {selectedQuestion && (
        <Card padding="md" className="border-indigo-500/40 bg-surface-850 shadow-xl">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold font-mono">
                  Q{selectedQuestion.sessionPosition}
                </span>
                <span className="text-sm font-bold text-text-primary">
                  Question ID: <strong className="text-sky-400 font-mono">{selectedQuestion.questionId}</strong>
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface-700 text-text-secondary uppercase">
                  {selectedQuestion.questionType || 'mcq'}
                </span>
              </div>
              <span className="text-xs text-text-muted font-mono">
                Difficulty: <strong className="text-indigo-300">{selectedQuestion.questionDifficulty.toFixed(2)}</strong> · Time: {selectedQuestion.responseTimeSec}s
              </span>
            </div>

            {/* Paste & Burst Diagnostic Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              {/* Paste Status */}
              <div className="p-3 rounded-xl bg-surface-800 border border-border space-y-1">
                <span className="text-[10px] text-text-muted uppercase tracking-wider block">Paste Detected</span>
                <div className="flex items-center gap-1.5">
                  {selectedQuestion.pasteDetected === 1 ? (
                    <span className="text-base font-black text-amber-400 flex items-center gap-1">
                      <CheckCircle2 size={16} /> YES (1)
                    </span>
                  ) : (
                    <span className="text-base font-black text-text-muted flex items-center gap-1">
                      <XCircle size={16} /> NO (0)
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-text-muted block">Clipboard string never stored</span>
              </div>

              {/* Characters Inserted */}
              <div className="p-3 rounded-xl bg-surface-800 border border-border space-y-1">
                <span className="text-[10px] text-text-muted uppercase tracking-wider block">Characters Inserted</span>
                <span className="text-base font-black text-sky-400 font-mono">
                  {selectedQuestion.maxCharsInserted || (selectedQuestion.textAnswerLength || 0)}
                </span>
                <span className="text-[10px] text-text-muted block">Peak single insertion</span>
              </div>

              {/* Insertion Rate */}
              <div className="p-3 rounded-xl bg-surface-800 border border-border space-y-1">
                <span className="text-[10px] text-text-muted uppercase tracking-wider block">Insertion Rate</span>
                <span className="text-base font-black text-indigo-300 font-mono">
                  {selectedQuestion.maxInsertionRate ? `${selectedQuestion.maxInsertionRate} c/s` : 'Normal (<15 c/s)'}
                </span>
                <span className="text-[10px] text-text-muted block">chars / elapsed_sec</span>
              </div>

              {/* Burst Threshold */}
              <div className="p-3 rounded-xl bg-surface-800 border border-border space-y-1">
                <span className="text-[10px] text-text-muted uppercase tracking-wider block">Burst Threshold</span>
                <span className="text-base font-black text-text-primary font-mono">
                  {CHARACTER_BURST_CONFIG.BURST_RATE_THRESHOLD_CHARS_PER_SEC} c/s
                </span>
                <span className="text-[10px] text-text-muted block">Configured rate limit</span>
              </div>

              {/* Character Burst Verdict */}
              <div className={`p-3 rounded-xl border space-y-1 ${
                selectedQuestion.characterBurstFlag === 1
                  ? 'bg-rose-950/30 border-rose-500/50'
                  : 'bg-surface-800 border-border'
              }`}>
                <span className="text-[10px] text-text-muted uppercase tracking-wider block">Character Burst</span>
                <div className="flex items-center gap-1.5">
                  {selectedQuestion.characterBurstFlag === 1 ? (
                    <span className="text-base font-black text-rose-400 flex items-center gap-1 animate-pulse">
                      <Zap size={16} /> DETECTED (1)
                    </span>
                  ) : (
                    <span className="text-base font-black text-emerald-400 flex items-center gap-1">
                      <CheckCircle size={16} /> NORMAL (0)
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-text-muted block">Rate & delta evaluation</span>
              </div>
            </div>

            {/* Diagnostic Reasoning Box */}
            <div className="p-3 rounded-xl bg-surface-900 border border-border/80 text-xs space-y-1">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">
                Telemetry Evaluation Reason:
              </span>
              <p className="text-[11px] text-text-secondary font-mono leading-relaxed">
                {selectedQuestion.burstReason || (selectedQuestion.characterBurstFlag === 1 ? 'Superhuman character insertion rate detected' : 'Standard typing cadence within human physical limits')}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Question-Level Telemetry Records Table */}
      {selectedSession && (
        <Card>
          <CardHeader
            title="Question-by-Question Telemetry Verification"
            subtitle={`Showing ${filteredInteractions.length} interaction records. Click any row to inspect deep-dive diagnostics.`}
            badge={<Badge variant="active">{filteredInteractions.length} Records</Badge>}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-700/40 text-text-muted text-[11px]">
                  <th className="py-2.5 px-3 font-semibold">Q#</th>
                  <th className="py-2.5 px-3 font-semibold">Question ID</th>
                  <th className="py-2.5 px-3 font-semibold">Type</th>
                  <th className="py-2.5 px-3 font-semibold">Response</th>
                  <th className="py-2.5 px-3 font-semibold">Ans Rev</th>
                  <th className="py-2.5 px-3 font-semibold">Code Rev</th>
                  <th className="py-2.5 px-3 font-semibold">Paste</th>
                  <th className="py-2.5 px-3 font-semibold">Max Added</th>
                  <th className="py-2.5 px-3 font-semibold">Insert Rate</th>
                  <th className="py-2.5 px-3 font-semibold">Burst Flag</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono text-[11px] text-text-secondary">
                {filteredInteractions.map((q, idx) => {
                  const isSelected = selectedQuestion?.recordId === q.recordId;
                  return (
                    <tr
                      key={q.recordId || idx}
                      onClick={() => setSelectedQuestion(q)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-indigo-600/15 border-l-2 border-indigo-500' : 'hover:bg-surface-700/30'
                      }`}
                    >
                      <td className="py-2.5 px-3 text-text-muted font-sans font-medium">{q.sessionPosition || idx + 1}</td>
                      <td className="py-2.5 px-3 text-sky-300 font-bold">{q.questionId}</td>
                      <td className="py-2.5 px-3 font-sans">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-surface-700 border border-border text-text-secondary uppercase">
                          {q.questionType || 'mcq'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-emerald-400 font-bold">{q.responseTimeSec}s</td>
                      <td className="py-2.5 px-3 text-indigo-300 font-bold">{q.answerRevisionCount}</td>
                      <td className="py-2.5 px-3 text-sky-300 font-bold">{q.codeRevisionCount || 0}</td>
                      <td className="py-2.5 px-3 font-sans">
                        {q.pasteDetected === 1 ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            YES (1)
                          </span>
                        ) : (
                          <span className="text-text-muted">NO (0)</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-sky-300">
                        {q.maxCharsInserted || (q.textAnswerLength || 0)}
                      </td>
                      <td className="py-2.5 px-3 text-indigo-300">
                        {q.maxInsertionRate ? `${q.maxInsertionRate} c/s` : '<15 c/s'}
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        {q.characterBurstFlag === 1 ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            DETECTED (1)
                          </span>
                        ) : (
                          <span className="text-text-muted">NORMAL (0)</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-indigo-400">
                          <Eye size={11} className="mr-1" />
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
