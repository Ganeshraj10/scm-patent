import {
  BehavioralModel,
  BehavioralSession,
  DeviationAnalysis,
  FeatureContribution,
} from '@/types';

/**
 * Canonical 5-dimensional behavioral feature vector.
 * Preserves the exact feature set defined in ExamGuard patent specifications.
 */
export const ORDERED_FEATURES = [
  'responseTime',
  'revisionCount',
  'pointerMovement',
  'scrollDistance',
  'pasteDetected',
] as const;

export type FeatureKey = (typeof ORDERED_FEATURES)[number];

export const FEATURE_METADATA: Record<FeatureKey, { label: string; unit: string }> = {
  responseTime: { label: 'Response Time', unit: 's' },
  revisionCount: { label: 'Revision Count', unit: 'revisions' },
  pointerMovement: { label: 'Pointer Movement', unit: 'px' },
  scrollDistance: { label: 'Scroll Distance', unit: 'px' },
  pasteDetected: { label: 'Paste Frequency', unit: '%' },
};

export const TEMPORARY_PROTOTYPE_THRESHOLD = 2.5;

// ─── Linear Algebra & Numerical Inversion ─────────────────────────────────────

/**
 * Inverts a 5x5 symmetric positive-definite matrix using Cholesky decomposition.
 * Falls back to Gauss-Jordan elimination with diagonal loading for ill-conditioned matrices.
 */
export function invertMatrix5x5(matrix: number[][]): { inverse: number[][]; isSingular: boolean } {
  const n = matrix.length;
  const A: number[][] = matrix.map((row) => [...row]);

  // 1. Try Cholesky decomposition: A = L * L^T
  const L: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  let choleskySuccess = true;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k];
      }

      if (i === j) {
        const val = A[i][i] - sum;
        if (val <= 1e-7 || isNaN(val) || !isFinite(val)) {
          choleskySuccess = false;
          break;
        }
        L[i][j] = Math.sqrt(val);
      } else {
        if (L[j][j] <= 1e-7 || isNaN(L[j][j]) || !isFinite(L[j][j])) {
          choleskySuccess = false;
          break;
        }
        L[i][j] = (A[i][j] - sum) / L[j][j];
      }
    }
    if (!choleskySuccess) break;
  }

  if (choleskySuccess) {
    // Invert lower triangular L -> L_inv by forward substitution
    const Linv: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      Linv[i][i] = 1 / L[i][i];
      for (let j = 0; j < i; j++) {
        let sum = 0;
        for (let k = j; k < i; k++) {
          sum += L[i][k] * Linv[k][j];
        }
        Linv[i][j] = -sum / L[i][i];
      }
    }

    // Compute A_inv = (Linv)^T * Linv
    const inv: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        let sum = 0;
        for (let k = 0; k < n; k++) {
          sum += Linv[k][i] * Linv[k][j];
        }
        inv[i][j] = sum;
      }
    }

    const allFinite = inv.every((row) => row.every((v) => isFinite(v) && !isNaN(v)));
    if (allFinite) {
      return { inverse: inv, isSingular: false };
    }
  }

  // 2. Fallback: Gauss-Jordan elimination with diagonal loading (Ridge regularization)
  return gaussJordanInvert(matrix);
}

function gaussJordanInvert(matrix: number[][]): { inverse: number[][]; isSingular: boolean } {
  const n = matrix.length;
  // Augmented matrix [A + delta*I | I]
  const aug: number[][] = Array.from({ length: n }, (_, i) => {
    const row = new Array(2 * n).fill(0);
    for (let j = 0; j < n; j++) {
      row[j] = matrix[i][j] + (i === j ? 1e-3 : 0);
    }
    row[n + i] = 1;
    return row;
  });

  for (let i = 0; i < n; i++) {
    // Partial pivoting
    let maxRow = i;
    let maxVal = Math.abs(aug[i][i]);
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(aug[k][i]) > maxVal) {
        maxVal = Math.abs(aug[k][i]);
        maxRow = k;
      }
    }

    if (maxVal < 1e-12 || isNaN(maxVal) || !isFinite(maxVal)) {
      // Return Identity fallback if completely non-invertible
      return {
        inverse: Array.from({ length: n }, (_, r) =>
          Array.from({ length: n }, (_, c) => (r === c ? 1 : 0))
        ),
        isSingular: true,
      };
    }

    if (maxRow !== i) {
      const temp = aug[i];
      aug[i] = aug[maxRow];
      aug[maxRow] = temp;
    }

    const pivot = aug[i][i];
    for (let j = 0; j < 2 * n; j++) {
      aug[i][j] /= pivot;
    }

    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = aug[k][i];
        for (let j = 0; j < 2 * n; j++) {
          aug[k][j] -= factor * aug[i][j];
        }
      }
    }
  }

  const inv: number[][] = Array.from({ length: n }, (_, i) =>
    aug[i].slice(n, 2 * n).map((v) => (isNaN(v) || !isFinite(v) ? (i === 0 ? 1 : 0) : v))
  );

  return { inverse: inv, isSingular: false };
}

