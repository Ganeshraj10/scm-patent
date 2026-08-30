import { BehavioralModel, FeatureExpectation, FeatureUncertainty, ModelStatus } from '@/types';
import { calculateConformalThreshold } from './calibrationEngine';
import {
  ORDERED_FEATURES,
  computeSampleCovariance,
  computeSampleCorrelation,
  computeShrinkageIntensity,
  regularizeAndInvertCorrelation,
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
 * and derives the 5x5 covariance matrix with Ledoit-Wolf shrinkage regularization.
 */
export function buildBehavioralModel(studentId: string, sessions: any[]): BehavioralModel {
  // Eligibility: low_stakes sessions OR verified graded examinations
  const eligiblePersonalizationSessions = sessions
    .filter(
      (s) =>
        (s.type === 'low_stakes' || s.reviewStatus === 'verified') &&
        s.studentId === studentId &&
        s.features
    )
    // Ensure strict chronological ordering
    .sort((a, b) => new Date(a.date || a.startTime).getTime() - new Date(b.date || b.startTime).getTime());

  const sessionCount = eligiblePersonalizationSessions.length;

  // Chronological 80/20 train/calibration split
  let trainingSessions = eligiblePersonalizationSessions;
  let calibrationSessions: any[] = [];

  if (sessionCount >= 10) {
    const splitIndex = Math.floor(sessionCount * 0.8);
    trainingSessions = eligiblePersonalizationSessions.slice(0, splitIndex);
    calibrationSessions = eligiblePersonalizationSessions.slice(splitIndex);
  } else if (sessionCount > 0) {
    const splitIndex = Math.max(1, Math.floor(sessionCount * 0.8));
    trainingSessions = eligiblePersonalizationSessions.slice(0, splitIndex);
    calibrationSessions = eligiblePersonalizationSessions.slice(splitIndex);
    if (calibrationSessions.length === 0) {
      calibrationSessions = [...trainingSessions]; // fallback for n=1
    }
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
    let fTime = 0,
      fPointer = 0,
      fScroll = 0,
      fRevision = 0,
      fPaste = 0;

    if (Array.isArray(session.features)) {
      const count = session.features.length || 1;
      session.features.forEach((f: any) => {
        fTime += f.responseTime || 0;
        fPointer += f.pointerMovement || 0;
        fScroll += f.scrollDistance || 0;
        fRevision += f.revisionCount || 0;
        fPaste += f.pasteDetected ? 1 : 0;
      });
      fTime /= count;
      fPointer /= count;
      fScroll /= count;
      fRevision /= count;
      fPaste = (fPaste / count) * 100;
    } else {
      fTime = session.features.responseTime || 0;
      fPointer = session.features.pointerMovement || 0;
      fScroll = session.features.scrollDistance || 0;
      fRevision = session.features.revisionCount || 0;
      fPaste = session.features.pasteDetected || 0;
    }

    features.responseTime.push(fTime);
    features.revisionCount.push(fRevision);
    features.pointerMovement.push(fPointer);
    features.scrollDistance.push(fScroll);
    features.pasteDetected.push(fPaste);

    // Row vector in exact canonical order
    observationMatrix.push([fTime, fRevision, fPointer, fScroll, fPaste]);
  });

  const expectations: FeatureExpectation[] = [
    { feature: 'responseTime', label: 'Response Time', unit: 's', ...calculateStats(features.responseTime) },
    { feature: 'revisionCount', label: 'Revision Count', unit: 'revisions', ...calculateStats(features.revisionCount) },
    { feature: 'pointerMovement', label: 'Pointer Movement', unit: 'px', ...calculateStats(features.pointerMovement) },
    { feature: 'scrollDistance', label: 'Scroll Distance', unit: 'px', ...calculateStats(features.scrollDistance) },
    { feature: 'pasteDetected', label: 'Paste Frequency', unit: '%', ...calculateStats(features.pasteDetected) },
  ];

  const baseUncertainty = Math.max(0.05, 1 - confidence / 100);
  const uncertainties: FeatureUncertainty[] = expectations.map((exp) => ({
    feature: exp.feature,
    uncertainty: Number(Math.min(1, baseUncertainty * (1 + Math.random() * 0.2)).toFixed(3)),
    sampleSize: trainingSessions.length,
  }));

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
    expectations,
    uncertainties,
    covarianceMatrix,
    correlationMatrix,
    inverseCorrelationMatrix: inverseCorrelation,
    shrinkageLambda,
    featureOrder: [...ORDERED_FEATURES],
  };

  // Run Conformal Calibration on held-out calibration sessions
  const calibratedThreshold = calculateConformalThreshold(baseModel, calibrationSessions);
  baseModel.calibratedThreshold = calibratedThreshold;

  return baseModel;
}
