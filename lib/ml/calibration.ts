/**
 * ============================================================================
 * EXAMGUARD — PHASE 3: CONFORMAL & QUANTILE THRESHOLD CALIBRATION MODULE
 * ============================================================================
 * Calibrates model-specific decision thresholds using separate, held-out
 * calibration data targeting a fixed false positive rate (default alpha = 0.05).
 *
 * Implements distribution-free split-conformal calibration with finite-sample
 * correction without ever accessing test labels.
 */

import { ScoreOrientation } from './types';

export interface CalibrationResult {
  targetFPR: number;
  sampleSize: number;
  calibratedThreshold: number;
  scoreOrientation: ScoreOrientation;
  minCalScore: number;
  maxCalScore: number;
  medianCalScore: number;
}

/**
 * Computes the distribution-free calibrated threshold at target false positive rate alpha.
 *
 * @param calibrationScores Array of anomaly scores evaluated on held-out normal baseline sessions
 * @param targetFPR Target false positive rate (e.g. 0.05 for 5% FPR)
 * @param orientation Score direction ('higher_is_more_anomalous' or 'lower_is_more_anomalous')
 */
export function calibrateThreshold(
  calibrationScores: number[],
  targetFPR: number = 0.05,
  orientation: ScoreOrientation = 'higher_is_more_anomalous'
): CalibrationResult {
  if (!calibrationScores || calibrationScores.length === 0) {
    throw new Error('[Calibration] Cannot calibrate threshold on empty calibration scores.');
  }

  const m = calibrationScores.length;
  const sorted = [...calibrationScores].sort((a, b) => a - b);

  let threshold: number;

  if (orientation === 'higher_is_more_anomalous') {
    // For higher = anomalous, threshold is the (1 - alpha) quantile.
    // Finite-sample split-conformal index: k = ceil((m + 1) * (1 - alpha))
    const rank = Math.ceil((m + 1) * (1 - targetFPR));
    const idx = Math.min(m - 1, Math.max(0, rank - 1));
    threshold = sorted[idx];
  } else {
    // For lower = anomalous (e.g. raw OC-SVM decision function), threshold is alpha quantile
    const rank = Math.max(1, Math.floor((m + 1) * targetFPR));
    const idx = Math.min(m - 1, Math.max(0, rank - 1));
    threshold = sorted[idx];
  }

  return {
    targetFPR,
    sampleSize: m,
    calibratedThreshold: Number(threshold.toFixed(5)),
    scoreOrientation: orientation,
    minCalScore: Number(sorted[0].toFixed(5)),
    maxCalScore: Number(sorted[m - 1].toFixed(5)),
    medianCalScore: Number(sorted[Math.floor(m / 2)].toFixed(5)),
  };
}

