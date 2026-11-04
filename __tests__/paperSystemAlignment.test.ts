import { buildBehavioralModel } from '@/lib/modelingEngine';
import {
  ORDERED_FEATURES,
  FEATURE_METADATA,
  computeShrinkageIntensity,
  computeSampleCovariance,
  computeSampleCorrelation,
  regularizeAndInvertCorrelation,
  evaluateSessionDeviation,
} from '@/lib/deviationEngine';
import {
  fuseMultimodalEvidence,
  matchTemporalEventWindow,
} from '@/lib/services/multimodalFusionEngine';
import {
  evaluateFacePresence,
  estimateLookAwayDirection,
  classifyLookAwaySeverity,
} from '@/lib/services/cameraProctoringService';
import {
  buildCanonicalPayload,
  generateSessionCommitment,
  verifySessionCommitment,
} from '@/lib/cryptoEngine';
import { BehavioralSession } from '@/types';

function createMockSession(
  id: string,
  studentId: string,
  type: 'low_stakes' | 'graded_examination',
  reviewStatus: 'normal' | 'verified' | 'disputed' | 'not_verified' = 'normal',
  features: any = { responseTime: 20, pointerMovement: 150, scrollDistance: 250, revisionCount: 1, pasteDetected: 0 },
  date: string = '2026-08-01T10:00:00Z'
): any {
  return {
    id,
    studentId,
    type,
    reviewStatus,
    date,
    features: Array.isArray(features) ? features : [features],
  };
}

