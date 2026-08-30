import { buildBehavioralModel } from '../lib/modelingEngine';
import {
  evaluateSessionDeviation,
  calculateRawDeviationScore,
} from '../lib/deviationEngine';
import { BehavioralModel, BehavioralSession } from '../types';

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
        responseTime: features.responseTime ?? 15,
        revisionCount: features.revisionCount ?? 2,
        pointerMovement: features.pointerMovement ?? 150,
        scrollDistance: features.scrollDistance ?? 300,
        pasteDetected: Boolean(features.pasteDetected),
      },
    ],
  };
}

/**
 * Simulates mapping the database row returned by Supabase back into the domain BehavioralModel.
 * Mirrors mapModelFromApi in lib/services/behavioralModels.ts.
 */
function simulateSupabaseRetrieval(dbRow: any): BehavioralModel {
  const exps = (dbRow.feature_expectations ?? []).map((e: any) => ({
    feature: e.feature_name,
    label: e.feature_name,
    unit: '',
    mean: Number(e.expected_value),
    stdDev: Number(e.standard_deviation),
    min: Number(e.lower_bound),
    max: Number(e.upper_bound),
  }));

  const uncs = (dbRow.feature_expectations ?? []).map((e: any) => ({
    feature: e.feature_name,
    uncertainty: Number(e.uncertainty),
    sampleSize: dbRow.session_count,
  }));

  const mp = dbRow.mahalanobis_parameters;

  return {
    studentId: dbRow.student_id,
    status: dbRow.model_status,
    sessionCount: dbRow.session_count,
    minimumSessionsRequired: 10,
    confidence: Number(dbRow.confidence),
    lastUpdated: dbRow.updated_at,
    expectations: exps,
    uncertainties: uncs,
    calibratedThreshold: dbRow.calibrated_threshold ? Number(dbRow.calibrated_threshold) : undefined,
    covarianceMatrix: mp?.covariance_matrix ?? undefined,
    correlationMatrix: mp?.correlation_matrix ?? undefined,
    inverseCorrelationMatrix: mp?.inverse_correlation_matrix ?? undefined,
    shrinkageLambda: mp?.shrinkage_lambda ? Number(mp.shrinkage_lambda) : undefined,
    featureOrder: mp?.feature_order ?? undefined,
  };
}

/**
 * Simulates storing a BehavioralModel in the Supabase database via the persistence payload.
 * Mirrors saveBehavioralModel in lib/services/behavioralModels.ts.
 */
function simulateSupabaseStorage(studentId: string, model: BehavioralModel): any {
  return {
    student_id: studentId,
    device_type: 'desktop',
    session_count: model.sessionCount,
    model_status: model.status,
    confidence: model.confidence,
    calibrated_threshold: model.calibratedThreshold ?? null,
    target_false_positive_rate: 0.05,
    training_session_count: model.sessionCount,
    calibration_session_count: model.sessionCount,
    updated_at: model.lastUpdated,
    feature_expectations: model.expectations.map((e) => {
      const uncertainty = model.uncertainties.find((u) => u.feature === e.feature)?.uncertainty ?? 0;
      return {
        feature_name: e.feature,
        expected_value: e.mean,
        uncertainty,
        variance: Math.pow(e.stdDev, 2),
        standard_deviation: e.stdDev,
        lower_bound: e.min,
        upper_bound: e.max,
      };
    }),
    mahalanobis_parameters: {
      feature_order: model.featureOrder ?? [
        'responseTime',
        'revisionCount',
        'pointerMovement',
        'scrollDistance',
        'pasteDetected',
      ],
      covariance_matrix: model.covarianceMatrix ?? null,
      correlation_matrix: model.correlationMatrix ?? null,
      inverse_correlation_matrix: model.inverseCorrelationMatrix ?? null,
      shrinkage_lambda: model.shrinkageLambda ?? null,
    },
  };
}

