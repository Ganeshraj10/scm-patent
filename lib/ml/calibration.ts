/**
 * ============================================================================
 * EXAMGUARD — PHASE 3/B: CONFORMAL & QUANTILE THRESHOLD CALIBRATION MODULE
 * ============================================================================
 * Calibrates model-specific decision thresholds using separate, held-out
 * calibration data targeting a fixed false positive rate (default alpha = 0.05).
 *
 * Implements distribution-free split-conformal calibration with finite-sample
 * correction without ever accessing test labels.
 *
 * Mathematical Foundations (Vovk et al. 2005; Lei et al. 2018; Angelopoulos & Bates 2021):
 * - Given m exchangeable non-conformity calibration scores S_1, ..., S_m,
 *   the finite-sample split-conformal quantile rank is:
 *     k = ceil((m + 1) * (1 - alpha))
 * - When k <= m:
 *     Threshold = S_{(k)} (the k-th order statistic).
 *     Theoretical guarantee under exchangeability: P(S_{m+1} <= S_{(k)}) >= (1 - alpha).
 * - When k = m + 1 (occurring whenever m < (1 - alpha) / alpha):
 *     Only m calibration scores exist, so S_{(m+1)} = +Infinity.
 *     A finite distribution-free guarantee is mathematically impossible for sample size m.
 *     The threshold is formally +Infinity (or -Infinity for lower-is-anomalous).
 *     Clamping k to m without explicit infinite designation is mathematically invalid,
 *     as it guarantees only m / (m + 1) < (1 - alpha) coverage.
 */

import { ScoreOrientation } from './types';

export interface CalibrationResult {
  targetFPR: number; // alpha
  sampleSize: number; // m
  conformalRank: number; // k = ceil((m + 1) * (1 - alpha))
  minRequiredSampleSize: number; // ceil((1 - alpha) / alpha)
  calibratedThreshold: number; // Finite float or Infinity / -Infinity
  isInfiniteThreshold: boolean; // True if k > m or k < 1
  scoreOrientation: ScoreOrientation;
  minCalScore: number;
  maxCalScore: number;
  medianCalScore: number;
  guaranteedCoverage: number; // Exact finite-sample coverage fraction
}

/**
 * Computes the minimum calibration sample size required to yield a finite
 * threshold at significance level alpha without uninformative infinity.
 *
 * Formula: m >= (1 - alpha) / alpha
 * For alpha = 0.05: m >= 0.95 / 0.05 = 19
 * For alpha = 0.01: m >= 0.99 / 0.01 = 99
 * For alpha = 0.10: m >= 0.90 / 0.10 = 9
 */
export function getMinimumConformalSampleSize(alpha: number = 0.05): number {
  if (alpha <= 0 || alpha >= 1) {
    throw new Error(`[Conformal Calibration] Invalid alpha ${alpha}. Must be in (0, 1).`);
  }
  return Math.ceil((1 - alpha) / alpha);
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

  if (targetFPR <= 0 || targetFPR >= 1) {
    throw new Error(`[Calibration] targetFPR must be in (0, 1), received ${targetFPR}`);
  }

  const m = calibrationScores.length;
  const sorted = [...calibrationScores].sort((a, b) => a - b);
  const minRequired = getMinimumConformalSampleSize(targetFPR);

  let threshold: number;
  let isInfinite = false;
  let conformalRank: number;
  let guaranteedCoverage: number;

  if (orientation === 'higher_is_more_anomalous') {
    // For higher = anomalous, threshold is the (1 - alpha) quantile.
    // Finite-sample split-conformal index: k = ceil((m + 1) * (1 - targetFPR))
    conformalRank = Math.ceil((m + 1) * (1 - targetFPR));

    if (conformalRank > m) {
      // Finite-sample sample size m is strictly insufficient for target alpha
      // Example: m = 10, alpha = 0.05 -> k = ceil(11 * 0.95) = 11 > 10
      isInfinite = true;
      threshold = Infinity;
      guaranteedCoverage = 1.0; // [-inf, +inf) trivial coverage
    } else {
      isInfinite = false;
      const idx = Math.max(0, conformalRank - 1);
      threshold = sorted[idx];
      guaranteedCoverage = conformalRank / (m + 1);
    }
  } else {
    // For lower = anomalous (e.g. raw decision function), threshold is alpha quantile
    // k = floor((m + 1) * targetFPR)
    conformalRank = Math.floor((m + 1) * targetFPR);

    if (conformalRank < 1) {
      isInfinite = true;
      threshold = -Infinity;
      guaranteedCoverage = 1.0;
    } else {
      isInfinite = false;
      const idx = Math.max(0, conformalRank - 1);
      threshold = sorted[idx];
      guaranteedCoverage = 1.0 - (conformalRank / (m + 1));
    }
  }

  return {
    targetFPR,
    sampleSize: m,
    conformalRank,
    minRequiredSampleSize: minRequired,
    calibratedThreshold: isInfinite ? threshold : Number(threshold.toFixed(5)),
    isInfiniteThreshold: isInfinite,
    scoreOrientation: orientation,
    minCalScore: Number(sorted[0].toFixed(5)),
    maxCalScore: Number(sorted[m - 1].toFixed(5)),
    medianCalScore: Number(sorted[Math.floor(m / 2)].toFixed(5)),
    guaranteedCoverage: Number(guaranteedCoverage.toFixed(4)),
  };
}
