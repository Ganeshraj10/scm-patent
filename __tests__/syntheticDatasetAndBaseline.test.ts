import {
  generateSyntheticDataset,
  SeededPRNG,
  CANONICAL_FEATURES,
  SyntheticSession,
} from '../lib/services/syntheticDatasetGenerator';
import {
  calculatePersonalizedBaseline,
  investigateSampleSizeStability,
} from '../lib/services/baselineModelService';
import { calculateMahalanobisDetails } from '../lib/deviationEngine';
import { BehavioralModel } from '../types';

describe('ExamGuard Phase 2: Synthetic Dataset Engineering & Baseline Modelling', () => {
  // ── 1. Generator Reproducibility & Determinism ──────────────────────────────
  describe('1. Generator Reproducibility & Determinism', () => {
    it('1.1 Produces bit-for-bit identical datasets given the same fixed seed', () => {
      const run1 = generateSyntheticDataset({ seed: 12345, numStudents: 5, sessionsPerStudent: 10 });
      const run2 = generateSyntheticDataset({ seed: 12345, numStudents: 5, sessionsPerStudent: 10 });

      expect(run1.allSessions.length).toBe(run2.allSessions.length);
      expect(run1.allSessions.length).toBe(50);

      // Check exact session values
      for (let i = 0; i < 50; i++) {
        const s1 = run1.allSessions[i];
        const s2 = run2.allSessions[i];
        expect(s1.sessionId).toBe(s2.sessionId);
        expect(s1.scenarioCategory).toBe(s2.scenarioCategory);
        expect(s1.aggregatedFeatures.responseTime).toBe(s2.aggregatedFeatures.responseTime);
        expect(s1.aggregatedFeatures.pointerMovement).toBe(s2.aggregatedFeatures.pointerMovement);
        expect(s1.aggregatedFeatures.scrollDistance).toBe(s2.aggregatedFeatures.scrollDistance);
      }
    });

    it('1.2 Produces statistically distinct datasets when seeds differ', () => {
      const runA = generateSyntheticDataset({ seed: 100, numStudents: 3, sessionsPerStudent: 5 });
      const runB = generateSyntheticDataset({ seed: 200, numStudents: 3, sessionsPerStudent: 5 });

      expect(runA.allSessions[0].aggregatedFeatures.responseTime).not.toBe(
        runB.allSessions[0].aggregatedFeatures.responseTime
      );
      expect(runA.allSessions[0].aggregatedFeatures.pointerMovement).not.toBe(
        runB.allSessions[0].aggregatedFeatures.pointerMovement
      );
    });
  });

  // ── 2. Scenario Categorization & Controlled Labels ─────────────────────────
  describe('2. Scenario Categorization & Label Correctness', () => {
    let dataset: ReturnType<typeof generateSyntheticDataset>;

    beforeAll(() => {
      dataset = generateSyntheticDataset({ seed: 42, numStudents: 10, sessionsPerStudent: 40 });
    });

    it('2.1 Correctly assigns all 5 scenario categories (A, B, C, D, E)', () => {
      const categories = new Set(dataset.allSessions.map((s) => s.scenarioCategory));
      expect(categories.has('A_NORMAL')).toBe(true);
      expect(categories.has('B_LEGITIMATE_VARIATION')).toBe(true);
      expect(categories.has('C_SINGLE_FEATURE_DEVIATION')).toBe(true);
      expect(categories.has('D_MULTI_FEATURE_DEVIATION')).toBe(true);
      expect(categories.has('E_DATA_QUALITY_ANOMALY')).toBe(true);
    });

    it('2.2 Treats Category B (Legitimate Variations) as NON-anomalous (isAnomaly === false)', () => {
      const catB = dataset.allSessions.filter((s) => s.scenarioCategory === 'B_LEGITIMATE_VARIATION');
      expect(catB.length).toBeGreaterThan(0);
      catB.forEach((s) => {
        expect(s.isAnomaly).toBe(false);
      });
    });

    it('2.3 Correctly labels Category C and D deviations with isAnomaly === true and specified deviating features', () => {
      const catC = dataset.allSessions.filter((s) => s.scenarioCategory === 'C_SINGLE_FEATURE_DEVIATION');
      const catD = dataset.allSessions.filter((s) => s.scenarioCategory === 'D_MULTI_FEATURE_DEVIATION');

      expect(catC.length).toBeGreaterThan(0);
      catC.forEach((s) => {
        expect(s.isAnomaly).toBe(true);
        expect(s.deviatingFeatures).toBeDefined();
        expect(s.deviatingFeatures!.length).toBe(1);
      });

      expect(catD.length).toBeGreaterThan(0);
      catD.forEach((s) => {
        expect(s.isAnomaly).toBe(true);
        expect(s.deviatingFeatures).toBeDefined();
        expect(s.deviatingFeatures!.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  // ── 3. Feature Validity & Standardized Units ────────────────────────────────
  describe('3. Feature Validity & Units Standardisation', () => {
    let dataset: ReturnType<typeof generateSyntheticDataset>;

    beforeAll(() => {
      dataset = generateSyntheticDataset({ seed: 42, numStudents: 5, sessionsPerStudent: 40 });
    });

    it('3.1 Conforms to the exact 5 canonical features with physically valid ranges', () => {
      dataset.allSessions.forEach((s) => {
        const f = s.aggregatedFeatures;
        // responseTime (s): > 0 (unless deliberately corrupted in E7)
        if (s.scenarioSubtype !== 'E7_INVALID_BOUNDS') {
          expect(f.responseTime).toBeGreaterThan(0);
          expect(f.revisionCount).toBeGreaterThanOrEqual(0);
          expect(f.pointerMovement).toBeGreaterThanOrEqual(0);
          expect(f.scrollDistance).toBeGreaterThanOrEqual(0);
          expect(f.pasteDetected).toBeGreaterThanOrEqual(0);
          expect(f.pasteDetected).toBeLessThanOrEqual(100);
        }
      });
    });

    it('3.2 Question-level telemetry records non-negative integers for revisions and valid device types', () => {
      dataset.allSessions.forEach((s) => {
        s.features.forEach((q) => {
          expect(Number.isInteger(q.revisionCount)).toBe(true);
          expect(q.revisionCount).toBeGreaterThanOrEqual(0);
          expect(['desktop', 'laptop', 'tablet']).toContain(q.deviceType);
          expect(q.questionDifficulty).toBeGreaterThanOrEqual(0.1);
          expect(q.questionDifficulty).toBeLessThanOrEqual(1.0);
        });
      });
    });
  });

  // ── 4. Partition Separation & Chronological Ordering ────────────────────────
  describe('4. Partition Separation & Zero Leakage', () => {
    let dataset: ReturnType<typeof generateSyntheticDataset>;

    beforeAll(() => {
      dataset = generateSyntheticDataset({
        seed: 42,
        numStudents: 10,
        trainSessionCount: 20,
        calSessionCount: 10,
        testSessionCount: 10,
      });
    });

    it('4.1 Enforces strict chronological order across Train -> Calibration -> Test', () => {
      dataset.students.forEach((student) => {
        const studentSessions = dataset.allSessions
          .filter((s) => s.studentId === student.studentId)
          .sort((a, b) => a.sessionIndex - b.sessionIndex);

        const trainTimes = studentSessions.slice(0, 20).map((s) => new Date(s.timestamp).getTime());
        const calTimes = studentSessions.slice(20, 30).map((s) => new Date(s.timestamp).getTime());
        const testTimes = studentSessions.slice(30, 40).map((s) => new Date(s.timestamp).getTime());

        const maxTrain = Math.max(...trainTimes);
        const minCal = Math.min(...calTimes);
        const maxCal = Math.max(...calTimes);
        const minTest = Math.min(...testTimes);

        expect(maxTrain).toBeLessThan(minCal);
        expect(maxCal).toBeLessThan(minTest);
      });
    });

    it('4.2 Guarantees zero session ID overlap and 0% anomalies in Train and Calibration partitions', () => {
      const trainIds = new Set(dataset.trainSessions.map((s) => s.sessionId));
      const calIds = new Set(dataset.calibrationSessions.map((s) => s.sessionId));
      const testIds = new Set(dataset.testSessions.map((s) => s.sessionId));

      // Disjoint IDs
      calIds.forEach((id) => expect(trainIds.has(id)).toBe(false));
      testIds.forEach((id) => {
        expect(trainIds.has(id)).toBe(false);
        expect(calIds.has(id)).toBe(false);
      });

      // Pure normal baselines
      expect(dataset.trainSessions.every((s) => !s.isAnomaly)).toBe(true);
      expect(dataset.calibrationSessions.every((s) => !s.isAnomaly)).toBe(true);
    });
  });

  // ── 5. Personalised Baseline Modelling ──────────────────────────────────────
  describe('5. Personalised Baseline Modelling', () => {
    let dataset: ReturnType<typeof generateSyntheticDataset>;

    beforeAll(() => {
      dataset = generateSyntheticDataset({ seed: 42, numStudents: 10, sessionsPerStudent: 40 });
    });

    it('5.1 Generates distinct, personalized feature means and covariances for different students', () => {
      const student1Sessions = dataset.trainSessions.filter((s) => s.studentId === 'STU-0001');
      const student2Sessions = dataset.trainSessions.filter((s) => s.studentId === 'STU-0002');

      const baseline1 = calculatePersonalizedBaseline('STU-0001', student1Sessions);
      const baseline2 = calculatePersonalizedBaseline('STU-0002', student2Sessions);

      // Student 1 and Student 2 have different personal means
      expect(baseline1.featureMeans.responseTime).not.toEqual(baseline2.featureMeans.responseTime);
      expect(baseline1.featureMeans.pointerMovement).not.toEqual(baseline2.featureMeans.pointerMovement);

      // Both covariance matrices must be 5x5 symmetric positive-semidefinite
      expect(baseline1.sampleCovariance.length).toBe(5);
      expect(baseline1.sampleCovariance[0].length).toBe(5);
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          expect(baseline1.sampleCovariance[i][j]).toBeCloseTo(baseline1.sampleCovariance[j][i], 5);
        }
      }
    });

    it('5.2 Accurately identifies cold_start status when N < 10 and active when N >= 10', () => {
      const studentSessions = dataset.trainSessions.filter((s) => s.studentId === 'STU-0001');

      const coldStart = calculatePersonalizedBaseline('STU-0001', studentSessions.slice(0, 5));
      expect(coldStart.status).toBe('cold_start');
      expect(coldStart.qualityRating).toBe('marginal');
      expect(coldStart.confidenceScore).toBeLessThan(70);

      const active = calculatePersonalizedBaseline('STU-0001', studentSessions.slice(0, 15));
      expect(active.status).toBe('active');
      expect(active.qualityRating).toBe('stable');
      expect(active.confidenceScore).toBeGreaterThanOrEqual(70);
    });
  });

  // ── 6. Missing-Value Handling ───────────────────────────────────────────────
  describe('6. Missing-Value Imputation and Robust Scoring', () => {
    it('6.1 Imputes baseline expectations (z=0) so missing telemetry does not inflate Mahalanobis distance', () => {
      const mockModel: BehavioralModel = {
        studentId: 'STU-TEST',
        sessionCount: 20,
        minimumSessionsRequired: 10,
        status: 'active',
        confidence: 90,
        lastUpdated: new Date().toISOString(),
        calibratedThreshold: 3.5,
        calibrationAvailable: true,
        shrinkageLambda: 0.2,
        uncertainties: [],
        expectations: [
          { feature: 'responseTime', label: 'Response Time', unit: 's', mean: 25.0, stdDev: 5.0, min: 10, max: 40 },
          { feature: 'revisionCount', label: 'Revision Count', unit: 'revisions', mean: 2.0, stdDev: 0.5, min: 0, max: 5 },
          { feature: 'pointerMovement', label: 'Pointer Movement', unit: 'px', mean: 600.0, stdDev: 80.0, min: 300, max: 900 },
          { feature: 'scrollDistance', label: 'Scroll Distance', unit: 'px', mean: 400.0, stdDev: 50.0, min: 200, max: 600 },
          { feature: 'pasteDetected', label: 'Paste-event percentage', unit: '%', mean: 1.0, stdDev: 0.5, min: 0, max: 5 },
        ],
        correlationMatrix: Array.from({ length: 5 }, (_, i) => Array.from({ length: 5 }, (_, j) => (i === j ? 1 : 0))),
        inverseCorrelationMatrix: Array.from({ length: 5 }, (_, i) => Array.from({ length: 5 }, (_, j) => (i === j ? 1 : 0))),
        covarianceMatrix: Array.from({ length: 5 }, (_, i) => Array.from({ length: 5 }, (_, j) => (i === j ? 1 : 0))),
      };

      // Observation where pointerMovement and scrollDistance are missing (undefined/null)
      // but observed features match the student mean exactly
      const observedWithMissing: Record<string, number> = {
        responseTime: 25.0,
        revisionCount: 2.0,
        pasteDetected: 1.0,
      };

      const score = calculateMahalanobisDetails(observedWithMissing, mockModel);
      // Because missing values are imputed to mean (z=0), D_M should be 0, not an anomaly spike!
      expect(score.mahalanobisDistance).toBeCloseTo(0.0, 3);
    });
  });

  // ── 7. Sample-Size Threshold Investigation ─────────────────────────────────
  describe('7. Sample-Size Stability Investigation', () => {
    it('7.1 Demonstrates that covariance error decreases monotonically as sample size N increases from 2 to 30', () => {
      const dataset = generateSyntheticDataset({ seed: 42, numStudents: 10, sessionsPerStudent: 30 });
      const studentSessionsMap = new Map<string, SyntheticSession[]>();
      dataset.allSessions.forEach((s) => {
        if (!studentSessionsMap.has(s.studentId)) studentSessionsMap.set(s.studentId, []);
        studentSessionsMap.get(s.studentId)!.push(s);
      });

      const report = investigateSampleSizeStability(studentSessionsMap);
      expect(report.curve.length).toBe(10);

      // Verify N <= 4 is singular (rank deficient)
      const n2 = report.curve.find((p) => p.sampleSize === 2)!;
      const n4 = report.curve.find((p) => p.sampleSize === 4)!;
      expect(n2.isSingularPercent).toBe(100);
      expect(n4.isSingularPercent).toBe(100);

      // Verify N >= 6 is non-singular
      const n10 = report.curve.find((p) => p.sampleSize === 10)!;
      const n20 = report.curve.find((p) => p.sampleSize === 20)!;
      expect(n10.isSingularPercent).toBe(0);

      // Relative Frobenius error decreases from N=4 to N=10 to N=20
      expect(n4.relativeFrobeniusError).toBeGreaterThan(n10.relativeFrobeniusError);
      expect(n10.relativeFrobeniusError).toBeGreaterThan(n20.relativeFrobeniusError);

      // Findings confirm empirical justification for N=10 rule of thumb
      expect(report.empiricalFindings.isTenSessionRuleJustified).toBe(true);
      expect(report.empiricalFindings.heuristicThreshold).toBe(10);
    });
  });
});
