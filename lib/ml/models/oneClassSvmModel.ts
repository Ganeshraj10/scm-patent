/**
 * ============================================================================
 * EXAMGUARD — MODEL 4: ONE-CLASS SUPPORT VECTOR MACHINE (OC-SVM)
 * ============================================================================
 * Non-linear kernel boundary novelty detector (Schölkopf, Smola, et al., 1999).
 *
 * Mathematical Specification:
 * - Dual Quadratic Program:
 *     min_alpha (1/2) * sum_{i,j=1}^l alpha_i * alpha_j * K(x_i, x_j)
 *     s.t.  0 <= alpha_i <= 1 / (nu * l),   sum_{i=1}^l alpha_i = 1
 * - RBF Kernel:
 *     K(x, x') = exp( - gamma * ||x - x'||^2 )
 *     where gamma = 1 / p ('scale' heuristic with p = 5 features -> gamma = 0.2).
 * - Hyperparameters:
 *     nu in (0, 1]: Upper bound on fraction of outliers / lower bound on support vectors (default: 0.05).
 *     gamma: Kernel bandwidth (default: 0.2).
 * - Offset rho:
 *     rho = (1 / |SV_free|) * sum_{i in SV_free} sum_k alpha_k K(x_k, x_i)
 *     where SV_free = { i | 0 < alpha_i < C }.
 * - Decision Function:
 *     f(x) = sum_{i in SV} alpha_i * K(x_i, x) - rho
 * - Raw Anomaly Score:
 *     s(x) = -f(x) = rho - sum_{i in SV} alpha_i * K(x_i, x)
 * - Score Orientation: 'higher_is_more_anomalous'
 *     s(x) <= 0: Core interior of normal support.
 *     s(x) > 0: Moving away from normal support hyperplane.
 */

import {
  IAnomalyDetectionModel,
  ModelMetadata,
  AnomalyPrediction,
  ML_ORDERED_FEATURES,
} from '../types';
import { StandardScaler } from '../preprocessing';
import { calibrateThreshold } from '../calibration';

export interface OneClassSVMHyperparameters {
  nu?: number; // Outlier bound in (0, 1] (default: 0.05)
  gamma?: number; // RBF bandwidth (default: 1 / 5 = 0.2)
  maxIterations?: number; // Max SMO iterations (default: 500)
  tolerance?: number; // KKT stopping tolerance (default: 1e-3)
  targetFPR?: number; // Target FPR for conformal calibration (default: 0.05)
}

interface SupportVector {
  vector: number[];
  alpha: number;
}

export class OneClassSVMModel implements IAnomalyDetectionModel {
  public readonly modelName = 'One-Class SVM';
  public readonly modelFamily = 'support_vector_kernel';
  public readonly version = '1.3.0-smo-rbf';
  public readonly scoreOrientation = 'higher_is_more_anomalous' as const;

  private scaler: StandardScaler;
  private nu: number = 0.05;
  private gamma: number = 0.2; // 1 / 5 features
  private maxIterations: number = 500;
  private tolerance: number = 1e-3;
  private targetFPR: number = 0.05;

  private supportVectors: SupportVector[] = [];
  private rho: number = 0;
  private calibratedThreshold: number | null = null;
  private nTrain: number = 0;
  private nCal: number = 0;
  private isFitted: boolean = false;

  constructor(options: OneClassSVMHyperparameters = {}) {
    this.scaler = new StandardScaler();
    if (options.nu !== undefined) this.nu = Math.max(1e-4, Math.min(1.0, options.nu));
    if (options.gamma !== undefined) this.gamma = options.gamma;
    if (options.maxIterations !== undefined) this.maxIterations = options.maxIterations;
    if (options.tolerance !== undefined) this.tolerance = options.tolerance;
    if (options.targetFPR !== undefined) this.targetFPR = options.targetFPR;
  }

