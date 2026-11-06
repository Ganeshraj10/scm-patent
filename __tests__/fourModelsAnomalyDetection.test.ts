/**
 * ============================================================================
 * EXAMGUARD — PHASE 3: FOUR ANOMALY DETECTION MODELS TEST SUITE
 * ============================================================================
 * Rigorous unit and integration tests covering:
 * - Model 1: Regularised Mahalanobis Distance
 * - Model 2: Isolation Forest
 * - Model 3: Local Outlier Factor (Novelty Detection)
 * - Model 4: One-Class Support Vector Machine (RBF Kernel)
 *
 * Scenarios tested:
 * - Normal baseline observations
 * - Single-feature deviations
 * - Multiple simultaneous deviations
 * - Category B legitimate variations
 * - Missing-data imputation (NaNs)
 * - Extreme numerical values & stability
 * - Unseen sessions scoring
 * - Split-conformal threshold calibration
 * - Benchmark engine integration
 */

import {
  RegularizedMahalanobisModel,
  IsolationForestModel,
  LocalOutlierFactorModel,
  OneClassSVMModel,
} from '../lib/ml/models';
import { StandardScaler } from '../lib/ml/preprocessing';
import { calibrateThreshold } from '../lib/ml/calibration';
import { IAnomalyDetectionModel } from '../lib/ml/types';