// ─── Covariance & Shrinkage Computations ──────────────────────────────────────

/**
 * Computes the 5x5 sample covariance matrix from training observations.
 */
export function computeSampleCovariance(featureVectors: number[][], means: number[]): number[][] {
  const n = featureVectors.length;
  const p = ORDERED_FEATURES.length;

  if (n <= 1) {
    // Fallback diagonal covariance for n <= 1
    return Array.from({ length: p }, (_, i) =>
      Array.from({ length: p }, (_, j) => (i === j ? 1e-3 : 0))
    );
  }

  const cov: number[][] = Array.from({ length: p }, () => Array(p).fill(0));

  for (let i = 0; i < p; i++) {
    for (let j = i; j < p; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += (featureVectors[k][i] - means[i]) * (featureVectors[k][j] - means[j]);
      }
      const val = sum / (n - 1);
      cov[i][j] = isFinite(val) && !isNaN(val) ? val : 0;
      cov[j][i] = cov[i][j];
    }
  }

  return cov;
}

/**
 * Computes the 5x5 sample correlation matrix R from sample covariance and standard deviations.
 */
export function computeSampleCorrelation(cov: number[][], stdDevs: number[]): number[][] {
  const p = ORDERED_FEATURES.length;
  const R: number[][] = Array.from({ length: p }, () => Array(p).fill(0));

  for (let i = 0; i < p; i++) {
    for (let j = 0; j < p; j++) {
      if (i === j) {
        R[i][j] = 1.0;
      } else {
        const sI = Math.max(stdDevs[i], 1e-4);
        const sJ = Math.max(stdDevs[j], 1e-4);
        const r = cov[i][j] / (sI * sJ);
        // Clamp to valid correlation range
        R[i][j] = Math.max(-0.999, Math.min(0.999, isFinite(r) && !isNaN(r) ? r : 0));
      }
    }
  }

  return R;
}

/**
 * Computes the optimal Ledoit-Wolf / Schafer-Strimmer analytical shrinkage intensity lambda.
 * Targets the Identity matrix in correlation space (or diagonal in covariance space).
 */
export function computeShrinkageIntensity(
  R: number[][],
  featureVectors: number[][],
  means: number[],
  stdDevs: number[]
): number {
  const n = featureVectors.length;
  const p = ORDERED_FEATURES.length;

  if (n <= 1) return 1.0;
  if (n <= 2) return 0.8;
  if (n <= 4) return 0.5;

  // Standardize observations
  const Z: number[][] = featureVectors.map((row) =>
    row.map((val, j) => {
      const s = Math.max(stdDevs[j], 1e-4);
      return (val - means[j]) / s;
    })
  );

  // Empirical variance of correlation estimates
  let varSum = 0;
  let rSqSum = 0;

  for (let i = 0; i < p; i++) {
    for (let j = 0; j < p; j++) {
      if (i !== j) {
        const r = R[i][j];
        rSqSum += r * r;

        // Sample variance of product z_ik * z_jk across samples
        let crossProdVar = 0;
        for (let k = 0; k < n; k++) {
          const w = Z[k][i] * Z[k][j] - r;
          crossProdVar += w * w;
        }
        varSum += (n / Math.pow(n - 1, 3)) * crossProdVar;
      }
    }
  }

  if (rSqSum <= 1e-8 || isNaN(rSqSum)) {
    return 1.0; // Already diagonal
  }

  const lambdaEstimated = varSum / rSqSum;
  // Enforce a sensible sample-size floor
  const lambdaMin = Math.max(0.05, 1 / Math.sqrt(n));
  return Math.max(lambdaMin, Math.min(1.0, isFinite(lambdaEstimated) ? lambdaEstimated : 1.0));
}

