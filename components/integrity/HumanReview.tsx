'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Info,
  Sparkles,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { storeItem, getItem } from '@/lib/sessionStore';

export type HumanReviewDecision =
  | 'review_recommended'
  | 'verified_clean'
  | 'not_verified'
  | 'pending_review';

interface HumanReviewProps {
  sessionId: string;
  studentId: string;
  initialStatus?: HumanReviewDecision;
  onDecisionChange?: (decision: HumanReviewDecision) => void;
}

export function HumanReview({
  sessionId,
  studentId,
  initialStatus = 'pending_review',
  onDecisionChange,
}: HumanReviewProps) {
  // Read saved state if present
  const storageKey = `patent_review_${sessionId}`;
  const savedStatus = typeof window !== 'undefined' ? getItem<HumanReviewDecision>(storageKey) : null;
  
  const [decision, setDecision] = useState<HumanReviewDecision>(savedStatus || initialStatus);
  const [notes, setNotes] = useState('');
  const [savedAlert, setSavedAlert] = useState<string | null>(null);

  const handleDecision = (newDecision: HumanReviewDecision) => {
    setDecision(newDecision);
    storeItem(storageKey, newDecision);
    
    // Maintain a list of verified clean sessions for model baseline updates
    const verifiedKey = `patent_verified_sessions_${studentId}`;
    const currentVerified = getItem<string[]>(verifiedKey) || [];
    
    if (newDecision === 'verified_clean') {
      if (!currentVerified.includes(sessionId)) {
        const updated = [...currentVerified, sessionId];
        storeItem(verifiedKey, updated);
      }
      setSavedAlert(`Session ${sessionId} has been marked as Verified Clean and is now authorized to update ${studentId}'s personalized baseline model.`);
    } else {
      const updated = currentVerified.filter((id) => id !== sessionId);
      storeItem(verifiedKey, updated);
      setSavedAlert(`Status updated to "${formatDecision(newDecision)}". This session will NOT be used to update the baseline.`);
    }

    if (onDecisionChange) {
      onDecisionChange(newDecision);
    }
  };

  function formatDecision(d: HumanReviewDecision): string {
    switch (d) {
      case 'verified_clean':
        return 'Verified Clean';
      case 'not_verified':
        return 'Not Verified';
      case 'review_recommended':
        return 'Review Recommended';
      case 'pending_review':
      default:
        return 'Pending Review';
    }
  }

  const decisionBadgeVariant =
    decision === 'verified_clean'
      ? 'verified'
      : decision === 'not_verified'
      ? 'not_verified'
      : decision === 'review_recommended'
      ? 'review_required'
      : 'default';

  return (
    <Card>
      <CardHeader
        title="Human Review & Model Calibration Control"
        subtitle={`Session ${sessionId} · Final determinations remain strictly with human reviewers`}
        badge={
          <Badge variant={decisionBadgeVariant}>
            {formatDecision(decision)}
          </Badge>
        }
      />

      <div className="mt-4 space-y-4">
        <p className="text-xs text-text-secondary leading-relaxed">
          The system highlights behavioral deviations for human oversight. Select a review resolution below to update student records.
        </p>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <button
            onClick={() => handleDecision('verified_clean')}
            className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
              decision === 'verified_clean'
                ? 'bg-emerald-600/25 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-900/30'
                : 'bg-surface-700/60 border-border text-text-secondary hover:text-text-primary hover:bg-surface-700'
            }`}
          >
            <CheckCircle2 size={15} className="text-emerald-400" />
            Mark as Verified Clean
          </button>

          <button
            onClick={() => handleDecision('review_recommended')}
            className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
              decision === 'review_recommended'
                ? 'bg-amber-600/25 border-amber-500 text-amber-300 shadow-md shadow-amber-900/30'
                : 'bg-surface-700/60 border-border text-text-secondary hover:text-text-primary hover:bg-surface-700'
            }`}
          >
            <AlertTriangle size={15} className="text-amber-400" />
            Review Recommended
          </button>

          <button
            onClick={() => handleDecision('not_verified')}
            className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
              decision === 'not_verified'
                ? 'bg-rose-600/25 border-rose-500 text-rose-300 shadow-md shadow-rose-900/30'
                : 'bg-surface-700/60 border-border text-text-secondary hover:text-text-primary hover:bg-surface-700'
            }`}
          >
            <XCircle size={15} className="text-rose-400" />
            Mark as Not Verified
          </button>

          <button
            onClick={() => handleDecision('pending_review')}
            className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
              decision === 'pending_review'
                ? 'bg-indigo-600/25 border-indigo-500 text-indigo-300 shadow-md shadow-indigo-900/30'
                : 'bg-surface-700/60 border-border text-text-secondary hover:text-text-primary hover:bg-surface-700'
            }`}
          >
            <Clock size={15} className="text-indigo-400" />
            Pending Review
          </button>
        </div>

        {/* Feedback Alert */}
        {savedAlert && (
          <div
            className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 animate-fadeIn ${
              decision === 'verified_clean'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-surface-700 border-border text-text-secondary'
            }`}
          >
            {decision === 'verified_clean' ? (
              <Sparkles size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
            ) : (
              <Info size={16} className="text-text-muted flex-shrink-0 mt-0.5" />
            )}
            <p className="flex-1">{savedAlert}</p>
          </div>
        )}

        {/* Model Update Policy Reminder */}
        <div className="p-3 rounded-lg bg-surface-700/50 border border-border/80 text-[11px] text-text-muted flex items-start gap-2">
          <ShieldCheck size={14} className="text-indigo-400 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Model-Update Rule:</strong> Only sessions marked as <em>Verified Clean</em> are eligible for future personalized baseline updates. Flagged or unresolved sessions will never pollute baseline statistics.
          </span>
        </div>
      </div>
    </Card>
  );
}
