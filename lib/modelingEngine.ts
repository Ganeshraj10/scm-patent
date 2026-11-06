import { BehavioralModel, FeatureExpectation, FeatureUncertainty, ModelStatus } from '@/types';
import { calculateConformalThreshold } from './calibrationEngine';
import {
  ORDERED_FEATURES,
  computeSampleCovariance,
  computeSampleCorrelation,
  computeShrinkageIntensity,
  regularizeAndInvertCorrelation,
  extractAveragedFeatureVector,
} from './deviationEngine';

/**
 * Calculates mean and standard deviation for an array of numbers.
 */
function calculateStats(values: number[]): { mean: number; stdDev: number; min: number; max: number } {
  if (values.length === 0) return { mean: 0, stdDev: 0, min: 0, max: 0 };

  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;

  if (values.length === 1) return { mean, stdDev: 0, min, max };

  const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (values.length - 1);
  const stdDev = Math.sqrt(variance);

  return { mean, stdDev, min, max };
}

/**
 * Derives a personalized behavioral model from raw tracked sessions.
 * Implements an 80/20 chronological split for Phase 6 Conformal Calibration,
 * and derives the 5x5 covariance matrix with an implementation-specific shrinkage estimator
 * inspired by correlation shrinkage (with regularized small-sample fallbacks).
 */