/**
 * Applies shrinkage regularization to the correlation matrix and computes its inverse:
 * R_shrunk = (1 - lambda) * R + lambda * I + eps * I
 */
export function regularizeAndInvertCorrelation(
  R: number[][],
  lambda: number
): { inverseCorrelation: number[][]; regularizedCorrelation: number[][] } {
  const p = ORDERED_FEATURES.length;
  const Rreg: number[][] = Array.from({ length: p }, () => Array(p).fill(0));

  for (let i = 0; i < p; i++) {
    for (let j = 0; j < p; j++) {
      if (i === j) {
        Rreg[i][j] = (1 - lambda) * R[i][j] + lambda * 1.0 + 1e-4; // 1e-4 ridge loading
      } else {
        Rreg[i][j] = (1 - lambda) * R[i][j];
      }
    }
  }

  const { inverse } = invertMatrix5x5(Rreg);
  return { inverseCorrelation: inverse, regularizedCorrelation: Rreg };
}

// ─── Mahalanobis Distance Engine ──────────────────────────────────────────────

/**
 * Extracts the 5-dimensional feature vector in canonical order from raw feature objects.
 */
export function extractAveragedFeatureVector(featuresList: any[]): Record<FeatureKey, number> {
  const numQuestions = featuresList.length || 1;
  let totalTime = 0;
  let totalPointer = 0;
  let totalScroll = 0;
  let totalRevisions = 0;
  let totalPaste = 0;

  featuresList.forEach((f) => {
    totalTime += f.responseTime || 0;
    totalPointer += f.pointerMovement || 0;
    totalScroll += f.scrollDistance || 0;
    totalRevisions += f.revisionCount || 0;
    totalPaste += f.pasteDetected ? 1 : 0;
  });

  return {
    responseTime: totalTime / numQuestions,
    revisionCount: totalRevisions / numQuestions,
    pointerMovement: totalPointer / numQuestions,
    scrollDistance: totalScroll / numQuestions,
    pasteDetected: (totalPaste / numQuestions) * 100,
  };
}

/**
 * Computes genuine shrinkage-regularized Mahalanobis distance D_M(x) and
 * coordinate-wise feature contributions.
 *
 * D_M(x) = sqrt( (x - mu)^T * Sigma_shrunk^-1 * (x - mu) )
 *        = sqrt( z^T * R_shrunk^-1 * z )
 */
