'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Printer,
  FileText,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Zap,
  Clock,
  RotateCcw,
  MousePointer,
  ArrowDown,
  Layers,
  ChevronDown,
  ChevronUp,
  Sliders,
  Info,
  Laptop,
  Smartphone,
  Send,
  Eye,
  ArrowLeft,
  Sparkles,
  Activity,
  Camera,
  Video,
  Users,
  WifiOff,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import {
  BehavioralRiskReport,
  FeatureReportItem,
  QuestionReportItem,
  FeatureStatusTag,
} from '@/types';
import { ModelMaturityIndicator } from '@/components/integrity/ModelMaturityIndicator';
import { formatExamDate } from '@/lib/formatters';

interface BehavioralRiskReportViewProps {
  report: BehavioralRiskReport;
  onSendForReview?: () => void;
}

export function BehavioralRiskReportView({
  report,
  onSendForReview,
}: BehavioralRiskReportViewProps) {
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionReportItem | null>(
    report.questionReports.length > 0 ? report.questionReports[0] : null
  );
  const [sortField, setSortField] = useState<'sessionPosition' | 'questionScore' | 'difficulty' | 'responseTimeObs'>('sessionPosition');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [reviewSent, setReviewSent] = useState<boolean>(false);

  const sortedQuestions = useMemo(() => {
    return [...report.questionReports].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [report.questionReports, sortField, sortAsc]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false); // Default to descending for scores/time
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const handleSendForReview = () => {
    setReviewSent(true);
    if (onSendForReview) {
      onSendForReview();
    }
  };

  const getStatusBadge = (status: FeatureStatusTag) => {
    switch (status) {
      case 'Significant Deviation':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            Significant Deviation
          </span>
        );
      case 'Mild Deviation':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            Mild Deviation
          </span>
        );
      case 'Detected Signal':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
            Detected Signal
          </span>
        );
      case 'Insufficient Data':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface-700 text-text-muted border border-border">
            Insufficient Data
          </span>
        );
      case 'Within Baseline':
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            Within Baseline
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto print:max-w-none print:space-y-4 print:text-black">
      {/* ─── Top Action Bar & Header (Hidden when printing or clean) ───────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-4 print:border-none">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/instructor/analysis"
              className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary print:hidden mr-2"
            >
              <ArrowLeft size={14} />
              Workbench
            </Link>
            <h1 className="text-xl font-bold text-text-primary print:text-black">
              Behavioral Risk Report
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 print:border-black print:text-black">
              Prototype / Synthetic Research Data
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5 print:text-neutral-700">
            Explainable inspection of examination interaction behavior relative to personalized longitudinal baseline
          </p>
        </div>

        <div className="flex items-center gap-2.5 print:hidden">
          <Button
            variant="secondary"
            size="sm"
            onClick={handlePrint}
            className="flex items-center gap-1.5 text-xs"
          >
            <Printer size={14} />
            Print / Export PDF
          </Button>

          {report.isEligibleForHumanReview && (
            <Button
              variant={reviewSent ? 'secondary' : 'primary'}
              size="sm"
              onClick={handleSendForReview}
              disabled={reviewSent}
              className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              <Send size={14} />
              {reviewSent ? 'Sent to Review Queue' : 'Send for Human Review'}
            </Button>
          )}
        </div>
      </div>

      {/* ─── Report Metadata Header Banner ─────────────────────────────────── */}
      <div className="p-4 rounded-2xl bg-surface-800 border border-border grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
        <div>
          <span className="text-[10px] font-bold text-text-muted uppercase block">Student</span>
          <strong className="text-text-primary text-sm font-sans">{report.studentName}</strong>
          <span className="text-[10px] text-sky-400 font-mono block">{report.studentId}</span>
        </div>

        <div>
          <span className="text-[10px] font-bold text-text-muted uppercase block">Examination</span>
          <strong className="text-text-primary text-xs truncate block">{report.examTitle}</strong>
          <span className="text-[10px] text-text-muted font-mono block">{report.sessionId}</span>
        </div>

        <div>
          <span className="text-[10px] font-bold text-text-muted uppercase block">Analysis Timestamp</span>
          <span className="text-text-secondary text-xs font-mono block">
            {formatExamDate(report.generatedAt)}
          </span>
        </div>

        <div>
          <span className="text-[10px] font-bold text-text-muted uppercase block">Analysis Method</span>
          <span className="text-text-secondary text-xs">{report.analysisMethod}</span>
        </div>

        <div>
          <span className="text-[10px] font-bold text-text-muted uppercase block">Model Maturity</span>
          <span className="font-bold text-indigo-300 text-xs block">{report.modelMaturityLabel}</span>
          <span className="text-[10px] text-text-muted">{report.trainingSessionCount} Low-Stakes Sessions</span>
        </div>

        <div>
          <span className="text-[10px] font-bold text-text-muted uppercase block">Exam Device</span>
          <span className="font-mono text-emerald-400 text-xs capitalize block">
            {report.examDeviceType.replace('_', ' ')}
          </span>
          {report.deviceChangeDetected && (
            <span className="text-[9px] text-amber-400 font-bold uppercase block">New Device</span>
          )}
        </div>
      </div>

      {/* ─── 3-Card Summary Grid (Deviation, Maturity, Context) ────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 1. Behavioral Deviation Score */}
        <Card padding="md" className="border-indigo-500/30 bg-surface-800 space-y-3">
          <div className="flex items-center justify-between border-b border-border/80 pb-2">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
              Personalized Behavioral Deviation
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                report.riskLevel === 'high'
                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  : report.riskLevel === 'medium'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : report.riskLevel === 'limited_analysis'
                  ? 'bg-surface-700 text-text-muted border border-border'
                  : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {report.riskStatusLabel}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-18 h-18 rounded-2xl bg-surface-900 border border-border flex flex-col items-center justify-center shrink-0">
              <span
                className={`text-3xl font-black font-mono tracking-tight ${
                  report.modelStatus === 'cold_start'
                    ? 'text-text-muted'
                    : report.overallScore >= 60
                    ? 'text-rose-400'
                    : report.overallScore >= 30
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {report.overallScore}
              </span>
              <span className="text-[9px] text-text-muted font-bold uppercase">/ 100</span>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-text-muted">Confidence:</span>
                <strong className="text-sky-300">{report.confidenceLabel}</strong>
              </div>
              <p className="text-[10px] text-text-muted leading-relaxed">
                Normalized divergence from student {report.studentId}&apos;s own prior low-stakes coursework.
              </p>
            </div>
          </div>

          <ProgressBar
            value={report.overallScore}
            color={report.overallScore >= 60 ? 'rose' : report.overallScore >= 30 ? 'amber' : 'emerald'}
            size="sm"
          />
        </Card>

        {/* 2. Executive Narrative */}
        <Card padding="md" className="border-border bg-surface-800 space-y-2 lg:col-span-2">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block border-b border-border/80 pb-2">
            Executive Summary & Recommended Action
          </span>
          <p className="text-xs text-text-secondary leading-relaxed font-sans">
            {report.executiveSummary}
          </p>

          <div className="p-3 rounded-xl bg-surface-700/40 border border-border/80 flex items-start gap-2.5 text-xs">
            <Info size={16} className="text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-text-primary block">Recommended Action:</strong>
              <span className="text-text-secondary text-[11px]">{report.recommendedAction}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* ─── Device Context Notice (if changed) ─────────────────────────────── */}
      {report.deviceChangeDetected && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-300">
          <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-400" />
          <div className="space-y-0.5">
            <strong className="text-amber-200">Unexpected Device Context</strong>
            <p className="text-[11px] text-amber-300/90 leading-relaxed">
              {report.deviceContextExplanation}
            </p>
          </div>
        </div>
      )}

      {/* ─── Feature Contribution Visual Bar ───────────────────────────────── */}
      {report.modelStatus !== 'cold_start' && (
        <Card padding="md">
          <CardHeader
            title="Feature Contributions to Behavioral Deviation"
            subtitle="Relative impact of each interaction dimension (sums to 100% across active features)"
          />
          <div className="space-y-2.5 mt-2">
            {report.featureReports
              .filter((f) => f.contributionPct > 0)
              .sort((a, b) => b.contributionPct - a.contributionPct)
              .map((f) => (
                <div key={f.featureKey} className="space-y-1 text-xs">
                  <div className="flex justify-between text-text-secondary">
                    <span className="font-semibold text-text-primary">{f.displayName}</span>
                    <span className="font-mono text-sky-400 font-bold">{f.contributionPct}%</span>
                  </div>
                  <ProgressBar value={f.contributionPct} color="indigo" size="xs" />
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* ─── Main Feature Analysis Table ───────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Feature-Level Behavioral Baseline Comparison"
          subtitle="Detailed itemization of observed exam behavior versus personal historical expectation"
          badge={<Badge variant="active">{report.featureReports.length} Features Modeled</Badge>}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-700/40 text-text-muted text-[11px]">
                <th className="py-2.5 px-3 font-semibold">Feature Dimension</th>
                <th className="py-2.5 px-3 font-semibold">Personal Expected</th>
                <th className="py-2.5 px-3 font-semibold">Observed Value</th>
                <th className="py-2.5 px-3 font-semibold">Difference</th>
                <th className="py-2.5 px-3 font-semibold">Deviation (z)</th>
                <th className="py-2.5 px-3 font-semibold">Contribution</th>
                <th className="py-2.5 px-3 font-semibold">Status</th>
                <th className="py-2.5 px-3 font-semibold">Natural Language Explanation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-mono text-[11px] text-text-secondary">
              {report.featureReports.map((f) => (
                <tr key={f.featureKey} className="hover:bg-surface-700/30 transition-colors">
                  <td className="py-2.5 px-3 font-sans font-bold text-text-primary">{f.displayName}</td>
                  <td className="py-2.5 px-3 text-text-muted">
                    {f.expected} {f.unit}
                    {f.rangeMin !== undefined && f.rangeMax !== undefined && (
                      <span className="text-[10px] text-text-muted block font-sans">
                        [±{f.uncertainty.toFixed(1)}]
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-emerald-400">
                    {f.observed} {f.unit}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={f.difference > 0 ? 'text-amber-400' : f.difference < 0 ? 'text-sky-400' : 'text-text-muted'}>
                      {f.difference > 0 ? `+${f.difference}` : f.difference} {f.unit}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-indigo-300 font-bold">
                    {f.standardizedDeviation > 0 ? `+${f.standardizedDeviation}` : f.standardizedDeviation} SD
                  </td>
                  <td className="py-2.5 px-3 text-sky-400 font-bold">{f.contributionPct}%</td>
                  <td className="py-2.5 px-3 font-sans">{getStatusBadge(f.status)}</td>
                  <td className="py-2.5 px-3 font-sans text-text-secondary max-w-xs">{f.explanation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ─── Question-Level Behavioral Breakdown Table ─────────────────────── */}
      <Card>
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-text-primary">Question-Level Behavioral Telemetry Breakdown</h3>
            <p className="text-xs text-text-muted">
              Click any column header to sort questions · Click a row to inspect full telemetry
            </p>
          </div>
          <Badge variant="active">{report.questionReports.length} Questions Evaluated</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-700/40 text-text-muted text-[11px] select-none">
                <th
                  className="py-2.5 px-3 font-semibold cursor-pointer hover:text-text-primary"
                  onClick={() => handleSort('sessionPosition')}
                >
                  Q# {sortField === 'sessionPosition' && (sortAsc ? '↑' : '↓')}
                </th>
                <th className="py-2.5 px-3 font-semibold">Question ID</th>
                <th
                  className="py-2.5 px-3 font-semibold cursor-pointer hover:text-text-primary"
                  onClick={() => handleSort('difficulty')}
                >
                  Difficulty {sortField === 'difficulty' && (sortAsc ? '↑' : '↓')}
                </th>
                <th
                  className="py-2.5 px-3 font-semibold cursor-pointer hover:text-text-primary"
                  onClick={() => handleSort('responseTimeObs')}
                >
                  Response (Obs / Exp) {sortField === 'responseTimeObs' && (sortAsc ? '↑' : '↓')}
                </th>
                <th className="py-2.5 px-3 font-semibold">Revisions (Obs / Exp)</th>
                <th className="py-2.5 px-3 font-semibold">Pointer Speed</th>
                <th className="py-2.5 px-3 font-semibold">Scroll</th>
                <th className="py-2.5 px-3 font-semibold">Paste</th>
                <th className="py-2.5 px-3 font-semibold">Burst</th>
                <th
                  className="py-2.5 px-3 font-semibold cursor-pointer hover:text-text-primary"
                  onClick={() => handleSort('questionScore')}
                >
                  Score {sortField === 'questionScore' && (sortAsc ? '↑' : '↓')}
                </th>
                <th className="py-2.5 px-3 font-semibold text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-mono text-[11px] text-text-secondary">
              {sortedQuestions.map((q) => {
                const isSelected = selectedQuestion?.questionId === q.questionId;
                return (
                  <tr
                    key={q.questionId}
                    onClick={() => setSelectedQuestion(q)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-indigo-600/15 border-l-2 border-indigo-500' : 'hover:bg-surface-700/30'
                    }`}
                  >
                    <td className="py-2.5 px-3 font-sans font-medium text-text-muted">{q.sessionPosition}</td>
                    <td className="py-2.5 px-3 text-sky-300 font-bold">{q.questionId}</td>
                    <td className="py-2.5 px-3 text-text-muted">{q.difficulty.toFixed(2)}</td>
                    <td className="py-2.5 px-3">
                      <span className="text-emerald-400 font-bold">{q.responseTimeObs}s</span>
                      <span className="text-text-muted text-[10px]"> / {q.responseTimeExp}s</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-indigo-300 font-bold">{q.revisionCountObs}</span>
                      <span className="text-text-muted text-[10px]"> / {q.revisionCountExp}</span>
                    </td>
                    <td className="py-2.5 px-3 text-amber-300">{q.pointerSpeedObs} px/s</td>
                    <td className="py-2.5 px-3 text-text-muted">{q.scrollDistanceObs} px</td>
                    <td className="py-2.5 px-3 font-sans">
                      {q.pasteDetected === 1 ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          YES
                        </span>
                      ) : (
                        <span className="text-text-muted">0</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-sans">
                      {q.characterBurstFlag === 1 ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          YES
                        </span>
                      ) : (
                        <span className="text-text-muted">0</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-sans">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold font-mono ${
                          q.questionScore >= 60
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : q.questionScore >= 30
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-surface-700 text-emerald-400'
                        }`}
                      >
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

      {/* ─── Question Drill-Down Inspection Panel ───────────────────────────── */}
      {selectedQuestion && (
        <Card padding="md" className="border-indigo-500/40 bg-surface-850 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-2.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold font-mono">
                Question {selectedQuestion.sessionPosition}
              </span>
              <strong className="text-text-primary text-sm font-sans">{selectedQuestion.questionId}</strong>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-text-muted">Question Deviation Score:</span>
              <strong className="text-indigo-300 font-mono text-sm">{selectedQuestion.questionScore} / 100</strong>
            </div>
          </div>

          <p className="text-xs text-text-secondary leading-relaxed">
            {selectedQuestion.explanation}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono pt-1">
            <div className="p-2.5 rounded-xl bg-surface-900 border border-border space-y-0.5">
              <span className="text-[10px] text-text-muted block font-sans">Response Time</span>
              <strong className="text-emerald-400">{selectedQuestion.responseTimeObs}s</strong>
              <span className="text-[10px] text-text-muted block font-sans">Exp: {selectedQuestion.responseTimeExp}s</span>
            </div>

            <div className="p-2.5 rounded-xl bg-surface-900 border border-border space-y-0.5">
              <span className="text-[10px] text-text-muted block font-sans">Answer Revisions</span>
              <strong className="text-indigo-300">{selectedQuestion.revisionCountObs}</strong>
              <span className="text-[10px] text-text-muted block font-sans">Exp: {selectedQuestion.revisionCountExp}</span>
            </div>

            <div className="p-2.5 rounded-xl bg-surface-900 border border-border space-y-0.5">
              <span className="text-[10px] text-text-muted block font-sans">Pointer Speed</span>
              <strong className="text-amber-300">{selectedQuestion.pointerSpeedObs} px/s</strong>
            </div>

            <div className="p-2.5 rounded-xl bg-surface-900 border border-border space-y-0.5">
              <span className="text-[10px] text-text-muted block font-sans">Signals</span>
              <span className="text-text-secondary text-[11px] block font-sans">
                Paste: {selectedQuestion.pasteDetected ? 'YES' : 'NO'} · Burst: {selectedQuestion.characterBurstFlag ? 'YES' : 'NO'}
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* ─── Layer 3: Multimodal Evidence Fusion Summary ────────────────────── */}
      <Card padding="md" className="border-indigo-500/40 bg-gradient-to-br from-surface-850 via-surface-800 to-surface-850 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/80 pb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Sparkles size={16} />
            </span>
            <div>
              <h3 className="text-sm font-bold text-text-primary">
                Layer 3 — Multimodal Evidence Fusion Assessment
              </h3>
              <p className="text-[11px] text-text-muted">
                Cross-layer temporal synthesis of behavioral telemetry, camera observations, and environmental integrity
              </p>
            </div>
          </div>

          <span
            className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              report.multimodalAssessment?.overallAssessmentLevel === 'elevated_review_recommended'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : report.multimodalAssessment?.overallAssessmentLevel === 'review_recommended'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : report.multimodalAssessment?.overallAssessmentLevel === 'technical_inconclusive'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
            }`}
          >
            {report.multimodalAssessment?.overallAssessmentLevel === 'elevated_review_recommended'
              ? 'Elevated Review Recommended'
              : report.multimodalAssessment?.overallAssessmentLevel === 'review_recommended'
              ? 'Review Recommended'
              : report.multimodalAssessment?.overallAssessmentLevel === 'technical_inconclusive'
              ? 'Technical Disruption Context'
              : 'Low Concern — Nominal'}
          </span>
        </div>

        {/* 3-Pillar Cross-Layer Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {/* Behavioral Pillar */}
          <div className="p-3 rounded-xl bg-surface-900/90 border border-border space-y-1">
            <div className="flex items-center gap-1.5 text-text-muted font-semibold">
              <Activity size={13} className="text-indigo-400" />
              <span>Layer 1: Behavioral Telemetry</span>
            </div>
            <p className="text-[11px] text-text-secondary leading-relaxed">
              {report.multimodalAssessment?.behavioralEvidenceSummary ||
                `Deviation score: ${report.overallScore}/100. Observed state: '${report.behavioralStateInference?.currentState || 'Stable Interaction'}'.`}
            </p>
          </div>

          {/* Camera Pillar */}
          <div className="p-3 rounded-xl bg-surface-900/90 border border-border space-y-1">
            <div className="flex items-center gap-1.5 text-text-muted font-semibold">
              <Camera size={13} className="text-sky-400" />
              <span>Layer 2: Camera Observations</span>
            </div>
            <p className="text-[11px] text-text-secondary leading-relaxed">
              {report.multimodalAssessment?.cameraEvidenceSummary ||
                (report.cameraEvidenceSummary
                  ? `Face presence: ${report.cameraEvidenceSummary.facePresencePercentage}%. Look-aways: ${report.cameraEvidenceSummary.prolongedLookAwayCount} prolonged.`
                  : 'Camera telemetry nominal throughout examination.')}
            </p>
          </div>

          {/* Environmental / Integrity Pillar */}
          <div className="p-3 rounded-xl bg-surface-900/90 border border-border space-y-1">
            <div className="flex items-center gap-1.5 text-text-muted font-semibold">
              <ShieldCheck size={13} className="text-emerald-400" />
              <span>Environmental & Integrity</span>
            </div>
            <p className="text-[11px] text-text-secondary leading-relaxed">
              {report.multimodalAssessment?.integrityOpportunitySummary ||
                `${report.integrityOpportunityEvents?.length || 0} integrity opportunity events recorded.`}
            </p>
          </div>
        </div>

        {/* Temporal Correlation Insights Banner */}
        <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs space-y-1">
          <span className="font-bold text-indigo-300 block text-[11px] uppercase tracking-wider">
            Temporal Cross-Layer Correlation Insights:
          </span>
          <p className="text-[11px] text-text-secondary leading-relaxed">
            {report.multimodalAssessment?.temporalCorrelationSummary ||
              'Behavioral pacing and observable attention directions exhibit natural alignment without correlated anomalous bursts.'}
          </p>
        </div>

        {/* Human Review Recommendation */}
        <div className="flex items-center justify-between gap-3 pt-1 text-xs border-t border-border/60">
          <div className="flex items-center gap-2">
            <Info size={14} className="text-sky-400 shrink-0" />
            <span className="text-text-muted">
              Reviewer Guidance: <strong>{report.multimodalAssessment?.recommendationForReviewer || report.recommendedAction}</strong>
            </span>
          </div>
          <span className="text-[10px] text-text-muted font-mono shrink-0">
            Assessed: {formatExamDate(report.multimodalAssessment?.assessedAt || report.generatedAt)}
          </span>
        </div>
      </Card>

      {/* ─── Layer 2: Camera Evidence Inspection Grid ──────────────────────── */}
      <Card padding="md">
        <CardHeader
          title="Layer 2 — Camera Evidence & Attention Telemetry"
          subtitle="Privacy-aware, derived optical metrics: face presence continuity, estimated look-away directions, and multiple-person detection"
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
              Camera Evidence Layer
            </span>
          }
        />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          {/* Face Presence Rate */}
          <div className="p-3 rounded-xl bg-surface-800 border border-border space-y-1">
            <span className="text-[10px] font-bold text-text-muted uppercase block">Face Presence Rate</span>
            <span className="text-xl font-bold font-mono text-emerald-400">
              {report.cameraEvidenceSummary?.facePresencePercentage ?? 98}%
            </span>
            <span className="text-[10px] text-text-muted block">
              Absence: {report.cameraEvidenceSummary?.totalAbsenceDurationSec ?? 0}s
            </span>
          </div>

          {/* Look-Away Events */}
          <div className="p-3 rounded-xl bg-surface-800 border border-border space-y-1">
            <span className="text-[10px] font-bold text-text-muted uppercase block">Look-Away Breakdown</span>
            <span className="text-xl font-bold font-mono text-sky-400">
              {report.cameraEvidenceSummary?.totalLookAwayEvents ?? 2}
            </span>
            <span className="text-[10px] text-text-muted block truncate">
              {report.cameraEvidenceSummary?.briefLookAwayCount ?? 2} Brief · {report.cameraEvidenceSummary?.prolongedLookAwayCount ?? 0} Prolonged
            </span>
          </div>

          {/* Multiple-Person Observations */}
          <div className="p-3 rounded-xl bg-surface-800 border border-border space-y-1">
            <span className="text-[10px] font-bold text-text-muted uppercase block">Multiple-Person Events</span>
            <span className={`text-xl font-bold font-mono ${
              (report.cameraEvidenceSummary?.multiplePersonEventCount ?? 0) > 0 ? 'text-rose-400' : 'text-text-primary'
            }`}>
              {report.cameraEvidenceSummary?.multiplePersonEventCount ?? 0}
            </span>
            <span className="text-[10px] text-text-muted block">
              {(report.cameraEvidenceSummary?.multiplePersonEventCount ?? 0) > 0 ? 'Extra Face Observed' : 'Single Face'}
            </span>
          </div>

          {/* Camera Interruption Log */}
          <div className="p-3 rounded-xl bg-surface-800 border border-border space-y-1">
            <span className="text-[10px] font-bold text-text-muted uppercase block">Stream Continuity</span>
            <span className="text-xl font-bold font-mono text-emerald-400">
              {report.cameraEvidenceSummary?.cameraInterruptionCount === 0 ? 'Continuous' : `${report.cameraEvidenceSummary?.cameraInterruptionCount} Drops`}
            </span>
            <span className="text-[10px] text-text-muted block">
              Status: {report.cameraEvidenceSummary?.overallCameraStatus || 'Active'}
            </span>
          </div>
        </div>
      </Card>

      {/* ─── Exam Event Timeline & Sequence Inspection ──────────────────────── */}
      {report.examEventTimeline && report.examEventTimeline.length > 0 && (
        <Card>
          <CardHeader
            title="Exam Event Timeline"
            subtitle="Chronological audit stream of student action transitions and integrity opportunity events"
            badge={<Badge variant="verified" size="sm">{report.examEventTimeline.length} Events</Badge>}
          />
          <div className="mt-3 max-h-64 overflow-y-auto space-y-2 pr-1">
            {report.examEventTimeline.slice(0, 15).map((evt, idx) => (
              <div
                key={evt.id || idx}
                className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-3 ${
                  evt.isAnomalous
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                    : evt.category === 'integrity_opportunity'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                    : 'bg-surface-700/30 border-border text-text-secondary'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-bold text-text-muted text-[11px]">
                    {evt.timeFormatted}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                      evt.category === 'integrity_opportunity'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-indigo-500/20 text-indigo-300'
                    }`}
                  >
                    {evt.category.replace('_', ' ')}
                  </span>
                  <span className="text-text-primary">{evt.description}</span>
                </div>
                {evt.sessionPosition && (
                  <span className="text-[10px] text-text-muted font-mono shrink-0">
                    Q{evt.sessionPosition}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ─── Mandatory Intellectual Property & Human-Review Disclaimer ─────── */}
      <div className="p-4 rounded-2xl bg-surface-900 border border-border/80 flex items-start gap-3.5 text-xs text-text-muted">
        <ShieldCheck size={20} className="text-indigo-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <strong className="text-text-secondary block">Explainable Behavioral Risk Disclaimer</strong>
          <p className="text-[11px] leading-relaxed">
            {report.disclaimer} This report reflects statistical divergence from student {report.studentId}&apos;s own low-stakes coursework baseline.
            It does not constitute an automated cheating finding, and human instructor review is required prior to any academic action.
          </p>
        </div>
      </div>
    </div>
  );
}
