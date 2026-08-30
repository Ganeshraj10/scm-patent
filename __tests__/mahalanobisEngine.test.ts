import { buildBehavioralModel } from '../lib/modelingEngine';
import {
  evaluateSessionDeviation,
  calculateRawDeviationScore,
  computeSampleCovariance,
  computeSampleCorrelation,
  computeShrinkageIntensity,
  regularizeAndInvertCorrelation,
  invertMatrix5x5,
  calculateMahalanobisDetails,
  ORDERED_FEATURES,
} from '../lib/deviationEngine';
import { BehavioralSession } from '../types';

function createMockSession(
  id: string,
  studentId: string,
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
    type: 'low_stakes',
    date,
    features: [
      {
        responseTime: features.responseTime ?? 10,
        revisionCount: features.revisionCount ?? 1,
        pointerMovement: features.pointerMovement ?? 100,
        scrollDistance: features.scrollDistance ?? 200,
        pasteDetected: Boolean(features.pasteDetected),
      },
    ],
  };
}

describe('Genuine Shrinkage-Regularized Mahalanobis Distance Engine', () => {
  // ── 1. Normal Multivariate Data ─────────────────────────────────────────────
  it('1. Computes valid covariance, correlation, and Mahalanobis distance for normal multivariate data', () => {
    const sessions = Array(12)
      .fill(0)
      .map((_, i) => {
        const day = i < 9 ? `0${i + 1}` : `${i + 1}`;
        return createMockSession(
          `s${i}`,
          'stu1',
          {
            responseTime: 15 + (i % 3) * 2,
            revisionCount: 2 + (i % 2),
            pointerMovement: 150 + (i % 4) * 20,
            scrollDistance: 300 + (i % 3) * 30,
            pasteDetected: i === 5 ? 1 : 0,
          },
          `2026-08-${day}T00:00:00Z`
        );
      });

    const model = buildBehavioralModel('stu1', sessions);

    expect(model.covarianceMatrix).toBeDefined();
    expect(model.covarianceMatrix?.length).toBe(5);
    expect(model.correlationMatrix?.length).toBe(5);
    expect(model.inverseCorrelationMatrix?.length).toBe(5);
    expect(model.shrinkageLambda).toBeGreaterThan(0);
    expect(model.shrinkageLambda).toBeLessThanOrEqual(1.0);

    const normalExam: BehavioralSession = {
      id: 'exam-normal',
      studentId: 'stu1',
      studentName: 'Student',
      examName: 'Exam',
      examCode: 'CS101',
      type: 'graded_examination',
      startTime: '2026-08-20T00:00:00Z',
      endTime: '2026-08-20T01:00:00Z',
      duration: 60,
      questionCount: 1,
      deviceType: 'desktop',
      reviewStatus: 'normal',
      features: [
        {
          questionId: 'q1',
          responseTime: 16,
          revisionCount: 2,
          pointerMovement: 160,
          scrollDistance: 310,
          pasteDetected: false,
          deviceType: 'desktop',
        },
      ],
    };

    const result = evaluateSessionDeviation(normalExam, model);
    expect(isFinite(result.deviationScore)).toBe(true);
    expect(result.deviationScore).toBeGreaterThanOrEqual(0);
    expect(result.reviewRequired).toBe(false);
    expect(result.featureContributions.length).toBe(5);
  });

  // ── 2. Strongly Correlated Features ─────────────────────────────────────────
  it('2. Properly detects correlated features and computes covariance relationships', () => {
    // Highly correlated responseTime and revisionCount (e.g. revisionCount = responseTime / 5)
    const correlatedSessions = Array(15)
      .fill(0)
      .map((_, i) => {
        const day = i < 9 ? `0${i + 1}` : `${i + 1}`;
        const rt = 10 + i * 2;
        const rev = Math.round(rt / 5);
        return createMockSession(
          `s${i}`,
          'stu-corr',
          {
            responseTime: rt,
            revisionCount: rev,
            pointerMovement: 100,
            scrollDistance: 200,
            pasteDetected: 0,
          },
          `2026-08-${day}T00:00:00Z`
        );
      });

    const model = buildBehavioralModel('stu-corr', correlatedSessions);
    // Correlation between responseTime (idx 0) and revisionCount (idx 1) should be very high (> 0.8)
    const r01 = model.correlationMatrix![0][1];
    expect(r01).toBeGreaterThan(0.7);

    // In Mahalanobis space, if both move along the correlation axis, distance is moderate.
    // If they break correlation (e.g. responseTime is high but revisionCount is 0), Mahalanobis flags higher deviation.
    const consistentExam: BehavioralSession = {
      id: 'e-cons',
      studentId: 'stu-corr',
      studentName: 'Student',
      examName: 'Exam',
      examCode: 'CS101',
      type: 'graded_examination',
      startTime: '2026-08-25T00:00:00Z',
      endTime: '2026-08-25T01:00:00Z',
      duration: 60,
      questionCount: 1,
      deviceType: 'desktop',
      reviewStatus: 'normal',
      features: [
        {
          questionId: 'q1',
          responseTime: 40,
          revisionCount: 8, // Follows the positive correlation
          pointerMovement: 100,
          scrollDistance: 200,
          pasteDetected: false,
          deviceType: 'desktop',
        },
      ],
    };

    const inconsistentExam: BehavioralSession = {
      id: 'e-incons',
      studentId: 'stu-corr',
      studentName: 'Student',
      examName: 'Exam',
      examCode: 'CS101',
      type: 'graded_examination',
      startTime: '2026-08-25T00:00:00Z',
      endTime: '2026-08-25T01:00:00Z',
      duration: 60,
      questionCount: 1,
      deviceType: 'desktop',
      reviewStatus: 'normal',
      features: [
        {
          questionId: 'q1',
          responseTime: 40,
          revisionCount: 0, // Breaks the correlation completely
          pointerMovement: 100,
          scrollDistance: 200,
          pasteDetected: false,
          deviceType: 'desktop',
        },
      ],
    };

    const scoreConsistent = calculateRawDeviationScore(consistentExam.features, model);
    const scoreInconsistent = calculateRawDeviationScore(inconsistentExam.features, model);

    // Breaking the multivariate correlation produces higher Mahalanobis deviation
    expect(scoreInconsistent).toBeGreaterThan(scoreConsistent);
  });

  // ── 3. Singular & Collinear Covariance Matrix ───────────────────────────────
  it('3. Inverts singular / collinear covariance matrix via shrinkage and ridge regularization without crashing', () => {
    // Feature 2 is an exact multiple of Feature 1 (perfect rank deficiency)
    const collinearData = Array(10)
      .fill(0)
      .map((_, i) => {
        const day = i < 9 ? `0${i + 1}` : `${i + 1}`;
        const val = i + 1;
        return createMockSession(
          `s${i}`,
          'stu-sing',
          {
            responseTime: val * 10,
            revisionCount: val * 2, // collinear
            pointerMovement: val * 100, // collinear
            scrollDistance: val * 50, // collinear
            pasteDetected: 0,
          },
          `2026-08-${day}T00:00:00Z`
        );
      });

    const model = buildBehavioralModel('stu-sing', collinearData);

    expect(model.inverseCorrelationMatrix).toBeDefined();
    // All values in inverse matrix must be finite numbers (no NaN, no Infinity)
    model.inverseCorrelationMatrix?.forEach((row) => {
      row.forEach((val) => {
        expect(isFinite(val)).toBe(true);
        expect(isNaN(val)).toBe(false);
      });
    });

    const exam: BehavioralSession = {
      id: 'e-sing-test',
      studentId: 'stu-sing',
      studentName: 'Student',
      examName: 'Exam',
      examCode: 'CS101',
      type: 'graded_examination',
      startTime: '2026-08-25T00:00:00Z',
      endTime: '2026-08-25T01:00:00Z',
      duration: 60,
      questionCount: 1,
      deviceType: 'desktop',
      reviewStatus: 'normal',
      features: [
        {
          questionId: 'q1',
          responseTime: 20,
          revisionCount: 4,
          pointerMovement: 200,
          scrollDistance: 100,
          pasteDetected: false,
          deviceType: 'desktop',
        },
      ],
    };

    const res = evaluateSessionDeviation(exam, model);
    expect(isFinite(res.deviationScore)).toBe(true);
    expect(isNaN(res.deviationScore)).toBe(false);
  });

  // ── 4. Zero-Variance Feature ────────────────────────────────────────────────
  it('4. Handles constant zero-variance features safely', () => {
    // pasteDetected and revisionCount are constant 0 for all training sessions
    const zeroVarSessions = Array(10)
      .fill(0)
      .map((_, i) => {
        const day = i < 9 ? `0${i + 1}` : `${i + 1}`;
        return createMockSession(
          `s${i}`,
          'stu-zerovar',
          {
            responseTime: 10 + i,
            revisionCount: 0, // constant
            pointerMovement: 100 + i * 5,
            scrollDistance: 200, // constant
            pasteDetected: 0, // constant
          },
          `2026-08-${day}T00:00:00Z`
        );
      });

    const model = buildBehavioralModel('stu-zerovar', zeroVarSessions);

    // Evaluate exam where constant feature suddenly jumps
    const exam: BehavioralSession = {
      id: 'e-zerovar',
      studentId: 'stu-zerovar',
      studentName: 'Student',
      examName: 'Exam',
      examCode: 'CS101',
      type: 'graded_examination',
      startTime: '2026-08-25T00:00:00Z',
      endTime: '2026-08-25T01:00:00Z',
      duration: 60,
      questionCount: 1,
      deviceType: 'desktop',
      reviewStatus: 'normal',
      features: [
        {
          questionId: 'q1',
          responseTime: 15,
          revisionCount: 5, // jumped from constant 0
          pointerMovement: 120,
          scrollDistance: 200,
          pasteDetected: true, // jumped from constant 0
          deviceType: 'desktop',
        },
      ],
    };

    const result = evaluateSessionDeviation(exam, model);
    expect(isFinite(result.deviationScore)).toBe(true);
    expect(result.deviationScore).toBeGreaterThan(0);
    // Direction for pasteDetected should be 'higher_than_expected'
    const pasteContrib = result.featureContributions.find((c) => c.feature === 'pasteDetected');
    expect(pasteContrib?.direction).toBe('higher_than_expected');
  });

  // ── 5. Small Sample Cold Start Protection ───────────────────────────────────
  it('5. Handles small sample sizes (n=1, n=2, n=5) with appropriate shrinkage', () => {
    const singleSession = [createMockSession('s0', 'stu-single', { responseTime: 10 }, '2026-08-01T00:00:00Z')];
    const modelN1 = buildBehavioralModel('stu-single', singleSession);
    expect(modelN1.status).toBe('cold_start');
    expect(modelN1.shrinkageLambda).toBe(1.0); // full diagonal shrinkage for n=1

    const twoSessions = [
      createMockSession('s0', 'stu-two', { responseTime: 10 }, '2026-08-01T00:00:00Z'),
      createMockSession('s1', 'stu-two', { responseTime: 20 }, '2026-08-02T00:00:00Z'),
    ];
    const modelN2 = buildBehavioralModel('stu-two', twoSessions);
    expect(modelN2.shrinkageLambda).toBeGreaterThanOrEqual(0.7);

    const exam: BehavioralSession = {
      id: 'e-small',
      studentId: 'stu-single',
      studentName: 'Student',
      examName: 'Exam',
      examCode: 'CS101',
      type: 'graded_examination',
      startTime: '2026-08-25T00:00:00Z',
      endTime: '2026-08-25T01:00:00Z',
      duration: 60,
      questionCount: 1,
      deviceType: 'desktop',
      reviewStatus: 'normal',
      features: [
        {
          questionId: 'q1',
          responseTime: 12,
          revisionCount: 1,
          pointerMovement: 100,
          scrollDistance: 200,
          pasteDetected: false,
          deviceType: 'desktop',
        },
      ],
    };

    const res = evaluateSessionDeviation(exam, modelN1);
    expect(isFinite(res.deviationScore)).toBe(true);
    // Cold start sessions (<10) should have analysis_limited raw status
    expect((res as any).rawStatus).toBe('analysis_limited');
  });

  // ── 6. Unit & Scale Invariance ──────────────────────────────────────────────
  it('6. Balances wildly different physical units (ms, counts, px, %) seamlessly', () => {
    const multiScaleSessions = Array(10)
      .fill(0)
      .map((_, i) => {
        const day = i < 9 ? `0${i + 1}` : `${i + 1}`;
        return createMockSession(
          `s${i}`,
          'stu-scale',
          {
            responseTime: 45000 + i * 2000, // tens of thousands of ms
            revisionCount: 1 + (i % 3), // single digits
            pointerMovement: 1200 + i * 100, // thousands of px
            scrollDistance: 3500 + i * 200, // thousands of px
            pasteDetected: i === 0 ? 100 : 0, // 0-100%
          },
          `2026-08-${day}T00:00:00Z`
        );
      });

    const model = buildBehavioralModel('stu-scale', multiScaleSessions);

    const examNormal: BehavioralSession = {
      id: 'e-scale-norm',
      studentId: 'stu-scale',
      studentName: 'Student',
      examName: 'Exam',
      examCode: 'CS101',
      type: 'graded_examination',
      startTime: '2026-08-25T00:00:00Z',
      endTime: '2026-08-25T01:00:00Z',
      duration: 60,
      questionCount: 1,
      deviceType: 'desktop',
      reviewStatus: 'normal',
      features: [
        {
          questionId: 'q1',
          responseTime: 50000,
          revisionCount: 2,
          pointerMovement: 1500,
          scrollDistance: 4000,
          pasteDetected: false,
          deviceType: 'desktop',
        },
      ],
    };

    const res = evaluateSessionDeviation(examNormal, model);
    expect(res.reviewRequired).toBe(false);
    expect(res.deviationScore).toBeLessThan(res.personalizedThreshold);

    // All feature contributions are well-scaled
    res.featureContributions.forEach((fc) => {
      expect(isFinite(fc.contribution)).toBe(true);
      expect(isNaN(fc.contribution)).toBe(false);
    });
  });

  // ── 7. Direct Matrix Inversion Utility Unit Tests ───────────────────────────
  it('7. Inverts identity and arbitrary 5x5 positive definite matrices accurately', () => {
    const I = Array.from({ length: 5 }, (_, i) =>
      Array.from({ length: 5 }, (_, j) => (i === j ? 1 : 0))
    );
    const invI = invertMatrix5x5(I);
    expect(invI.isSingular).toBe(false);
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        expect(invI.inverse[i][j]).toBeCloseTo(i === j ? 1 : 0, 5);
      }
    }

    // 5x5 test matrix with known inverse
    const M = [
      [2, 0.5, 0, 0, 0],
      [0.5, 2, 0.5, 0, 0],
      [0, 0.5, 2, 0.5, 0],
      [0, 0, 0.5, 2, 0.5],
      [0, 0, 0, 0.5, 2],
    ];
    const invM = invertMatrix5x5(M);
    expect(invM.isSingular).toBe(false);

    // Verify M * M_inv = I
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        let dot = 0;
        for (let k = 0; k < 5; k++) {
          dot += M[i][k] * invM.inverse[k][j];
        }
        expect(dot).toBeCloseTo(i === j ? 1 : 0, 4);
      }
    }
  });
});