export function calculateMahalanobisDetails(
  observedFeatures: Record<string, number>,
  model: BehavioralModel
): {
  mahalanobisDistance: number;
  featureContributions: FeatureContribution[];
} {
  const p = ORDERED_FEATURES.length;

  // Extract mean vector and standard deviations from model expectations
  const means: number[] = new Array(p).fill(0);
  const stdDevs: number[] = new Array(p).fill(1);

  ORDERED_FEATURES.forEach((featureKey, idx) => {
    const exp = model.expectations.find((e) => e.feature === featureKey);
    if (exp) {
      means[idx] = exp.mean;
      stdDevs[idx] = exp.stdDev;
    }
  });

  // Construct standardized residual vector z = (x - mu) / sigma
  const z: number[] = ORDERED_FEATURES.map((featureKey, idx) => {
    const observed = observedFeatures[featureKey] ?? 0;
    const safeStd = Math.max(stdDevs[idx], 1e-4);
    const zScore = (observed - means[idx]) / safeStd;
    return isFinite(zScore) && !isNaN(zScore) ? zScore : 0;
  });

  // Retrieve or compute inverse regularized correlation matrix
  let Rinv = model.inverseCorrelationMatrix;
  if (!Rinv || Rinv.length !== p || Rinv[0].length !== p) {
    // Reconstruct default regularized inverse if not stored on model
    const R = model.correlationMatrix || Array.from({ length: p }, (_, i) =>
      Array.from({ length: p }, (_, j) => (i === j ? 1 : 0))
    );
    const lambda = model.shrinkageLambda ?? 0.2;
    const res = regularizeAndInvertCorrelation(R, lambda);
    Rinv = res.inverseCorrelation;
  }

  // Compute y = R^-1 * z
  const y: number[] = new Array(p).fill(0);
  for (let i = 0; i < p; i++) {
    let sum = 0;
    for (let j = 0; j < p; j++) {
      sum += Rinv[i][j] * z[j];
    }
    y[i] = isFinite(sum) && !isNaN(sum) ? sum : z[i];
  }

  // Quadratic form: D_M^2 = z^T * y = sum_j (z_j * y_j)
  let dSquared = 0;
  for (let j = 0; j < p; j++) {
    dSquared += z[j] * y[j];
  }

  // Ensure non-negative under finite precision
  const safeDSquared = Math.max(0, isFinite(dSquared) && !isNaN(dSquared) ? dSquared : 0);
  const mahalanobisDistance = Math.sqrt(safeDSquared);

  // Generate coordinate-wise feature contributions
  const featureContributions: FeatureContribution[] = ORDERED_FEATURES.map((featureKey, idx) => {
    const observed = observedFeatures[featureKey] ?? 0;
    const expected = means[idx];
    const stdDev = stdDevs[idx];
    const meta = FEATURE_METADATA[featureKey];

    // Coordinate contribution to the Mahalanobis quadratic form
    const coordVal = z[idx] * y[idx];
    const contribution =
      mahalanobisDistance > 0 ? (coordVal / (mahalanobisDistance + 1e-6)) : 0;

    let direction: 'higher_than_expected' | 'lower_than_expected' | 'within_expected_range' =
      'within_expected_range';
    if (observed > expected + stdDev) {
      direction = 'higher_than_expected';
    } else if (observed < expected - stdDev) {
      direction = 'lower_than_expected';
    }

    return {
      feature: featureKey,
      label: meta.label,
      unit: meta.unit,
      expected,
      observed,
      deviation: Math.abs(observed - expected),
      contribution: isFinite(contribution) && !isNaN(contribution) ? contribution : 0,
      direction,
    };
  });

  return {
    mahalanobisDistance,
    featureContributions,
  };
}

function determineReviewStatus(
  deviationScore: number,
  sessionCount: number,
  personalizedThreshold: number
): 'normal' | 'review_required' | 'analysis_limited' {
  if (sessionCount < 10) {
    return 'analysis_limited';
  }
  if (deviationScore > personalizedThreshold) {
    return 'review_required';
  }
  return 'normal';
}

/**
 * Calculates the raw non-conformity Mahalanobis deviation score for a given set of features.
 * Used both for final graded evaluation and internally during conformal calibration.
 */
export function calculateRawDeviationScore(featuresList: any[], model: BehavioralModel): number {
  const averagedFeatures = extractAveragedFeatureVector(featuresList);
  const { mahalanobisDistance } = calculateMahalanobisDetails(averagedFeatures, model);
  return isFinite(mahalanobisDistance) && !isNaN(mahalanobisDistance) ? mahalanobisDistance : 0;
}

/**
 * Executes the shrinkage-regularized Mahalanobis deviation engine against a graded exam session.
 */
export function evaluateSessionDeviation(
  session: BehavioralSession,
  model: BehavioralModel
): DeviationAnalysis {
  const averagedFeatures = extractAveragedFeatureVector(session.features || []);
  const { mahalanobisDistance, featureContributions } = calculateMahalanobisDetails(
    averagedFeatures,
    model
  );

  const deviationScore = isFinite(mahalanobisDistance) && !isNaN(mahalanobisDistance)
    ? mahalanobisDistance
    : 0;

  const threshold = model.calibratedThreshold ?? TEMPORARY_PROTOTYPE_THRESHOLD;
  const status = determineReviewStatus(deviationScore, model.sessionCount, threshold);

  return {
    sessionId: session.id,
    studentId: session.studentId,
    deviationScore,
    personalizedThreshold: threshold,
    reviewRequired: status === 'review_required',
    confidence: model.confidence,
    featureContributions,
    computedAt: new Date().toISOString(),
    // @ts-ignore - Expose raw status for UI
    rawStatus: status,
  };
}

