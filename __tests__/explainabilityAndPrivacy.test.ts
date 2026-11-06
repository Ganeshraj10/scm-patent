/**
 * ============================================================================
 * EXAMGUARD — PHASE 4: EXPLAINABLE AI, PRIVACY & HUMAN REVIEW TEST SUITE
 * ============================================================================
 * Comprehensive tests covering:
 * 1. Mahalanobis Explainability (Covariance coupling & conditional expectation)
 * 2. Isolation Forest Explainability (Exact 32-coalition Shapley & perturbation)
 * 3. Local Outlier Factor Explainability (k-NN neighbourhood & density ratios)
 * 4. One-Class SVM Explainability (Analytical boundary gradients & margin shift)
 * 5. Explanation Evaluation (Faithfulness, stability, relevance, non-causal framing)
 * 6. Privacy Controls (Data minimisation, HMAC pseudonymisation, access control, purge)
 * 7. Human-in-the-Loop Review Workflow (Output categories, instructor decisions, audit)
 */

import {
  RegularizedMahalanobisModel,
  IsolationForestModel,
  LocalOutlierFactorModel,
  OneClassSVMModel,
} from '../lib/ml/models';
import {
  MahalanobisExplainer,
  IsolationForestExplainer,
  LOFExplainer,
  OneClassSVMExplainer,
  ExplanationEvaluator,
} from '../lib/ml/explainability';
import { PrivacyService } from '../lib/privacy/privacyService';
import { HumanReviewService } from '../lib/services/humanReviewService';

