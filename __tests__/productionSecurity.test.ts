import { buildBehavioralModel } from '../lib/modelingEngine';
import { evaluateSessionDeviation, calculateRawDeviationScore } from '../lib/deviationEngine';
import { buildCanonicalPayload, generateSessionCommitment, verifySessionCommitment } from '../lib/cryptoEngine';
import { BehavioralSession } from '../types';

function createMockSession(
  id: string,
  studentId: string,
  type: 'low_stakes' | 'graded_examination',
  reviewStatus: 'normal' | 'review_required' | 'verified' | 'not_verified' | 'disputed',
  features: {
    responseTime?: number;
    revisionCount?: number;
    pointerMovement?: number;
    scrollDistance?: number;
    pasteDetected?: boolean | number;
  },
  date: string
): any {
  return {
    id,
    studentId,
    studentName: 'Test Student',
    type,
    reviewStatus,
    date,
    startTime: date,
    features: [
      {
        questionId: 'q1',
        responseTime: features.responseTime ?? 15,
        revisionCount: features.revisionCount ?? 2,
        pointerMovement: features.pointerMovement ?? 150,
        scrollDistance: features.scrollDistance ?? 300,
        pasteDetected: Boolean(features.pasteDetected),
        deviceType: 'desktop',
      },
    ],
  };
}