  /**
   * Fits One-Class SVM using Platt's Sequential Minimal Optimization (SMO).
   * @param trainingData N x 5 matrix of baseline telemetry
   */
  fit(trainingData: number[][]): void {
    if (!trainingData || trainingData.length === 0) {
      throw new Error(`[${this.modelName}] Training data cannot be empty.`);
    }

    this.scaler.fit(trainingData);
    const X = this.scaler.transform(trainingData);
    const l = X.length;
    this.nTrain = l;

    const C = 1.0 / (this.nu * l);

    // Initial feasible point: alpha_i = 1 / l for all i
    // Satisfies sum(alpha_i) = 1 and 0 <= alpha_i <= C (since C >= 1/l)
    const alpha: number[] = new Array(l).fill(1.0 / l);

    // Precompute kernel matrix K[i][j] = exp(-gamma * ||x_i - x_j||^2)
    const K: number[][] = Array.from({ length: l }, () => new Array(l).fill(1));
    for (let i = 0; i < l; i++) {
      for (let j = i + 1; j < l; j++) {
        const kVal = this.rbfKernel(X[i], X[j]);
        K[i][j] = kVal;
        K[j][i] = kVal;
      }
    }

    // Gradient vector g_i = (K * alpha)_i
    const g: number[] = new Array(l).fill(0);
    for (let i = 0; i < l; i++) {
      let sum = 0;
      for (let j = 0; j < l; j++) {
        sum += alpha[j] * K[i][j];
      }
      g[i] = sum;
    }

    // SMO optimization loop
    let iter = 0;
    while (iter < this.maxIterations) {
      // Find pair violating KKT conditions:
      // In OC-SVM, the KKT conditions imply that for all i:
      // If alpha_i = 0, g_i >= rho
      // If 0 < alpha_i < C, g_i == rho
      // If alpha_i = C, g_i <= rho
      // Thus, min_{i: alpha_i < C} g_i >= max_{j: alpha_j > 0} g_j within tolerance.

      let iMin = -1;
      let minG = Infinity;
      let jMax = -1;
      let maxG = -Infinity;

      for (let k = 0; k < l; k++) {
        if (alpha[k] < C - 1e-8) {
          if (g[k] < minG) {
            minG = g[k];
            iMin = k;
          }
        }
        if (alpha[k] > 1e-8) {
          if (g[k] > maxG) {
            maxG = g[k];
            jMax = k;
          }
        }
      }

      // KKT condition check
      if (maxG - minG <= this.tolerance || iMin === -1 || jMax === -1) {
        break;
      }

      const i = iMin;
      const j = jMax;

      // Coordinate descent along alpha[i] and alpha[j] keeping sum constant
      // alpha[i] + alpha[j] = delta
      const delta = alpha[i] + alpha[j];
      const eta = K[i][i] + K[j][j] - 2.0 * K[i][j];

      if (eta <= 1e-10) {
        iter++;
        continue;
      }

      // Unconstrained step: minimizing dual objective along delta
      // alpha_i_new = alpha_i_old + (g_j - g_i) / eta
      const alpha_i_new = alpha[i] + (g[j] - g[i]) / eta;

      // Box constraints: 0 <= alpha <= C, alpha[i] + alpha[j] = delta
      const L = Math.max(0, delta - C);
      const H = Math.min(C, delta);

      const alpha_i_clipped = Math.min(H, Math.max(L, alpha_i_new));
      const alpha_j_clipped = delta - alpha_i_clipped;

      const delta_i = alpha_i_clipped - alpha[i];
      const delta_j = alpha_j_clipped - alpha[j];

      alpha[i] = alpha_i_clipped;
      alpha[j] = alpha_j_clipped;

      // Update gradient cache: g_k += delta_i * K[k][i] + delta_j * K[k][j]
      for (let k = 0; k < l; k++) {
        g[k] += delta_i * K[k][i] + delta_j * K[k][j];
      }

      iter++;
    }

    // Compute threshold offset rho
    // Average g_k for free support vectors (0 < alpha_k < C)
    const freeG: number[] = [];
    const allSV_G: number[] = [];

    for (let k = 0; k < l; k++) {
      if (alpha[k] > 1e-6) {
        allSV_G.push(g[k]);
        if (alpha[k] < C - 1e-6) {
          freeG.push(g[k]);
        }
      }
    }

    if (freeG.length > 0) {
      this.rho = freeG.reduce((sum, v) => sum + v, 0) / freeG.length;
    } else if (allSV_G.length > 0) {
      this.rho = allSV_G.reduce((sum, v) => sum + v, 0) / allSV_G.length;
    } else {
      this.rho = 0.5;
    }

    // Store support vectors
    this.supportVectors = [];
    for (let k = 0; k < l; k++) {
      if (alpha[k] > 1e-6) {
        this.supportVectors.push({
          vector: X[k],
          alpha: alpha[k],
        });
      }
    }

    this.isFitted = true;
  }