describe('Paper-System Alignment & Verification Checklist', () => {
  // ─── 1. P0: Baseline Eligibility ──────────────────────────────────────────
  describe('1. Baseline Eligibility (low-stakes only)', () => {
    it('strictly admits low_stakes sessions and excludes all graded exams (even verified)', () => {
      const studentId = 'stu-elig-test';
      const sessions = [
        createMockSession('ls1', studentId, 'low_stakes', 'normal', { responseTime: 10 }, '2026-08-01T00:00:00Z'),
        createMockSession('ls2', studentId, 'low_stakes', 'normal', { responseTime: 12 }, '2026-08-02T00:00:00Z'),
        createMockSession('exam1', studentId, 'graded_examination', 'verified', { responseTime: 99 }, '2026-08-03T00:00:00Z'),
        createMockSession('exam2', studentId, 'graded_examination', 'disputed', { responseTime: 88 }, '2026-08-04T00:00:00Z'),
        createMockSession('exam3', studentId, 'graded_examination', 'not_verified', { responseTime: 77 }, '2026-08-05T00:00:00Z'),
      ];

      const model = buildBehavioralModel(studentId, sessions);
      // Only the 2 low-stakes sessions should enter the baseline
      expect(model.sessionCount).toBe(2);
      expect(model.expectations.find((e) => e.feature === 'responseTime')?.mean).toBe(11); // (10 + 12)/2
    });
  });

  // ─── 2. P0: Train / Calibration Split & Zero Overlap ──────────────────────
  describe('2. Train / Calibration Split & Zero Data Leakage', () => {
    const testCounts = [0, 1, 2, 4, 8, 9, 10];

    testCounts.forEach((n) => {
      it(`evaluates n=${n} sessions correctly without train/calibration reuse`, () => {
        const studentId = `stu-n-${n}`;
        const sessions = Array(n)
          .fill(0)
          .map((_, i) => {
            const day = i < 9 ? `0${i + 1}` : `${i + 1}`;
            return createMockSession(
              `s${i}`,
              studentId,
              'low_stakes',
              'normal',
              { responseTime: 15, revisionCount: 1, pointerMovement: 100, scrollDistance: 200, pasteDetected: 0 },
              `2026-08-${day}T00:00:00Z`
            );
          });

        const model = buildBehavioralModel(studentId, sessions);

        if (n < 10) {
          expect(model.status).toBe('cold_start');
          expect(model.calibrationAvailable).toBe(false);
          // For insufficient history, code must not attempt calibration or reuse train data
          expect(model.calibratedThreshold).toBe(2.5); // Documented cold-start fallback threshold
          // Training observations equals n
          expect(model.uncertainties[0]?.sampleSize ?? 0).toBe(n);
        } else {
          expect(model.status).toBe('active');
          expect(model.calibrationAvailable).toBe(true);
          // 80/20 split: 8 training, 2 calibration
          expect(model.uncertainties[0].sampleSize).toBe(8);
          expect(model.calibratedThreshold).toBeGreaterThanOrEqual(1.5);
        }
      });
    });
  });

  // ─── 3. P0: Deterministic Uncertainty Calculation ─────────────────────────
  describe('3. Deterministic Feature Uncertainty (No Math.random)', () => {
    it('produces identical uncertainty values and confidence on repeated runs', () => {
      const studentId = 'stu-det-test';
      const sessions = Array(8)
        .fill(0)
        .map((_, i) =>
          createMockSession(
            `s${i}`,
            studentId,
            'low_stakes',
            'normal',
            { responseTime: 20 + i, revisionCount: 1, pointerMovement: 100, scrollDistance: 200, pasteDetected: 0 },
            `2026-08-0${i + 1}T00:00:00Z`
          )
        );

      const run1 = buildBehavioralModel(studentId, sessions);
      const run2 = buildBehavioralModel(studentId, sessions);
      const run3 = buildBehavioralModel(studentId, sessions);

      expect(run1.confidence).toBe(run2.confidence);
      expect(run2.confidence).toBe(run3.confidence);
      expect(run1.algorithmVersion).toBe('2.1.0-deterministic');

      run1.uncertainties.forEach((u, idx) => {
        expect(u.uncertainty).toBe(run2.uncertainties[idx].uncertainty);
        expect(u.uncertainty).toBe(run3.uncertainties[idx].uncertainty);
      });
    });
  });

  // ─── 4. P0: Consistent Feature Name & Paste Aggregation ───────────────────
  describe('4. Consistent Feature Label & Paste-Event Percentage', () => {
    it('labels pasteDetected as Paste-event percentage with % unit', () => {
      expect(FEATURE_METADATA.pasteDetected.label).toBe('Paste-event percentage');
      expect(FEATURE_METADATA.pasteDetected.unit).toBe('%');

      const model = buildBehavioralModel('stu-paste', [
        createMockSession('s1', 'stu-paste', 'low_stakes', 'normal', { pasteDetected: 0 }),
      ]);
      const pasteExpectation = model.expectations.find((e) => e.feature === 'pasteDetected');
      expect(pasteExpectation?.label).toBe('Paste-event percentage');
      expect(pasteExpectation?.unit).toBe('%');
    });

    it('aggregates question-level paste events to 0%, 25%, and 100%', () => {
      // 0% paste
      const session0 = {
        id: 's0',
        studentId: 'stu-p0',
        type: 'low_stakes',
        date: '2026-08-01T00:00:00Z',
        features: [
          { pasteDetected: false },
          { pasteDetected: false },
          { pasteDetected: false },
          { pasteDetected: false },
        ],
      };
      const model0 = buildBehavioralModel('stu-p0', [session0]);
      expect(model0.expectations.find((e) => e.feature === 'pasteDetected')?.mean).toBe(0);

      // 25% paste (1 of 4)
      const session25 = {
        id: 's25',
        studentId: 'stu-p25',
        type: 'low_stakes',
        date: '2026-08-01T00:00:00Z',
        features: [
          { pasteDetected: true },
          { pasteDetected: false },
          { pasteDetected: false },
          { pasteDetected: false },
        ],
      };
      const model25 = buildBehavioralModel('stu-p25', [session25]);
      expect(model25.expectations.find((e) => e.feature === 'pasteDetected')?.mean).toBe(25);

      // 100% paste (4 of 4)
      const session100 = {
        id: 's100',
        studentId: 'stu-p100',
        type: 'low_stakes',
        date: '2026-08-01T00:00:00Z',
        features: [
          { pasteDetected: true },
          { pasteDetected: true },
          { pasteDetected: true },
          { pasteDetected: true },
        ],
      };
      const model100 = buildBehavioralModel('stu-p100', [session100]);
      expect(model100.expectations.find((e) => e.feature === 'pasteDetected')?.mean).toBe(100);
    });
  });

  // ─── 5. P0: Shrinkage Intensity Fallbacks & Matrix Inversion ──────────────
  describe('5. Shrinkage Intensity Fallbacks & Inversion Status', () => {
    it('applies exact fallback intensities at n<=1, n=2, n=3-4, and n>4', () => {
      const means = [10, 1, 100, 200, 0];
      const stdDevs = [2, 0.5, 20, 40, 5];
      const dummyR = Array.from({ length: 5 }, (_, i) =>
        Array.from({ length: 5 }, (_, j) => (i === j ? 1 : 0.2))
      );

      // n <= 1 -> lambda = 1.0 (pure identity)
      const obs1 = [[10, 1, 100, 200, 0]];
      expect(computeShrinkageIntensity(dummyR, obs1, means, stdDevs)).toBe(1.0);

      // n = 2 -> lambda = 0.8
      const obs2 = [
        [10, 1, 100, 200, 0],
        [12, 2, 110, 220, 0],
      ];
      expect(computeShrinkageIntensity(dummyR, obs2, means, stdDevs)).toBe(0.8);

      // n = 4 -> lambda = 0.5
      const obs4 = [
        [10, 1, 100, 200, 0],
        [12, 2, 110, 220, 0],
        [11, 1, 105, 210, 0],
        [13, 2, 115, 230, 0],
      ];
      expect(computeShrinkageIntensity(dummyR, obs4, means, stdDevs)).toBe(0.5);

      // n = 6 -> estimated lambda between 0 and 1
      const obs6 = [
        [10, 1, 100, 200, 0],
        [12, 2, 110, 220, 0],
        [11, 1, 105, 210, 0],
        [13, 2, 115, 230, 0],
        [9, 1, 95, 190, 0],
        [14, 2, 120, 240, 0],
      ];
      const lambda6 = computeShrinkageIntensity(dummyR, obs6, means, stdDevs);
      expect(lambda6).toBeGreaterThanOrEqual(0);
      expect(lambda6).toBeLessThanOrEqual(1);

      // Check regularization and inversion
      const { inverseCorrelation, regularizedCorrelation } = regularizeAndInvertCorrelation(dummyR, lambda6);
      expect(regularizedCorrelation.length).toBe(5);
      expect(inverseCorrelation.length).toBe(5);
      expect(inverseCorrelation[0][0]).toBeGreaterThan(0);
      expect(inverseCorrelation.every((row) => row.every((v) => isFinite(v) && !isNaN(v)))).toBe(true);
    });
  });

  // ─── 6. P0: Multimodal Timestamp-Window Matching ──────────────────────────
  describe('6. Multimodal Fusion Explicit Timestamp Window', () => {
    it('associates only in-window event pairs and ignores out-of-window events', () => {
      const baseTime = new Date('2026-08-01T10:00:00Z').getTime();

      // Look-away at t=10s
      const cameraEvents = [
        {
          id: 'cam_1',
          eventType: 'look_away' as const,
          timestamp: new Date(baseTime + 10000).toISOString(),
          direction: 'right' as const,
        },
      ];

      // Event 1: inside window (offset = 2s <= 5s)
      // Event 2: outside window (offset = 25s > 5s)
      const actionEvents = [
        { id: 'act_in', timestamp: new Date(baseTime + 12000).toISOString(), label: 'paste_attempt' },
        { id: 'act_out', timestamp: new Date(baseTime + 35000).toISOString(), label: 'paste_attempt' },
      ];

      const matches = matchTemporalEventWindow(cameraEvents, actionEvents, 5000);
      expect(matches.length).toBe(1);
      expect(matches[0].eventB.id).toBe('act_in');
      expect(matches[0].deltaSec).toBe(2.0);
    });

    it('generates explicit temporal window explanation when in-window correlation is detected', () => {
      const baseTime = new Date('2026-08-01T10:00:00Z').getTime();

      const result = fuseMultimodalEvidence({
        sessionId: 'test_session',
        studentId: 'stu_1',
        deviationScore: 45.0,
        personalizedThreshold: 2.5,
        cameraEvents: [
          {
            id: 'cam_la',
            eventType: 'look_away',
            timestamp: new Date(baseTime + 10000).toISOString(),
            direction: 'right',
            durationMs: 3500,
            severity: 'prolonged',
            occurrenceIndex: 1,
            isIsolated: false,
            contextSummary: 'Approximate look-away indication',
          },
        ],
        integrityEvents: [
          {
            id: 'int_paste',
            eventType: 'paste_attempt',
            timestamp: new Date(baseTime + 12500).toISOString(),
            contextSummary: 'Paste detected',
            isIsolated: false,
            occurrenceIndex: 1,
          },
        ],
        cameraSummary: {
          overallCameraStatus: 'active',
          facePresencePercentage: 90,
          totalAbsenceDurationSec: 0,
          totalLookAwayEvents: 1,
          briefLookAwayCount: 0,
          prolongedLookAwayCount: 1,
          repeatedLookAwayCount: 0,
          multiplePersonEventCount: 0,
          cameraInterruptionCount: 0,
          lookAwayDirectionCounts: { forward: 0, left: 0, right: 1, up: 0, down: 0, uncertain: 0 },
          isCameraActive: true,
        },
      });

      const corrPattern = result.correlationPatterns.find((p) => p.patternType === 'correlated_anomaly');
      expect(corrPattern).toBeDefined();
      expect(corrPattern?.explanation).toContain('Temporal correlation confirmed within Δ=5.0s window');
    });

    it('generates aggregate co-occurrence explanation when timestamps are not in-window', () => {
      const result = fuseMultimodalEvidence({
        sessionId: 'test_session_agg',
        studentId: 'stu_1',
        deviationScore: 45.0,
        personalizedThreshold: 2.5,
        interactions: [
          {
            recordId: 'rec_1',
            studentId: 'stu_1',
            sessionId: 'test_session_agg',
            questionId: 'q1',
            sessionPosition: 1,
            questionType: 'mcq',
            questionDifficulty: 0.5,
            responseTimeSec: 20,
            selectedAnswerIndex: 0,
            answerRevisionCount: 0,
            answerRevisionTimeSec: 0,
            pointerDistancePx: 50,
            pointerAvgSpeedPxS: 20,
            scrollDistancePx: 0,
            scrollEvents: 0,
            pasteDetected: 1,
            characterBurstFlag: 0,
            deviceType: 'desktop',
            timeOfDay: 'morning',
            timestamp: '2026-08-01T10:00:00Z',
            isAnswerCorrect: true,
          },
        ],
        cameraSummary: {
          overallCameraStatus: 'active',
          facePresencePercentage: 85,
          totalAbsenceDurationSec: 0,
          totalLookAwayEvents: 3,
          briefLookAwayCount: 0,
          prolongedLookAwayCount: 2,
          repeatedLookAwayCount: 1,
          multiplePersonEventCount: 0,
          cameraInterruptionCount: 0,
          lookAwayDirectionCounts: { forward: 0, left: 0, right: 3, up: 0, down: 0, uncertain: 0 },
          isCameraActive: true,
        },
      });

      const corrPattern = result.correlationPatterns.find((p) => p.patternType === 'correlated_anomaly');
      expect(corrPattern).toBeDefined();
      expect(corrPattern?.explanation).toContain('Co-occurring aggregate rule-based association');
    });
  });

  // ─── 7. P0: Camera Uncertainty & Heuristic Event Labels ───────────────────
  describe('7. Camera Proctoring Uncertainty & Event Labels', () => {
    it('returns detection_uncertain when detector confidence is below 0.35', () => {
      expect(evaluateFacePresence(1, 0.2)).toBe('detection_uncertain');
      expect(evaluateFacePresence(0, 0.2)).toBe('detection_uncertain');
      expect(evaluateFacePresence(1, 0.8)).toBe('face_present');
      expect(evaluateFacePresence(0, 0.8)).toBe('face_missing');
    });

    it('estimates observable look-away direction without claiming eye gaze', () => {
      expect(estimateLookAwayDirection(0.05, 0.05)).toBe('forward');
      expect(estimateLookAwayDirection(0.45, 0.05)).toBe('right');
      expect(estimateLookAwayDirection(-0.45, 0.05)).toBe('left');
    });
  });

  // ─── 8. P0: Cryptographic Single-Payload SHA-256 Commitment ───────────────
  describe('8. Cryptographic Single-Payload SHA-256 Commitment', () => {
    it('verifies untampered payload commitment and fails on any modification', async () => {
      const session = createMockSession('ses_crypto', 'stu_crypto', 'graded_examination', 'normal', {
        responseTime: 25,
        revisionCount: 2,
        pointerMovement: 150,
        scrollDistance: 300,
        pasteDetected: 0,
      }) as BehavioralSession;

      const payload = buildCanonicalPayload(session);
      const commitment = await generateSessionCommitment(payload);

      expect(commitment.algorithm).toBe('SHA-256');
      expect(commitment.hash.length).toBe(64); // SHA-256 hex length

      // Verification of pristine payload succeeds
      const isValid = await verifySessionCommitment(payload, commitment.hash);
      expect(isValid).toBe(true);

      // Tampered payload fails
      const tamperedPayload = payload.replace('"responseTime":25', '"responseTime":5');
      const isTamperedValid = await verifySessionCommitment(tamperedPayload, commitment.hash);
      expect(isTamperedValid).toBe(false);
    });
  });
});
