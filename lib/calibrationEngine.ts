import { BehavioralModel, BehavioralSession } from '@/types';
import { calculateRawDeviationScore } from './deviationEngine';

/**
 * Conformal Distribution-Free Calibration Engine (Phase 6)
 * 
 * Takes a student's historical low-stakes sessions, chronologically splits them 
 * (80% training / 20% calibration), and derives an empirical non-conformity 
 * threshold for use in the deviation engine.
 */
export function calculateConformalThreshold(
  trainingModel: BehavioralModel,
  calibrationSessions: BehavioralSession[]
): number {
  if (calibrationSessions.length === 0) {
    // Extreme cold start fallback
    return 2.5;
  }

  // Calculate non-conformity scores (prototype deviations) for the held-out calibration set
  const nonConformityScores = calibrationSessions.map(session => {
    return calculateRawDeviationScore(session.features || [], trainingModel);
  });

  // Sort scores ascending for empirical quantile calculation
  nonConformityScores.sort((a, b) => a - b);

  // Calculate the (1 - alpha) quantile. We use alpha = 0.05 for a 95% confidence threshold.
  const alpha = 0.05;
  const targetIndex = Math.ceil((1 - alpha) * nonConformityScores.length) - 1;
  const safeIndex = Math.max(0, Math.min(targetIndex, nonConformityScores.length - 1));
  
  const baseQuantileScore = nonConformityScores[safeIndex];

  // For small n (e.g. 2 calibration sessions), the empirical quantile will just be the maximum.
  // We add conformal padding to ensure the threshold isn't too strict on small, noisy datasets.
  const conformalPadding = nonConformityScores.length < 5 ? 0.5 : 0.1;
  
  // Also enforce an absolute minimum threshold so extremely tight training data doesn't
  // cause normal variance to flag immediately.
  const ABSOLUTE_MINIMUM_THRESHOLD = 1.5;

  return Math.max(ABSOLUTE_MINIMUM_THRESHOLD, baseQuantileScore + conformalPadding);
}