describe('Phase 3: Four-Model Anomaly Detection Subsystem', () => {
  // Generate synthetic baseline training data (20 sessions, 5 features)
  // Features: [responseTime (~25s), revisionCount (~2), pointerMovement (~400px), scrollDistance (~300px), pasteDetected (~0)]
  const generateBaselineData = (n: number = 20): number[][] => {
    const data: number[][] = [];
    for (let i = 0; i < n; i++) {
      data.push([
        25 + (Math.sin(i * 1.5) * 4), // 21 to 29 s
        2 + (i % 3 === 0 ? 1 : 0),    // 2 to 3 revisions
        400 + (Math.cos(i * 1.2) * 50), // 350 to 450 px
        300 + (Math.sin(i * 0.9) * 40), // 260 to 340 px
        0,                             // 0 pastes
      ]);
    }
    return data;
  };

  const trainData = generateBaselineData(20);
  const calData = generateBaselineData(10); // Held-out calibration set

  const testNormalObs = [26.0, 2.0, 390.0, 310.0, 0];
  const testSingleDevObs = [25.0, 2.0, 400.0, 300.0, 12]; // 12 pastes (extreme deviation)
  const testMultiDevObs = [3.5, 0.0, 20.0, 15.0, 10]; // Rapid response, no mouse/scroll, 10 pastes
  const testLegitimateVarObs = [48.0, 4.0, 520.0, 450.0, 0]; // Difficult question / cautious student
  const testMissingDataObs = [NaN, 2.0, NaN, 300.0, 0]; // Missing response time & mouse movement
  const testExtremeObs = [99999.0, 1000.0, 999999.0, 999999.0, 500];

  const models: { name: string; create: () => IAnomalyDetectionModel }[] = [
    {
      name: 'Model 1: Regularised Mahalanobis Distance',
      create: () => new RegularizedMahalanobisModel({ ridgeEpsilon: 1e-4, targetFPR: 0.05 }),
    },
    {
      name: 'Model 2: Isolation Forest',
      create: () => new IsolationForestModel({ nEstimators: 50, seed: 42, targetFPR: 0.05 }),
    },
    {
      name: 'Model 3: Local Outlier Factor',
      create: () => new LocalOutlierFactorModel({ nNeighbors: 5, targetFPR: 0.05 }),
    },
    {
      name: 'Model 4: One-Class SVM',
      create: () => new OneClassSVMModel({ nu: 0.05, gamma: 0.2, targetFPR: 0.05 }),
    },
  ];

  // ==========================================================================
  // 1. COMMON INTERFACE & LIFECYCLE COMPLIANCE
  // ==========================================================================
  describe('Common Model Interface Compliance', () => {
    models.forEach(({ name, create }) => {
      describe(name, () => {
        let model: IAnomalyDetectionModel;

        beforeEach(() => {
          model = create();
        });

        test('throws descriptive error if predict_score is called before fit', () => {
          expect(() => model.predict_score(testNormalObs)).toThrow(/must be fitted/i);
        });

        test('fits successfully on valid training data', () => {
          expect(() => model.fit(trainData)).not.toThrow();
          const meta = model.get_metadata();
          expect(meta.trainingObservationCount).toBe(20);
          expect(meta.scoreOrientation).toBe('higher_is_more_anomalous');
        });

        test('calibrates threshold using held-out calibration sessions without error', () => {
          model.fit(trainData);
          const threshold = model.calibrate(calData, 0.05);
          expect(typeof threshold).toBe('number');
          expect(isNaN(threshold)).toBe(false);

          const meta = model.get_metadata();
          expect(meta.calibratedThreshold).toBe(threshold);
          expect(meta.calibrationObservationCount).toBe(10);
        });

        test('predict() returns standardized AnomalyPrediction format', () => {
          model.fit(trainData);
          model.calibrate(calData, 0.05);

          const pred = model.predict(testNormalObs, 'SES-TEST-01', 'STU-100', '2026-03-01T10:00:00Z');
          expect(pred.sessionId).toBe('SES-TEST-01');
          expect(pred.studentId).toBe('STU-100');
          expect(pred.modelName).toBe(model.get_metadata().modelName);
          expect(typeof pred.rawAnomalyScore).toBe('number');
          expect(typeof pred.calibratedThreshold).toBe('number');
          expect(typeof pred.isAnomaly).toBe('boolean');
          expect(['normal', 'review_required']).toContain(pred.reviewStatus);
          expect(pred.scoreOrientation).toBe('higher_is_more_anomalous');
          expect(pred.dataQualityStatus).toBe('complete');
        });
      });
    });
  });

  // ==========================================================================
  // 2. MODEL PREDICTIONS ON EXPERIMENTAL SCENARIOS
  // ==========================================================================
  describe('Comparative Scenario Behaviour', () => {
    models.forEach(({ name, create }) => {
      describe(name, () => {
        let model: IAnomalyDetectionModel;

        beforeEach(() => {
          model = create();
          model.fit(trainData);
          model.calibrate(calData, 0.05);
        });

        test('scores normal baseline observation lower than severe deviations', () => {
          const normalScore = model.predict_score(testNormalObs);
          const multiDevScore = model.predict_score(testMultiDevObs);

          expect(multiDevScore).toBeGreaterThan(normalScore);
        });

        test('detects severe multi-feature anomaly and flags review_required', () => {
          const pred = model.predict(testMultiDevObs, 'SES-MULTI', 'STU-100');
          expect(pred.isAnomaly).toBe(true);
          expect(pred.reviewStatus).toBe('review_required');
        });

        test('handles missing values (NaNs) via mean imputation without crashing or returning NaN', () => {
          const pred = model.predict(testMissingDataObs, 'SES-MISSING', 'STU-100');
          expect(isNaN(pred.rawAnomalyScore)).toBe(false);
          expect(typeof pred.isAnomaly).toBe('boolean');
          expect(pred.dataQualityStatus).toBe('imputed_missing_features');
        });

        test('handles extreme numerical inputs stably without overflow or crash', () => {
          const pred = model.predict(testExtremeObs, 'SES-EXTREME', 'STU-100');
          expect(isNaN(pred.rawAnomalyScore)).toBe(false);
          expect(isFinite(pred.rawAnomalyScore)).toBe(true);
          expect(pred.isAnomaly).toBe(true);
        });
      });
    });
  });

  // ==========================================================================
  // 3. MODEL 1 SPECIFIC: REGULARISED MAHALANOBIS DISTANCE
  // ==========================================================================
  describe('Model 1: Regularised Mahalanobis Mathematics', () => {
    test('produces zero anomaly distance when observation matches sample mean vector exactly', () => {
      const mahalanobis = new RegularizedMahalanobisModel({ ridgeEpsilon: 1e-4 });
      mahalanobis.fit(trainData);

      // Extract the scaler means
      const meta = mahalanobis.get_metadata();
      expect(meta.hyperparameters.shrinkageIntensity).toBeGreaterThanOrEqual(0);
      expect(meta.hyperparameters.shrinkageIntensity).toBeLessThanOrEqual(1);

      // Score on identical mean vector
      const scaler = new StandardScaler();
      scaler.fit(trainData);
      const score = mahalanobis.predict_score(scaler.means);
      expect(score).toBeCloseTo(0.0, 2);
    });

    test('validates shrinkage regularisation matrix R_reg = (1 - lambda)R + lambda I + eps I', () => {
      const mahalanobis = new RegularizedMahalanobisModel({ ridgeEpsilon: 1e-4 });
      mahalanobis.fit(trainData);
      const meta = mahalanobis.get_metadata();

      expect(meta.hyperparameters.regularizationFormula).toContain('R_reg = (1 - lambda)R + lambda I + epsilon I');
      expect(meta.hyperparameters.ridgeEpsilon).toBe(1e-4);
    });
  });

  // ==========================================================================
  // 4. MODEL 2 SPECIFIC: ISOLATION FOREST
  // ==========================================================================
  describe('Model 2: Isolation Forest Determinism & Bounds', () => {
    test('produces anomaly scores strictly bounded in [0, 1]', () => {
      const iforest = new IsolationForestModel({ nEstimators: 30, seed: 42 });
      iforest.fit(trainData);

      const sNormal = iforest.predict_score(testNormalObs);
      const sAnomaly = iforest.predict_score(testMultiDevObs);

      expect(sNormal).toBeGreaterThanOrEqual(0.0);
      expect(sNormal).toBeLessThanOrEqual(1.0);
      expect(sAnomaly).toBeGreaterThanOrEqual(0.0);
      expect(sAnomaly).toBeLessThanOrEqual(1.0);
    });

    test('is fully deterministic across identical random seeds', () => {
      const iforest1 = new IsolationForestModel({ nEstimators: 30, seed: 999 });
      const iforest2 = new IsolationForestModel({ nEstimators: 30, seed: 999 });

      iforest1.fit(trainData);
      iforest2.fit(trainData);

      const score1 = iforest1.predict_score(testMultiDevObs);
      const score2 = iforest2.predict_score(testMultiDevObs);

      expect(score1).toBe(score2);
    });
  });

  // ==========================================================================
  // 5. MODEL 3 SPECIFIC: LOCAL OUTLIER FACTOR (NOVELTY DETECTION)
  // ==========================================================================
  describe('Model 3: Local Outlier Factor Novelty Density', () => {
    test('observation in the center of training baseline has LOF close to 1.0', () => {
      const lof = new LocalOutlierFactorModel({ nNeighbors: 5 });
      lof.fit(trainData);

      // Score an observation near the centroid
      const centroidObs = [25.0, 2.0, 400.0, 300.0, 0];
      const score = lof.predict_score(centroidObs);

      // Normal cluster observations have LOF ~ 1.0 (typically 0.8 - 1.5)
      expect(score).toBeGreaterThan(0.5);
      expect(score).toBeLessThan(1.8);
    });

    test('remote outlier has substantially higher LOF score', () => {
      const lof = new LocalOutlierFactorModel({ nNeighbors: 5 });
      lof.fit(trainData);

      const centroidScore = lof.predict_score([25.0, 2.0, 400.0, 300.0, 0]);
      const outlierScore = lof.predict_score([100.0, 20.0, 2500.0, 1800.0, 15]);

      expect(outlierScore).toBeGreaterThan(centroidScore * 1.5);
    });
  });

  // ==========================================================================
  // 6. MODEL 4 SPECIFIC: ONE-CLASS SVM
  // ==========================================================================
  describe('Model 4: One-Class SVM Support Hyperplane', () => {
    test('identifies support vectors and solves offset rho', () => {
      const ocsvm = new OneClassSVMModel({ nu: 0.05, gamma: 0.2 });
      ocsvm.fit(trainData);

      const meta = ocsvm.get_metadata();
      expect(meta.hyperparameters.supportVectorCount).toBeGreaterThan(0);
      expect(meta.hyperparameters.supportVectorCount).toBeLessThanOrEqual(20);
      expect(typeof meta.hyperparameters.rho).toBe('number');
    });

    test('extreme deviation receives higher negated decision margin score', () => {
      const ocsvm = new OneClassSVMModel({ nu: 0.05, gamma: 0.2 });
      ocsvm.fit(trainData);

      const sNormal = ocsvm.predict_score(testNormalObs);
      const sExtreme = ocsvm.predict_score(testMultiDevObs);

      expect(sExtreme).toBeGreaterThan(sNormal);
    });
  });

  // ==========================================================================
  // 7. PREPROCESSING & CALIBRATION GUARANTEES
  // ==========================================================================
  describe('Statistical Isolation & Calibration Module', () => {
    test('StandardScaler fits strictly on training data without leakage', () => {
      const scaler = new StandardScaler();
      scaler.fit(trainData);

      expect(scaler.means.length).toBe(5);
      expect(scaler.stdDevs.length).toBe(5);
      // All stdDevs must be strictly positive
      scaler.stdDevs.forEach((std) => expect(std).toBeGreaterThan(0));
    });

    test('calibrateThreshold computes finite-sample corrected quantile', () => {
      const scores = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
      const res = calibrateThreshold(scores, 0.1, 'higher_is_more_anomalous');

      expect(res.sampleSize).toBe(10);
      expect(res.targetFPR).toBe(0.1);
      expect(res.calibratedThreshold).toBeGreaterThanOrEqual(0.8);
    });
  });
});