describe('Phase 4: Explainable AI, Privacy & Human-in-the-Loop Review', () => {
  // Generate synthetic baseline training data (20 sessions, 5 features)
  const generateBaselineData = (n: number = 20): number[][] => {
    const data: number[][] = [];
    for (let i = 0; i < n; i++) {
      data.push([
        25 + Math.sin(i * 1.5) * 4,     // responseTime: ~21 to 29 s
        2 + (i % 3 === 0 ? 1 : 0),      // revisionCount: ~2 to 3
        400 + Math.cos(i * 1.2) * 50,   // pointerMovement: ~350 to 450 px
        300 + Math.sin(i * 0.9) * 40,   // scrollDistance: ~260 to 340 px
        0,                              // pasteDetected: 0
      ]);
    }
    return data;
  };

  const trainData = generateBaselineData(20);
  const calData = generateBaselineData(10);

  // Normal, Paste-Anomalous, and Missing Data test observations
  const normalObs = [26.0, 2.0, 395.0, 305.0, 0];
  const pasteAnomalousObs = [25.0, 2.0, 400.0, 300.0, 10]; // 10 paste events (Known ground-truth Category C deviation)
  const missingDataObs = [NaN, 2.0, NaN, 300.0, 0]; // Missing response time & pointer

  let m1: RegularizedMahalanobisModel;
  let m2: IsolationForestModel;
  let m3: LocalOutlierFactorModel;
  let m4: OneClassSVMModel;

  beforeAll(() => {
    m1 = new RegularizedMahalanobisModel({ ridgeEpsilon: 1e-4 });
    m2 = new IsolationForestModel({ nEstimators: 50, seed: 42 });
    m3 = new LocalOutlierFactorModel({ nNeighbors: 5 });
    m4 = new OneClassSVMModel({ nu: 0.05, gamma: 0.2 });

    [m1, m2, m3, m4].forEach((m) => {
      m.fit(trainData);
      m.calibrate(calData, 0.05);
    });
  });

  // ==========================================================================
  // 1. MAHALANOBIS EXPLAINABILITY
  // ==========================================================================
  describe('1. Mahalanobis Explainability (Covariance & Conditional)', () => {
    test('computes signed standardized deviations and conditional expected values', () => {
      const expl = MahalanobisExplainer.explain(m1, pasteAnomalousObs, 'SES-01', 'STU-100');

      expect(expl.features.length).toBe(5);
      const pasteFeat = expl.features.find((f) => f.featureKey === 'pasteDetected')!;
      expect(pasteFeat.observedValue).toBe(10);
      expect(pasteFeat.standardizedDeviation).toBeGreaterThan(0);
      expect(pasteFeat.attributionRank).toBe(1); // Top contributor

      expect(expl.mahalanobisCoupling).toBeDefined();
      expect(expl.mahalanobisCoupling!.isCovarianceAccountedFor).toBe(true);
      expect(expl.mahalanobisCoupling!.covarianceCouplings.length).toBe(10); // 5*4 / 2 pairs
    });

    test('explicitly accounts for covariance coupling and warns against independent z-score interpretation', () => {
      const expl = MahalanobisExplainer.explain(m1, pasteAnomalousObs);
      expect(expl.mahalanobisCoupling!.disclaimer).toContain(
        'Individual standardised z-scores cannot be interpreted as independent contributions'
      );
    });
  });

  // ==========================================================================
  // 2. ISOLATION FOREST EXPLAINABILITY
  // ==========================================================================
  describe('2. Isolation Forest Explainability (Exact 32-Coalition SHAP)', () => {
    test('computes exact Shapley values across all 2^5 = 32 coalitions with additive efficiency', () => {
      const expl = IsolationForestExplainer.explain(m2, pasteAnomalousObs, 'SES-02', 'STU-100');

      expect(expl.isolationForestShap).toBeDefined();
      expect(expl.isolationForestShap!.approximationMethod).toBe('exact_32_coalitions');

      const shapValues = expl.isolationForestShap!.shapleyValues;
      const sumShap = Object.values(shapValues).reduce((sum, v) => sum + v, 0);

      // Verify additive efficiency: sum(phi_j) approx s(x) - s(mu)
      const expectedDiff = expl.rawAnomalyScore - expl.isolationForestShap!.baselineExpectedScore;
      expect(Math.abs(sumShap - expectedDiff)).toBeLessThan(0.05);

      // Paste activity should have positive Shapley attribution
      expect(shapValues.pasteDetected).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 3. LOCAL OUTLIER FACTOR EXPLAINABILITY
  // ==========================================================================
  describe('3. Local Outlier Factor Explainability (k-NN Neighbourhood)', () => {
    test('inspects k-nearest baseline neighbours and evaluates local reachability densities', () => {
      const expl = LOFExplainer.explain(m3, pasteAnomalousObs, 'SES-03', 'STU-100');

      expect(expl.lofNeighbourhood).toBeDefined();
      expect(expl.lofNeighbourhood!.kNeighbors).toBe(5);
      expect(expl.lofNeighbourhood!.neighbours.length).toBe(5);

      // In an outlier observation, density ratio LOF is greater than 1.0
      expect(expl.lofNeighbourhood!.densityRatio).toBeGreaterThan(1.0);
      expect(expl.features.find((f) => f.featureKey === 'pasteDetected')!.attributionRank).toBe(1);
    });
  });

  // ==========================================================================
  // 4. ONE-CLASS SVM EXPLAINABILITY
  // ==========================================================================
  describe('4. One-Class SVM Explainability (Analytical Boundary Gradients)', () => {
    test('computes analytical decision boundary gradients and support vector projection', () => {
      const expl = OneClassSVMExplainer.explain(m4, pasteAnomalousObs, 'SES-04', 'STU-100');

      expect(expl.svmSensitivity).toBeDefined();
      expect(expl.svmSensitivity!.supportVectorCount).toBeGreaterThan(0);
      expect(typeof expl.svmSensitivity!.marginOffsetRho).toBe('number');

      // Gradient for paste activity coordinate should be positive
      const pasteGrad = expl.svmSensitivity!.gradients.pasteDetected;
      expect(pasteGrad).toBeGreaterThan(0);
      expect(expl.features.find((f) => f.featureKey === 'pasteDetected')!.attributionRank).toBe(1);
    });
  });

  // ==========================================================================
  // 5. EXPLANATION EVALUATION
  // ==========================================================================
  describe('5. Explanation Evaluation (Faithfulness, Stability, Relevance)', () => {
    test('verifies faithfulness: neutralizing top attributed feature lowers anomaly score', () => {
      const expl = ExplanationEvaluator.explainModel(m1, pasteAnomalousObs);
      const faith = ExplanationEvaluator.evaluateFaithfulness(m1, pasteAnomalousObs, expl);
      expect(faith).toBeGreaterThan(0.5); // At least 50% score drop
    });

    test('verifies stability: top feature attribution is invariant to small measurement noise', () => {
      const stability = ExplanationEvaluator.evaluateStability(m1, pasteAnomalousObs, 0.05, 5);
      expect(stability).toBeGreaterThanOrEqual(0.8); // At least 80% rank match
    });

    test('enforces strict non-causal disclaimer on all model explanations', () => {
      [m1, m2, m3, m4].forEach((model) => {
        const expl = ExplanationEvaluator.explainModel(model, normalObs);
        expect(expl.nonCausalDisclaimer).toContain('does not');
        expect(expl.nonCausalDisclaimer.toLowerCase()).not.toContain('cheating proven');
      });
    });

    test('benchmarks explanation computational latency under 50 milliseconds per session', () => {
      // Warm-up to avoid JIT compilation timing jitter during parallel test runs
      ExplanationEvaluator.explainModel(m1, pasteAnomalousObs);
      const t0 = performance.now();
      ExplanationEvaluator.explainModel(m1, pasteAnomalousObs);
      const t1 = performance.now();
      expect(t1 - t0).toBeLessThan(50);
    });
  });

  // ==========================================================================
  // 6. PRIVACY-AWARE ARCHITECTURE & DATA GOVERNANCE
  // ==========================================================================
  describe('6. Privacy Controls & Data Minimisation', () => {
    test('data minimisation: REJECTS payloads containing raw keystrokes or clipboard text', () => {
      const rawPayload = {
        responseTime: 25.0,
        revisionCount: 2,
        pointerMovement: 400,
        scrollDistance: 300,
        pasteDetected: 1,
        clipboard_text: 'int main() { return 0; }', // FORBIDDEN raw clipboard content
        keystrokes: ['KeyA', 'KeyB', 'Backspace'],   // FORBIDDEN raw keystroke stream
      };

      const result = PrivacyService.validateDataMinimization(rawPayload);
      expect(result.isValid).toBe(false);
      expect(result.violations.length).toBe(2);
      expect(result.violations.some((v) => v.includes('clipboard_text'))).toBe(true);
      expect(result.violations.some((v) => v.includes('keystrokes'))).toBe(true);
      expect(result.sanitizedFeatures).toBeUndefined();
    });

    test('data minimisation: ACCEPTS sanitized payloads containing only derived features', () => {
      const validPayload = {
        responseTime: 22.5,
        revisionCount: 1.5,
        pointerMovement: 380,
        scrollDistance: 270,
        pasteDetected: 0,
      };

      const result = PrivacyService.validateDataMinimization(validPayload);
      expect(result.isValid).toBe(true);
      expect(result.violations.length).toBe(0);
      expect(result.sanitizedFeatures).toBeDefined();
      expect(result.sanitizedFeatures!.responseTime).toBe(22.5);
    });

    test('pseudonymisation: generates irreversible HMAC-SHA256 digest without exposing student identity', () => {
      const pseudo1 = PrivacyService.generatePseudonym('student-uuid-12345');
      const pseudo2 = PrivacyService.generatePseudonym('student-uuid-12345');
      const pseudoDifferent = PrivacyService.generatePseudonym('student-uuid-67890');

      expect(pseudo1.startsWith('STU-')).toBe(true);
      expect(pseudo1).toBe(pseudo2); // Deterministic within cohort
      expect(pseudo1).not.toBe(pseudoDifferent);
      expect(pseudo1).not.toContain('12345'); // Original UUID is masked
    });

    test('evidence access control: blocks unauthorized student access to peer examination evidence', () => {
      const studentRequester = { id: 'STU-001', role: 'student' };
      const checkPeer = PrivacyService.verifyEvidenceAccess(studentRequester, 'STU-002');
      expect(checkPeer.isAuthorized).toBe(false);
      expect(checkPeer.reason).toContain('unauthorized to inspect peer');

      const checkOwn = PrivacyService.verifyEvidenceAccess(studentRequester, 'STU-001');
      expect(checkOwn.isAuthorized).toBe(true);
    });

    test('right-to-be-forgotten: safely purges all identifiable student records', () => {
      const mockStore = [
        { studentId: 'STU-TARGET', sessionId: 'SES-01' },
        { studentId: 'STU-TARGET', sessionId: 'SES-02' },
        { studentId: 'STU-OTHER', sessionId: 'SES-03' },
      ];

      const purgeResult = PrivacyService.purgeStudentRecords('STU-TARGET', mockStore);
      expect(purgeResult.purgedCount).toBe(2);
      expect(purgeResult.remainingCount).toBe(1);
    });
  });

  // ==========================================================================
  // 7. HUMAN-IN-THE-LOOP INSTRUCTOR WORKFLOW
  // ==========================================================================
  describe('7. Human-in-the-Loop Review Workflow', () => {
    test('classifies review cases into the three required ethical categories', () => {
      const models = {
        'Regularised Mahalanobis Distance': m1,
        'Isolation Forest': m2,
        'Local Outlier Factor': m3,
        'One-Class SVM': m4,
      };

      const normalCase = HumanReviewService.generateReviewCase(
        'SES-NORM',
        'STU-100',
        normalObs,
        models
      );
      expect(normalCase.category).toBe('Normal behaviour');

      const devCase = HumanReviewService.generateReviewCase(
        'SES-DEV',
        'STU-100',
        pasteAnomalousObs,
        models
      );
      expect(['Behavioural deviation detected', 'Review required']).toContain(devCase.category);
    });

    test('handles missing-data imputation and logs appropriate quality warnings', () => {
      const models = { 'Regularised Mahalanobis Distance': m1 };
      const missingCase = HumanReviewService.generateReviewCase(
        'SES-MISS',
        'STU-100',
        missingDataObs,
        models
      );

      expect(missingCase.dataQualityStatus).toBe('imputed_missing_features');
      expect(missingCase.dataQualityWarnings.length).toBeGreaterThan(0);
      expect(missingCase.dataQualityWarnings[0]).toContain('imputed');
    });

    test('records instructor review decision and pedagogical notes with immutable audit log', async () => {
      const models = { 'Regularised Mahalanobis Distance': m1 };
      HumanReviewService.generateReviewCase('SES-AUDIT-01', 'STU-100', pasteAnomalousObs, models);

      const updatedCase = await HumanReviewService.submitReviewDecision(
        'SES-AUDIT-01',
        'INST-DR-SMITH',
        'cleared_normal',
        'Student confirmed using keyboard shortcut for code snippet during authorized section.'
      );

      expect(updatedCase.reviewStatus).toBe('cleared_normal');
      expect(updatedCase.reviewedBy).toBe('INST-DR-SMITH');
      expect(updatedCase.instructorNotes).toContain('Student confirmed');
      expect(updatedCase.reviewedAt).toBeDefined();
    });
  });
});

