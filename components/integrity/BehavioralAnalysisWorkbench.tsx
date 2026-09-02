'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Brain,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RotateCcw,
  MousePointer,
  ArrowDown,
  Zap,
  Layers,
  ChevronRight,
  Eye,
  Sliders,
  Info,
  Laptop,
  Monitor,
  Smartphone,
  CheckCircle,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import {
  analyzeSession,
  clearAnalysisCache,
} from '@/lib/services/behavioralAnalysisService';
import {
  getDemoStudentProfiles,
  getDemoStudentProfile,
} from '@/lib/services/demoStudentService';
import {
  getAllGradedExamSessions,
  getGradedExamSession,
} from '@/lib/services/examSessionService';
import {
  getStudentGradedRecords,
  getPatentStudents,
} from '@/lib/services/datasetService';
import {
  BehavioralAnalysisResult,
  QuestionAnalysis,
  FeatureDeviation,
} from '@/types';
import { ModelMaturityIndicator } from '@/components/integrity/ModelMaturityIndicator';

interface BehavioralAnalysisWorkbenchProps {
  initialStudentId?: string;
  initialSessionId?: string;
}

export function BehavioralAnalysisWorkbench({
  initialStudentId = 'S003',
  initialSessionId,
}: BehavioralAnalysisWorkbenchProps) {
  const demoProfiles = useMemo(() => getDemoStudentProfiles(), []);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(initialStudentId);
  const [availableSessions, setAvailableSessions] = useState<{ id: string; title: string; type: string }[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>(initialSessionId || '');
  const [analysis, setAnalysis] = useState<BehavioralAnalysisResult | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionAnalysis | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load available graded sessions for selected student
  useEffect(() => {
    const liveSessions = getAllGradedExamSessions().filter((s) => s.studentId === selectedStudentId);
    const syntheticGraded = getStudentGradedRecords(selectedStudentId);

    const sessionMap = new Map<string, { id: string; title: string; type: string }>();

    liveSessions.forEach((ls) => {
      sessionMap.set(ls.sessionId, {
        id: ls.sessionId,
        title: ls.examTitle || `Live Exam (${ls.sessionId})`,
        type: 'Live Graded Exam',
      });
    });

    syntheticGraded.forEach((sr) => {
      if (!sessionMap.has(sr.session_id)) {
        sessionMap.set(sr.session_id, {
          id: sr.session_id,
          title: sr.human_review_label === 'flagged_mock'
            ? `Anomalous Demo Session (${sr.session_id})`
            : `Clean Graded Session (${sr.session_id})`,
          type: 'Synthetic Prototype',
        });
      }
    });

    const sessions = Array.from(sessionMap.values());
    setAvailableSessions(sessions);

    if (sessions.length > 0) {
      // If initialSessionId is matching, use it; otherwise default to first
      const exists = sessions.find((s) => s.id === selectedSessionId);
      const chosen = exists ? exists.id : sessions[0].id;
      setSelectedSessionId(chosen);
    } else {
      setSelectedSessionId('');
    }
  }, [selectedStudentId]);

  // Run behavioral analysis whenever student or session changes
  useEffect(() => {
    if (!selectedSessionId) return;

    try {
      setLoading(true);
      setError(null);
      const result = analyzeSession(selectedSessionId, 'instructor');
      setAnalysis(result);
      if (result.questionAnalyses.length > 0) {
        setSelectedQuestion(result.questionAnalyses[0]);
      } else {
        setSelectedQuestion(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to compute behavioral deviation analysis.');
    } finally {
      setLoading(false);
    }
  }, [selectedSessionId]);

  const handleSelectStudent = (sId: string) => {
    setSelectedStudentId(sId);
  };

  const getScoreColor = (score: number, isColdStart: boolean) => {
    if (isColdStart) return 'text-text-muted';
    if (score >= 60) return 'text-rose-400';
    if (score >= 30) return 'text-amber-400';
    return 'text-emerald-400';
  };

  const getScoreBadge = (riskLevel: string) => {
    switch (riskLevel) {
      case 'high':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1.5">
            <AlertTriangle size={13} />
            Review Recommended
          </span>
        );
      case 'medium':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
            <Zap size={13} />
            Behavioral Deviation
          </span>
        );
      case 'limited_analysis':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-surface-700 text-text-muted border border-border flex items-center gap-1.5">
            <HelpCircle size={13} />
            Insufficient Personal History
          </span>
        );
      case 'low':
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
            <CheckCircle2 size={13} />
            Within Personal Pattern
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-text-primary">Personalized Behavioral Analysis Workbench</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Stage 8 · Personal Baseline Deviation Engine
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Evaluates examination interactions strictly relative to the student&apos;s own prior low-stakes coursework baseline.
          </p>
        </div>

        <Link href="/instructor/sessions">
          <Button variant="secondary" size="sm" className="text-xs">
            Graded Sessions
          </Button>
        </Link>
      </div>

      {/* Demo Student Quick Switcher */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {demoProfiles.map((p) => {
          const isSelected = p.id === selectedStudentId;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelectStudent(p.id)}
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

      {/* Session Selection Bar */}
      <Card padding="sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2 py-1 text-xs">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-text-muted font-semibold">Select Examination Session:</span>
            <select
              aria-label="Select Examination Session"
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

      {/* Main Analysis Results */}
      {analysis && (
        <div className="space-y-6">
          {/* Top Diagnostics Dashboard Card */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 1. Score Gauge Card */}
            <Card padding="md" className="border-indigo-500/30 bg-surface-800 space-y-4">
              <div className="flex items-center justify-between border-b border-border/80 pb-3">
                <div>
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">
                    Personalized Behavioral Deviation
                  </span>
                  <h3 className="text-sm font-bold text-text-primary mt-0.5">Overall Deviation Score</h3>
                </div>
                {getScoreBadge(analysis.riskLevel)}
              </div>

              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-surface-900 border border-border flex flex-col items-center justify-center shrink-0">
                  <span className={`text-3xl font-black font-mono tracking-tight ${getScoreColor(analysis.overallScore, analysis.modelStatus === 'cold_start')}`}>
                    {analysis.overallScore}
                  </span>
                  <span className="text-[9px] text-text-muted uppercase font-bold">/ 100</span>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-text-muted">Status:</span>
                    <strong className="text-text-primary">{analysis.riskStatusLabel}</strong>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-text-muted">Confidence:</span>
                    <strong className="text-sky-300">{analysis.confidenceLabel}</strong>
                  </div>
                  <div className="text-[10px] text-text-muted leading-tight pt-1">
                    Normalized weighted deviation from student {analysis.studentId}&apos;s personal baseline.
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-text-muted font-mono">
                  <span>Within Baseline (0-29)</span>
                  <span>Deviation (30-59)</span>
                  <span>Review (60+)</span>
                </div>
                <ProgressBar
                  value={analysis.overallScore}
                  color={analysis.overallScore >= 60 ? 'rose' : analysis.overallScore >= 30 ? 'amber' : 'emerald'}
                  size="sm"
                />
              </div>
            </Card>

            {/* 2. Model Maturity & Context Card */}
            <Card padding="md" className="border-border bg-surface-800 space-y-3">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block border-b border-border/80 pb-2">
                Baseline & Context Scope
              </span>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-text-muted">Model Maturity:</span>
                  <span className="font-bold text-indigo-300">{analysis.modelMaturityLabel}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-text-muted">Training Coursework:</span>
                  <span className="font-bold text-text-primary font-mono">{analysis.trainingSessionCount} Low-Stakes Sessions</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-text-muted">Exam Device:</span>
                  <span className="font-mono text-emerald-400 capitalize">{analysis.examDeviceType.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-text-muted">Device Context:</span>
                  <span className={`font-bold ${analysis.deviceChangeDetected ? 'text-amber-400' : 'text-text-muted'}`}>
                    {analysis.deviceChangeDetected ? 'Unexpected Device Context' : 'Historical Device'}
                  </span>
                </div>
              </div>
            </Card>

            {/* 3. Human-Review Summary Explanation Card */}
            <Card padding="md" className="border-border bg-surface-800 space-y-3">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block border-b border-border/80 pb-2">
                Student-Centric Explanation
              </span>
              <p className="text-xs text-text-secondary leading-relaxed font-sans">
                {analysis.summaryExplanation}
              </p>
              {analysis.warnings.length > 0 && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 space-y-1">
                  {analysis.warnings.map((w, idx) => (
                    <p key={idx} className="flex items-start gap-1.5">
                      <AlertTriangle size={13} className="shrink-0 mt-0.5 text-amber-400" />
                      <span>{w}</span>
                    </p>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Feature Contributions Breakdown */}
          {analysis.modelStatus !== 'cold_start' && (
            <Card padding="md">
              <CardHeader
                title="Relative Feature Contributions to Deviation Score"
                subtitle="Percentage of overall deviation score attributable to each interaction feature (sums to 100%)"
                badge={<Badge variant="active">{analysis.featureContributions.length} Features Modeled</Badge>}
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-3">
                {analysis.featureContributions.map((fc) => (
                  <div
                    key={fc.featureKey}
                    className="p-3 rounded-xl bg-surface-700/40 border border-border space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between text-text-muted text-[11px]">
                      <span className="truncate">{fc.displayName}</span>
                      <span className="font-bold text-sky-400 font-mono">{fc.percentage}%</span>
                    </div>
                    <ProgressBar value={fc.percentage} color="indigo" size="xs" />
                    <div className="flex justify-between text-[10px] text-text-muted">
                      <span>Direction:</span>
                      <span className="font-bold capitalize text-text-secondary">{fc.direction.replace('_', ' ')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Question-Level Breakdown Table */}
          <Card>
            <CardHeader
              title="Question-by-Question Behavioral Deviation Breakdown"
              subtitle={`Detailed interaction metrics and standardized z-score deviation across ${analysis.questionAnalyses.length} questions`}
              badge={<Badge variant="active">{analysis.questionAnalyses.length} Questions</Badge>}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface-700/40 text-text-muted text-[11px]">
                    <th className="py-2.5 px-3 font-semibold">Q#</th>
                    <th className="py-2.5 px-3 font-semibold">Question ID</th>
                    <th className="py-2.5 px-3 font-semibold">Difficulty</th>
                    <th className="py-2.5 px-3 font-semibold">Response (Obs / Exp)</th>
                    <th className="py-2.5 px-3 font-semibold">Revisions (Obs / Exp)</th>
                    <th className="py-2.5 px-3 font-semibold">Pointer Speed</th>
                    <th className="py-2.5 px-3 font-semibold">Paste</th>
                    <th className="py-2.5 px-3 font-semibold">Burst</th>
                    <th className="py-2.5 px-3 font-semibold">Deviation Score</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono text-[11px] text-text-secondary">
                  {analysis.questionAnalyses.map((q) => {
                    const isSelected = selectedQuestion?.questionId === q.questionId;
                    const respFeat = q.featureDeviations['response_time_sec'];
                    const revFeat = q.featureDeviations['answer_revision_count'];
                    const speedFeat = q.featureDeviations['pointer_avg_speed_px_s'];
                    const pasteFeat = q.featureDeviations['paste_detected'];
                    const burstFeat = q.featureDeviations['character_burst_flag'];

                    return (
                      <tr
                        key={q.questionId}
                        onClick={() => setSelectedQuestion(q)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-indigo-600/15 border-l-2 border-indigo-500' : 'hover:bg-surface-700/30'
                        }`}
                      >
                        <td className="py-2.5 px-3 text-text-muted font-sans font-medium">{q.sessionPosition}</td>
                        <td className="py-2.5 px-3 text-sky-300 font-bold">{q.questionId}</td>
                        <td className="py-2.5 px-3 text-text-muted">{q.questionDifficulty.toFixed(2)}</td>
                        <td className="py-2.5 px-3">
                          <span className="text-emerald-400 font-bold">{respFeat?.observedValue}s</span>
                          <span className="text-text-muted text-[10px]"> / {respFeat?.expectedValue}s</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-indigo-300 font-bold">{revFeat?.observedValue}</span>
                          <span className="text-text-muted text-[10px]"> / {revFeat?.expectedValue}</span>
                        </td>
                        <td className="py-2.5 px-3 text-amber-300">{speedFeat?.observedValue} px/s</td>
                        <td className="py-2.5 px-3 font-sans">
                          {pasteFeat?.observedValue === 1 ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              YES (1)
                            </span>
                          ) : (
                            <span className="text-text-muted">NO (0)</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          {burstFeat?.observedValue === 1 ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              YES (1)
                            </span>
                          ) : (
                            <span className="text-text-muted">NO (0)</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold font-mono ${
                            q.questionScore >= 60
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : q.questionScore >= 30
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-surface-700 text-emerald-400'
                          }`}>
                            {q.questionScore}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-indigo-400">
                            <Eye size={11} className="mr-1" />
                            Details
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Selected Question Deep-Dive Inspector */}
          {selectedQuestion && (
            <Card padding="md" className="border-indigo-500/40 bg-surface-850 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold font-mono">
                    Q{selectedQuestion.sessionPosition}
                  </span>
                  <span className="text-sm font-bold text-text-primary">
                    Detailed Feature Deviation: <strong className="text-sky-400 font-mono">{selectedQuestion.questionId}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-text-muted">
                    Question Deviation Score: <strong className="text-indigo-300 font-mono text-sm">{selectedQuestion.questionScore}/100</strong>
                  </span>
                </div>
              </div>

              {/* Feature Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {Object.values(selectedQuestion.featureDeviations).map((fd) => (
                  <div
                    key={fd.featureKey}
                    className="p-3 rounded-xl bg-surface-800 border border-border space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-text-muted text-[11px]">
                      <span className="font-bold text-text-primary">{fd.displayName}</span>
                      <span className="font-mono text-indigo-300">z = {fd.standardizedDeviation}</span>
                    </div>

                    <div className="p-2 rounded-lg bg-surface-900/80 border border-border/60 font-mono text-[11px] space-y-0.5">
                      <div className="flex justify-between text-text-muted">
                        <span>Observed:</span>
                        <strong className="text-emerald-400">{fd.observedValue} {fd.unit}</strong>
                      </div>
                      <div className="flex justify-between text-text-muted">
                        <span>Personal Expected:</span>
                        <strong className="text-text-secondary">{fd.expectedValue} {fd.unit}</strong>
                      </div>
                      <div className="flex justify-between text-text-muted">
                        <span>Delta (Obs - Exp):</span>
                        <strong className={fd.difference > 0 ? 'text-amber-400' : 'text-sky-400'}>
                          {fd.difference > 0 ? `+${fd.difference}` : fd.difference} {fd.unit}
                        </strong>
                      </div>
                    </div>

                    <p className="text-[10px] text-text-muted leading-relaxed">
                      {fd.explanation}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Privacy & Intellectual Property Disclaimer */}
          <div className="p-4 rounded-2xl bg-surface-900 border border-border/80 flex items-start gap-3.5 text-xs text-text-muted">
            <ShieldCheck size={18} className="text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-text-secondary">Personalized Behavioral Analysis Notice</span>
              <p className="text-[11px] leading-relaxed">
                This score measures statistical behavioral deviation from student {analysis.studentId}&apos;s own historical low-stakes coursework.
                It does <strong>NOT</strong> constitute an automated decision or proof of academic misconduct.
                Human instructor review is required before taking any pedagogical or administrative action.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
