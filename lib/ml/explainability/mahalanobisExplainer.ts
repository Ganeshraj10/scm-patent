/**
 * ============================================================================
 * EXAMGUARD — PHASE 4: MAHALANOBIS EXPLAINABILITY MODULE
 * ============================================================================
 * Mathematical Specification:
 * 1. Baseline Comparison:
 *    - Baseline Mean: mu_j
 *    - Baseline Standard Deviation: sigma_j
 *    - Signed Standardized Deviation: z_j = (x_j - mu_j) / sigma_j
 * 2. Conditional Expected Values:
 *    - E[z_j | z_{-j}] = R_{j, -j} * (R_{-j, -j})^-1 * z_{-j}
 *    - E[x_j | x_{-j}] = mu_j + sigma_j * E[z_j | z_{-j}]
 *    - Residual r_j = z_j - E[z_j | z_{-j}] (deviation unexplained by correlations)
 * 3. Covariance-Aware Feature Removal Sensitivity:
 *    - D_M(x) = sqrt( z^T * R_reg^-1 * z )
 *    - D_{M, -j}(x) = sqrt( z_{-j}^T * (R_{-j, -j})^-1 * z_{-j} )
 *    - Delta D_{M, j} = D_M(x) - D_{M, -j}(x)
 *    Accounts for cross-correlations by re-inverting the submatrix without feature j.
 * 4. Covariance Coupling Decomposition:
 *    - D_M^2 = sum_j W_jj * z_j^2 + 2 * sum_{j < k} W_jk * z_j * z_k
 *    Demonstrates why individual z-scores cannot be presented as independent contributions.
 */

import { ML_ORDERED_FEATURES, MLFeatureKey } from '../types';
import { RegularizedMahalanobisModel } from '../models/mahalanobisModel';
import {
  FeatureAttribution,
  ModelExplanationResult,
  CovarianceCouplingDetail,
  HumanReviewCategory,
} from './types';

/**
 * Inverts an n x n square matrix using Gauss-Jordan elimination with partial pivoting
 * and adaptive Tikhonov ridge regularisation for ill-conditioned submatrices.
 */
function invertSquareMatrix(matrix: number[][]): number[][] {
  const n = matrix.length;
  const ridgeLevels = [0, 1e-4, 1e-3, 1e-2, 1e-1];

  for (const delta of ridgeLevels) {
    const A: number[][] = matrix.map((row, i) => {
      const aug = new Array(2 * n).fill(0);
      for (let j = 0; j < n; j++) aug[j] = row[j] + (i === j ? delta : 0);
      aug[n + i] = 1;
      return aug;
    });

    let success = true;

    for (let i = 0; i < n; i++) {
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) {
          maxRow = k;
        }
      }
      const temp = A[i];
      A[i] = A[maxRow];
      A[maxRow] = temp;

      const pivot = A[i][i];
      if (Math.abs(pivot) < 1e-12 || !isFinite(pivot) || isNaN(pivot)) {
        success = false;
        break;
      }

      for (let j = 0; j < 2 * n; j++) {
        A[i][j] /= pivot;
      }

      for (let k = 0; k < n; k++) {
        if (k !== i) {
          const factor = A[k][i];
          for (let j = 0; j < 2 * n; j++) {
            A[k][j] -= factor * A[i][j];
          }
        }
      }
    }

    if (success) {
      const inv = A.map((row) => row.slice(n));
      const allFinite = inv.every((r) => r.every((val) => isFinite(val) && !isNaN(val)));
      if (allFinite) return inv;
    }
  }

  // Explicit failure fallback for strictly non-invertible matrices
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => (r === c ? 1 : 0)));
}

const FEATURE_METADATA: Record<MLFeatureKey, { displayName: string; unit: string; baseThreshold: number }> = {
  responseTime: { displayName: 'Response Time', unit: 'seconds', baseThreshold: 2.0 },
  revisionCount: { displayName: 'Answer Revisions', unit: 'count', baseThreshold: 2.0 },
  pointerMovement: { displayName: 'Pointer Movement', unit: 'pixels', baseThreshold: 2.0 },
  scrollDistance: { displayName: 'Scroll Displacement', unit: 'pixels', baseThreshold: 2.0 },
  pasteDetected: { displayName: 'Paste Activity', unit: 'events', baseThreshold: 1.0 },
};