export function buildBehavioralModel(studentId: string, sessions: any[]): BehavioralModel {
  // Eligibility: strictly low_stakes sessions only (graded examinations are never included in baseline training, preserving fairness and privacy policy)
  const eligiblePersonalizationSessions = sessions
    .filter(
      (s) =>
        s.type === 'low_stakes' &&
        s.studentId === studentId &&
        s.features
    )
    // Ensure strict chronological ordering
    .sort((a, b) => new Date(a.date || a.startTime).getTime() - new Date(b.date || b.startTime).getTime());

  const sessionCount = eligiblePersonalizationSessions.length;

  // Chronological 80/20 train/calibration split
  // Strictly enforce that observations are NEVER reused for both training and calibration.
  // Conformal calibration requires at least 10 sessions.
  let trainingSessions: any[] = [];
  let calibrationSessions: any[] = [];
  const calibrationAvailable = sessionCount >= 10;

  if (sessionCount >= 10) {
    const splitIndex = Math.floor(sessionCount * 0.8);
    trainingSessions = eligiblePersonalizationSessions.slice(0, splitIndex);
    calibrationSessions = eligiblePersonalizationSessions.slice(splitIndex);
  } else {
    // Insufficient history for calibration split: all eligible sessions used for training baseline only.
    // Calibration sessions remain empty — zero overlap or data leakage.
    trainingSessions = eligiblePersonalizationSessions;
    calibrationSessions = [];
  }

  // Confidence score & model status
  const confidence =
    sessionCount === 0 ? 0 : Math.min(95, Math.round(100 - 100 / (sessionCount + 0.5)));
  const status: ModelStatus = sessionCount >= 10 ? 'active' : 'cold_start';

  // Extract arrays of values for each feature across TRAINING sessions
  const features = {
    responseTime: [] as number[],
    revisionCount: [] as number[],
    pointerMovement: [] as number[],
    scrollDistance: [] as number[],
    pasteDetected: [] as number[],
  };

  // Matrix of row observations (N x 5)
  const observationMatrix: number[][] = [];

  trainingSessions.forEach((session) => {
    let vector: Record<string, number>;
    if (Array.isArray(session.features)) {
      vector = extractAveragedFeatureVector(session.features);
    } else if (session.features && typeof session.features === 'object') {
      const f = session.features as any;
      let rt = Number(f.responseTime);
      if (!isNaN(rt) && rt > 500) rt /= 1000;
      vector = {
        responseTime: !isNaN(rt) ? rt : 0,
        revisionCount: !isNaN(Number(f.revisionCount)) ? Number(f.revisionCount) : 0,
        pointerMovement: !isNaN(Number(f.pointerMovement)) ? Number(f.pointerMovement) : 0,
        scrollDistance: !isNaN(Number(f.scrollDistance)) ? Number(f.scrollDistance) : 0,
        pasteDetected: !isNaN(Number(f.pasteDetected)) ? Number(f.pasteDetected) : 0,
      };
    } else {
      vector = {
        responseTime: 0,
        revisionCount: 0,
        pointerMovement: 0,
        scrollDistance: 0,
        pasteDetected: 0,
      };
    }

    features.responseTime.push(vector.responseTime);
    features.revisionCount.push(vector.revisionCount);
    features.pointerMovement.push(vector.pointerMovement);
    features.scrollDistance.push(vector.scrollDistance);
    features.pasteDetected.push(vector.pasteDetected);

    // Row vector in exact canonical order
    observationMatrix.push([
      vector.responseTime,
      vector.revisionCount,
      vector.pointerMovement,
      vector.scrollDistance,
      vector.pasteDetected,
    ]);
  });

  const expectations: FeatureExpectation[] = [
    { feature: 'responseTime', label: 'Response Time', unit: 's', ...calculateStats(features.responseTime) },
    { feature: 'revisionCount', label: 'Revision Count', unit: 'revisions', ...calculateStats(features.revisionCount) },
    { feature: 'pointerMovement', label: 'Pointer Movement', unit: 'px', ...calculateStats(features.pointerMovement) },
    { feature: 'scrollDistance', label: 'Scroll Distance', unit: 'px', ...calculateStats(features.scrollDistance) },
    { feature: 'pasteDetected', label: 'Paste-event percentage', unit: '%', ...calculateStats(features.pasteDetected) },
  ];

  // Deterministic uncertainty calculation based on sample size and relative dispersion (stdDev / (|mean| + 1))
  // Algorithm version: 2.1.0-deterministic (reproducible across repeated runs with zero stochastic perturbation)
  const nTrain = trainingSessions.length;
  const baseUncertainty = nTrain === 0 ? 1.0 : Math.max(0.05, Math.min(1.0, 1 / Math.sqrt(nTrain)));
  const uncertainties: FeatureUncertainty[] = expectations.map((exp) => {
    const dispersion = exp.stdDev / (Math.abs(exp.mean) + 1.0);
    const dispersionFactor = 1.0 + Math.min(0.2, dispersion * 0.05);
    const finalUncertainty = Math.min(1.0, Math.max(0.05, baseUncertainty * dispersionFactor));
    return {
      feature: exp.feature,
      uncertainty: Number(finalUncertainty.toFixed(3)),
      sampleSize: nTrain,
    };
  });

  // Canonical mean vector and standard deviation vector
  const meanVector = expectations.map((e) => e.mean);
  const stdDevVector = expectations.map((e) => e.stdDev);

  // ── Compute Multidimensional Covariance, Shrinkage & Inverse ──
  const covarianceMatrix = computeSampleCovariance(observationMatrix, meanVector);
  const correlationMatrix = computeSampleCorrelation(covarianceMatrix, stdDevVector);
  const shrinkageLambda = computeShrinkageIntensity(
    correlationMatrix,
    observationMatrix,
    meanVector,
    stdDevVector
  );
  const { inverseCorrelation } = regularizeAndInvertCorrelation(
    correlationMatrix,
    shrinkageLambda
  );

  const baseModel: BehavioralModel = {
    studentId,
    status,
    sessionCount,
    minimumSessionsRequired: 10,
    confidence,
    lastUpdated: new Date().toISOString(),
    algorithmVersion: '2.1.0-deterministic',
    calibrationAvailable,
    expectations,
    uncertainties,
    covarianceMatrix,
    correlationMatrix,
    inverseCorrelationMatrix: inverseCorrelation,
    shrinkageLambda,
    featureOrder: [...ORDERED_FEATURES],
  };

  // Phase 6 Conformal Calibration:
  // If calibration sessions are available (sessionCount >= 10), derive empirical non-conformity threshold.
  // Otherwise, use documented cold-start fallback threshold (2.5) with no train/calibration overlap.
  const DEFAULT_COLD_START_THRESHOLD = 2.5;
  const calibratedThreshold = calibrationAvailable && calibrationSessions.length > 0
    ? calculateConformalThreshold(baseModel, calibrationSessions)
    : DEFAULT_COLD_START_THRESHOLD;
  baseModel.calibratedThreshold = calibratedThreshold;

  return baseModel;

  return baseModel;
}
