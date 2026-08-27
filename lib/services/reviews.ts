/**
 * ExamGuard — Reviews Service
 *
 * Single access point for the human-review queue.
 * Merges static mock alerts (data/mockAlerts.ts) with dynamic review-required
 * sessions from Supabase.
 *
 * Phase 2+: Fully backed by Supabase queries.
 */

import type { Review, AlertSeverity, ReviewStatus } from '@/types';
import { mockAlerts } from '@/data/mockAlerts';
import { getExamSessions } from '@/lib/services/sessions';
import { updateExamSession as storeUpdateExamSession } from '@/lib/sessionStore'; // fallback only

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

// ─── Internal helpers ─────────────────────────────────────────────────────────

function sessionToReview(s: any): Review {
  const ratio = s.deviationScore / s.personalizedThreshold;
  let severity: AlertSeverity = 'low';
  if (ratio > 1.5) severity = 'high';
  else if (ratio > 1.2) severity = 'medium';

  return {
    id: `alert-${s.id}`,
    sessionId: s.id,
    studentId: s.studentId,
    studentName: s.studentName,
    examName: s.examName,
    deviationScore: s.deviationScore,
    personalizedThreshold: s.personalizedThreshold,
    severity,
    status: s.reviewStatus as ReviewStatus,
    createdAt: s.date || s.startedAt,
    reviewedAt: s.reviewedAt,
    reviewedBy: s.reviewedBy,
    notes: s.notes,
  };
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getReviewQueue(): Promise<Review[]> {
  try {
    const sessions = await getExamSessions();
    const reviewRequired = sessions.filter(s => s.reviewStatus === 'review_required' || s.reviewStatus === 'disputed' || s.reviewStatus === 'not_verified' || s.reviewStatus === 'verified');
    const dynamicReviews = reviewRequired.map(sessionToReview);

    const combined = [...(isDemoMode ? mockAlerts : []), ...dynamicReviews];
    const seen = new Map<string, Review>();
    
    // Dynamic entries win
    combined.forEach((r) => seen.set(r.id, r));

    return Array.from(seen.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  } catch (error) {
    if (isDemoMode) {
      return mockAlerts;
    }
    throw error;
  }
}

export async function getReview(sessionId: string): Promise<Review | null> {
  const queue = await getReviewQueue();
  return queue.find((r) => r.sessionId === sessionId) ?? null;
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function updateReview(sessionId: string, updates: Partial<Review>): Promise<void> {
  try {
    const response = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        decision: updates.status,
        notes: updates.notes,
      }),
    });

    if (!response.ok) {
      if (isDemoMode && response.status === 422) {
        storeUpdateExamSession(sessionId, {
          reviewStatus: updates.status,
          reviewedAt: updates.reviewedAt,
          reviewedBy: updates.reviewedBy,
          notes: updates.notes,
        });
        return;
      }
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error ?? `HTTP ${response.status}`);
    }
  } catch (error) {
    if (isDemoMode) {
      console.warn('[updateReview] Demo fallback', error);
      storeUpdateExamSession(sessionId, {
        reviewStatus: updates.status,
        reviewedAt: updates.reviewedAt,
        reviewedBy: updates.reviewedBy,
        notes: updates.notes,
      });
      return;
    }
    throw error;
  }
}

// createReview is logically the same as updateReview now
export const createReview = updateReview;