export class MahalanobisExplainer {
  /**
   * Generates a comprehensive, covariance-aware explanation for a Mahalanobis prediction.
   */
  static explain(
    model: RegularizedMahalanobisModel,
    observation: number[],
    sessionId: string = 'SESSION-ANON',
    studentId: string = 'STUDENT-ANON',
    timestamp: string = new Date().toISOString()
  ): ModelExplanationResult {
    const meta = model.get_metadata();
    const prediction = model.predict(observation, sessionId, studentId, timestamp);
    const p = ML_ORDERED_FEATURES.length;

    // Retrieve internal model matrices via get_metadata / internal getters
    // Extract regularized correlation and inverse correlation matrices
    const R_reg = (model as any).regularizedCorrelation as number[][];
    const W = (model as any).inverseCorrelation as number[][];
    const scaler = (model as any).scaler;

    if (!scaler || !scaler.isFitted || !R_reg || !W) {
      throw new Error('[MahalanobisExplainer] Model must be fitted before generating explanations.');
    }

    const z = scaler.transformVector(observation);
    const D_total = prediction.rawAnomalyScore;

    // 1. Compute Conditional Expected Values E[z_j | z_{-j}]
    const conditionalExpectedResiduals: Record<MLFeatureKey, number> = {} as any;
    const conditionalExpectedX: number[] = new Array(p).fill(0);

    for (let j = 0; j < p; j++) {
      // Partition correlation matrix for feature j
      const indicesMinusJ = Array.from({ length: p }, (_, idx) => idx).filter((idx) => idx !== j);
      const R_sub: number[][] = indicesMinusJ.map((r) => indicesMinusJ.map((c) => R_reg[r][c]));
      const R_cross: number[] = indicesMinusJ.map((r) => R_reg[j][r]);
      const z_sub: number[] = indicesMinusJ.map((idx) => z[idx]);

      try {
        const R_sub_inv = invertSquareMatrix(R_sub);
        // E[z_j | z_{-j}] = R_cross * R_sub_inv * z_sub
        let expected_zj = 0;
        for (let a = 0; a < p - 1; a++) {
          let inner = 0;
          for (let b = 0; b < p - 1; b++) {
            inner += R_sub_inv[a][b] * z_sub[b];
          }
          expected_zj += R_cross[a] * inner;
        }

        conditionalExpectedX[j] = scaler.means[j] + scaler.stdDevs[j] * expected_zj;
        conditionalExpectedResiduals[ML_ORDERED_FEATURES[j]] = Number((z[j] - expected_zj).toFixed(3));
      } catch {
        conditionalExpectedX[j] = scaler.means[j];
        conditionalExpectedResiduals[ML_ORDERED_FEATURES[j]] = Number(z[j].toFixed(3));
      }
    }

    // 2. Feature-Removal Sensitivity Analysis Delta D_{M, j}
    const removalDeltas: number[] = new Array(p).fill(0);
    for (let j = 0; j < p; j++) {
      const indicesMinusJ = Array.from({ length: p }, (_, idx) => idx).filter((idx) => idx !== j);
      const R_sub: number[][] = indicesMinusJ.map((r) => indicesMinusJ.map((c) => R_reg[r][c]));
      const z_sub: number[] = indicesMinusJ.map((idx) => z[idx]);

      try {
        const R_sub_inv = invertSquareMatrix(R_sub);
        let dSubSq = 0;
        for (let a = 0; a < p - 1; a++) {
          for (let b = 0; b < p - 1; b++) {
            dSubSq += z_sub[a] * R_sub_inv[a][b] * z_sub[b];
          }
        }
        const D_sub = Math.sqrt(Math.max(0, dSubSq));
        // Sensitivity is reduction in distance when feature j is removed
        removalDeltas[j] = Math.max(0, D_total - D_sub);
      } catch {
        removalDeltas[j] = Math.abs(z[j]);
      }
    }

    const totalDelta = removalDeltas.reduce((sum, d) => sum + d, 0) || 1e-6;

    // 3. Covariance Coupling Decomposition W_jk * z_j * z_k
    const covarianceCouplings: CovarianceCouplingDetail[] = [];
    for (let j = 0; j < p; j++) {
      for (let k = j + 1; k < p; k++) {
        const couplingVal = 2 * W[j][k] * z[j] * z[k];
        covarianceCouplings.push({
          featureA: ML_ORDERED_FEATURES[j],
          featureB: ML_ORDERED_FEATURES[k],
          correlation: Number(R_reg[j][k].toFixed(3)),
          inverseCorrelationTerm: Number(W[j][k].toFixed(3)),
          couplingContribution: Number(couplingVal.toFixed(3)),
        });
      }
    }

    // 4. Build Standardized Feature Attributions
    const features: FeatureAttribution[] = ML_ORDERED_FEATURES.map((featureKey, idx) => {
      const metaInfo = FEATURE_METADATA[featureKey];
      const observedVal = observation[idx];
      const baselineMean = scaler.means[idx];
      const baselineStdDev = scaler.stdDevs[idx];
      const signedZ = z[idx];
      const perturbationImpact = removalDeltas[idx];
      const attributionScore = Number((perturbationImpact / totalDelta).toFixed(3));

      let directionalEffect: 'accelerating_deviation' | 'dampening_deviation' | 'neutral' = 'neutral';
      if (perturbationImpact > 0.1) directionalEffect = 'accelerating_deviation';
      else if (perturbationImpact < -0.05) directionalEffect = 'dampening_deviation';

      const humanDescription = MahalanobisExplainer.buildHumanDescription(
        featureKey,
        observedVal,
        baselineMean,
        signedZ,
        metaInfo.unit
      );

      return {
        featureKey,
        displayName: metaInfo.displayName,
        unit: metaInfo.unit,
        observedValue: Number(observedVal !== undefined && !isNaN(observedVal) ? observedVal.toFixed(2) : baselineMean.toFixed(2)),
        baselineMean: Number(baselineMean.toFixed(2)),
        baselineStdDev: Number(baselineStdDev.toFixed(2)),
        standardizedDeviation: Number(signedZ.toFixed(2)),
        expectedConditionalValue: Number(conditionalExpectedX[idx].toFixed(2)),
        attributionScore,
        attributionRank: 1, // updated below
        perturbationImpact: Number(perturbationImpact.toFixed(3)),
        directionalEffect,
        humanDescription,
      };
    });

    // Sort features by attribution score to assign ranks
    const sortedIndices = features
      .map((f, idx) => ({ idx, score: f.perturbationImpact }))
      .sort((a, b) => b.score - a.score);
    sortedIndices.forEach((item, rank) => {
      features[item.idx].attributionRank = rank + 1;
    });

    const topFeature = features[sortedIndices[0].idx].featureKey;

    // Review category determination
    let reviewCategory: HumanReviewCategory = 'Normal behaviour';
    if (prediction.isAnomaly) {
      reviewCategory = prediction.rawAnomalyScore > prediction.calibratedThreshold * 1.3
        ? 'Review required'
        : 'Behavioural deviation detected';
    }

    // Faithfulness score: percentage of anomaly score reduced when top feature neutralized
    const topDelta = removalDeltas[sortedIndices[0].idx];
    const explanationFaithfulnessScore = Number(
      Math.min(1.0, Math.max(0, topDelta / (D_total || 1))).toFixed(3)
    );

    return {
      modelName: model.modelName,
      modelVersion: model.version,
      sessionId,
      studentId,
      timestamp,
      rawAnomalyScore: prediction.rawAnomalyScore,
      calibratedThreshold: prediction.calibratedThreshold,
      isAnomaly: prediction.isAnomaly,
      scoreOrientation: model.scoreOrientation,
      reviewCategory,
      dataQualityStatus: observation.some((v) => isNaN(v)) ? 'imputed_missing_features' : 'complete',
      dataQualityNotes: observation.some((v) => isNaN(v))
        ? ['One or more telemetry features were unobserved and imputed to personal baseline mean.']
        : undefined,
      features,
      topContributingFeature: topFeature,
      mahalanobisCoupling: {
        isCovarianceAccountedFor: true,
        covarianceCouplings,
        conditionalExpectedResiduals,
        disclaimer:
          'Individual standardised z-scores cannot be interpreted as independent contributions because off-diagonal cross-feature covariances couple the metrics.',
      },
      explanationFaithfulnessScore,
      nonCausalDisclaimer:
        'This explanation details statistical behavioural associations relative to personal baseline. It does not establish causal intent or prove misconduct.',
    };
  }

