'use client';

import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Brain,
  Info,
  CheckCircle,
  Clock,
  RotateCcw,
  MousePointer,
  ArrowDown,
  Layers,
  Sparkles,
  GitCommit,
  Network,
  Cpu,
  Save,
  UserCheck,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import {
  ModelExplanationResult,
  HumanReviewCategory,
  InstructorReviewDecision,
} from '@/lib/ml/explainability/types';

interface ExplainabilityPanelProps {
  sessionId: string;
  pseudonymousStudentId: string;
  explanations: Record<string, ModelExplanationResult>;
  initialModelName?: string;
  initialReviewStatus?: InstructorReviewDecision;
  onDecisionSubmit?: (decision: InstructorReviewDecision, notes: string) => Promise<void>;
}

export function ExplainabilityPanel({
  sessionId,
  pseudonymousStudentId,
  explanations,
  initialModelName = 'Regularised Mahalanobis Distance',
  initialReviewStatus = 'pending',
  onDecisionSubmit,
}: ExplainabilityPanelProps) {
  const modelNames = Object.keys(explanations);
  const [selectedModel, setSelectedModel] = useState<string>(
    modelNames.includes(initialModelName) ? initialModelName : modelNames[0] || ''
  );
  const [reviewDecision, setReviewDecision] = useState<InstructorReviewDecision>(initialReviewStatus);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);

  const activeExplanation: ModelExplanationResult | undefined = explanations[selectedModel];

  if (!activeExplanation) {
    return (
      <Card className="p-6 text-center text-text-muted">
        <AlertTriangle size={24} className="mx-auto text-amber-400 mb-2" />
        <p className="text-sm">No explainability models available for this session.</p>
      </Card>
    );
  }

  const handleDecisionSubmit = async () => {
    if (!onDecisionSubmit) return;
    setIsSubmitting(true);
    try {
      await onDecisionSubmit(reviewDecision, notes);
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (err) {
      console.error('[ExplainabilityPanel] Error saving decision:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCategoryBadge = (category: HumanReviewCategory) => {
    switch (category) {
      case 'Normal behaviour':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck size={14} /> Normal Behaviour
          </span>
        );
      case 'Behavioural deviation detected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle size={14} /> Behavioural Deviation Detected
          </span>
        );
      case 'Review required':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <ShieldAlert size={14} /> Review Required
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Multi-Model Selector */}
      <Card className="p-5 border-border/60 bg-surface/50 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/40">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                {pseudonymousStudentId}
              </span>
              <span className="text-xs text-text-muted font-mono">{sessionId}</span>
            </div>
            <h2 className="text-base font-semibold text-text-primary mt-1.5 flex items-center gap-2">
              <Brain size={18} className="text-indigo-400" />
              Explainable AI Telemetry Inspection
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {getCategoryBadge(activeExplanation.reviewCategory)}
          </div>
        </div>

        {/* Model Tabs */}
        <div className="mt-4 flex flex-wrap gap-2">
          {modelNames.map((name) => {
            const isSelected = name === selectedModel;
            const exp = explanations[name];
            return (
              <button
                key={name}
                onClick={() => setSelectedModel(name)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-surface-elevated/70 text-text-muted hover:text-text-primary hover:bg-surface-elevated border border-border/40'
                }`}
              >
                <span>{name}</span>
                {exp?.isAnomaly && (
                  <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>

        {/* Non-Accusatory Ethical Disclaimer */}
        <div className="mt-4 p-3 rounded-lg bg-surface-elevated/60 border border-border/40 flex items-start gap-3">
          <Info size={16} className="text-indigo-400 shrink-0 mt-0.5" />
          <p className="text-xs text-text-muted leading-relaxed">
            <strong className="text-text-primary">Human-in-the-Loop Safeguard:</strong> {activeExplanation.nonCausalDisclaimer} The instructor retains exclusive decision authority.
          </p>
        </div>
      </Card>

      {/* 2. Key Metrics Card */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 border-border/40">
          <span className="text-xs text-text-muted">Raw Anomaly Score</span>
          <div className="text-xl font-bold text-text-primary mt-1">
            {activeExplanation.rawAnomalyScore.toFixed(3)}
          </div>
          <span className="text-[11px] text-text-muted">
            Direction: {activeExplanation.scoreOrientation === 'higher_is_more_anomalous' ? 'Higher = Anomalous' : 'Lower = Anomalous'}
          </span>
        </Card>

        <Card className="p-4 border-border/40">
          <span className="text-xs text-text-muted">Calibrated Threshold (5% FPR)</span>
          <div className="text-xl font-bold text-indigo-400 mt-1">
            {activeExplanation.calibratedThreshold.toFixed(3)}
          </div>
          <span className="text-[11px] text-text-muted">Held-out Baseline Calibration</span>
        </Card>

        <Card className="p-4 border-border/40">
          <span className="text-xs text-text-muted">Top Contributing Feature</span>
          <div className="text-base font-semibold text-text-primary mt-1 truncate">
            {activeExplanation.topContributingFeature}
          </div>
          <span className="text-[11px] text-amber-400 font-medium">Rank #1 Displacer</span>
        </Card>

        <Card className="p-4 border-border/40">
          <span className="text-xs text-text-muted">Explanation Faithfulness</span>
          <div className="text-xl font-bold text-emerald-400 mt-1">
            {(activeExplanation.explanationFaithfulnessScore * 100).toFixed(0)}%
          </div>
          <span className="text-[11px] text-text-muted">Score drop on top-feature neutralization</span>
        </Card>
      </div>

      {/* 3. Feature Breakdown Table */}
      <Card className="p-5 border-border/50">
        <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
          <Layers size={16} className="text-indigo-400" />
          Feature-Level Attributions & Baseline Comparison
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/60 text-text-muted uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Rank</th>
                <th className="py-2.5 px-3">Feature</th>
                <th className="py-2.5 px-3">Observed Value</th>
                <th className="py-2.5 px-3">Personal Baseline</th>
                <th className="py-2.5 px-3">Deviation (z)</th>
                <th className="py-2.5 px-3">Attribution</th>
                <th className="py-2.5 px-3">Sensitivity (Δ)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {activeExplanation.features
                .sort((a, b) => a.attributionRank - b.attributionRank)
                .map((f) => {
                  const isTop = f.attributionRank === 1;
                  const absZ = Math.abs(f.standardizedDeviation);
                  return (
                    <tr
                      key={f.featureKey}
                      className={isTop ? 'bg-indigo-500/5 font-medium' : 'hover:bg-surface-elevated/30'}
                    >
                      <td className="py-3 px-3 font-mono">
                        <span
                          className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] ${
                            isTop
                              ? 'bg-indigo-500 text-white'
                              : 'bg-surface-elevated text-text-muted'
                          }`}
                        >
                          {f.attributionRank}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-text-primary font-medium">{f.displayName}</span>
                        <div className="text-[11px] text-text-muted">{f.humanDescription}</div>
                      </td>
                      <td className="py-3 px-3 font-mono text-text-primary">
                        {f.observedValue} <span className="text-[10px] text-text-muted">{f.unit}</span>
                      </td>
                      <td className="py-3 px-3 font-mono text-text-muted">
                        {f.baselineMean} ± {f.baselineStdDev}
                      </td>
                      <td className="py-3 px-3 font-mono">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] ${
                            absZ >= 3.0
                              ? 'bg-rose-500/10 text-rose-400 font-bold'
                              : absZ >= 2.0
                              ? 'bg-amber-500/10 text-amber-400'
                              : 'text-text-muted'
                          }`}
                        >
                          {f.standardizedDeviation > 0 ? `+${f.standardizedDeviation}` : f.standardizedDeviation}σ
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <ProgressBar value={f.attributionScore * 100} size="sm" className="w-16" />
                          <span className="text-[11px] font-mono text-text-muted">
                            {(f.attributionScore * 100).toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono text-text-primary">
                        -{f.perturbationImpact.toFixed(3)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 4. Model-Specific Deep Diagnostics */}
      {/* 4A: Mahalanobis Covariance Coupling */}
      {activeExplanation.mahalanobisCoupling && (
        <Card className="p-5 border-border/40">
          <h3 className="text-sm font-semibold text-text-primary mb-2 flex items-center gap-2">
            <Network size={16} className="text-indigo-400" />
            Covariance Coupling Matrix Decomposition
          </h3>
          <p className="text-xs text-text-muted mb-4 leading-relaxed">
            {activeExplanation.mahalanobisCoupling.disclaimer}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeExplanation.mahalanobisCoupling.covarianceCouplings
              .filter((c) => Math.abs(c.couplingContribution) > 0.05)
              .map((c, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg bg-surface-elevated/40 border border-border/30 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-semibold text-text-primary">
                      {c.featureA} ↔ {c.featureB}
                    </span>
                    <div className="text-[11px] text-text-muted">
                      Correlation: {c.correlation} | Inverse term W_jk: {c.inverseCorrelationTerm}
                    </div>
                  </div>
                  <div className="font-mono text-right">
                    <span
                      className={`font-semibold ${
                        c.couplingContribution > 0 ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {c.couplingContribution > 0 ? `+${c.couplingContribution}` : c.couplingContribution}
                    </span>
                    <div className="text-[10px] text-text-muted">Joint ΔD²</div>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* 4B: Isolation Forest Exact Shapley Coalitions */}
      {activeExplanation.isolationForestShap && (
        <Card className="p-5 border-border/40">
          <h3 className="text-sm font-semibold text-text-primary mb-2 flex items-center gap-2">
            <Sparkles size={16} className="text-indigo-400" />
            Exact Shapley Values (All 32 Coalitions)
          </h3>
          <p className="text-xs text-text-muted mb-4">
            Expected Baseline Score: {activeExplanation.isolationForestShap.baselineExpectedScore.toFixed(3)} | Approximation: Exact combinatorial evaluation across all 2⁵ feature subsets.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(activeExplanation.isolationForestShap.shapleyValues).map(
              ([feat, val]) => (
                <div key={feat} className="p-3 rounded-lg bg-surface-elevated/40 border border-border/30 text-center">
                  <span className="text-[11px] text-text-muted truncate block">{feat}</span>
                  <div
                    className={`text-base font-bold font-mono mt-1 ${
                      val > 0.05 ? 'text-rose-400' : val > 0 ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {val > 0 ? `+${val.toFixed(3)}` : val.toFixed(3)}
                  </div>
                  <span className="text-[10px] text-text-muted">Shapley ϕ</span>
                </div>
              )
            )}
          </div>
        </Card>
      )}

      {/* 4C: LOF Local Neighbourhood Inspection */}
      {activeExplanation.lofNeighbourhood && (
        <Card className="p-5 border-border/40">
          <h3 className="text-sm font-semibold text-text-primary mb-2 flex items-center gap-2">
            <GitCommit size={16} className="text-indigo-400" />
            Local Neighbourhood & Density Inspection (k = {activeExplanation.lofNeighbourhood.kNeighbors})
          </h3>
          <p className="text-xs text-text-muted mb-4">
            Query Point Density: {activeExplanation.lofNeighbourhood.queryLocalReachabilityDensity.toFixed(4)} vs Average Baseline Neighbour Density: {activeExplanation.lofNeighbourhood.averageNeighbourDensity.toFixed(4)} (Density Ratio = {activeExplanation.lofNeighbourhood.densityRatio.toFixed(3)}).
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border/60 text-text-muted text-[10px]">
                  <th className="py-2 px-2">Neighbour</th>
                  <th className="py-2 px-2">Distance d(x, o)</th>
                  <th className="py-2 px-2">k-Distance</th>
                  <th className="py-2 px-2">Local Reachability Density</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20 font-mono">
                {activeExplanation.lofNeighbourhood.neighbours.map((nb) => (
                  <tr key={nb.neighborIndex} className="hover:bg-surface-elevated/30">
                    <td className="py-2 px-2 text-text-primary">Neighbour #{nb.neighborIndex}</td>
                    <td className="py-2 px-2 text-text-muted">{nb.distance.toFixed(3)}</td>
                    <td className="py-2 px-2 text-text-muted">{nb.kDistance.toFixed(3)}</td>
                    <td className="py-2 px-2 text-indigo-400">{nb.lrd.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 4D: One-Class SVM Decision Boundary Gradient */}
      {activeExplanation.svmSensitivity && (
        <Card className="p-5 border-border/40">
          <h3 className="text-sm font-semibold text-text-primary mb-2 flex items-center gap-2">
            <Cpu size={16} className="text-indigo-400" />
            Decision Boundary Gradient & Support Vector Projection
          </h3>
          <p className="text-xs text-text-muted mb-4">
            Support Vectors: {activeExplanation.svmSensitivity.supportVectorCount} | Boundary Offset ρ: {activeExplanation.svmSensitivity.marginOffsetRho.toFixed(4)}. Positive gradient indicates coordinates pushing outside the support hyperplane.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(activeExplanation.svmSensitivity.gradients).map(([feat, grad]) => (
              <div key={feat} className="p-3 rounded-lg bg-surface-elevated/40 border border-border/30 text-center">
                <span className="text-[11px] text-text-muted truncate block">{feat}</span>
                <div
                  className={`text-base font-bold font-mono mt-1 ${
                    grad > 0.05 ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {grad > 0 ? `+${grad.toFixed(3)}` : grad.toFixed(3)}
                </div>
                <span className="text-[10px] text-text-muted">∂s/∂z_j</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 5. Human-in-the-Loop Instructor Review Decision Card */}
      <Card className="p-6 border-indigo-500/30 bg-surface/70 shadow-lg">
        <h3 className="text-base font-semibold text-text-primary mb-1 flex items-center gap-2">
          <UserCheck size={18} className="text-indigo-400" />
          Instructor Decision & Pedagogical Notes
        </h3>
        <p className="text-xs text-text-muted mb-4">
          Record your pedagogical assessment. This decision updates the student’s longitudinal record and logs an immutable audit trail.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-text-muted block mb-2">Review Assessment</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setReviewDecision('cleared_normal')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  reviewDecision === 'cleared_normal'
                    ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-400'
                    : 'border-border/40 bg-surface-elevated/40 text-text-muted hover:border-border'
                }`}
              >
                <div className="font-semibold text-xs text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle size={14} /> Cleared (Legitimate Variation)
                </div>
                <div className="text-[11px] text-text-muted mt-1">
                  Deviation is consistent with difficult questions, breaks, or device change.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setReviewDecision('verified_deviation')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  reviewDecision === 'verified_deviation'
                    ? 'border-rose-500/60 bg-rose-500/10 text-rose-400'
                    : 'border-border/40 bg-surface-elevated/40 text-text-muted hover:border-border'
                }`}
              >
                <div className="font-semibold text-xs text-rose-400 flex items-center gap-1.5">
                  <AlertTriangle size={14} /> Confirmed Behavioural Deviation
                </div>
                <div className="text-[11px] text-text-muted mt-1">
                  Significant uncharacteristic deviation flagged for follow-up pedagogical inquiry.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setReviewDecision('inconclusive')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  reviewDecision === 'inconclusive'
                    ? 'border-indigo-500/60 bg-indigo-500/10 text-indigo-400'
                    : 'border-border/40 bg-surface-elevated/40 text-text-muted hover:border-border'
                }`}
              >
                <div className="font-semibold text-xs text-indigo-400 flex items-center gap-1.5">
                  <Info size={14} /> Inconclusive
                </div>
                <div className="text-[11px] text-text-muted mt-1">
                  Telemetry is ambiguous or incomplete; monitor future sessions.
                </div>
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-text-muted block mb-1.5">
              Pedagogical Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record pedagogical context, student consultation notes, or reason for decision..."
              rows={3}
              className="w-full text-xs p-3 rounded-lg bg-surface-elevated/80 border border-border/50 text-text-primary focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-text-muted">
              {submitSuccess ? (
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle size={14} /> Decision recorded to immutable audit log.
                </span>
              ) : (
                'All decisions are signed and cryptographically logged.'
              )}
            </span>

            <Button
              variant="primary"
              size="sm"
              onClick={handleDecisionSubmit}
              disabled={isSubmitting}
              className="text-xs font-medium"
            >
              {isSubmitting ? 'Saving Decision...' : 'Submit Review Decision'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

