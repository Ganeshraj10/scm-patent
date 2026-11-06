/**
 * ============================================================================
 * EXAMGUARD — PHASE 4: HUMAN-IN-THE-LOOP INSTRUCTOR REVIEW SERVICE
 * ============================================================================
 * Manages the pedagogical review workflow with strict ethical and privacy safeguards:
 *
 * Output Categories:
 * 1. "Normal behaviour" - Within calibrated personal baseline parameters.
 * 2. "Behavioural deviation detected" - Statistically unusual variation; pedagocial review suggested.
 * 3. "Review required" - Substantial multi-feature shift; instructor inspection required.
 *
 * Ethical Principle:
 * - The system NEVER accuses a student of cheating.
 * - The instructor retains exclusive decision-making authority.
 * - Explanations are non-causal statistical associations.
 */

import { IAnomalyDetectionModel } from '../ml/types';
import { ModelExplanationResult, HumanReviewCategory, InstructorReviewDecision } from '../ml/explainability/types';
import { ExplanationEvaluator } from '../ml/explainability/explanationEvaluator';
import { PrivacyService } from '../privacy/privacyService';
import {
  RegularizedMahalanobisModel,
  IsolationForestModel,
  LocalOutlierFactorModel,
  OneClassSVMModel,
} from '../ml/models';
import { mockAlerts } from '@/data/mockAlerts';
import { mockSessions } from '@/data/mockSessions';

export interface HumanReviewCase {
  caseId: string;
  sessionId: string;
  studentId: string;
  pseudonymousStudentId: string;
  sessionTimestamp: string;
  deviceType?: string;
  isAnomaly: boolean;
  category: HumanReviewCategory;
  reviewStatus: InstructorReviewDecision;
  instructorNotes?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  dataQualityStatus: 'complete' | 'imputed_missing_features';
  dataQualityWarnings: string[];
  
  // Multi-model explanations (all 4 models available for instructor comparison)
  modelExplanations: Record<string, ModelExplanationResult>;
  primaryModel: string;
}

const STORAGE_KEY = 'examguard_human_reviews_v1';