  private static buildHumanDescription(
    key: MLFeatureKey,
    observed: number,
    mean: number,
    z: number,
    unit: string
  ): string {
    const absZ = Math.abs(z);
    if (absZ < 1.0) {
      return `Consistent with typical baseline (within 1.0 standard deviation).`;
    }

    const direction = z > 0 ? 'higher' : 'lower';
    const magnitude = absZ >= 3.0 ? 'Substantially' : 'Moderately';

    switch (key) {
      case 'responseTime':
        return `${magnitude} ${direction} response duration (${observed.toFixed(1)}s vs baseline mean ${mean.toFixed(1)}s, z = ${z.toFixed(1)}).`;
      case 'revisionCount':
        return `${magnitude} ${direction} answer modification frequency (${observed.toFixed(0)} vs baseline mean ${mean.toFixed(1)} revisions).`;
      case 'pointerMovement':
        return `${magnitude} ${direction} pointer trajectory displacement (${observed.toFixed(0)}px vs baseline mean ${mean.toFixed(0)}px).`;
      case 'scrollDistance':
        return `${magnitude} ${direction} scrolling displacement (${observed.toFixed(0)}px vs baseline mean ${mean.toFixed(0)}px).`;
      case 'pasteDetected':
        return observed > 0
          ? `Recorded ${observed} paste event(s) exceeding normal unassisted baseline profile.`
          : 'Standard zero paste baseline.';
      default:
        return `${magnitude} ${direction} than personal baseline.`;
    }
  }
}