  /**
   * Scores an unseen observation.
   * Decision margin: f(x) = sum_i alpha_i * K(x_i, x) - rho
   * Raw Anomaly Score: -f(x) = rho - sum_i alpha_i * K(x_i, x)
   * Higher score indicates higher deviation from baseline support boundary.
   */
  predict_score(observation: number[]): number {
    if (!this.isFitted) {
      throw new Error(`[${this.modelName}] Model must be fitted before predict_score.`);
    }

    const z = this.scaler.transformVector(observation);

    let kernelSum = 0;
    for (const sv of this.supportVectors) {
      const kVal = this.rbfKernel(sv.vector, z);
      kernelSum += sv.alpha * kVal;
    }

    const decisionMargin = kernelSum - this.rho;
    // Anomaly score is negated decision margin (higher = more anomalous)
    const anomalyScore = -decisionMargin;
    return Number(anomalyScore.toFixed(4));
  }

  /**
   * Calibrates threshold on held-out calibration sessions.
   */
  calibrate(calibrationData: number[][], targetFPR?: number): number {
    if (!this.isFitted) {
      throw new Error(`[${this.modelName}] Model must be fitted before calibration.`);
    }
    if (!calibrationData || calibrationData.length === 0) {
      throw new Error(`[${this.modelName}] Calibration data cannot be empty.`);
    }

    if (targetFPR !== undefined) this.targetFPR = targetFPR;
    this.nCal = calibrationData.length;

    const scores = calibrationData.map((obs) => this.predict_score(obs));
    const result = calibrateThreshold(scores, this.targetFPR, this.scoreOrientation);
    this.calibratedThreshold = result.calibratedThreshold;
    return this.calibratedThreshold;
  }

  /**
   * Evaluates prediction for an observation.
   */
  predict(
    observation: number[],
    sessionId: string = 'unknown_session',
    studentId: string = 'unknown_student',
    timestamp: string = new Date().toISOString()
  ): AnomalyPrediction {
    const rawScore = this.predict_score(observation);
    const threshold = this.calibratedThreshold ?? 0.0;
    const isAnomaly = rawScore > threshold;

    const z = this.scaler.transformVector(observation);
    const featureContributions: Record<string, number> = {};
    ML_ORDERED_FEATURES.forEach((featureKey, idx) => {
      featureContributions[featureKey] = Number(Math.abs(z[idx]).toFixed(3));
    });

    return {
      studentId,
      sessionId,
      modelName: this.modelName,
      rawAnomalyScore: rawScore,
      scoreOrientation: this.scoreOrientation,
      calibratedThreshold: threshold,
      isAnomaly,
      reviewStatus: isAnomaly ? 'review_required' : 'normal',
      modelVersion: this.version,
      timestamp,
      dataQualityStatus: observation.some((val) => isNaN(val)) ? 'imputed_missing_features' : 'complete',
      featureContributions,
    };
  }

  get_metadata(): ModelMetadata {
    return {
      modelName: this.modelName,
      modelFamily: this.modelFamily,
      version: this.version,
      scoreOrientation: this.scoreOrientation,
      hyperparameters: {
        nu: this.nu,
        gamma: this.gamma,
        supportVectorCount: this.supportVectors.length,
        rho: Number(this.rho.toFixed(4)),
      },
      trainingObservationCount: this.nTrain,
      calibrationObservationCount: this.nCal,
      calibratedThreshold: this.calibratedThreshold,
      targetFPR: this.targetFPR,
    };
  }

  private rbfKernel(a: number[], b: number[]): number {
    let sumSq = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sumSq += diff * diff;
    }
    return Math.exp(-this.gamma * sumSq);
  }
}