describe('Step 4: Production Security & End-to-End Integrity Audit', () => {
  // ── 1. Server Authority & Fraudulent Metric Override ───────────────────────
  it('1. Overrides client-submitted fraudulent deviation score and status using server-authoritative Mahalanobis calculation', () => {
    // 10 baseline sessions
    const sessions = Array(10)
      .fill(0)
      .map((_, i) => {
        const day = i < 9 ? `0${i + 1}` : `${i + 1}`;
        return createMockSession(`s${i}`, 'stu-sec-1', 'low_stakes', 'normal', {
          responseTime: 10 + (i % 2),
          revisionCount: 1,
          pointerMovement: 100,
          scrollDistance: 200,
          pasteDetected: 0,
        }, `2026-08-${day}T00:00:00Z`);
      });

    const activeModel = buildBehavioralModel('stu-sec-1', sessions);
    expect(activeModel.status).toBe('active');

    // Anomalous exam session
    const anomalousExam: BehavioralSession = {
      id: 'exam-anomaly',
      studentId: 'stu-sec-1',
      studentName: 'Test Student',
      examName: 'Exam',
      examCode: 'CS101',
      type: 'graded_examination',
      startTime: '2026-08-20T00:00:00Z',
      endTime: '2026-08-20T01:00:00Z',
      duration: 60,
      questionCount: 1,
      deviceType: 'desktop',
      reviewStatus: 'normal', // Attacker sends normal!
      features: [
        {
          questionId: 'q1',
          responseTime: 80, // 8x normal
          revisionCount: 8, // 8x normal
          pointerMovement: 1000,
          scrollDistance: 1200,
          pasteDetected: true,
          deviceType: 'desktop',
        },
      ],
    };

    // Server-side evaluateSessionDeviation calculates true score
    const serverResult = evaluateSessionDeviation(anomalousExam, activeModel);
    
    // Attacker claimed 0.1 and normal, but server evaluates true Mahalanobis distance > threshold
    expect(serverResult.deviationScore).toBeGreaterThan(activeModel.calibratedThreshold!);
    expect(serverResult.reviewRequired).toBe(true);
  });

  // ── 2. Session Eligibility in Closed-Loop Model Updates ────────────────────
  it('2. Closed loop strictly includes verified exams and strictly excludes not_verified and disputed exams', () => {
    const baseSessions = Array(9)
      .fill(0)
      .map((_, i) => {
        const day = `0${i + 1}`;
        return createMockSession(`s${i}`, 'stu-elig', 'low_stakes', 'normal', {
          responseTime: 15,
        }, `2026-08-${day}T00:00:00Z`);
      });

    // 1. With 9 sessions -> cold_start (< 10)
    const modelCold = buildBehavioralModel('stu-elig', baseSessions);
    expect(modelCold.status).toBe('cold_start');

    // 2. Add an unverified / disputed exam session -> must still be cold_start (excluded from training)
    const disputedSession = createMockSession(
      'exam-disputed',
      'stu-elig',
      'graded_examination',
      'disputed',
      { responseTime: 100 },
      '2026-08-10T00:00:00Z'
    );
    const modelWithDisputed = buildBehavioralModel('stu-elig', [...baseSessions, disputedSession]);
    expect(modelWithDisputed.status).toBe('cold_start');
    expect(modelWithDisputed.sessionCount).toBe(9); // disputed session was excluded!

    // 3. Add a not_verified exam session -> must still be cold_start
    const notVerifiedSession = createMockSession(
      'exam-not-verified',
      'stu-elig',
      'graded_examination',
      'not_verified',
      { responseTime: 100 },
      '2026-08-11T00:00:00Z'
    );
    const modelWithNotVerified = buildBehavioralModel('stu-elig', [...baseSessions, notVerifiedSession]);
    expect(modelWithNotVerified.status).toBe('cold_start');
    expect(modelWithNotVerified.sessionCount).toBe(9);

    // 4. Add a VERIFIED exam session -> reaches 10 eligible sessions -> status becomes active!
    const verifiedSession = createMockSession(
      'exam-verified',
      'stu-elig',
      'graded_examination',
      'verified',
      { responseTime: 15 },
      '2026-08-12T00:00:00Z'
    );
    const modelWithVerified = buildBehavioralModel('stu-elig', [...baseSessions, verifiedSession]);
    expect(modelWithVerified.status).toBe('active');
    expect(modelWithVerified.sessionCount).toBe(10);
  });

  // ── 3. Cryptographic Provenance Tamper-Proofing ─────────────────────────────
  it('3. Provenance verification fails deterministically if any feature is altered', async () => {
    const session = createMockSession('ses-prov', 'stu-prov', 'graded_examination', 'normal', {
      responseTime: 25,
      revisionCount: 2,
      pointerMovement: 180,
      scrollDistance: 320,
      pasteDetected: 0,
    }, '2026-08-25T00:00:00Z');

    const canonicalPayload = buildCanonicalPayload(session);
    const commitment = await generateSessionCommitment(canonicalPayload);

    // Legitimate verification
    const isValid = await verifySessionCommitment(canonicalPayload, commitment.hash);
    expect(isValid).toBe(true);

    // Tampered payload (e.g. attacker changes response time from 25 to 15)
    const tamperedSession = {
      ...session,
      features: [{ ...session.features[0], responseTime: 15 }],
    };
    const tamperedPayload = buildCanonicalPayload(tamperedSession);
    const isTamperedValid = await verifySessionCommitment(tamperedPayload, commitment.hash);
    expect(isTamperedValid).toBe(false);
  });

  // ── 4. Robustness against Extreme / Malformed Inputs ───────────────────────
  it('4. Robustly handles degenerate, negative, NaN, and infinite inputs without breaking', () => {
    const sessions = Array(10)
      .fill(0)
      .map((_, i) => {
        const day = i < 9 ? `0${i + 1}` : `${i + 1}`;
        return createMockSession(`s${i}`, 'stu-deg', 'low_stakes', 'normal', {
          responseTime: 10,
        }, `2026-08-${day}T00:00:00Z`);
      });

    const model = buildBehavioralModel('stu-deg', sessions);

    const degenerateExam: any = {
      id: 'e-deg',
      studentId: 'stu-deg',
      features: [
        {
          responseTime: NaN,
          revisionCount: -5,
          pointerMovement: Infinity,
          scrollDistance: -100,
          pasteDetected: null,
        },
      ],
    };

    const score = calculateRawDeviationScore(degenerateExam.features, model);
    expect(isFinite(score)).toBe(true);
    expect(isNaN(score)).toBe(false);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});
