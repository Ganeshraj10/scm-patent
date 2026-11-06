/**
 * ============================================================================
 * EXAMGUARD — PHASE 3: TRAINING-ONLY PREPROCESSING & STANDARDSCALER
 * ============================================================================
 * Enforces strict statistical isolation: feature means and standard deviations
 * are fitted exclusively on training baseline observations. Missing values
 * are imputed to baseline means (residual z_j = 0).
 */

import { ML_ORDERED_FEATURES, MLFeatureKey } from './types';

export class StandardScaler {
  public means: number[] = [];
  public stdDevs: number[] = [];
  public isFitted: boolean = false;
  private readonly epsilon: number = 0.5;

  /**
   * Fits the scaler strictly on training observations.
   * @param X Array of 5-dimensional feature vectors (N x 5)
   */
  fit(X: number[][]): this {
    if (!X || X.length === 0) {
      throw new Error('[StandardScaler] Cannot fit on empty observation array.');
    }

    const n = X.length;
    const p = ML_ORDERED_FEATURES.length;

    this.means = new Array(p).fill(0);
    this.stdDevs = new Array(p).fill(1);

    // 1. Calculate sample means
    for (let j = 0; j < p; j++) {
      let sum = 0;
      let validCount = 0;
      for (let i = 0; i < n; i++) {
        const val = X[i][j];
        if (val !== undefined && val !== null && !isNaN(val)) {
          sum += val;
          validCount++;
        }
      }
      this.means[j] = validCount > 0 ? sum / validCount : 0;
    }

    // 2. Calculate sample standard deviations
    for (let j = 0; j < p; j++) {
      let sumSq = 0;
      let validCount = 0;
      const m = this.means[j];
      for (let i = 0; i < n; i++) {
        const val = X[i][j];
        if (val !== undefined && val !== null && !isNaN(val)) {
          sumSq += Math.pow(val - m, 2);
          validCount++;
        }
      }
      const variance = validCount > 1 ? sumSq / (validCount - 1) : 0;
      this.stdDevs[j] = Math.max(Math.sqrt(variance), this.epsilon);
    }

    this.isFitted = true;
    return this;
  }

  /**
   * Transforms a single observation into standardized z-score vector.
   * Handles missing values by imputing mean mu_j (resulting in z_j = 0).
   */
  transformVector(x: number[]): number[] {
    if (!this.isFitted) {
      throw new Error('[StandardScaler] Scaler must be fitted before transforming.');
    }

    const p = ML_ORDERED_FEATURES.length;
    const z = new Array(p).fill(0);

    for (let j = 0; j < p; j++) {
      const val = x[j];
      // Missing-value policy: unobserved telemetry imputes mean mu_j (z = 0)
      if (val === undefined || val === null || isNaN(val)) {
        z[j] = 0;
      } else {
        z[j] = (val - this.means[j]) / this.stdDevs[j];
      }
    }

    return z;
  }

  /**
   * Transforms a batch of observations (M x 5).
   */
  transform(X: number[][]): number[][] {
    return X.map((row) => this.transformVector(row));
  }

  /**
   * Extracts vector from an aggregated feature dictionary.
   */
  static extractVector(features: Record<string, number>): number[] {
    return ML_ORDERED_FEATURES.map((key) => {
      const val = features[key];
      return val !== undefined && val !== null && !isNaN(val) ? Number(val) : NaN;
    });
  }
}

