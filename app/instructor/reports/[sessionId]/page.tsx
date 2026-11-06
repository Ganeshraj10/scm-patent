'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertCircle, Brain, FileText } from 'lucide-react';
import { generateRiskReport } from '@/lib/services/behavioralReportService';
import { BehavioralRiskReportView } from '@/components/integrity/BehavioralRiskReportView';
import { ExplainabilityPanel } from '@/components/integrity/ExplainabilityPanel';
import { HumanReviewService, HumanReviewCase } from '@/lib/services/humanReviewService';
import { Button } from '@/components/ui/Button';

export default function SessionReportPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const [activeTab, setActiveTab] = useState<'xai' | 'longitudinal'>('xai');

  const report = useMemo(() => {
    try {
      return generateRiskReport(sessionId, 'instructor');
    } catch (err) {
      return null;
    }
  }, [sessionId]);

  const reviewCase = useMemo<HumanReviewCase | null>(() => {
    try {
      return HumanReviewService.getOrCreateCaseForSession(sessionId);
    } catch (err) {
      console.warn('[SessionReportPage] Review case generation notice:', err);
      return null;
    }
  }, [sessionId]);

  if (!report && !reviewCase) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center space-y-4">
        <div className="p-3 rounded-full bg-rose-500/10 text-rose-400 w-12 h-12 flex items-center justify-center mx-auto">
          <AlertCircle size={24} />
        </div>
        <h2 className="text-lg font-bold text-text-primary">Report Not Found</h2>
        <p className="text-xs text-text-muted">
          Could not find telemetry records for examination session <code className="font-mono text-indigo-400">{sessionId}</code>.
        </p>
        <Link href="/instructor/reports">
          <Button variant="secondary" size="sm" className="mt-2 text-xs">
            <ArrowLeft size={14} className="mr-1" />
            Back to Reports Directory
          </Button>
        </Link>
      </div>
    );
  }

  const handleDecisionSubmit = async (decision: any, notes: string) => {
    await HumanReviewService.submitReviewDecision(sessionId, 'INST-PRIMARY', decision, notes);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Navigation & Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link href="/instructor/reports">
          <Button variant="ghost" size="sm" className="text-xs text-text-muted hover:text-text-primary">
            <ArrowLeft size={14} className="mr-1" />
            Back to Reports Directory
          </Button>
        </Link>

        {report && reviewCase && (
          <div className="flex items-center gap-1.5 p-1 rounded-lg bg-surface-elevated/70 border border-border/50">
            <button
              onClick={() => setActiveTab('xai')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'xai'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Brain size={14} /> Explainable AI & Human Review (Phase 4)
            </button>
            <button
              onClick={() => setActiveTab('longitudinal')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'longitudinal'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <FileText size={14} /> Longitudinal Baseline Report
            </button>
          </div>
        )}
      </div>

      {/* Render Active View */}
      {activeTab === 'xai' && reviewCase ? (
        <ExplainabilityPanel
          sessionId={sessionId}
          pseudonymousStudentId={reviewCase.pseudonymousStudentId}
          explanations={reviewCase.modelExplanations}
          initialModelName={reviewCase.primaryModel}
          initialReviewStatus={reviewCase.reviewStatus}
          onDecisionSubmit={handleDecisionSubmit}
        />
      ) : report ? (
        <BehavioralRiskReportView report={report} />
      ) : reviewCase ? (
        <ExplainabilityPanel
          sessionId={sessionId}
          pseudonymousStudentId={reviewCase.pseudonymousStudentId}
          explanations={reviewCase.modelExplanations}
          initialModelName={reviewCase.primaryModel}
          initialReviewStatus={reviewCase.reviewStatus}
          onDecisionSubmit={handleDecisionSubmit}
        />
      ) : null}
    </div>
  );
}