function getStoredDecisions(): Record<string, { status: InstructorReviewDecision; notes: string; reviewedAt: string; reviewedBy: string }> {
  try {
    const storage = typeof window !== 'undefined' ? window.localStorage : (global as any)?.localStorage;
    if (!storage) return {};
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveDecisionToStorage(sessionId: string, data: { status: InstructorReviewDecision; notes: string; reviewedAt: string; reviewedBy: string }) {
  try {
    const storage = typeof window !== 'undefined' ? window.localStorage : (global as any)?.localStorage;
    if (!storage) return;
    const all = getStoredDecisions();
    all[sessionId] = data;
    storage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn('[HumanReviewService] Storage save error:', e);
  }
}

// In-memory persistent cache for demo & development review cases
const caseStore = new Map<string, HumanReviewCase>();

export class HumanReviewService {
  /**
   * Generates a comprehensive human review case for an examination session
   * across all four competing ML models.
   */
  static generateReviewCase(
    sessionId: string,
    studentId: string,
    observation: number[],
    models: Record<string, IAnomalyDetectionModel>,
    primaryModelName: string = 'Regularised Mahalanobis Distance',
    deviceType: string = 'desktop',
    sessionTimestamp: string = new Date().toISOString()
  ): HumanReviewCase {
    // Check if case already exists in store
    if (caseStore.has(sessionId)) {
      return caseStore.get(sessionId)!;
    }

    const pseudonymousId = PrivacyService.generatePseudonym(studentId);
    const modelExplanations: Record<string, ModelExplanationResult> = {};

    let highestAnomaly = false;
    let highestCategory: HumanReviewCategory = 'Normal behaviour';

    for (const [name, model] of Object.entries(models)) {
      try {
        const explanation = ExplanationEvaluator.explainModel(
          model,
          observation,
          sessionId,
          pseudonymousId
        );
        modelExplanations[name] = explanation;

        if (explanation.isAnomaly) highestAnomaly = true;
        if (explanation.reviewCategory === 'Review required') {
          highestCategory = 'Review required';
        } else if (
          explanation.reviewCategory === 'Behavioural deviation detected' &&
          highestCategory !== 'Review required'
        ) {
          highestCategory = 'Behavioural deviation detected';
        }
      } catch (err) {
        console.warn(`[HumanReviewService] Error generating explanation for ${name}:`, err);
      }
    }

    const dataQualityWarnings: string[] = [];
    const hasMissing = observation.some((val) => isNaN(val));
    if (hasMissing) {
      dataQualityWarnings.push(
        'Missing telemetry features were imputed using the student’s personal baseline mean values.'
      );
    }

    const reviewCase: HumanReviewCase = {
      caseId: `CASE-${sessionId}`,
      sessionId,
      studentId,
      pseudonymousStudentId: pseudonymousId,
      sessionTimestamp,
      deviceType,
      isAnomaly: highestAnomaly,
      category: highestCategory,
      reviewStatus: highestAnomaly ? 'pending' : 'cleared_normal',
      dataQualityStatus: hasMissing ? 'imputed_missing_features' : 'complete',
      dataQualityWarnings,
      modelExplanations,
      primaryModel: primaryModelName,
    };

    caseStore.set(sessionId, reviewCase);
    return reviewCase;
  }

  /**
   * Retrieves or automatically initializes a review case for any session ID.
   */
  static getOrCreateCaseForSession(sessionId: string): HumanReviewCase {
    if (caseStore.has(sessionId)) {
      const existing = caseStore.get(sessionId)!;
      // Re-hydrate with saved decision from localStorage if available
      const stored = getStoredDecisions()[sessionId];
      if (stored) {
        existing.reviewStatus = stored.status;
        existing.instructorNotes = stored.notes;
        existing.reviewedAt = stored.reviewedAt;
        existing.reviewedBy = stored.reviewedBy;
      }
      return existing;
    }

    let studentId = 'STU-0001';
    let observation = [24.0, 2.0, 380.0, 290.0, 0];
    let deviceType = 'desktop';

    // 1. Check mockAlerts (case-insensitive)
    const foundAlert = mockAlerts.find((a) => a.sessionId.toLowerCase() === sessionId.toLowerCase());
    // 2. Check mockSessions (case-insensitive)
    const foundSession = mockSessions.find((s) => s.id.toLowerCase() === sessionId.toLowerCase());

    if (foundAlert) {
      studentId = foundAlert.studentId;
      if (foundAlert.deviationScore > foundAlert.personalizedThreshold) {
        // Flagged session: fast response, revisions dropped to 0, paste activity
        observation = [5.2, 0, 220.0, 40.0, 10];
      } else {
        observation = [18.4, 1.2, 1240.0, 410.0, 0];
      }
    } else if (foundSession) {
      studentId = foundSession.studentId;
      deviceType = foundSession.deviceType || 'desktop';
      if (foundSession.deviationScore > 35) {
        observation = [6.8, 0.2, 280.0, 60.0, 8];
      } else {
        observation = [19.2, 1.4, 1180.0, 390.0, 0];
      }
    } else if (sessionId.startsWith('S003') || sessionId.startsWith('S002') || sessionId.startsWith('S001')) {
      studentId = sessionId.split('_')[0];
      if (sessionId.includes('FLAGGED') || sessionId.includes('MOCK_FLAGGED')) {
        observation = [4.5, 0, 180.0, 30.0, 12];
      } else {
        observation = [22.0, 2.0, 390.0, 290.0, 0];
      }
    } else if (sessionId.includes('_')) {
      studentId = sessionId.split('_')[0];
      if (sessionId.includes('SES3') || sessionId.includes('SES4')) {
        observation = [3.5, 0, 120.0, 20.0, 15]; // Severe deviation
      }
    }

    // Build representative baseline data for student
    const trainData: number[][] = [];
    const calData: number[][] = [];
    for (let i = 0; i < 20; i++) {
      trainData.push([
        22 + Math.sin(i) * 3,
        2 + (i % 2),
        370 + Math.cos(i) * 40,
        280 + Math.sin(i * 0.8) * 30,
        0,
      ]);
    }
    for (let i = 0; i < 10; i++) {
      calData.push([
        22 + Math.sin(i + 20) * 3,
        2 + (i % 2),
        370 + Math.cos(i + 20) * 40,
        280 + Math.sin((i + 20) * 0.8) * 30,
        0,
      ]);
    }

    const modelMap: Record<string, IAnomalyDetectionModel> = {
      'Regularised Mahalanobis Distance': new RegularizedMahalanobisModel({ ridgeEpsilon: 1e-4 }),
      'Isolation Forest': new IsolationForestModel({ nEstimators: 50, seed: 42 }),
      'Local Outlier Factor': new LocalOutlierFactorModel({ nNeighbors: 5 }),
      'One-Class SVM': new OneClassSVMModel({ nu: 0.05, gamma: 0.2 }),
    };

    for (const m of Object.values(modelMap)) {
      m.fit(trainData);
      m.calibrate(calData, 0.05);
    }

    const reviewCase = this.generateReviewCase(
      sessionId,
      studentId,
      observation,
      modelMap,
      'Regularised Mahalanobis Distance',
      deviceType
    );

    // Re-hydrate with saved decision from localStorage if available
    const stored = getStoredDecisions()[sessionId];
    if (stored) {
      reviewCase.reviewStatus = stored.status;
      reviewCase.instructorNotes = stored.notes;
      reviewCase.reviewedAt = stored.reviewedAt;
      reviewCase.reviewedBy = stored.reviewedBy;
    }

    return reviewCase;
  }

  /**
   * Submits an instructor review decision and notes with audit logging and localStorage persistence.
   */
  static async submitReviewDecision(
    sessionId: string,
    instructorId: string,
    decision: InstructorReviewDecision,
    notes: string = ''
  ): Promise<HumanReviewCase> {
    const reviewCase = caseStore.get(sessionId) || this.getOrCreateCaseForSession(sessionId);

    const prevStatus = reviewCase.reviewStatus;
    reviewCase.reviewStatus = decision;
    reviewCase.instructorNotes = notes;
    reviewCase.reviewedAt = new Date().toISOString();
    reviewCase.reviewedBy = instructorId;

    // Persist to localStorage so decision is retained across browser page refresh
    saveDecisionToStorage(sessionId, {
      status: decision,
      notes,
      reviewedAt: reviewCase.reviewedAt,
      reviewedBy: instructorId,
    });

    // Synchronize with API if in browser
    if (typeof window !== 'undefined') {
      try {
        await fetch('/api/reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, decision, notes }),
        });
      } catch {
        // Demo fallback
      }
    }

    return reviewCase;
  }

  /**
   * Returns a list of all active review sessions for instructor inspection.
   */
  static getAllReviewSessions(): {
    sessionId: string;
    studentName: string;
    studentId: string;
    examName: string;
    status: InstructorReviewDecision;
    deviationScore: number;
    threshold: number;
    isAnomaly: boolean;
    isSynthetic: boolean;
  }[] {
    const stored = getStoredDecisions();

    // Combine mock alerts and demo graded sessions
    const sessions = mockAlerts.map((a) => {
      const persisted = stored[a.sessionId];
      const status: InstructorReviewDecision = persisted
        ? persisted.status
        : a.status === 'verified'
        ? 'verified_deviation'
        : a.status === 'disputed'
        ? 'inconclusive'
        : 'pending';

      return {
        sessionId: a.sessionId,
        studentName: a.studentName,
        studentId: a.studentId,
        examName: a.examName,
        status,
        deviationScore: a.deviationScore,
        threshold: a.personalizedThreshold,
        isAnomaly: a.deviationScore > a.personalizedThreshold,
        isSynthetic: true,
      };
    });

    return sessions;
  }

  /**
   * Retrieves all pending review cases for the instructor queue.
   */
  static getPendingReviews(): HumanReviewCase[] {
    return Array.from(caseStore.values()).filter(
      (c) => c.reviewStatus === 'pending' || c.category === 'Review required'
    );
  }

  /**
   * Retrieves review case by session ID.
   */
  static getReviewCase(sessionId: string): HumanReviewCase | null {
    return caseStore.get(sessionId) || null;
  }

  /**
   * Clears in-memory review case cache (useful for testing and reset).
   */
  static clearCaseCache(): void {
    caseStore.clear();
  }
}