describe('Mahalanobis Model Supabase Persistence Round-Trip', () => {
  it('1. Perfectly reproduces Mahalanobis score and conformal threshold after simulated persistence and retrieval', () => {
    // 1. Generate 14 historical sessions with non-trivial correlations
    const sessions = Array(14)
      .fill(0)
      .map((_, i) => {
        const day = i < 9 ? `0${i + 1}` : `${i + 1}`;
        const rt = 20 + (i % 4) * 3;
        const rev = 1 + Math.floor(rt / 10);
        const ptr = 120 + (i % 3) * 25;
        const scr = 250 + (i % 5) * 40;
        const paste = i === 7 ? 1 : 0;

        return createMockSession(
          `s${i}`,
          'stu-persist',
          {
            responseTime: rt,
            revisionCount: rev,
            pointerMovement: ptr,
            scrollDistance: scr,
            pasteDetected: paste,
          },
          `2026-08-${day}T00:00:00Z`
        );
      });

    // 2. Build initial model
    const originalModel = buildBehavioralModel('stu-persist', sessions);
    expect(originalModel.status).toBe('active');
    expect(originalModel.calibratedThreshold).toBeDefined();
    expect(originalModel.covarianceMatrix).toBeDefined();
    expect(originalModel.inverseCorrelationMatrix).toBeDefined();

    // 3. Define a realistic exam session observation
    const testExam: BehavioralSession = {
      id: 'exam-persist-test',
      studentId: 'stu-persist',
      studentName: 'Persistence Student',
      examName: 'Final Exam',
      examCode: 'CS301',
      type: 'graded_examination',
      startTime: '2026-08-28T00:00:00Z',
      endTime: '2026-08-28T01:30:00Z',
      duration: 90,
      questionCount: 3,
      deviceType: 'desktop',
      reviewStatus: 'normal',
      features: [
        {
          questionId: 'q1',
          responseTime: 35,
          revisionCount: 4,
          pointerMovement: 220,
          scrollDistance: 450,
          pasteDetected: false,
          deviceType: 'desktop',
        },
        {
          questionId: 'q2',
          responseTime: 28,
          revisionCount: 3,
          pointerMovement: 180,
          scrollDistance: 380,
          pasteDetected: false,
          deviceType: 'desktop',
        },
        {
          questionId: 'q3',
          responseTime: 22,
          revisionCount: 2,
          pointerMovement: 140,
          scrollDistance: 290,
          pasteDetected: false,
          deviceType: 'desktop',
        },
      ],
    };

    // 4. Calculate deviation with original model
    const originalAnalysis = evaluateSessionDeviation(testExam, originalModel);

    // 5. Persist to DB representation
    const dbPayload = simulateSupabaseStorage('stu-persist', originalModel);

    // 6. Retrieve from DB representation
    const retrievedModel = simulateSupabaseRetrieval(dbPayload);

    // 7. Calculate deviation with retrieved model
    const retrievedAnalysis = evaluateSessionDeviation(testExam, retrievedModel);

    // ── Assertions ────────────────────────────────────────────────────────────

    // A. Mahalanobis deviation score matches within 1e-6
    expect(retrievedAnalysis.deviationScore).toBeCloseTo(originalAnalysis.deviationScore, 6);

    // B. Calibrated threshold survives
    expect(retrievedModel.calibratedThreshold).toBeCloseTo(originalModel.calibratedThreshold!, 6);
    expect(retrievedAnalysis.personalizedThreshold).toBeCloseTo(originalAnalysis.personalizedThreshold, 6);

    // C. Decision status survives
    expect(retrievedAnalysis.reviewRequired).toBe(originalAnalysis.reviewRequired);

    // D. Matrices survive exactly
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        expect(retrievedModel.covarianceMatrix![r][c]).toBeCloseTo(originalModel.covarianceMatrix![r][c], 6);
        expect(retrievedModel.correlationMatrix![r][c]).toBeCloseTo(originalModel.correlationMatrix![r][c], 6);
        expect(retrievedModel.inverseCorrelationMatrix![r][c]).toBeCloseTo(originalModel.inverseCorrelationMatrix![r][c], 6);
      }
    }

    // E. Shrinkage lambda survives
    expect(retrievedModel.shrinkageLambda).toBeCloseTo(originalModel.shrinkageLambda!, 6);

    // F. Feature contributions match
    expect(retrievedAnalysis.featureContributions.length).toBe(originalAnalysis.featureContributions.length);
    originalAnalysis.featureContributions.forEach((fcOrig, idx) => {
      const fcRet = retrievedAnalysis.featureContributions[idx];
      expect(fcRet.feature).toBe(fcOrig.feature);
      expect(fcRet.contribution).toBeCloseTo(fcOrig.contribution, 6);
      expect(fcRet.observed).toBeCloseTo(fcOrig.observed, 6);
      expect(fcRet.expected).toBeCloseTo(fcOrig.expected, 6);
      expect(fcRet.direction).toBe(fcOrig.direction);
    });
  });

  it('2. Gracefully handles legacy database models without mahalanobis_parameters without crashing', () => {
    // Simulate a model row stored before migration 15 (mahalanobis_parameters is undefined/null)
    const legacyDbRow = {
      student_id: 'stu-legacy',
      device_type: 'desktop',
      session_count: 10,
      model_status: 'active',
      confidence: 85,
      calibrated_threshold: 2.35,
      mahalanobis_parameters: null, // Legacy row
      feature_expectations: [
        { feature_name: 'responseTime', expected_value: 20, standard_deviation: 4, lower_bound: 10, upper_bound: 30 },
        { feature_name: 'revisionCount', expected_value: 2, standard_deviation: 1, lower_bound: 0, upper_bound: 4 },
        { feature_name: 'pointerMovement', expected_value: 150, standard_deviation: 30, lower_bound: 80, upper_bound: 220 },
        { feature_name: 'scrollDistance', expected_value: 300, standard_deviation: 50, lower_bound: 150, upper_bound: 450 },
        { feature_name: 'pasteDetected', expected_value: 0, standard_deviation: 5, lower_bound: 0, upper_bound: 100 },
      ],
    };

    const model = simulateSupabaseRetrieval(legacyDbRow);
    expect(model.inverseCorrelationMatrix).toBeUndefined();

    const testExam: BehavioralSession = {
      id: 'e-legacy',
      studentId: 'stu-legacy',
      studentName: 'Legacy Student',
      examName: 'Exam',
      examCode: 'CS101',
      type: 'graded_examination',
      startTime: '2026-08-28T00:00:00Z',
      endTime: '2026-08-28T01:00:00Z',
      duration: 60,
      questionCount: 1,
      deviceType: 'desktop',
      reviewStatus: 'normal',
      features: [
        {
          questionId: 'q1',
          responseTime: 22,
          revisionCount: 2,
          pointerMovement: 155,
          scrollDistance: 310,
          pasteDetected: false,
          deviceType: 'desktop',
        },
      ],
    };

    const res = evaluateSessionDeviation(testExam, model);
    expect(isFinite(res.deviationScore)).toBe(true);
    expect(isNaN(res.deviationScore)).toBe(false);
    expect(res.reviewRequired).toBe(false);
  });
});
